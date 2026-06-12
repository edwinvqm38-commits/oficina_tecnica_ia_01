// ── Router de contexto IA + orquestador del pipeline ─────────────────────────
//
// Recibe la pregunta limpia del usuario y decide qué herramientas de contexto
// ejecutar (router puro: `detectContextIntent`). `runContextPipeline` ejecuta
// esa decisión contra Supabase (vía `contextTools`) y arma el bloque de
// contexto real (`contextPackBuilder`).
//
// Reutiliza los detectores ya existentes de `messageUtils` (códigos, búsquedas
// de RQ/COT) y añade detección de recursos, propuestas técnicas y "resumen de
// proyecto". Si la intención es sobre tablas reales pero ninguna herramienta
// resuelve, NO se inventa: se marca "needs_clarification" y el agente pide un
// código o filtro (reforzado por HUMANIZE_CTX).

import {
  detectDocumentCodes,
  detectOtherCodes,
  detectRequerimientoSearchIntent,
  detectCotizacionSearchIntent,
  isLogTableQuestion,
} from "@/lib/chat/messageUtils";
import {
  buscarCotizaciones,
  buscarCotizacionPorCodigo,
  buscarRequerimientos,
  buscarRequerimientoPorCodigo,
  buscarItemsDeRequerimiento,
  buscarPropuestaTecnicaPorCodigo,
  buscarRecursos,
  buscarProyectoPorCodigo,
  obtenerResumenProyecto,
  DEFAULT_CONTEXT_LIMIT,
  type ContextToolResult,
  type RecursosToolFilters,
} from "@/lib/chat/contextTools";
import type { CotizacionSearchFilters, RequerimientoSearchFilters } from "@/lib/chat/contextQuery";
import { buildContextPack, hasRealData } from "@/lib/chat/contextPackBuilder";
import { decideAnswerStrategy, isDataQuestion } from "@/lib/chat/contextDeterministic";

export type ContextToolName =
  | "buscarCotizaciones"
  | "buscarCotizacionPorCodigo"
  | "buscarRequerimientos"
  | "buscarRequerimientoPorCodigo"
  | "buscarPropuestaTecnicaPorCodigo"
  | "buscarRecursos"
  | "buscarProyectoPorCodigo"
  | "obtenerResumenProyecto";

export interface ContextToolCall {
  tool: ContextToolName;
  args: Record<string, unknown>;
}

export interface ContextRoutingDecision {
  intent: string;
  toolsToCall: ContextToolCall[];
  confidence: number;
  reason: string;
}

// ── Detectores propios de esta capa (no en messageUtils) ─────────────────────
const RESUMEN_RE = /\b(res[uú]men|res[uú]m[eé]me|res[uú]meme|panorama|estado\s+general|ficha\s+del?\s+proyecto)\b/i;
const PROPOSAL_RE = /\bpropuestas?\s+t[eé]cnicas?\b/i;
const RECURSO_NOUN_RE = /\brecursos?\b|\bcat[aá]logo\b/i;
const RECURSO_TRIGGER_RE = /\b(busca|buscar|lista|listar|mu[eé]stra|mu[eé]strame|dame|cu[aá]l(?:es)?|qu[eé]|registrad[oa]s?|hay|tenemos|existen|tien[ee]s)\b/i;

/** Detecta intención de consultar el catálogo de recursos. */
function detectRecursoIntent(t: string): RecursosToolFilters | null {
  if (!RECURSO_NOUN_RE.test(t)) return null;
  if (!RECURSO_TRIGGER_RE.test(t)) return null;
  return {};
}

/**
 * Decide qué herramientas de contexto ejecutar para la pregunta del usuario.
 * Router puro y testeable: no toca Supabase. Las consultas dependientes de
 * resultados en runtime (ítems de un RQ encontrado) las encadena el pipeline.
 */
