// ── Reglas anti-alucinación centralizadas ────────────────────────────────────
//
// Único lugar donde viven las frases exactas que el agente debe usar según el
// resultado de una consulta de contexto. El pack builder (`contextPackBuilder.ts`)
// las inyecta en el bloque de contexto, y `messageUtils.HUMANIZE_CTX` referencia
// las mismas ideas, para que el modelo nunca invente datos cuando una fuente
// está vacía, no implementada o le faltan campos.

import type { ContextToolStatus } from "@/lib/chat/contextTools";

// Frases canónicas. Mantener sincronizadas con HUMANIZE_CTX en messageUtils.ts.
export const GUARDRAIL_PHRASES = {
  noPermiso: "No tienes permiso para consultar este módulo.",
  fuentePendiente: "La fuente existe en la app, pero aún no está implementada en el contexto IA.",
  sinRegistros: "No encontré registros para esa consulta.",
  sinRegistrosCodigo: "No encontré registros para ese código.",
  faltanCampos: "Encontré el registro, pero no tiene el campo necesario para responder completamente.",
  sinCostos: "Encontré el registro, pero no hay campos de costo recuperados para responder sobre montos.",
  sinDocumento: "No hay archivo ni contexto documental disponible para responder sobre documentos.",
  errorConsulta: "Hubo un error temporal al consultar la base de datos. Indícalo brevemente y sugiere reintentar.",
} as const;

// Regla maestra que se añade al final del bloque de contexto: obliga al modelo
// a responder SOLO con lo recuperado y a declarar explícitamente lo que falta.
export const CONTEXT_GUARDRAIL_RULES = [
  "Reglas para responder con este contexto:",
  "- Responde ÚNICAMENTE con base en los registros reales mostrados arriba (consultados en vivo desde Supabase en este turno).",
  "- Si falta información, dilo explícitamente. NO inventes códigos, fechas, costos, responsables, estados ni cantidades.",
  "- Si una fuente aparece como vacía, di que no encontraste registros para esa consulta y pide un código o filtro más específico.",
  "- Si una fuente aparece como no implementada, usa exactamente: \"" + GUARDRAIL_PHRASES.fuentePendiente + "\"",
  "- Si encontraste el registro pero le falta un campo concreto (p. ej. precio unitario), indícalo de forma específica en vez de decir solo \"está pendiente\".",
].join("\n");

/** Devuelve la frase guardrail apropiada para un estado de herramienta. */
export function phraseForStatus(status: ContextToolStatus, byCode = false): string | null {
  switch (status) {
    case "empty":
      return byCode ? GUARDRAIL_PHRASES.sinRegistrosCodigo : GUARDRAIL_PHRASES.sinRegistros;
    case "not_implemented":
      return GUARDRAIL_PHRASES.fuentePendiente;
    case "error":
      return GUARDRAIL_PHRASES.errorConsulta;
    case "success":
    default:
      return null;
  }
}
