import { demoData, type Cotizacion } from "@/lib/sgp/demoData";
import { readHistoricalImportQuality } from "@/lib/sgp/historicalImportQuality";
import { normalizeCotizacionEconomicSummary } from "@/lib/sgp/quotationEconomics";
import { supabase } from "@/lib/sgp/supabaseClient";
import { authFetch } from "@/lib/api/authFetch";

export type QuotationsDataSource = "supabase" | "demo";

type CotizacionWithSupabaseMetadata = Cotizacion & {
  metadata?: Record<string, unknown> | null;
  historical_import_quality?: ReturnType<typeof readHistoricalImportQuality>;
};

export type QuotationsListResult = {
  rows: CotizacionWithSupabaseMetadata[];
  total: number;
  source: QuotationsDataSource;
  warning?: string;
};

export type CreateCotizacionOptions = {
  userEmail?: string;
};

export type UpdateCotizacionOptions = {
  userEmail?: string;
};

export class CreateCotizacionError extends Error {
  constructor(
    message: string,
    public readonly code: "missing_required_fields" | "duplicate_code" | "supabase_error" | "drive_error",
  ) {
    super(message);
    this.name = "CreateCotizacionError";
  }
}

export class UpdateCotizacionError extends Error {
  constructor(
    message: string,
    public readonly code: "missing_required_fields" | "duplicate_code" | "not_found" | "supabase_error",
  ) {
    super(message);
    this.name = "UpdateCotizacionError";
  }
}

type SerializedSupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
  name?: string;
  rawKeys: string[];
  rawStringified?: string;
};

type SupabaseCotizacion = {
  id: string;
  codigo: string;
  oc: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  proyecto: string;
  unidad_trabajo_id: string | null;
  unidad_trabajo_nombre: string | null;
  moneda_codigo: string | null;
  estado: string | null;
  estado_propuesta: string | null;
  solicitante: string | null;
  responsable_tecnico: string | null;
  responsable_economico: string | null;
  fecha_registro: string | null;
  fecha_presentacion: string | null;
  fecha_invitacion: string | null;
  fecha_confirmacion: string | null;
  fecha_visita_tecnica: string | null;
  fecha_consultas: string | null;
  fecha_abs_consultas: string | null;
  fecha_entrega: string | null;
  fecha_entregada: string | null;
  fecha_oc: string | null;
  tipo_servicio_id: string | null;
  tipo_servicio_nombre: string | null;
  prioridad: string | null;
  avance: number | null;
  observaciones: string | null;
  monto: number | null;
  flat_mensual: boolean | null;
  fecha_inicio_analisis: string | null;
  fecha_fin_analisis: string | null;
  meses_analisis: number | null;
  metadata: Record<string, unknown> | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

const QUOTATIONS_SELECT = `
  id,
  codigo,
  oc,
  cliente_id,
  cliente_nombre,
  proyecto,
  unidad_trabajo_id,
  unidad_trabajo_nombre,
  moneda_codigo,
  estado,
  estado_propuesta,
  solicitante,
  responsable_tecnico,
  responsable_economico,
  fecha_registro,
  fecha_presentacion,
  fecha_invitacion,
  fecha_confirmacion,
  fecha_visita_tecnica,
  fecha_consultas,
  fecha_abs_consultas,
  fecha_entrega,
  fecha_entregada,
  fecha_oc,
  tipo_servicio_id,
  tipo_servicio_nombre,
  prioridad,
  avance,
  observaciones,
  monto,
  flat_mensual,
  fecha_inicio_analisis,
  fecha_fin_analisis,
  meses_analisis,
  metadata,
  deleted_at,
  created_at,
  updated_at,
  created_by,
  updated_by
`;
const MAX_CLIENT_COTIZACIONES_ROWS = 300;

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function mapEstado(value: string): Cotizacion["estado"] {
  const normalized = value.trim().toLowerCase();

  if (normalized === "borrador") return "Borrador";
  if (normalized === "en revisión" || normalized === "en revision") return "En revisión";
  if (normalized === "no participa") return "No participa";
  if (normalized === "elaboración de cotización" || normalized === "elaboracion de cotizacion") {
    return "Elaboración de cotización";
  }
  if (normalized === "vb gerencia") return "VB Gerencia";
  if (normalized === "aprobada para envío" || normalized === "aprobada para envio") {
    return "Aprobada para envío";
  }
  if (normalized === "enviada") return "Enviada";
  if (normalized === "ganada") return "Ganada";
  if (
    normalized === "perdida / no adjudicada" ||
    normalized === "perdida" ||
    normalized === "no adjudicada"
  ) {
    return "Perdida / No adjudicada";
  }

  // Estados históricos. Se preservan, pero no habilitan creación de RQ.
  if (normalized === "pendiente") return "Pendiente";
  if (normalized === "adjudicado") return "Adjudicado";
  if (normalized === "cancelado") return "Cancelado";
  if (normalized === "no adjudicado") return "No adjudicado";

  return "Borrador";
}

function mapPrioridad(value: string): Cotizacion["prioridad"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "alta") return "Alta";
  if (normalized === "baja") return "Baja";
  return "Media";
}

