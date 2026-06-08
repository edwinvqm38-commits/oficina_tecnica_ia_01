export type AIProjectRiskLevel = "low" | "medium" | "high" | "critical";

export type AIProjectMock = {
  id: string;
  name: string;
  client: string;
  mainDiscipline: "Electrica" | "Civil" | "Mecanica" | "Multidisciplina";
  phase: string;
  status: "on-track" | "at-risk" | "delayed" | "planning";
  progress: number;
  riskLevel: AIProjectRiskLevel;
  estimatedCost: string;
  nextMilestone: string;
  dueLabel: string;
  assignedAgents: string[];
  boardColumn: "Planificacion" | "Ejecucion" | "Control" | "Cierre";
  summary: string;
};

export const aiProjectsMock: AIProjectMock[] = [
  {
    id: "PRJ-001",
    name: "Proyecto Demo Ingenieria",
    client: "Cliente demo",
    mainDiscipline: "Multidisciplina",
    phase: "Ingenieria y control",
    status: "at-risk",
    progress: 68,
    riskLevel: "high",
    estimatedCost: "S/ 2.45 M",
    nextMilestone: "Revision de desviacion costo-plazo",
    dueLabel: "Esta semana",
    assignedAgents: ["Costos", "PM"],
    boardColumn: "Control",
    summary:
      "Proyecto mock usado para validar solicitudes gerenciales, aprobaciones y analisis multiagente.",
  },
  {
    id: "PRJ-002",
    name: "Subestacion Industrial Mock",
    client: "Operacion minera demo",
    mainDiscipline: "Electrica",
    phase: "Alcance preliminar",
    status: "planning",
    progress: 22,
    riskLevel: "medium",
    estimatedCost: "S/ 780 K",
    nextMilestone: "Matriz de entregables electricos",
    dueLabel: "10 dias",
    assignedAgents: ["PM", "Electrico futuro"],
    boardColumn: "Planificacion",
    summary:
      "Caso simulado para preparar futura revision tecnica electrica sin conectar fuentes reales.",
  },
  {
    id: "PRJ-003",
    name: "Ampliacion Civil Planta Mock",
    client: "Cliente infraestructura demo",
    mainDiscipline: "Civil",
    phase: "Ejecucion controlada",
    status: "on-track",
    progress: 54,
    riskLevel: "medium",
    estimatedCost: "S/ 1.18 M",
    nextMilestone: "Validar interferencias civiles",
    dueLabel: "15 dias",
    assignedAgents: ["PM", "Costos"],
    boardColumn: "Ejecucion",
    summary:
      "Tablero simulado para representar avance, riesgos y coordinacion de disciplina civil.",
  },
  {
    id: "PRJ-004",
    name: "Sistema Mecanico Auxiliar Mock",
    client: "Cliente industrial demo",
    mainDiscipline: "Mecanica",
    phase: "Cierre tecnico",
    status: "delayed",
    progress: 86,
    riskLevel: "high",
    estimatedCost: "S/ 420 K",
    nextMilestone: "Cerrar observaciones de montaje",
    dueLabel: "5 dias",
    assignedAgents: ["PM", "Calidad futuro"],
    boardColumn: "Cierre",
    summary:
      "Proyecto simulado para visualizar bloqueos, cierre documental y riesgo por observaciones.",
  },
];
