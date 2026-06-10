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
  fecha_requerida: string | null;
  cotizacion_codigo: string | null;
  observaciones: string | null;
}

// ── Cotización ───────────────────────────────────────────────────────────────
export interface CotizacionSummary {
  id: string;
  codigo: string;
  oc: string | null;
  cliente_nombre: string | null;
  proyecto: string | null;
  estado: string | null;
  avance: number | null;
  monto: number | null;
  responsable_tecnico: string | null;
  tipo_servicio_nombre: string | null;
  prioridad: string | null;
}

// ── Chat context ─────────────────────────────────────────────────────────────
export interface ChatCtx {
  project: {
    id: string; name: string; client: string;
    status: string; progress: number; summary: string;
  } | null;
  requirement: RequirementSummary | null;
  attachments?: FileAttachment[];
}

export const EMPTY_CTX: ChatCtx = { project: null, requirement: null };

export function cotizacionToProject(cot: CotizacionSummary): NonNullable<ChatCtx["project"]> {
  const parts: string[] = [];
  if (cot.tipo_servicio_nombre) parts.push(cot.tipo_servicio_nombre);
  if (cot.responsable_tecnico)  parts.push(`Resp: ${cot.responsable_tecnico}`);
  if (cot.monto)                parts.push(`S/ ${cot.monto.toLocaleString("es-PE")}`);
  if (cot.prioridad)            parts.push(`Prioridad: ${cot.prioridad}`);
  return {
    id: cot.codigo,
    name: cot.proyecto ?? cot.codigo,
    client: cot.cliente_nombre ?? "—",
    status: cot.estado ?? "—",
    progress: cot.avance ?? 0,
    summary: parts.join(" · "),
  };
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
    .select("id, codigo, oc, cliente_nombre, proyecto, estado, avance, monto, responsable_tecnico, tipo_servicio_nombre, prioridad")
    .order("codigo", { ascending: false })
    .limit(limit);

  if (q) {
    dbQuery = dbQuery.or(
      `codigo.ilike.%${q}%,proyecto.ilike.%${q}%,cliente_nombre.ilike.%${q}%`
    );
  }

  const { data, error } = await dbQuery;
  if (error || !data) return [];
  return data as CotizacionSummary[];
}

export async function fetchCotizacionByCode(code: string): Promise<CotizacionSummary | null> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, codigo, oc, cliente_nombre, proyecto, estado, avance, monto, responsable_tecnico, tipo_servicio_nombre, prioridad")
    .eq("codigo", code)
    .maybeSingle();
  if (error || !data) return null;
  return data as CotizacionSummary;
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

export async function fetchRequirementsByProject(cotizacionCodigo: string): Promise<RequirementSummary[]> {
  const num = cotizacionCodigo.replace(/[^0-9]/g, "");
  const { data, error } = await supabase
    .from("requerimientos")
    .select("id, codigo, estado, responsable, avance, solicitante_rq, tipo_servicio_nombre, fecha_requerida, cotizacion_codigo, observaciones")
    .or(`cotizacion_codigo.ilike.%${num}%,cotizacion_codigo.eq.${cotizacionCodigo}`)
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

export async function fetchAllRequirements(): Promise<RequirementSummary[]> {
  const { data, error } = await supabase
    .from("requerimientos")
    .select("id, codigo, estado, responsable, avance, solicitante_rq, tipo_servicio_nombre, fecha_requerida, cotizacion_codigo, observaciones")
    .order("codigo", { ascending: true })
    .limit(50);

  if (error || !data) return [];
  return data as RequirementSummary[];
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

export type ProjectReferenceSource = "cotizacion" | "requerimiento" | "technical_proposal" | "historical_import" | "none";

export interface ProjectReferenceResult {
  source: ProjectReferenceSource;
  cotizacion?: CotizacionSummary;
  requirements?: RequirementSummary[];
}

export async function fetchProjectContextByCode(rawCode: string): Promise<ProjectReferenceResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { source: "none" };

  // 1) cotizaciones.codigo (exact) or cotizaciones.proyecto (contains)
  const { data: cots } = await supabase
    .from("cotizaciones")
    .select("id, codigo, oc, cliente_nombre, proyecto, estado, avance, monto, responsable_tecnico, tipo_servicio_nombre, prioridad")
    .or(`codigo.eq.${code},proyecto.ilike.%${code}%`)
    .limit(1);
  if (cots && cots.length > 0) {
    debugLog(`'${code}' encontrado en cotizaciones`);
    return { source: "cotizacion", cotizacion: cots[0] as CotizacionSummary };
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
  // back to the parent requerimientos.
  const { data: items } = await supabase
    .from("requerimiento_items")
    .select("requerimiento_id")
    .or(
      `metadata->historical_import->>historical_cotizacion_key.eq.${code},` +
      `metadata->historical_import->>historical_rq_key.ilike.${code}||%`
    )
    .limit(100);
  if (items && items.length > 0) {
    const ids = [...new Set(items.map((i) => i.requerimiento_id as string).filter(Boolean))];
    if (ids.length > 0) {
      const { data: histReqs } = await supabase
        .from("requerimientos")
        .select("id, codigo, estado, responsable, avance, solicitante_rq, tipo_servicio_nombre, fecha_requerida, cotizacion_codigo, observaciones")
        .in("id", ids);
      if (histReqs && histReqs.length > 0) {
        debugLog(`'${code}' encontrado vía historical_import en requerimiento_items -> ${histReqs.length} requerimiento(s)`);
        return { source: "historical_import", requirements: histReqs as RequirementSummary[] };
      }
    }
  }

  debugLog(`'${code}' no encontrado en cotizaciones, requerimientos, technical_proposals ni historical_import`);
  return { source: "none" };
}

export function buildProjectReferencePrompt(code: string, result: ProjectReferenceResult): string {
  if (result.source === "none") {
    return `\n\nSe detectó el código **${code}** en el mensaje, pero no se encontró en cotizaciones, requerimientos, propuestas técnicas ni en datos históricos importados. Dile al usuario claramente que no encontraste ese código (no es un problema de permisos) y pídele que confirme el código o el nombre del proyecto.`;
  }
  if (result.source === "cotizacion" || result.source === "technical_proposal") {
    if (!result.cotizacion) return "";
    const p = cotizacionToProject(result.cotizacion);
    const origin = result.source === "technical_proposal" ? " (vía propuesta técnica)" : "";
    return `\n\nCódigo **${code}** → Cotización/Proyecto${origin}: **${p.id}**: ${p.name} · Cliente: ${p.client} · Estado: ${p.status} · Avance: ${p.progress}%${p.summary ? ` · ${p.summary}` : ""}`;
  }
  if (result.requirements && result.requirements.length > 0) {
    const note = result.source === "historical_import"
      ? ` (vinculados por importación histórica — el código **${code}** no está directamente en cotizaciones.codigo, pero sí en los datos importados de los requerimientos).`
      : "";
    let prompt = `\n\nRequerimientos relacionados al código **${code}**${note}:`;
    for (const rq of result.requirements.slice(0, 10)) {
      prompt += `\n- **${rq.codigo}** · Estado: ${rq.estado} · Avance: ${rq.avance ?? "—"}%${rq.responsable ? ` · Responsable: ${rq.responsable}` : ""}`;
    }
    if (result.requirements.length > 10) prompt += `\n... y ${result.requirements.length - 10} más.`;
    return prompt;
  }
  return "";
}
