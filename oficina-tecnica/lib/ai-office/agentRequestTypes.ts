export type RequestPriority = "low" | "medium" | "high" | "critical";

export type RequestDomain =
  | "costs"
  | "project-management"
  | "cross-functional"
  | "executive";

export type RequestStatus =
  | "draft"
  | "submitted"
  | "triaged"
  | "in-review"
  | "waiting-for-manager"
  | "answered"
  | "approved"
  | "rejected";

export type AgentRequest = {
  id: string;
  title: string;
  requesterRole: "General Manager";
  organization: string;
  projectLabel: string;
  domain: RequestDomain;
  priority: RequestPriority;
  status: RequestStatus;
  assignedAgentIds: string[];
  question: string;
  expectedOutcome: string;
  createdAtLabel: string;
  contextNotes: string[];
};
