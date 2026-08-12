// ── Herramientas de contexto IA (consultas reales a Supabase) ────────────────
//
// Capa formal sobre las consultas existentes de `contextQuery.ts` y los
// repositorios de `lib/sgp`. Cada herramienta:
//   - Devuelve SIEMPRE el shape normalizado `ContextToolResult` (nunca lanza).
//   - Marca el estado: "success" | "empty" | "error" | "not_implemented".
//   - Limita resultados (por defecto 20) y NO expone campos sensibles.
//
// No reinventa SQL: reutiliza las funciones ya probadas para no romper nada ni
// inventar nombres de tablas/columnas. Si una fuente no está conectada,
// devuelve "not_implemented" en lugar de fabricar datos.

import {
  searchCotizacionesByFilters,
  fetchCotizacionByCode,
  searchRequerimientos,
  fetchRequirementByCode,
  fetchRequirementItems,
  fetchProjectContextByCode,
  type CotizacionSummary,
  type RequirementSummary,
  type RequirementItemSummary,
  type CotizacionSearchFilters,
  type RequerimientoSearchFilters,
  type ProjectReferenceResult,
  type ContextSupabaseClient,
} from "@/lib/chat/contextQuery";

// Límite máximo de registros que una herramienta devuelve al contexto IA.
export const DEFAULT_CONTEXT_LIMIT = 20;

export type ContextToolStatus = "success" | "empty" | "error" | "not_implemented";

export type ContextSensitivePermissions = {
  can_view: boolean;
  can_view_prices: boolean;
  can_view_supplier: boolean;
  can_view_margin: boolean;
};

export type ContextModuleKey = "cotizaciones" | "requerimientos" | "detalle_rq" | "recursos" | "technical_proposals";
export type ContextPermissions = Partial<Record<ContextModuleKey, ContextSensitivePermissions>>;

export interface ContextToolDeps {
  supabase: ContextSupabaseClient;
  permissions?: ContextPermissions;
}

interface ContextToolResultBase {
  status: ContextToolStatus;
  /** Resumen serializable de los filtros aplicados (para trazabilidad). */
  query: Record<string, unknown>;
  /** Total real de coincidencias (puede ser mayor que records.length). */
  total: number;
  /** Mensaje controlado para estados empty/error/not_implemented. */
  message?: string;
}

// Versión "ligera" de una propuesta técnica: solo campos visibles para IA.
export interface TechnicalProposalLite {
  code: string;
  cotizacion_codigo: string;
  revision: string;
  status: string;
  work_status: string;
  document_date: string | null;
}

// Versión "ligera" de un recurso del catálogo: solo campos visibles para IA.
export interface RecursoLite {
  codigo_recurso: string;
  descripcion: string;
  tipo_recurso_nombre: string | null;
  precio_unitario_ref: number | null;
  moneda_codigo: string | null;
  proveedor_nombre: string | null;
  marca_nombre: string | null;
  estado: string | null;
  image_url?: string | null;
  image_name?: string | null;
}

// Resultados tipados por fuente (unión discriminada por `source`).
export interface CotizacionesToolResult extends ContextToolResultBase {
  source: "cotizaciones";
  records: CotizacionSummary[];
}
export interface RequerimientosToolResult extends ContextToolResultBase {
  source: "requerimientos";
  records: RequirementSummary[];
}
export interface RequerimientoItemsToolResult extends ContextToolResultBase {
  source: "requerimiento_items";
  records: RequirementItemSummary[];
  /** Código del requerimiento dueño de los ítems (para el encabezado). */
  requerimientoCodigo?: string;
}
export interface TechnicalProposalsToolResult extends ContextToolResultBase {
  source: "technical_proposals";
  records: TechnicalProposalLite[];
}
export interface RecursosToolResult extends ContextToolResultBase {
  source: "recursos";
  records: RecursoLite[];
}
export interface QuotationDocumentLite {
  quotation_code: string;
  requirement_code: string | null;
  folder_key: string;
  folder_name: string;
  original_name: string;
  mime_type: string | null;
  file_size: number;
  drive_file_url: string;
  uploaded_at: string;
  uploaded_by_email: string | null;
}
export interface QuotationDocumentsToolResult extends ContextToolResultBase {
  source: "quotation_documents";
  records: QuotationDocumentLite[];
}
export type CountableContextTable = "cotizaciones" | "requerimientos" | "recursos";
export interface CountToolFilters {
  estado?: string;
  dateFrom?: string;
  dateTo?: string;
  dateColumn?: "created_at" | "fecha_registro" | "fecha_solicitud" | "fecha_requerida";
  periodLabel?: string;
}
export interface CountToolResult extends ContextToolResultBase {
  source: "conteo";
  table: CountableContextTable;
  label: string;
  records: never[];
}
export interface ProyectoToolResult extends ContextToolResultBase {
  source: "proyecto";
  code: string;
  reference: ProjectReferenceResult;
  /** Requerimientos relacionados (solo en obtenerResumenProyecto). */
  relatedRequerimientos?: RequirementSummary[];
  records: never[];
}

