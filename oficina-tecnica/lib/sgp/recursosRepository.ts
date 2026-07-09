import { demoData, type Recurso, type ResourceFileMeta } from "@/lib/sgp/demoData";
import { supabase } from "@/lib/sgp/supabaseClient";
import { authFetch } from "@/lib/api/authFetch";

export type RecursosDataSource = "supabase" | "demo";
export type RecursoSortField =
  | "codigo_recurso"
  | "descripcion"
  | "tipo_recurso_nombre"
  | "precio_unitario_ref"
  | "estado"
  | "proveedor_nombre"
  | "marca_nombre"
  | "fecha_actualizacion";
export type RecursoSortDirection = "asc" | "desc";

export type RecursosColumnFilters = {
  codigoRecurso: string;
  codigoEka: string;
  codigoFabricante: string;
  descripcion: string;
  proveedor: string;
  marca: string;
  modelo: string;
  tipoRecurso: string;
  estado: string;
  moneda: string;
};

export type RecursosQueryParams = {
  search?: string;
  showInactive?: boolean;
  codigoRecurso?: string;
  codigoEka?: string;
  codigoFabricante?: string;
  descripcion?: string;
  proveedor?: string;
  marca?: string;
  modelo?: string;
  tipoRecurso?: string;
  estado?: string;
  moneda?: string;
  sortBy?: RecursoSortField;
  sortDirection?: RecursoSortDirection;
  page?: number;
  pageSize?: number;
};

export type RecursosListResult = {
  rows: Recurso[];
  total: number;
  page: number;
  pageSize: number;
  source: RecursosDataSource;
  warning?: string;
};

export type RecursosAllResult = {
  rows: Recurso[];
  source: RecursosDataSource;
  warning?: string;
};

export function buildSequentialResourceCode(year = new Date().getFullYear(), correlativo = 1): string {
  return `REC-${year}-${String(Math.max(1, correlativo)).padStart(4, "0")}`;
}

export type ResourceStorageFileCategory = "image" | "datasheet" | "attachment" | "quotation";

type StoredResourceFile = {
  bucket_id?: string;
  storage_path?: string;
  drive_file_id?: string;
  drive_folder_id?: string;
  drive_url?: string;
  drive_web_content_link?: string | null;
  file_name: string;
  file_type: ResourceStorageFileCategory;
  mime_type: string | null;
  size: number | null;
  uploaded_at: string;
};

export type RecursoWritePayload = Pick<
  Recurso,
  | "codigo_recurso"
  | "codigo_eka"
  | "codigo_fabricante"
  | "tipo_recurso"
  | "descripcion"
  | "unidad"
  | "precio_unitario_ref"
  | "moneda"
  | "proveedor"
  | "marca"
  | "modelo"
  | "tiempo_entrega_ref"
  | "estado"
  | "fecha_actualizacion"
  | "observaciones"
  | "ficha_tecnica"
  | "imagen"
  | "archivos"
  | "resourceFiles"
>;

export class RecursoWriteError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "missing_required_fields"
      | "duplicate_code"
      | "not_found"
      | "supabase_not_configured"
      | "rls_denied"
      | "schema_error"
      | "supabase_error"
      | "drive_error",
  ) {
    super(message);
    this.name = "RecursoWriteError";
  }
}

export type RecursosFilterOptions = {
  tipos: string[];
  estados: string[];
  monedas: string[];
  proveedores: string[];
  marcas: string[];
  source: RecursosDataSource;
  warning?: string;
};

export const RESOURCE_CODE_PREFIX_BY_TYPE: Record<string, string> = {
  "alimentación": "ALI",
  "antecedentes policiales": "ANT",
  "capacitaciones": "CAP",
  "consumibles": "CON",
  "cursos de inducción": "IND",
  "cursos eka": "CEK",
  "epps": "EPP",
  "equipos": "EQP",
  "examen médico": "EXM",
  "gastos generales": "GGE",
  "herramientas": "HER",
  "lavado de uniforme": "LAV",
  "mano de obra directa": "MOD",
  "mano de obra indirecta": "MOI",
  "materiales": "MAT",
  "reglamento de ingreso": "RIN",
  "sub contratos": "SUB",
  "subcontratos": "SUB",
  "transporte": "TRA",
  "vehículos": "VEH",
};

export function getResourcePrefixByType(tipoRecurso: string): string | null {
  const normalizedType = tipoRecurso.trim().toLowerCase();
  return RESOURCE_CODE_PREFIX_BY_TYPE[normalizedType] ?? null;
}

export function buildResourceCode(tipoRecurso: string, year: number, correlativo: number): string | null {
  const prefix = getResourcePrefixByType(tipoRecurso);
  if (!prefix || !Number.isInteger(year) || !Number.isInteger(correlativo) || correlativo < 1) {
    return null;
  }

  return `${prefix}-${year}-${String(correlativo).padStart(4, "0")}`;
}

