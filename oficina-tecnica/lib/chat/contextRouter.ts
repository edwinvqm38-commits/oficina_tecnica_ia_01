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
  contarRegistros,
  buscarDocumentosCotizacion,
  DEFAULT_CONTEXT_LIMIT,
  type ContextToolResult,
  type RecursosToolFilters,
  type CountToolFilters,
  type CountableContextTable,
} from "@/lib/chat/contextTools";
import { moneyPrefix, type CotizacionSearchFilters, type RequerimientoSearchFilters } from "@/lib/chat/contextQuery";
import { buildContextPack, hasRealData } from "@/lib/chat/contextPackBuilder";

export type ContextToolName =
  | "buscarCotizaciones"
  | "buscarCotizacionPorCodigo"
  | "buscarRequerimientos"
  | "buscarRequerimientoPorCodigo"
  | "buscarPropuestaTecnicaPorCodigo"
  | "buscarRecursos"
  | "buscarProyectoPorCodigo"
  | "obtenerResumenProyecto"
  | "contarRegistros"
  | "buscarDocumentosCotizacion";

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
const COUNT_TRIGGER_RE = /\b(cu[aá]nt[oa]s?|cantidad|n[uú]mero|total|conteo|contar|registrad[oa]s?|registrados?|tenemos\s+registrad[oa]s?)\b/i;
const COT_COUNT_NOUN_RE = /\bcotizaci[oó]n(?:es)?\b|\bcots?\b|\blog\s+de\s+cotizaciones\b/i;
const RQ_COUNT_NOUN_RE = /\brequerimientos?\b|\brqs?\b|\blog\s+de\s+requerimientos\b/i;
const RESOURCE_COUNT_NOUN_RE = /\brecursos?\b|\bcat[aá]logo\b/i;
const TABLE_SUMMARY_TRIGGER_RE = /\b(dashboard|tablero|tabla\s+resumen|tabla|resumen|reporte|informe|gr[aá]fico|grafico|mu[eé]strame|mostrar|genera|generar|prepara|preparar)\b/i;
const COT_AMOUNT_QUESTION_RE = /\b(cu[aá]nto(?:s)?|monto|importe|valor|ofertad[ao]|ofertamos|oferta)\b/i;
const COT_DETAIL_QUESTION_RE = /\b(detalle|datos|ficha|desglose|informaci[oó]n|resumen)\b/i;
const DOCUMENTS_RE = /\b(documentos?|documentaci[oó]n|archivos?|adjuntos?|drive|sustentos?|anexos?)\b/i;

type CountIntent = {
  table: CountableContextTable;
  filters: CountToolFilters;
};

/** Detecta intención de consultar el catálogo de recursos. */
function detectRecursoIntent(t: string): RecursosToolFilters | null {
  if (!RECURSO_NOUN_RE.test(t)) return null;
  if (!RECURSO_TRIGGER_RE.test(t)) return null;
  return {};
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function detectEstadoFilter(t: string): string | undefined {
  if (/\bpendientes?\b|\bpendientes?\s+de\s+atenci[oó]n\b|\bpor\s+atender\b/i.test(t)) return "Pendiente";
  if (/\ben\s+proceso\b|\ben\s+curso\b/i.test(t)) return "En proceso";
  if (/\batendidos?\b|\bcompletados?\b|\bfinalizados?\b|\bculminados?\b|\bcerrados?\b/i.test(t)) return "Atendido";
  return undefined;
}

function detectDateColumn(t: string, table: CountableContextTable): CountToolFilters["dateColumn"] {
  if (table === "cotizaciones" && /\bfecha\s+registro\b|\bregistrad[ao]s?\b/i.test(t)) return "fecha_registro";
  if (table === "requerimientos" && /\bfecha\s+requerida\b|\brequerid[ao]s?\b/i.test(t)) return "fecha_requerida";
  if (table === "requerimientos" && /\bfecha\s+solicitud\b|\bsolicitad[ao]s?\b/i.test(t)) return "fecha_solicitud";
  return "created_at";
}

function detectPeriodFilter(t: string): Pick<CountToolFilters, "dateFrom" | "dateTo" | "periodLabel"> {
  const today = startOfLocalDay(new Date());
  if (/\bhoy\b/i.test(t)) {
    return { dateFrom: isoDate(today), dateTo: isoDate(addDays(today, 1)), periodLabel: "hoy" };
  }
  if (/\bayer\b/i.test(t)) {
    const yesterday = addDays(today, -1);
    return { dateFrom: isoDate(yesterday), dateTo: isoDate(today), periodLabel: "ayer" };
  }
  if (/\beste\s+mes\b|\bmes\s+actual\b|\ben\s+el\s+mes\b/i.test(t)) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return { dateFrom: isoDate(start), dateTo: isoDate(next), periodLabel: "este mes" };
  }
  if (/\bmes\s+pasado\b|\bmes\s+anterior\b/i.test(t)) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const next = new Date(today.getFullYear(), today.getMonth(), 1);
    return { dateFrom: isoDate(start), dateTo: isoDate(next), periodLabel: "mes pasado" };
  }
  if (/\besta\s+semana\b|\bsemana\s+actual\b/i.test(t)) {
    const day = today.getDay() || 7;
    const start = addDays(today, 1 - day);
    return { dateFrom: isoDate(start), dateTo: isoDate(addDays(start, 7)), periodLabel: "esta semana" };
  }
  if (/\bsemana\s+pasada\b|\bsemana\s+anterior\b/i.test(t)) {
    const day = today.getDay() || 7;
    const thisWeekStart = addDays(today, 1 - day);
    const lastWeekStart = addDays(thisWeekStart, -7);
    return { dateFrom: isoDate(lastWeekStart), dateTo: isoDate(thisWeekStart), periodLabel: "semana pasada" };
  }
  return {};
}

