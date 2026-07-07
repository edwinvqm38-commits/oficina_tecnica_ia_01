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
} from "@/lib/chat/contextQuery";
import { getTechnicalProposalByCode } from "@/lib/sgp/technicalProposalsRepository";
import { listRecursos } from "@/lib/sgp/recursosRepository";
import { supabase } from "@/lib/sgp/supabaseClient";

// Límite máximo de registros que una herramienta devuelve al contexto IA.
export const DEFAULT_CONTEXT_LIMIT = 20;

export type ContextToolStatus = "success" | "empty" | "error" | "not_implemented";

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
  | CountToolResult
  | ProyectoToolResult;

function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") console.debug("[contextTools]", ...args);
}

// Normaliza cualquier excepción a un mensaje seguro (sin filtrar internals).
function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Error desconocido al consultar la base de datos.";
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
): Promise<CountToolResult> {
  const dateColumn: NonNullable<CountToolFilters["dateColumn"]> = filters.dateColumn ?? dateColumnForTable(table) ?? "created_at";
  const query: Record<string, unknown> = { ...filters, dateColumn };
  try {
    let request = supabase
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
): Promise<CotizacionesToolResult> {
  const query: Record<string, unknown> = { ...filters, limit: clampLimit(limit) };
  try {
    const result = await searchCotizacionesByFilters(filters, clampLimit(limit));
    if (result.items.length === 0) {
      return { source: "cotizaciones", status: "empty", query, records: [], total: 0 };
    }
    return { source: "cotizaciones", status: "success", query, records: result.items, total: result.total };
  } catch (err) {
    devLog("buscarCotizaciones error", err);
    return { source: "cotizaciones", status: "error", query, records: [], total: 0, message: safeErrorMessage(err) };
  }
}

export async function buscarCotizacionPorCodigo(code: string): Promise<CotizacionesToolResult> {
  const query: Record<string, unknown> = { codigo: code };
  try {
    const cot = await fetchCotizacionByCode(code);
    if (!cot) {
      return { source: "cotizaciones", status: "empty", query, records: [], total: 0 };
    }
    return { source: "cotizaciones", status: "success", query, records: [cot], total: 1 };
  } catch (err) {
    devLog("buscarCotizacionPorCodigo error", err);
    return { source: "cotizaciones", status: "error", query, records: [], total: 0, message: safeErrorMessage(err) };
  }
}

// ── Requerimientos ───────────────────────────────────────────────────────────

export async function buscarRequerimientos(
  filters: RequerimientoSearchFilters,
  limit = DEFAULT_CONTEXT_LIMIT,
): Promise<RequerimientosToolResult> {
  const query: Record<string, unknown> = { ...filters, limit: clampLimit(limit) };
  try {
    const result = await searchRequerimientos(filters, clampLimit(limit));
    if (result.items.length === 0) {
      return { source: "requerimientos", status: "empty", query, records: [], total: 0 };
    }
    return { source: "requerimientos", status: "success", query, records: result.items, total: result.total };
  } catch (err) {
    devLog("buscarRequerimientos error", err);
    return { source: "requerimientos", status: "error", query, records: [], total: 0, message: safeErrorMessage(err) };
  }
}

export async function buscarRequerimientoPorCodigo(code: string): Promise<RequerimientosToolResult> {
  const query: Record<string, unknown> = { codigo: code };
  try {
    const rq = await fetchRequirementByCode(code);
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
): Promise<RequerimientoItemsToolResult> {
  const query: Record<string, unknown> = { requerimiento_id: requerimientoId, limit: clampLimit(limit) };
  try {
    const items = await fetchRequirementItems(requerimientoId, clampLimit(limit));
    if (items.length === 0) {
      return { source: "requerimiento_items", status: "empty", query, records: [], total: 0, requerimientoCodigo };
    }
    return { source: "requerimiento_items", status: "success", query, records: items, total: items.length, requerimientoCodigo };
  } catch (err) {
    devLog("buscarItemsDeRequerimiento error", err);
    return { source: "requerimiento_items", status: "error", query, records: [], total: 0, message: safeErrorMessage(err), requerimientoCodigo };
  }
}

// ── Propuesta técnica ────────────────────────────────────────────────────────

export async function buscarPropuestaTecnicaPorCodigo(code: string): Promise<TechnicalProposalsToolResult> {
  const query: Record<string, unknown> = { code };
  try {
    const pt = await getTechnicalProposalByCode(code);
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

export async function buscarRecursos(
  filters: RecursosToolFilters,
  limit = DEFAULT_CONTEXT_LIMIT,
): Promise<RecursosToolResult> {
  const query: Record<string, unknown> = { ...filters, limit: clampLimit(limit) };
  try {
    const result = await listRecursos({
      search: filters.q,
      tipoRecurso: filters.tipoRecurso,
      estado: filters.estado,
      proveedor: filters.proveedor,
      marca: filters.marca,
      page: 1,
      pageSize: clampLimit(limit),
    });
    if (result.rows.length === 0) {
      return { source: "recursos", status: "empty", query, records: [], total: 0 };
    }
    // `listRecursos` devuelve filas con el shape de dominio `Recurso`
    // (tipo_recurso, moneda, proveedor, marca), no las columnas crudas de la BD.
    const lite: RecursoLite[] = result.rows.map((r) => ({
      image_url: (() => {
        const imageFile = r.resourceFiles.imagenes?.[0] ?? r.resourceFiles.imagen ?? null;
        const fileId = imageFile?.futureDriveFileId || driveFileIdFromUrl(imageFile?.futureDriveUrl ?? "");
        if (fileId) return internalDriveFileUrl(fileId);
        if (imageFile?.futureDriveUrl && /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(imageFile.futureDriveUrl)) return imageFile.futureDriveUrl;
        return null;
      })(),
      image_name: r.resourceFiles.imagenes?.[0]?.name ?? r.resourceFiles.imagen?.name ?? null,
      codigo_recurso: r.codigo_recurso,
      descripcion: r.descripcion,
      tipo_recurso_nombre: r.tipo_recurso ?? null,
      precio_unitario_ref: r.precio_unitario_ref ?? null,
      moneda_codigo: r.moneda ?? null,
      proveedor_nombre: r.proveedor ?? null,
      marca_nombre: r.marca ?? null,
      estado: r.estado ?? null,
    }));
    return { source: "recursos", status: "success", query, records: lite, total: result.total };
  } catch (err) {
    devLog("buscarRecursos error", err);
    return { source: "recursos", status: "error", query, records: [], total: 0, message: safeErrorMessage(err) };
  }
}

// ── Proyecto / código genérico (cascada cotización → RQ → PT → histórico) ─────

export async function buscarProyectoPorCodigo(code: string): Promise<ProyectoToolResult> {
  const query: Record<string, unknown> = { code };
  try {
    const reference = await fetchProjectContextByCode(code);
    const status: ContextToolStatus = reference.source === "none" ? "empty" : "success";
    const total =
      reference.historicalSummary?.total ??
      reference.requirements?.length ??
      (reference.cotizacion ? 1 : 0);
    return { source: "proyecto", status, query, code, reference, records: [], total };
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
export async function obtenerResumenProyecto(code: string): Promise<ProyectoToolResult> {
  const base = await buscarProyectoPorCodigo(code);
  if (base.status !== "success") return base;

  // Solo enriquecemos cuando el código resolvió a una cotización concreta:
  // ahí tiene sentido traer sus requerimientos asociados.
  const cotCodigo = base.reference.cotizacion?.codigo;
  if (!cotCodigo) return base;

  try {
    const related = await searchRequerimientos({ q: cotCodigo }, DEFAULT_CONTEXT_LIMIT);
    return { ...base, relatedRequerimientos: related.items };
  } catch (err) {
    devLog("obtenerResumenProyecto related error", err);
    return base; // El resumen base sigue siendo válido aunque falle el enriquecido.
  }
}
