"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { APPROVALS, SKILLS } from "../data";
import type { PersistenceIssue, PersistenceOperation } from "../supabase/persistenceErrors";
import type { ApprovalStatus, ChatMessage, KnowledgeNote, Project, Skill, SkillStatus } from "../types";
import { isRemoteConfigured, loadLocal, loadRemote, saveLocal, saveRemote, subscribeRemote } from "./persistence";
import {
  AppState,
  mergeChats,
  ModelProviderId,
  Notification,
  ProviderConnection,
  redactProviderKeys,
  seedState,
  updateChatStatuses,
} from "./types";

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// Cap how many messages each chat thread keeps in state — applies to private
// chats and Mesa de trabajo alike, so persisted state (localStorage and
// `workspace_state`) and rendered history don't grow unbounded over time.
const MAX_THREAD_MESSAGES = 200;

type StoreActions = {
  /** True once persisted state (local or remote) has finished loading. */
  ready: boolean;
  remoteConfigured: boolean;
  persistenceIssue: PersistenceIssue | null;
  reportPersistenceIssue: (issue: PersistenceIssue) => void;
  clearPersistenceIssue: (operation?: PersistenceOperation) => void;

  // Approvals
  decideApproval: (id: string, decision: ApprovalStatus, meta?: { title?: string; summary?: string }) => void;
  approvalStatus: (id: string) => ApprovalStatus;

  // Skills
  setSkillState: (id: string, status: SkillStatus) => void;
  skillStatus: (skill: Skill) => SkillStatus;
  addCustomSkill: (skill: Omit<Skill, "id" | "status"> & { id?: string; status?: SkillStatus }) => Skill;

  // Chats
  appendChat: (agentId: string, message: Omit<ChatMessage, "id" | "time"> & { time?: string }) => ChatMessage;
  chatFor: (agentId: string) => ChatMessage[];
  /** One-time migration: copies `chats[fromKey]` into `chats[toKey]` if `toKey` is empty and `fromKey` has messages. No-op otherwise. */
  seedThreadFromLegacy: (fromKey: string, toKey: string) => void;

  // Knowledge base
  proposeKnowledge: (note: Omit<KnowledgeNote, "id" | "status" | "date"> & { date?: string }) => KnowledgeNote;
  validateKnowledge: (id: string, approve: boolean) => void;

  // Projects
  upsertProject: (project: Project) => void;

  // Notifications
  notify: (n: Omit<Notification, "id" | "ts" | "read">) => Notification;
  markAllNotificationsRead: () => void;

  // Model connections
  setProviderConnection: (provider: ModelProviderId, connection: ProviderConnection) => void;
  removeProviderConnection: (provider: ModelProviderId) => void;
  assignAgentModel: (agentId: string, provider: ModelProviderId, model: string) => void;

  // System
  exportState: () => string;
  importState: (raw: string) => boolean;
  resetState: () => void;
};

type StoreContextValue = { state: AppState } & StoreActions;

const StoreContext = createContext<StoreContextValue | null>(null);

