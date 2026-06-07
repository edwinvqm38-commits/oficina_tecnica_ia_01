// ig-store.js — Persistence layer (localStorage, versioned, pub/sub)
// ============================================================================
// Single source of truth for all mutable app state. React subscribes via
// useStore(). Everything survives reloads. Export/import to .json file.
// ============================================================================

const STORE_KEY = "oficina-tecnica:v1";
const STORE_VERSION = 2;

// ─── Default seed state (built from mock data on first run) ──────────────────
function seedState() {
  return {
    version: STORE_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),

    // Approval decisions: { [approvalId]: "approved"|"observed"|"rejected"|"pending" }
    approvalDecisions: {},

    // Skill states overrides: { [skillId]: "active"|"proposed"|"observed"|"deprecated" }
    skillStates: {},

    // Chat threads per agent: { [agentId]: [ {role, content, ts, files?, meta?} ] }
    chats: {},

    // Knowledge base notes: [ {id, agentId, title, body, status, source, project, ts, validatedTs} ]
    knowledge: [],

    // GG decision timeline: [ {id, ts, type, title, detail, target, result} ]
    timeline: [],

    // User-created / edited projects (overrides + additions)
    projectOverrides: {},      // { [projectId]: {...partial} }
    customProjects: [],        // full new project objects

    // Proposed skills created from the form
    customSkills: [],

    // Dynamic agents created from the app + edits to base agents
    customAgents: [],          // full new agent objects
    agentOverrides: {},        // { [baseAgentId]: {...partial} }

    // Notifications: [ {id, ts, kind, title, body, read, route} ]
    notifications: [],

    // Uploaded files registry (metadata only; content kept in memory map)
    files: [],                 // { id, name, size, type, ts, agentId, excerpt }
  };
}

// ─── Core store ──────────────────────────────────────────────────────────────
const IGStore = (() => {
  let state = load();
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return seedState();
      const parsed = JSON.parse(raw);
      if (parsed.version !== STORE_VERSION) {
        // naive migration: merge onto fresh seed
        return { ...seedState(), ...parsed, version: STORE_VERSION };
      }
      return parsed;
    } catch (e) {
      console.warn("[IGStore] load failed, reseeding", e);
      return seedState();
    }
  }

  function persist() {
    state.updatedAt = Date.now();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("[IGStore] persist failed (quota?)", e);
    }
  }

  function emit() {
    listeners.forEach((fn) => fn(state));
  }

  function get() { return state; }

  function set(updater) {
    const patch = typeof updater === "function" ? updater(state) : updater;
    state = { ...state, ...patch };
    persist();
    emit();
    return state;
  }

  // mutate a nested slice immutably
  function update(key, updater) {
    const next = typeof updater === "function" ? updater(state[key]) : updater;
    state = { ...state, [key]: next };
    persist();
    emit();
    return state;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function reset() {
    state = seedState();
    persist();
    emit();
  }

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(raw) {
    try {
      const parsed = JSON.parse(raw);
      state = { ...seedState(), ...parsed, version: STORE_VERSION, updatedAt: Date.now() };
      persist();
      emit();
      return true;
    } catch (e) {
      console.error("[IGStore] import failed", e);
      return false;
    }
  }

  return { get, set, update, subscribe, reset, exportJSON, importJSON };
})();

