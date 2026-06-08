export type AgentCollaborationMode =
  | "manager-to-agent"
  | "agent-to-agent"
  | "joint-review"
  | "approval-gate"
  | "memory-proposal"
  | "skill-proposal";

export type EventSeverity = "info" | "notice" | "warning" | "critical";

export type AgentMessage = {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  message: string;
  sourceIds: string[];
  requiresManagerReview: boolean;
};

export type OrchestrationEvent = {
  id: string;
  requestId: string;
  mode: AgentCollaborationMode;
  severity: EventSeverity;
  title: string;
  summary: string;
  agentMessages: AgentMessage[];
  createdAtLabel: string;
};
