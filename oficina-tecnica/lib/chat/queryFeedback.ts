// ── Feedback de aprendizaje de intención (en memoria) ────────────────────────
//
// Registro simple (no ML) para mejorar la DETECCIÓN de intención y el ORDEN de
// las opciones a futuro. NO se usa para inventar datos: solo para sesgar qué
// fuente/orden proponer cuando una consulta similar vuelve a aparecer.
//
// ⚠️ PENDIENTE (recordatorio): persistir esto en Supabase (`ai_query_feedback`).
// Por ahora es un store en memoria de sesión. Cuando haya credenciales/migración,
// respaldar `recordQueryFeedback` contra la tabla con estos mismos campos.

import type { AgentId } from "./agentProfiles";

export type FeedbackSource = "requerimientos" | "requerimiento_items" | "recursos" | "cotizaciones" | "proyecto" | "documentos";

export interface QueryFeedback {
  originalQuery: string;
  detectedIntent: string;
  selectedOption?: string;
  correctedByUser?: string;
  finalIntent?: string;
  sourceUsed?: FeedbackSource;
  agent: AgentId;
  success?: boolean;
  createdAt: string;
}

const store: QueryFeedback[] = [];
const MAX = 500;

/** Registra una entrada de feedback (en memoria por ahora). */
export function recordQueryFeedback(entry: Omit<QueryFeedback, "createdAt"> & { createdAt?: string }): void {
  store.push({ ...entry, createdAt: entry.createdAt ?? new Date().toISOString() });
  if (store.length > MAX) store.splice(0, store.length - MAX);
}

/** Todas las entradas (para depuración / futura migración). */
export function getQueryFeedback(): readonly QueryFeedback[] {
  return store;
}

export function clearQueryFeedback(): void {
  store.length = 0;
}

// ── Detección de corrección del usuario ──────────────────────────────────────
// "eso no era recursos, era requerimientos" / "no, me refería a la cotización".
// Queremos la fuente AFIRMADA (a la que corrige), no la negada.
const CORRECTION_TRIGGER_RE = /\bno\s+(?:era|es|fue)\b|\bme\s+refer[ií]a\b|^no[,\s]/i;
const NEGATED_SOURCE_RE = /no\s+(?:era|es|fue|me\s+refer[ií]a\s+a)\s+(?:[a-záéíóúñ]+\s+){0,2}?(recursos?|requerimiento_items|requerimientos?|[íi]tems?|partidas?|cotizaci[oó]n(?:es)?|proyectos?)/i;
const SOURCE_WORD_RE = /(recursos?|requerimiento_items|requerimientos?|[íi]tems?|partidas?|cotizaci[oó]n(?:es)?|proyectos?)/gi;

function sourceFromWord(word: string): FeedbackSource | null {
  const w = word.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/requerimiento_items|items?|partidas?/.test(w)) return "requerimiento_items";
  if (/requerimientos?/.test(w)) return "requerimientos";
  if (/recursos?/.test(w)) return "recursos";
  if (/cotizaci/.test(w)) return "cotizaciones";
  if (/proyectos?/.test(w)) return "proyecto";
  return null;
}

export interface DetectedCorrection {
  /** Fuente a la que el usuario corrige la consulta. */
  correctedSource: FeedbackSource;
  /** Reformulación natural enrutable por el router. */
  resolvedQuery: string;
}

/**
 * Detecta una corrección de fuente del usuario. Devuelve la fuente corregida y
 * una reformulación que el router sabe enrutar. Null si no es una corrección.
 */
export function detectCorrection(cleanText: string): DetectedCorrection | null {
  if (!CORRECTION_TRIGGER_RE.test(cleanText)) return null;

  // Fuente NEGADA ("no era recursos") — la que el usuario descarta.
  const negM = cleanText.match(NEGATED_SOURCE_RE);
  const negSource = negM ? sourceFromWord(negM[1]) : null;

  // Todas las fuentes mencionadas; la corregida es la última que difiere de la negada.
  const mentioned = [...cleanText.matchAll(SOURCE_WORD_RE)].map((m) => sourceFromWord(m[1])).filter((s): s is FeedbackSource => s != null);
  if (mentioned.length === 0) return null;
  let source: FeedbackSource | null = null;
  for (let i = mentioned.length - 1; i >= 0; i--) {
    if (mentioned[i] !== negSource) { source = mentioned[i]; break; }
  }
  source = source ?? mentioned[mentioned.length - 1];
  if (!source) return null;

  const resolved: Record<FeedbackSource, string> = {
    requerimientos: "lista los requerimientos",
    requerimiento_items: "ítems del requerimiento",
    recursos: "recursos del catálogo",
    cotizaciones: "lista las cotizaciones",
    proyecto: "resumen del proyecto",
    documentos: "documentos",
  };
  return { correctedSource: source, resolvedQuery: resolved[source] };
}

// ── Sesgo de fuente a partir del historial de feedback ───────────────────────
/**
 * Devuelve la fuente preferida para una consulta parecida según correcciones/
 * elecciones pasadas exitosas. Heurística simple por solapamiento de palabras.
 */
export function preferredSourceFor(query: string): FeedbackSource | null {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const qWords = new Set(norm(query).split(/\s+/).filter((w) => w.length > 3));
  if (qWords.size === 0) return null;

  const score = new Map<FeedbackSource, number>();
  for (const f of store) {
    if (f.success === false || !f.sourceUsed) continue;
    const fWords = norm(f.originalQuery).split(/\s+/).filter((w) => w.length > 3);
    const overlap = fWords.filter((w) => qWords.has(w)).length;
    if (overlap >= 2) score.set(f.sourceUsed, (score.get(f.sourceUsed) ?? 0) + overlap);
  }
  let best: FeedbackSource | null = null;
  let bestScore = 0;
  for (const [src, sc] of score) if (sc > bestScore) { best = src; bestScore = sc; }
  return best;
}