// ─── High-level action helpers ──────────────────────────────────────────────
const IGActions = {
  uid(prefix = "id") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  },

  // — Approvals —
  decideApproval(id, decision, meta = {}) {
    const s = IGStore.get();
    IGStore.set({
      approvalDecisions: { ...s.approvalDecisions, [id]: decision },
    });
    IGActions.logTimeline({
      type: "approval",
      title: meta.title || `Decisión: ${id}`,
      detail: meta.summary || "",
      target: id,
      result: decision,
    });
    IGActions.notify({
      kind: decision === "approved" ? "success" : decision === "rejected" ? "danger" : "warning",
      title: `Aprobación ${decision === "approved" ? "aprobada" : decision === "rejected" ? "rechazada" : "observada"}`,
      body: meta.title || id,
      route: "approvals",
    });
  },

  // — Skills —
  setSkillState(id, st) {
    const s = IGStore.get();
    IGStore.set({ skillStates: { ...s.skillStates, [id]: st } });
    IGActions.logTimeline({
      type: "skill",
      title: `Skill ${st === "active" ? "activada" : st}`,
      detail: id,
      target: id,
      result: st,
    });
  },

  addCustomSkill(skill) {
    const s = IGStore.get();
    const full = { ...skill, id: skill.id || IGActions.uid("SK"), ts: Date.now() };
    IGStore.set({ customSkills: [full, ...s.customSkills] });
    IGActions.logTimeline({
      type: "skill",
      title: "Skill propuesta",
      detail: full.name,
      target: full.id,
      result: "proposed",
    });
    IGActions.notify({ kind: "info", title: "Nueva skill propuesta", body: full.name, route: "skills" });
    return full;
  },

  // — Chats —
  appendChat(agentId, message) {
    const s = IGStore.get();
    const thread = s.chats[agentId] || [];
    const msg = { ts: Date.now(), ...message };
    IGStore.set({ chats: { ...s.chats, [agentId]: [...thread, msg] } });
    return msg;
  },

  clearChat(agentId) {
    const s = IGStore.get();
    const next = { ...s.chats };
    delete next[agentId];
    IGStore.set({ chats: next });
  },

  // — Knowledge base —
  proposeKnowledge(note) {
    const s = IGStore.get();
    const full = {
      id: IGActions.uid("KB"),
      status: "proposed",
      ts: Date.now(),
      validatedTs: null,
      ...note,
    };
    IGStore.set({ knowledge: [full, ...s.knowledge] });
    IGActions.notify({ kind: "info", title: "Conocimiento propuesto", body: full.title, route: "memory" });
    return full;
  },

  validateKnowledge(id, approve) {
    const s = IGStore.get();
    const knowledge = s.knowledge.map((k) =>
      k.id === id
        ? { ...k, status: approve ? "validated" : "rejected", validatedTs: Date.now() }
        : k
    );
    IGStore.set({ knowledge });
    const note = knowledge.find((k) => k.id === id);
    IGActions.logTimeline({
      type: "knowledge",
      title: approve ? "Conocimiento validado" : "Conocimiento rechazado",
      detail: note ? note.title : id,
      target: id,
      result: approve ? "validated" : "rejected",
    });
  },

  // — Projects —
  upsertProject(project) {
    const s = IGStore.get();
    const exists = s.customProjects.find((p) => p.id === project.id);
    const customProjects = exists
      ? s.customProjects.map((p) => (p.id === project.id ? { ...p, ...project } : p))
      : [{ ...project, id: project.id || IGActions.uid("PRY") }, ...s.customProjects];
    IGStore.set({ customProjects });
    IGActions.logTimeline({
      type: "project",
      title: exists ? "Proyecto actualizado" : "Proyecto creado",
      detail: project.name,
      target: project.id,
      result: "ok",
    });
    return customProjects;
  },

  // — Timeline —
  logTimeline(entry) {
    const s = IGStore.get();
    const full = { id: IGActions.uid("EVT"), ts: Date.now(), ...entry };
    IGStore.set({ timeline: [full, ...s.timeline].slice(0, 200) });
    return full;
  },

  // — Notifications —
  notify(n) {
    const s = IGStore.get();
    const full = { id: IGActions.uid("NTF"), ts: Date.now(), read: false, ...n };
    IGStore.set({ notifications: [full, ...s.notifications].slice(0, 50) });
    return full;
  },

  markAllRead() {
    const s = IGStore.get();
    IGStore.set({ notifications: s.notifications.map((n) => ({ ...n, read: true })) });
  },

  // — Files (metadata persisted; raw content lives in IGFiles memory map) —
  registerFile(meta) {
    const s = IGStore.get();
    const full = { id: IGActions.uid("FILE"), ts: Date.now(), ...meta };
    IGStore.set({ files: [full, ...s.files].slice(0, 100) });
    return full;
  },
};

// ─── In-memory file content map (not persisted — too large for localStorage) ─
const IGFiles = (() => {
  const map = new Map();
  return {
    put(id, content) { map.set(id, content); },
    get(id) { return map.get(id); },
    has(id) { return map.has(id); },
  };
})();

// ─── React hook ──────────────────────────────────────────────────────────────
function useStore(selector) {
  const sel = selector || ((s) => s);
  const [, force] = React.useReducer((x) => x + 1, 0);
  const stateRef = React.useRef(IGStore.get());
  stateRef.current = IGStore.get();

  React.useEffect(() => {
    return IGStore.subscribe(() => force());
  }, []);

  return [sel(IGStore.get()), IGActions];
}

Object.assign(window, { IGStore, IGActions, IGFiles, useStore });
