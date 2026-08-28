import { supabase } from "@/lib/sgp/supabaseClient";
import {
  buildBudgetEconomicSummaryRows,
  computeBudgetEconomics,
  type BudgetEconomicSummary,
  type BudgetNumericInput,
  type BudgetResourceEconomicInput,
  toBudgetNumber,
} from "@/lib/sgp/quotationBudgetEconomics";
import type { CotizacionEconomicRow } from "@/lib/sgp/demoData";

export type EstadoPresupuestoCotizacion = "BORRADOR" | "LISTO_PARA_ADJUDICAR" | "ADJUDICADO";
export type TipoNodoPresupuestoCotizacion = "CAPITULO" | "SUBCAPITULO" | "PARTIDA" | "GRUPO_RECURSOS";
export type MonedaPresupuestoCotizacion = "PEN" | "USD";

export type QuotationBudgetActor = {
  id: string;
  email: string | null;
  fullName: string | null;
};

export type QuotationBudget = {
  id: string;
  cotizacionId: string;
  propuestaTecnicaId: string | null;
  revision: number;
  estado: EstadoPresupuestoCotizacion;
  monedaCodigo: MonedaPresupuestoCotizacion;
  creadoPorUserId: string;
  creadoAt: string;
  actualizadoAt: string;
  creadoPor: QuotationBudgetActor | null;
};

export type QuotationBudgetNode = {
  id: string;
  presupuestoId: string;
  parentId: string | null;
  codigo: string | null;
  tipo: TipoNodoPresupuestoCotizacion;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  orden: number;
  observaciones: string | null;
  propuestaTecnicaItemId: string | null;
  creadoAt: string;
  actualizadoAt: string;
};

export type BudgetResourceCatalogData = {
  id: string;
  codigoRecurso: string;
  descripcion: string;
  tipoRecurso: string | null;
  unidad: string | null;
  precioUnitarioRef: number;
  monedaCodigo: MonedaPresupuestoCotizacion;
  estado: string | null;
};

export type QuotationBudgetResource = {
  id: string;
  partidaId: string;
  recursoId: string;
  cantidadPresupuestada: number;
  precioBaseUnitario: number;
  precioOfertadoUnitario: number;
  orden: number;
  observaciones: string | null;
  propuestaTecnicaRecursoId: string | null;
  precioBaseOrigen: "MAESTRO" | "HISTORICO" | "NUEVO_PRECIO" | "MANUAL";
  precioHistoricoId: string | null;
  precioRevisado: boolean;
  precioRevisadoAt: string | null;
  precioRevisadoPor: string | null;
  precioRevisadoNota: string | null;
  codigoRecursoSnapshot: string | null;
  codigoFabricanteSnapshot: string | null;
  descripcionSnapshot: string | null;
  tipoRecursoSnapshot: string | null;
  unidadSnapshot: string | null;
  precioUnitarioRefSnapshot: number | null;
  monedaCodigoSnapshot: MonedaPresupuestoCotizacion | null;
  proveedorSnapshot: string | null;
  marcaSnapshot: string | null;
  creadoAt: string;
  actualizadoAt: string;
  recurso: BudgetResourceCatalogData | null;
};

export type ResourcePriceHistorySource = "COTIZACION_PROVEEDOR" | "WEB" | "OC_HISTORICA" | "COMPRA_HISTORICA" | "MANUAL" | "OTRO";

export type ResourcePriceHistory = {
  id: string;
  recursoId: string;
  precioUnitario: number;
  monedaCodigo: MonedaPresupuestoCotizacion;
  fechaPrecio: string;
  proveedorId: string | null;
  proveedorSnapshot: string | null;
  fuenteTipo: ResourcePriceHistorySource;
  fuenteReferencia: string | null;
  documentoSoporteUrl: string | null;
  cotizacionId: string | null;
  presupuestoId: string | null;
  observaciones: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type QuotationBudgetDetail = {
  presupuesto: QuotationBudget;
  partidas: QuotationBudgetNode[];
  recursos: QuotationBudgetResource[];
  economia: BudgetEconomicSummary;
  resumenEconomicoCompatible: CotizacionEconomicRow[];
};

export type CreateQuotationBudgetInput = {
  cotizacionId: string;
  monedaCodigo?: MonedaPresupuestoCotizacion;
};

export type CreateBudgetNodeInput = {
  presupuestoId: string;
  parentId?: string | null;
  codigo?: string | null;
  tipo: TipoNodoPresupuestoCotizacion;
  descripcion: string;
  unidad?: string | null;
  cantidad?: BudgetNumericInput;
  orden?: number;
  observaciones?: string | null;
};

export type UpdateBudgetNodeInput = Partial<Omit<CreateBudgetNodeInput, "presupuestoId">>;

export type AddBudgetResourceInput = {
  partidaId: string;
  recursoId: string;
  cantidadPresupuestada: BudgetNumericInput;
  precioBaseUnitario: BudgetNumericInput;
  precioOfertadoUnitario: BudgetNumericInput;
  orden?: number;
  observaciones?: string | null;
};

export type UpdateBudgetResourceInput = Partial<Omit<AddBudgetResourceInput, "partidaId" | "recursoId">> & {
  recursoId?: string;
};

export type ApplyBudgetResourcePriceReviewAction = "MANTENER" | "MAESTRO" | "HISTORICO" | "NUEVO_PRECIO";

export type ApplyBudgetResourcePriceReviewInput = {
  presupuestoId: string;
  recursoId: string;
  accion: ApplyBudgetResourcePriceReviewAction;
  precioHistoricoId?: string | null;
  precioUnitario?: BudgetNumericInput | null;
  monedaCodigo?: MonedaPresupuestoCotizacion | null;
  fechaPrecio?: string | null;
  proveedorId?: string | null;
  proveedorSnapshot?: string | null;
  fuenteTipo?: ResourcePriceHistorySource | null;
  fuenteReferencia?: string | null;
  documentoSoporteUrl?: string | null;
  observaciones?: string | null;
  manualOfferOverrideResourceIds?: string[];
};

export type ApplyBudgetResourcePriceReviewResult = {
  precioHistoricoId: string | null;
  filasActualizadas: number;
  precioBaseUnitario: number | null;
  precioBaseOrigen: QuotationBudgetResource["precioBaseOrigen"];
};

export class QuotationBudgetRepositoryError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "supabase_not_configured"
      | "missing_required_fields"
      | "not_found"
      | "budget_awarded"
      | "budget_already_awarded"
      | "invalid_state"
      | "invalid_structure"
      | "invalid_resource"
      | "duplicate_revision"
      | "rls_denied"
      | "schema_error"
      | "technical_proposal_not_importable"
      | "supabase_error",
    public readonly technicalDetails?: SerializedSupabaseError,
  ) {
    super(message);
    this.name = "QuotationBudgetRepositoryError";
  }
}

