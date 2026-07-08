"use client";
import { supabase } from "@/lib/supabaseClient";

// ── File attachments ────────────────────────────────────────────────────────
export interface FileAttachment {
  name: string;
  type: string;
  content: string;
  size: number;
  /** Base64 data URL, only populated for small files (used for in-chat download). */
  dataUrl?: string;
  /** Rendered image previews of PDF pages, local-only, used for vision models. */
  previewImages?: Array<{ label: string; dataUrl: string }>;
}

// ── Requirement ─────────────────────────────────────────────────────────────
export interface RequirementSummary {
  id: string;
  codigo: string;
  estado: string;
  responsable: string | null;
  avance: number | null;
  solicitante_rq: string | null;
  tipo_servicio_nombre: string | null;
  proyecto_servicio?: string | null;
  fecha_requerida: string | null;
  cotizacion_codigo: string | null;
  observaciones: string | null;
  created_at?: string;
}

// ── Cotización ───────────────────────────────────────────────────────────────
export interface CotizacionSummary {
  id: string;
  codigo: string;
  oc: string | null;
  cliente_nombre: string | null;
  proyecto: string | null;
  unidad_trabajo_nombre?: string | null;
  estado: string | null;
  estado_propuesta?: string | null;
  avance: number | null;
  monto: number | null;
  moneda_codigo: string | null;
  solicitante?: string | null;
  responsable_tecnico: string | null;
  responsable_economico?: string | null;
  tipo_servicio_nombre: string | null;
  prioridad: string | null;
  fecha_registro?: string | null;
  fecha_invitacion?: string | null;
  fecha_visita_tecnica?: string | null;
  fecha_consultas?: string | null;
  fecha_abs_consultas?: string | null;
  fecha_entrega?: string | null;
  fecha_entregada?: string | null;
  fecha_oc?: string | null;
  created_at?: string;
  resumen_economico?: CotizacionEconomicSummaryRow[];
}

export interface CotizacionEconomicSummaryRow {
  tipo_recurso: string;
  base: number;
  oferta: number;
  real?: number;
  margen_ofertado_manual?: number | null;
}

// ── Chat context ─────────────────────────────────────────────────────────────
export interface ChatCtx {
  project: {
    id: string; name: string; client: string;
    status: string; progress: number; summary: string;
    dbId?: string;
  } | null;
  requirement: RequirementSummary | null;
  attachments?: FileAttachment[];
}

export const EMPTY_CTX: ChatCtx = { project: null, requirement: null };

export function cotizacionToProject(cot: CotizacionSummary): NonNullable<ChatCtx["project"]> {
  const parts: string[] = [];
  if (cot.tipo_servicio_nombre) parts.push(cot.tipo_servicio_nombre);
  if (cot.responsable_tecnico)  parts.push(`Resp: ${cot.responsable_tecnico}`);
  if (cot.monto)                parts.push(`${moneyPrefix(cot.moneda_codigo)} ${cot.monto.toLocaleString("es-PE")}`);
  if (cot.prioridad)            parts.push(`Prioridad: ${cot.prioridad}`);
  return {
    id: cot.codigo,
    dbId: cot.id,
    name: cot.proyecto ?? cot.codigo,
    client: cot.cliente_nombre ?? "—",
    status: cot.estado ?? "—",
    progress: cot.avance ?? 0,
    summary: parts.join(" · "),
  };
}

export function moneyPrefix(monedaCodigo?: string | null): string {
  return monedaCodigo === "USD" ? "US$" : "S/";
}

function asNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function readEconomicSummaryFromMetadata(metadata: unknown): CotizacionEconomicSummaryRow[] {
  if (!metadata || typeof metadata !== "object") return [];
  const raw = (metadata as Record<string, unknown>).resumen_economico;
  if (!Array.isArray(raw)) return [];
  const summary: CotizacionEconomicSummaryRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const tipo = String(row.tipo_recurso ?? "").trim();
    if (!tipo) continue;
    summary.push({
      tipo_recurso: tipo,
      base: asNumber(row.base),
      oferta: asNumber(row.oferta),
      real: row.real == null ? undefined : asNumber(row.real),
      margen_ofertado_manual:
        row.margen_ofertado_manual == null ? null : asNumber(row.margen_ofertado_manual),
    });
  }
  return summary;
}

