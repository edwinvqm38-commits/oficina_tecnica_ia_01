// Shared domain types for the OFICINA TECNICA platform.
// Mirrors the data shapes designed in the IA Gerencial prototype (ig-data.js / ig-ops-data.js).

export type AgentType = "human" | "agent" | "agent-future";
export type AgentStatus = "active" | "needs-approval" | "future";

export type Agent = {
  id: string;
  name: string;
  initials: string;
  role: string;
  type: AgentType;
  status: AgentStatus;
  skillCount: number;
  tasks: number;
  confidence: number | null;
  focus: string;
  currentTask: string;
};

export type ConnectionKind = "supervision" | "collaboration";

export type AgentConnection = {
  id: string;
  from: string;
  to: string;
  kind: ConnectionKind;
  label: string;
};

export type AlertLevel = "high" | "medium" | "low";

export type Alert = {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  route: string;
};

export type ActivityItem = {
  id: string;
  agent: string;
  action: string;
  time: string;
  type: "response" | "analysis" | "memory" | "skill";
};

export type Risk = "low" | "medium" | "high" | "critical";
export type ProjectStatus = "on-track" | "at-risk" | "delayed" | "planning";

export type Project = {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  risk: Risk;
  column: "Planificacion" | "Ejecucion" | "Cierre" | string;
  progress: number;
  cost: string;
  nextMilestone: string;
  due: string;
  discipline: string;
  agents: string[];
  summary: string;
};

export type ApprovalCategory = "critical-decision" | "skill" | "memory" | "recommendation";
export type ApprovalStatus = "pending" | "approved" | "observed" | "rejected";

export type Approval = {
  id: string;
  category: ApprovalCategory;
  risk: Risk;
  status: ApprovalStatus;
  title: string;
  summary: string;
  agent: string;
  project: string;
  decisionType: string;
  created: string;
};

export type SkillStatus = "active" | "proposed" | "observed" | "rejected";

export type Skill = {
  id: string;
  name: string;
  status: SkillStatus;
  version: string;
  agent: string;
  discipline: string;
  risk: Risk;
  approvalRequired: boolean;
  type: string;
  trigger: string;
  inputs: string[];
  steps: string[];
  safety: string[];
  improvement: string;
  crossAgents: string[];
  crossPurpose: string;
  ggApproval: { label: string; scope: string };
  date: string;
};

export type AgentResponseFinding = {
  label: string;
  value: string;
  type: "number" | "risk" | "warning";
};

export type AgentResponse = {
  id: string;
  agentId: string;
  agentName: string;
  initials: string;
  summary: string;
  findings: AgentResponseFinding[];
  recommendations: string[];
  confidence: number;
  sources: number;
};

export type Milestone = {
  project: string;
  label: string;
  date: string;
  days: number;
  status: ProjectStatus | "at-risk" | "on-track" | "delayed";
};

export type TimelineEvent = {
  id: string;
  kind: "approval" | "skill" | "memory" | "request" | "system";
  title: string;
  description: string;
  actor: string;
  time: string;
};

export type KnowledgeStatus = "validated" | "proposed" | "rejected";

export type KnowledgeNote = {
  id: string;
  title: string;
  body: string;
  agent: string;
  project: string | null;
  status: KnowledgeStatus;
  date: string;
};

export type ChatMessage = {
  id: string;
  role: "gg" | "agent";
  text: string;
  time: string;
  agentId?: string;
  routing?: import("./llm/modelRouter").RoutingDecision;
};