export function validateResourceCodeFormat(codigoRecurso: string): boolean {
  return /^(ALI|ANT|CAP|CEK|CON|EPP|EQP|EXM|GGE|HER|IND|LAV|MAT|MOD|MOI|RIN|SUB|TRA|VEH)-\d{4}-\d{4}$/.test(
    codigoRecurso.trim(),
  );
}

type RecursoMetadata = {
  ficha_tecnica?: string | null;
  imagen?: string | null;
  archivos?: string[];
  resource_files?: {
    image?: StoredResourceFile[];
    datasheet?: StoredResourceFile[];
    attachments?: StoredResourceFile[];
    quotations?: StoredResourceFile[];
  };
  documentos_pendientes_migracion?: boolean;
  [key: string]: unknown;
};

type SupabaseRecurso = {
  id: string;
  codigo_recurso: string;
  codigo_eka: string | null;
  codigo_fabricante: string | null;
  tipo_recurso_id: string | null;
  tipo_recurso_nombre: string | null;
  descripcion: string;
  unidad_id: string | null;
  unidad_codigo: string | null;
  precio_unitario_ref: number | null;
  moneda_codigo: "PEN" | "USD" | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  marca_id: string | null;
  marca_nombre: string | null;
  modelo: string | null;
  tiempo_entrega_ref: string | null;
  estado: string | null;
  fecha_actualizacion: string | null;
  observaciones: string | null;
  metadata: RecursoMetadata | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseResourcePayload = {
  codigo_recurso: string;
  codigo_eka: string | null;
  codigo_fabricante: string | null;
  tipo_recurso_id: string | null;
  tipo_recurso_nombre: string | null;
  descripcion: string;
  unidad_id: string | null;
  unidad_codigo: string | null;
  precio_unitario_ref: number;
  moneda_codigo: "PEN" | "USD";
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  marca_id: string | null;
  marca_nombre: string | null;
  modelo: string | null;
  tiempo_entrega_ref: string | null;
  estado: "Activo" | "Inactivo" | "Por revisar";
  fecha_actualizacion: string | null;
  observaciones: string | null;
  metadata: RecursoMetadata;
};

const RESOURCE_SELECT = `
  id,
  codigo_recurso,
  codigo_eka,
  codigo_fabricante,
  tipo_recurso_id,
  tipo_recurso_nombre,
  descripcion,
  unidad_id,
  unidad_codigo,
  precio_unitario_ref,
  moneda_codigo,
  proveedor_id,
  proveedor_nombre,
  marca_id,
  marca_nombre,
  modelo,
  tiempo_entrega_ref,
  estado,
  fecha_actualizacion,
  observaciones,
  metadata,
  deleted_at,
  created_at,
  updated_at
`;

const ALLOWED_SORT_FIELDS: RecursoSortField[] = [
  "codigo_recurso",
  "descripcion",
  "tipo_recurso_nombre",
  "precio_unitario_ref",
  "estado",
  "proveedor_nombre",
  "marca_nombre",
  "fecha_actualizacion",
];

const SEARCH_FIELDS = [
  "codigo_recurso",
  "codigo_eka",
  "codigo_fabricante",
  "descripcion",
  "proveedor_nombre",
  "marca_nombre",
  "modelo",
];

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNullableString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeResourceStatus(value: string): "Activo" | "Inactivo" | "Por revisar" {
  if (value === "Inactivo" || value === "Por revisar") return value;
  return "Activo";
}

function removeUndefinedValues<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T;
}

type SerializedSupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
};

function serializeSupabaseError(error: unknown): SerializedSupabaseError {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }
  const values = error as Record<string, unknown>;
  return {
    message: typeof values.message === "string" ? values.message : "Error de Supabase.",
    code: typeof values.code === "string" ? values.code : undefined,
    details: typeof values.details === "string" ? values.details : undefined,
    hint: typeof values.hint === "string" ? values.hint : undefined,
    status: typeof values.status === "number" ? values.status : undefined,
  };
}

function classifySupabaseWriteError(error: SerializedSupabaseError): RecursoWriteError["code"] {
  const message = error.message.toLowerCase();
  if (error.code === "23505" || message.includes("duplicate") || message.includes("unique")) return "duplicate_code";
  if (error.code === "42501" || message.includes("row-level security") || message.includes("permission denied")) return "rls_denied";
  if (error.code === "42703" || message.includes("column") || message.includes("schema cache")) return "schema_error";
  return "supabase_error";
}

function writeErrorMessage(error: SerializedSupabaseError): string {
  const code = classifySupabaseWriteError(error);
  if (code === "duplicate_code") return "Ya existe un recurso con ese código.";
  if (code === "rls_denied") return "Supabase rechazó la operación por permisos RLS. Verifica permisos de creación/edición en Recursos.";
  if (code === "schema_error") return `Supabase rechazó el payload por una columna no disponible: ${error.message}`;
  return `No se pudo guardar el recurso: ${error.message}`;
}

function fileReference(file: ResourceFileMeta | null | undefined): string | null {
  if (!file) return null;
  return normalizeString(file.futureDriveUrl || file.futureDriveFileId || file.storage_path || file.name) || null;
}

