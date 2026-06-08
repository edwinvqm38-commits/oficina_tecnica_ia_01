export type ApprovalStatus =
  | "pending"
  | "approved"
  | "observed"
  | "rejected"
  | "expired";

export type ApprovalRiskLevel = "low" | "medium" | "high" | "critical";

export type ApprovalDecision = {
  id: string;
  status: Exclude<ApprovalStatus, "pending">;
  decidedBy: "General Manager";
  decidedAtLabel: string;
  comments: string;
};

export type ApprovalRequest = {
  id: string;
  requestId: string;
  title: string;
  requestedByAgentId: string;
  status: ApprovalStatus;
  riskLevel: ApprovalRiskLevel;
  reason: string;
  decisionImpact: string;
  sourceIds: string[];
  createdAtLabel: string;
  decision?: ApprovalDecision;
};
