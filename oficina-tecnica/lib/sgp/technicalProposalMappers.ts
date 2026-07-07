import type { Cotizacion } from "@/lib/sgp/demoData";
import type { SaveFullTechnicalProposalPayload } from "@/lib/sgp/technicalProposalsRepository";

type TechnicalProposalScopeItemLike = {
  id: string;
  level: number;
  number: string;
  kind: "group" | "subgroup" | "activity";
  title: string;
  description: string;
  time_value: number;
  time_unit: string;
  complete: boolean;
  internal_comments: string;
};

type TechnicalProposalResourceLike = {
  id: string;
  scope_item_id: string;
  recurso_id: string | null;
  codigo_recurso: string;
  codigo_fabricante: string;
  tipo_recurso: string;
  resource_category: string;
  descripcion: string;
  unidad: string;
  precio_unitario_ref: number;
  moneda: "PEN" | "USD";
  proveedor: string;
  marca: string;
  cantidad: number;
  tiempo: number;
  comentario: string;
  detalle_adicional: string;
  estado_origen: "catalogo_copiado" | "nuevo_por_formalizar";
};

type TechnicalProposalImageLike = {
  id: string;
  scope_item_id: string | null;
  resource_id: string | null;
  title: string;
  relation_label: string;
  size: "1" | "2" | "4";
};

export type TechnicalProposalDraftLike = {
  metadata: {
    cotizacion_codigo: string;
    documento_codigo: string;
    documento_tipo: "PT";
    revision: "REV00";
    subcarpeta_revision: "02_PROPUESTA";
    archivo_docx: string;
    archivo_pdf: string;
    estructura_documental_version: "cotizacion_drive_v2";
  };
  mode: "cliente" | "interno";
  work_status: "Borrador" | "En proceso" | "Completado";
  header: Record<string, unknown> & { fecha?: string };
  recipient: Record<string, unknown>;
  presentation: Record<string, unknown>;
  conditions: Record<string, unknown>;
  scope_items: TechnicalProposalScopeItemLike[];
  resources: TechnicalProposalResourceLike[];
  general_images: TechnicalProposalImageLike[];
  activity_images: TechnicalProposalImageLike[];
  updated_at: string;
};