function detectCountIntent(t: string): CountIntent | null {
  if (!COUNT_TRIGGER_RE.test(t) && !TABLE_SUMMARY_TRIGGER_RE.test(t)) return null;
  const table: CountableContextTable | null = COT_COUNT_NOUN_RE.test(t)
    ? "cotizaciones"
    : RQ_COUNT_NOUN_RE.test(t)
      ? "requerimientos"
      : RESOURCE_COUNT_NOUN_RE.test(t)
        ? "recursos"
        : null;
  if (!table) return null;

  const filters: CountToolFilters = {
    estado: detectEstadoFilter(t),
    dateColumn: detectDateColumn(t, table),
    ...detectPeriodFilter(t),
  };
  return { table, filters };
}

function buildPeriodSearchFilters(
  t: string,
  table: "cotizaciones" | "requerimientos",
): CotizacionSearchFilters | RequerimientoSearchFilters | null {
  const isCot = table === "cotizaciones";
  const nounMatches = isCot ? COT_COUNT_NOUN_RE.test(t) : RQ_COUNT_NOUN_RE.test(t);
  if (!nounMatches || !TABLE_SUMMARY_TRIGGER_RE.test(t)) return null;

  const period = detectPeriodFilter(t);
  const estado = detectEstadoFilter(t);
  const hasUsefulFilter = Boolean(period.dateFrom || period.dateTo || estado);
  if (!hasUsefulFilter && !/\b(todas?|registrad[ao]s?|actuales?|vigentes?|existentes?)\b/i.test(t)) return null;

  if (isCot) {
    return {
      estado,
      recent: true,
      limit: DEFAULT_CONTEXT_LIMIT,
      dateColumn: "fecha_registro",
      ...period,
    } as CotizacionSearchFilters & { limit?: number };
  }

  return {
    estado,
    recent: true,
    limit: DEFAULT_CONTEXT_LIMIT,
  } as RequerimientoSearchFilters & { limit?: number };
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
  const countIntent = detectCountIntent(t);

  if (countIntent) {
    calls.push({ tool: "contarRegistros", args: { table: countIntent.table, filters: countIntent.filters } });
  }

  // RQ por código → requerimiento (el pipeline encadena sus ítems).
  for (const code of rqCodes) calls.push({ tool: "buscarRequerimientoPorCodigo", args: { code } });

  // COT por código → resumen / propuesta / cotización según intención.
  for (const code of cotCodes) {
    if (DOCUMENTS_RE.test(t)) calls.push({ tool: "buscarDocumentosCotizacion", args: { code } });
    else if (wantsResumen) calls.push({ tool: "obtenerResumenProyecto", args: { code } });
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
  const reqSummaryIntent = buildPeriodSearchFilters(t, "requerimientos") as (RequerimientoSearchFilters & { limit?: number }) | null;
  if (reqIntent || reqSummaryIntent) {
    const { limit, ...filters } = (reqIntent ?? reqSummaryIntent)!;
    calls.push({ tool: "buscarRequerimientos", args: { filters: filters as RequerimientoSearchFilters, limit: limit ?? DEFAULT_CONTEXT_LIMIT } });
  }

  // Búsqueda libre de cotizaciones ("últimas cotizaciones de NEXA").
  const cotIntent = detectCotizacionSearchIntent(t);
  const cotSummaryIntent = buildPeriodSearchFilters(t, "cotizaciones") as (CotizacionSearchFilters & { limit?: number }) | null;
  if (cotIntent || cotSummaryIntent) {
    const { limit, ...filters } = (cotIntent ?? cotSummaryIntent)!;
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

  if (countIntent && !hasCodeCall) {
    intent = `contar_${countIntent.table}`;
    confidence = 0.9;
    reason = "Intención de conteo/agregado sobre una tabla real de Supabase.";
  } else if (hasCodeCall) {
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
    case "contarRegistros":
      return contarRegistros(call.args.table as CountableContextTable, call.args.filters as CountToolFilters | undefined);
    case "buscarDocumentosCotizacion":
      return buscarDocumentosCotizacion(String(call.args.code), call.args.limit as number | undefined);
  }
}

export interface ContextPipelineResult {
  /** Bloque de contexto real listo para inyectar en el system prompt (o ""). */
  block: string;
  decision: ContextRoutingDecision;
  results: ContextToolResult[];
  hasData: boolean;
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function summarizeQuery(query: Record<string, unknown>): string {
  const parts: string[] = [];
  if (query.periodLabel) parts.push(`periodo: ${query.periodLabel}`);
  if (query.estado) parts.push(`estado: ${query.estado}`);
  if (query.dateFrom || query.dateTo) parts.push(`rango: ${query.dateFrom ?? "inicio"} a ${query.dateTo ?? "fin"}`);
  return parts.length ? parts.join(" · ") : "sin filtros adicionales";
}

function cotizacionRow(cot: import("@/lib/chat/contextQuery").CotizacionSummary): string {
  const moneda = moneyPrefix(cot.moneda_codigo);
  const monto = cot.monto == null ? "—" : `${moneda} ${formatMoney(cot.monto)}`;
  return `| ${cot.codigo} | ${cot.proyecto ?? "—"} | ${cot.cliente_nombre ?? "—"} | ${cot.unidad_trabajo_nombre ?? "—"} | ${cot.estado_propuesta ?? cot.estado ?? "—"} | ${cot.avance ?? "—"}% | ${monto} |`;
}

function requerimientoRow(rq: import("@/lib/chat/contextQuery").RequirementSummary): string {
  return `| ${rq.codigo} | ${rq.cotizacion_codigo ?? "—"} | ${rq.proyecto_servicio ?? "—"} | ${rq.estado ?? "—"} | ${rq.avance ?? "—"}% | ${rq.responsable ?? "—"} |`;
}

function recursoRow(r: import("@/lib/chat/contextTools").RecursoLite): string {
  const precio = r.precio_unitario_ref == null ? "—" : `${r.moneda_codigo ?? "PEN"} ${formatMoney(r.precio_unitario_ref)}`;
  return `| ${r.codigo_recurso} | ${r.descripcion} | ${r.tipo_recurso_nombre ?? "—"} | ${r.estado ?? "—"} | ${precio} |`;
}

function countSummaryAnswer(results: ContextToolResult[]): string | null {
  const count = results.find((res) => res.source === "conteo" && res.status === "success");
  if (!count || count.source !== "conteo") return null;

  const lines = [
    `Tenemos **${count.total} ${count.label}** registrados en Supabase (${summarizeQuery(count.query)}).`,
  ];

  const cotizaciones = results.find((res) => res.source === "cotizaciones" && res.status === "success");
  if (cotizaciones?.source === "cotizaciones" && cotizaciones.records.length > 0) {
    lines.push("", "| Cotización | Proyecto | Cliente | Unidad | Estado | Avance | Monto |", "|---|---|---|---|---|---:|---:|");
    lines.push(...cotizaciones.records.map(cotizacionRow));
    if (cotizaciones.total > cotizaciones.records.length) {
      lines.push("", `Mostré ${cotizaciones.records.length} de ${cotizaciones.total}. Usa un filtro para acotar más.`);
    }
    return lines.join("\n");
  }

  const requerimientos = results.find((res) => res.source === "requerimientos" && res.status === "success");
  if (requerimientos?.source === "requerimientos" && requerimientos.records.length > 0) {
    lines.push("", "| RQ | Cotización | Proyecto/servicio | Estado | Avance | Responsable |", "|---|---|---|---|---:|---|");
    lines.push(...requerimientos.records.map(requerimientoRow));
    if (requerimientos.total > requerimientos.records.length) {
      lines.push("", `Mostré ${requerimientos.records.length} de ${requerimientos.total}. Usa un filtro para acotar más.`);
    }
    return lines.join("\n");
  }

  const recursos = results.find((res) => res.source === "recursos" && res.status === "success");
  if (recursos?.source === "recursos" && recursos.records.length > 0) {
    lines.push("", "| Código | Descripción | Tipo | Estado | P.U. ref. |", "|---|---|---|---|---:|");
    lines.push(...recursos.records.map(recursoRow));
    if (recursos.total > recursos.records.length) {
      lines.push("", `Mostré ${recursos.records.length} de ${recursos.total}. Usa un filtro para acotar más.`);
    }
  }

  return lines.join("\n");
}

function cotizacionDetailAnswer(cot: import("@/lib/chat/contextQuery").CotizacionSummary): string {
  const moneda = moneyPrefix(cot.moneda_codigo);
  const rows = [
    ["Cotización", cot.codigo],
    ["Proyecto", cot.proyecto ?? "—"],
    ["Cliente", cot.cliente_nombre ?? "—"],
    ["Unidad de trabajo", cot.unidad_trabajo_nombre ?? "—"],
    ["Tipo de servicio", cot.tipo_servicio_nombre ?? "—"],
    ["Estado propuesta", cot.estado_propuesta ?? cot.estado ?? "—"],
    ["Monto ofertado", cot.monto == null ? "—" : `${moneda} ${formatMoney(cot.monto)}`],
    ["Avance", `${cot.avance ?? "—"}%`],
    ["Solicitante", cot.solicitante ?? "—"],
    ["Responsable técnico", cot.responsable_tecnico ?? "—"],
    ["Responsable económico", cot.responsable_economico ?? "—"],
    ["Fecha registro", cot.fecha_registro ?? "—"],
    ["Fecha invitación", cot.fecha_invitacion ?? "—"],
    ["Fecha visita técnica", cot.fecha_visita_tecnica ?? "—"],
    ["Fecha consultas", cot.fecha_consultas ?? "—"],
    ["Fecha abs. consultas", cot.fecha_abs_consultas ?? "—"],
    ["Fecha entrega", cot.fecha_entrega ?? "—"],
    ["Fecha entregada", cot.fecha_entregada ?? "—"],
    ["Fecha OC", cot.fecha_oc ?? "—"],
    ["OC", cot.oc ?? "—"],
  ];

  const table = [
    "| Campo | Dato registrado |",
    "|---|---|",
    ...rows.map(([label, value]) => `| ${label} | ${value} |`),
  ].join("\n");

  const economicRows = (cot.resumen_economico ?? []).filter((row) => row.base !== 0 || row.oferta !== 0 || (row.real ?? 0) !== 0);
  const economicTable = economicRows.length
    ? [
        "",
        "**Resumen económico registrado**",
        "",
        "| Tipo recurso | Base | Oferta | Margen ofertado |",
        "|---|---:|---:|---:|",
        ...economicRows.map((row) => {
          const margen = row.margen_ofertado_manual ?? row.oferta - row.base;
          return `| ${row.tipo_recurso} | ${moneda} ${formatMoney(row.base)} | ${moneda} ${formatMoney(row.oferta)} | ${moneda} ${formatMoney(margen)} |`;
        }),
      ].join("\n")
    : "\n\nNo hay desglose económico registrado con importes distintos de cero.";

  return [`Estos son los datos reales registrados en Supabase para **${cot.codigo}**:`, "", table, economicTable].join("\n");
}

/**
 * Algunas preguntas son mejor respondidas sin pasar por el LLM. Si el usuario
 * pregunta por el monto/oferta de una cotización concreta, usamos el registro
 * consultado en Supabase y devolvemos una respuesta cerrada para evitar
 * alucinaciones numéricas.
 */
export function buildDeterministicAnswerFromResults(
  cleanText: string,
  results: ContextToolResult[],
): string | null {
  const countAnswer = countSummaryAnswer(results);
  if (countAnswer) return countAnswer;

  const cotResult = results.find(
    (res) => res.source === "cotizaciones" && res.status === "success" && res.records.length === 1,
  );
  if (!cotResult || cotResult.source !== "cotizaciones") return null;

  const cot = cotResult.records[0];

  if (COT_DETAIL_QUESTION_RE.test(cleanText)) {
    return cotizacionDetailAnswer(cot);
  }

  if (!COT_AMOUNT_QUESTION_RE.test(cleanText)) return null;

  if (cot.monto == null) {
    return `Encontré la cotización **${cot.codigo}** en Supabase, pero no tiene monto ofertado registrado.`;
  }

  const moneda = moneyPrefix(cot.moneda_codigo);
  const detalles = [
    cot.proyecto ? `Proyecto: **${cot.proyecto}**` : "",
    cot.cliente_nombre ? `Cliente: **${cot.cliente_nombre}**` : "",
  ].filter(Boolean).join(" · ");

  return [
    `Según Supabase, la cotización **${cot.codigo}** tiene monto ofertado registrado de **${moneda} ${formatMoney(cot.monto)}**.`,
    detalles ? detalles : "",
    "No recalculé el monto: estoy leyendo el campo `monto` registrado en la tabla `cotizaciones`.",
  ].filter(Boolean).join("\n");
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

  if (decision.toolsToCall.length === 0) {
    return { block: "", decision, results: [], hasData: false };
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
    return { block, decision, results, hasData: hasRealData(results) };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.debug("[contextRouter] pipeline error", err);
    return { block: SOFT_ERROR_NOTE, decision, results: [], hasData: false };
  }
}