function fileReferences(files: ResourceFileMeta[] | undefined): string[] {
  return (files ?? []).map(fileReference).filter((value): value is string => Boolean(value));
}

function splitStoredReferences(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function storedFileFromMeta(file: ResourceFileMeta, category: ResourceStorageFileCategory): StoredResourceFile | null {
  const driveFileId = normalizeString(file.futureDriveFileId);
  const storagePath = normalizeString(file.storage_path);
  if (!driveFileId && !storagePath) return null;
  return {
    bucket_id: file.bucket_id,
    storage_path: file.storage_path,
    drive_file_id: driveFileId || undefined,
    drive_folder_id: file.driveFolderId,
    drive_url: file.futureDriveUrl || undefined,
    drive_web_content_link: file.driveWebContentLink ?? null,
    file_name: file.file_name || file.name,
    file_type: category,
    mime_type: file.mime_type || file.type || null,
    size: Number.isFinite(file.size) ? file.size : null,
    uploaded_at: file.uploaded_at || new Date().toISOString(),
  };
}

function storedFilesFromMeta(files: ResourceFileMeta[], category: ResourceStorageFileCategory): StoredResourceFile[] {
  return files.map((file) => storedFileFromMeta(file, category)).filter((file): file is StoredResourceFile => Boolean(file));
}

function fileMetaFromStoredFile(file: StoredResourceFile): ResourceFileMeta {
  return {
    name: file.file_name,
    size: file.size ?? 0,
    type: file.mime_type || "application/octet-stream",
    localPreviewUrl: "",
    futureDriveFileId: file.drive_file_id ?? "",
    futureDriveUrl: file.drive_url ?? "",
    driveFolderId: file.drive_folder_id,
    driveWebContentLink: file.drive_web_content_link ?? undefined,
    bucket_id: file.bucket_id,
    storage_path: file.storage_path,
    file_name: file.file_name,
    file_type: file.file_type,
    mime_type: file.mime_type ?? undefined,
    uploaded_at: file.uploaded_at,
  };
}

function storedFilesFromUnknown(value: unknown): StoredResourceFile[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is StoredResourceFile => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    return (
      (typeof row.drive_file_id === "string" || typeof row.storage_path === "string") &&
      typeof row.file_name === "string" &&
      typeof row.file_type === "string"
    );
  });
}

function buildResourceMetadata(row: RecursoWritePayload, existingMetadata?: RecursoMetadata | null): RecursoMetadata {
  const fichas = row.resourceFiles.fichasTecnicas ?? (row.resourceFiles.fichaTecnica ? [row.resourceFiles.fichaTecnica] : []);
  const imagenes = row.resourceFiles.imagenes ?? (row.resourceFiles.imagen ? [row.resourceFiles.imagen] : []);
  const cotizaciones = row.resourceFiles.cotizaciones ?? (row.resourceFiles.cotizacion ? [row.resourceFiles.cotizacion] : []);
  const fichaTecnica = fileReference(fichas[0]) ?? toNullableString(row.ficha_tecnica);
  const imagen = fileReference(imagenes[0]) ?? toNullableString(row.imagen);
  const archivos = fileReferences(row.resourceFiles.archivos);
  const datasheetFiles = storedFilesFromMeta(fichas, "datasheet");
  const imageFiles = storedFilesFromMeta(imagenes, "image");
  const quotationFiles = storedFilesFromMeta(cotizaciones, "quotation");
  const attachmentFiles = storedFilesFromMeta(row.resourceFiles.archivos, "attachment");

  return {
    ...(existingMetadata ?? {}),
    ficha_tecnica: fichaTecnica,
    imagen,
    archivos: archivos.length > 0 ? archivos : splitStoredReferences(row.archivos),
    resource_files: {
      ...((existingMetadata?.resource_files ?? {}) as RecursoMetadata["resource_files"]),
      datasheet: datasheetFiles,
      image: imageFiles,
      quotations: quotationFiles,
      attachments: attachmentFiles,
    },
  };
}

function buildSupabaseResourcePayload(row: RecursoWritePayload, existingMetadata?: RecursoMetadata | null): SupabaseResourcePayload {
  const codigoRecurso = normalizeString(row.codigo_recurso);
  const descripcion = normalizeString(row.descripcion);
  if (!codigoRecurso || !descripcion) {
    throw new RecursoWriteError("Código de recurso y descripción son obligatorios.", "missing_required_fields");
  }

  return removeUndefinedValues({
    codigo_recurso: codigoRecurso,
    codigo_eka: toNullableString(row.codigo_eka),
    codigo_fabricante: toNullableString(row.codigo_fabricante),
    tipo_recurso_id: null,
    tipo_recurso_nombre: toNullableString(row.tipo_recurso),
    descripcion,
    unidad_id: null,
    unidad_codigo: toNullableString(row.unidad),
    precio_unitario_ref: Number.isFinite(row.precio_unitario_ref) ? Number(row.precio_unitario_ref) : 0,
    moneda_codigo: row.moneda === "USD" ? "USD" : "PEN",
    proveedor_id: null,
    proveedor_nombre: toNullableString(row.proveedor),
    marca_id: null,
    marca_nombre: toNullableString(row.marca),
    modelo: toNullableString(row.modelo),
    tiempo_entrega_ref: toNullableString(row.tiempo_entrega_ref),
    estado: normalizeResourceStatus(row.estado),
    fecha_actualizacion: toNullableString(row.fecha_actualizacion) ?? new Date().toISOString().slice(0, 10),
    observaciones: toNullableString(row.observaciones),
    metadata: buildResourceMetadata(row, existingMetadata),
  });
}

