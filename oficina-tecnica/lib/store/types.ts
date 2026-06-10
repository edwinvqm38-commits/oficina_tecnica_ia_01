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
 */
export function mergeChats(a: AppState["chats"], b: AppState["chats"]): AppState["chats"] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const merged: AppState["chats"] = {};
  for (const key of keys) {
    const byId = new Map<string, ChatMessage>();
    for (const m of a[key] || []) byId.set(m.id, m);
    for (const m of b[key] || []) byId.set(m.id, m);
    merged[key] = Array.from(byId.values()).sort((x, y) => x.id.localeCompare(y.id));
  }
  return merged;
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