function normalizeCotizacionRow(row: Record<string, unknown>): CotizacionSummary {
  return {
    ...(row as unknown as CotizacionSummary),
    resumen_economico: readEconomicSummaryFromMetadata(row.metadata),
  };
}

function normalizeCotizacionRows(rows: Record<string, unknown>[] | null): CotizacionSummary[] {
  return (rows ?? []).map(normalizeCotizacionRow);
}

export function buildContextPrompt(ctx: ChatCtx): string {
  if (!ctx.project && !ctx.requirement) return "";

  let prompt = "\n\n---\n**Contexto de consulta:**";

  if (ctx.project) {
    prompt += `\n- Cotización/Proyecto: **${ctx.project.name}** (${ctx.project.id}) · Cliente: ${ctx.project.client} · Estado: ${ctx.project.status} · Avance: ${ctx.project.progress}%`;
    if (ctx.project.summary) prompt += `\n  ${ctx.project.summary}`;
  }

  if (ctx.requirement) {
    const rq = ctx.requirement;
    prompt += `\n- Requerimiento: **${rq.codigo}** · Estado: ${rq.estado} · Avance: ${rq.avance ?? "—"}%`;
    if (rq.responsable)           prompt += ` · Responsable: ${rq.responsable}`;
    if (rq.tipo_servicio_nombre)  prompt += ` · Tipo: ${rq.tipo_servicio_nombre}`;
    if (rq.fecha_requerida)       prompt += ` · Fecha requerida: ${rq.fecha_requerida}`;
    if (rq.solicitante_rq)        prompt += ` · Solicitante: ${rq.solicitante_rq}`;
    if (rq.observaciones)         prompt += `\n  Observaciones: ${rq.observaciones}`;
  }

  prompt += "\n---";
  prompt += "\n\nUsa estos datos reales (de Supabase) para responder la consulta de forma breve y directa, resaltando en **negrita** los datos clave (estado, avance, montos, fechas). Si la pregunta pide algo que NO está en estos datos (p. ej. materiales, detalle técnico no listado), dilo claramente — no inventes — y propón 2-3 preguntas de seguimiento que sí podrías responder con esta información.";
  return prompt;
}

// ── Search cotizaciones (Supabase) ───────────────────────────────────────────
export async function searchCotizaciones(query: string, limit = 10): Promise<CotizacionSummary[]> {
  const q = query.trim();
  let dbQuery = supabase
    .from("cotizaciones")
    .select(COTIZACION_SELECT)
    .order("codigo", { ascending: false })
    .limit(limit);

  if (q) {
    dbQuery = dbQuery.or(
      `codigo.ilike.%${q}%,proyecto.ilike.%${q}%,cliente_nombre.ilike.%${q}%`
    );
  }

  const { data, error } = await dbQuery;
  if (error || !data) return [];
  return normalizeCotizacionRows(data as unknown as Record<string, unknown>[]);
}

export async function fetchCotizacionByCode(code: string): Promise<CotizacionSummary | null> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select(COTIZACION_SELECT)
    .eq("codigo", code)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeCotizacionRow(data as unknown as Record<string, unknown>);
}

// ── Requerimientos ──────────────────────────────────────────────────────────
export async function fetchRequirementByCode(code: string): Promise<RequirementSummary | null> {
  const { data, error } = await supabase
    .from("requerimientos")
    .select("id, codigo, estado, responsable, avance, solicitante_rq, tipo_servicio_nombre, fecha_requerida, cotizacion_codigo, observaciones")
    .eq("codigo", code)
    .maybeSingle();
  if (error || !data) return null;
  return data as RequirementSummary;
}

