// ── Respuestas determinísticas + decisión de bloqueo (anti-alucinación) ──────
//
// Para consultas de datos reales NO confiamos en que el LLM (sobre todo modelos
// pequeños como llama-3.1-8b o mistral-small) respete el contexto: la garantía
// vive en la app. Dadas la decisión del router y los resultados ya consultados
// en Supabase, este módulo decide una de tres salidas:
//
//   1) deterministicAnswer  → hay datos reales: la app redacta la respuesta
//      (tabla/resumen) SOLO con los `records` recuperados, sin pasar por el LLM.
//   2) fallbackAnswer (block) → es una pregunta de datos pero NO hay ningún
//      registro real: se responde con un mensaje seguro y NO se llama al LLM.
//   3) ninguna → no es pregunta de datos: el flujo normal usa el LLM.
//
// Nunca inventa códigos, montos, fechas, clientes ni "rellena" hasta N filas.

import type { ContextToolResult } from "@/lib/chat/contextTools";
import type { ContextRoutingDecision } from "@/lib/chat/contextRouter";
import type {
  CotizacionSummary,
  RequirementSummary,
  RequirementItemSummary,
} from "@/lib/chat/contextQuery";

// Intenciones que representan una consulta de datos reales (tabular o por código).
const DATA_INTENTS = new Set([
  "resumen_proyecto",
  "consulta_propuesta_tecnica",
  "consulta_por_codigo",
  "requerimientos_de_proyecto",
  "buscar_requerimientos",
  "buscar_cotizaciones",
  "buscar_recursos",
  "needs_clarification",
]);

/** True si la intención del router es una consulta a datos reales. */
export function isDataQuestion(decision: ContextRoutingDecision): boolean {
  return DATA_INTENTS.has(decision.intent);
}

/** Campos concretos por los que el usuario pregunta (para detectar faltantes). */
export interface RequestedFields {
  cost: boolean;
  date: boolean;
  client: boolean;
  responsible: boolean;
}

export function detectRequestedFields(text: string): RequestedFields {
  const t = text.toLowerCase();
  return {
    cost: /\b(cu[aá]nto|costo|coste|monto|precio|valor|presupuest|cotiz|s\/\.?|usd|d[oó]lar|sol(?:es)?)\b/.test(t),
    date: /\b(fecha|plazo|cu[aá]ndo|entrega|vencim|deadline)\b/.test(t),
    client: /\bcliente\b/.test(t),
    responsible: /\b(responsable|encargad|a cargo)\b/.test(t),
  };
}