function debugResourceWrite(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  console.debug(`[recursosRepository] ${event}`, payload);
}

function summarizeResourceDocuments(metadata: RecursoMetadata | null | undefined): Record<string, unknown> {
  return {
    ficha_tecnica: metadata?.ficha_tecnica ?? null,
    imagen: metadata?.imagen ?? null,
    archivos: metadata?.archivos ?? [],
  };
}

function fileMetaFromName(name: string | null | undefined): ResourceFileMeta | null {
  if (!name) return null;
  const isUrl = /^https?:\/\//i.test(name);
  return {
    name: isUrl ? decodeURIComponent(name.split("/").filter(Boolean).at(-1) ?? name) : name,
    size: 0,
    type: "",
    localPreviewUrl: "",
    futureDriveFileId: isUrl ? "" : name,
    futureDriveUrl: isUrl ? name : "",
  };
}

function mapSupabaseRecurso(row: SupabaseRecurso): Recurso {
  const metadata = row.metadata ?? {};
  const resourceFiles = metadata.resource_files ?? {};
  const storedDatasheets = storedFilesFromUnknown(resourceFiles.datasheet);
  const storedImages = storedFilesFromUnknown(resourceFiles.image);
  const storedQuotations = storedFilesFromUnknown(resourceFiles.quotations);
  const storedAttachments = storedFilesFromUnknown(resourceFiles.attachments);
  const fichaTecnica = storedDatasheets[0] ? fileMetaFromStoredFile(storedDatasheets[0]) : fileMetaFromName(metadata.ficha_tecnica);
  const imagen = storedImages[0] ? fileMetaFromStoredFile(storedImages[0]) : fileMetaFromName(metadata.imagen);
  const cotizacion = storedQuotations[0] ? fileMetaFromStoredFile(storedQuotations[0]) : null;
  const archivos = storedAttachments.length
    ? storedAttachments.map(fileMetaFromStoredFile)
    : Array.isArray(metadata.archivos)
    ? metadata.archivos.map((name) => fileMetaFromName(name)).filter((item): item is ResourceFileMeta => Boolean(item))
    : [];
  const fichasTecnicas = storedDatasheets.length ? storedDatasheets.map(fileMetaFromStoredFile) : fichaTecnica ? [fichaTecnica] : [];
  const imagenes = storedImages.length ? storedImages.map(fileMetaFromStoredFile) : imagen ? [imagen] : [];
  const cotizaciones = storedQuotations.length ? storedQuotations.map(fileMetaFromStoredFile) : cotizacion ? [cotizacion] : [];

  return {
    id: row.id,
    codigo_recurso: row.codigo_recurso,
    codigo_eka: row.codigo_eka ?? "",
    codigo_fabricante: row.codigo_fabricante ?? "",
    tipo_recurso: row.tipo_recurso_nombre ?? "",
    descripcion: row.descripcion,
    unidad: row.unidad_codigo ?? "",
    precio_unitario_ref: Number(row.precio_unitario_ref ?? 0),
    moneda: row.moneda_codigo === "USD" ? "USD" : "PEN",
    proveedor: row.proveedor_nombre ?? "",
    marca: row.marca_nombre ?? "",
    modelo: row.modelo ?? "",
    tiempo_entrega_ref: row.tiempo_entrega_ref ?? "",
    ficha_tecnica: metadata.ficha_tecnica ?? "",
    imagen: metadata.imagen ?? "",
    archivos: Array.isArray(metadata.archivos) ? metadata.archivos.join(", ") : "",
    estado: row.estado === "Inactivo" || row.estado === "Por revisar" ? row.estado : "Activo",
    fecha_actualizacion: row.fecha_actualizacion ?? row.updated_at?.slice(0, 10) ?? "",
    observaciones: row.observaciones ?? "",
    resourceFiles: {
      fichaTecnica,
      imagen,
      cotizacion,
      fichasTecnicas,
      imagenes,
      cotizaciones,
      archivos,
    },
  };
}

function normalizeQuery(params: RecursosQueryParams = {}): Required<
  Pick<RecursosQueryParams, "sortBy" | "sortDirection" | "page" | "pageSize">