function logTimeline(
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  entry: { kind: AppState["timeline"][number]["kind"]; title: string; description: string; actor: string }
) {
  setState((s) => ({
    ...s,
    timeline: [
      { id: uid("EVT"), time: new Date().toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" }), ...entry },
      ...s.timeline,
    ].slice(0, 200),
  }));
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => seedState());
  const [ready, setReady] = useState(false);
  const [persistenceIssue, setPersistenceIssue] = useState<PersistenceIssue | null>(null);
  const remoteConfigured = useMemo(() => isRemoteConfigured(), []);
  const hydrated = useRef(false);

  const reportPersistenceIssue = useCallback((issue: PersistenceIssue) => {
    setPersistenceIssue(issue);
  }, []);

  const clearPersistenceIssue = useCallback((operation?: PersistenceOperation) => {
    setPersistenceIssue((current) => {
      if (!current || (operation && current.operation !== operation)) return current;
      return null;
    });
  }, []);

  // Hydrate: prefer remote (if configured), fall back to local cache. The
  // remote `workspace_state` row only ever carries the shared `roundtable`
  // thread (see pickSharedChats) — private "Chat privado" threads and
  // legacy unscoped agent threads live only in this browser's local cache,
  // so we keep the locally-loaded `chats` and just merge the remote
  // `roundtable` into it instead of replacing `chats` wholesale.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = loadLocal();
      if (!cancelled) setState(local);
      if (remoteConfigured) {
        const result = await loadRemote();
        if (!cancelled && result.ok) {
          clearPersistenceIssue("workspace-read");
          const remoteState = result.data;
          if (remoteState) {
            setState((prev) => ({ ...remoteState, chats: mergeChats(prev.chats, remoteState.chats) }));
          }
        } else if (!cancelled && !result.ok) {
          reportPersistenceIssue(result.issue);
        }
      }
      if (!cancelled) {
        hydrated.current = true;
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearPersistenceIssue, remoteConfigured, reportPersistenceIssue]);

  // Persist on every change (after initial hydration, so we don't overwrite
  // the saved state with the seed during the first render).
  useEffect(() => {
    if (!hydrated.current) return;
    saveLocal(state);
    // When there's no shared backend, appendChat already marks "gg" messages
    // as "sent" immediately (nothing to wait on), so there's nothing to
    // reconcile here.
    if (remoteConfigured) {
      saveRemote(state, (result) => {
        if (result.ok) clearPersistenceIssue("workspace-write");
        else reportPersistenceIssue(result.issue);
        setState((s) => {
          const chats = updateChatStatuses(s.chats, result.ok ? "sent" : "failed");
          return chats === s.chats ? s : { ...s, chats };
        });
      });
    }
  }, [clearPersistenceIssue, reportPersistenceIssue, state, remoteConfigured]);

  // Live-sync shared chats (e.g. Mesa de trabajo) across users: when another
  // client saves the workspace state, merge their `chats` into ours so new
  // messages appear without a manual refresh. Only `chats` is merged (by
  // message id) to avoid clobbering this client's own in-flight edits to
  // other state or dropping messages not yet round-tripped.
  useEffect(() => {
    if (!remoteConfigured) return;
    return subscribeRemote(
      (remote) => {
        clearPersistenceIssue("workspace-realtime");
        setState((s) => {
          const chats = mergeChats(s.chats, remote.chats);
          return chats === s.chats ? s : { ...s, chats };
        });
      },
      reportPersistenceIssue
    );
  }, [clearPersistenceIssue, remoteConfigured, reportPersistenceIssue]);

  // Fallback poll: Realtime subscriptions can silently fail to deliver
  // (publication/replication not configured, dropped connection, etc.), so
  // periodically re-fetch the shared chats and merge in anything new.
  // mergeChats returns the same `chats` reference when there's nothing new,
  // so this is a no-op (no re-render, no re-save) when nothing changed.
  useEffect(() => {
    if (!remoteConfigured) return;
    const interval = setInterval(() => {
      void loadRemote().then((result) => {
        if (!result.ok) {
          reportPersistenceIssue(result.issue);
          return;
        }
        clearPersistenceIssue("workspace-read");
        const remoteState = result.data;
        if (!remoteState) return;
        setState((s) => {
          const chats = mergeChats(s.chats, remoteState.chats);
          return chats === s.chats ? s : { ...s, chats };
        });
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [clearPersistenceIssue, remoteConfigured, reportPersistenceIssue]);

  const notify = useCallback<StoreActions["notify"]>((n) => {
    const full: Notification = { id: uid("NTF"), ts: Date.now(), read: false, ...n };
    setState((s) => ({ ...s, notifications: [full, ...s.notifications].slice(0, 50) }));
    return full;
  }, []);

  const decideApproval = useCallback<StoreActions["decideApproval"]>(
    (id, decision, meta = {}) => {
      setState((s) => ({ ...s, approvalDecisions: { ...s.approvalDecisions, [id]: decision } }));
      const verb = decision === "approved" ? "aprobada" : decision === "rejected" ? "rechazada" : "observada";
      logTimeline(setState, {
        kind: "approval",
        title: `Decisión: ${meta.title || id}`,
        description: meta.summary || `Solicitud ${id} marcada como ${verb}.`,
        actor: "Gerente General",
      });
      notify({
        kind: decision === "approved" ? "success" : decision === "rejected" ? "danger" : "warning",
        title: `Aprobación ${verb}`,
        body: meta.title || id,
        route: "/aprobaciones",
      });
    },
    [notify]
  );

  const approvalStatus = useCallback<StoreActions["approvalStatus"]>(
    (id) => state.approvalDecisions[id] ?? APPROVALS.find((a) => a.id === id)?.status ?? "pending",
    [state.approvalDecisions]
  );

  const setSkillState = useCallback<StoreActions["setSkillState"]>((id, status) => {
    setState((s) => ({ ...s, skillStates: { ...s.skillStates, [id]: status } }));
    logTimeline(setState, {
      kind: "skill",
      title: `Skill ${status === "active" ? "activada" : status === "observed" ? "observada" : status === "rejected" ? "rechazada" : "actualizada"}`,
      description: id,
      actor: "Gerente General",
    });
  }, []);

  const skillStatus = useCallback<StoreActions["skillStatus"]>(
    (skill) => state.skillStates[skill.id] ?? skill.status,
    [state.skillStates]
  );

  const addCustomSkill = useCallback<StoreActions["addCustomSkill"]>((skill) => {
    const full: Skill = { status: "proposed", ...skill, id: skill.id || uid("SK") } as Skill;
    setState((s) => ({ ...s, customSkills: [full, ...s.customSkills] }));
    logTimeline(setState, { kind: "skill", title: "Skill propuesta", description: full.name, actor: "Gerente General" });
    notify({ kind: "info", title: "Nueva skill propuesta", body: full.name, route: "/skills" });
    return full;
  }, [notify]);

  const appendChat = useCallback<StoreActions["appendChat"]>((agentId, message) => {
    const full: ChatMessage = {
      id: uid("MSG"),
      time: message.time || new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
      ...message,
      ...(message.role === "gg" && !message.status
        ? { status: remoteConfigured ? "pending" : "sent" }
        : {}),
    };
    setState((s) => ({
      ...s,
      chats: { ...s.chats, [agentId]: [...(s.chats[agentId] || []), full].slice(-MAX_THREAD_MESSAGES) },
    }));
    return full;
  }, [remoteConfigured]);

  const chatFor = useCallback<StoreActions["chatFor"]>((agentId) => state.chats[agentId] || [], [state.chats]);

  const seedThreadFromLegacy = useCallback<StoreActions["seedThreadFromLegacy"]>((fromKey, toKey) => {
    setState((s) => {
      if ((s.chats[toKey] || []).length > 0) return s;
      const legacy = s.chats[fromKey] || [];
      if (legacy.length === 0) return s;
      return { ...s, chats: { ...s.chats, [toKey]: legacy } };
    });
  }, []);

  const proposeKnowledge = useCallback<StoreActions["proposeKnowledge"]>((note) => {
    const full: KnowledgeNote = {
      id: uid("KB"),
      status: "proposed",
      date: note.date || new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }),
      ...note,
    };
    setState((s) => ({ ...s, knowledge: [full, ...s.knowledge] }));
    notify({ kind: "info", title: "Conocimiento propuesto", body: full.title, route: "/conocimiento" });
    return full;
  }, [notify]);

  const validateKnowledge = useCallback<StoreActions["validateKnowledge"]>((id, approve) => {
    setState((s) => ({
      ...s,
      knowledge: s.knowledge.map((k) => (k.id === id ? { ...k, status: approve ? "validated" : "rejected" } : k)),
    }));
    const note = state.knowledge.find((k) => k.id === id);
    logTimeline(setState, {
      kind: "memory",
      title: approve ? "Conocimiento validado" : "Conocimiento rechazado",
      description: note?.title || id,
      actor: "Gerente General",
    });
  }, [state.knowledge]);

  const upsertProject = useCallback<StoreActions["upsertProject"]>((project) => {
    setState((s) => {
      const exists = s.customProjects.some((p) => p.id === project.id);
      const customProjects = exists
        ? s.customProjects.map((p) => (p.id === project.id ? { ...p, ...project } : p))
        : [{ ...project, id: project.id || uid("PRY") }, ...s.customProjects];
      return { ...s, customProjects };
    });
    logTimeline(setState, { kind: "system", title: "Proyecto actualizado", description: project.name, actor: "Gerente General" });
  }, []);

  const markAllNotificationsRead = useCallback<StoreActions["markAllNotificationsRead"]>(() => {
    setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  }, []);

  const setProviderConnection = useCallback<StoreActions["setProviderConnection"]>((provider, connection) => {
    setState((s) => ({
      ...s,
      modelConnections: {
        ...s.modelConnections,
        providers: { ...s.modelConnections.providers, [provider]: connection },
      },
    }));
    notify({ kind: "success", title: "Conexión guardada", body: `Proveedor ${provider} configurado.`, route: "/conexiones" });
  }, [notify]);

  const removeProviderConnection = useCallback<StoreActions["removeProviderConnection"]>((provider) => {
    setState((s) => {
      const providers = { ...s.modelConnections.providers };
      delete providers[provider];
      return { ...s, modelConnections: { ...s.modelConnections, providers } };
    });
  }, []);

  const assignAgentModel = useCallback<StoreActions["assignAgentModel"]>((agentId, provider, model) => {
    setState((s) => ({
      ...s,
      modelConnections: {
        ...s.modelConnections,
        agentModels: { ...s.modelConnections.agentModels, [agentId]: { provider, model } },
      },
    }));
  }, []);

  // Provider API keys must never leave this browser in plaintext, so they're
  // redacted to "***redacted***" before export.
  const exportState = useCallback<StoreActions["exportState"]>(
    () => JSON.stringify({ ...state, modelConnections: redactProviderKeys(state.modelConnections) }, null, 2),
    [state]
  );

  const importState = useCallback<StoreActions["importState"]>((raw) => {
    try {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      setState((s) => {
        const merged: AppState = { ...seedState(), ...parsed, version: seedState().version };
        // A "***redacted***" apiKey came from a previously-exported file, not
        // a real key — keep this browser's existing key (if any) instead of
        // overwriting it with the placeholder.
        const providers: AppState["modelConnections"]["providers"] = {};
        for (const [id, connection] of Object.entries(merged.modelConnections.providers)) {
          if (!connection) continue;
          const key = id as ModelProviderId;
          providers[key] = connection.apiKey === "***redacted***"
            ? { ...connection, apiKey: s.modelConnections.providers[key]?.apiKey ?? "" }
            : connection;
        }
        return { ...merged, modelConnections: { ...merged.modelConnections, providers } };
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const resetState = useCallback<StoreActions["resetState"]>(() => {
    setState(seedState());
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      ready,
      remoteConfigured,
      persistenceIssue,
      reportPersistenceIssue,
      clearPersistenceIssue,
      decideApproval,
      approvalStatus,
      setSkillState,
      skillStatus,
      addCustomSkill,
      appendChat,
      chatFor,
      seedThreadFromLegacy,
      proposeKnowledge,
      validateKnowledge,
      upsertProject,
      notify,
      markAllNotificationsRead,
      setProviderConnection,
      removeProviderConnection,
      assignAgentModel,
      exportState,
      importState,
      resetState,
    }),
    [
      state,
      ready,
      remoteConfigured,
      persistenceIssue,
      reportPersistenceIssue,
      clearPersistenceIssue,
      decideApproval,
      approvalStatus,
      setSkillState,
      skillStatus,
      addCustomSkill,
      appendChat,
      chatFor,
      seedThreadFromLegacy,
      proposeKnowledge,
      validateKnowledge,
      upsertProject,
      notify,
      markAllNotificationsRead,
      setProviderConnection,
      removeProviderConnection,
      assignAgentModel,
      exportState,
      importState,
      resetState,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

export function useSkillsWithOverrides(): Skill[] {
  const { state } = useStore();
  return useMemo(
    () =>
      [...SKILLS, ...state.customSkills].map((sk) => ({
        ...sk,
        status: state.skillStates[sk.id] ?? sk.status,
      })),
    [state.customSkills, state.skillStates]
  );
}

export function usePendingApprovalsCount(): number {
  const { state } = useStore();
  return useMemo(
    () => APPROVALS.filter((a) => (state.approvalDecisions[a.id] ?? a.status) === "pending").length,
    [state.approvalDecisions]
  );
}
