// Feedback conversacional en memoria de sesión.
//
// TODO: persistir ai_query_feedback en Supabase mediante migración futura
// cuando existan credenciales o una solución de persistencia definida.

export type FeedbackTarget =
  | "recursos"
  | "requerimientos"
  | "requerimiento"
  | "proyecto"
  | "cotizacion"
  | "items";

export interface QueryFeedbackEntry {
  id: string;
  threadKey: string;
  rawText: string;
  from?: FeedbackTarget;
  to: FeedbackTarget;
  createdAt: string;
}

const feedbackStore = new Map<string, QueryFeedbackEntry[]>();

const TARGETS: Array<[FeedbackTarget, RegExp]> = [
  ["requerimiento", /\brequerimiento\s+anterior\b|\brq\s+anterior\b/i],
  ["recursos", /\brecursos?\b|\bcat[aá]logo\b/i],
  ["requerimientos", /\brequerimientos?\b|\brqs?\b/i],
  ["cotizacion", /\bcotizaci[oó]n(?:es)?\b/i],
  ["proyecto", /\bproyectos?\b/i],
  ["items", /\b[íi]tems?\b|\bpartidas?\b|\bmateriales?\b/i],
];

function detectTarget(text: string): FeedbackTarget | null {
  for (const [target, pattern] of TARGETS) {
    if (pattern.test(text)) return target;
  }
  return null;
}

export function detectQueryFeedback(text: string): Omit<QueryFeedbackEntry, "id" | "threadKey" | "createdAt"> | null {
  const t = text.trim();
  if (!/\b(no\s+era|eso\s+no\s+era|me\s+refer[ií]a|quise\s+decir)\b/i.test(t)) return null;

  const replacement =
    t.match(/\b(?:sino|era)\s+([^,.;]+)$/i)?.[1]
    ?? t.match(/\bme\s+refer[ií]a\s+(?:a|al|a\s+la|a\s+los|a\s+las)\s+([^,.;]+)$/i)?.[1]
    ?? t.match(/\bquise\s+decir\s+([^,.;]+)$/i)?.[1]
    ?? t;
  const to = detectTarget(replacement);
  if (!to) return null;

  const rejected = t.match(/\b(?:eso\s+)?no\s+era\s+(.+?)(?:,|\s+sino\s+|\s+era\s+)/i)?.[1];
  const from = rejected ? detectTarget(rejected) ?? undefined : undefined;
  return { rawText: t, from, to };
}

export function recordQueryFeedback(
  threadKey: string,
  feedback: Omit<QueryFeedbackEntry, "id" | "threadKey" | "createdAt">,
): QueryFeedbackEntry {
  const entry: QueryFeedbackEntry = {
    ...feedback,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    threadKey,
    createdAt: new Date().toISOString(),
  };
  const previous = feedbackStore.get(threadKey) ?? [];
  feedbackStore.set(threadKey, [...previous.slice(-19), entry]);
  return entry;
}

export function getQueryFeedback(threadKey: string): QueryFeedbackEntry[] {
  return feedbackStore.get(threadKey) ?? [];
}

export function getLatestFeedback(threadKey: string): QueryFeedbackEntry | null {
  const entries = feedbackStore.get(threadKey);
  return entries?.[entries.length - 1] ?? null;
}