> &
  RecursosQueryParams {
  const requestedSort = params.sortBy;
  const sortBy = requestedSort && ALLOWED_SORT_FIELDS.includes(requestedSort) ? requestedSort : "codigo_recurso";
  const sortDirection = params.sortDirection === "desc" ? "desc" : "asc";
  const pageSize = [10, 20, 50].includes(Number(params.pageSize)) ? Number(params.pageSize) : 10;
  const page = Math.max(1, Number(params.page) || 1);

  return {
    ...params,
    sortBy,
    sortDirection,
    page,
    pageSize,
  };
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function filterDemoRows(rows: Recurso[], params: ReturnType<typeof normalizeQuery>): Recurso[] {
  const search = normalizeSearchText(params.search ?? "");
  return rows.filter((row) => {
    if (!params.showInactive && row.estado === "Inactivo") return false;
    if (params.tipoRecurso && row.tipo_recurso !== params.tipoRecurso) return false;
    if (params.estado && row.estado !== params.estado) return false;
    if (params.moneda && row.moneda !== params.moneda) return false;
    if (params.codigoRecurso && !normalizeSearchText(row.codigo_recurso).includes(normalizeSearchText(params.codigoRecurso))) {
      return false;
    }
    if (params.codigoEka && !normalizeSearchText(row.codigo_eka).includes(normalizeSearchText(params.codigoEka))) {
      return false;
    }
    if (
      params.codigoFabricante &&
      !normalizeSearchText(row.codigo_fabricante).includes(normalizeSearchText(params.codigoFabricante))
    ) {
      return false;
    }
    if (params.descripcion && !normalizeSearchText(row.descripcion).includes(normalizeSearchText(params.descripcion))) {
      return false;
    }
    if (params.proveedor && !normalizeSearchText(row.proveedor).includes(normalizeSearchText(params.proveedor))) {
      return false;
    }
    if (params.marca && !normalizeSearchText(row.marca).includes(normalizeSearchText(params.marca))) return false;
    if (params.modelo && !normalizeSearchText(row.modelo).includes(normalizeSearchText(params.modelo))) return false;
    if (!search) return true;

    return [
      row.codigo_recurso,
      row.codigo_eka,
      row.codigo_fabricante,
      row.descripcion,
      row.proveedor,
      row.marca,
      row.modelo,
    ].some((value) => normalizeSearchText(String(value ?? "")).includes(search));
  });
}

function sortDemoRows(rows: Recurso[], params: ReturnType<typeof normalizeQuery>): Recurso[] {
  const keyMap: Record<RecursoSortField, keyof Recurso> = {
    codigo_recurso: "codigo_recurso",
    descripcion: "descripcion",
    tipo_recurso_nombre: "tipo_recurso",
    precio_unitario_ref: "precio_unitario_ref",
    estado: "estado",
    proveedor_nombre: "proveedor",
    marca_nombre: "marca",
    fecha_actualizacion: "fecha_actualizacion",
  };
  const key = keyMap[params.sortBy];
  const direction = params.sortDirection === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const an = Number(av);
    const bn = Number(bv);
    if (Number.isFinite(an) && Number.isFinite(bn)) return (an - bn) * direction;
    return String(av ?? "").localeCompare(String(bv ?? ""), "es", { sensitivity: "base" }) * direction;
  });
}

function paginateRows(rows: Recurso[], page: number, pageSize: number): Recurso[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" }),
  );
}

function demoFilterOptions(): RecursosFilterOptions {
  const rows = demoData.listRecursos();
  return {
    tipos: uniqueSorted(rows.map((row) => row.tipo_recurso)),
    estados: uniqueSorted(rows.map((row) => row.estado)),
    monedas: uniqueSorted(rows.map((row) => row.moneda)),
    proveedores: uniqueSorted(rows.map((row) => row.proveedor)),
    marcas: uniqueSorted(rows.map((row) => row.marca)),
    source: "demo",
  };
}