type SupabaseBudgetRow = {
  id: string;
  cotizacion_id: string;
  propuesta_tecnica_id?: string | null;
  revision: number | string;
  estado: string;
  moneda_codigo: string;
  creado_por_user_id: string;
  creado_at: string;
  actualizado_at: string;
  user_profiles?: SupabaseUserProfileRow | SupabaseUserProfileRow[] | null;
};

type SupabaseBudgetNodeRow = {
  id: string;
  presupuesto_id: string;
  parent_id: string | null;
  codigo: string | null;
  tipo: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number | string | null;
  orden: number | string | null;
  observaciones: string | null;
  propuesta_tecnica_item_id?: string | null;
  creado_at: string;
  actualizado_at: string;
};

type SupabaseBudgetResourceRow = {
  id: string;
  partida_id: string;
  recurso_id: string;
  cantidad_presupuestada: number | string;
  precio_base_unitario: number | string;
  precio_ofertado_unitario: number | string;
  orden: number | string | null;
  observaciones: string | null;
  propuesta_tecnica_recurso_id?: string | null;
  precio_base_origen?: string | null;
  precio_historico_id?: string | null;
  precio_revisado?: boolean | null;
  precio_revisado_at?: string | null;
  precio_revisado_por?: string | null;
  precio_revisado_nota?: string | null;
  codigo_recurso_snapshot?: string | null;
  codigo_fabricante_snapshot?: string | null;
  descripcion_snapshot?: string | null;
  tipo_recurso_snapshot?: string | null;
  unidad_snapshot?: string | null;
  precio_unitario_ref_snapshot?: number | string | null;
  moneda_codigo_snapshot?: string | null;
  proveedor_snapshot?: string | null;
  marca_snapshot?: string | null;
  creado_at: string;
  actualizado_at: string;
  recursos?: SupabaseResourceCatalogRow | SupabaseResourceCatalogRow[] | null;
};

type SupabaseResourceCatalogRow = {
  id: string;
  codigo_recurso: string;
  descripcion: string;
  tipo_recurso_nombre: string | null;
  unidad_codigo: string | null;
  precio_unitario_ref: number | string | null;
  moneda_codigo: string | null;
  estado: string | null;
};

type SupabaseResourceSnapshotRow = {
  codigo_recurso: string | null;
  codigo_fabricante: string | null;
  descripcion: string | null;
  tipo_recurso_nombre: string | null;
  unidad_codigo: string | null;
  precio_unitario_ref: number | string | null;
  moneda_codigo: string | null;
  proveedor_nombre: string | null;
  marca_nombre: string | null;
};

type BudgetResourceSnapshotPayload = {
  codigo_recurso_snapshot: string | null;
  codigo_fabricante_snapshot: string | null;
  descripcion_snapshot: string | null;
  tipo_recurso_snapshot: string | null;
  unidad_snapshot: string | null;
  precio_unitario_ref_snapshot: number | null;
  moneda_codigo_snapshot: MonedaPresupuestoCotizacion | null;
  proveedor_snapshot: string | null;
  marca_snapshot: string | null;
};

type SupabaseResourcePriceHistoryRow = {
  id: string;
  recurso_id: string;
  precio_unitario: number | string;
  moneda_codigo: string | null;
  fecha_precio: string;
  proveedor_id: string | null;
  proveedor_snapshot: string | null;
  fuente_tipo: string | null;
  fuente_referencia: string | null;
  documento_soporte_url: string | null;
  cotizacion_id: string | null;
  presupuesto_id: string | null;
  observaciones: string | null;
  created_by: string | null;
  created_at: string;
};

type SupabaseApplyPriceReviewRow = {
  precio_historico_id: string | null;
  filas_actualizadas: number | string | null;
  precio_base_unitario: number | string | null;
  precio_base_origen: string | null;
};

type SupabaseUserProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type SupabaseQuotationMetadataRow = {
  id: string;
  metadata?: Record<string, unknown> | null;
};

type SerializedSupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
};

const BUDGET_SELECT = `
  id,
  cotizacion_id,
  propuesta_tecnica_id,
  revision,
  estado,
  moneda_codigo,
  creado_por_user_id,
  creado_at,
  actualizado_at,
  user_profiles:creado_por_user_id (
    id,
    email,
    full_name
  )
`;

const NODE_SELECT = `
  id,
  presupuesto_id,
  parent_id,
  codigo,
  tipo,
  descripcion,
  unidad,
  cantidad,
  orden,
  observaciones,
  propuesta_tecnica_item_id,
  creado_at,
  actualizado_at
`;

const RESOURCE_SELECT = `
  id,
  partida_id,
  recurso_id,
  cantidad_presupuestada,
  precio_base_unitario,
  precio_ofertado_unitario,
  orden,
  observaciones,
  propuesta_tecnica_recurso_id,
  precio_base_origen,
  precio_historico_id,
  precio_revisado,
  precio_revisado_at,
  precio_revisado_por,
  precio_revisado_nota,
  codigo_recurso_snapshot,
  codigo_fabricante_snapshot,
  descripcion_snapshot,
  tipo_recurso_snapshot,
  unidad_snapshot,
  precio_unitario_ref_snapshot,
  moneda_codigo_snapshot,
  proveedor_snapshot,
  marca_snapshot,
  creado_at,
  actualizado_at,
  recursos:recurso_id (
    id,
    codigo_recurso,
    descripcion,
    tipo_recurso_nombre,
    unidad_codigo,
    precio_unitario_ref,
    moneda_codigo,
    estado
  )
`;

