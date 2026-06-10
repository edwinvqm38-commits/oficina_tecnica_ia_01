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
 * Merges two `chats` maps by message id (union, keeping both sides' new
 * messages), so polling/realtime updates from other users don't clobber
 * messages this client just sent (and vice versa).
 *
 * Returns `a` unchanged (same reference) when `b` has nothing new, so
 * callers can skip the state update entirely — without this, every poll
 * tick / realtime echo would produce a new object and re-trigger the
 * persist effect forever (save -> realtime echo -> merge -> save -> ...).
 */
export function mergeChats(a: AppState["chats"], b: AppState["chats"]): AppState["chats"] {
  let changed = false;
  const merged: AppState["chats"] = { ...a };
  for (const key of Object.keys(b)) {
    const existing = a[key] || [];
    const incoming = b[key] || [];
    const existingIds = new Set(existing.map((m) => m.id));
    const newOnes = incoming.filter((m) => !existingIds.has(m.id));
    if (newOnes.length > 0) {
      changed = true;
      merged[key] = [...existing, ...newOnes].sort((x, y) => x.id.localeCompare(y.id));
    }
  }
  return changed ? merged : a;
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
