import type {
  Approval,
  ApprovalStatus,
  ChatMessage,
  KnowledgeNote,
  Project,
  Skill,
  SkillStatus,
  TimelineEvent,
} from "../types";

export type NotificationKind = "info" | "success" | "warning" | "danger";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  route: string;
  read: boolean;
  ts: number;
};

export type ModelProviderId = "anthropic" | "openai" | "google" | "ollama";

export type ProviderConnection = {
  provider: ModelProviderId;
  /** Stored only client-side / sent to the server route per-request — never written to localStorage in plaintext for cloud providers. */
  apiKey: string;
  /** For Ollama: base URL of the local server, e.g. http://localhost:11434 */
  baseUrl?: string;
  enabled: boolean;
  defaultModel: string;
};

export type AgentModelAssignment = Record<string, { provider: ModelProviderId; model: string }>;

export type ModelConnectionsState = {
  providers: Partial<Record<ModelProviderId, ProviderConnection>>;
  agentModels: AgentModelAssignment;
};

export type AppState = {
  version: number;
  approvalDecisions: Record<string, ApprovalStatus>;
  skillStates: Record<string, SkillStatus>;
  chats: Record<string, ChatMessage[]>;
  knowledge: KnowledgeNote[];
  timeline: TimelineEvent[];
  customProjects: Project[];
  customSkills: Skill[];
  notifications: Notification[];
  modelConnections: ModelConnectionsState;
};

export const STORE_VERSION = 1;

export function seedState(): AppState {
  return {
    version: STORE_VERSION,
    approvalDecisions: {},
    skillStates: {},
    chats: {},
    knowledge: [],
    timeline: [],
    customProjects: [],
    customSkills: [],
    notifications: [],
    modelConnections: {
      providers: {},
      agentModels: {},
    },
  };
}

/**
 * Threads that are intentionally shared across every user (e.g. the Mesa de
 * trabajo roundtable). Anything else in `chats` — 1:1 "Chat privado" threads
 * (`private:<email>:<agentId>`) and legacy unscoped threads (`ic`/`pm`/...)
 * — is local-only: it is never merged in from the shared backend and never
 * sent back up (see `pickSharedChats`), so one user's private conversations
 * can't leak into another user's state via the shared `workspace_state` row.
 */
export const SHARED_CHAT_THREADS: readonly string[] = ["roundtable"];

/**
 * Merges the shared `roundtable` thread by message id (union, keeping both
 * sides' new messages), so polling/realtime updates from other users don't
 * clobber messages this client just sent (and vice versa). Other thread keys
 * in `b` (private/legacy chats) are ignored on purpose — see
 * `SHARED_CHAT_THREADS`.
 *
 * Returns `a` unchanged (same reference) when there's nothing new, so
 * callers can skip the state update entirely — without this, every poll
 * tick / realtime echo would produce a new object and re-trigger the
 * persist effect forever (save -> realtime echo -> merge -> save -> ...).
 */
export function mergeChats(a: AppState["chats"], b: AppState["chats"]): AppState["chats"] {
  let changed = false;
  const merged: AppState["chats"] = { ...a };
  for (const key of SHARED_CHAT_THREADS) {
    const existing = a[key] || [];
    const incoming = b[key] || [];
    if (incoming.length === 0) continue;
    const existingIds = new Set(existing.map((m) => m.id));
    const newOnes = incoming.filter((m) => !existingIds.has(m.id));
    if (newOnes.length > 0) {
      changed = true;
      merged[key] = [...existing, ...newOnes].sort((x, y) => x.id.localeCompare(y.id));
    }
  }
  return changed ? merged : a;
}

/**
 * Strips `chats` down to only the shared threads (see `SHARED_CHAT_THREADS`)
 * before the state is sent to the shared backend, so private "Chat privado"
 * threads and legacy unscoped agent threads (`ic`/`pm`/`ie`/`gg`) never leave
 * this browser.
 */
export function pickSharedChats(chats: AppState["chats"]): AppState["chats"] {
  const result: AppState["chats"] = {};
  for (const key of SHARED_CHAT_THREADS) {
    if (chats[key]) result[key] = chats[key];
  }
  return result;
}

/**
 * Returns a copy of `modelConnections` with every provider's `apiKey`
 * redacted. Used before the state is exported or sent to the shared backend
 * — API keys must never leave this browser in plaintext.
 */
export function redactProviderKeys(modelConnections: AppState["modelConnections"]): AppState["modelConnections"] {
  const providers: AppState["modelConnections"]["providers"] = {};
  for (const [id, connection] of Object.entries(modelConnections.providers)) {
    if (!connection) continue;
    providers[id as ModelProviderId] = { ...connection, apiKey: connection.apiKey ? "***redacted***" : "" };
  }
  return { ...modelConnections, providers };
}

/**
 * Marks any still-"pending" "gg" messages with `status` (sent/failed) once
 * the persist round-trip to the shared backend settles. Returns `chats`
 * unchanged (same reference) if nothing was pending, so the persist effect
 * doesn't re-trigger itself forever.
 */
export function updateChatStatuses(chats: AppState["chats"], status: "sent" | "failed"): AppState["chats"] {
  let changed = false;
  const result: AppState["chats"] = {};
  for (const key of Object.keys(chats)) {
    const msgs = chats[key];
    if (!msgs.some((m) => m.role === "gg" && m.status === "pending")) {
      result[key] = msgs;
      continue;
    }
    changed = true;
    result[key] = msgs.map((m) => (m.role === "gg" && m.status === "pending" ? { ...m, status } : m));
  }
  return changed ? result : chats;
}

export function mergeWithSeed(partial: Partial<AppState> | null | undefined): AppState {
  const seed = seedState();
  if (!partial) return seed;
  return {
    ...seed,
    ...partial,
    version: STORE_VERSION,
    modelConnections: {
      providers: { ...seed.modelConnections.providers, ...partial.modelConnections?.providers },
      agentModels: { ...seed.modelConnections.agentModels, ...partial.modelConnections?.agentModels },
    },
  };
}

export type { Approval, ApprovalStatus, ChatMessage, KnowledgeNote, Project, Skill, SkillStatus, TimelineEvent };