export async function fetchRequirementsByProject(cotizacionCodigo: string, cotizacionId?: string): Promise<RequirementSummary[]> {
  const num = cotizacionCodigo.replace(/[^0-9]/g, "");
  const filters = [
    `cotizacion_codigo.eq.${cotizacionCodigo}`,
    `cotizacion_codigo.ilike.%${cotizacionCodigo}%`,
  ];
  if (num) filters.push(`cotizacion_codigo.ilike.%${num}%`);
  if (cotizacionId) filters.push(`cotizacion_id.eq.${cotizacionId}`);

  const { data, error } = await supabase
    .from("requerimientos")
    .select("id, codigo, estado, responsable, avance, solicitante_rq, tipo_servicio_nombre, fecha_requerida, cotizacion_codigo, observaciones")
    .or(filters.join(","))
    .order("codigo", { ascending: true })
    .limit(30);

  if (error || !data) return [];
  return data as RequirementSummary[];
}

// ── Items/materiales del requerimiento ──────────────────────────────────────
export interface RequirementItemSummary {
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  moneda: string | null;
  estado: string | null;
  proveedor_nombre: string | null;
  recurso_a_suministrar: string | null;
  costo_total_presupuestado: number | null;
}

function readMetaString(obj: Record<string, unknown> | undefined, key: string): string {
  const v = obj?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

export async function fetchRequirementItems(requerimientoId: string, limit = 30): Promise<RequirementItemSummary[]> {
  const { data, error } = await supabase
    .from("requerimiento_items")
    .select("recurso_a_suministrar, cantidad, precio_unitario, moneda_codigo, estado, proveedor_nombre, observaciones_item, costo_total_presupuestado, metadata")
    .eq("requerimiento_id", requerimientoId)
    .limit(limit);
  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => {
    const metadata = (row.metadata as Record<string, unknown>) ?? {};
    const historicalImport = (metadata.historical_import as Record<string, unknown>) ?? {};
    const sourceItem = {
      ...((metadata.source_item as Record<string, unknown>) ?? {}),
      ...((historicalImport.source_item as Record<string, unknown>) ?? {}),
    };
    const savedItem = (metadata.sgp_lite_item as Record<string, unknown>) ?? {};

    const descripcion =
      readMetaString(savedItem, "descripcion") ||
      readMetaString(sourceItem, "descripcion") ||
      (row.recurso_a_suministrar as string | null) ||
      "—";
    const unidad = readMetaString(savedItem, "unidad") || readMetaString(sourceItem, "unidad") || "—";

    return {
      descripcion,
      unidad,
      cantidad: Number(row.cantidad ?? 0),
      precio_unitario: Number(row.precio_unitario ?? 0),
      moneda: (row.moneda_codigo as string | null) ?? null,
      estado: (row.estado as string | null) ?? null,
      proveedor_nombre: (row.proveedor_nombre as string | null) ?? null,
      recurso_a_suministrar: (row.recurso_a_suministrar as string | null) ?? null,
      costo_total_presupuestado: row.costo_total_presupuestado != null ? Number(row.costo_total_presupuestado) : null,
    };
  });
}

export function buildRequirementItemsPrompt(items: RequirementItemSummary[]): string {
  if (!items.length) return "";

  const max = 25;
  let prompt = "\n\n**Items/materiales del requerimiento (Supabase):**";
  for (const it of items.slice(0, max)) {
    const moneda = it.moneda ?? "PEN";
    prompt += `\n- ${it.descripcion} · ${it.cantidad} ${it.unidad} · P.U. ${moneda} ${it.precio_unitario.toFixed(2)}`;
    if (it.estado) prompt += ` · Estado: ${it.estado}`;
    if (it.proveedor_nombre) prompt += ` · Proveedor: ${it.proveedor_nombre}`;
  }
  if (items.length > max) prompt += `\n... y ${items.length - max} ítem(s) más.`;
  return prompt;
}