export async function listRecursosFilterOptions(): Promise<RecursosFilterOptions> {
  if (!hasSupabaseConfig()) {
    return {
      ...demoFilterOptions(),
      warning: "No se encontraron variables públicas de Supabase; se usan filtros demo locales.",
    };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_recursos_filter_options");
  if (!rpcError && Array.isArray(rpcData) && rpcData[0]) {
    const row = rpcData[0] as {
      tipos?: string[];
      estados?: string[];
      monedas?: string[];
      proveedores?: string[];
      marcas?: string[];
    };
    return {
      tipos: row.tipos ?? [],
      estados: row.estados ?? [],
      monedas: row.monedas ?? [],
      proveedores: row.proveedores ?? [],
      marcas: row.marcas ?? [],
      source: "supabase",
    };
  }

  return {
    ...demoFilterOptions(),
    warning: rpcError
      ? `No se pudo ejecutar get_recursos_filter_options: ${rpcError.message}. Ejecuta supabase/sql/120_resource_files_and_filters.sql.`
      : "No se pudieron leer filtros desde Supabase. Ejecuta supabase/sql/120_resource_files_and_filters.sql.",
  };
}

export async function getNextResourceDraftCode(year = new Date().getFullYear()): Promise<string> {
  const prefix = `REC-${year}-`;
  if (!hasSupabaseConfig()) {
    const demoCodes = demoData
      .listRecursos()
      .map((item) => item.codigo_recurso)
      .filter((code) => code.startsWith(prefix));
    const max = Math.max(
      0,
      ...demoCodes
        .map((code) => Number(code.slice(prefix.length)))
        .filter((value) => Number.isFinite(value)),
    );
    return buildSequentialResourceCode(year, max + 1);
  }

  const { data, error } = await supabase
    .from("recursos")
    .select("codigo_recurso")
    .ilike("codigo_recurso", `${prefix}%`)
    .is("deleted_at", null)
    .order("codigo_recurso", { ascending: false })
    .limit(1);

  if (error) {
    const fallbackCode = demoData.nextResourceDraftCode();
    const fallbackNumber = Number(fallbackCode.slice(prefix.length));
    return buildSequentialResourceCode(year, Number.isFinite(fallbackNumber) ? fallbackNumber : 1);
  }

  const lastCode = data?.[0]?.codigo_recurso ? String(data[0].codigo_recurso) : "";
  const lastNumber = lastCode.startsWith(prefix) ? Number(lastCode.slice(prefix.length)) : 0;
  return buildSequentialResourceCode(year, Number.isFinite(lastNumber) ? lastNumber + 1 : 1);
}

export async function listRecursos(params: RecursosQueryParams = {}): Promise<RecursosListResult> {
  const query = normalizeQuery(params);
  if (!hasSupabaseConfig()) {
    const filtered = filterDemoRows(demoData.listRecursos(), query);
    const sorted = sortDemoRows(filtered, query);
    return {
      rows: paginateRows(sorted, query.page, query.pageSize),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
      source: "demo",
      warning: "No se encontraron variables públicas de Supabase; se usa data demo local.",
    };
  }

  let request = supabase
    .from("recursos")
    .select(RESOURCE_SELECT, { count: "exact" })
    .is("deleted_at", null);

  if (!query.showInactive) {
    request = request.neq("estado", "Inactivo");
  }

  if (query.search?.trim()) {
    const search = query.search.trim().replaceAll("%", "\\%").replaceAll("_", "\\_");
    request = request.or(SEARCH_FIELDS.map((field) => `${field}.ilike.%${search}%`).join(","));
  }

  const like = (value: string) => `%${value.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  if (query.codigoRecurso?.trim()) request = request.ilike("codigo_recurso", like(query.codigoRecurso));
  if (query.codigoEka?.trim()) request = request.ilike("codigo_eka", like(query.codigoEka));
  if (query.codigoFabricante?.trim()) request = request.ilike("codigo_fabricante", like(query.codigoFabricante));
  if (query.descripcion?.trim()) request = request.ilike("descripcion", like(query.descripcion));
  if (query.proveedor?.trim()) request = request.ilike("proveedor_nombre", like(query.proveedor));
  if (query.marca?.trim()) request = request.ilike("marca_nombre", like(query.marca));
  if (query.modelo?.trim()) request = request.ilike("modelo", like(query.modelo));

  if (query.tipoRecurso) request = request.eq("tipo_recurso_nombre", query.tipoRecurso);
  if (query.estado) request = request.eq("estado", query.estado);
  if (query.moneda) request = request.eq("moneda_codigo", query.moneda);

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  const { data, error, count } = await request
    .order(query.sortBy, { ascending: query.sortDirection === "asc", nullsFirst: false })
    .range(from, to);

  if (error) {
    const filtered = filterDemoRows(demoData.listRecursos(), query);
    const sorted = sortDemoRows(filtered, query);
    return {
      rows: paginateRows(sorted, query.page, query.pageSize),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
      source: "demo",
      warning: `No se pudo leer public.recursos desde Supabase: ${error.message}. Se usa data demo local.`,
    };
  }

  return {
    rows: (data ?? []).map((row) => mapSupabaseRecurso(row as SupabaseRecurso)),
    total: count ?? 0,
    page: query.page,
    pageSize: query.pageSize,
    source: "supabase",
  };
}

export async function listAllRecursos(): Promise<RecursosAllResult> {
  if (!hasSupabaseConfig()) {
    return {
      rows: demoData.listRecursos(),
      source: "demo",
      warning: "No se encontraron variables públicas de Supabase; se usa data demo local.",
    };
  }

  const batchSize = 1000;
  let from = 0;
  const rows: SupabaseRecurso[] = [];

  while (true) {
    const to = from + batchSize - 1;
    const { data, error } = await supabase
      .from("recursos")
      .select(RESOURCE_SELECT)
      .is("deleted_at", null)
      .order("codigo_recurso", { ascending: true })
      .range(from, to);

    if (error) {
      return {
        rows: demoData.listRecursos(),
        source: "demo",
        warning: `No se pudo leer public.recursos desde Supabase: ${error.message}. Se usa data demo local.`,
      };
    }

    const chunk = (data ?? []) as SupabaseRecurso[];
    rows.push(...chunk);
    if (chunk.length < batchSize) break;
    from += batchSize;
  }

  return {
    rows: rows.map(mapSupabaseRecurso),
    source: "supabase",
  };
}

export async function uploadResourceFile(
  resourceId: string,
  category: ResourceStorageFileCategory,
  file: File,
): Promise<ResourceFileMeta> {
  const form = new FormData();
  form.append("file", file);
  form.append("entityType", "resource");
  form.append("entityCode", resourceId);
  form.append("category", category);

  const response = await authFetch("/api/drive/upload", {
    method: "POST",
    body: form,
  });
  const result = (await response.json()) as {
    file_id?: string;
    name?: string;
    mime_type?: string;
    size?: number;
    folder_id?: string;
    web_view_link?: string;
    web_content_link?: string | null;
    error?: string;
  };

  if (!response.ok || !result.file_id) {
    throw new RecursoWriteError(
      result.error ?? "No se pudo subir el archivo a Google Drive.",
      "drive_error",
    );
  }

  return {
    name: file.name,
    size: result.size ?? file.size,
    type: result.mime_type || file.type || "application/octet-stream",
    localPreviewUrl: "",
    futureDriveFileId: result.file_id,
    futureDriveUrl: result.web_view_link ?? `https://drive.google.com/file/d/${result.file_id}/view`,
    driveFolderId: result.folder_id,
    driveWebContentLink: result.web_content_link ?? undefined,
    file_name: file.name,
    file_type: category,
    mime_type: result.mime_type || file.type || "application/octet-stream",
    uploaded_at: new Date().toISOString(),
  };
}

