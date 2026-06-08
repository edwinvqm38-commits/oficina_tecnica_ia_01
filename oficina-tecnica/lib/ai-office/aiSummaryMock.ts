import type { AISummaryItem } from "./aiOfficeTypes";

export const aiSummaryMock: AISummaryItem[] = [
  {
    id: "summary-001",
    label: "Estado general",
    value: "Operativo",
    detail: "La oficina IA esta en modo supervisado.",
  },
  {
    id: "summary-002",
    label: "Agentes activos",
    value: "2",
    detail: "Costos y Project Management.",
  },
  {
    id: "summary-003",
    label: "Aprobaciones",
    value: "2",
    detail: "Ninguna accion critica se ejecuta sola.",
  },
  {
    id: "summary-004",
    label: "Conocimiento",
    value: "Mock",
    detail: "Obsidian aun no esta conectado.",
  },
];