function toIsoDate(value: string | null | undefined): string {
  return normalizeString(value);
}

function toNullableString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function toDateOrNull(value: string | null | undefined): string | null {
  const normalized = normalizeString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function serializeSupabaseError(error: unknown): SerializedSupabaseError {
  const rawKeys = error && typeof error === "object" ? Object.keys(error) : [];
  let rawStringified: string | undefined;

  try {
    rawStringified = JSON.stringify(error);
  } catch {
    rawStringified = undefined;
  }

  if (error instanceof Error) {
    const errorRecord = error as Error & {
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      status?: unknown;
    };
    return {
      message: error.message || "Error Supabase sin mensaje.",
      code: typeof errorRecord.code === "string" ? errorRecord.code : undefined,
      details: typeof errorRecord.details === "string" ? errorRecord.details : undefined,
      hint: typeof errorRecord.hint === "string" ? errorRecord.hint : undefined,
      status: typeof errorRecord.status === "number" ? errorRecord.status : undefined,
      name: error.name,
      rawKeys,
      rawStringified,
    };
  }

  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    return {
      message:
        typeof errorRecord.message === "string" && errorRecord.message.trim()
          ? errorRecord.message
          : rawStringified && rawStringified !== "{}"
            ? rawStringified
            : "Error Supabase sin mensaje legible.",
      code: typeof errorRecord.code === "string" ? errorRecord.code : undefined,
      details: typeof errorRecord.details === "string" ? errorRecord.details : undefined,
      hint: typeof errorRecord.hint === "string" ? errorRecord.hint : undefined,
      status: typeof errorRecord.status === "number" ? errorRecord.status : undefined,
      name: typeof errorRecord.name === "string" ? errorRecord.name : undefined,
      rawKeys,
      rawStringified,
    };
  }

  return {
    message: typeof error === "string" && error.trim() ? error : "Error Supabase desconocido.",
    rawKeys,
    rawStringified,
  };
}

function formatSerializedSupabaseError(error: SerializedSupabaseError): string {
  const details = [
    error.code ? `code=${error.code}` : null,
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null,
    typeof error.status === "number" ? `status=${error.status}` : null,
  ].filter(Boolean);

  return details.length > 0 ? `${error.message} (${details.join("; ")})` : error.message;
}

function removeUndefinedValues<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T;
}

function readEconomicSummaryFromMetadata(metadata: Record<string, unknown> | null): Cotizacion["resumen_economico"] {
  const raw = metadata?.resumen_economico;
  if (!Array.isArray(raw)) return [];
  const summary: Cotizacion["resumen_economico"] = [];
  raw.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const tipoRecurso = normalizeString(record.tipo_recurso);
    if (!tipoRecurso) return;
    summary.push({
      tipo_recurso: tipoRecurso,
      base: toFiniteNumber(record.base, 0),
      oferta: toFiniteNumber(record.oferta, 0),
      margen_ofertado_manual:
        record.margen_ofertado_manual === null || record.margen_ofertado_manual === undefined
          ? null
          : toFiniteNumber(record.margen_ofertado_manual, 0),
    });
  });
  return summary;
}