const RESOURCE_PRICE_HISTORY_SELECT = `
  id,
  recurso_id,
  precio_unitario,
  moneda_codigo,
  fecha_precio,
  proveedor_id,
  proveedor_snapshot,
  fuente_tipo,
  fuente_referencia,
  documento_soporte_url,
  cotizacion_id,
  presupuesto_id,
  observaciones,
  created_by,
  created_at
`;

const RESOURCE_SNAPSHOT_SELECT = `
  codigo_recurso,
  codigo_fabricante,
  descripcion,
  tipo_recurso_nombre,
  unidad_codigo,
  precio_unitario_ref,
  moneda_codigo,
  proveedor_nombre,
  marca_nombre
`;

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function assertSupabaseConfigured(): void {
  if (!hasSupabaseConfig()) {
    throw new QuotationBudgetRepositoryError(
      "Supabase no está configurado para operar presupuestos detallados.",
      "supabase_not_configured",
    );
  }
}

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function nullableString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized || null;
}

function removeUndefinedValues<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T;
}

function serializeSupabaseError(error: unknown): SerializedSupabaseError {
  if (!error || typeof error !== "object") return { message: String(error) };
  const values = error as Record<string, unknown>;
  return {
    message: typeof values.message === "string" ? values.message : "Error de Supabase.",
    code: typeof values.code === "string" ? values.code : undefined,
    details: typeof values.details === "string" ? values.details : undefined,
    hint: typeof values.hint === "string" ? values.hint : undefined,
    status: typeof values.status === "number" ? values.status : undefined,
  };
}

function mapSupabaseError(error: unknown, fallbackMessage: string): QuotationBudgetRepositoryError {
  const serialized = serializeSupabaseError(error);
  const message = serialized.message.toLowerCase();

  if (serialized.code === "23505") {
    return new QuotationBudgetRepositoryError(
      "Ya existe una revisión de presupuesto con ese número.",
      "duplicate_revision",
      serialized,
    );
  }
  if (serialized.code === "23503") {
    return new QuotationBudgetRepositoryError(
      "La cotización, partida o recurso referenciado no existe.",
      "invalid_resource",
      serialized,
    );
  }
  if (serialized.code === "23514") {
    return new QuotationBudgetRepositoryError(
      `El dato económico o estructural no cumple las restricciones: ${serialized.message}`,
      "invalid_resource",
      serialized,
    );
  }
  if (serialized.code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
    return new QuotationBudgetRepositoryError("Supabase rechazó la operación por permisos RLS.", "rls_denied", serialized);
  }
  if (serialized.code === "42703" || message.includes("column") || message.includes("schema cache")) {
    return new QuotationBudgetRepositoryError(
      `Supabase rechazó la consulta por desalineación de esquema: ${serialized.message}`,
      "schema_error",
      serialized,
    );
  }
  if (message.includes("adjudicado")) {
    return new QuotationBudgetRepositoryError("No se puede modificar un presupuesto adjudicado.", "budget_awarded", serialized);
  }
  if (
    message.includes("propuesta tecnica") ||
    message.includes("pt contiene") ||
    message.includes("pt debe") ||
    message.includes("catalogo maestro") ||
    message.includes("revision pt")
  ) {
    return new QuotationBudgetRepositoryError(serialized.message, "technical_proposal_not_importable", serialized);
  }
  if (message.includes("estructura valida") || message.includes("partida") || message.includes("jerarquia")) {
    return new QuotationBudgetRepositoryError(serialized.message, "invalid_structure", serialized);
  }
  if (message.includes("transicion")) {
    return new QuotationBudgetRepositoryError(serialized.message, "invalid_state", serialized);
  }

  return new QuotationBudgetRepositoryError(`${fallbackMessage}: ${serialized.message}`, "supabase_error", serialized);
}

function assertId(value: unknown, label: string): string {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new QuotationBudgetRepositoryError(`${label} es obligatorio.`, "missing_required_fields");
  }
  return normalized;
}

function normalizeBudgetState(value: string): EstadoPresupuestoCotizacion {
  if (value === "BORRADOR" || value === "LISTO_PARA_ADJUDICAR" || value === "ADJUDICADO") return value;
  throw new QuotationBudgetRepositoryError(`Estado de presupuesto no reconocido: ${value}.`, "invalid_state");
}

function normalizeNodeType(value: string): TipoNodoPresupuestoCotizacion {
  if (value === "CAPITULO" || value === "SUBCAPITULO" || value === "PARTIDA" || value === "GRUPO_RECURSOS") return value;
  throw new QuotationBudgetRepositoryError(`Tipo de nodo de presupuesto no reconocido: ${value}.`, "invalid_structure");
}

function normalizeCurrency(value: string | null | undefined): MonedaPresupuestoCotizacion {
  return normalizeString(value).toUpperCase() === "USD" ? "USD" : "PEN";
}

function mapUserProfile(value: SupabaseUserProfileRow | SupabaseUserProfileRow[] | null | undefined): QuotationBudgetActor | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
  };
}

function mapBudget(row: SupabaseBudgetRow): QuotationBudget {
  return {
    id: row.id,
    cotizacionId: row.cotizacion_id,
    propuestaTecnicaId: row.propuesta_tecnica_id ?? null,
    revision: toBudgetNumber(row.revision),
    estado: normalizeBudgetState(row.estado),
    monedaCodigo: normalizeCurrency(row.moneda_codigo),
    creadoPorUserId: row.creado_por_user_id,
    creadoAt: row.creado_at,
    actualizadoAt: row.actualizado_at,
    creadoPor: mapUserProfile(row.user_profiles),
  };
}

function firstRpcRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function mapNode(row: SupabaseBudgetNodeRow): QuotationBudgetNode {
  return {
    id: row.id,
    presupuestoId: row.presupuesto_id,
    parentId: row.parent_id,
    codigo: row.codigo,
    tipo: normalizeNodeType(row.tipo),
    descripcion: row.descripcion,
    unidad: row.unidad,
    cantidad: row.cantidad === null ? null : toBudgetNumber(row.cantidad),
    orden: toBudgetNumber(row.orden),
    observaciones: row.observaciones,
    propuestaTecnicaItemId: row.propuesta_tecnica_item_id ?? null,
    creadoAt: row.creado_at,
    actualizadoAt: row.actualizado_at,
  };
}