// ── Helpers de formato (solo datos reales, nunca placeholders) ───────────────
const DASH = "—";
const cell = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return DASH;
  return String(v).replace(/\|/g, "\\|").replace(/\n/g, " ").trim() || DASH;
};
const money = (n: number | null | undefined, cur = "PEN"): string =>
  n == null ? DASH : `${cur} ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number | null | undefined): string => (n == null ? DASH : `${n}%`);

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

// ── Renderers determinísticos por fuente ─────────────────────────────────────

function renderRequerimientos(records: RequirementSummary[], total: number): string {
  const rows = records.map((r) => [
    cell(r.codigo), cell(r.estado), pct(r.avance), cell(r.responsable),
    cell(r.cotizacion_codigo), cell(r.fecha_requerida),
  ]);
  const tbl = table(["Código", "Estado", "Avance", "Responsable", "Cotización", "Fecha req."], rows);
  const extra = total > records.length
    ? `\n\nHay ${total} en total; muestro ${records.length}. Indica un filtro (estado, responsable, cotización) para acotar.`
    : "";
  return `Encontré ${records.length} requerimiento(s) en Supabase${total !== records.length ? ` (de ${total} coincidencias)` : ""}:\n\n${tbl}${extra}`;
}

// Requerimientos asociados a un proyecto/cotización, con conteo EXACTO y la vía
// por la que se halló la relación (formal vs. coincidencia textual).
function renderRequerimientosPorProyecto(
  result: Extract<ContextToolResult, { source: "requerimientos" }>,
): string {
  const projectCode = result.projectCode ?? "(proyecto)";
  const total = result.exactCount ?? result.total;
  const shown = result.records.length;

  // Coincidencia textual: no afirmamos asociación formal.
  if (result.matchMode === "text_fallback") {
    const tbl = shown > 0 ? `\n\n${table(
      ["Código", "Estado", "Avance", "Responsable", "Cotización", "Fecha req."],
      result.records.map((r) => [cell(r.codigo), cell(r.estado), pct(r.avance), cell(r.responsable), cell(r.cotizacion_codigo), cell(r.fecha_requerida)]),
    )}` : "";
    return `Encontré ${total} coincidencia(s) textual(es) relacionada(s) con ${projectCode} en Supabase, pero no puedo afirmar que sean una asociación formal del proyecto.${tbl}`;
  }

  const viaNote = result.matchMode === "quotation_code" ? " (relación por cotización)"
    : result.matchMode === "project_code" ? " (relación por proyecto adjudicado)"
    : " (relación por importación histórica)";
  const rows = result.records.map((r) => [
    cell(r.codigo), cell(r.estado), pct(r.avance), cell(r.responsable), cell(r.cotizacion_codigo), cell(r.fecha_requerida),
  ]);
  const tbl = shown > 0 ? `\n\n${table(["Código", "Estado", "Avance", "Responsable", "Cotización", "Fecha req."], rows)}` : "";
  const muestra = total > shown ? ` Muestro los primeros ${shown}:` : shown > 0 ? " Detalle:" : "";
  return `El proyecto/cotización **${projectCode}** tiene **${total}** requerimiento(s) asociado(s) en Supabase${viaNote}.${muestra}${tbl}`;
}

function renderCotizaciones(records: CotizacionSummary[], total: number): string {
  const rows = records.map((c) => [
    cell(c.codigo), cell(c.estado), pct(c.avance), cell(c.cliente_nombre),
    cell(c.proyecto), money(c.monto), cell(c.responsable_tecnico),
  ]);
  const tbl = table(["Código", "Estado", "Avance", "Cliente", "Proyecto", "Monto", "Resp."], rows);
  const extra = total > records.length
    ? `\n\nHay ${total} en total; muestro ${records.length}. Indica un filtro (cliente, estado) para acotar.`
    : "";
  return `Encontré ${records.length} cotización(es) en Supabase${total !== records.length ? ` (de ${total} coincidencias)` : ""}:\n\n${tbl}${extra}`;
}

function renderRecursos(result: Extract<ContextToolResult, { source: "recursos" }>): string {
  const rows = result.records.map((r) => [
    cell(r.codigo_recurso), cell(r.descripcion), cell(r.tipo_recurso_nombre),
    r.precio_unitario_ref == null ? DASH : money(r.precio_unitario_ref, r.moneda_codigo ?? "PEN"),
    cell(r.proveedor_nombre), cell(r.marca_nombre), cell(r.estado),
  ]);
  const tbl = table(["Código", "Descripción", "Tipo", "P.U. ref.", "Proveedor", "Marca", "Estado"], rows);
  const extra = result.total > result.records.length
    ? `\n\nHay ${result.total} recursos en total; muestro ${result.records.length}. Pide un filtro (tipo, proveedor, marca) para acotar.`
    : "";
  return `Encontré ${result.records.length} recurso(s) en el catálogo (Supabase)${result.total !== result.records.length ? ` (de ${result.total})` : ""}:\n\n${tbl}${extra}`;
}

function renderItemsTable(items: RequirementItemSummary[]): string {
  const rows = items.map((it, i) => [
    String(i + 1), cell(it.descripcion), cell(it.cantidad), cell(it.unidad),
    it.precio_unitario ? money(it.precio_unitario, it.moneda ?? "PEN") : DASH,
    money(it.costo_total_presupuestado, it.moneda ?? "PEN"), cell(it.proveedor_nombre),
  ]);
  return table(["#", "Descripción", "Cant.", "Und.", "P.U.", "Costo total", "Proveedor"], rows);
}

// Suma de costos solo con valores reales; null si no hay ningún dato de costo.
function sumItemCosts(items: RequirementItemSummary[]): { total: number; cur: string } | null {
  let total = 0;
  let any = false;
  let cur = "PEN";
  for (const it of items) {
    if (it.costo_total_presupuestado != null) { total += it.costo_total_presupuestado; any = true; cur = it.moneda ?? cur; }
    else if (it.precio_unitario && it.cantidad) { total += it.precio_unitario * it.cantidad; any = true; cur = it.moneda ?? cur; }
  }
  return any ? { total, cur } : null;
}

function renderRequerimientoDetalle(
  rq: RequirementSummary,
  items: RequirementItemSummary[] | null,
  fields: RequestedFields,
): string {
  const head = [
    `**${rq.codigo}** — Estado: ${rq.estado}`,
    rq.responsable ? `Responsable: ${rq.responsable}` : null,
    rq.cotizacion_codigo ? `Cotización: ${rq.cotizacion_codigo}` : null,
    rq.fecha_requerida ? `Fecha requerida: ${rq.fecha_requerida}` : null,
    rq.avance != null ? `Avance: ${rq.avance}%` : null,
  ].filter(Boolean).join(" · ");

  const lines: string[] = [`Datos reales de ${rq.codigo} (Supabase):`, "", head];

  if (items && items.length > 0) {
    lines.push("", `Ítems (${items.length}):`, "", renderItemsTable(items));
    if (fields.cost) {
      const sum = sumItemCosts(items);
      lines.push("", sum
        ? `Costo total estimado (suma de ítems con costo): ${money(sum.total, sum.cur)}.`
        : `No encontré un monto/costo en los ítems recuperados de ${rq.codigo}.`);
    }
  } else {
    lines.push("", `No encontré ítems registrados para ${rq.codigo} en Supabase.`);
    if (fields.cost) lines.push(`Por lo tanto, no hay un costo/monto disponible para ${rq.codigo} en los datos recuperados.`);
  }

  // Campos solicitados que el requerimiento no trae.
  const missing: string[] = [];
  if (fields.responsible && !rq.responsable) missing.push("responsable");
  if (fields.date && !rq.fecha_requerida) missing.push("fecha");
  if (missing.length) lines.push("", `Encontré el registro, pero no trae ${missing.join(" ni ")} en los datos recuperados.`);

  return lines.join("\n");
}

function renderCotizacionDetalle(c: CotizacionSummary, fields: RequestedFields): string {
  const bits = [
    `**${c.codigo}** — Estado: ${c.estado ?? DASH}`,
    c.cliente_nombre ? `Cliente: ${c.cliente_nombre}` : null,
    c.proyecto ? `Proyecto: ${c.proyecto}` : null,
    c.avance != null ? `Avance: ${c.avance}%` : null,
    c.monto != null ? `Monto: ${money(c.monto)}` : null,
    c.responsable_tecnico ? `Responsable: ${c.responsable_tecnico}` : null,
    c.oc ? `OC: ${c.oc}` : null,
  ].filter(Boolean).join(" · ");

  const lines = [`Datos reales de ${c.codigo} (Supabase):`, "", bits];
  const missing: string[] = [];
  if (fields.cost && c.monto == null) missing.push("monto");
  if (fields.client && !c.cliente_nombre) missing.push("cliente");
  if (fields.responsible && !c.responsable_tecnico) missing.push("responsable");
  if (missing.length) lines.push("", `Encontré la cotización, pero no trae ${missing.join(" ni ")} en los datos recuperados.`);
  return lines.join("\n");
}

function renderProyecto(
  result: Extract<ContextToolResult, { source: "proyecto" }>,
  fields: RequestedFields,
): string | null {
  const ref = result.reference;
  if (ref.source === "cotizacion" && ref.cotizacion) {
    const head = renderCotizacionDetalle(ref.cotizacion, fields);
    if (ref.requirements && ref.requirements.length) {
      return `${head}\n\n${renderRequerimientos(ref.requirements, ref.requirements.length)}`;
    }
    return head;
  }
  if (ref.source === "requerimiento" && ref.requirements && ref.requirements.length) {
    return renderRequerimientos(ref.requirements, ref.requirements.length);
  }
  if (ref.source === "historical_import" && ref.historicalSummary) {
    const h = ref.historicalSummary;
    const byEstado = Object.entries(h.byEstado).map(([k, v]) => `${k}: ${v}`).join(", ") || DASH;
    const lines = [
      `Resumen real de ${result.code} (Supabase, importación histórica):`,
      "",
      `Total de requerimientos: ${h.total}`,
      `Por estado: ${byEstado}`,
      fields.cost || h.totalCosto ? `Costo total agregado: ${money(h.totalCosto)}` : "",
      h.sample.length ? `\nMuestra (${h.sample.length}):\n\n${renderRequerimientos(h.sample, h.sample.length).split("\n\n").slice(1).join("\n\n")}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }
  return null;
}

