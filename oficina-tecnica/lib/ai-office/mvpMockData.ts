import type { AgentRequest } from "./agentRequestTypes";
import type { AgentResponse } from "./agentResponseTypes";
import type { ApprovalRequest } from "./approvalWorkflowTypes";
import type { MemoryNote } from "./memoryTypes";
import type { OrchestrationEvent } from "./orchestrationEventTypes";
import type { SkillProposal } from "./skillWorkflowTypes";
import type { SourceReference } from "./sourceReferenceTypes";

const simulatedExcerptPolicy = {
  canQuote: false,
  maxExcerptLength: 0,
  requiresParaphrase: true,
  notes:
    "Fuente simulada para modelado MVP. No citar como documento real de EKA MINING SAC.",
};

export const mvpSourceReferencesMock: SourceReference[] = [
  {
    id: "src-budget-sim-001",
    title: "Presupuesto base del proyecto - fuente simulada",
    sourceType: "budget",
    simulated: true,
    dateLabel: "2026-06-04",
    owner: "EKA MINING SAC - mock",
    projectLabel: "Proyecto minero simulado",
    locationHint: "01_Fuentes/presupuestos/mock_presupuesto_base.md",
    confidence: "medium",
    excerptPolicy: simulatedExcerptPolicy,
  },
  {
    id: "src-schedule-sim-001",
    title: "Cronograma ejecutivo de obra - fuente simulada",
    sourceType: "schedule",
    simulated: true,
    dateLabel: "2026-06-04",
    owner: "EKA MINING SAC - mock",
    projectLabel: "Proyecto minero simulado",
    locationHint: "01_Fuentes/cronogramas/mock_cronograma_ejecutivo.md",
    confidence: "medium",
    excerptPolicy: simulatedExcerptPolicy,
  },
  {
    id: "src-meeting-sim-001",
    title: "Acta de coordinacion semanal - fuente simulada",
    sourceType: "meeting-note",
    simulated: true,
    dateLabel: "2026-06-04",
    owner: "EKA MINING SAC - mock",
    projectLabel: "Proyecto minero simulado",
    locationHint: "01_Fuentes/reuniones/mock_acta_coordinacion.md",
    confidence: "low",
    excerptPolicy: simulatedExcerptPolicy,
  },
];

export const mvpAgentRequestMock: AgentRequest = {
  id: "req-eka-001",
  title: "Evaluar desviacion de costos y plazo",
  requesterRole: "General Manager",
  organization: "EKA MINING SAC",
  projectLabel: "Proyecto minero simulado",
  domain: "cross-functional",
  priority: "high",
  status: "in-review",
  assignedAgentIds: ["cost-engineer", "project-management"],
  question:
    "Analizar si la desviacion de costos detectada puede afectar el plazo del proyecto y proponer acciones con riesgos y fuentes.",
  expectedOutcome:
    "Recomendacion ejecutiva con evidencia, supuestos, riesgos y aprobaciones requeridas.",
  createdAtLabel: "2026-06-04 10:00",
  contextNotes: [
    "Caso mock para diseno MVP.",
    "No contiene datos reales ni fuentes reales.",
    "Debe separar evidencia, supuesto, interpretacion y recomendacion.",
  ],
};

