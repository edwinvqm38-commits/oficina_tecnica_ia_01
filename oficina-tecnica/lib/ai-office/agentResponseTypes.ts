import type { SourceReference } from "./sourceReferenceTypes";

export type EvidenceBlock = {
  id: string;
  summary: string;
  sourceIds: string[];
  confidence: SourceReference["confidence"];
};

export type AssumptionBlock = {
  id: string;
  statement: string;
  reason: string;
  requiresValidation: boolean;
};

export type InterpretationBlock = {
  id: string;
  statement: string;
  basedOnEvidenceIds: string[];
  basedOnAssumptionIds: string[];
};

export type AgentFinding = {
  id: string;
  title: string;
  evidence: EvidenceBlock[];
  assumptions: AssumptionBlock[];
  interpretation: InterpretationBlock;
};

export type AgentRecommendation = {
  id: string;
  summary: string;
  rationale: string;
  riskLevel: "low" | "medium" | "high";
  approvalRequired: boolean;
  sourceIds: string[];
  nextActions: string[];
};

export type AgentQuestion = {
  id: string;
  question: string;
  reason: string;
  requestedFrom: "General Manager" | "Cost and Budget Engineer" | "Project Management";
};

export type AgentResponse = {
  id: string;
  requestId: string;
  agentId: string;
  agentName: string;
  status: "draft" | "ready-for-review" | "needs-clarification" | "final";
  executiveSummary: string;
  findings: AgentFinding[];
  recommendations: AgentRecommendation[];
  questions: AgentQuestion[];
  sourceIds: string[];
  createdAtLabel: string;
};