function mapSupabaseCotizacion(row: SupabaseCotizacion): CotizacionWithSupabaseMetadata {
  const quality = readHistoricalImportQuality(row.metadata);
  return {
    id: row.id,
    codigo: row.codigo,
    oc: normalizeString(row.oc),
    cliente: normalizeString(row.cliente_nombre),
    proyecto: normalizeString(row.proyecto),
    unidad_trabajo: normalizeString(row.unidad_trabajo_nombre),
    moneda_cotizacion: normalizeString(row.moneda_codigo).toUpperCase() === "USD" ? "USD" : "PEN",
    estado: mapEstado(normalizeString(row.estado)),
    estado_propuesta: normalizeString(row.estado_propuesta),
    solicitante: normalizeString(row.solicitante),
    responsable_tecnico: normalizeString(row.responsable_tecnico),
    responsable_economico: normalizeString(row.responsable_economico),
    fecha_registro: toIsoDate(row.fecha_registro),
    fecha_presentacion: toIsoDate(row.fecha_presentacion),
    fecha_invitacion: toIsoDate(row.fecha_invitacion),
    fecha_confirmacion: toIsoDate(row.fecha_confirmacion),
    fecha_visita_tecnica: toIsoDate(row.fecha_visita_tecnica),
    fecha_consultas: toIsoDate(row.fecha_consultas),
    fecha_abs_consultas: toIsoDate(row.fecha_abs_consultas),
    fecha_entrega: toIsoDate(row.fecha_entrega),
    fecha_entregada: toIsoDate(row.fecha_entregada),
    fecha_oc: toIsoDate(row.fecha_oc),
    tipo_servicio: normalizeString(row.tipo_servicio_nombre),
    prioridad: mapPrioridad(normalizeString(row.prioridad)),
    avance: Number(row.avance ?? 0),
    observaciones: normalizeString(row.observaciones),
    resumen_economico: readEconomicSummaryFromMetadata(row.metadata),
    monto: Number(row.monto ?? 0),
    flat_mensual: Boolean(row.flat_mensual),
    fecha_inicio_analisis: toIsoDate(row.fecha_inicio_analisis),
    fecha_fin_analisis: toIsoDate(row.fecha_fin_analisis),
    meses_analisis:
      typeof row.meses_analisis === "number" && Number.isFinite(row.meses_analisis) ? row.meses_analisis : null,
    metadata: row.metadata,
    historical_import_quality: quality ?? undefined,
  };
}

function buildDraftFields(row: Cotizacion): Record<string, unknown> {
  return {
    fecha_invitacion: toNullableString(row.fecha_invitacion),
    fecha_confirmacion: toNullableString(row.fecha_confirmacion),
    fecha_visita_tecnica: toNullableString(row.fecha_visita_tecnica),
    fecha_consultas: toNullableString(row.fecha_consultas),
    fecha_abs_consultas: toNullableString(row.fecha_abs_consultas),
    fecha_entregada: toNullableString(row.fecha_entregada),
    fecha_oc: toNullableString(row.fecha_oc),
    flat_mensual: Boolean(row.flat_mensual),
    fecha_inicio_analisis: toNullableString(row.fecha_inicio_analisis),
    fecha_fin_analisis: toNullableString(row.fecha_fin_analisis),
    meses_analisis: row.meses_analisis ?? null,
  };
}

