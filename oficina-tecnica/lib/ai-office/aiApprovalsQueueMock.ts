export type AIApprovalQueueCategory =
  | "recommendation"
  | "memory"
  | "skill"
  | "critical-decision";

export type AIApprovalQueueRisk = "low" | "medium" | "high" | "critical";

export type AIApprovalQueueStatus =
  | "pending"
  | "observed"
  | "approved"
  | "rejected";

export type AIApprovalQueueItem = {
  id: string;
  title: string;
  category: AIApprovalQueueCategory;
  origin: string;
  requestedByAgent: string;
  projectLabel: string;
  risk: AIApprovalQueueRisk;
  status: AIApprovalQueueStatus;
  decisionType: string;
  createdAtLabel: string;
  summary: string;
};

export const aiApprovalsQueueMock: AIApprovalQueueItem[] = [
  {
    id: "APR-001",
    title: "Validar plan de mitigacion costo-plazo",
    category: "critical-decision",
    origin: "Bandeja Gerencial / SOL-GG-001",
    requestedByAgent: "Project Management",
    projectLabel: "Proyecto Demo Ingenieria",
    risk: "high",
    status: "pending",
    decisionType: "Decision critica",
    createdAtLabel: "Hoy · 09:40",
    summary:
      "Requiere autorizacion del GG para priorizar acciones de recuperacion y revisar impacto presupuestal.",
  },
  {
    id: "APR-002",
    title: "Registrar memoria de desviacion costo-plazo",
    category: "memory",
    origin: "Memoria propuesta / MEM-001",
    requestedByAgent: "Ing. Costos y Presupuestos",
    projectLabel: "Proyecto Demo Ingenieria",
    risk: "medium",
    status: "pending",
    decisionType: "Memoria pendiente",
    createdAtLabel: "Hoy · 10:05",
    summary:
      "Nota operativa pendiente para conservar hallazgos, supuestos y fuentes simuladas del analisis.",
  },
  {
    id: "APR-003",
    title: "Aprobar skill Diagnostico Cronograma-Costo",
    category: "skill",
    origin: "Skills / SKILL-PM-001",
    requestedByAgent: "Project Management",
    projectLabel: "Transversal PMO",
    risk: "medium",
    status: "pending",
    decisionType: "Skill propuesta",
    createdAtLabel: "Ayer · 17:20",
    summary:
      "Nueva capacidad procedimental para estandarizar diagnosticos de atraso, costo y restricciones.",
  },
  {
    id: "APR-004",
    title: "Observar supuestos de productividad",
    category: "recommendation",
    origin: "Respuesta agente / IC",
    requestedByAgent: "Ing. Costos y Presupuestos",
    projectLabel: "Proyecto Demo Ingenieria",
    risk: "medium",
    status: "observed",
    decisionType: "Recomendacion observada",
    createdAtLabel: "Ayer · 12:10",
    summary:
      "El GG debe pedir mayor evidencia antes de aceptar supuestos de productividad usados en la desviacion.",
  },
  {
    id: "APR-005",
    title: "Preaprobar revision tecnica electrica futura",
    category: "skill",
    origin: "Roadmap Ingenieria / Electrica",
    requestedByAgent: "Futuro Agente Ing. Electrica",
    projectLabel: "Transversal Ingenieria",
    risk: "high",
    status: "pending",
    decisionType: "Skill futura",
    createdAtLabel: "Planificado",
    summary:
      "Capacidad futura para revisar alcance electrico de forma preliminar, sin firmar ni aprobar disenos.",
  },
];