export function detectContextIntent(cleanText: string): ContextRoutingDecision {
  const t = cleanText.trim();
  if (!t) return { intent: "sin_intencion_datos", toolsToCall: [], confidence: 0, reason: "Mensaje vacío." };

  const wantsResumen = RESUMEN_RE.test(t);
  const wantsProposal = PROPOSAL_RE.test(t);

  const codes = detectDocumentCodes(t);
  const cotCodes = codes.filter((c) => c.type === "COT").map((c) => c.code);
  const rqCodes = codes.filter((c) => c.type === "RQ").map((c) => c.code);
  const exclude = new Set(codes.map((c) => c.code));
  const otherCodes = detectOtherCodes(t, exclude).slice(0, 2);

  const calls: ContextToolCall[] = [];

  // RQ por código → requerimiento (el pipeline encadena sus ítems).
  for (const code of rqCodes) calls.push({ tool: "buscarRequerimientoPorCodigo", args: { code } });

  // COT por código → resumen / propuesta / cotización según intención.
  for (const code of cotCodes) {
    if (wantsResumen) calls.push({ tool: "obtenerResumenProyecto", args: { code } });
    else if (wantsProposal) calls.push({ tool: "buscarPropuestaTecnicaPorCodigo", args: { code } });
    else calls.push({ tool: "buscarCotizacionPorCodigo", args: { code } });
  }

  // Códigos que no siguen COT-/RQ-/OC- (históricos, FOR-EKA-PRO-...) →
  // cascada por código (o resumen/propuesta si así se pidió).
  for (const code of otherCodes) {
    if (wantsProposal) calls.push({ tool: "buscarPropuestaTecnicaPorCodigo", args: { code } });
    else if (wantsResumen) calls.push({ tool: "obtenerResumenProyecto", args: { code } });
    else calls.push({ tool: "buscarProyectoPorCodigo", args: { code } });
  }

  // Búsqueda libre de requerimientos ("lista RQ pendientes de Juan").
  const reqIntent = detectRequerimientoSearchIntent(t);
  if (reqIntent) {
    const { limit, ...filters } = reqIntent;
    calls.push({ tool: "buscarRequerimientos", args: { filters: filters as RequerimientoSearchFilters, limit: limit ?? DEFAULT_CONTEXT_LIMIT } });
  }

  // Búsqueda libre de cotizaciones ("últimas cotizaciones de NEXA").
  const cotIntent = detectCotizacionSearchIntent(t);
  if (cotIntent) {
    const { limit, ...filters } = cotIntent;
    calls.push({ tool: "buscarCotizaciones", args: { filters: filters as CotizacionSearchFilters, limit: limit ?? DEFAULT_CONTEXT_LIMIT } });
  }

  // Catálogo de recursos ("qué recursos están registrados").
  const recursoIntent = detectRecursoIntent(t);
  if (recursoIntent) {
    calls.push({ tool: "buscarRecursos", args: { filters: recursoIntent, limit: DEFAULT_CONTEXT_LIMIT } });
  }

  // ── Etiqueta de intención + confianza ──────────────────────────────────────
  const hasCodeCall = cotCodes.length > 0 || rqCodes.length > 0 || otherCodes.length > 0;
  let intent: string;
  let confidence: number;
  let reason: string;

  if (hasCodeCall) {
    intent = wantsResumen ? "resumen_proyecto" : wantsProposal ? "consulta_propuesta_tecnica" : "consulta_por_codigo";
    confidence = 0.9;
    reason = "Se detectó al menos un código (COT/RQ/proyecto) en el mensaje.";
  } else if (reqIntent) {
    intent = "buscar_requerimientos";
    confidence = 0.8;
    reason = "Intención de búsqueda/listado de requerimientos.";
  } else if (cotIntent) {
    intent = "buscar_cotizaciones";
    confidence = 0.8;
    reason = "Intención de búsqueda/listado de cotizaciones.";
  } else if (recursoIntent) {
    intent = "buscar_recursos";
    confidence = 0.7;
    reason = "Intención de consultar el catálogo de recursos.";
  } else if (isLogTableQuestion(t)) {
    intent = "needs_clarification";
    confidence = 0.3;
    reason = "Pregunta sobre tablas reales pero sin código ni filtro accionable: pedir aclaración, no inventar.";
  } else {
    intent = "sin_intencion_datos";
    confidence = 0;
    reason = "El mensaje no requiere consultar datos reales.";
  }

  return { intent, toolsToCall: calls, confidence, reason };
}

