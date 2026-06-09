"use client";
import { supabase } from "@/lib/supabaseClient";

// ── File attachments ────────────────────────────────────────────────────────
export interface FileAttachment {
  name: string;
  type: string;
  content: string;
  size: number;
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

export async function fetchAllRequirements(): Promise<RequirementSummary[]> {
  const { data, error } = await supabase
    .from("requerimientos")
    .select("id, codigo, estado, responsable, avance, solicitante_rq, tipo_servicio_nombre, fecha_requerida, cotizacion_codigo, observaciones")
    .order("codigo", { ascending: true })
    .limit(50);

  if (error || !data) return [];
  return data as RequirementSummary[];
}
