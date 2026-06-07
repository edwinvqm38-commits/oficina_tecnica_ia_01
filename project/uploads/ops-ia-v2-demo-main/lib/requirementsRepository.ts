import { demoData, type Requerimiento, type Cotizacion } from "@/lib/demoData";
import { readHistoricalImportQuality } from "@/lib/historicalImportQuality";
import { supabase } from "@/lib/supabaseClient";

export type RequirementsDataSource = "supabase" | "demo";

export type RequirementsListResult = {
  rows: Array<Requerimiento & { historical_import_quality?: ReturnType<typeof readHistoricalImportQuality> }>;
  total: number;
  source: RequirementsDataSource;
  warning?: string;
};

type SupabaseRequerimiento = {
  id: string;
  codigo: string;
  cotizacion_id: string;
  cotizacion_codigo: string | null;
  codigo_cliente: string | null;
  codigo_unidad: string | null;
  proyecto_servicio: string | null;
  oc: string | null;
  anio: number | null;
  solicitante_rq: string | null;
  tipo_servicio_nombre: string | null;
  area_nombre: string | null;
  estado: string | null;
  fecha_solicitud: string | null;
  fecha_requerida: string | null;
  responsable: string | null;
  avance: number | null;
  total_rq: number | null;
  observaciones: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type RequirementCodeMetadata = {
  codigo_cliente?: string | null;
  codigo_unidad?: string | null;
  codigo_proyecto_adjudicado?: string | null;
  project_tag?: string | null;
  historical_import?: {
    codigo_cliente?: string | null;
    codigo_unidad?: string | null;
    codigo_proyecto_adjudicado?: string | null;
  } | null;
};

type CotizacionWithRequirementMetadata = Cotizacion & {
  metadata?: RequirementCodeMetadata | null;
};

const REQUIREMENTS_SELECT = `
  id,
  codigo,
  cotizacion_id,
  cotizacion_codigo,
  codigo_cliente,
  codigo_unidad,
  proyecto_servicio,
  oc,
  anio,
  solicitante_rq,
  tipo_servicio_nombre,
  area_nombre,
  estado,
  fecha_solicitud,
  fecha_requerida,
  responsable,
  avance,
  total_rq,
  observaciones,
  metadata,
  created_at,
  updated_at
`;

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function mapEstado(value: string): Requerimiento["estado"] {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("atend")) return "Atendido";
  if (normalized.includes("proceso") || normalized.includes("parcial")) return "En proceso";
  return "Pendiente";
}

function mapSupabaseRequerimiento(row: SupabaseRequerimiento): Requerimiento & {
  historical_import_quality?: ReturnType<typeof readHistoricalImportQuality>;
} {
  const quality = readHistoricalImportQuality(row.metadata);

  return {
    id: row.id,
    codigo: row.codigo,
    cotizacion_id: row.cotizacion_id,
    cotizacion_codigo: normalizeString(row.cotizacion_codigo),
    codigo_cliente: normalizeString(row.codigo_cliente),
    codigo_unidad: normalizeString(row.codigo_unidad),
    proyecto_servicio: normalizeString(row.proyecto_servicio),
    oc: normalizeString(row.oc),
    anio: typeof row.anio === "number" ? row.anio : undefined,
    solicitante_rq: normalizeString(row.solicitante_rq),
    tipo_servicio: normalizeString(row.tipo_servicio_nombre),
    area: normalizeString(row.area_nombre),
    estado: mapEstado(normalizeString(row.estado)),
    fecha_solicitud: normalizeString(row.fecha_solicitud),
    fecha_requerida: normalizeString(row.fecha_requerida),
    responsable: normalizeString(row.responsable),
    avance: Number(row.avance ?? 0),
    total_rq: Number(row.total_rq ?? 0),
    observaciones: normalizeString(row.observaciones),
    historical_import_quality: quality ?? undefined,
  };
}

