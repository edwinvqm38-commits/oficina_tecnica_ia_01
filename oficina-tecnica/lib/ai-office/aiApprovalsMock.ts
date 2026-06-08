import type { AIApproval } from "./aiOfficeTypes";

export const aiApprovalsMock: AIApproval[] = [
  {
    id: "approval-001",
    title: "Autorizar recomendacion de compra alternativa",
    requester: "Ingeniero de Costos",
    impact: "Reduce costo mock y cambia proveedor sugerido",
    risk: "medium",
  },
  {
    id: "approval-002",
    title: "Reprogramar hito de validacion tecnica",
    requester: "Project Management",
    impact: "Protege ruta critica simulada",
    risk: "low",
  },
];