function mapCatalogResource(value: SupabaseResourceCatalogRow | SupabaseResourceCatalogRow[] | null | undefined): BudgetResourceCatalogData | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row) return null;
  return {
    id: row.id,
    codigoRecurso: row.codigo_recurso,
    descripcion: row.descripcion,
    tipoRecurso: row.tipo_recurso_nombre,
    unidad: row.unidad_codigo,
    precioUnitarioRef: toBudgetNumber(row.precio_unitario_ref),
    monedaCodigo: normalizeCurrency(row.moneda_codigo),
    estado: row.estado,
  };
}

function mapResource(row: SupabaseBudgetResourceRow): QuotationBudgetResource {
  const precioBaseOrigen = String(row.precio_base_origen ?? "MANUAL").toUpperCase();
  return {
    id: row.id,
    partidaId: row.partida_id,
    recursoId: row.recurso_id,
    cantidadPresupuestada: toBudgetNumber(row.cantidad_presupuestada),
    precioBaseUnitario: toBudgetNumber(row.precio_base_unitario),
    precioOfertadoUnitario: toBudgetNumber(row.precio_ofertado_unitario),
    orden: toBudgetNumber(row.orden),
    observaciones: row.observaciones,
    propuestaTecnicaRecursoId: row.propuesta_tecnica_recurso_id ?? null,
    precioBaseOrigen:
      precioBaseOrigen === "MAESTRO" || precioBaseOrigen === "HISTORICO" || precioBaseOrigen === "NUEVO_PRECIO" || precioBaseOrigen === "MANUAL"
        ? precioBaseOrigen
        : "MANUAL",
    precioHistoricoId: row.precio_historico_id ?? null,
    precioRevisado: Boolean(row.precio_revisado),
    precioRevisadoAt: row.precio_revisado_at ?? null,
    precioRevisadoPor: row.precio_revisado_por ?? null,
    precioRevisadoNota: row.precio_revisado_nota ?? null,
    codigoRecursoSnapshot: row.codigo_recurso_snapshot ?? null,
    codigoFabricanteSnapshot: row.codigo_fabricante_snapshot ?? null,
    descripcionSnapshot: row.descripcion_snapshot ?? null,
    tipoRecursoSnapshot: row.tipo_recurso_snapshot ?? null,
    unidadSnapshot: row.unidad_snapshot ?? null,
    precioUnitarioRefSnapshot:
      row.precio_unitario_ref_snapshot === null || row.precio_unitario_ref_snapshot === undefined
        ? null
        : toBudgetNumber(row.precio_unitario_ref_snapshot),
    monedaCodigoSnapshot: row.moneda_codigo_snapshot ? normalizeCurrency(row.moneda_codigo_snapshot) : null,
    proveedorSnapshot: row.proveedor_snapshot ?? null,
    marcaSnapshot: row.marca_snapshot ?? null,
    creadoAt: row.creado_at,
    actualizadoAt: row.actualizado_at,
    recurso: mapCatalogResource(row.recursos),
  };
}