// ── Flexible search across requerimientos (filter by status/responsible/
// free text, paginated) ─────────────────────────────────────────────────────
export interface RequerimientoSearchFilters {
  q?: string;
  estado?: string;
  responsable?: string;
  recent?: boolean;
  oldest?: boolean;
}

export interface RequerimientoSearchResult {
  items: RequirementSummary[];
  total: number;
}

const REQUIREMENT_SELECT = "id, codigo, estado, responsable, avance, solicitante_rq, tipo_servicio_nombre, fecha_requerida, cotizacion_codigo, observaciones, created_at";

export async function searchRequerimientos(filters: RequerimientoSearchFilters, limit = 20): Promise<RequerimientoSearchResult> {
  const orderByCreated = filters.recent || filters.oldest;
  let query = supabase
    .from("requerimientos")
    .select(REQUIREMENT_SELECT, { count: "exact" })
    .order(orderByCreated ? "created_at" : "codigo", { ascending: filters.oldest ? true : !orderByCreated })
    .limit(limit);

  const q = filters.q?.trim();
  if (q) {
    query = query.or(`codigo.ilike.%${q}%,cotizacion_codigo.ilike.%${q}%,responsable.ilike.%${q}%,solicitante_rq.ilike.%${q}%,observaciones.ilike.%${q}%`);
  }
  if (filters.estado?.trim()) query = query.ilike("estado", `%${filters.estado.trim()}%`);
  if (filters.responsable?.trim()) query = query.ilike("responsable", `%${filters.responsable.trim()}%`);

  const { data, error, count } = await query;
  if (error || !data) return { items: [], total: 0 };
  return { items: data as RequirementSummary[], total: count ?? data.length };
}

export function buildRequerimientoSearchPrompt(filters: RequerimientoSearchFilters, result: RequerimientoSearchResult): string {
  const filterDesc = [
    filters.recent ? "más recientes (por fecha de registro)" : "",
    filters.oldest ? "más antiguos (por fecha de registro)" : "",
    filters.estado ? `estado: ${filters.estado}` : "",
    filters.responsable ? `responsable: ${filters.responsable}` : "",
    filters.q ? `código/texto contiene: "${filters.q}"` : "",
  ].filter(Boolean).join(", ") || "sin filtros";

  if (result.items.length === 0) {
    return `\n\nBúsqueda en requerimientos (${filterDesc}): no se encontraron resultados en la tabla real de Supabase. Dile al usuario que no hay requerimientos que coincidan con esos criterios — no inventes códigos ni proyectos.`;
  }

  let prompt = `\n\nResultados de búsqueda en requerimientos (tabla real de Supabase, ${filterDesc}) — mostrando ${result.items.length} de ${result.total}:`;
  for (const rq of result.items) {
    prompt += `\n- **${rq.codigo}** · Estado: ${rq.estado} · Avance: ${rq.avance ?? "—"}%`;
    if (rq.responsable) prompt += ` · Responsable: ${rq.responsable}`;
    if (rq.cotizacion_codigo) prompt += ` · Cotización: ${rq.cotizacion_codigo}`;
    if (orderByCreatedFlag(filters) && rq.created_at) prompt += ` · Registrado: ${new Date(rq.created_at).toLocaleDateString("es-PE")}`;
  }
  if (result.total > result.items.length) {
    prompt += `\n\nHay ${result.total - result.items.length} resultado(s) adicionales no mostrados aquí. Si el usuario los necesita, pídele un filtro más específico (estado, responsable o parte del código) para acotar la búsqueda.`;
  }
  return prompt;
}

function orderByCreatedFlag(filters: { recent?: boolean; oldest?: boolean }): boolean {
  return Boolean(filters.recent || filters.oldest);
}

export async function fetchAllRequirements(): Promise<RequirementSummary[]> {
  const { data, error } = await supabase
    .from("requerimientos")
    .select("id, codigo, estado, responsable, avance, solicitante_rq, tipo_servicio_nombre, fecha_requerida, cotizacion_codigo, observaciones")
    .order("codigo", { ascending: true })
    .limit(50);

  if (error || !data) return [];
  return data as RequirementSummary[];
}