export type ContextToolResult =
  | CotizacionesToolResult
  | RequerimientosToolResult
  | RequerimientoItemsToolResult
  | TechnicalProposalsToolResult
  | RecursosToolResult
  | QuotationDocumentsToolResult
  | CountToolResult
  | ProyectoToolResult;

function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") console.debug("[contextTools]", ...args);
}

function contextDb(deps: ContextToolDeps | undefined): ContextSupabaseClient {
  if (!deps?.supabase) throw new Error("CTX_SUPABASE_CLIENT_REQUIRED");
  return deps.supabase;
}

function permissionsFor(deps: ContextToolDeps | undefined, moduleKey: keyof ContextPermissions): ContextSensitivePermissions {
  return deps?.permissions?.[moduleKey] ?? {
    can_view: false,
    can_view_prices: false,
    can_view_supplier: false,
    can_view_margin: false,
  };
}

function canViewModule(deps: ContextToolDeps | undefined, moduleKey: keyof ContextPermissions): boolean {
  return permissionsFor(deps, moduleKey).can_view === true;
}

function canViewRequirementItems(deps: ContextToolDeps | undefined): boolean {
  return canViewModule(deps, "detalle_rq") || canViewModule(deps, "requerimientos");
}

function itemPermissions(deps: ContextToolDeps | undefined): ContextSensitivePermissions {
  const detail = permissionsFor(deps, "detalle_rq");
  const req = permissionsFor(deps, "requerimientos");
  return {
    can_view: detail.can_view || req.can_view,
    can_view_prices: detail.can_view_prices || req.can_view_prices,
    can_view_supplier: detail.can_view_supplier || req.can_view_supplier,
    can_view_margin: detail.can_view_margin || req.can_view_margin,
  };
}

function isPermissionError(err: unknown): boolean {
  return err instanceof Error && err.message === "CTX_FORBIDDEN";
}

function forbiddenError(): never {
  throw new Error("CTX_FORBIDDEN");
}

function ensureCanView(deps: ContextToolDeps | undefined, moduleKey: keyof ContextPermissions): void {
  contextDb(deps);
  if (!canViewModule(deps, moduleKey)) forbiddenError();
}

function ensureCanViewItems(deps: ContextToolDeps | undefined): void {
  contextDb(deps);
  if (!canViewRequirementItems(deps)) forbiddenError();
}

function safeToolErrorMessage(err: unknown): string {
  if (isPermissionError(err)) return "Fuente no autorizada para el usuario.";
  return "No se pudo consultar esta fuente de contexto.";
}

function redactCotizacion(cot: CotizacionSummary, deps?: ContextToolDeps): CotizacionSummary {
  const permissions = permissionsFor(deps, "cotizaciones");
  return {
    ...cot,
    monto: permissions.can_view_prices ? cot.monto : null,
    moneda_codigo: permissions.can_view_prices ? cot.moneda_codigo : null,
    resumen_economico: permissions.can_view_margin ? cot.resumen_economico : [],
  };
}

function redactCotizaciones(rows: CotizacionSummary[], deps?: ContextToolDeps): CotizacionSummary[] {
  return rows.map((row) => redactCotizacion(row, deps));
}

function redactRequirementItems(rows: RequirementItemSummary[], deps?: ContextToolDeps): RequirementItemSummary[] {
  const permissions = itemPermissions(deps);
  return rows.map((row) => ({
    ...row,
    precio_unitario: permissions.can_view_prices ? row.precio_unitario : null,
    moneda: permissions.can_view_prices ? row.moneda : null,
    costo_total_presupuestado: permissions.can_view_prices ? row.costo_total_presupuestado : null,
    proveedor_nombre: permissions.can_view_supplier ? row.proveedor_nombre : null,
  }));
}