async function fetchAllRequerimientos(): Promise<SupabaseRequerimiento[]> {
  const batchSize = 1000;
  let from = 0;
  const rows: SupabaseRequerimiento[] = [];

  while (true) {
    const to = from + batchSize - 1;
    const { data, error } = await supabase
      .from("requerimientos")
      .select(REQUIREMENTS_SELECT)
      .order("codigo", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const chunk = (data ?? []) as SupabaseRequerimiento[];
    rows.push(...chunk);
    if (chunk.length < batchSize) break;
    from += batchSize;
  }

  return rows;
}

/**
 * Extrae y valida los códigos necesarios para generar un RQ.
 * Regla: RQ-{AÑO}-{CLIENTE}-{UNIDAD}-P{PROYECTO}-{CORRELATIVO}
 */
export function resolveRequirementCodePartsFromQuotation(cotizacion: CotizacionWithRequirementMetadata) {
  const meta = cotizacion.metadata || {};
  const historical = meta.historical_import || {};

  // Buscamos en metadata nivel raíz o en bloque historical_import
  const codigo_cliente = meta.codigo_cliente || historical.codigo_cliente;
  const codigo_unidad = meta.codigo_unidad || historical.codigo_unidad;
  // El proyecto puede venir como codigo_proyecto_adjudicado o project_tag
  const project_tag = meta.codigo_proyecto_adjudicado || meta.project_tag || historical.codigo_proyecto_adjudicado;

  if (!codigo_cliente || !codigo_unidad || !project_tag) {
    const missing = [];
    if (!codigo_cliente) missing.push("Código de Cliente");
    if (!codigo_unidad) missing.push("Código de Unidad");
    if (!project_tag) missing.push("Código de Proyecto (PTag)");
    
    return { 
      ok: false as const, 
      message: `Faltan datos maestros en la metadata de la cotización: ${missing.join(", ")}.` 
    };
  }

  return {
    ok: true as const,
    codigoCliente: String(codigo_cliente).toUpperCase(),
    codigoUnidad: String(codigo_unidad).toUpperCase(),
    projectTag: String(project_tag).toUpperCase().startsWith('P') ? String(project_tag).toUpperCase() : `P${project_tag}`,
    anio: new Date().getFullYear()
  };
}

/**
 * Genera el siguiente correlativo para un prefijo específico en Supabase.
 */
async function getNextRqCorrelativoSupabase(prefix: string): Promise<string> {
  const { data, error } = await supabase
    .from("requerimientos")
    .select("codigo")
    .ilike("codigo", `${prefix}-%`)
    .is("deleted_at", null)
    .order("codigo", { ascending: false });

  if (error || !data || data.length === 0) return "0001";

  const numericValues = data
    .map(row => {
      const parts = row.codigo.split("-");
      const lastPart = parts[parts.length - 1];
      const num = parseInt(lastPart, 10);
      return isNaN(num) ? 0 : num;
    });

  const max = Math.max(...numericValues, 0);
  return String(max + 1).padStart(4, "0");
}

/**
 * Crea un requerimiento real en Supabase desde una cotización Ganada.
 */
export async function createRequirementFromWonQuotationSupabase(
  cotizacion: CotizacionWithRequirementMetadata,
  options: { userEmail?: string } = {}
): Promise<{ ok: true; requerimiento: Requerimiento } | { ok: false; message: string }> {
  if (cotizacion.estado !== "Ganada") {
    return { ok: false, message: "La cotización debe estar en estado 'Ganada'." };
  }

  // 1. Validar duplicados activos
  const { data: existing } = await supabase
    .from("requerimientos")
    .select("id, codigo")
    .eq("cotizacion_id", cotizacion.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    return { ok: false, message: `Ya existe un RQ activo (${existing.codigo}) para esta cotización.` };
  }

  // 2. Resolver partes del código
  const parts = resolveRequirementCodePartsFromQuotation(cotizacion);
  if (!parts.ok) return parts;

  // 3. Generar código completo
  const prefix = `RQ-${parts.anio}-${parts.codigoCliente}-${parts.codigoUnidad}-${parts.projectTag}`;
  const correlativo = await getNextRqCorrelativoSupabase(prefix);
  const finalCode = `${prefix}-${correlativo}`;

  if (process.env.NODE_ENV === "development") {
    console.log("[requirementsRepository] Creando RQ:", finalCode, { cotizacion_id: cotizacion.id });
  }

  const now = new Date().toISOString().slice(0, 10);
  const payload = {
    codigo: finalCode,
    cotizacion_id: cotizacion.id,
    cotizacion_codigo: cotizacion.codigo,
    codigo_cliente: parts.codigoCliente,
    codigo_unidad: parts.codigoUnidad,
    proyecto_servicio: cotizacion.proyecto,
    oc: cotizacion.oc || null,
    codigo_proyecto_adjudicado: parts.projectTag,
    anio: parts.anio,
    solicitante_rq: options.userEmail || "Oficina Técnica",
    tipo_servicio_nombre: cotizacion.tipo_servicio,
    estado: "Pendiente",
    fecha_solicitud: now,
    fecha_requerida: cotizacion.fecha_entrega || now,
    responsable: cotizacion.responsable_tecnico || options.userEmail || "Por asignar",
    avance: 0,
    total_rq: 0,
    observaciones: `Creado automáticamente desde cotización ganada ${cotizacion.codigo}.`,
    metadata: {
      created_from: "cotizacion_ganada",
      source_module: "cotizaciones",
      quotation_status_at_creation: "Ganada",
      cotizacion_codigo: cotizacion.codigo,
      generated_by: "sgp-lite",
      app_source: "sgp-lite",
      user_creator: options.userEmail
    }
  };

  const { data, error } = await supabase
    .from("requerimientos")
    .insert(payload)
    .select(REQUIREMENTS_SELECT)
    .single();

  if (error) {
    console.error("[requirementsRepository] Error Supabase:", error);
    return { 
      ok: false, 
      message: error.code === "23505" 
        ? "Conflicto de código RQ. El correlativo pudo haber sido tomado por otro usuario. Reintente."
        : `Error de base de datos: ${error.message}` 
    };
  }

  return { 
    ok: true, 
    requerimiento: mapSupabaseRequerimiento(data as SupabaseRequerimiento) 
  };
}

export async function listRequerimientos(): Promise<RequirementsListResult> {
  if (!hasSupabaseConfig()) {
    const rows = demoData.listRequerimientos();
    return {
      rows,
      total: rows.length,
      source: "demo",
      warning: "No se encontraron variables públicas de Supabase; se usa data demo local.",
    };
  }

  try {
    const data = await fetchAllRequerimientos();
    const rows = data.map(mapSupabaseRequerimiento);
    return {
      rows,
      total: rows.length,
      source: "supabase",
    };
  } catch (error) {
    const rows = demoData.listRequerimientos();
    return {
      rows,
      total: rows.length,
      source: "demo",
      warning:
        error instanceof Error
          ? `No se pudo leer public.requerimientos desde Supabase: ${error.message}. Se usa data demo local.`
          : "No se pudo leer public.requerimientos desde Supabase. Se usa data demo local.",
    };
  }
}
