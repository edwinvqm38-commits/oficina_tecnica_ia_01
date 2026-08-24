import type { Cotizacion } from "@/lib/sgp/demoData";
import { supabase } from "@/lib/sgp/supabaseClient";

export type AdjudicatedProject = {
  id: string;
  anio: number;
  codigo_proyecto: string;
  cotizacion: string;
  oc: string;
  cliente: string;
  codigo_cliente: string;
  unidad_trabajo: string;
  codigo_unidad: string;
  fecha_adjudicacion: string | null;
  estado: string;
  activo: boolean;
  cotizacion_id: string | null;
  propuesta_tecnica_id: string | null;
  revision_adjudicada: string | null;
  fecha_confirmacion_adjudicacion: string | null;
  confirmado_por_user_id: string | null;
  confirmado_por_email: string | null;
  adjudicacion_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AdjudicatedTechnicalProposalOption = {
  id: string;
  code: string;
  cotizacion_id: string | null;
  cotizacion_codigo: string;
  revision: string;
  status: string;
  work_status: string;
  document_date: string | null;
};

export type ConfirmAdjudicationInput = {
  cotizacionId: string;
  propuestaTecnicaId?: string | null;
  eventMessage?: string | null;
};

export class ConfirmAdjudicationError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ConfirmAdjudicationError";
  }
}

const PROJECT_SELECT = `
  id,
  anio,
  codigo_proyecto,
  cotizacion,
  oc,
  cliente,
  codigo_cliente,
  unidad_trabajo,
  codigo_unidad,
  fecha_adjudicacion,
  estado,
  activo,
  cotizacion_id,
  propuesta_tecnica_id,
  revision_adjudicada,
  fecha_confirmacion_adjudicacion,
  confirmado_por_user_id,
  confirmado_por_email,
  adjudicacion_metadata,
  created_at,
  updated_at
`;

const LEGACY_PROJECT_SELECT = `
  id,
  anio,
  codigo_proyecto,
  cotizacion,
  oc,
  cliente,
  codigo_cliente,
  unidad_trabajo,
  codigo_unidad,
  fecha_adjudicacion,
  estado,
  activo,
  created_at,
  updated_at
`;

const TECHNICAL_PROPOSAL_SELECT = `
  id,
  code,
  cotizacion_id,
  cotizacion_codigo,
  revision,
  status,
  work_status,
  document_date
`;

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapLegacyProject(row: Record<string, unknown>): AdjudicatedProject {
  return {
    id: String(row.id ?? ""),
    anio: Number(row.anio ?? new Date().getFullYear()),
    codigo_proyecto: normalizeText(row.codigo_proyecto),
    cotizacion: normalizeText(row.cotizacion),
    oc: normalizeText(row.oc),
    cliente: normalizeText(row.cliente),
    codigo_cliente: normalizeText(row.codigo_cliente),
    unidad_trabajo: normalizeText(row.unidad_trabajo),
    codigo_unidad: normalizeText(row.codigo_unidad),
    fecha_adjudicacion: normalizeText(row.fecha_adjudicacion) || null,
    estado: normalizeText(row.estado) || "Activo",
    activo: Boolean(row.activo),
    cotizacion_id: null,
    propuesta_tecnica_id: null,
    revision_adjudicada: null,
    fecha_confirmacion_adjudicacion: null,
    confirmado_por_user_id: null,
    confirmado_por_email: null,
    adjudicacion_metadata: {},
    created_at: normalizeText(row.created_at),
    updated_at: normalizeText(row.updated_at),
  };
}

function shouldFallbackToLegacyProjectSelect(error: unknown): boolean {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error ?? "");
  return /cotizacion_id|propuesta_tecnica_id|revision_adjudicada|adjudicacion_metadata|confirmado_por/i.test(message);
}

export async function getAdjudicatedProjectForQuotation(cotizacion: Cotizacion): Promise<AdjudicatedProject | null> {
  if (!hasSupabaseConfig()) return null;

  const quotationCode = normalizeText(cotizacion.codigo);
  if (!quotationCode) return null;

  const filters = [`cotizacion.eq.${quotationCode}`];
  if (isUuid(cotizacion.id)) filters.unshift(`cotizacion_id.eq.${cotizacion.id}`);

  const query = supabase
    .from("proyectos_adjudicados")
    .select(PROJECT_SELECT)
    .eq("activo", true)
    .or(filters.join(","))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await query;
  if (!error) return (data as AdjudicatedProject | null) ?? null;
  if (!shouldFallbackToLegacyProjectSelect(error)) throw error;

  const legacy = await supabase
    .from("proyectos_adjudicados")
    .select(LEGACY_PROJECT_SELECT)
    .eq("activo", true)
    .eq("cotizacion", quotationCode)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (legacy.error) throw legacy.error;
  return legacy.data ? mapLegacyProject(legacy.data as Record<string, unknown>) : null;
}

export async function listTechnicalProposalOptionsForQuotation(cotizacion: Cotizacion): Promise<AdjudicatedTechnicalProposalOption[]> {
  if (!hasSupabaseConfig()) return [];

  const quotationCode = normalizeText(cotizacion.codigo);
  if (!quotationCode) return [];

  const filters = [`cotizacion_codigo.eq.${quotationCode}`];
  if (isUuid(cotizacion.id)) filters.unshift(`cotizacion_id.eq.${cotizacion.id}`);

  const { data, error } = await supabase
    .from("technical_proposals")
    .select(TECHNICAL_PROPOSAL_SELECT)
    .or(filters.join(","))
    .order("revision", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as AdjudicatedTechnicalProposalOption[]).filter((item) => normalizeText(item.id));
}

export async function confirmQuotationAdjudication(input: ConfirmAdjudicationInput): Promise<AdjudicatedProject> {
  if (!hasSupabaseConfig()) {
    throw new ConfirmAdjudicationError("Supabase no está configurado para confirmar adjudicaciones.", "missing_config");
  }
  if (!isUuid(input.cotizacionId)) {
    throw new ConfirmAdjudicationError("La cotización debe estar guardada en Supabase antes de confirmar la adjudicación.", "invalid_quotation");
  }
  if (input.propuestaTecnicaId && !isUuid(input.propuestaTecnicaId)) {
    throw new ConfirmAdjudicationError("La propuesta técnica seleccionada no tiene un identificador válido.", "invalid_technical_proposal");
  }

  const { data, error } = await supabase.rpc("confirmar_adjudicacion_cotizacion", {
    p_cotizacion_id: input.cotizacionId,
    p_propuesta_tecnica_id: input.propuestaTecnicaId || null,
    p_event_message: input.eventMessage || null,
  });

  if (error) {
    throw new ConfirmAdjudicationError(error.message || "No se pudo confirmar la adjudicación.", error.code);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new ConfirmAdjudicationError("La confirmación no devolvió el proyecto adjudicado.", "empty_result");
  }

  return row as AdjudicatedProject;
}