function redactRecurso(row: RecursoLite, deps?: ContextToolDeps): RecursoLite {
  const permissions = permissionsFor(deps, "recursos");
  return {
    ...row,
    precio_unitario_ref: permissions.can_view_prices ? row.precio_unitario_ref : null,
    moneda_codigo: permissions.can_view_prices ? row.moneda_codigo : null,
    proveedor_nombre: permissions.can_view_supplier ? row.proveedor_nombre : null,
    marca_nombre: permissions.can_view_supplier ? row.marca_nombre : null,
  };
}

// Normaliza cualquier excepción a un mensaje seguro (sin filtrar internals).
function safeErrorMessage(err: unknown): string {
  return safeToolErrorMessage(err);
}

function clampLimit(limit: number | undefined): number {
  if (!limit || limit < 1) return DEFAULT_CONTEXT_LIMIT;
  return Math.min(limit, DEFAULT_CONTEXT_LIMIT);
}

function driveFileIdFromUrl(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  const filePathMatch = normalized.match(/\/file\/d\/([^/?#]+)/i);
  if (filePathMatch?.[1]) return filePathMatch[1];
  try {
    const url = new URL(normalized);
    return url.searchParams.get("id") ?? "";
  } catch {
    return "";
  }
}

function internalDriveFileUrl(fileId: string): string {
  return `/api/drive/file/${encodeURIComponent(fileId)}`;
}

function tableLabel(table: CountableContextTable): string {
  if (table === "cotizaciones") return "cotizaciones";
  if (table === "requerimientos") return "requerimientos";
  return "recursos";
}

function dateColumnForTable(table: CountableContextTable): CountToolFilters["dateColumn"] {
  if (table === "cotizaciones") return "created_at";
  if (table === "requerimientos") return "created_at";
  return "created_at";
}

// ── Conteos/agregados ligeros ───────────────────────────────────────────────

export async function contarRegistros(
  table: CountableContextTable,
  filters: CountToolFilters = {},
  deps?: ContextToolDeps,
): Promise<CountToolResult> {
  const dateColumn: NonNullable<CountToolFilters["dateColumn"]> = filters.dateColumn ?? dateColumnForTable(table) ?? "created_at";
  const query: Record<string, unknown> = { ...filters, dateColumn };
  try {
    ensureCanView(deps, table);
    let request = contextDb(deps)
      .from(table)
      .select("id", { count: "exact", head: true });

    request = request.is("deleted_at", null);

    if (filters.estado?.trim()) request = request.ilike("estado", `%${filters.estado.trim()}%`);
    if (filters.dateFrom) request = request.gte(dateColumn, filters.dateFrom);
    if (filters.dateTo) request = request.lt(dateColumn, filters.dateTo);

    const { error, count } = await request;
    if (error) {
      return {
        source: "conteo",
        status: "error",
        table,
        label: tableLabel(table),
        query,
        records: [],
        total: 0,
        message: safeErrorMessage(error),
      };
    }

    return {
      source: "conteo",
      status: "success",
      table,
      label: tableLabel(table),
      query,
      records: [],
      total: count ?? 0,
    };
  } catch (err) {
    devLog("contarRegistros error", err);
    return {
      source: "conteo",
      status: "error",
      table,
      label: tableLabel(table),
      query,
      records: [],
      total: 0,
      message: safeErrorMessage(err),
    };
  }
}

// ── Cotizaciones ─────────────────────────────────────────────────────────────

export async function buscarCotizaciones(
  filters: CotizacionSearchFilters,
  limit = DEFAULT_CONTEXT_LIMIT,
  deps?: ContextToolDeps,
): Promise<CotizacionesToolResult> {
  const query: Record<string, unknown> = { ...filters, limit: clampLimit(limit) };
  try {
    ensureCanView(deps, "cotizaciones");
    const result = await searchCotizacionesByFilters(filters, clampLimit(limit), contextDb(deps));
    if (result.items.length === 0) {
      return { source: "cotizaciones", status: "empty", query, records: [], total: 0 };
    }
    return { source: "cotizaciones", status: "success", query, records: redactCotizaciones(result.items, deps), total: result.total };
  } catch (err) {
    devLog("buscarCotizaciones error", err);
    return { source: "cotizaciones", status: "error", query, records: [], total: 0, message: safeErrorMessage(err) };
  }
}

export async function buscarCotizacionPorCodigo(code: string, deps?: ContextToolDeps): Promise<CotizacionesToolResult> {
  const query: Record<string, unknown> = { codigo: code };
  try {
    ensureCanView(deps, "cotizaciones");
    const cot = await fetchCotizacionByCode(code, contextDb(deps));
    if (!cot) {
      return { source: "cotizaciones", status: "empty", query, records: [], total: 0 };
    }
    return { source: "cotizaciones", status: "success", query, records: [redactCotizacion(cot, deps)], total: 1 };
  } catch (err) {
    devLog("buscarCotizacionPorCodigo error", err);
    return { source: "cotizaciones", status: "error", query, records: [], total: 0, message: safeErrorMessage(err) };
  }
}

// ── Requerimientos ───────────────────────────────────────────────────────────

export async function buscarRequerimientos(
  filters: RequerimientoSearchFilters,
  limit = DEFAULT_CONTEXT_LIMIT,
  deps?: ContextToolDeps,
): Promise<RequerimientosToolResult> {
  const query: Record<string, unknown> = { ...filters, limit: clampLimit(limit) };
  try {
    ensureCanView(deps, "requerimientos");
    const result = await searchRequerimientos(filters, clampLimit(limit), contextDb(deps));
    if (result.items.length === 0) {
      return { source: "requerimientos", status: "empty", query, records: [], total: 0 };
    }
    return { source: "requerimientos", status: "success", query, records: result.items, total: result.total };
  } catch (err) {
    devLog("buscarRequerimientos error", err);
    return { source: "requerimientos", status: "error", query, records: [], total: 0, message: safeErrorMessage(err) };
  }
}

export async function buscarRequerimientoPorCodigo(code: string, deps?: ContextToolDeps): Promise<RequerimientosToolResult> {
  const query: Record<string, unknown> = { codigo: code };
  try {
    ensureCanView(deps, "requerimientos");
    const rq = await fetchRequirementByCode(code, contextDb(deps));
    if (!rq) {
      return { source: "requerimientos", status: "empty", query, records: [], total: 0 };
    }
    return { source: "requerimientos", status: "success", query, records: [rq], total: 1 };
  } catch (err) {
    devLog("buscarRequerimientoPorCodigo error", err);
    return { source: "requerimientos", status: "error", query, records: [], total: 0, message: safeErrorMessage(err) };
  }
}

// ── Ítems de requerimiento ───────────────────────────────────────────────────

export async function buscarItemsDeRequerimiento(
  requerimientoId: string,
  limit = DEFAULT_CONTEXT_LIMIT,
  requerimientoCodigo?: string,
  deps?: ContextToolDeps,
): Promise<RequerimientoItemsToolResult> {
  const query: Record<string, unknown> = { requerimiento_id: requerimientoId, limit: clampLimit(limit) };
  try {
    ensureCanViewItems(deps);
    const items = await fetchRequirementItems(requerimientoId, clampLimit(limit), contextDb(deps));
    if (items.length === 0) {
      return { source: "requerimiento_items", status: "empty", query, records: [], total: 0, requerimientoCodigo };
    }
    return { source: "requerimiento_items", status: "success", query, records: redactRequirementItems(items, deps), total: items.length, requerimientoCodigo };
  } catch (err) {
    devLog("buscarItemsDeRequerimiento error", err);
    return { source: "requerimiento_items", status: "error", query, records: [], total: 0, message: safeErrorMessage(err), requerimientoCodigo };
  }
}

// ── Propuesta técnica ────────────────────────────────────────────────────────

export async function buscarPropuestaTecnicaPorCodigo(code: string, deps?: ContextToolDeps): Promise<TechnicalProposalsToolResult> {
  const query: Record<string, unknown> = { code };
  try {
    ensureCanView(deps, "technical_proposals");
    const { data, error } = await contextDb(deps)
      .from("technical_proposals")
      .select("code,cotizacion_codigo,revision,status,work_status,document_date")
      .or(`code.eq.${code},cotizacion_codigo.eq.${code}`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return { source: "technical_proposals", status: "error", query, records: [], total: 0, message: safeErrorMessage(error) };
    }
    const pt = data as TechnicalProposalLite | null;
    if (!pt) {
      return { source: "technical_proposals", status: "empty", query, records: [], total: 0 };
    }
    const lite: TechnicalProposalLite = {
      code: pt.code,
      cotizacion_codigo: pt.cotizacion_codigo,
      revision: pt.revision,
      status: pt.status,
      work_status: pt.work_status,
      document_date: pt.document_date,
    };
    return { source: "technical_proposals", status: "success", query, records: [lite], total: 1 };
  } catch (err) {
    devLog("buscarPropuestaTecnicaPorCodigo error", err);
    return { source: "technical_proposals", status: "error", query, records: [], total: 0, message: safeErrorMessage(err) };
  }
}

// ── Recursos (catálogo) ──────────────────────────────────────────────────────

export interface RecursosToolFilters {
  q?: string;
  tipoRecurso?: string;
  estado?: string;
  proveedor?: string;
  marca?: string;
}

type ResourceFileRecord = {
  drive_file_id?: string | null;
  drive_url?: string | null;
  file_name?: string | null;
};

type ResourceMetadata = {
  resource_files?: {
    image?: ResourceFileRecord[];
  };
};

type ResourceContextRow = {
  codigo_recurso: string;
  descripcion: string;
  tipo_recurso_nombre: string | null;
  precio_unitario_ref: number | null;
  moneda_codigo: string | null;
  proveedor_nombre: string | null;
  marca_nombre: string | null;
  estado: string | null;
  metadata: ResourceMetadata | null;
};

function firstResourceImage(metadata: ResourceMetadata | null): { image_url: string | null; image_name: string | null } {
  const imageFile = metadata?.resource_files?.image?.[0] ?? null;
  const fileId = imageFile?.drive_file_id || driveFileIdFromUrl(imageFile?.drive_url ?? "");
  if (fileId) return { image_url: internalDriveFileUrl(fileId), image_name: imageFile?.file_name ?? null };
  if (imageFile?.drive_url && /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(imageFile.drive_url)) {
    return { image_url: imageFile.drive_url, image_name: imageFile.file_name ?? null };
  }
  return { image_url: null, image_name: imageFile?.file_name ?? null };
}

export async function buscarRecursos(
  filters: RecursosToolFilters,
  limit = DEFAULT_CONTEXT_LIMIT,
  deps?: ContextToolDeps,
): Promise<RecursosToolResult> {
  const query: Record<string, unknown> = { ...filters, limit: clampLimit(limit) };
  try {
    ensureCanView(deps, "recursos");
    let request = contextDb(deps)
      .from("recursos")
      .select(
        "codigo_recurso,descripcion,tipo_recurso_nombre,precio_unitario_ref,moneda_codigo,proveedor_nombre,marca_nombre,estado,metadata",
        { count: "exact" },
      )
      .is("deleted_at", null)
      .order("codigo_recurso", { ascending: true })
      .limit(clampLimit(limit));

    if (filters.q?.trim()) {
      const q = filters.q.trim();
      request = request.or(`codigo_recurso.ilike.%${q}%,descripcion.ilike.%${q}%,codigo_eka.ilike.%${q}%,codigo_fabricante.ilike.%${q}%`);
    }
    if (filters.tipoRecurso?.trim()) request = request.ilike("tipo_recurso_nombre", `%${filters.tipoRecurso.trim()}%`);
    if (filters.estado?.trim()) request = request.ilike("estado", `%${filters.estado.trim()}%`);
    if (filters.proveedor?.trim()) request = request.ilike("proveedor_nombre", `%${filters.proveedor.trim()}%`);
    if (filters.marca?.trim()) request = request.ilike("marca_nombre", `%${filters.marca.trim()}%`);

    const { data, error, count } = await request;
    if (error) {
      return { source: "recursos", status: "error", query, records: [], total: 0, message: safeErrorMessage(error) };
    }
    if (!data || data.length === 0) {
      return { source: "recursos", status: "empty", query, records: [], total: 0 };
    }
    const lite: RecursoLite[] = (data as ResourceContextRow[]).map((r) => ({
      ...firstResourceImage(r.metadata),
      codigo_recurso: r.codigo_recurso,
      descripcion: r.descripcion,
      tipo_recurso_nombre: r.tipo_recurso_nombre ?? null,
      precio_unitario_ref: r.precio_unitario_ref ?? null,
      moneda_codigo: r.moneda_codigo ?? null,
      proveedor_nombre: r.proveedor_nombre ?? null,
      marca_nombre: r.marca_nombre ?? null,
      estado: r.estado ?? null,
    }));
    return { source: "recursos", status: "success", query, records: lite.map((row) => redactRecurso(row, deps)), total: count ?? lite.length };
  } catch (err) {
    devLog("buscarRecursos error", err);
    return { source: "recursos", status: "error", query, records: [], total: 0, message: safeErrorMessage(err) };
  }
}

// ── Documentos de cotización en Drive ───────────────────────────────────────

export async function buscarDocumentosCotizacion(
  quotationCode: string,
  limit = DEFAULT_CONTEXT_LIMIT,
  deps?: ContextToolDeps,
): Promise<QuotationDocumentsToolResult> {
  const query: Record<string, unknown> = { quotation_code: quotationCode, limit: clampLimit(limit) };
  try {
    contextDb(deps);
    if (!canViewModule(deps, "cotizaciones") && !canViewModule(deps, "requerimientos")) forbiddenError();
    const { data, error, count } = await contextDb(deps)
      .from("quotation_documents")
      .select(
        "quotation_code, requirement_code, folder_key, folder_name, original_name, mime_type, file_size, drive_file_url, uploaded_at, uploaded_by_email",
        { count: "exact" },
      )
      .eq("quotation_code", quotationCode)
      .order("uploaded_at", { ascending: false })
      .limit(clampLimit(limit));

    if (error) {
      return { source: "quotation_documents", status: "error", query, records: [], total: 0, message: safeErrorMessage(error) };
    }
    if (!data || data.length === 0) {
      return { source: "quotation_documents", status: "empty", query, records: [], total: 0 };
    }
    return {
      source: "quotation_documents",
      status: "success",
      query,
      records: data as QuotationDocumentLite[],
      total: count ?? data.length,
    };
  } catch (err) {
    devLog("buscarDocumentosCotizacion error", err);
    return { source: "quotation_documents", status: "error", query, records: [], total: 0, message: safeErrorMessage(err) };
  }
}

// ── Proyecto / código genérico (cascada cotización → RQ → PT → histórico) ─────

export async function buscarProyectoPorCodigo(code: string, deps?: ContextToolDeps): Promise<ProyectoToolResult> {
  const query: Record<string, unknown> = { code };
  try {
    contextDb(deps);
    if (
      !canViewModule(deps, "cotizaciones") &&
      !canViewModule(deps, "requerimientos") &&
      !canViewRequirementItems(deps) &&
      !canViewModule(deps, "technical_proposals")
    ) {
      forbiddenError();
    }
    const reference = await fetchProjectContextByCode(code, contextDb(deps), {
      canQueryCotizaciones: canViewModule(deps, "cotizaciones"),
      canQueryRequerimientos: canViewModule(deps, "requerimientos"),
      canQueryRequirementItems: canViewRequirementItems(deps),
      canQueryTechnicalProposals: canViewModule(deps, "technical_proposals"),
      canQueryRequirementCosts: itemPermissions(deps).can_view_prices,
    });
    const status: ContextToolStatus = reference.source === "none" ? "empty" : "success";
    const total =
      reference.historicalSummary?.total ??
      reference.requirements?.length ??
      (reference.cotizacion ? 1 : 0);
    const projectPermissions = permissionsFor(deps, "requerimientos");
    const redactedReference: ProjectReferenceResult = {
      ...reference,
      cotizacion: reference.cotizacion ? redactCotizacion(reference.cotizacion, deps) : undefined,
      historicalSummary: reference.historicalSummary
        ? {
            ...reference.historicalSummary,
            totalCosto: projectPermissions.can_view_prices ? reference.historicalSummary.totalCosto : 0,
          }
        : undefined,
      similarCotizaciones: reference.similarCotizaciones ? redactCotizaciones(reference.similarCotizaciones, deps) : undefined,
    };
    return { source: "proyecto", status, query, code, reference: redactedReference, records: [], total };
  } catch (err) {
    devLog("buscarProyectoPorCodigo error", err);
    return {
      source: "proyecto", status: "error", query, code,
      reference: { source: "none" }, records: [], total: 0, message: safeErrorMessage(err),
    };
  }
}

// Resumen de proyecto: cascada por código + (si resolvió a una cotización)
// los requerimientos relacionados, para responder "dame el resumen de X".
export async function obtenerResumenProyecto(code: string, deps?: ContextToolDeps): Promise<ProyectoToolResult> {
  const base = await buscarProyectoPorCodigo(code, deps);
  if (base.status !== "success") return base;

  // Solo enriquecemos cuando el código resolvió a una cotización concreta:
  // ahí tiene sentido traer sus requerimientos asociados.
  const cotCodigo = base.reference.cotizacion?.codigo;
  if (!cotCodigo) return base;

  try {
    if (!canViewModule(deps, "requerimientos")) return base;
    const related = await searchRequerimientos({ q: cotCodigo }, DEFAULT_CONTEXT_LIMIT, contextDb(deps));
    return { ...base, relatedRequerimientos: related.items };
  } catch (err) {
    devLog("obtenerResumenProyecto related error", err);
    return base; // El resumen base sigue siendo válido aunque falle el enriquecido.
  }
}