function mapResourcePriceHistory(row: SupabaseResourcePriceHistoryRow): ResourcePriceHistory {
  const fuenteTipo = String(row.fuente_tipo ?? "MANUAL").toUpperCase();
  return {
    id: row.id,
    recursoId: row.recurso_id,
    precioUnitario: toBudgetNumber(row.precio_unitario),
    monedaCodigo: normalizeCurrency(row.moneda_codigo),
    fechaPrecio: row.fecha_precio,
    proveedorId: row.proveedor_id,
    proveedorSnapshot: row.proveedor_snapshot,
    fuenteTipo:
      fuenteTipo === "COTIZACION_PROVEEDOR" ||
      fuenteTipo === "WEB" ||
      fuenteTipo === "OC_HISTORICA" ||
      fuenteTipo === "COMPRA_HISTORICA" ||
      fuenteTipo === "MANUAL" ||
      fuenteTipo === "OTRO"
        ? fuenteTipo
        : "MANUAL",
    fuenteReferencia: row.fuente_referencia,
    documentoSoporteUrl: row.documento_soporte_url,
    cotizacionId: row.cotizacion_id,
    presupuestoId: row.presupuesto_id,
    observaciones: row.observaciones,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapApplyPriceReviewResult(row: SupabaseApplyPriceReviewRow): ApplyBudgetResourcePriceReviewResult {
  const origin = String(row.precio_base_origen ?? "MANUAL").toUpperCase();
  return {
    precioHistoricoId: row.precio_historico_id,
    filasActualizadas: toBudgetNumber(row.filas_actualizadas),
    precioBaseUnitario: row.precio_base_unitario === null || row.precio_base_unitario === undefined ? null : toBudgetNumber(row.precio_base_unitario),
    precioBaseOrigen:
      origin === "MAESTRO" || origin === "HISTORICO" || origin === "NUEVO_PRECIO" || origin === "MANUAL" ? origin : "MANUAL",
  };
}

function resourceSnapshotPayloadFromRow(row: SupabaseResourceSnapshotRow | null | undefined): BudgetResourceSnapshotPayload {
  if (!row) {
    return {
      codigo_recurso_snapshot: null,
      codigo_fabricante_snapshot: null,
      descripcion_snapshot: null,
      tipo_recurso_snapshot: null,
      unidad_snapshot: null,
      precio_unitario_ref_snapshot: null,
      moneda_codigo_snapshot: null,
      proveedor_snapshot: null,
      marca_snapshot: null,
    };
  }

  return {
    codigo_recurso_snapshot: nullableString(row.codigo_recurso),
    codigo_fabricante_snapshot: nullableString(row.codigo_fabricante),
    descripcion_snapshot: nullableString(row.descripcion),
    tipo_recurso_snapshot: nullableString(row.tipo_recurso_nombre),
    unidad_snapshot: nullableString(row.unidad_codigo),
    precio_unitario_ref_snapshot:
      row.precio_unitario_ref === null || row.precio_unitario_ref === undefined ? null : toBudgetNumber(row.precio_unitario_ref),
    moneda_codigo_snapshot: row.moneda_codigo ? normalizeCurrency(row.moneda_codigo) : null,
    proveedor_snapshot: nullableString(row.proveedor_nombre),
    marca_snapshot: nullableString(row.marca_nombre),
  };
}

async function readCatalogResourceSnapshot(recursoId: string): Promise<BudgetResourceSnapshotPayload> {
  const { data, error } = await supabase
    .from("recursos")
    .select(RESOURCE_SNAPSHOT_SELECT)
    .eq("id", recursoId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw mapSupabaseError(error, "No se pudo snapshotear el recurso maestro");
  if (!data) throw new QuotationBudgetRepositoryError("No se encontró el recurso maestro para presupuesto.", "not_found");

  return resourceSnapshotPayloadFromRow(data as SupabaseResourceSnapshotRow);
}

function normalizePositiveNumber(value: BudgetNumericInput, label: string): number {
  const numeric = toBudgetNumber(value, Number.NaN);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new QuotationBudgetRepositoryError(`${label} debe ser mayor que cero.`, "invalid_resource");
  }
  return numeric;
}

function normalizeNonNegativeNumber(value: BudgetNumericInput, label: string): number {
  const numeric = toBudgetNumber(value, Number.NaN);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new QuotationBudgetRepositoryError(`${label} debe ser mayor o igual que cero.`, "invalid_resource");
  }
  return numeric;
}

function budgetResourcesToEconomicInput(resources: QuotationBudgetResource[]): BudgetResourceEconomicInput[] {
  return resources.map((resource) => ({
    id: resource.id,
    partidaId: resource.partidaId,
    recursoId: resource.recursoId,
    cantidadPresupuestada: resource.cantidadPresupuestada,
    precioBaseUnitario: resource.precioBaseUnitario,
    precioOfertadoUnitario: resource.precioOfertadoUnitario,
    tipoRecurso: resource.tipoRecursoSnapshot ?? resource.recurso?.tipoRecurso,
  }));
}

async function getBudgetState(presupuestoId: string): Promise<EstadoPresupuestoCotizacion> {
  const { data, error } = await supabase
    .from("cotizacion_presupuestos")
    .select("estado")
    .eq("id", presupuestoId)
    .maybeSingle();

  if (error) throw mapSupabaseError(error, "No se pudo leer el estado del presupuesto");
  if (!data) throw new QuotationBudgetRepositoryError("No se encontró el presupuesto.", "not_found");

  return normalizeBudgetState(String((data as { estado: string }).estado));
}

async function assertBudgetMutable(presupuestoId: string): Promise<void> {
  const estado = await getBudgetState(presupuestoId);
  if (estado === "ADJUDICADO") {
    throw new QuotationBudgetRepositoryError("No se puede modificar un presupuesto adjudicado.", "budget_awarded");
  }
}

async function getBudgetStateForNode(nodeId: string): Promise<{ presupuestoId: string; estado: EstadoPresupuestoCotizacion }> {
  const { data, error } = await supabase
    .from("cotizacion_presupuesto_partidas")
    .select("presupuesto_id,cotizacion_presupuestos:presupuesto_id(estado)")
    .eq("id", nodeId)
    .maybeSingle();

  if (error) throw mapSupabaseError(error, "No se pudo leer la partida presupuestal");
  if (!data) throw new QuotationBudgetRepositoryError("No se encontró la partida presupuestal.", "not_found");

  const row = data as { presupuesto_id: string; cotizacion_presupuestos?: { estado: string } | { estado: string }[] | null };
  const budget = Array.isArray(row.cotizacion_presupuestos) ? row.cotizacion_presupuestos[0] : row.cotizacion_presupuestos;
  return { presupuestoId: row.presupuesto_id, estado: normalizeBudgetState(String(budget?.estado ?? "")) };
}

async function getBudgetStateForResource(resourceId: string): Promise<EstadoPresupuestoCotizacion> {
  const { data, error } = await supabase
    .from("cotizacion_presupuesto_recursos")
    .select("cotizacion_presupuesto_partidas:partida_id(cotizacion_presupuestos:presupuesto_id(estado))")
    .eq("id", resourceId)
    .maybeSingle();

  if (error) throw mapSupabaseError(error, "No se pudo leer el recurso presupuestado");
  if (!data) throw new QuotationBudgetRepositoryError("No se encontró el recurso presupuestado.", "not_found");

  const row = data as {
    cotizacion_presupuesto_partidas?: {
      cotizacion_presupuestos?: { estado: string } | { estado: string }[] | null;
    } | Array<{ cotizacion_presupuestos?: { estado: string } | { estado: string }[] | null }> | null;
  };
  const partida = Array.isArray(row.cotizacion_presupuesto_partidas)
    ? row.cotizacion_presupuesto_partidas[0]
    : row.cotizacion_presupuesto_partidas;
  const budget = Array.isArray(partida?.cotizacion_presupuestos)
    ? partida?.cotizacion_presupuestos[0]
    : partida?.cotizacion_presupuestos;
  return normalizeBudgetState(String(budget?.estado ?? ""));
}

async function assertResourceMutable(resourceId: string): Promise<void> {
  const estado = await getBudgetStateForResource(resourceId);
  if (estado === "ADJUDICADO") {
    throw new QuotationBudgetRepositoryError("No se puede modificar un presupuesto adjudicado.", "budget_awarded");
  }
}

export async function listQuotationBudgets(cotizacionId: string): Promise<QuotationBudget[]> {
  assertSupabaseConfigured();
  const normalizedCotizacionId = assertId(cotizacionId, "cotizacionId");
  const { data, error } = await supabase
    .from("cotizacion_presupuestos")
    .select(BUDGET_SELECT)
    .eq("cotizacion_id", normalizedCotizacionId)
    .order("revision", { ascending: true });

  if (error) throw mapSupabaseError(error, "No se pudo listar presupuestos de cotización");
  return ((data ?? []) as SupabaseBudgetRow[]).map(mapBudget);
}

export async function getQuotationBudgetDetail(presupuestoId: string): Promise<QuotationBudgetDetail> {
  assertSupabaseConfigured();
  const normalizedPresupuestoId = assertId(presupuestoId, "presupuestoId");
  const { data: budgetData, error: budgetError } = await supabase
    .from("cotizacion_presupuestos")
    .select(BUDGET_SELECT)
    .eq("id", normalizedPresupuestoId)
    .maybeSingle();

  if (budgetError) throw mapSupabaseError(budgetError, "No se pudo leer el presupuesto");
  if (!budgetData) throw new QuotationBudgetRepositoryError("No se encontró el presupuesto.", "not_found");

  const { data: nodeData, error: nodeError } = await supabase
    .from("cotizacion_presupuesto_partidas")
    .select(NODE_SELECT)
    .eq("presupuesto_id", normalizedPresupuestoId)
    .order("orden", { ascending: true })
    .order("codigo", { ascending: true, nullsFirst: false });

  if (nodeError) throw mapSupabaseError(nodeError, "No se pudieron leer las partidas del presupuesto");

  const partidas = ((nodeData ?? []) as SupabaseBudgetNodeRow[]).map(mapNode);
  const partidaIds = partidas.map((partida) => partida.id);
  let recursos: QuotationBudgetResource[] = [];

  if (partidaIds.length > 0) {
    const { data: resourceData, error: resourceError } = await supabase
      .from("cotizacion_presupuesto_recursos")
      .select(RESOURCE_SELECT)
      .in("partida_id", partidaIds)
      .order("orden", { ascending: true });

    if (resourceError) throw mapSupabaseError(resourceError, "No se pudieron leer los recursos presupuestados");
    recursos = ((resourceData ?? []) as SupabaseBudgetResourceRow[]).map(mapResource);
  }

  const economicInput = budgetResourcesToEconomicInput(recursos);
  return {
    presupuesto: mapBudget(budgetData as SupabaseBudgetRow),
    partidas,
    recursos,
    economia: computeBudgetEconomics({
      partidaIds: partidas.filter((partida) => partida.tipo === "PARTIDA" || partida.tipo === "GRUPO_RECURSOS").map((partida) => partida.id),
      resources: economicInput,
    }),
    resumenEconomicoCompatible: buildBudgetEconomicSummaryRows(economicInput),
  };
}

export async function createQuotationBudget(input: CreateQuotationBudgetInput): Promise<QuotationBudget> {
  assertSupabaseConfigured();
  const cotizacionId = assertId(input.cotizacionId, "cotizacionId");
  const monedaCodigo = normalizeCurrency(input.monedaCodigo);

  const existingBudgets = await listQuotationBudgets(cotizacionId);
  if (existingBudgets.some((budget) => budget.estado === "ADJUDICADO")) {
    throw new QuotationBudgetRepositoryError(
      "La cotización ya tiene un presupuesto adjudicado; las revisiones posteriores pertenecen a gestión contractual futura.",
      "budget_already_awarded",
    );
  }

  const nextRevision = existingBudgets.reduce((max, budget) => Math.max(max, budget.revision), 0) + 1;
  const { data, error } = await supabase
    .from("cotizacion_presupuestos")
    .insert({
      cotizacion_id: cotizacionId,
      revision: nextRevision,
      estado: "BORRADOR",
      moneda_codigo: monedaCodigo,
    })
    .select(BUDGET_SELECT)
    .single();

  if (error) throw mapSupabaseError(error, "No se pudo crear el presupuesto");
  return mapBudget(data as SupabaseBudgetRow);
}

export async function createQuotationBudgetFromTechnicalProposal(propuestaTecnicaId: string): Promise<QuotationBudget> {
  assertSupabaseConfigured();
  const normalizedProposalId = assertId(propuestaTecnicaId, "propuestaTecnicaId");

  const { data, error } = await supabase.rpc("crear_presupuesto_desde_propuesta_tecnica", {
    p_propuesta_tecnica_id: normalizedProposalId,
  });

  if (error) throw mapSupabaseError(error, "No se pudo crear el presupuesto desde la propuesta técnica");
  const row = firstRpcRow(data as SupabaseBudgetRow | SupabaseBudgetRow[] | null);
  if (!row) throw new QuotationBudgetRepositoryError("La importación no devolvió el presupuesto creado.", "supabase_error");
  return mapBudget(row);
}

export async function createBudgetNode(input: CreateBudgetNodeInput): Promise<QuotationBudgetNode> {
  assertSupabaseConfigured();
  const presupuestoId = assertId(input.presupuestoId, "presupuestoId");
  const descripcion = assertId(input.descripcion, "descripcion");
  await assertBudgetMutable(presupuestoId);

  const { data, error } = await supabase
    .from("cotizacion_presupuesto_partidas")
    .insert({
      presupuesto_id: presupuestoId,
      parent_id: input.parentId ?? null,
      codigo: nullableString(input.codigo),
      tipo: input.tipo,
      descripcion,
      unidad: nullableString(input.unidad),
      cantidad: input.cantidad === undefined || input.cantidad === null ? null : normalizePositiveNumber(input.cantidad, "cantidad"),
      orden: input.orden ?? 0,
      observaciones: nullableString(input.observaciones),
    })
    .select(NODE_SELECT)
    .single();

  if (error) throw mapSupabaseError(error, "No se pudo crear la partida presupuestal");
  return mapNode(data as SupabaseBudgetNodeRow);
}

export async function updateBudgetNode(id: string, input: UpdateBudgetNodeInput): Promise<QuotationBudgetNode> {
  assertSupabaseConfigured();
  const nodeId = assertId(id, "id");
  const { estado } = await getBudgetStateForNode(nodeId);
  if (estado === "ADJUDICADO") {
    throw new QuotationBudgetRepositoryError("No se puede modificar un presupuesto adjudicado.", "budget_awarded");
  }

  const payload = removeUndefinedValues({
    parent_id: input.parentId,
    codigo: input.codigo === undefined ? undefined : nullableString(input.codigo),
    tipo: input.tipo,
    descripcion: input.descripcion === undefined ? undefined : assertId(input.descripcion, "descripcion"),
    unidad: input.unidad === undefined ? undefined : nullableString(input.unidad),
    cantidad:
      input.cantidad === undefined
        ? undefined
        : input.cantidad === null
          ? null
          : normalizePositiveNumber(input.cantidad, "cantidad"),
    orden: input.orden,
    observaciones: input.observaciones === undefined ? undefined : nullableString(input.observaciones),
  });

  const { data, error } = await supabase
    .from("cotizacion_presupuesto_partidas")
    .update(payload)
    .eq("id", nodeId)
    .select(NODE_SELECT)
    .single();

  if (error) throw mapSupabaseError(error, "No se pudo actualizar la partida presupuestal");
  return mapNode(data as SupabaseBudgetNodeRow);
}

export async function deleteBudgetNode(id: string): Promise<void> {
  assertSupabaseConfigured();
  const nodeId = assertId(id, "id");
  const { estado } = await getBudgetStateForNode(nodeId);
  if (estado === "ADJUDICADO") {
    throw new QuotationBudgetRepositoryError("No se puede modificar un presupuesto adjudicado.", "budget_awarded");
  }

  const { error } = await supabase.from("cotizacion_presupuesto_partidas").delete().eq("id", nodeId);
  if (error) throw mapSupabaseError(error, "No se pudo eliminar la partida presupuestal");
}

export async function addBudgetResource(input: AddBudgetResourceInput): Promise<QuotationBudgetResource> {
  assertSupabaseConfigured();
  const partidaId = assertId(input.partidaId, "partidaId");
  const recursoId = assertId(input.recursoId, "recursoId");
  const { estado } = await getBudgetStateForNode(partidaId);
  if (estado === "ADJUDICADO") {
    throw new QuotationBudgetRepositoryError("No se puede modificar un presupuesto adjudicado.", "budget_awarded");
  }
  const resourceSnapshot = await readCatalogResourceSnapshot(recursoId);
  const precioBaseUnitario = normalizeNonNegativeNumber(input.precioBaseUnitario, "precioBaseUnitario");
  const precioOfertadoUnitario = normalizeNonNegativeNumber(input.precioOfertadoUnitario, "precioOfertadoUnitario");
  const masterPrice = resourceSnapshot.precio_unitario_ref_snapshot;
  const precioBaseOrigen = masterPrice !== null && Math.abs(precioBaseUnitario - masterPrice) < 0.0001 ? "MAESTRO" : "MANUAL";

  const { data, error } = await supabase
    .from("cotizacion_presupuesto_recursos")
    .insert({
      partida_id: partidaId,
      recurso_id: recursoId,
      cantidad_presupuestada: normalizePositiveNumber(input.cantidadPresupuestada, "cantidadPresupuestada"),
      precio_base_unitario: precioBaseUnitario,
      precio_ofertado_unitario: precioOfertadoUnitario,
      orden: input.orden ?? 0,
      observaciones: nullableString(input.observaciones),
      precio_base_origen: precioBaseOrigen,
      precio_historico_id: null,
      precio_revisado: false,
      ...resourceSnapshot,
    })
    .select(RESOURCE_SELECT)
    .single();

  if (error) throw mapSupabaseError(error, "No se pudo agregar el recurso presupuestado");
  return mapResource(data as SupabaseBudgetResourceRow);
}

export async function updateBudgetResource(id: string, input: UpdateBudgetResourceInput): Promise<QuotationBudgetResource> {
  assertSupabaseConfigured();
  const resourceId = assertId(id, "id");
  await assertResourceMutable(resourceId);
  const nextRecursoId = input.recursoId === undefined ? undefined : assertId(input.recursoId, "recursoId");
  const resourceSnapshot = nextRecursoId ? await readCatalogResourceSnapshot(nextRecursoId) : undefined;

  const payload = removeUndefinedValues({
    recurso_id: nextRecursoId,
    cantidad_presupuestada:
      input.cantidadPresupuestada === undefined
        ? undefined
        : normalizePositiveNumber(input.cantidadPresupuestada, "cantidadPresupuestada"),
    precio_base_unitario:
      input.precioBaseUnitario === undefined
        ? undefined
        : normalizeNonNegativeNumber(input.precioBaseUnitario, "precioBaseUnitario"),
    precio_ofertado_unitario:
      input.precioOfertadoUnitario === undefined
        ? undefined
        : normalizeNonNegativeNumber(input.precioOfertadoUnitario, "precioOfertadoUnitario"),
    orden: input.orden,
    observaciones: input.observaciones === undefined ? undefined : nullableString(input.observaciones),
    ...resourceSnapshot,
  });

  const { data, error } = await supabase
    .from("cotizacion_presupuesto_recursos")
    .update(payload)
    .eq("id", resourceId)
    .select(RESOURCE_SELECT)
    .single();

  if (error) throw mapSupabaseError(error, "No se pudo actualizar el recurso presupuestado");
  return mapResource(data as SupabaseBudgetResourceRow);
}

export async function listResourcePriceHistories(recursoIds: string[]): Promise<ResourcePriceHistory[]> {
  assertSupabaseConfigured();
  const ids = Array.from(new Set(recursoIds.map((id) => assertId(id, "recursoId"))));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("recurso_precios_historicos")
    .select(RESOURCE_PRICE_HISTORY_SELECT)
    .in("recurso_id", ids)
    .order("fecha_precio", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw mapSupabaseError(error, "No se pudieron leer los historicos de precios");
  return ((data ?? []) as SupabaseResourcePriceHistoryRow[]).map(mapResourcePriceHistory);
}

export async function applyBudgetResourcePriceReview(input: ApplyBudgetResourcePriceReviewInput): Promise<ApplyBudgetResourcePriceReviewResult> {
  assertSupabaseConfigured();
  const presupuestoId = assertId(input.presupuestoId, "presupuestoId");
  const recursoId = assertId(input.recursoId, "recursoId");
  const precioHistoricoId = input.precioHistoricoId ? assertId(input.precioHistoricoId, "precioHistoricoId") : null;
  const manualOfferOverrideResourceIds = (input.manualOfferOverrideResourceIds ?? []).map((id) => assertId(id, "manualOfferOverrideResourceId"));
  const precioUnitario =
    input.precioUnitario === null || input.precioUnitario === undefined
      ? null
      : normalizeNonNegativeNumber(input.precioUnitario, "precioUnitario");

  const { data, error } = await supabase.rpc("aplicar_revision_precio_recurso_presupuesto", {
    p_presupuesto_id: presupuestoId,
    p_recurso_id: recursoId,
    p_accion: input.accion,
    p_precio_historico_id: precioHistoricoId,
    p_precio_unitario: precioUnitario,
    p_moneda_codigo: input.monedaCodigo ?? null,
    p_fecha_precio: input.fechaPrecio ?? null,
    p_proveedor_id: nullableString(input.proveedorId),
    p_proveedor_snapshot: nullableString(input.proveedorSnapshot),
    p_fuente_tipo: input.fuenteTipo ?? null,
    p_fuente_referencia: nullableString(input.fuenteReferencia),
    p_documento_soporte_url: nullableString(input.documentoSoporteUrl),
    p_observaciones: nullableString(input.observaciones),
    p_manual_offer_override_resource_ids: manualOfferOverrideResourceIds,
  });

  if (error) throw mapSupabaseError(error, "No se pudo aplicar la revision de precio");
  const row = firstRpcRow(data as SupabaseApplyPriceReviewRow | SupabaseApplyPriceReviewRow[] | null);
  if (!row) throw new QuotationBudgetRepositoryError("La revision de precio no devolvio resultado.", "supabase_error");
  return mapApplyPriceReviewResult(row);
}

export async function removeBudgetResource(id: string): Promise<void> {
  assertSupabaseConfigured();
  const resourceId = assertId(id, "id");
  await assertResourceMutable(resourceId);

  const { error } = await supabase.from("cotizacion_presupuesto_recursos").delete().eq("id", resourceId);
  if (error) throw mapSupabaseError(error, "No se pudo eliminar el recurso presupuestado");
}

export async function markBudgetReady(presupuestoId: string): Promise<QuotationBudget> {
  assertSupabaseConfigured();
  const normalizedPresupuestoId = assertId(presupuestoId, "presupuestoId");
  const estado = await getBudgetState(normalizedPresupuestoId);
  if (estado === "ADJUDICADO") {
    throw new QuotationBudgetRepositoryError("No se puede modificar un presupuesto adjudicado.", "budget_awarded");
  }
  if (estado !== "BORRADOR") {
    throw new QuotationBudgetRepositoryError(
      "Solo un presupuesto en BORRADOR puede marcarse como LISTO_PARA_ADJUDICAR.",
      "invalid_state",
    );
  }

  const { data, error } = await supabase.rpc("marcar_cotizacion_presupuesto_listo", {
    p_presupuesto_id: normalizedPresupuestoId,
  });

  if (error) throw mapSupabaseError(error, "No se pudo marcar el presupuesto como listo para adjudicar");
  const row = firstRpcRow(data as SupabaseBudgetRow | SupabaseBudgetRow[] | null);
  if (!row) throw new QuotationBudgetRepositoryError("La transición no devolvió el presupuesto actualizado.", "supabase_error");
  return mapBudget(row);
}

export async function returnBudgetToDraft(presupuestoId: string): Promise<QuotationBudget> {
  assertSupabaseConfigured();
  const normalizedPresupuestoId = assertId(presupuestoId, "presupuestoId");
  const estado = await getBudgetState(normalizedPresupuestoId);
  if (estado === "ADJUDICADO") {
    throw new QuotationBudgetRepositoryError("No se puede modificar un presupuesto adjudicado.", "budget_awarded");
  }
  if (estado !== "LISTO_PARA_ADJUDICAR") {
    throw new QuotationBudgetRepositoryError(
      "Solo un presupuesto LISTO_PARA_ADJUDICAR puede volver a BORRADOR.",
      "invalid_state",
    );
  }

  const { data, error } = await supabase.rpc("devolver_cotizacion_presupuesto_borrador", {
    p_presupuesto_id: normalizedPresupuestoId,
  });

  if (error) throw mapSupabaseError(error, "No se pudo devolver el presupuesto a borrador");
  const row = firstRpcRow(data as SupabaseBudgetRow | SupabaseBudgetRow[] | null);
  if (!row) throw new QuotationBudgetRepositoryError("La transición no devolvió el presupuesto actualizado.", "supabase_error");
  return mapBudget(row);
}

export function computeQuotationBudgetDetailEconomics(detail: Pick<QuotationBudgetDetail, "partidas" | "recursos">): BudgetEconomicSummary {
  return computeBudgetEconomics({
    partidaIds: detail.partidas.filter((partida) => partida.tipo === "PARTIDA" || partida.tipo === "GRUPO_RECURSOS").map((partida) => partida.id),
    resources: budgetResourcesToEconomicInput(detail.recursos),
  });
}

export function buildQuotationBudgetEconomicSummaryRows(resources: QuotationBudgetResource[]): CotizacionEconomicRow[] {
  return buildBudgetEconomicSummaryRows(budgetResourcesToEconomicInput(resources));
}

export type SyncQuotationBudgetEconomicsResult = {
  cotizacionId: string;
  presupuestoId: string;
  presupuestoRevision: number;
  propuestaTecnicaId: string | null;
  montoOfertado: number;
  resumenEconomico: CotizacionEconomicRow[];
};

export async function syncQuotationBudgetEconomicsToQuotation(
  presupuestoId: string,
): Promise<SyncQuotationBudgetEconomicsResult> {
  assertSupabaseConfigured();
  const detail = await getQuotationBudgetDetail(presupuestoId);
  const cotizacionId = detail.presupuesto.cotizacionId;
  const resumenEconomico = detail.resumenEconomicoCompatible;
  const montoOfertado = detail.economia.total.ofertado;

  const { data: currentRow, error: currentError } = await supabase
    .from("cotizaciones")
    .select("id,metadata")
    .eq("id", cotizacionId)
    .maybeSingle();

  if (currentError) throw mapSupabaseError(currentError, "No se pudo leer la cotización para sincronizar el presupuesto");
  if (!currentRow) throw new QuotationBudgetRepositoryError("No se encontró la cotización asociada al presupuesto.", "not_found");

  const metadata = ((currentRow as SupabaseQuotationMetadataRow).metadata ?? {}) as Record<string, unknown>;
  const { error: updateError } = await supabase
    .from("cotizaciones")
    .update({
      monto: montoOfertado,
      metadata: {
        ...metadata,
        resumen_economico: resumenEconomico,
        presupuesto_economico_fuente: {
          presupuesto_id: detail.presupuesto.id,
          presupuesto_revision: detail.presupuesto.revision,
          propuesta_tecnica_id: detail.presupuesto.propuestaTecnicaId,
          synced_at: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", cotizacionId);

  if (updateError) throw mapSupabaseError(updateError, "No se pudo sincronizar el presupuesto con la cotización");

  return {
    cotizacionId,
    presupuestoId: detail.presupuesto.id,
    presupuestoRevision: detail.presupuesto.revision,
    propuestaTecnicaId: detail.presupuesto.propuestaTecnicaId,
    montoOfertado,
    resumenEconomico,
  };
}
