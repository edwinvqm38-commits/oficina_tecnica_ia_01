import {
  demoData,
  type CatalogCodigoCliente,
  type CatalogCodigoUnidadTrabajo,
  type Cotizacion,
  type ProyectoAdjudicado,
  type Requerimiento,
} from "@/lib/sgp/demoData";
import { readHistoricalImportQuality } from "@/lib/sgp/historicalImportQuality";
import { supabase } from "@/lib/sgp/supabaseClient";
import { listCatalogItems } from "@/lib/sgp/catalogsRepository";
import {
  CURRENT_RQ_CODE_PATTERN,
  nextRqCorrelativeForQuotation,
  normalizeString,
  normalizeToken,
  planProjectTagForQuotation,
  sameText,
  type RequirementCodeRelatedRow,
} from "@/lib/sgp/requirementCodeGenerator";

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
  codigo_proyecto_adjudicado: string | null;
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

type RequirementProjectReservationRow = {
  codigo: string | null;
  codigo_proyecto_adjudicado: string | null;
  anio: number | null;
  deleted_at?: string | null;
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
  source: "metadata" | "related_requirement" | "exact_project" | "new_project";
};

type RequirementCodeCatalogs = {
  clientes: CatalogCodigoCliente[];
  unidades: CatalogCodigoUnidadTrabajo[];
  proyectos: ProyectoAdjudicado[];
};

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
  codigo_proyecto_adjudicado,
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

function readCotizacionField(cotizacion: CotizacionWithRequirementMetadata, modernKey: string, legacyKey: keyof Cotizacion): string {
  const record = cotizacion as unknown as Record<string, unknown>;
  return normalizeString(record[legacyKey] ?? record[modernKey]);
}

function getYearFromDate(value: unknown): number | null {
  const normalized = normalizeString(value);
  const year = Number(normalized.slice(0, 4));
  return Number.isFinite(year) && year >= 2000 ? year : null;
}

