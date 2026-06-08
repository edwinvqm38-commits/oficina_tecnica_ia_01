export type AgentStatus = "operational" | "watch" | "needs-approval";

export type AIAgent = {
  id: string;
  name: string;
  role: string;
  focus: string;
  status: AgentStatus;
  autonomyLevel: string;
  currentTask: string;
  confidence: number;
  kpis: {
    label: string;
    value: string;
  }[];
};

export type AIOfficeNode = {
  id: string;
  agentId: string;
  x: number;
  y: number;
  size: "leader" | "standard";
  message: string;
};

export type AIOfficeConnection = {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  kind: "supervision" | "collaboration";
  label: string;
};

export type AIAlert = {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  owner: string;
  message: string;
  time: string;
};

export type AIActivity = {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
};

export type AIApproval = {
  id: string;
  title: string;
  requester: string;
  impact: string;
  risk: "low" | "medium" | "high";
};

export type AISkill = {
  id: string;
  agent: string;
  name: string;
  version: string;
  progress: number;
};

export type AISummaryItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
};