function buildWritableCotizacionFields(row: Cotizacion) {
  const codigo = normalizeString(row.codigo);
  const proyecto = normalizeString(row.proyecto);

  if (!codigo || !proyecto) {
    throw new CreateCotizacionError("Código y proyecto son obligatorios para crear una cotización.", "missing_required_fields");
  }

  return {
    codigo,
    oc: toNullableString(row.oc),
    cliente_nombre: toNullableString(row.cliente),
    proyecto,
    unidad_trabajo_nombre: toNullableString(row.unidad_trabajo),
    moneda_codigo: row.moneda_cotizacion === "USD" ? "USD" : "PEN",
    estado: toNullableString(row.estado) ?? "Borrador",
    estado_propuesta: toNullableString(row.estado_propuesta),
    solicitante: toNullableString(row.solicitante),
    responsable_tecnico: toNullableString(row.responsable_tecnico),
    responsable_economico: toNullableString(row.responsable_economico),
    fecha_registro: toDateOrNull(row.fecha_registro),
    fecha_presentacion: toDateOrNull(row.fecha_presentacion),
    fecha_invitacion: toDateOrNull(row.fecha_invitacion),
    fecha_confirmacion: toDateOrNull(row.fecha_confirmacion),
    fecha_visita_tecnica: toDateOrNull(row.fecha_visita_tecnica),
    fecha_consultas: toDateOrNull(row.fecha_consultas),
    fecha_abs_consultas: toDateOrNull(row.fecha_abs_consultas),
    fecha_entrega: toDateOrNull(row.fecha_entrega),
    fecha_entregada: toDateOrNull(row.fecha_entregada),
    fecha_oc: toDateOrNull(row.fecha_oc),
    tipo_servicio_nombre: toNullableString(row.tipo_servicio),
    prioridad: toNullableString(row.prioridad),
    avance: toFiniteNumber(row.avance, 0),
    observaciones: toNullableString(row.observaciones),
    monto: toFiniteNumber(row.monto, 0),
    flat_mensual: Boolean(row.flat_mensual),
    fecha_inicio_analisis: toDateOrNull(row.fecha_inicio_analisis),
    fecha_fin_analisis: toDateOrNull(row.fecha_fin_analisis),
    meses_analisis: row.meses_analisis ?? null,
  };
}

function buildCreateCotizacionPayload(row: Cotizacion, options: CreateCotizacionOptions = {}) {
  const writableFields = buildWritableCotizacionFields(row);
  const initialMetadata = /^COT-EKA-\d{4}-\d{3}$/i.test(writableFields.codigo)
    ? {
        codigo_madre: writableFields.codigo,
        revision_actual: "REV00",
        estructura_documental_version: "cotizacion_drive_v2",
        documentos_principales: ["PT", "PE", "CRO", "ORG", "HGR", "ANEXOS"],
        carpetas_base: [
          "00_CONTROL",
          "01_DOCUMENTOS_CLIENTE",
          "02_PROPUESTA",
          "03_REQUERIMIENTOS",
          "04_COTIZACIONES_PROVEEDORES",
          "05_ANALISIS_Y_COSTOS",
          "06_REVISION_GERENCIA",
          "07_ENVIO_CLIENTE",
          "99_ARCHIVO",
        ],
      }
    : {};

  return {
    ...writableFields,
    estado: "Borrador",
    responsable_tecnico: toNullableString(row.responsable_tecnico || options.userEmail),
    fecha_registro: toDateOrNull(row.fecha_registro) ?? new Date().toISOString().slice(0, 10),
    avance: 0,
    metadata: {
      app_source: "sgp-lite",
      created_from: "cotizaciones_module",
      created_by_email: toNullableString(options.userEmail),
      initial_status: "Borrador",
      ...initialMetadata,
      resumen_economico: normalizeCotizacionEconomicSummary(row),
      draft_fields: buildDraftFields(row),
    },
  };
}

async function createQuotationDriveMetadata(quotationCode: string): Promise<Record<string, unknown>> {
  const response = await authFetch("/api/drive/quotation-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quotationCode }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    drive?: Record<string, unknown>;
    error?: string;
  };

  if (!response.ok || !result.drive) {
    throw new CreateCotizacionError(
      result.error ?? "No se pudo crear la estructura documental en Google Drive.",
      "drive_error",
    );
  }

  return result.drive;
}

function buildUpdateCotizacionPayload(
  row: Cotizacion,
  existingMetadata: Record<string, unknown> | null,
  options: UpdateCotizacionOptions = {},
) {
  const writableFields = buildWritableCotizacionFields(row);
  const metadata = existingMetadata ?? {};
  return {
    ...writableFields,
    updated_at: new Date().toISOString(),
    metadata: {
      ...metadata,
      app_source: normalizeString(metadata.app_source) || "sgp-lite",
      updated_from: "cotizaciones_workspace",
      updated_by_email: toNullableString(options.userEmail),
      resumen_economico: normalizeCotizacionEconomicSummary(row),
    },
  };
}