// ── Flexible search across cotizaciones (filter by status/free text,
// recency-ordered) ───────────────────────────────────────────────────────────
export interface CotizacionSearchFilters {
  q?: string;
  estado?: string;
  recent?: boolean;
  oldest?: boolean;
  dateFrom?: string;
  dateTo?: string;
  dateColumn?: "created_at" | "fecha_registro" | "fecha_entrega";
  periodLabel?: string;
}

export interface CotizacionSearchResult {
  items: CotizacionSummary[];
  total: number;
}

const COTIZACION_SELECT = [
  "id",
  "codigo",
  "oc",
  "cliente_nombre",
  "proyecto",
  "unidad_trabajo_nombre",
  "estado",
  "estado_propuesta",
  "avance",
  "monto",
  "moneda_codigo",
  "solicitante",
  "responsable_tecnico",
  "responsable_economico",
  "tipo_servicio_nombre",
  "prioridad",
  "fecha_registro",
  "fecha_invitacion",
  "fecha_visita_tecnica",
  "fecha_consultas",
  "fecha_abs_consultas",
  "fecha_entrega",
  "fecha_entregada",
  "fecha_oc",
  "created_at",
  "metadata",
].join(", ");

export async function searchCotizacionesByFilters(filters: CotizacionSearchFilters, limit = 20): Promise<CotizacionSearchResult> {
  const orderByCreated = filters.recent || filters.oldest;
  const dateColumn = filters.dateColumn ?? "created_at";
  let query = supabase
    .from("cotizaciones")
    .select(COTIZACION_SELECT, { count: "exact" })
    .order(orderByCreated ? "created_at" : "codigo", { ascending: filters.oldest ? true : !orderByCreated })
    .limit(limit);

  const q = filters.q?.trim();
  if (q) {
    query = query.or(`codigo.ilike.%${q}%,proyecto.ilike.%${q}%,cliente_nombre.ilike.%${q}%,responsable_tecnico.ilike.%${q}%`);
  }
  if (filters.estado?.trim()) query = query.ilike("estado", `%${filters.estado.trim()}%`);
  if (filters.dateFrom) query = query.gte(dateColumn, filters.dateFrom);
  if (filters.dateTo) query = query.lt(dateColumn, filters.dateTo);

  const { data, error, count } = await query;
  if (error || !data) return { items: [], total: 0 };
  return { items: normalizeCotizacionRows(data as unknown as Record<string, unknown>[]), total: count ?? data.length };
}

export function buildCotizacionSearchPrompt(filters: CotizacionSearchFilters, result: CotizacionSearchResult): string {
  const filterDesc = [
    filters.recent ? "más recientes (por fecha de registro)" : "",
    filters.oldest ? "más antiguas (por fecha de registro)" : "",
    filters.estado ? `estado: ${filters.estado}` : "",
    filters.periodLabel ? `periodo: ${filters.periodLabel}` : "",
    filters.dateFrom || filters.dateTo ? `rango ${filters.dateColumn ?? "created_at"}: ${filters.dateFrom ?? "inicio"} a ${filters.dateTo ?? "fin"}` : "",
    filters.q ? `código/texto contiene: "${filters.q}"` : "",
  ].filter(Boolean).join(", ") || "sin filtros";

  if (result.items.length === 0) {
    return `\n\nBúsqueda en cotizaciones (${filterDesc}): no se encontraron resultados en la tabla real de Supabase. Dile al usuario que no hay cotizaciones que coincidan con esos criterios — no inventes códigos ni proyectos.`;
  }

  const orderByCreated = filters.recent || filters.oldest;
  let prompt = `\n\nResultados de búsqueda en cotizaciones (tabla real de Supabase, ${filterDesc}) — mostrando ${result.items.length} de ${result.total}:`;
  for (const cot of result.items) {
    prompt += `\n- **${cot.codigo}** · Estado: ${cot.estado ?? "—"} · Avance: ${cot.avance ?? "—"}%`;
    if (cot.cliente_nombre) prompt += ` · Cliente: ${cot.cliente_nombre}`;
    if (cot.proyecto) prompt += ` · Proyecto: ${cot.proyecto}`;
    if (cot.tipo_servicio_nombre) prompt += ` · Tipo: ${cot.tipo_servicio_nombre}`;
    if (cot.monto != null) prompt += ` · Monto: ${moneyPrefix(cot.moneda_codigo)} ${cot.monto.toLocaleString("es-PE")}`;
    if (cot.fecha_registro) prompt += ` · Fecha registro: ${cot.fecha_registro}`;
    if (orderByCreated && cot.created_at) prompt += ` · Registrado: ${new Date(cot.created_at).toLocaleDateString("es-PE")}`;
  }
  if (result.total > result.items.length) {
    prompt += `\n\nHay ${result.total - result.items.length} resultado(s) adicionales no mostrados aquí. Si el usuario los necesita, pídele un filtro más específico (estado, cliente o parte del código) para acotar la búsqueda.`;
  }
  return prompt;
}