export async function createResourceFileSignedUrl(file: ResourceFileMeta): Promise<string | null> {
  if (file.localPreviewUrl) return file.localPreviewUrl;
  if (file.futureDriveUrl) return file.futureDriveUrl;
  if (file.futureDriveFileId) return `https://drive.google.com/file/d/${file.futureDriveFileId}/view`;
  return null;
}

export async function createRecurso(row: RecursoWritePayload): Promise<Recurso> {
  if (!hasSupabaseConfig()) {
    throw new RecursoWriteError("Supabase no está configurado para crear recursos reales.", "supabase_not_configured");
  }

  const payload = buildSupabaseResourcePayload(row);

  debugResourceWrite("create payload", {
    payloadKeys: Object.keys(payload),
    codigo_recurso: payload.codigo_recurso,
    updatedDocuments: summarizeResourceDocuments(payload.metadata),
    finalMetadata: payload.metadata,
  });

  const { data: existing, error: duplicateError } = await supabase
    .from("recursos")
    .select("id,codigo_recurso")
    .eq("codigo_recurso", payload.codigo_recurso)
    .is("deleted_at", null)
    .maybeSingle();

  if (duplicateError) {
    const serialized = serializeSupabaseError(duplicateError);
    debugResourceWrite("duplicate check error", { codigo_recurso: payload.codigo_recurso, error: serialized });
    throw new RecursoWriteError(writeErrorMessage(serialized), classifySupabaseWriteError(serialized));
  }

  if (existing) {
    throw new RecursoWriteError(`Ya existe un recurso con el código ${payload.codigo_recurso}.`, "duplicate_code");
  }

  const { data, error } = await supabase
    .from("recursos")
    .insert(payload)
    .select(RESOURCE_SELECT)
    .single();

  if (error) {
    const serialized = serializeSupabaseError(error);
    debugResourceWrite("create error", {
      payloadKeys: Object.keys(payload),
      codigo_recurso: payload.codigo_recurso,
      updatedDocuments: summarizeResourceDocuments(payload.metadata),
      finalMetadata: payload.metadata,
      error: serialized,
    });
    throw new RecursoWriteError(writeErrorMessage(serialized), classifySupabaseWriteError(serialized));
  }

  const created = mapSupabaseRecurso(data as SupabaseRecurso);
  debugResourceWrite("created", {
    id: created.id,
    codigo_recurso: created.codigo_recurso,
    updatedDocuments: summarizeResourceDocuments(payload.metadata),
    finalMetadata: payload.metadata,
    row: created,
  });
  return created;
}