async function fetchAllCotizaciones(): Promise<{ rows: SupabaseCotizacion[]; truncated: boolean }> {
  const batchSize = 1000;
  let from = 0;
  const rows: SupabaseCotizacion[] = [];

  while (rows.length < MAX_CLIENT_COTIZACIONES_ROWS) {
    const to = Math.min(from + batchSize - 1, MAX_CLIENT_COTIZACIONES_ROWS - 1);
    const { data, error } = await supabase
      .from("cotizaciones")
      .select(QUOTATIONS_SELECT)
      .order("codigo", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const chunk = (data ?? []) as SupabaseCotizacion[];
    rows.push(...chunk);
    if (chunk.length < batchSize) break;
    from += batchSize;
  }

  return { rows, truncated: rows.length >= MAX_CLIENT_COTIZACIONES_ROWS };
}

export async function createCotizacion(
  row: Cotizacion,
  options: CreateCotizacionOptions = {},
): Promise<CotizacionWithSupabaseMetadata> {
  if (!hasSupabaseConfig()) {
    throw new CreateCotizacionError("Supabase no está configurado para crear cotizaciones reales.", "supabase_error");
  }

  const payload = buildCreateCotizacionPayload(row, options);

  const { data: existing, error: duplicateCheckError } = await supabase
    .from("cotizaciones")
    .select("id")
    .eq("codigo", payload.codigo)
    .maybeSingle();

  if (duplicateCheckError) {
    throw new CreateCotizacionError(
      `No se pudo validar si el código ya existe: ${duplicateCheckError.message}`,
      "supabase_error",
    );
  }

  if (existing) {
    throw new CreateCotizacionError(`Ya existe una cotización con el código ${payload.codigo}.`, "duplicate_code");
  }

  const googleDriveMetadata = await createQuotationDriveMetadata(payload.codigo);
  const payloadWithDriveMetadata = {
    ...payload,
    metadata: {
      ...payload.metadata,
      google_drive: googleDriveMetadata,
    },
  };

  const { data, error } = await supabase
    .from("cotizaciones")
    .insert(payloadWithDriveMetadata)
    .select(QUOTATIONS_SELECT)
    .single();

  if (error) {
    const isDuplicate = error.code === "23505" || error.message.toLowerCase().includes("duplicate");
    throw new CreateCotizacionError(
      isDuplicate ? `Ya existe una cotización con el código ${payload.codigo}.` : error.message,
      isDuplicate ? "duplicate_code" : "supabase_error",
    );
  }

  return mapSupabaseCotizacion(data as SupabaseCotizacion);
}

export async function updateCotizacion(
  id: string,
  row: Cotizacion,
  options: UpdateCotizacionOptions = {},
): Promise<CotizacionWithSupabaseMetadata> {
  if (!hasSupabaseConfig()) {
    throw new UpdateCotizacionError("Supabase no está configurado para guardar cotizaciones reales.", "supabase_error");
  }

  const normalizedId = normalizeString(id);
  if (!normalizedId) {
    throw new UpdateCotizacionError("No se encontró el ID de la cotización a guardar.", "missing_required_fields");
  }

  const codigo = normalizeString(row.codigo);
  const proyecto = normalizeString(row.proyecto);
  if (!codigo || !proyecto) {
    throw new UpdateCotizacionError("Código y proyecto son obligatorios para guardar la cotización.", "missing_required_fields");
  }

  const { data: current, error: currentError } = await supabase
    .from("cotizaciones")
    .select("id,codigo,metadata")
    .eq("id", normalizedId)
    .maybeSingle();

  if (currentError) {
    const serializedError = serializeSupabaseError(currentError);
    if (process.env.NODE_ENV === "development") {
      console.error("[quotationsRepository] updateCotizacion current row error", {
        id: normalizedId,
        codigo,
        error: serializedError,
      });
    }
    throw new UpdateCotizacionError(
      `No se pudo leer la cotización actual: ${formatSerializedSupabaseError(serializedError)}`,
      "supabase_error",
    );
  }

  if (!current) {
    throw new UpdateCotizacionError("No se encontró la cotización a guardar.", "not_found");
  }

  const currentRow = current as { id: string; codigo: string | null; metadata: Record<string, unknown> | null };
  if (normalizeString(currentRow.codigo).toLowerCase() !== codigo.toLowerCase()) {
    const { data: duplicate, error: duplicateCheckError } = await supabase
      .from("cotizaciones")
      .select("id")
      .eq("codigo", codigo)
      .neq("id", normalizedId)
      .maybeSingle();

    if (duplicateCheckError) {
      const serializedError = serializeSupabaseError(duplicateCheckError);
      if (process.env.NODE_ENV === "development") {
        console.error("[quotationsRepository] updateCotizacion duplicate check error", {
          id: normalizedId,
          codigo,
          error: serializedError,
        });
      }
      throw new UpdateCotizacionError(
        `No se pudo validar si el código ya existe: ${formatSerializedSupabaseError(serializedError)}`,
        "supabase_error",
      );
    }

    if (duplicate) {
      throw new UpdateCotizacionError(`Ya existe una cotización con el código ${codigo}.`, "duplicate_code");
    }
  }

  const payload = removeUndefinedValues(buildUpdateCotizacionPayload(row, currentRow.metadata, options));
  if (process.env.NODE_ENV === "development") {
    console.debug("[quotationsRepository] updateCotizacion payload", {
      id: normalizedId,
      codigo,
      payloadKeys: Object.keys(payload),
      payload,
    });
  }

  const { data, error } = await supabase
    .from("cotizaciones")
    .update(payload)
    .eq("id", normalizedId)
    .select(QUOTATIONS_SELECT)
    .single();

  if (error) {
    const serializedError = serializeSupabaseError(error);
    if (process.env.NODE_ENV === "development") {
      console.error("[quotationsRepository] updateCotizacion error", {
        id: normalizedId,
        codigo,
        payloadKeys: Object.keys(payload),
        payload,
        error: serializedError,
      });
    }
    const isDuplicate =
      serializedError.code === "23505" || serializedError.message.toLowerCase().includes("duplicate");
    throw new UpdateCotizacionError(
      isDuplicate
        ? `Ya existe una cotización con el código ${codigo}.`
        : `Supabase rechazó el guardado de la cotización: ${formatSerializedSupabaseError(serializedError)}`,
      isDuplicate ? "duplicate_code" : "supabase_error",
    );
  }

  if (!data) {
    throw new UpdateCotizacionError("Supabase no devolvió la fila actualizada de la cotización.", "supabase_error");
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[quotationsRepository] updateCotizacion returned row", {
      id: normalizedId,
      codigo,
      row: data,
    });
  }

  return mapSupabaseCotizacion(data as SupabaseCotizacion);
}

export async function listCotizaciones(): Promise<QuotationsListResult> {
  if (!hasSupabaseConfig()) {
    const rows = demoData.listCotizaciones();
    return {
      rows,
      total: rows.length,
      source: "demo",
      warning: "No se encontraron variables públicas de Supabase; se usa data demo local.",
    };
  }

  try {
    const { rows: data, truncated } = await fetchAllCotizaciones();
    const rows = data.map(mapSupabaseCotizacion);
    return {
      rows,
      total: rows.length,
      source: "supabase",
      warning: truncated
        ? `Lectura limitada a ${MAX_CLIENT_COTIZACIONES_ROWS} cotizaciones para proteger egress. Usa filtros/búsqueda para cargas grandes.`
        : undefined,
    };
  } catch (error) {
    const rows = demoData.listCotizaciones();
    return {
      rows,
      total: rows.length,
      source: "demo",
      warning:
        error instanceof Error
          ? `No se pudo leer public.cotizaciones desde Supabase: ${error.message}. Se usa data demo local.`
          : "No se pudo leer public.cotizaciones desde Supabase. Se usa data demo local.",
    };
  }
}
