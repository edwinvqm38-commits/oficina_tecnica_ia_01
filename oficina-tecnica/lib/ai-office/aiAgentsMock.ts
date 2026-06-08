import type { AIAgent } from "./aiOfficeTypes";

export const aiAgentsMock: AIAgent[] = [
  {
    id: "general-manager",
    name: "Gerente General",
    role: "Supervisor ejecutivo",
    focus: "Prioridades, aprobaciones y direccion estrategica",
    status: "operational",
    autonomyLevel: "Control total humano",
    currentTask: "Revisando salud operativa de la oficina IA",
    confidence: 96,
    kpis: [
      { label: "Decisiones", value: "4 pendientes" },
      { label: "Riesgo", value: "Moderado" },
    ],
  },
  {
    id: "cost-engineer",
    name: "Ingeniero de Costos y Presupuestos",
    role: "Agente especialista",
    focus: "Costos, metrados, presupuestos y desviaciones",
    status: "needs-approval",
    autonomyLevel: "Propone, no ejecuta",
    currentTask: "Comparando presupuesto base contra escenarios de compra",
    confidence: 88,
    kpis: [
      { label: "Alertas", value: "2 activas" },
      { label: "Ahorro", value: "S/ 18.4k" },
    ],
  },
  {
    id: "project-management",
    name: "Project Management",
    role: "Agente coordinador",
    focus: "Cronograma, bloqueos, dependencias y seguimiento",
    status: "watch",
    autonomyLevel: "Autonomia supervisada",
    currentTask: "Detectando rutas criticas y tareas con atraso potencial",
    confidence: 91,
    kpis: [
      { label: "Hitos", value: "7 activos" },
      { label: "Bloqueos", value: "1 abierto" },
    ],
  },
];