export const mvpAgentResponsesMock: AgentResponse[] = [
  {
    id: "resp-cost-001",
    requestId: "req-eka-001",
    agentId: "cost-engineer",
    agentName: "Ingeniero de Costos y Presupuestos",
    status: "ready-for-review",
    executiveSummary:
      "La desviacion de costos simulada requiere validar cantidades y alcance antes de recomendar ajuste presupuestal.",
    sourceIds: ["src-budget-sim-001", "src-meeting-sim-001"],
    createdAtLabel: "2026-06-04 10:12",
    findings: [
      {
        id: "finding-cost-001",
        title: "Posible desviacion presupuestal",
        evidence: [
          {
            id: "evidence-cost-001",
            summary:
              "El presupuesto base simulado muestra una partida sensible a variaciones de cantidad y precio unitario.",
            sourceIds: ["src-budget-sim-001"],
            confidence: "medium",
          },
        ],
        assumptions: [
          {
            id: "assumption-cost-001",
            statement:
              "La variacion podria mantenerse si no se renegocian condiciones o no se ajusta alcance.",
            reason:
              "La fuente simulada no incluye cotizaciones finales ni aprobacion de cambio.",
            requiresValidation: true,
          },
        ],
        interpretation: {
          id: "interpretation-cost-001",
          statement:
            "El impacto financiero debe tratarse como riesgo medio hasta validar cantidades, proveedor y alcance.",
          basedOnEvidenceIds: ["evidence-cost-001"],
          basedOnAssumptionIds: ["assumption-cost-001"],
        },
      },
    ],
    recommendations: [
      {
        id: "rec-cost-001",
        summary:
          "Solicitar validacion gerencial antes de registrar un ajuste presupuestal o recomendar proveedor alternativo.",
        rationale:
          "La evidencia disponible es simulada y no alcanza para ejecutar una decision critica.",
        riskLevel: "medium",
        approvalRequired: true,
        sourceIds: ["src-budget-sim-001"],
        nextActions: [
          "Validar cantidades con documento tecnico aprobado.",
          "Solicitar cotizacion o comparativo formal.",
          "Cruzar impacto con Project Management.",
        ],
      },
    ],
    questions: [
      {
        id: "question-cost-001",
        question:
          "Desea que prepare un comparativo formal de escenarios de costo cuando existan fuentes aprobadas?",
        reason:
          "La recomendacion presupuestal requiere base documental suficiente.",
        requestedFrom: "General Manager",
      },
    ],
  },
  {
    id: "resp-pm-001",
    requestId: "req-eka-001",
    agentId: "project-management",
    agentName: "Project Management",
    status: "ready-for-review",
    executiveSummary:
      "El riesgo de plazo simulado depende de confirmar si la partida con desviacion esta en la ruta critica.",
    sourceIds: ["src-schedule-sim-001", "src-meeting-sim-001"],
    createdAtLabel: "2026-06-04 10:18",
    findings: [
      {
        id: "finding-pm-001",
        title: "Dependencia de cronograma por validar",
        evidence: [
          {
            id: "evidence-pm-001",
            summary:
              "El cronograma simulado identifica actividades dependientes de disponibilidad de recursos.",
            sourceIds: ["src-schedule-sim-001"],
            confidence: "medium",
          },
        ],
        assumptions: [
          {
            id: "assumption-pm-001",
            statement:
              "La desviacion de costos podria afectar el plazo si retrasa aprobaciones, compras o movilizacion.",
            reason:
              "El acta simulada no confirma fechas reales de compra ni dependencia critica.",
            requiresValidation: true,
          },
        ],
        interpretation: {
          id: "interpretation-pm-001",
          statement:
            "El impacto en plazo debe escalarse como riesgo preventivo, no como atraso confirmado.",
          basedOnEvidenceIds: ["evidence-pm-001"],
          basedOnAssumptionIds: ["assumption-pm-001"],
        },
      },
    ],
    recommendations: [
      {
        id: "rec-pm-001",
        summary:
          "Abrir una observacion pendiente para validar ruta critica antes de aprobar cambios de costo o plazo.",
        rationale:
          "La evidencia simulada permite detectar riesgo, pero no confirmar impacto definitivo.",
        riskLevel: "medium",
        approvalRequired: true,
        sourceIds: ["src-schedule-sim-001"],
        nextActions: [
          "Confirmar ruta critica con cronograma aprobado.",
          "Coordinar con Costos el impacto de escenarios.",
          "Preparar recomendacion conjunta para Gerencia.",
        ],
      },
    ],
    questions: [
      {
        id: "question-pm-001",
        question:
          "Debe priorizarse la revision de ruta critica antes del analisis de proveedor alternativo?",
        reason:
          "La secuencia de revision afecta la recomendacion gerencial.",
        requestedFrom: "General Manager",
      },
    ],
  },
];