// ── Ejecución de una herramienta individual ──────────────────────────────────
async function executeTool(call: ContextToolCall): Promise<ContextToolResult> {
  switch (call.tool) {
    case "buscarCotizacionPorCodigo":
      return buscarCotizacionPorCodigo(String(call.args.code));
    case "buscarCotizaciones":
      return buscarCotizaciones(call.args.filters as CotizacionSearchFilters, call.args.limit as number | undefined);
    case "buscarRequerimientoPorCodigo":
      return buscarRequerimientoPorCodigo(String(call.args.code));
    case "buscarRequerimientos":
      return buscarRequerimientos(call.args.filters as RequerimientoSearchFilters, call.args.limit as number | undefined);
    case "buscarPropuestaTecnicaPorCodigo":
      return buscarPropuestaTecnicaPorCodigo(String(call.args.code));
    case "buscarRecursos":
      return buscarRecursos(call.args.filters as RecursosToolFilters, call.args.limit as number | undefined);
    case "buscarProyectoPorCodigo":
      return buscarProyectoPorCodigo(String(call.args.code));
    case "obtenerResumenProyecto":
      return obtenerResumenProyecto(String(call.args.code));
  }
}

/** Resumen serializable por herramienta (para debug y para la UI). */
export interface ContextResultSummary {
  source: string;
  status: ContextToolResult["status"];
  total: number;
  message?: string;
}

export interface ContextPipelineResult {
  /** Bloque de contexto real listo para inyectar en el system prompt (o ""). */
  block: string;
  decision: ContextRoutingDecision;
  results: ContextToolResult[];
  hasData: boolean;
  // ── Campos de control anti-alucinación ──────────────────────────────────────
  intent: string;
  confidence: number;
  /** True si la pregunta apunta a datos reales (tabla/código/búsqueda). */
  isDataQuestion: boolean;
  /** Nombres de las herramientas efectivamente ejecutadas. */
  toolsCalled: string[];
  /** Resumen por fuente (source/status/total). */
  resultsSummary: ContextResultSummary[];
  /** True → NO llamar al LLM; responder con `fallbackAnswer`. */
  shouldBlockModelAnswer: boolean;
  fallbackAnswer?: string;
  /** True → NO llamar al LLM; responder con `deterministicAnswer`. */
  shouldUseDeterministicAnswer: boolean;
  deterministicAnswer?: string;
}

function summarize(results: ContextToolResult[]): ContextResultSummary[] {
  return results.map((r) => ({ source: r.source, status: r.status, total: r.total, message: r.message }));
}

// Construye el resultado completo del pipeline aplicando la estrategia de
// respuesta (determinística / bloqueo / LLM) sobre los resultados ya obtenidos.
function finalizePipeline(
  cleanText: string,
  decision: ContextRoutingDecision,
  results: ContextToolResult[],
  block: string,
): ContextPipelineResult {
  const strategy = decideAnswerStrategy(cleanText, decision, results);
  const result: ContextPipelineResult = {
    block,
    decision,
    results,
    hasData: hasRealData(results),
    intent: decision.intent,
    confidence: decision.confidence,
    isDataQuestion: isDataQuestion(decision),
    toolsCalled: decision.toolsToCall.map((c) => c.tool),
    resultsSummary: summarize(results),
    shouldBlockModelAnswer: strategy.shouldBlockModelAnswer,
    fallbackAnswer: strategy.fallbackAnswer,
    shouldUseDeterministicAnswer: strategy.shouldUseDeterministicAnswer,
    deterministicAnswer: strategy.deterministicAnswer,
  };
  debugPipeline(cleanText, result);
  return result;
}