// ── Decisión de estrategia de respuesta ──────────────────────────────────────

export interface AnswerStrategy {
  shouldBlockModelAnswer: boolean;
  fallbackAnswer?: string;
  shouldUseDeterministicAnswer: boolean;
  deterministicAnswer?: string;
}

const FALLBACK_NO_DATA =
  "No encontré registros reales para esa consulta en las fuentes disponibles. No voy a inventar datos. Prueba indicando un código exacto (p. ej. RQ-XXXX o COT-XXXX), un cliente, un estado o un rango de búsqueda.";

const FALLBACK_NEEDS_CLARIFICATION =
  "Sí tengo acceso a esa tabla, pero necesito un dato para consultarla sin inventar: indícame un código exacto (RQ-XXXX / COT-XXXX), un cliente, un estado o cuántos registros quieres ver.";

const FALLBACK_VALIDATION_NO_DATA =
  "No puedo validar la respuesta anterior porque las respuestas previas de los agentes no son evidencia: solo Supabase lo es. No encontré un código de proyecto/cotización/requerimiento en la conversación para volver a consultarlo. Indícame el código exacto y lo verifico contra la base de datos.";

export interface AnswerStrategyOptions {
  /** El usuario pide validar/confirmar (no usar respuestas previas como verdad). */
  isValidationQuestion?: boolean;
}

