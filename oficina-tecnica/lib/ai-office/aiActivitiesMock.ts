import type { AIActivity } from "./aiOfficeTypes";

export const aiActivitiesMock: AIActivity[] = [
  {
    id: "activity-001",
    actor: "Project Management",
    action: "priorizo",
    target: "tres hitos de la ruta critica",
    time: "09:40",
  },
  {
    id: "activity-002",
    actor: "Costos",
    action: "preparo",
    target: "un escenario de optimizacion presupuestal",
    time: "09:22",
  },
  {
    id: "activity-003",
    actor: "Gerencia",
    action: "solicito",
    target: "validacion antes de cualquier accion sensible",
    time: "08:55",
  },
  {
    id: "activity-004",
    actor: "Agentes",
    action: "cruzaron",
    target: "cronograma mock contra impacto de costos",
    time: "08:30",
  },
];
