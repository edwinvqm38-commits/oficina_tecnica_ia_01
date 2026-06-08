export type AISkillRegistryStatus =
  | "active"
  | "proposed"
  | "observed"
  | "deprecated";

export type AISkillRegistryRisk = "low" | "medium" | "high";

export type AISkillType =
  | "analysis-workflow"
  | "review-protocol"
  | "coordination-rule"
  | "knowledge-method";

export type AISkillDiscipline =
  | "Costos y Presupuestos"
  | "Project Management"
  | "Ingenieria Electrica"
  | "Ingenieria Civil"
  | "Ingenieria Mecanica";

export type AISkillRegistryItem = {
  id: string;
  name: string;
  discipline: AISkillDiscipline;
  ownerAgent: string;
  version: string;
  status: AISkillRegistryStatus;
  skillType: AISkillType;
  dateLabel: string;
  risk: AISkillRegistryRisk;
  approvalRequired: boolean;
  activationTrigger: string;
  expectedInputs: string[];
  workflowSteps: string[];
  safetyRules: string[];
  suggestedImprovement: string;
  crossAgentValidation: {
    agents: string[];
    purpose: string;
  };
  ggApproval: {
    required: boolean;
    statusLabel: string;
    decisionScope: string;
  };
};

export const aiSkillRegistryMock: AISkillRegistryItem[] = [
  {
    id: "SK-COST-EM-001",
    name: "Revision de Presupuesto Electromecanico",
    discipline: "Costos y Presupuestos",
    ownerAgent: "Ingeniero de Costos y Presupuestos",
    version: "v0.2.0",
    status: "active",
    skillType: "analysis-workflow",
    dateLabel: "Activa mock",
    risk: "medium",
    approvalRequired: false,
    activationTrigger:
      "El GG solicita revisar presupuesto electromecanico, variacion de partidas, adicionales o impacto economico preliminar.",
    expectedInputs: [
      "Presupuesto base y partidas electromecanicas",
      "Metrados, valorizaciones y adicionales simulados",
      "Cronograma de avance o hito asociado",
      "Supuestos declarados por el GG o por otro agente",
    ],
    workflowSteps: [
      "Identificar partidas criticas de suministro, montaje y pruebas.",
      "Comparar presupuesto base contra costo observado o proyectado.",
      "Separar desviacion por metrados, precio unitario, productividad y plazo.",
      "Pedir contraste al agente Project Management si el impacto afecta ruta critica.",
      "Entregar recomendacion con supuestos, evidencia y decision requerida del GG.",
    ],
    safetyRules: [
      "No aprobar adicionales ni comprometer presupuesto.",
      "No validar costos reales sin fuente aprobada.",
      "No sustituir revision contractual, legal ni financiera formal.",
    ],
    suggestedImprovement:
      "Agregar una version v0.3.0 que obligue a cruzar desviaciones con hitos PMO antes de emitir recomendacion final.",
    crossAgentValidation: {
      agents: ["Project Management", "Futuro Ingeniero Electrico"],
      purpose:
        "Validar si la desviacion de costo esta causada por alcance tecnico, atraso o interferencia de montaje.",
    },
    ggApproval: {
      required: true,
      statusLabel: "Activa; mejoras requieren GG",
      decisionScope:
        "El GG aprueba nuevas versiones, cambios de criterio y cualquier recomendacion de accion critica.",
    },
  },
  {
    id: "SK-PM-RISK-001",
    name: "Deteccion de Retrasos y Riesgos",
    discipline: "Project Management",
    ownerAgent: "Project Management",
    version: "v0.1.0",
    status: "proposed",
    skillType: "coordination-rule",
    dateLabel: "Propuesta ayer",
    risk: "medium",
    approvalRequired: true,
    activationTrigger:
      "El GG o un agente detecta atraso, restriccion abierta, hito comprometido o riesgo de plazo-costo.",
    expectedInputs: [
      "Cronograma base o lista de hitos",
      "Avance real informado",
      "Restricciones y responsables",
      "Presupuesto o impacto economico asociado",
    ],
    workflowSteps: [
      "Identificar hito afectado y actividades dependientes.",
      "Clasificar atraso por causa: ingenieria, compras, construccion, aprobacion o costo.",
      "Cruzar impacto con el agente de Costos si hay variacion presupuestal.",
      "Proponer alternativas de recuperacion sin reprogramar oficialmente.",
      "Elevar decisiones que requieren aprobacion del GG.",
    ],
    safetyRules: [
      "No reprogramar oficialmente el proyecto.",
      "No asignar recursos ni comprometer fechas externas.",
      "No comunicar decisiones a terceros sin aprobacion del GG.",
    ],
    suggestedImprovement:
      "Solicitar observacion del GG sobre umbrales de atraso para distinguir alerta preventiva de decision critica.",
    crossAgentValidation: {
      agents: ["Ingeniero de Costos y Presupuestos", "Futuro Document Control"],
      purpose:
        "Contrastar atraso con costo acumulado, restricciones documentales y evidencia disponible.",
    },
    ggApproval: {
      required: true,
      statusLabel: "Pendiente de aprobacion",
      decisionScope:
        "El GG define si la skill puede quedar activa y que umbrales de riesgo debe usar.",
    },
  },
  {
    id: "SK-ELEC-DES-001",
    name: "Revision de Criterios de Diseno Electrico",
    discipline: "Ingenieria Electrica",
    ownerAgent: "Futuro Ingeniero Electrico",
    version: "v0.1.0",
    status: "proposed",
    skillType: "review-protocol",
    dateLabel: "Futura",
    risk: "high",
    approvalRequired: true,
    activationTrigger:
      "El GG solicita revisar criterios de diseno electrico, coherencia tecnica preliminar o brechas entre memoria, planos y metrados.",
    expectedInputs: [
      "Memoria descriptiva electrica",
      "Criterios de diseno declarados",
      "Planos, metrados y especificaciones tecnicas",
      "Normas aplicables indicadas por el responsable",
    ],
    workflowSteps: [
      "Identificar criterios electricos declarados y alcance de revision.",
      "Comparar memoria, planos, metrados y especificaciones.",
      "Marcar contradicciones, omisiones y riesgos tecnicos preliminares.",
      "Solicitar validacion cruzada a Costos si cambia metrados o presupuesto.",
      "Recomendar revision por profesional responsable cuando corresponda.",
    ],
    safetyRules: [
      "No firmar ni aprobar disenos.",
      "No declarar cumplimiento normativo definitivo.",
      "No sustituir calculo electrico especializado ni responsabilidad profesional.",
    ],
    suggestedImprovement:
      "Cuando exista agente electrico real, incorporar matriz de criterios y checklist de documentos minimos aprobados por GG.",
    crossAgentValidation: {
      agents: ["Ingeniero de Costos y Presupuestos", "Project Management"],
      purpose:
        "Detectar si un cambio tecnico electrico afecta presupuesto, plazo, entregables o aprobaciones.",
    },
    ggApproval: {
      required: true,
      statusLabel: "Futura; no activa",
      decisionScope:
        "El GG debe aprobar activacion, limites tecnicos y necesidad de especialista humano.",
    },
  },
  {
    id: "SK-PM-OBS-001",
    name: "Registro y Escalamiento de Restricciones",
    discipline: "Project Management",
    ownerAgent: "Project Management",
    version: "v0.1.0",
    status: "observed",
    skillType: "knowledge-method",
    dateLabel: "Observada hoy",
    risk: "low",
    approvalRequired: true,
    activationTrigger:
      "Un agente detecta bloqueo, responsable indefinido, fecha comprometida o informacion faltante.",
    expectedInputs: [
      "Descripcion de restriccion",
      "Responsable sugerido",
      "Fecha objetivo o hito afectado",
      "Evidencia o fuente asociada",
    ],
    workflowSteps: [
      "Registrar restriccion con impacto y responsable sugerido.",
      "Clasificar si bloquea costo, plazo, ingenieria o aprobacion.",
      "Pedir validacion del agente afectado antes de escalar.",
      "Proponer accion y fecha de revision al GG.",
    ],
    safetyRules: [
      "No asignar responsabilidad definitiva sin validacion humana.",
      "No cerrar restricciones sin evidencia.",
      "No convertir una observacion en memoria aprobada automaticamente.",
    ],
    suggestedImprovement:
      "El GG solicito agregar campo de evidencia minima antes de permitir escalamiento visual.",
    crossAgentValidation: {
      agents: ["Ingeniero de Costos y Presupuestos", "Futuro Ingeniero Civil"],
      purpose:
        "Confirmar si la restriccion afecta costo, disciplina tecnica o decision pendiente.",
    },
    ggApproval: {
      required: true,
      statusLabel: "Observada por GG",
      decisionScope:
        "Debe corregirse la evidencia minima antes de proponer una nueva version.",
    },
  },
];