function hasSuccessData(results: ContextToolResult[]): boolean {
  return results.some((r) => r.status === "success" && (r.source === "proyecto" ? r.total > 0 : r.records.length > 0));
}

/**
 * Decide cómo responder una consulta de datos. Solo aplica cuando la intención
 * es de datos reales; en otro caso devuelve "sin estrategia" (flujo LLM normal).
 */
export function decideAnswerStrategy(
  cleanText: string,
  decision: ContextRoutingDecision,
  results: ContextToolResult[],
  opts: AnswerStrategyOptions = {},
): AnswerStrategy {
  const none: AnswerStrategy = { shouldBlockModelAnswer: false, shouldUseDeterministicAnswer: false };
  const isValidation = Boolean(opts.isValidationQuestion);
  if (!isDataQuestion(decision) && !isValidation) return none;

  // Pregunta sobre tablas reales pero sin código/filtro accionable: pedir dato.
  if (decision.intent === "needs_clarification") {
    return { shouldBlockModelAnswer: true, fallbackAnswer: FALLBACK_NEEDS_CLARIFICATION, shouldUseDeterministicAnswer: false };
  }

  // Hubo un error temporal en la consulta → no inventar, avisar.
  const hadError = results.some((r) => r.status === "error");
  if (!hasSuccessData(results)) {
    if (hadError) {
      return {
        shouldBlockModelAnswer: true,
        fallbackAnswer: "No pude consultar la base de datos por un error temporal. No voy a inventar datos: vuelve a intentarlo en unos segundos o indícame un código exacto.",
        shouldUseDeterministicAnswer: false,
      };
    }
    // Validación sin datos reales: NO confirmar respuestas previas de agentes.
    if (isValidation) {
      return { shouldBlockModelAnswer: true, fallbackAnswer: FALLBACK_VALIDATION_NO_DATA, shouldUseDeterministicAnswer: false };
    }
    return { shouldBlockModelAnswer: true, fallbackAnswer: FALLBACK_NO_DATA, shouldUseDeterministicAnswer: false };
  }

  // Hay datos reales → la app redacta la respuesta determinística.
  const det = buildDeterministicAnswer(cleanText, results, { isValidationQuestion: isValidation });
  if (det) return { shouldBlockModelAnswer: false, shouldUseDeterministicAnswer: true, deterministicAnswer: det };

  // No supimos renderizar (caso raro): bloquear en vez de arriesgar alucinación.
  return { shouldBlockModelAnswer: true, fallbackAnswer: FALLBACK_NO_DATA, shouldUseDeterministicAnswer: false };
}