export async function updateRecurso(id: string, row: RecursoWritePayload): Promise<Recurso> {
  if (!hasSupabaseConfig()) {
    throw new RecursoWriteError("Supabase no está configurado para editar recursos reales.", "supabase_not_configured");
  }

  const normalizedId = normalizeString(id);
  if (!normalizedId) {
    throw new RecursoWriteError("No se encontró el ID del recurso a editar.", "missing_required_fields");
  }

  const { data: current, error: currentError } = await supabase
    .from("recursos")
    .select("id,codigo_recurso,metadata")
    .eq("id", normalizedId)
    .is("deleted_at", null)
    .maybeSingle();

  if (currentError) {
    const serialized = serializeSupabaseError(currentError);
    debugResourceWrite("current read error", { id: normalizedId, error: serialized });
    throw new RecursoWriteError(writeErrorMessage(serialized), classifySupabaseWriteError(serialized));
  }

  if (!current) {
    throw new RecursoWriteError("No se encontró el recurso a editar.", "not_found");
  }

  const currentRow = current as { id: string; codigo_recurso: string; metadata: RecursoMetadata | null };
  const payload = buildSupabaseResourcePayload(row, currentRow.metadata);

  const { data: duplicate, error: duplicateError } = await supabase
    .from("recursos")
    .select("id,codigo_recurso")
    .eq("codigo_recurso", payload.codigo_recurso)
    .neq("id", normalizedId)
    .is("deleted_at", null)
    .maybeSingle();

  if (duplicateError) {
    const serialized = serializeSupabaseError(duplicateError);
    debugResourceWrite("duplicate check error", { id: normalizedId, codigo_recurso: payload.codigo_recurso, error: serialized });
    throw new RecursoWriteError(writeErrorMessage(serialized), classifySupabaseWriteError(serialized));
  }

  if (duplicate) {
    throw new RecursoWriteError(`Ya existe otro recurso con el código ${payload.codigo_recurso}.`, "duplicate_code");
  }

  debugResourceWrite("update payload", {
    id: normalizedId,
    payloadKeys: Object.keys(payload),
    codigo_recurso: payload.codigo_recurso,
    currentDocuments: summarizeResourceDocuments(currentRow.metadata),
    updatedDocuments: summarizeResourceDocuments(payload.metadata),
    finalMetadata: payload.metadata,
  });

  const { data, error } = await supabase
    .from("recursos")
    .update(payload)
    .eq("id", normalizedId)
    .select(RESOURCE_SELECT)
    .single();

  if (error) {
    const serialized = serializeSupabaseError(error);
    debugResourceWrite("update error", {
      id: normalizedId,
      payloadKeys: Object.keys(payload),
      codigo_recurso: payload.codigo_recurso,
      currentDocuments: summarizeResourceDocuments(currentRow.metadata),
      updatedDocuments: summarizeResourceDocuments(payload.metadata),
      finalMetadata: payload.metadata,
      error: serialized,
    });
    throw new RecursoWriteError(writeErrorMessage(serialized), classifySupabaseWriteError(serialized));
  }

  const updated = mapSupabaseRecurso(data as SupabaseRecurso);
  debugResourceWrite("updated", {
    id: updated.id,
    codigo_recurso: updated.codigo_recurso,
    currentDocuments: summarizeResourceDocuments(currentRow.metadata),
    updatedDocuments: summarizeResourceDocuments(payload.metadata),
    finalMetadata: payload.metadata,
    row: updated,
  });
  return updated;
}

export async function deactivateRecurso(id: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    throw new RecursoWriteError("Supabase no está configurado para desactivar recursos reales.", "supabase_not_configured");
  }

  const normalizedId = normalizeString(id);
  if (!normalizedId) {
    throw new RecursoWriteError("No se encontró el ID del recurso a desactivar.", "missing_required_fields");
  }

  const { data: current, error: currentError } = await supabase
    .from("recursos")
    .select("id,estado")
    .eq("id", normalizedId)
    .is("deleted_at", null)
    .maybeSingle();

  if (currentError) {
    const serialized = serializeSupabaseError(currentError);
    debugResourceWrite("deactivate current read error", { id: normalizedId, error: serialized });
    throw new RecursoWriteError(writeErrorMessage(serialized), classifySupabaseWriteError(serialized));
  }

  if (!current) {
    throw new RecursoWriteError("No se encontró el recurso a desactivar.", "not_found");
  }

  const { error } = await supabase
    .from("recursos")
    .update({
      estado: "Inactivo",
      updated_at: new Date().toISOString(),
    })
    .eq("id", normalizedId)
    .is("deleted_at", null);

  if (error) {
    const serialized = serializeSupabaseError(error);
    debugResourceWrite("deactivate error", { id: normalizedId, error: serialized });
    throw new RecursoWriteError(writeErrorMessage(serialized), classifySupabaseWriteError(serialized));
  }
}

export async function reactivateRecurso(id: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    throw new RecursoWriteError("Supabase no está configurado para reactivar recursos reales.", "supabase_not_configured");
  }

  const normalizedId = normalizeString(id);
  if (!normalizedId) {
    throw new RecursoWriteError("No se encontró el ID del recurso a reactivar.", "missing_required_fields");
  }

  const { data: current, error: currentError } = await supabase
    .from("recursos")
    .select("id,estado")
    .eq("id", normalizedId)
    .is("deleted_at", null)
    .maybeSingle();

  if (currentError) {
    const serialized = serializeSupabaseError(currentError);
    debugResourceWrite("reactivate current read error", { id: normalizedId, error: serialized });
    throw new RecursoWriteError(writeErrorMessage(serialized), classifySupabaseWriteError(serialized));
  }

  if (!current) {
    throw new RecursoWriteError("No se encontró el recurso a reactivar.", "not_found");
  }

  const { error } = await supabase
    .from("recursos")
    .update({
      estado: "Activo",
      updated_at: new Date().toISOString(),
    })
    .eq("id", normalizedId)
    .is("deleted_at", null);

  if (error) {
    const serialized = serializeSupabaseError(error);
    debugResourceWrite("reactivate error", { id: normalizedId, error: serialized });
    throw new RecursoWriteError(writeErrorMessage(serialized), classifySupabaseWriteError(serialized));
  }
}