function getRqCreationYear(cotizacion: CotizacionWithRequirementMetadata): number {
  return (
    getYearFromDate(readCotizacionField(cotizacion, "fecha_oc", "fecha_oc")) ??
    getYearFromDate(readCotizacionField(cotizacion, "fecha_entregada", "fecha_entregada")) ??
    getYearFromDate(readCotizacionField(cotizacion, "fecha_entrega", "fecha_entrega")) ??
    new Date().getFullYear()
  );
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

function getDefaultRequirementCodeCatalogs(): RequirementCodeCatalogs {
  return {
    clientes: demoData.listCatalogCodigoClientes(),
    unidades: demoData.listCatalogCodigoUnidadesTrabajo(),
    proyectos: demoData.listProyectosAdjudicados(),
  };
}

async function loadRequirementCodeCatalogs(): Promise<RequirementCodeCatalogs> {
  const [clientes, unidades, proyectos] = await Promise.all([
    listCatalogItems<CatalogCodigoCliente>("catalogCodigoClientes"),
    listCatalogItems<CatalogCodigoUnidadTrabajo>("catalogCodigoUnidadesTrabajo"),
    listCatalogItems<ProyectoAdjudicado>("proyectosAdjudicados"),
  ]);

  return {
    clientes: clientes.rows,
    unidades: unidades.rows,
    proyectos: proyectos.rows,
  };
}

async function loadRequirementProjectReservationRows(anio: number): Promise<RequirementProjectReservationRow[]> {
  const byKey = new Map<string, RequirementProjectReservationRow>();
  const queries = [
    supabase
      .from("requerimientos")
      .select("codigo,codigo_proyecto_adjudicado,anio,deleted_at")
      .eq("anio", anio),
    supabase
      .from("requerimientos")
      .select("codigo,codigo_proyecto_adjudicado,anio,deleted_at")
      .ilike("codigo", `RQ-${anio}-%`),
  ];

  for (const query of queries) {
    const { data, error } = await query;
    if (error) throw error;
    (data ?? []).forEach((row) => {
      const reservation = row as RequirementProjectReservationRow;
      const key = `${normalizeString(reservation.codigo)}|${normalizeString(reservation.codigo_proyecto_adjudicado)}|${normalizeString(reservation.anio)}`;
      byKey.set(key, reservation);
    });
  }

  return Array.from(byKey.values());
}

function resolveClientUnitCodesFromQuotation(
  cotizacion: CotizacionWithRequirementMetadata,
  catalogs: RequirementCodeCatalogs,
): {
  cliente: string;
  unidad: string;
  codigoCliente: string;
  codigoUnidad: string;
} {
  const meta = cotizacion.metadata || {};
  const cliente = readCotizacionField(cotizacion, "cliente_nombre", "cliente");
  const unidad = readCotizacionField(cotizacion, "unidad_trabajo_nombre", "unidad_trabajo");

  const clienteFromCatalog = catalogs.clientes.find(
    (item) => sameText(item.cliente, cliente) || normalizeToken(item.codigo_cliente) === normalizeToken(cliente),
  )?.codigo_cliente;
  const unidadFromCatalog = catalogs.unidades.find(
    (item) => sameText(item.unidad_trabajo, unidad) || normalizeToken(item.codigo_unidad) === normalizeToken(unidad),
  )?.codigo_unidad;

  return {
    cliente,
    unidad,
    codigoCliente: normalizeToken(meta.codigo_cliente) || normalizeToken(clienteFromCatalog) || resolveControlledClientCode(cliente),
    codigoUnidad: normalizeToken(meta.codigo_unidad) || normalizeToken(unidadFromCatalog) || resolveControlledUnitCode(unidad),
  };
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
    codigo_proyecto_adjudicado: normalizeString(row.codigo_proyecto_adjudicado),
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
  catalogs: RequirementCodeCatalogs = getDefaultRequirementCodeCatalogs(),
  reservedRequirements: RequirementProjectReservationRow[] = [],
): ({ ok: true } & RequirementCodeParts) | { ok: false; message: string } {
  const meta = cotizacion.metadata || {};
  const cotizacionCodigo = readCotizacionField(cotizacion, "codigo", "codigo");
  const anio = getRqCreationYear(cotizacion);
  const { codigoCliente: codigo_cliente, codigoUnidad: codigo_unidad } = resolveClientUnitCodesFromQuotation(cotizacion, catalogs);
  const projectPlan = planProjectTagForQuotation({
    cotizacionCodigo,
    anio,
    metadata: meta,
    projects: catalogs.proyectos,
    reservedRequirements,
  });
  const project_tag = projectPlan.action === "reuse" ? projectPlan.projectTag : "";

  if (!codigo_cliente || !codigo_unidad || !project_tag) {
    const missing = [];
    if (!codigo_cliente) missing.push("Código de Cliente");
    if (!codigo_unidad) missing.push("Código de Unidad");
    if (!project_tag) missing.push("Código de Proyecto (PTag)");
    
    return { 
      ok: false as const, 
      message: `Faltan datos maestros para generar el RQ: ${missing.join(", ")}.` 
    };
  }

  return {
    ok: true as const,
    codigoCliente: codigo_cliente,
    codigoUnidad: codigo_unidad,
    projectTag: project_tag,
    anio,
    source: projectPlan.source,
  };
}

function resolveRequirementCodePartsFromRelatedRows(
  relatedRequirements: Array<{ codigo: string | null }>,
  anio: number,
): RequirementCodeParts | null {
  const latest = relatedRequirements
    .map((item) => CURRENT_RQ_CODE_PATTERN.exec(normalizeString(item.codigo)))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .filter((match) => Number(match[1]) === anio)
    .sort((left, right) => Number(right[5]) - Number(left[5]))[0];
  if (!latest) return null;
  return {
    codigoCliente: latest[2],
    codigoUnidad: latest[3],
    projectTag: latest[4],
    anio,
    source: "related_requirement",
  };
}

function resolveRequirementCodePartsForNewFormat(
  cotizacion: CotizacionWithRequirementMetadata,
  relatedRequirements: Array<{ codigo: string | null }>,
  catalogs: RequirementCodeCatalogs = getDefaultRequirementCodeCatalogs(),
  reservedRequirements: RequirementProjectReservationRow[] = [],
): { ok: true; parts: RequirementCodeParts } | { ok: false; message: string } {
  const relatedParts = resolveRequirementCodePartsFromRelatedRows(relatedRequirements, getRqCreationYear(cotizacion));
  if (relatedParts) return { ok: true, parts: relatedParts };

  const parts = resolveRequirementCodePartsFromQuotation(cotizacion, catalogs, reservedRequirements);
  if (parts.ok) return { ok: true, parts };

  return {
    ok: false,
    message: `${parts.message} Completa Datos > Cotizaciones > Leyenda clientes, Leyenda unidades y Proyectos adjudicados/OC antes de crear un RQ nuevo. Los códigos RQ históricos se conservan, pero no se reutilizan para generar el formato vigente.`,
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
  const { data, error } = await supabase
    .from("requerimientos")
    .select("id, codigo, cotizacion_id, deleted_at")
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

  const result = nextRqCorrelativeForQuotation({
    prefix,
    relatedRequirements: relatedRequirements as RequirementCodeRelatedRow[],
  });
  const ignoredCodes = Array.from(
    new Set([
      ...result.ignoredCodes,
      ...(data ?? [])
        .map((row) => normalizeString(row.codigo))
        .filter((codigo) => codigo && !result.existingCodes.includes(codigo)),
    ]),
  );

  if (process.env.NODE_ENV === "development") {
    console.log("[requirementsRepository] RQ correlativo", {
      prefix,
      consideredCodes: result.existingCodes,
      existingCodes: result.existingCodes,
      ignoredCodes,
      maxCorrelativo: result.maxCorrelativo,
      nextCorrelativo: result.correlativo,
    });
  }

  return { ok: true, correlativo: result.correlativo, existingCodes: result.existingCodes, ignoredCodes, maxCorrelativo: result.maxCorrelativo };
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
    .select("id, codigo, deleted_at")
    .eq("cotizacion_id", cotizacion.id)
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

  // 1. Resolver partes del código vigente desde catálogos reales de Supabase.
  // Los RQ históricos no se reutilizan.
  const catalogs = await loadRequirementCodeCatalogs();
  const anio = getRqCreationYear(cotizacion);
  let reservedProjectRequirements: RequirementProjectReservationRow[] = [];
  try {
    reservedProjectRequirements = await loadRequirementProjectReservationRows(anio);
  } catch (error) {
    return {
      ok: false,
      message: `No se pudo leer los P### reservados en requerimientos para el año ${anio}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const partsResult = resolveRequirementCodePartsForNewFormat(cotizacion, relatedRequirements ?? [], catalogs, reservedProjectRequirements);

  if (!partsResult.ok && partsResult.message.includes("Código de Proyecto")) {
    return { ok: false, message: "Primero confirma la adjudicación de la cotización." };
  }
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
  const cotizacionCodigo = readCotizacionField(cotizacion, "codigo", "codigo");
  const proyecto = readCotizacionField(cotizacion, "proyecto", "proyecto");
  const oc = readCotizacionField(cotizacion, "oc", "oc");
  const tipoServicio = readCotizacionField(cotizacion, "tipo_servicio_nombre", "tipo_servicio");
  const fechaEntrega = readCotizacionField(cotizacion, "fecha_entrega", "fecha_entrega");
  const responsableTecnico = readCotizacionField(cotizacion, "responsable_tecnico", "responsable_tecnico");
  const payload = {
    codigo: finalCode,
    cotizacion_id: cotizacion.id,
    cotizacion_codigo: cotizacionCodigo,
    codigo_cliente: parts.codigoCliente,
    codigo_unidad: parts.codigoUnidad,
    proyecto_servicio: proyecto,
    oc: oc || null,
    codigo_proyecto_adjudicado: parts.projectTag,
    anio: parts.anio,
    solicitante_rq: options.userEmail || "Oficina Técnica",
    tipo_servicio_nombre: tipoServicio,
    estado: "Pendiente",
    fecha_solicitud: now,
    fecha_requerida: fechaEntrega || now,
    responsable: responsableTecnico || options.userEmail || "Por asignar",
    avance: 0,
    total_rq: 0,
    observaciones: `Creado automáticamente desde cotización ganada ${cotizacionCodigo}.`,
    metadata: {
      created_from: "cotizacion_ganada",
      source_module: "cotizaciones",
      quotation_status_at_creation: "Ganada",
      cotizacion_codigo: cotizacionCodigo,
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

export async function updateRequirementSupabase(
  requirementId: string,
  draft: Requerimiento,
): Promise<{ ok: true; requerimiento: Requerimiento } | { ok: false; message: string }> {
  const codigo = normalizeString(draft.codigo);
  if (!codigo) {
    return { ok: false, message: "El código de requerimiento no puede estar vacío." };
  }

  const payload = {
    codigo,
    cotizacion_codigo: normalizeString(draft.cotizacion_codigo) || null,
    codigo_cliente: normalizeString(draft.codigo_cliente) || null,
    codigo_unidad: normalizeString(draft.codigo_unidad) || null,
    proyecto_servicio: normalizeString(draft.proyecto_servicio) || null,
    oc: normalizeString(draft.oc) || null,
    anio: typeof draft.anio === "number" && Number.isFinite(draft.anio) ? draft.anio : null,
    solicitante_rq: normalizeString(draft.solicitante_rq) || null,
    tipo_servicio_nombre: normalizeString(draft.tipo_servicio) || null,
    area_nombre: normalizeString(draft.area) || null,
    estado: normalizeString(draft.estado) || "Pendiente",
    fecha_solicitud: normalizeString(draft.fecha_solicitud) || null,
    fecha_requerida: normalizeString(draft.fecha_requerida) || null,
    responsable: normalizeString(draft.responsable) || null,
    avance: Number.isFinite(Number(draft.avance)) ? Number(draft.avance) : 0,
    total_rq: Number.isFinite(Number(draft.total_rq)) ? Number(draft.total_rq) : 0,
    observaciones: normalizeString(draft.observaciones) || null,
  };

  const { data, error } = await supabase
    .from("requerimientos")
    .update(payload)
    .eq("id", requirementId)
    .select(REQUIREMENTS_SELECT)
    .single();

  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "Ya existe un requerimiento con ese código. Usa un código único."
          : error.message || "Supabase rechazó la actualización del requerimiento.",
    };
  }

  return { ok: true, requerimiento: mapSupabaseRequerimiento(data as SupabaseRequerimiento) };
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