// Debug solo en desarrollo: permite verificar qué se recuperó realmente sin
// exponer claves ni tokens. El bloque se recorta a 1500 caracteres.
function debugPipeline(cleanText: string, r: ContextPipelineResult) {
  if (process.env.NODE_ENV === "production") return;
  console.debug("[AI_CONTEXT_PIPELINE]", {
    cleanText,
    intent: r.intent,
    confidence: r.confidence,
    isDataQuestion: r.isDataQuestion,
    toolsCalled: r.toolsCalled,
    resultsSummary: r.resultsSummary,
    blockPreview: r.block.slice(0, 1500),
    shouldBlockModelAnswer: r.shouldBlockModelAnswer,
    shouldUseDeterministicAnswer: r.shouldUseDeterministicAnswer,
    fallbackAnswer: r.fallbackAnswer,
  });
}

const SOFT_ERROR_NOTE =
  "\n\n(No pude cargar el detalle de la base de datos por un error temporal. Indícalo brevemente al usuario si pregunta por esos datos — no inventes registros.)";

/**
 * Orquestador completo: detecta intención → ejecuta herramientas → arma el
 * bloque de contexto real. Nunca lanza: ante un error devuelve una nota suave
 * para que el chat no se rompa.
 *
 * Encadena consultas dependientes de resultados:
 *  - tras encontrar un RQ por código (1 resultado) trae sus ítems.
 *  - tras resolver un código a un requerimiento único, trae sus ítems.
 */
export async function runContextPipeline(cleanText: string): Promise<ContextPipelineResult> {
  const decision = detectContextIntent(cleanText);

  // Sin herramientas que ejecutar: o no es pregunta de datos, o es una pregunta
  // de tabla sin filtro (needs_clarification). finalizePipeline decide si se
  // bloquea con una aclaración o se deja pasar al LLM normal.
  if (decision.toolsToCall.length === 0) {
    return finalizePipeline(cleanText, decision, [], "");
  }

  try {
    const results: ContextToolResult[] = [];

    for (const call of decision.toolsToCall) {
      const res = await executeTool(call);
      results.push(res);

      // Encadenado: ítems del requerimiento encontrado por código.
      if (res.source === "requerimientos" && call.tool === "buscarRequerimientoPorCodigo"
          && res.status === "success" && res.records.length === 1) {
        const rq = res.records[0];
        results.push(await buscarItemsDeRequerimiento(rq.id, DEFAULT_CONTEXT_LIMIT, rq.codigo));
      }

      // Encadenado: ítems cuando un código resolvió a un requerimiento único.
      if (res.source === "proyecto" && res.status === "success"
          && res.reference.source === "requerimiento" && res.reference.requirements?.length === 1) {
        const rq = res.reference.requirements[0];
        results.push(await buscarItemsDeRequerimiento(rq.id, DEFAULT_CONTEXT_LIMIT, rq.codigo));
      }
    }

    const block = buildContextPack(results, { intent: decision.intent });
    return finalizePipeline(cleanText, decision, results, block);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.debug("[contextRouter] pipeline error", err);
    // Error duro e inesperado: si era pregunta de datos, bloqueamos con una nota
    // segura (no inventar); si no, devolvemos la nota suave para el system prompt.
    const dataQ = isDataQuestion(decision);
    return {
      block: dataQ ? "" : SOFT_ERROR_NOTE,
      decision,
      results: [],
      hasData: false,
      intent: decision.intent,
      confidence: decision.confidence,
      isDataQuestion: dataQ,
      toolsCalled: decision.toolsToCall.map((c) => c.tool),
      resultsSummary: [],
      shouldBlockModelAnswer: dataQ,
      fallbackAnswer: dataQ
        ? "No pude consultar la base de datos por un error temporal. No voy a inventar datos: vuelve a intentarlo en unos segundos o indícame un código exacto."
        : undefined,
      shouldUseDeterministicAnswer: false,
    };
  }
}