type ScopeItemWithOrder = TechnicalProposalScopeItemLike & {
  originalIndex: number;
  clientKey: string;
  parentClientKey: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toNullableUuid(value: unknown): string | null {
  const normalized = normalizeString(value);
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeTechnicalProposalItemClientKey(item: Pick<TechnicalProposalScopeItemLike, "id" | "number">): string {
  const rawKey = normalizeString(item.id) || `scope-${normalizeString(item.number).replace(/[^0-9a-z]+/gi, "-")}`;
  return rawKey || "scope-item";
}

export function sortTechnicalProposalItemsForRpc(items: TechnicalProposalScopeItemLike[]): ScopeItemWithOrder[] {
  const stackByLevel = new Map<number, ScopeItemWithOrder>();

  const prepared = items.map((item, originalIndex) => {
    const normalizedLevel = Math.max(0, Math.floor(toFiniteNumber(item.level, 0)));
    let parentClientKey: string | null = null;

    for (let level = normalizedLevel - 1; level >= 0; level -= 1) {
      const parent = stackByLevel.get(level);
      if (parent) {
        parentClientKey = parent.clientKey;
        break;
      }
    }

    const preparedItem: ScopeItemWithOrder = {
      ...item,
      level: normalizedLevel,
      originalIndex,
      clientKey: normalizeTechnicalProposalItemClientKey(item),
      parentClientKey,
    };

    stackByLevel.set(normalizedLevel, preparedItem);
    Array.from(stackByLevel.keys()).forEach((level) => {
      if (level > normalizedLevel) stackByLevel.delete(level);
    });

    return preparedItem;
  });

  return prepared.sort((left, right) => {
    if (left.level !== right.level) return left.level - right.level;
    return left.originalIndex - right.originalIndex;
  });
}

export function buildTechnicalProposalRpcPayload(
  draft: TechnicalProposalDraftLike,
  cotizacion: Cotizacion,
): SaveFullTechnicalProposalPayload {
  const cotizacionCodigo = normalizeString(draft.metadata.cotizacion_codigo || cotizacion.codigo);
  const code = normalizeString(draft.metadata.documento_codigo || `${cotizacionCodigo}-PT-REV00`);
  const orderedItems = sortTechnicalProposalItemsForRpc(draft.scope_items);
  const itemKeys = new Set(orderedItems.map((item) => item.clientKey));

  const proposal = {
    cotizacion_id: toNullableUuid(cotizacion.id),
    cotizacion_codigo: cotizacionCodigo,
    code,
    document_type: "PT",
    revision: draft.metadata.revision || "REV00",
    revision_folder: draft.metadata.subcarpeta_revision || "02_PROPUESTA",
    status: "Borrador",
    mode: draft.mode,
    work_status: draft.work_status,
    document_date: normalizeString(draft.header.fecha) || null,
    company_logo_id: null,
    client_logo_id: null,
    header: draft.header,
    recipient: draft.recipient,
    presentation: draft.presentation,
    commercial_terms: draft.conditions,
    metadata: {
      ...draft.metadata,
      app_source: "sgp-lite",
      save_strategy: "rpc_full_replace",
      local_updated_at: draft.updated_at,
      cotizacion_snapshot: {
        codigo: cotizacion.codigo,
        cliente: cotizacion.cliente,
        proyecto: cotizacion.proyecto,
        unidad_trabajo: cotizacion.unidad_trabajo,
      },
      images_summary: {
        general_images_count: draft.general_images.length,
        activity_images_count: draft.activity_images.length,
      },
    },
  };

  const items = orderedItems.map((item, index) => ({
    client_key: item.clientKey,
    parent_client_key: item.parentClientKey,
    item_type: item.kind,
    item_number: item.number,
    level: item.level,
    sort_order: index,
    title: item.title,
    technical_description: item.description || null,
    estimated_time_value: item.kind === "activity" ? toFiniteNumber(item.time_value, 0) : null,
    estimated_time_unit: item.kind === "activity" ? normalizeString(item.time_unit) || null : null,
    is_complete: Boolean(item.complete),
    internal_comments: item.internal_comments || null,
    metadata: {
      local_id: item.id,
      original_index: item.originalIndex,
    },
  }));

  const resources = draft.resources
    .filter((resource) => itemKeys.has(resource.scope_item_id))
    .map((resource, index) => ({
      client_item_key: resource.scope_item_id,
      resource_id: toNullableUuid(resource.recurso_id),
      resource_category: resource.resource_category,
      codigo_recurso: resource.codigo_recurso || null,
      codigo_fabricante: resource.codigo_fabricante || null,
      tipo_recurso: resource.tipo_recurso || null,
      descripcion: resource.descripcion,
      unidad: resource.unidad || null,
      cantidad: toFiniteNumber(resource.cantidad, 1),
      tiempo: toFiniteNumber(resource.tiempo, 0),
      precio_unitario_ref: toFiniteNumber(resource.precio_unitario_ref, 0),
      moneda_codigo: resource.moneda,
      proveedor: resource.proveedor || null,
      marca: resource.marca || null,
      comentario: resource.comentario || null,
      detalle_adicional: resource.detalle_adicional || null,
      origin_status: resource.estado_origen,
      sort_order: index,
      metadata: {
        local_id: resource.id,
        local_scope_item_id: resource.scope_item_id,
      },
    }));

  const files = [...draft.general_images, ...draft.activity_images].map((image) => ({
    file_type: image.scope_item_id ? "activity_image" : "general_image",
    client_item_key: image.scope_item_id ?? undefined,
    title: image.title || null,
    relation_label: image.relation_label || null,
    metadata: {
      local_id: image.id,
      resource_id: image.resource_id,
      size: image.size,
      omitted_data_url: true,
    },
  }));

  return {
    proposal,
    items,
    resources,
    files,
    eventMessage: "Propuesta tecnica guardada",
  };
}

export function validateTechnicalProposalRpcPayload(payload: SaveFullTechnicalProposalPayload): string | null {
  if (!normalizeString(payload.proposal.cotizacion_codigo)) return "Falta codigo de cotizacion.";
  if (!normalizeString(payload.proposal.code)) return "Falta codigo de propuesta tecnica.";
  if (!Array.isArray(payload.items)) return "La estructura de actividades no es valida.";
  if (!Array.isArray(payload.resources)) return "La estructura de recursos no es valida.";

  const itemKeys = new Set<string>();
  for (const item of payload.items) {
    const clientKey = normalizeString(item.client_key);
    if (!clientKey || !normalizeString(item.item_type) || !normalizeString(item.item_number) || !normalizeString(item.title)) {
      return "Falta informacion interna de actividades.";
    }
    itemKeys.add(clientKey);
  }

  for (const resource of payload.resources) {
    const clientItemKey = normalizeString(resource.client_item_key);
    if (!clientItemKey || !itemKeys.has(clientItemKey) || !normalizeString(resource.resource_category) || !normalizeString(resource.descripcion)) {
      return "Falta informacion interna de recursos.";
    }
  }

  return null;
}
