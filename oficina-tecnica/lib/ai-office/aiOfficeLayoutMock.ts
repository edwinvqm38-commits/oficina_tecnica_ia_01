import type { AIOfficeConnection, AIOfficeNode } from "./aiOfficeTypes";

export const aiOfficeNodesMock: AIOfficeNode[] = [
  {
    id: "node-general-manager",
    agentId: "general-manager",
    x: 50,
    y: 17,
    size: "leader",
    message: "Aprueba decisiones sensibles y define prioridades.",
  },
  {
    id: "node-cost-engineer",
    agentId: "cost-engineer",
    x: 27,
    y: 67,
    size: "standard",
    message: "Solicita validar una recomendacion de compra.",
  },
  {
    id: "node-project-management",
    agentId: "project-management",
    x: 73,
    y: 67,
    size: "standard",
    message: "Monitorea bloqueos y dependencias del cronograma.",
  },
];

export const aiOfficeConnectionsMock: AIOfficeConnection[] = [
  {
    id: "connection-manager-costs",
    fromAgentId: "general-manager",
    toAgentId: "cost-engineer",
    kind: "supervision",
    label: "supervision",
  },
  {
    id: "connection-manager-pm",
    fromAgentId: "general-manager",
    toAgentId: "project-management",
    kind: "supervision",
    label: "supervision",
  },
  {
    id: "connection-costs-pm",
    fromAgentId: "cost-engineer",
    toAgentId: "project-management",
    kind: "collaboration",
    label: "colaboracion",
  },
];
