import { demoData, type Requerimiento, type Cotizacion } from "@/lib/sgp/demoData";
import { readHistoricalImportQuality } from "@/lib/sgp/historicalImportQuality";
import { supabase } from "@/lib/sgp/supabaseClient";

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

type RequirementCodeParts = {
  codigoCliente: string;
  codigoUnidad: string;
  projectTag: string;
  anio: number;
  source: "metadata" | "related_requirement" | "catalog";
};

const CURRENT_RQ_CODE_PATTERN = /^RQ-(\d{4})-([A-Z0-9]+)-([A-Z0-9]+)-(P\d{3})-(\d{3})$/;
const HISTORICAL_RQ_CODE_PATTERN = /^RQ-[A-Z0-9]+-(\d{1,4})_(\d{4})$/;
const CONTROLLED_CLIENT_CODE_ALIASES: Record<string, string> = {
  NEXA: "NEXA",
};
const CONTROLLED_UNIT_CODE_ALIASES: Record<string, string> = {
  CAJAMARQUILLA: "PCON",
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
const MAX_CLIENT_REQUERIMIENTOS_ROWS = 300;

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeToken(value: unknown): string {
  return normalizeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function sameText(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizeString(left);
  const normalizedRight = normalizeString(right);
  return Boolean(normalizedLeft && normalizedRight) && normalizedLeft.localeCompare(normalizedRight, "es", { sensitivity: "base" }) === 0;
}

function normalizeProjectTag(value: unknown): string {
  const token = normalizeToken(value);
  if (!token) return "";
  return token.startsWith("P") ? token : `P${token}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveControlledClientCode(value: unknown): string {
  const token = normalizeToken(value);
  if (!token) return "";
  return CONTROLLED_CLIENT_CODE_ALIASES[token] ?? "";
}

function resolveControlledUnitCode(value: unknown): string {
  const token = normalizeToken(value);
  if (!token) return "";
  return CONTROLLED_UNIT_CODE_ALIASES[token] ?? "";
}

function isCurrentRequirementCode(value: unknown): boolean {
  return CURRENT_RQ_CODE_PATTERN.test(normalizeString(value));
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

async function fetchAllRequerimientos(): Promise<{ rows: SupabaseRequerimiento[]; truncated: boolean }> {
  const batchSize = 1000;
  let from = 0;
  const rows: SupabaseRequerimiento[] = [];

  while (rows.length < MAX_CLIENT_REQUERIMIENTOS_ROWS) {
    const to = Math.min(from + batchSize - 1, MAX_CLIENT_REQUERIMIENTOS_ROWS - 1);
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

  return { rows, truncated: rows.length >= MAX_CLIENT_REQUERIMIENTOS_ROWS };
}

/**
 * Extrae y valida los códigos necesarios para generar un RQ.
 * Regla: RQ-{AÑO}-{CLIENTE}-{UNIDAD}-P{PROYECTO}-{CORRELATIVO}
 */
export function resolveRequirementCodePartsFromQuotation(
  cotizacion: CotizacionWithRequirementMetadata,
): ({ ok: true } & RequirementCodeParts) | { ok: false; message: string } {
  const meta = cotizacion.metadata || {};

  const clienteFromCatalog = demoData
    .listCatalogCodigoClientes()
    .find((item) => sameText(item.cliente, cotizacion.cliente) || normalizeToken(item.codigo_cliente) === normalizeToken(cotizacion.cliente))?.codigo_cliente;
  const unidadFromCatalog = demoData
    .listCatalogCodigoUnidadesTrabajo()
    .find((item) => sameText(item.unidad_trabajo, cotizacion.unidad_trabajo) || normalizeToken(item.codigo_unidad) === normalizeToken(cotizacion.unidad_trabajo))?.codigo_unidad;

  const codigo_cliente =
    normalizeToken(meta.codigo_cliente) || normalizeToken(clienteFromCatalog) || resolveControlledClientCode(cotizacion.cliente);
  const codigo_unidad =
    normalizeToken(meta.codigo_unidad) || normalizeToken(unidadFromCatalog) || resolveControlledUnitCode(cotizacion.unidad_trabajo);
  const projectFromCatalog = demoData
    .listProyectosAdjudicados()
    .find(
      (item) =>
        sameText(item.cotizacion, cotizacion.codigo) ||
        (normalizeToken(item.codigo_cliente) === codigo_cliente && normalizeToken(item.codigo_unidad) === codigo_unidad) ||
        (sameText(item.cliente, cotizacion.cliente) && sameText(item.unidad_trabajo, cotizacion.unidad_trabajo)),
    )?.codigo_proyecto;
  const project_tag = normalizeProjectTag(meta.codigo_proyecto_adjudicado || meta.project_tag || projectFromCatalog);
  const source: RequirementCodeParts["source"] =
    meta.codigo_cliente || meta.codigo_unidad || meta.codigo_proyecto_adjudicado || meta.project_tag ? "metadata" : "catalog";

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
    codigoCliente: codigo_cliente,
    codigoUnidad: codigo_unidad,
    projectTag: project_tag,
    anio: new Date().getFullYear(),
    source,
  };
}

function resolveRequirementCodePartsFromRelatedRequirements(
  relatedRequirements: Array<{ codigo: string | null }>,
): RequirementCodeParts | null {
  const currentYear = new Date().getFullYear();
  const matches = relatedRequirements
    .map((item) => CURRENT_RQ_CODE_PATTERN.exec(normalizeString(item.codigo)))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .filter((match) => Number(match[1]) === currentYear);
  if (matches.length === 0) return null;
  matches.sort((left, right) => Number(right[5]) - Number(left[5]));
  const latest = matches[0];
  return {
    codigoCliente: latest[2],
    codigoUnidad: latest[3],
    projectTag: latest[4],
    anio: currentYear,
    source: "related_requirement",
  };
}

function resolveRequirementCodePartsForNewFormat(
  cotizacion: CotizacionWithRequirementMetadata,
  relatedRequirements: Array<{ codigo: string | null }>,
): { ok: true; parts: RequirementCodeParts } | { ok: false; message: string } {
  const parts = resolveRequirementCodePartsFromQuotation(cotizacion);
  if (parts.ok) return { ok: true, parts };

  const relatedParts = resolveRequirementCodePartsFromRelatedRequirements(relatedRequirements);
  if (relatedParts) return { ok: true, parts: relatedParts };

  return {
    ok: false,
    message: `${parts.message} Para cotizaciones históricas, completa la leyenda vigente de cliente/unidad y el PTag del proyecto antes de crear un RQ nuevo. Los códigos RQ históricos se conservan, pero no se reutilizan para generar el formato vigente.`,
  };
}

/**
 * Genera el siguiente correlativo para un prefijo específico en Supabase.
 */
async function getNextRqCorrelativoSupabase(prefix: string, relatedRequirements: Array<{ codigo: string | null }> = []): Promise<{
  ok: true;
  correlativo: string;
  existingCodes: string[];
  ignoredCodes: string[];
  maxCorrelativo: number;
} | {
  ok: false;
  message: string;
}> {
  const currentYear = new Date().getFullYear();
  const { data, error } = await supabase
    .from("requerimientos")
    .select("codigo")
    .ilike("codigo", `${prefix}-%`)
    .order("codigo", { ascending: false });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[requirementsRepository] No se pudo calcular correlativo RQ", {
        prefix,
        error,
      });
    }
    return {
      ok: false,
      message: `No se pudo leer los RQ existentes para calcular el correlativo seguro: ${error.message}`,
    };
  }

  const exactNewCodePattern = new RegExp(`^${escapeRegExp(prefix)}-(\\d{3})$`);
  const newFormatConsidered = (data ?? []).flatMap((row) => {
    const codigo = normalizeString(row.codigo);
    const match = exactNewCodePattern.exec(codigo);
    if (!match) return [];
    const correlativo = parseInt(match[1], 10);
    return Number.isFinite(correlativo) ? [{ codigo, correlativo, reason: "new-format-prefix" }] : [];
  });
  const historicalCurrentYearConsidered = relatedRequirements.flatMap((row) => {
    const codigo = normalizeString(row.codigo);
    const match = HISTORICAL_RQ_CODE_PATTERN.exec(codigo);
    if (!match) return [];
    const correlativo = parseInt(match[1], 10);
    const year = parseInt(match[2], 10);
    if (year !== currentYear || !Number.isFinite(correlativo)) return [];
    return [{ codigo, correlativo, reason: "historical-current-year" }];
  });
  const considered = [...newFormatConsidered, ...historicalCurrentYearConsidered];
  const ignoredCodes = Array.from(
    new Set([
      ...(data ?? [])
        .map((row) => normalizeString(row.codigo))
        .filter((codigo) => codigo && !exactNewCodePattern.test(codigo)),
      ...relatedRequirements
        .map((row) => normalizeString(row.codigo))
        .filter((codigo) => {
          if (!codigo) return false;
          const historicalMatch = HISTORICAL_RQ_CODE_PATTERN.exec(codigo);
          if (historicalMatch) return Number(historicalMatch[2]) !== currentYear;
          return !exactNewCodePattern.test(codigo);
        }),
    ]),
  );

  const max = Math.max(...considered.map((item) => item.correlativo), 0);
  const correlativo = String(max + 1).padStart(3, "0");

  if (process.env.NODE_ENV === "development") {
    console.log("[requirementsRepository] RQ correlativo", {
      prefix,
      currentYear,
      consideredCodes: considered,
      existingCodes: considered.map((item) => item.codigo),
      ignoredCodes,
      maxCorrelativo: max,
      nextCorrelativo: correlativo,
    });
  }

  return { ok: true, correlativo, existingCodes: considered.map((item) => item.codigo), ignoredCodes, maxCorrelativo: max };
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

  const { data: relatedRequirements, error: relatedRequirementsError } = await supabase
    .from("requerimientos")
    .select("id, codigo")
    .eq("cotizacion_id", cotizacion.id)
    .is("deleted_at", null)
    .order("codigo", { ascending: true });

  if (relatedRequirementsError) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[requirementsRepository] No se pudo leer RQ relacionados de la cotización", {
        cotizacion_id: cotizacion.id,
        cotizacion_codigo: cotizacion.codigo,
        error: relatedRequirementsError,
      });
    }
    return {
      ok: false,
      message: `No se pudo leer los RQ existentes de la cotización para crear un nuevo correlativo seguro: ${relatedRequirementsError.message}`,
    };
  }

  // 1. Resolver partes del código vigente. Los RQ históricos no se reutilizan.
  const partsResult = resolveRequirementCodePartsForNewFormat(cotizacion, relatedRequirements ?? []);
  if (!partsResult.ok) return partsResult;
  const { parts } = partsResult;

  // 2. Generar código completo. Se permite más de un RQ por cotización;
  // la unicidad operativa está en el código RQ, no en cotizacion_id.
  const prefix = `RQ-${parts.anio}-${parts.codigoCliente}-${parts.codigoUnidad}-${parts.projectTag}`;
  const correlativoResult = await getNextRqCorrelativoSupabase(prefix, relatedRequirements ?? []);
  if (!correlativoResult.ok) {
    return { ok: false, message: correlativoResult.message };
  }
  const correlativo = correlativoResult.correlativo;
  const finalCode = `${prefix}-${correlativo}`;

  if (process.env.NODE_ENV === "development") {
    console.log("[requirementsRepository] Creando RQ:", finalCode, {
      cotizacion_id: cotizacion.id,
      cotizacion_codigo: cotizacion.codigo,
      relatedRequirementsError: relatedRequirementsError ?? null,
      relatedRequirements: relatedRequirements ?? [],
      prefix,
      existingCodes: correlativoResult.existingCodes,
      ignoredCodes: correlativoResult.ignoredCodes,
      maxCorrelativo: correlativoResult.maxCorrelativo,
      nextCorrelativo: correlativo,
      codePartsSource: parts.source,
      codeParts: parts,
    });
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

type DeleteNewRequirementRpcRow = {
  success?: boolean | null;
  message?: string | null;
  deleted_code?: string | null;
};

export type DeleteNewRequirementIfEmptyResult =
  | { ok: true; message: string; deletedCode: string }
  | { ok: false; message: string; deletedCode?: string };

export function isCurrentFormatRequirementCode(value: unknown): boolean {
  return isCurrentRequirementCode(value);
}

export async function deleteNewRequirementIfEmpty(requirementId: string): Promise<DeleteNewRequirementIfEmptyResult> {
  const normalizedId = normalizeString(requirementId);
  if (!normalizedId) {
    return { ok: false, message: "No se recibió el id del requerimiento a eliminar." };
  }

  const { data, error } = await supabase.rpc("delete_new_requirement_if_empty", {
    p_requirement_id: normalizedId,
  });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[requirementsRepository] delete_new_requirement_if_empty error", {
        requirementId: normalizedId,
        error,
      });
    }
    return {
      ok: false,
      message: error.message || "Supabase rechazó la eliminación controlada del RQ.",
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as DeleteNewRequirementRpcRow | null;
  if (!row) {
    return {
      ok: false,
      message: "La RPC no devolvió resultado de eliminación.",
    };
  }

  const message = normalizeString(row.message) || "Operación de eliminación finalizada.";
  const deletedCode = normalizeString(row.deleted_code);

  if (row.success !== true) {
    return { ok: false, message, deletedCode: deletedCode || undefined };
  }

  return { ok: true, message, deletedCode };
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
    const { rows: data, truncated } = await fetchAllRequerimientos();
    const rows = data.map(mapSupabaseRequerimiento);
    return {
      rows,
      total: rows.length,
      source: "supabase",
      warning: truncated
        ? `Lectura limitada a ${MAX_CLIENT_REQUERIMIENTOS_ROWS} requerimientos para proteger egress. Usa filtros/búsqueda para cargas grandes.`
        : undefined,
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