// ── Generic project/code reference lookup (with historical-import fallback) ─
// Codes pasted by users don't always follow the COT-/RQ-/OC- prefixes (e.g.
// "FOR-EKA-PRO-3_2025-143" comes from the historical data import). This does
// a best-effort cascade across the tables/fields where such a code can live,
// so the agent can find the related requirements instead of saying it has
// "no access" when the real issue is just that the code wasn't matched.

function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") console.debug("[contextQuery]", ...args);
}

export type ProjectReferenceSource = "cotizacion" | "requerimiento" | "technical_proposal" | "historical_import" | "similar" | "none";

// Compact aggregate for historical-import matches that can fan out to many
// requerimientos (e.g. "FOR-EKA-PRO-3_2025-143" -> 122 RQs). We never send
// the full list/items to the LLM — just counts + a small sample.
export interface HistoricalSummary {
  total: number;
  byEstado: Record<string, number>;
  totalCosto: number;
  sample: RequirementSummary[];
}

export interface ProjectReferenceResult {
  source: ProjectReferenceSource;
  cotizacion?: CotizacionSummary;
  requirements?: RequirementSummary[];
  historicalSummary?: HistoricalSummary;
  similarRequerimientos?: RequirementSummary[];
  similarCotizaciones?: CotizacionSummary[];
}

const HISTORICAL_SAMPLE_LIMIT = 20;
const HISTORICAL_IDS_LIMIT = 200;