export const mvpApprovalRequestsMock: ApprovalRequest[] = [
  {
    id: "approval-eka-001",
    requestId: "req-eka-001",
    title: "Aprobar registro de observacion por desviacion costo-plazo",
    requestedByAgentId: "project-management",
    status: "pending",
    riskLevel: "medium",
    reason:
      "Se requiere autorizacion para registrar una observacion estructurada en memoria mock.",
    decisionImpact:
      "Permitiria dar seguimiento a la desviacion simulada sin ejecutar cambios reales.",
    sourceIds: ["src-budget-sim-001", "src-schedule-sim-001"],
    createdAtLabel: "2026-06-04 10:25",
  },
];

export const mvpSkillProposalsMock: SkillProposal[] = [
  {
    id: "skill-proposal-eka-001",
    name: "Analisis costo-plazo con fuentes y aprobacion",
    ownerAgentId: "project-management",
    status: "pending-approval",
    proposedVersion: {
      major: 0,
      minor: 1,
      patch: 0,
      label: "v0.1.0",
    },
    problemSolved:
      "Estandariza la revision cruzada entre desviaciones de costo y posibles impactos de plazo.",
    triggerConditions: [
      "Solicitud gerencial menciona costo y plazo.",
      "Existen fuentes de presupuesto y cronograma aprobadas o simuladas.",
      "La recomendacion podria requerir aprobacion.",
    ],
    requiredInputs: [
      "Presupuesto o comparativo de costos.",
      "Cronograma o lista de hitos.",
      "Notas de coordinacion o riesgos.",
    ],
    workflowSteps: [
      "Separar evidencia, supuestos e interpretacion.",
      "Solicitar analisis del agente complementario.",
      "Cruzar impacto financiero y de plazo.",
      "Generar recomendacion ejecutiva con aprobacion requerida.",
    ],
    expectedOutput:
      "Informe ejecutivo con fuentes, riesgos, preguntas pendientes y solicitud de aprobacion.",
    riskNotes: [
      "No debe usarse para aprobar cambios reales automaticamente.",
      "Debe bloquear recomendaciones sin fuente suficiente.",
    ],
    sourceIds: ["src-budget-sim-001", "src-schedule-sim-001"],
    changeLog: [
      {
        id: "skill-change-001",
        version: {
          major: 0,
          minor: 1,
          patch: 0,
          label: "v0.1.0",
        },
        changeType: "created",
        summary: "Propuesta inicial mock pendiente de aprobacion gerencial.",
        changedAtLabel: "2026-06-04 10:30",
        changedBy: "Project Management",
      },
    ],
  },
];

export const mvpMemoryNotesMock: MemoryNote[] = [
  {
    id: "memory-note-eka-001",
    noteType: "pending-observation",
    folderTarget: "05_Observaciones_Pendientes",
    title: "Validar desviacion costo-plazo del proyecto simulado",
    projectLabel: "Proyecto minero simulado",
    approvalStatus: "pending-approval",
    proposedByAgentId: "project-management",
    sourceIds: ["src-budget-sim-001", "src-schedule-sim-001"],
    summary:
      "Registrar seguimiento pendiente para confirmar si la desviacion de costos simulada impacta la ruta critica.",
    tags: ["mock", "costos", "plazo", "aprobacion-pendiente"],
    createdAtLabel: "2026-06-04 10:28",
  },
];

export const mvpOrchestrationEventsMock: OrchestrationEvent[] = [
  {
    id: "event-eka-001",
    requestId: "req-eka-001",
    mode: "agent-to-agent",
    severity: "warning",
    title: "Colaboracion costo-plazo iniciada",
    summary:
      "Project Management solicita al agente de Costos validar el impacto financiero antes de consolidar recomendacion.",
    createdAtLabel: "2026-06-04 10:20",
    agentMessages: [
      {
        id: "message-eka-001",
        fromAgentId: "project-management",
        toAgentId: "cost-engineer",
        message:
          "Necesito confirmar si la desviacion de costo simulada tiene alternativas que reduzcan riesgo de plazo.",
        sourceIds: ["src-schedule-sim-001", "src-budget-sim-001"],
        requiresManagerReview: true,
      },
    ],
  },
];
