import type { AIAlert } from "./aiOfficeTypes";

export const aiAlertsMock: AIAlert[] = [
  {
    id: "alert-001",
    title: "Variacion de costo detectada",
    severity: "warning",
    owner: "Costos",
    message: "El paquete de materiales supera el umbral mock de control en 6.8%.",
    time: "Hace 12 min",
  },
  {
    id: "alert-002",
    title: "Aprobacion requerida",
    severity: "critical",
    owner: "Gerencia",
    message: "Hay una decision pendiente antes de liberar una recomendacion critica.",
    time: "Hace 25 min",
  },
  {
    id: "alert-003",
    title: "Contexto actualizado",
    severity: "info",
    owner: "Conocimiento",
    message: "El hub Obsidian mock recibio nuevas notas simuladas para revision.",
    time: "Hace 1 h",
  },
];
