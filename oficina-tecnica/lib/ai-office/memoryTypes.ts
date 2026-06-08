export type MemoryNoteType =
  | "source"
  | "project"
  | "decision"
  | "approved-skill"
  | "pending-observation"
  | "audit";

export type ObsidianFolderTarget =
  | "00_Inbox"
  | "01_Fuentes"
  | "02_Proyectos"
  | "03_Decisiones"
  | "04_Skills_Aprobadas"
  | "05_Observaciones_Pendientes"
  | "06_Auditoria";

export type MemoryApprovalStatus =
  | "draft"
  | "pending-approval"
  | "approved"
  | "rejected";

export type MemoryNote = {
  id: string;
  noteType: MemoryNoteType;
  folderTarget: ObsidianFolderTarget;
  title: string;
  projectLabel: string;
  approvalStatus: MemoryApprovalStatus;
  proposedByAgentId: string;
  sourceIds: string[];
  summary: string;
  tags: string[];
  createdAtLabel: string;
};