export async function fetchProjectContextByCode(rawCode: string): Promise<ProjectReferenceResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { source: "none" };

  // 1) cotizaciones.codigo (exact match only — fuzzy matches on
  // cotizaciones.proyecto can collide with unrelated cotizaciones whose
  // project name happens to contain this code as a substring).
  const { data: cots } = await supabase
    .from("cotizaciones")
    .select(COTIZACION_SELECT)
    .eq("codigo", code)
    .limit(1);
  if (cots && cots.length > 0) {
    debugLog(`'${code}' encontrado en cotizaciones`);
    return { source: "cotizacion", cotizacion: normalizeCotizacionRow(cots[0] as unknown as Record<string, unknown>) };
  }

  // 2) requerimientos.codigo or requerimientos.cotizacion_codigo (exact)
  const { data: reqs } = await supabase
    .from("requerimientos")
    .select("id, codigo, estado, responsable, avance, solicitante_rq, tipo_servicio_nombre, fecha_requerida, cotizacion_codigo, observaciones")
    .or(`codigo.eq.${code},cotizacion_codigo.eq.${code}`)
    .limit(10);
  if (reqs && reqs.length > 0) {
    debugLog(`'${code}' encontrado en requerimientos (${reqs.length})`);
    return { source: "requerimiento", requirements: reqs as RequirementSummary[] };
  }

  // 3) technical_proposals.code or .cotizacion_codigo -> resolve its cotizacion
  const { data: proposals } = await supabase
    .from("technical_proposals")
    .select("cotizacion_codigo")
    .or(`code.eq.${code},cotizacion_codigo.eq.${code}`)
    .limit(1);
  if (proposals && proposals.length > 0) {
    const cotCodigo = proposals[0].cotizacion_codigo as string;
    const cot = await fetchCotizacionByCode(cotCodigo);
    if (cot) {
      debugLog(`'${code}' encontrado en technical_proposals -> cotización ${cotCodigo}`);
      return { source: "technical_proposal", cotizacion: cot };
    }
  }

  // 4) Fallback: historical-import metadata on requerimiento_items, linking
  // back to the parent requerimientos. Only requerimiento_id is fetched here
  // (lightweight) — full requerimientos/items are fetched in capped,
  // aggregate-only queries below so a code linked to 100+ RQs doesn't blow
  // up the prompt or the page.
  const { data: items } = await supabase
    .from("requerimiento_items")
    .select("requerimiento_id")
    .or(
      `metadata->historical_import->>historical_cotizacion_key.eq.${code},` +
      `metadata->historical_import->>historical_rq_key.ilike.${code}*`
    )
    .limit(500);
  if (items && items.length > 0) {
    const allIds = [...new Set(items.map((i) => i.requerimiento_id as string).filter(Boolean))];
    const ids = allIds.slice(0, HISTORICAL_IDS_LIMIT);
    if (ids.length > 0) {
      const [{ count }, { data: sample }, { data: estadoRows }, { data: costRows }] = await Promise.all([
        supabase.from("requerimientos").select("id", { count: "exact", head: true }).in("id", ids),
        supabase
          .from("requerimientos")
          .select("id, codigo, estado, responsable, avance, solicitante_rq, tipo_servicio_nombre, fecha_requerida, cotizacion_codigo, observaciones")
          .in("id", ids)
          .order("codigo", { ascending: true })
          .limit(HISTORICAL_SAMPLE_LIMIT),
        supabase.from("requerimientos").select("estado").in("id", ids),
        supabase.from("requerimiento_items").select("costo_total_presupuestado").in("requerimiento_id", ids).limit(500),
      ]);

      if (sample && sample.length > 0) {
        const byEstado: Record<string, number> = {};
        for (const r of estadoRows ?? []) {
          const estado = (r.estado as string | null) ?? "—";
          byEstado[estado] = (byEstado[estado] ?? 0) + 1;
        }
        const totalCosto = (costRows ?? []).reduce((sum, r) => sum + Number(r.costo_total_presupuestado ?? 0), 0);

        debugLog(`'${code}' encontrado vía historical_import en requerimiento_items -> ${count ?? ids.length} requerimiento(s)`);
        return {
          source: "historical_import",
          requirements: sample as RequirementSummary[],
          historicalSummary: { total: count ?? ids.length, byEstado, totalCosto, sample: sample as RequirementSummary[] },
        };
      }
    }
  }

  // 5) Fuzzy fallback: no exact match anywhere. Try a partial search so the
  // agent can suggest close matches instead of giving up — e.g. the user
  // wrote "RQ-CJM075-001_2025" but the real code ends in "_2026".
  const fuzzyBase = code.replace(/_\d{4}$/, "");
  const [reqMatches, cotMatches] = await Promise.all([
    searchRequerimientos({ q: fuzzyBase }, 5),
    searchCotizaciones(fuzzyBase, 5),
  ]);
  if (reqMatches.items.length > 0 || cotMatches.length > 0) {
    debugLog(`'${code}' sin match exacto; ${reqMatches.items.length} requerimiento(s) y ${cotMatches.length} cotización(es) similares`);
    return { source: "similar", similarRequerimientos: reqMatches.items, similarCotizaciones: cotMatches };
  }

  debugLog(`'${code}' no encontrado en cotizaciones, requerimientos, technical_proposals ni historical_import`);
  return { source: "none" };
}