/**
 * Redacta una respuesta usando EXCLUSIVAMENTE los `records` reales recuperados.
 * Devuelve null si no hay nada renderizable.
 */
export function buildDeterministicAnswer(
  cleanText: string,
  results: ContextToolResult[],
  opts: { isValidationQuestion?: boolean } = {},
): string | null {
  const fields = detectRequestedFields(cleanText);

  // Índice de ítems por código de requerimiento (encadenados por el pipeline).
  const itemsByRq = new Map<string, RequirementItemSummary[]>();
  for (const r of results) {
    if (r.source === "requerimiento_items" && r.requerimientoCodigo) {
      itemsByRq.set(r.requerimientoCodigo, r.records);
    }
  }
  // Códigos de RQ cuyos ítems ya se rendearon junto a su detalle (para no
  // duplicarlos como sección suelta más abajo).
  const consumedItemCodes = new Set<string>();

  const sections: string[] = [];

  for (const r of results) {
    if (r.status !== "success") continue;
    switch (r.source) {
      case "requerimientos": {
        // Consulta relacional "requerimientos del proyecto X" (conteo exacto).
        if (r.projectCode) {
          sections.push(renderRequerimientosPorProyecto(r));
          break;
        }
        // Detalle por código (1 registro) vs. listado.
        if (r.records.length === 1 && (r.query.codigo || r.query.code)) {
          const rq = r.records[0];
          if (itemsByRq.has(rq.codigo)) consumedItemCodes.add(rq.codigo);
          sections.push(renderRequerimientoDetalle(rq, itemsByRq.get(rq.codigo) ?? null, fields));
        } else if (r.records.length > 0) {
          sections.push(renderRequerimientos(r.records, r.total));
        }
        break;
      }
      case "cotizaciones": {
        if (r.records.length === 1 && (r.query.codigo || r.query.code)) {
          sections.push(renderCotizacionDetalle(r.records[0], fields));
        } else if (r.records.length > 0) {
          sections.push(renderCotizaciones(r.records, r.total));
        }
        break;
      }
      case "recursos":
        if (r.records.length > 0) sections.push(renderRecursos(r));
        break;
      case "technical_proposals":
        if (r.records.length > 0) {
          const p = r.records[0];
          sections.push([
            `Datos reales de la propuesta técnica **${p.code}** (Supabase):`, "",
            `Cotización: ${p.cotizacion_codigo} · Revisión: ${p.revision} · Estado: ${p.status}` +
            (p.work_status ? ` · Avance: ${p.work_status}` : "") +
            (p.document_date ? ` · Fecha: ${p.document_date}` : ""),
          ].join("\n"));
        }
        break;
      case "proyecto": {
        const rendered = renderProyecto(r, fields);
        if (rendered) sections.push(rendered);
        break;
      }
      case "requerimiento_items":
        // Se rendea junto al requerimiento dueño cuando éste se mostró como
        // detalle por código; si no (p. ej. resuelto vía cascada de proyecto),
        // se añade como sección propia más abajo.
        break;
    }
  }

  // Ítems encadenados cuyo requerimiento no se rendeó como detalle por código.
  for (const r of results) {
    if (r.source !== "requerimiento_items" || r.status !== "success" || r.records.length === 0) continue;
    const code = r.requerimientoCodigo;
    if (code && consumedItemCodes.has(code)) continue;
    const header = code ? `Ítems de ${code} (${r.records.length}):` : `Ítems recuperados (${r.records.length}):`;
    const costNote = fields.cost
      ? (() => { const s = sumItemCosts(r.records); return s ? `\n\nCosto total estimado (suma de ítems con costo): ${money(s.total, s.cur)}.` : `\n\nNo encontré un monto/costo en los ítems recuperados.`; })()
      : "";
    sections.push(`${header}\n\n${renderItemsTable(r.records)}${costNote}`);
  }

  if (sections.length === 0) return null;
  const body = sections.join("\n\n");
  // Validación: dejamos claro que esto sale de Supabase, no de un agente previo.
  if (opts.isValidationQuestion) {
    return `Verifiqué directamente en Supabase (las respuestas previas de otros agentes no son evidencia). Esto es lo que arrojan los datos reales:\n\n${body}`;
  }
  return body;
}
