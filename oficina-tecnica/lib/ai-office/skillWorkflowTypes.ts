export type SkillStatus =
  | "draft"
  | "pending-approval"
  | "approved"
  | "observed"
  | "rejected"
  | "deprecated";

export type SkillVersion = {
  major: number;
  minor: number;
  patch: number;
  label: string;
};

export type SkillChangeLog = {
  id: string;
  version: SkillVersion;
  changeType: "created" | "patched" | "improved" | "breaking-change";
  summary: string;
  changedAtLabel: string;
  changedBy: string;
};

export type SkillProposal = {
  id: string;
  name: string;
  ownerAgentId: string;
  status: SkillStatus;
  proposedVersion: SkillVersion;
  problemSolved: string;
  triggerConditions: string[];
  requiredInputs: string[];
  workflowSteps: string[];
  expectedOutput: string;
  riskNotes: string[];
  sourceIds: string[];
  changeLog: SkillChangeLog[];
};
