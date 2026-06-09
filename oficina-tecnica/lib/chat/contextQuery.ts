"use client";
import { supabase } from "@/lib/supabaseClient";

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

export interface ChatCtx {
  project: {
    id: string; name: string; client: string;
    status: string; progress: number; summary: string;
  } | null;
  requirement: RequirementSummary | null;
}

export const EMPTY_CTX: ChatCtx = { project: null, requirement: null };

export function buildContextPrompt(ctx: ChatCtx): string {
  if (!ctx.project && !ctx.requirement) return "";

  let prompt = "\n\n---\n**Contexto de consulta:**";

  if (ctx.project) {
    prompt += `\n- Proyecto: **${ctx.project.name}** (${ctx.project.id}) · Cliente: ${ctx.project.client} · Estado: ${ctx.project.status} · Avance: ${ctx.project.progress}%\n  ${ctx.project.summary}`;
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

export async function fetchRequirementsByProject(projectId: string): Promise<RequirementSummary[]> {
  // Try matching by cotizacion_codigo containing project number or exact match
  const num = projectId.replace(/[^0-9]/g, "");
  const { data, error } = await supabase
    .from("requerimientos")
    .select("id, codigo, estado, responsable, avance, solicitante_rq, tipo_servicio_nombre, fecha_requerida, cotizacion_codigo, observaciones")
    .or(`cotizacion_codigo.ilike.%${num}%,cotizacion_codigo.eq.${projectId}`)
    .is("deleted_at", null)
    .order("codigo", { ascending: true })
    .limit(30);

  if (error || !data) return [];
  return data as RequirementSummary[];
}

export async function fetchAllRequirements(): Promise<RequirementSummary[]> {
  const { data, error } = await supabase
    .from("requerimientos")
    .select("id, codigo, estado, responsable, avance, solicitante_rq, tipo_servicio_nombre, fecha_requerida, cotizacion_codigo, observaciones")
    .is("deleted_at", null)
    .order("codigo", { ascending: true })
    .limit(50);

  if (error || !data) return [];
  return data as RequirementSummary[];
}
