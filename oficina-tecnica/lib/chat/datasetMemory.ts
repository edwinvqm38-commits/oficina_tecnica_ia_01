// ── Memoria estructurada del último dataset mostrado (por hilo) ──────────────
//
// Las consultas de seguimiento ("de esos recursos cuáles son eléctricos",
// "revisa nuevamente", "es correcto lo que dijo el IC") necesitan saber qué se
// mostró antes y qué código/proyecto se verificó. Sin esto, el router trataba
// cada mensaje como una búsqueda nueva y volvía a "listar todo".
//
// REGLAS (ver tareas 1 y 7 del spec):
//   - Solo se registran datasets provenientes de Supabase / deterministicAnswer.
//     NUNCA respuestas libres del LLM (no son evidencia).
//   - Guarda el TOTAL real (si se mostraron 20 de 31, total = 31) para que el
//     análisis técnico revise el catálogo completo, no solo la muestra.
//
// El store es a nivel de módulo (memoria de la sesión del cliente). Es
// intencional: es un caché de contexto conversacional, no una fuente de verdad.

import type { ContextToolResult } from "@/lib/chat/contextTools";
import type { PendingClarification } from "@/lib/chat/clarification";

export type DisplayedDataset = "recursos" | "requerimientos" | "requirement_items" | "cotizaciones";
export type DisplayedSource = "Supabase" | "archivo" | "none";

export interface DatasetMemory {
  lastVerifiedProjectCode?: string;
  lastVerifiedRequirementCode?: string;
  lastVerifiedCotizacionCode?: string;
  lastDisplayedDataset?: DisplayedDataset;
  /** Total REAL de coincidencias (no la muestra recortada a 20). */
  lastDisplayedTotal?: number;
  lastDisplayedSource?: DisplayedSource;
  lastDisplayedIntent?: string;
  /** Aclaración pendiente: si el siguiente mensaje elige una opción, se resuelve. */
  pendingClarification?: PendingClarification;
}

const store = new Map<string, DatasetMemory>();

export function getDatasetMemory(threadKey: string): DatasetMemory {
  return store.get(threadKey) ?? {};
}

export function updateDatasetMemory(threadKey: string, patch: Partial<DatasetMemory>): void {
  const prev = store.get(threadKey) ?? {};
  store.set(threadKey, { ...prev, ...patch });
}

export function clearDatasetMemory(threadKey: string): void {
  store.delete(threadKey);
}

/** Guarda una aclaración pendiente para el hilo (la elige el siguiente mensaje). */
export function setPendingClarification(threadKey: string, pending: PendingClarification): void {
  updateDatasetMemory(threadKey, { pendingClarification: pending });
}

/** Limpia la aclaración pendiente del hilo (resuelta o abandonada). */
export function clearPendingClarification(threadKey: string): void {
  updateDatasetMemory(threadKey, { pendingClarification: undefined });
}

/**
 * Deriva la memoria a partir de los resultados reales recuperados de Supabase.
 * Se llama SOLO cuando la app respondió de forma determinística (datos reales),
 * nunca tras una respuesta libre del LLM.
 */
export function extractDatasetMemory(results: ContextToolResult[], intent: string): Partial<DatasetMemory> {
  const patch: Partial<DatasetMemory> = { lastDisplayedIntent: intent };

  for (const r of results) {
    if (r.status !== "success") continue;
    switch (r.source) {
      case "recursos":
        patch.lastDisplayedDataset = "recursos";
        patch.lastDisplayedTotal = r.total;
        patch.lastDisplayedSource = "Supabase";
        break;
      case "requerimientos":
        if (r.projectCode) {
          // Consulta relacional "requerimientos del proyecto X".
          patch.lastVerifiedProjectCode = r.projectCode;
          patch.lastDisplayedDataset = "requerimientos";
          patch.lastDisplayedTotal = r.exactCount ?? r.total;
          patch.lastDisplayedSource = "Supabase";
        } else if (r.records.length === 1) {
          patch.lastVerifiedRequirementCode = r.records[0].codigo;
          patch.lastDisplayedDataset = "requerimientos";
          patch.lastDisplayedTotal = r.total;
          patch.lastDisplayedSource = "Supabase";
        } else if (r.records.length > 0) {
          patch.lastDisplayedDataset = "requerimientos";
          patch.lastDisplayedTotal = r.total;
          patch.lastDisplayedSource = "Supabase";
        }
        break;
      case "requerimiento_items":
        patch.lastDisplayedDataset = "requirement_items";
        patch.lastDisplayedSource = "Supabase";
        if (r.requerimientoCodigo) patch.lastVerifiedRequirementCode = r.requerimientoCodigo;
        break;
      case "cotizaciones":
        patch.lastDisplayedDataset = "cotizaciones";
        patch.lastDisplayedTotal = r.total;
        patch.lastDisplayedSource = "Supabase";
        if (r.records.length === 1) patch.lastVerifiedCotizacionCode = r.records[0].codigo;
        break;
      case "proyecto":
        patch.lastVerifiedProjectCode = r.code;
        patch.lastDisplayedSource = "Supabase";
        if (r.reference.cotizacion?.codigo) patch.lastVerifiedCotizacionCode = r.reference.cotizacion.codigo;
        break;
    }
  }
  return patch;
}

/** Registra el dataset mostrado tras una respuesta determinística. */
export function recordDisplayedDataset(threadKey: string, results: ContextToolResult[], intent: string): void {
  updateDatasetMemory(threadKey, extractDatasetMemory(results, intent));
}