export function buildProjectReferencePrompt(code: string, result: ProjectReferenceResult): string {
  if (result.source === "none") {
    return `\n\nSe detectó el código **${code}** en el mensaje, pero no se encontró en cotizaciones, requerimientos, propuestas técnicas ni en datos históricos importados. Dile al usuario claramente que no encontraste ese código (no es un problema de permisos) y pídele que confirme el código o el nombre del proyecto.`;
  }
  if (result.source === "similar") {
    let prompt = `\n\nNo se encontró el código exacto **${code}**, pero hay coincidencias parecidas en Supabase:`;
    for (const rq of result.similarRequerimientos ?? []) {
      prompt += `\n- Requerimiento **${rq.codigo}** · Estado: ${rq.estado} · Avance: ${rq.avance ?? "—"}%${rq.responsable ? ` · Responsable: ${rq.responsable}` : ""}`;
    }
    for (const cot of result.similarCotizaciones ?? []) {
      prompt += `\n- Cotización **${cot.codigo}**: ${cot.proyecto ?? "—"} · Cliente: ${cot.cliente_nombre ?? "—"} · Estado: ${cot.estado ?? "—"}`;
    }
    prompt += `\n\nDile al usuario que el código exacto **${code}** no existe, pero muéstrale estas coincidencias y pregúntale si se refería a alguna de ellas — no inventes datos de ${code} ni asumas cuál es la correcta.`;
    return prompt;
  }
  if (result.source === "cotizacion" || result.source === "technical_proposal") {
    if (!result.cotizacion) return "";
    const p = cotizacionToProject(result.cotizacion);
    const origin = result.source === "technical_proposal" ? " (vía propuesta técnica)" : "";
    return `\n\nCódigo **${code}** → Cotización/Proyecto${origin}: **${p.id}**: ${p.name} · Cliente: ${p.client} · Estado: ${p.status} · Avance: ${p.progress}%${p.summary ? ` · ${p.summary}` : ""}`;
  }
  if (result.source === "historical_import" && result.historicalSummary) {
    const { total, byEstado, totalCosto, sample } = result.historicalSummary;
    const estadoStr = Object.entries(byEstado).map(([estado, n]) => `${estado}: ${n}`).join(", ");
    let prompt = `\n\nCódigo **${code}** (vinculado por importación histórica — no está directamente en cotizaciones.codigo, pero sí en los datos importados de los requerimientos):`;
    prompt += `\n- Total de requerimientos asociados: **${total}**`;
    if (estadoStr) prompt += `\n- Por estado: ${estadoStr}`;
    if (totalCosto > 0) prompt += `\n- Costo total RQ aproximado: **PEN ${totalCosto.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`;
    prompt += `\n- Muestra de los primeros ${Math.min(sample.length, 10)} requerimientos:`;
    for (const rq of sample.slice(0, 10)) {
      prompt += `\n  - **${rq.codigo}** · Estado: ${rq.estado} · Avance: ${rq.avance ?? "—"}%${rq.responsable ? ` · Responsable: ${rq.responsable}` : ""}`;
    }
    prompt += `\n\nEsta es información agregada (no la lista completa). Si el usuario pide el detalle de un RQ específico, pídele el código exacto para consultarlo.`;
    return prompt;
  }
  if (result.requirements && result.requirements.length > 0) {
    let prompt = `\n\nRequerimientos relacionados al código **${code}**:`;
    for (const rq of result.requirements.slice(0, 10)) {
      prompt += `\n- **${rq.codigo}** · Estado: ${rq.estado} · Avance: ${rq.avance ?? "—"}%${rq.responsable ? ` · Responsable: ${rq.responsable}` : ""}`;
    }
    if (result.requirements.length > 10) prompt += `\n... y ${result.requirements.length - 10} más.`;
    return prompt;
  }
  return "";
}
