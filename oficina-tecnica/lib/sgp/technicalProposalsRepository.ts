import { supabase } from "@/lib/sgp/supabaseClient";

type JsonObject = Record<string, unknown>;

export type TechnicalProposalStatus = "Borrador" | "En revision" | "Aprobada" | "Archivada";
export type TechnicalProposalWorkStatus = "Borrador" | "En proceso" | "Completado";
export type TechnicalProposalMode = "cliente" | "interno";
export type TechnicalProposalItemType = "group" | "subgroup" | "activity";
export type TechnicalProposalResourceOriginStatus = "catalogo_copiado" | "nuevo_por_formalizar" | "manual";
export type TechnicalProposalFileType =
  | "general_image"
  | "activity_image"
  | "resource_image"
  | "export_doc"
  | "export_pdf"
  | "export_html"
  | "export_json"
  | "other";
export type TechnicalProposalEventType =
  | "created"
  | "updated"
  | "status_changed"
  | "resource_assigned"
  | "resource_reused"
  | "logo_resolved"
  | "exported_word"
  | "exported_html"
  | "exported_json"
  | "printed_pdf"
  | "full_saved";

export type TechnicalProposalRecord = {
  id: string;
  cotizacion_id: string | null;
  cotizacion_codigo: string;
  code: string;
  document_type: "PT";
  revision: string;
  revision_folder: string;
  status: TechnicalProposalStatus;
  mode: TechnicalProposalMode;
  work_status: TechnicalProposalWorkStatus;
  document_date: string | null;
  company_logo_id: string | null;
  client_logo_id: string | null;
  header: JsonObject;
  recipient: JsonObject;
  presentation: JsonObject;
  commercial_terms: JsonObject;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type TechnicalProposalItemRecord = {
  id: string;
  technical_proposal_id: string;
  parent_id: string | null;
  item_type: TechnicalProposalItemType;
  item_number: string;
  level: number;
  sort_order: number;
  title: string;
  technical_description: string | null;
  estimated_time_value: number | null;
  estimated_time_unit: string | null;
  is_complete: boolean;
  internal_comments: string | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
};

export type TechnicalProposalResourceRecord = {
  id: string;
  technical_proposal_id: string;
  technical_proposal_item_id: string;
  resource_id: string | null;
  resource_category: string;
  codigo_recurso: string | null;
  codigo_fabricante: string | null;
  tipo_recurso: string | null;
  descripcion: string;
  unidad: string | null;
  cantidad: number;
  tiempo: number | null;
  precio_unitario_ref: number | null;
  moneda_codigo: string | null;
  proveedor: string | null;
  marca: string | null;
  comentario: string | null;
  detalle_adicional: string | null;
  origin_status: TechnicalProposalResourceOriginStatus;
  metadata: JsonObject;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TechnicalProposalFileRecord = {
  id: string;
  technical_proposal_id: string;
  technical_proposal_item_id: string | null;
  resource_snapshot_id: string | null;
  file_type: TechnicalProposalFileType;
  title: string | null;
  relation_label: string | null;
  storage_path: string | null;
  public_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  metadata: JsonObject;
  created_at: string;
  created_by: string | null;
};

export type TechnicalProposalEventRecord = {
  id: string;
  technical_proposal_id: string;
  event_type: TechnicalProposalEventType;
  event_message: string | null;
  old_status: string | null;
  new_status: string | null;
  actor_id: string | null;
  actor_email: string | null;
  metadata: JsonObject;
  created_at: string;
};

export type CreateTechnicalProposalInput = {
  cotizacion_id?: string | null;
  cotizacion_codigo: string;
  code: string;
  revision?: string;
  revision_folder?: string;
  status?: TechnicalProposalStatus;
  mode?: TechnicalProposalMode;
  work_status?: TechnicalProposalWorkStatus;
  document_date?: string | null;
  company_logo_id?: string | null;
  client_logo_id?: string | null;
  header?: JsonObject;
  recipient?: JsonObject;
  presentation?: JsonObject;
  commercial_terms?: JsonObject;
  metadata?: JsonObject;
  created_by?: string | null;
  updated_by?: string | null;
};

export type UpdateTechnicalProposalInput = Partial<
  Pick<
    CreateTechnicalProposalInput,
    | "cotizacion_codigo"
    | "code"
    | "revision"
    | "revision_folder"
    | "status"
    | "mode"
    | "work_status"
    | "document_date"
    | "company_logo_id"
    | "client_logo_id"
    | "header"
    | "recipient"
    | "presentation"
    | "commercial_terms"
    | "metadata"
    | "updated_by"
  >
>;

export type TechnicalProposalItemInput = {
  id?: string;
  parent_id?: string | null;
  item_type: TechnicalProposalItemType;
  item_number: string;
  level?: number;
  sort_order?: number;
  title: string;
  technical_description?: string | null;
  estimated_time_value?: number | null;
  estimated_time_unit?: string | null;
  is_complete?: boolean;
  internal_comments?: string | null;
  metadata?: JsonObject;
};

export type TechnicalProposalResourceInput = {
  id?: string;
  technical_proposal_item_id: string;
  resource_id?: string | null;
  resource_category: string;
  codigo_recurso?: string | null;
  codigo_fabricante?: string | null;
  tipo_recurso?: string | null;
  descripcion: string;
  unidad?: string | null;
  cantidad?: number;
  tiempo?: number | null;
  precio_unitario_ref?: number | null;
  moneda_codigo?: string | null;
  proveedor?: string | null;
  marca?: string | null;
  comentario?: string | null;
  detalle_adicional?: string | null;
  origin_status?: TechnicalProposalResourceOriginStatus;
  metadata?: JsonObject;
  sort_order?: number;
};

export type TechnicalProposalFileInput = {
  technical_proposal_id: string;
  technical_proposal_item_id?: string | null;
  resource_snapshot_id?: string | null;
  file_type: TechnicalProposalFileType;
  title?: string | null;
  relation_label?: string | null;
  storage_path?: string | null;
  public_url?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  metadata?: JsonObject;
  created_by?: string | null;
};

export type TechnicalProposalEventInput = {
  technical_proposal_id: string;
  event_type: TechnicalProposalEventType;
  event_message?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  actor_id?: string | null;
  actor_email?: string | null;
  metadata?: JsonObject;
};

export type SaveFullTechnicalProposalPayload = {
  proposal: JsonObject;
  items: JsonObject[];
  resources: JsonObject[];
  files?: JsonObject[];
  eventMessage?: string | null;
};

const TECHNICAL_PROPOSAL_SELECT = `
  id,
  cotizacion_id,
  cotizacion_codigo,
  code,
  document_type,
  revision,
  revision_folder,
  status,
  mode,
  work_status,
  document_date,
  company_logo_id,
  client_logo_id,
  header,
  recipient,
  presentation,
  commercial_terms,
  metadata,
  created_at,
  updated_at,
  created_by,
  updated_by
`;

const TECHNICAL_PROPOSAL_ITEMS_SELECT = `
  id,
  technical_proposal_id,
  parent_id,
  item_type,
  item_number,
  level,
  sort_order,
  title,
  technical_description,
  estimated_time_value,
  estimated_time_unit,
  is_complete,
  internal_comments,
  metadata,
  created_at,
  updated_at
`;

const TECHNICAL_PROPOSAL_RESOURCES_SELECT = `
  id,
  technical_proposal_id,
  technical_proposal_item_id,
  resource_id,
  resource_category,
  codigo_recurso,
  codigo_fabricante,
  tipo_recurso,
  descripcion,
  unidad,
  cantidad,
  tiempo,
  precio_unitario_ref,
  moneda_codigo,
  proveedor,
  marca,
  comentario,
  detalle_adicional,
  origin_status,
  metadata,
  sort_order,
  created_at,
  updated_at
`;

const TECHNICAL_PROPOSAL_EVENTS_SELECT = `
  id,
  technical_proposal_id,
  event_type,
  event_message,
  old_status,
  new_status,
  actor_id,
  actor_email,
  metadata,
  created_at
`;

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toObject(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function assertSupabaseConfigured(action: string) {
  if (!hasSupabaseConfig()) {
    throw new Error(`Supabase no está configurado para ${action}.`);
  }
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as Partial<T>;
}

function mapTechnicalProposal(row: TechnicalProposalRecord): TechnicalProposalRecord {
  return {
    ...row,
    header: toObject(row.header),
    recipient: toObject(row.recipient),
    presentation: toObject(row.presentation),
    commercial_terms: toObject(row.commercial_terms),
    metadata: toObject(row.metadata),
  };
}

function mapTechnicalProposalItem(row: TechnicalProposalItemRecord): TechnicalProposalItemRecord {
  return {
    ...row,
    metadata: toObject(row.metadata),
  };
}

function mapTechnicalProposalResource(row: TechnicalProposalResourceRecord): TechnicalProposalResourceRecord {
  return {
    ...row,
    metadata: toObject(row.metadata),
  };
}

function mapTechnicalProposalEvent(row: TechnicalProposalEventRecord): TechnicalProposalEventRecord {
  return {
    ...row,
    metadata: toObject(row.metadata),
  };
}

function buildTechnicalProposalHeaderPayload(input: CreateTechnicalProposalInput) {
  const cotizacionCodigo = normalizeString(input.cotizacion_codigo);
  const code = normalizeString(input.code);

  if (!cotizacionCodigo || !code) {
    throw new Error("cotizacion_codigo y code son obligatorios para crear una Propuesta Tecnica.");
  }

  return {
    cotizacion_id: input.cotizacion_id ?? null,
    cotizacion_codigo: cotizacionCodigo,
    code,
    document_type: "PT",
    revision: normalizeString(input.revision) || "REV00",
    revision_folder: normalizeString(input.revision_folder) || "01_REV00",
    status: input.status ?? "Borrador",
    mode: input.mode ?? "cliente",
    work_status: input.work_status ?? "Borrador",
    document_date: input.document_date ?? null,
    company_logo_id: input.company_logo_id ?? null,
    client_logo_id: input.client_logo_id ?? null,
    header: input.header ?? {},
    recipient: input.recipient ?? {},
    presentation: input.presentation ?? {},
    commercial_terms: input.commercial_terms ?? {},
    metadata: input.metadata ?? {},
    created_by: input.created_by ?? null,
    updated_by: input.updated_by ?? null,
  };
}

function buildTechnicalProposalPatch(patch: UpdateTechnicalProposalInput) {
  return stripUndefined({
    cotizacion_codigo: patch.cotizacion_codigo ? normalizeString(patch.cotizacion_codigo) : undefined,
    code: patch.code ? normalizeString(patch.code) : undefined,
    revision: patch.revision ? normalizeString(patch.revision) : undefined,
    revision_folder: patch.revision_folder ? normalizeString(patch.revision_folder) : undefined,
    status: patch.status,
    mode: patch.mode,
    work_status: patch.work_status,
    document_date: patch.document_date,
    company_logo_id: patch.company_logo_id,
    client_logo_id: patch.client_logo_id,
    header: patch.header,
    recipient: patch.recipient,
    presentation: patch.presentation,
    commercial_terms: patch.commercial_terms,
    metadata: patch.metadata,
    updated_by: patch.updated_by,
  });
}

function buildItemPayload(technicalProposalId: string, item: TechnicalProposalItemInput) {
  const itemNumber = normalizeString(item.item_number);
  const title = normalizeString(item.title);

  if (!itemNumber || !title) {
    throw new Error("item_number y title son obligatorios para guardar items de Propuesta Tecnica.");
  }

  return stripUndefined({
    id: item.id,
    technical_proposal_id: technicalProposalId,
    parent_id: item.parent_id ?? null,
    item_type: item.item_type,
    item_number: itemNumber,
    level: item.level ?? 0,
    sort_order: item.sort_order ?? 0,
    title,
    technical_description: item.technical_description ?? null,
    estimated_time_value: item.estimated_time_value ?? null,
    estimated_time_unit: item.estimated_time_unit ?? null,
    is_complete: item.is_complete ?? false,
    internal_comments: item.internal_comments ?? null,
    metadata: item.metadata ?? {},
  });
}

function buildResourcePayload(technicalProposalId: string, resource: TechnicalProposalResourceInput) {
  const resourceCategory = normalizeString(resource.resource_category);
  const descripcion = normalizeString(resource.descripcion);

  if (!resource.technical_proposal_item_id || !resourceCategory || !descripcion) {
    throw new Error("technical_proposal_item_id, resource_category y descripcion son obligatorios para guardar recursos PT.");
  }

  return stripUndefined({
    id: resource.id,
    technical_proposal_id: technicalProposalId,
    technical_proposal_item_id: resource.technical_proposal_item_id,
    resource_id: resource.resource_id ?? null,
    resource_category: resourceCategory,
    codigo_recurso: resource.codigo_recurso ?? null,
    codigo_fabricante: resource.codigo_fabricante ?? null,
    tipo_recurso: resource.tipo_recurso ?? null,
    descripcion,
    unidad: resource.unidad ?? null,
    cantidad: resource.cantidad ?? 1,
    tiempo: resource.tiempo ?? null,
    precio_unitario_ref: resource.precio_unitario_ref ?? null,
    moneda_codigo: resource.moneda_codigo ?? null,
    proveedor: resource.proveedor ?? null,
    marca: resource.marca ?? null,
    comentario: resource.comentario ?? null,
    detalle_adicional: resource.detalle_adicional ?? null,
    origin_status: resource.origin_status ?? "nuevo_por_formalizar",
    metadata: resource.metadata ?? {},
    sort_order: resource.sort_order ?? 0,
  });
}

export async function getTechnicalProposalByCotizacionRevision(
  cotizacionId: string,
  revision: string,
): Promise<TechnicalProposalRecord | null> {
  if (!hasSupabaseConfig()) return null;

  const normalizedRevision = normalizeString(revision) || "REV00";
  if (!cotizacionId) return null;

  const { data, error } = await supabase
    .from("technical_proposals")
    .select(TECHNICAL_PROPOSAL_SELECT)
    .eq("cotizacion_id", cotizacionId)
    .eq("revision", normalizedRevision)
    .maybeSingle();

  if (error) throw error;
  return data ? mapTechnicalProposal(data as TechnicalProposalRecord) : null;
}

export async function getTechnicalProposalByCode(code: string): Promise<TechnicalProposalRecord | null> {
  if (!hasSupabaseConfig()) return null;

  const normalizedCode = normalizeString(code);
  if (!normalizedCode) return null;

  const { data, error } = await supabase
    .from("technical_proposals")
    .select(TECHNICAL_PROPOSAL_SELECT)
    .eq("code", normalizedCode)
    .maybeSingle();

  if (error) throw error;
  return data ? mapTechnicalProposal(data as TechnicalProposalRecord) : null;
}

export async function createTechnicalProposalHeader(input: CreateTechnicalProposalInput): Promise<TechnicalProposalRecord> {
  assertSupabaseConfigured("crear cabeceras de Propuesta Tecnica");

  const payload = buildTechnicalProposalHeaderPayload(input);
  const { data, error } = await supabase.from("technical_proposals").insert(payload).select(TECHNICAL_PROPOSAL_SELECT).single();

  if (error) throw error;
  return mapTechnicalProposal(data as TechnicalProposalRecord);
}

export async function updateTechnicalProposalHeader(
  id: string,
  patch: UpdateTechnicalProposalInput,
): Promise<TechnicalProposalRecord> {
  assertSupabaseConfigured("actualizar cabeceras de Propuesta Tecnica");

  const payload = buildTechnicalProposalPatch(patch);
  if (!id || Object.keys(payload).length === 0) {
    throw new Error("id y al menos un campo son obligatorios para actualizar la Propuesta Tecnica.");
  }

  const { data, error } = await supabase
    .from("technical_proposals")
    .update(payload)
    .eq("id", id)
    .select(TECHNICAL_PROPOSAL_SELECT)
    .single();

  if (error) throw error;
  return mapTechnicalProposal(data as TechnicalProposalRecord);
}

export async function saveTechnicalProposalItems(
  technicalProposalId: string,
  items: TechnicalProposalItemInput[],
): Promise<TechnicalProposalItemRecord[]> {
  assertSupabaseConfigured("guardar items de Propuesta Tecnica");
  if (!technicalProposalId) throw new Error("technicalProposalId es obligatorio para guardar items PT.");
  if (items.length === 0) return [];

  const payload = items.map((item) => buildItemPayload(technicalProposalId, item));
  const { data, error } = await supabase
    .from("technical_proposal_items")
    .upsert(payload, { onConflict: "technical_proposal_id,item_number" })
    .select(TECHNICAL_PROPOSAL_ITEMS_SELECT);

  if (error) throw error;
  return ((data ?? []) as TechnicalProposalItemRecord[]).map(mapTechnicalProposalItem);
}

export async function saveTechnicalProposalResources(
  technicalProposalId: string,
  resources: TechnicalProposalResourceInput[],
): Promise<TechnicalProposalResourceRecord[]> {
  assertSupabaseConfigured("guardar recursos de Propuesta Tecnica");
  if (!technicalProposalId) throw new Error("technicalProposalId es obligatorio para guardar recursos PT.");
  if (resources.length === 0) return [];

  const payload = resources.map((resource) => buildResourcePayload(technicalProposalId, resource));
  const { data, error } = await supabase
    .from("technical_proposal_resources")
    .upsert(payload)
    .select(TECHNICAL_PROPOSAL_RESOURCES_SELECT);

  if (error) throw error;
  return ((data ?? []) as TechnicalProposalResourceRecord[]).map(mapTechnicalProposalResource);
}

export async function listTechnicalProposalItems(technicalProposalId: string): Promise<TechnicalProposalItemRecord[]> {
  if (!hasSupabaseConfig() || !technicalProposalId) return [];

  const { data, error } = await supabase
    .from("technical_proposal_items")
    .select(TECHNICAL_PROPOSAL_ITEMS_SELECT)
    .eq("technical_proposal_id", technicalProposalId)
    .order("sort_order", { ascending: true })
    .order("item_number", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as TechnicalProposalItemRecord[]).map(mapTechnicalProposalItem);
}

export async function listTechnicalProposalResources(technicalProposalId: string): Promise<TechnicalProposalResourceRecord[]> {
  if (!hasSupabaseConfig() || !technicalProposalId) return [];

  const { data, error } = await supabase
    .from("technical_proposal_resources")
    .select(TECHNICAL_PROPOSAL_RESOURCES_SELECT)
    .eq("technical_proposal_id", technicalProposalId)
    .order("resource_category", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as TechnicalProposalResourceRecord[]).map(mapTechnicalProposalResource);
}

export async function addTechnicalProposalFile(input: TechnicalProposalFileInput): Promise<TechnicalProposalFileRecord> {
  assertSupabaseConfigured("registrar archivos de Propuesta Tecnica");

  const { data, error } = await supabase
    .from("technical_proposal_files")
    .insert({
      technical_proposal_id: input.technical_proposal_id,
      technical_proposal_item_id: input.technical_proposal_item_id ?? null,
      resource_snapshot_id: input.resource_snapshot_id ?? null,
      file_type: input.file_type,
      title: input.title ?? null,
      relation_label: input.relation_label ?? null,
      storage_path: input.storage_path ?? null,
      public_url: input.public_url ?? null,
      mime_type: input.mime_type ?? null,
      file_size: input.file_size ?? null,
      metadata: input.metadata ?? {},
      created_by: input.created_by ?? null,
    })
    .select(
      `
        id,
        technical_proposal_id,
        technical_proposal_item_id,
        resource_snapshot_id,
        file_type,
        title,
        relation_label,
        storage_path,
        public_url,
        mime_type,
        file_size,
        metadata,
        created_at,
        created_by
      `,
    )
    .single();

  if (error) throw error;
  const row = data as TechnicalProposalFileRecord;
  return { ...row, metadata: toObject(row.metadata) };
}

export async function addTechnicalProposalEvent(input: TechnicalProposalEventInput): Promise<TechnicalProposalEventRecord> {
  assertSupabaseConfigured("registrar eventos de Propuesta Tecnica");

  const { data, error } = await supabase
    .from("technical_proposal_events")
    .insert({
      technical_proposal_id: input.technical_proposal_id,
      event_type: input.event_type,
      event_message: input.event_message ?? null,
      old_status: input.old_status ?? null,
      new_status: input.new_status ?? null,
      actor_id: input.actor_id ?? null,
      actor_email: input.actor_email ?? null,
      metadata: input.metadata ?? {},
    })
    .select(TECHNICAL_PROPOSAL_EVENTS_SELECT)
    .single();

  if (error) throw error;
  return mapTechnicalProposalEvent(data as TechnicalProposalEventRecord);
}

export async function saveFullTechnicalProposal(payload: SaveFullTechnicalProposalPayload): Promise<string> {
  assertSupabaseConfigured("guardar la Propuesta Tecnica completa");

  const { data, error } = await supabase.rpc("save_full_technical_proposal", {
    p_proposal: payload.proposal,
    p_items: payload.items,
    p_resources: payload.resources,
    p_files: payload.files ?? [],
    p_event_message: payload.eventMessage ?? "Propuesta tecnica guardada",
  });

  if (error) {
    throw new Error(`No se pudo guardar la Propuesta Tecnica en Supabase: ${error.message}`);
  }

  if (typeof data !== "string" || !data.trim()) {
    throw new Error("Supabase no devolvio el ID de la Propuesta Tecnica guardada.");
  }

  return data;
}
