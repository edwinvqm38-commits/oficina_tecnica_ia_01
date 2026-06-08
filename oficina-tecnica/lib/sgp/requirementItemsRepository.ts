import { demoData, type Cotizacion, type DetalleRequerimientoItem, type Requerimiento } from "@/lib/sgp/demoData";
import { readHistoricalImportQuality } from "@/lib/sgp/historicalImportQuality";
import { supabase } from "@/lib/sgp/supabaseClient";

export type RequirementItemsDataSource = "supabase" | "demo";

export type RequirementItemsListResult = {
  rows: Array<DetalleRequerimientoItem & { historical_import_quality?: ReturnType<typeof readHistoricalImportQuality> }>;
  total: number;
  source: RequirementItemsDataSource;
  warning?: string;
};

export type RequirementItemsContextRow = {
  item_id: string;
  requerimiento_id: string;
  codigo_rq: string;
  cotizacion_codigo: string;
  proyecto_servicio: string;
  oc: string;
  responsable: string;
  cliente: string;
  unidad_trabajo: string;
  historical_import_quality?: ReturnType<typeof readHistoricalImportQuality>;
};

type SupabaseRequirementItem = {
  id: string;
  requerimiento_id: string;
  recurso_id: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
  subtotal: number | null;
  ajuste: number | null;
  atencion_real: number | null;
  cant_stock: number | null;
  compra: number | null;
  costo_unitario: number | null;
  moneda_codigo: string | null;
  tc: number | null;
  factor_eq_herr: number | null;
  costo_total_presupuestado: number | null;
  fecha_coti: string | null;
  estado: string | null;
  informacion_adicional: string | null;
  observaciones_item: string | null;
  recurso_a_suministrar: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  condicion_pago: string | null;
  tiempo_entrega: string | null;
  eq: string | null;
  eq_fecha_aprob: string | null;
  ll: string | null;
  ll_fecha_aprob: string | null;
  hb: string | null;
  hb_fecha_aprob: string | null;
  logistica_compra: string | null;
  fecha_compra: string | null;
  oc_os_recurso: string | null;
  fecha_entrega: string | null;
  guia_remision: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type RequirementItemMetadata = Record<string, unknown> & {
  sgp_lite_item?: {
    recurso_id?: string;
    codigo_recurso?: string;
    codigo_fabricante?: string;
    tipo_recurso?: string;
    descripcion?: string;
    descripcion_visible?: string;
    unidad?: string;
    marca?: string;
    proveedor?: string;
    condicion_pago?: string;
    tiempo_entrega?: string;
    recurso_ficha_tecnica_files?: unknown;
    recurso_imagen_files?: unknown;
    recurso_archivos?: unknown;
    ficha_tecnica_a_suministrar?: unknown;
    ficha_tecnica_a_suministrar_files?: unknown;
    files?: unknown;
    eq?: string;
    eq_fecha_aprob?: string;
    ll?: string;
    ll_fecha_aprob?: string;
    hb?: string;
    hb_fecha_aprob?: string;
    logistica_compra?: string;
    fecha_compra?: string;
    oc_os_recurso?: string;
    fecha_entrega?: string;
    guia_remision?: string;
    archivo_guia?: unknown;
    archivo_guia_files?: unknown;
    saved_by?: string;
    saved_at?: string;
  };
};

type SupabaseRequirementItemPayload = {
  requerimiento_id: string;
  recurso_id: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  ajuste: number;
  atencion_real: number;
  cant_stock: number;
  compra: number;
  costo_unitario: number;
  moneda_codigo: "PEN" | "USD";
  tc: number;
  factor_eq_herr: number;
  costo_total_presupuestado: number;
  fecha_coti: string | null;
  estado: string;
  informacion_adicional: string | null;
  observaciones_item: string | null;
  recurso_a_suministrar: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  condicion_pago: string | null;
  tiempo_entrega: string | null;
  eq: string;
  eq_fecha_aprob: string | null;
  ll: string;
  ll_fecha_aprob: string | null;
  hb: string;
  hb_fecha_aprob: string | null;
  logistica_compra: string;
  fecha_compra: string | null;
  oc_os_recurso: string | null;
  fecha_entrega: string | null;
  guia_remision: string | null;
  metadata: RequirementItemMetadata;
};

type SupabaseRequirementRelation = Pick<
  Requerimiento,
  "id" | "codigo" | "cotizacion_id" | "cotizacion_codigo" | "proyecto_servicio" | "oc" | "responsable"
> & {
  metadata?: Record<string, unknown>;
};

type SupabaseQuotationRelation = Pick<Cotizacion, "id"> & {
  codigo: string;
  cliente_nombre: string | null;
  unidad_trabajo_nombre: string | null;
  metadata?: Record<string, unknown>;
};

const REQUIREMENT_ITEMS_SELECT = `
  id,
  requerimiento_id,
  recurso_id,
  cantidad,
  precio_unitario,
  subtotal,
  ajuste,
  atencion_real,
  cant_stock,
  compra,
  costo_unitario,
  moneda_codigo,
  tc,
  factor_eq_herr,
  costo_total_presupuestado,
  fecha_coti,
  estado,
  informacion_adicional,
  observaciones_item,
  recurso_a_suministrar,
  proveedor_id,
  proveedor_nombre,
  condicion_pago,
  tiempo_entrega,
  eq,
  eq_fecha_aprob,
  ll,
  ll_fecha_aprob,
  hb,
  hb_fecha_aprob,
  logistica_compra,
  fecha_compra,
  oc_os_recurso,
  fecha_entrega,
  guia_remision,
  metadata,
  created_at,
  updated_at
`;

const REQUIREMENT_RELATION_SELECT = `
  id,
  codigo,
  cotizacion_id,
  cotizacion_codigo,
  proyecto_servicio,
  oc,
  responsable,
  metadata
`;

const QUOTATION_RELATION_SELECT = `
  id,
  codigo,
  cliente_nombre,
  unidad_trabajo_nombre,
  metadata
`;

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readHistoricalItemSource(metadata: unknown): DetalleRequerimientoItem["historical_item_source"] {
  const metadataObject = toObject(metadata);
  const historicalImport = toObject(metadataObject.historical_import);
  const sourceItem = {
    ...toObject(metadataObject.source_item),
    ...toObject(historicalImport.source_item),
  };
  const moneda = normalizeString(sourceItem.moneda).toUpperCase();

  return {
    tipo_recurso: normalizeString(sourceItem.tipo_recurso),
    codigo_fabricante: normalizeString(sourceItem.codigo_fabricante),
    descripcion: normalizeString(sourceItem.descripcion),
    a_suministrar: normalizeString(sourceItem.a_suministrar),
    unidad: normalizeString(sourceItem.unidad),
    cantidad: normalizeNumber(sourceItem.cantidad),
    ajuste: normalizeNumber(sourceItem.ajuste),
    atencion_real: normalizeNumber(sourceItem.atencion_real),
    cant_stock: normalizeNumber(sourceItem.cant_stock),
    compra: normalizeNumber(sourceItem.compra),
    precio_unitario: normalizeNumber(sourceItem.precio_unitario),
    costo_unitario_dolar: normalizeNumber(sourceItem.costo_unitario_dolar),
    costo_unitario_soles: normalizeNumber(sourceItem.costo_unitario_soles),
    tipo_cambio: normalizeNumber(sourceItem.tipo_cambio),
    costo_total_presupuestado: normalizeNumber(sourceItem.costo_total_presupuestado),
    costo_total_presupuestado_usd: normalizeNumber(sourceItem.costo_total_presupuestado_usd),
    moneda: moneda === "USD" ? "USD" : moneda === "PEN" ? "PEN" : undefined,
    observaciones_item: normalizeString(sourceItem.observaciones_item),
  };
}

function readSgpLiteItem(metadata: unknown): RequirementItemMetadata["sgp_lite_item"] {
  const metadataObject = toObject(metadata);
  const item = metadataObject.sgp_lite_item;
  if (!item || typeof item !== "object" || Array.isArray(item)) return {};
  return item as RequirementItemMetadata["sgp_lite_item"];
}

function asFileArray(value: unknown): DetalleRequerimientoItem["recurso_ficha_tecnica_files"] {
  return Array.isArray(value) ? (value as DetalleRequerimientoItem["recurso_ficha_tecnica_files"]) : [];
}

function asFileMeta(value: unknown): DetalleRequerimientoItem["ficha_tecnica_a_suministrar"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as DetalleRequerimientoItem["ficha_tecnica_a_suministrar"];
}

function toFiniteNumber(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function normalizeCurrency(value: string | undefined): "PEN" | "USD" {
  return normalizeString(value).toUpperCase() === "USD" ? "USD" : "PEN";
}

function computeSubtotal(item: DetalleRequerimientoItem): number {
  const subtotal = toFiniteNumber(item.subtotal, Number.NaN);
  if (Number.isFinite(subtotal) && subtotal > 0) return subtotal;
  return Number((toFiniteNumber(item.cantidad, 0) * toFiniteNumber(item.precio_unitario, 0)).toFixed(2));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapSupabaseItem(row: SupabaseRequirementItem): DetalleRequerimientoItem & {
  historical_import_quality?: ReturnType<typeof readHistoricalImportQuality>;
} {
  const quality = readHistoricalImportQuality(row.metadata);
  const historicalItemSource = readHistoricalItemSource(row.metadata) ?? {};
  const savedItem = readSgpLiteItem(row.metadata);
  const mergedItemSource = {
    ...historicalItemSource,
    tipo_recurso: normalizeString(savedItem?.tipo_recurso) || historicalItemSource.tipo_recurso,
    codigo_fabricante: normalizeString(savedItem?.codigo_fabricante) || historicalItemSource.codigo_fabricante,
    descripcion: normalizeString(savedItem?.descripcion) || historicalItemSource.descripcion,
    unidad: normalizeString(savedItem?.unidad) || historicalItemSource.unidad,
    a_suministrar: normalizeString(savedItem?.descripcion) || historicalItemSource.a_suministrar,
  };

  return {
    id: row.id,
    requerimiento_id: row.requerimiento_id,
    recurso_id: normalizeString(row.recurso_id) || normalizeString(savedItem?.recurso_id),
    historical_item_source: mergedItemSource,
    cantidad: Number(row.cantidad ?? 0),
    precio_unitario: Number(row.precio_unitario ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    ajuste: Number(row.ajuste ?? 0),
    atencion_real: Number(row.atencion_real ?? 0),
    cant_stock: Number(row.cant_stock ?? 0),
    compra: Number(row.compra ?? 0),
    costo_unitario: Number(row.costo_unitario ?? 0),
    moneda: normalizeString(row.moneda_codigo).toUpperCase() === "USD" ? "USD" : "PEN",
    tc: Number(row.tc ?? 1),
    factor_eq_herr: Number(row.factor_eq_herr ?? 1),
    costo_total_presupuestado: Number(row.costo_total_presupuestado ?? 0),
    fecha_coti: normalizeString(row.fecha_coti),
    estado: normalizeString(row.estado) || "Pendiente",
    informacion_adicional: normalizeString(row.informacion_adicional),
    observaciones_item: normalizeString(row.observaciones_item),
    recurso_a_suministrar: normalizeString(row.recurso_a_suministrar),
    recurso_ficha_tecnica_files: asFileArray(savedItem?.recurso_ficha_tecnica_files),
    recurso_imagen_files: asFileArray(savedItem?.recurso_imagen_files),
    recurso_archivos: asFileArray(savedItem?.recurso_archivos),
    ficha_tecnica_a_suministrar: asFileMeta(savedItem?.ficha_tecnica_a_suministrar),
    ficha_tecnica_a_suministrar_files: asFileArray(savedItem?.ficha_tecnica_a_suministrar_files),
    proveedor: normalizeString(row.proveedor_nombre),
    condicion_pago: normalizeString(row.condicion_pago) || normalizeString(savedItem?.condicion_pago),
    tiempo_entrega: normalizeString(row.tiempo_entrega) || normalizeString(savedItem?.tiempo_entrega),
    eq: normalizeString(row.eq) || normalizeString(savedItem?.eq) || "Pendiente",
    eq_fecha_aprob: normalizeString(row.eq_fecha_aprob) || normalizeString(savedItem?.eq_fecha_aprob),
    ll: normalizeString(row.ll) || normalizeString(savedItem?.ll) || "Pendiente",
    ll_fecha_aprob: normalizeString(row.ll_fecha_aprob) || normalizeString(savedItem?.ll_fecha_aprob),
    hb: normalizeString(row.hb) || normalizeString(savedItem?.hb) || "Pendiente",
    hb_fecha_aprob: normalizeString(row.hb_fecha_aprob) || normalizeString(savedItem?.hb_fecha_aprob),
    logistica_compra: normalizeString(row.logistica_compra) || normalizeString(savedItem?.logistica_compra) || "Pendiente compra",
    fecha_compra: normalizeString(row.fecha_compra) || normalizeString(savedItem?.fecha_compra),
    oc_os_recurso: normalizeString(row.oc_os_recurso) || normalizeString(savedItem?.oc_os_recurso),
    fecha_entrega: normalizeString(row.fecha_entrega) || normalizeString(savedItem?.fecha_entrega),
    guia_remision: normalizeString(row.guia_remision) || normalizeString(savedItem?.guia_remision),
    archivo_guia: asFileMeta(savedItem?.archivo_guia),
    archivo_guia_files: asFileArray(savedItem?.archivo_guia_files),
    historical_import_quality: quality ?? undefined,
  };
}

async function fetchAllRows<T>(table: string, select: string, orderBy: string): Promise<T[]> {
  const batchSize = 1000;
  let from = 0;
  const rows: T[] = [];

  while (true) {
    const to = from + batchSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy, { ascending: true })
      .range(from, to);

    if (error) throw error;

    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < batchSize) break;
    from += batchSize;
  }

  return rows;
}

async function fetchItemsByRequirementId(requirementId: string): Promise<SupabaseRequirementItem[]> {
  const { data, error } = await supabase
    .from("requerimiento_items")
    .select(REQUIREMENT_ITEMS_SELECT)
    .eq("requerimiento_id", requirementId)
    .is("deleted_at", null)
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SupabaseRequirementItem[];
}

function debugRequirementItemsSample(rows: SupabaseRequirementItem[]) {
  if (process.env.NODE_ENV === "production") return;
  console.debug("[requirement-items] diagnostico Supabase", {
    count: rows.length,
    sample: rows.slice(0, 3).map((row) => {
      const historicalImport = toObject(toObject(row.metadata).historical_import);
      const sourceItem = toObject(historicalImport.source_item);
      return {
        id: row.id,
        requerimiento_id: row.requerimiento_id,
        source_row_number: historicalImport.source_row_number,
        descripcion: sourceItem.descripcion ?? null,
        tipo_recurso: sourceItem.tipo_recurso ?? null,
        codigo_fabricante: sourceItem.codigo_fabricante ?? null,
        cantidad: row.cantidad,
        ajuste: row.ajuste,
        atencion_real: row.atencion_real,
        cant_stock: row.cant_stock,
        compra: row.compra,
        precio_unitario: row.precio_unitario,
        costo_total: row.costo_total_presupuestado,
        moneda: row.moneda_codigo,
        observaciones: row.observaciones_item,
        recurso_a_suministrar: row.recurso_a_suministrar,
      };
    }),
  });
}

function debugRequirementItemsWrite(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.debug(`[requirement-items] ${event}`, payload);
}

function isTemporaryItemId(id: string): boolean {
  const normalized = id.trim().toLowerCase();
  return (
    !isUuid(normalized) ||
    normalized.startsWith("tmp-") ||
    normalized.startsWith("dtrq-") ||
    normalized.startsWith("local-") ||
    normalized.startsWith("temp-")
  );
}

function normalizeComparableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeComparableJson);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .filter((key) => key !== "saved_at")
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const raw = source[key];
        if (raw !== undefined) acc[key] = normalizeComparableJson(raw);
        return acc;
      }, {});
  }
  if (typeof value === "number") return Number.isFinite(value) ? Number(value) : 0;
  if (value === undefined) return null;
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(normalizeComparableJson(value));
}

function comparableFromPayload(payload: SupabaseRequirementItemPayload): Record<string, unknown> {
  return {
    requerimiento_id: payload.requerimiento_id,
    recurso_id: payload.recurso_id,
    cantidad: payload.cantidad,
    precio_unitario: payload.precio_unitario,
    subtotal: payload.subtotal,
    ajuste: payload.ajuste,
    atencion_real: payload.atencion_real,
    cant_stock: payload.cant_stock,
    compra: payload.compra,
    costo_unitario: payload.costo_unitario,
    moneda_codigo: payload.moneda_codigo,
    tc: payload.tc,
    factor_eq_herr: payload.factor_eq_herr,
    costo_total_presupuestado: payload.costo_total_presupuestado,
    fecha_coti: payload.fecha_coti,
    estado: payload.estado,
    informacion_adicional: payload.informacion_adicional,
    observaciones_item: payload.observaciones_item,
    recurso_a_suministrar: payload.recurso_a_suministrar,
    proveedor_id: payload.proveedor_id,
    proveedor_nombre: payload.proveedor_nombre,
    condicion_pago: payload.condicion_pago,
    tiempo_entrega: payload.tiempo_entrega,
    eq: payload.eq,
    eq_fecha_aprob: payload.eq_fecha_aprob,
    ll: payload.ll,
    ll_fecha_aprob: payload.ll_fecha_aprob,
    hb: payload.hb,
    hb_fecha_aprob: payload.hb_fecha_aprob,
    logistica_compra: payload.logistica_compra,
    fecha_compra: payload.fecha_compra,
    oc_os_recurso: payload.oc_os_recurso,
    fecha_entrega: payload.fecha_entrega,
    guia_remision: payload.guia_remision,
    sgp_lite_item: payload.metadata.sgp_lite_item ?? {},
  };
}

function comparableFromRow(row: SupabaseRequirementItem): Record<string, unknown> {
  const savedItem = readSgpLiteItem(row.metadata);
  return {
    requerimiento_id: row.requerimiento_id,
    recurso_id: normalizeString(row.recurso_id) || null,
    cantidad: Number(row.cantidad ?? 0),
    precio_unitario: Number(row.precio_unitario ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    ajuste: Number(row.ajuste ?? 0),
    atencion_real: Number(row.atencion_real ?? 0),
    cant_stock: Number(row.cant_stock ?? 0),
    compra: Number(row.compra ?? 0),
    costo_unitario: Number(row.costo_unitario ?? 0),
    moneda_codigo: normalizeString(row.moneda_codigo).toUpperCase() === "USD" ? "USD" : "PEN",
    tc: Number(row.tc ?? 1),
    factor_eq_herr: Number(row.factor_eq_herr ?? 1),
    costo_total_presupuestado: Number(row.costo_total_presupuestado ?? 0),
    fecha_coti: normalizeString(row.fecha_coti) || null,
    estado: normalizeString(row.estado).toLowerCase() || "pendiente",
    informacion_adicional: normalizeString(row.informacion_adicional) || null,
    observaciones_item: normalizeString(row.observaciones_item) || null,
    recurso_a_suministrar: normalizeString(row.recurso_a_suministrar) || null,
    proveedor_id: normalizeString(row.proveedor_id) || null,
    proveedor_nombre: normalizeString(row.proveedor_nombre) || null,
    condicion_pago: normalizeString(row.condicion_pago) || null,
    tiempo_entrega: normalizeString(row.tiempo_entrega) || null,
    eq: normalizeString(row.eq) || "Pendiente",
    eq_fecha_aprob: normalizeString(row.eq_fecha_aprob) || null,
    ll: normalizeString(row.ll) || "Pendiente",
    ll_fecha_aprob: normalizeString(row.ll_fecha_aprob) || null,
    hb: normalizeString(row.hb) || "Pendiente",
    hb_fecha_aprob: normalizeString(row.hb_fecha_aprob) || null,
    logistica_compra: normalizeString(row.logistica_compra) || "Pendiente compra",
    fecha_compra: normalizeString(row.fecha_compra) || null,
    oc_os_recurso: normalizeString(row.oc_os_recurso) || null,
    fecha_entrega: normalizeString(row.fecha_entrega) || null,
    guia_remision: normalizeString(row.guia_remision) || null,
    sgp_lite_item: savedItem ?? {},
  };
}

function hasMaterialPayloadChanges(payload: SupabaseRequirementItemPayload, existing: SupabaseRequirementItem): boolean {
  return stableJson(comparableFromPayload(payload)) !== stableJson(comparableFromRow(existing));
}

function buildItemMetadata(
  item: DetalleRequerimientoItem,
  existingMetadata: RequirementItemMetadata | null | undefined,
): RequirementItemMetadata {
  const previous = existingMetadata ?? {};
  return {
    ...previous,
    sgp_lite_item: {
      ...(previous.sgp_lite_item ?? {}),
      recurso_id: item.recurso_id,
      codigo_fabricante: item.historical_item_source?.codigo_fabricante,
      tipo_recurso: item.historical_item_source?.tipo_recurso,
      descripcion: item.historical_item_source?.descripcion || item.recurso_a_suministrar,
      descripcion_visible: item.historical_item_source?.descripcion || item.recurso_a_suministrar,
      unidad: item.historical_item_source?.unidad,
      proveedor: item.proveedor,
      condicion_pago: item.condicion_pago,
      tiempo_entrega: item.tiempo_entrega,
      recurso_ficha_tecnica_files: item.recurso_ficha_tecnica_files ?? [],
      recurso_imagen_files: item.recurso_imagen_files ?? [],
      recurso_archivos: item.recurso_archivos ?? [],
      ficha_tecnica_a_suministrar: item.ficha_tecnica_a_suministrar,
      ficha_tecnica_a_suministrar_files: item.ficha_tecnica_a_suministrar_files ?? [],
      files: {
        ficha_tecnica: item.recurso_ficha_tecnica_files ?? [],
        imagen: item.recurso_imagen_files ?? [],
        archivos: item.recurso_archivos ?? [],
        ficha_tecnica_a_suministrar: item.ficha_tecnica_a_suministrar_files ?? [],
        archivo_guia: item.archivo_guia_files ?? [],
      },
      eq: item.eq,
      eq_fecha_aprob: item.eq_fecha_aprob,
      ll: item.ll,
      ll_fecha_aprob: item.ll_fecha_aprob,
      hb: item.hb,
      hb_fecha_aprob: item.hb_fecha_aprob,
      logistica_compra: item.logistica_compra,
      fecha_compra: item.fecha_compra,
      oc_os_recurso: item.oc_os_recurso,
      fecha_entrega: item.fecha_entrega,
      guia_remision: item.guia_remision,
      archivo_guia: item.archivo_guia,
      archivo_guia_files: item.archivo_guia_files ?? [],
      saved_by: "sgp-lite",
      saved_at: new Date().toISOString(),
    },
  };
}

function buildSupabaseItemPayload(
  requerimientoId: string,
  item: DetalleRequerimientoItem,
  existingMetadata?: RequirementItemMetadata | null,
): SupabaseRequirementItemPayload {
  const subtotal = computeSubtotal(item);
  return {
    requerimiento_id: requerimientoId,
    recurso_id: isUuid(normalizeString(item.recurso_id)) ? normalizeString(item.recurso_id) : null,
    cantidad: toFiniteNumber(item.cantidad, 0),
    precio_unitario: toFiniteNumber(item.precio_unitario, 0),
    subtotal,
    ajuste: toFiniteNumber(item.ajuste),
    atencion_real: toFiniteNumber(item.atencion_real),
    cant_stock: toFiniteNumber(item.cant_stock),
    compra: toFiniteNumber(item.compra),
    costo_unitario: toFiniteNumber(item.costo_unitario),
    moneda_codigo: normalizeCurrency(item.moneda),
    tc: toFiniteNumber(item.tc, 1),
    factor_eq_herr: toFiniteNumber(item.factor_eq_herr, 1),
    costo_total_presupuestado: toFiniteNumber(item.costo_total_presupuestado, 0),
    fecha_coti: normalizeString(item.fecha_coti) || null,
    estado: normalizeString(item.estado).toLowerCase() || "pendiente",
    informacion_adicional: normalizeString(item.informacion_adicional) || null,
    observaciones_item: normalizeString(item.observaciones_item) || null,
    recurso_a_suministrar: normalizeString(item.recurso_a_suministrar) || null,
    proveedor_id: null,
    proveedor_nombre: normalizeString(item.proveedor) || null,
    condicion_pago: normalizeString(item.condicion_pago) || null,
    tiempo_entrega: normalizeString(item.tiempo_entrega) || null,
    eq: normalizeString(item.eq) || "Pendiente",
    eq_fecha_aprob: normalizeString(item.eq_fecha_aprob) || null,
    ll: normalizeString(item.ll) || "Pendiente",
    ll_fecha_aprob: normalizeString(item.ll_fecha_aprob) || null,
    hb: normalizeString(item.hb) || "Pendiente",
    hb_fecha_aprob: normalizeString(item.hb_fecha_aprob) || null,
    logistica_compra: normalizeString(item.logistica_compra) || "Pendiente compra",
    fecha_compra: normalizeString(item.fecha_compra) || null,
    oc_os_recurso: normalizeString(item.oc_os_recurso) || null,
    fecha_entrega: normalizeString(item.fecha_entrega) || null,
    guia_remision: normalizeString(item.guia_remision) || null,
    metadata: buildItemMetadata(item, existingMetadata),
  };
}

export async function saveRequirementItemsForRequirement(
  requerimientoId: string,
  items: DetalleRequerimientoItem[],
): Promise<RequirementItemsListResult> {
  if (!hasSupabaseConfig()) {
    demoData.replaceDetalleItems(requerimientoId, items);
    const rows = demoData.listDetalleItems().filter((item) => item.requerimiento_id === requerimientoId);
    return {
      rows,
      total: rows.length,
      source: "demo",
      warning: "No se encontraron variables públicas de Supabase; se guardó en data demo local.",
    };
  }

  debugRequirementItemsWrite("save-start", {
    requerimientoId,
    itemCount: items.length,
    itemIds: items.map((item) => item.id),
  });
  if (process.env.NODE_ENV === "development") {
    console.log("[RQ_SAVE_DEBUG] repository saveRequirementItemsForRequirement inicio", {
      requerimientoId,
      itemsLength: items.length,
      itemIds: items.map((item) => item.id),
    });
  }

  const currentRows = await fetchItemsByRequirementId(requerimientoId);
  if (items.length === 0) {
    debugRequirementItemsWrite("save-skipped-empty-payload", {
      requerimientoId,
      existingRows: currentRows.length,
    });
    if (process.env.NODE_ENV === "development") {
      console.log("[RQ_SAVE_DEBUG] repository payload vacio", {
        requerimientoId,
        itemsLength: items.length,
        existingRows: currentRows.length,
      });
    }
    throw new Error("No se enviaron filas al repositorio para guardar en public.requerimiento_items.");
  }

  const currentById = new Map(currentRows.map((row) => [row.id, row]));
  const insertedRows: SupabaseRequirementItem[] = [];
  const updatedRows: SupabaseRequirementItem[] = [];
  const skippedRows: string[] = [];

  for (const item of items) {
    const isTemporary = isTemporaryItemId(item.id);
    const existing = isTemporary ? undefined : currentById.get(item.id);
    const payload = buildSupabaseItemPayload(requerimientoId, item, existing?.metadata as RequirementItemMetadata | null | undefined);
    const hasExistingChanges = existing ? hasMaterialPayloadChanges(payload, existing) : false;
    const operation = existing ? (hasExistingChanges ? "update" : "skip") : "insert";

    debugRequirementItemsWrite(`${operation}-payload`, {
      requerimientoId,
      itemId: item.id,
      payload,
    });
    if (process.env.NODE_ENV === "development") {
      console.log("[RQ_SAVE_DEBUG] item decision insert/update/skip", {
        operation,
        requerimientoId,
        itemId: item.id,
        isTemporary,
        existsInSupabase: Boolean(existing),
        hasExistingChanges,
      });
      console.log("[RQ_SAVE_DEBUG] repository payload final Supabase", {
        operation,
        requerimientoId,
        itemId: item.id,
        payload,
      });
    }

    if (existing && !hasExistingChanges) {
      skippedRows.push(item.id);
      continue;
    }

    if (existing) {
      const { data, error } = await supabase
        .from("requerimiento_items")
        .update(payload)
        .eq("id", item.id)
        .eq("requerimiento_id", requerimientoId)
        .select(REQUIREMENT_ITEMS_SELECT)
        .maybeSingle();
      if (process.env.NODE_ENV === "development") {
        console.log("[RQ_SAVE_DEBUG] repository update respuesta Supabase", {
          requerimientoId,
          itemId: item.id,
          data,
          error,
        });
      }
      if (error) {
        debugRequirementItemsWrite("update-error", { requerimientoId, itemId: item.id, error });
        const code = typeof error.code === "string" ? error.code : "";
        const message = typeof error.message === "string" ? error.message : "";
        if (code === "42501" || /permission denied/i.test(message)) {
          throw new Error("No tienes permiso para actualizar ítems existentes del requerimiento.");
        }
        throw error;
      }
      debugRequirementItemsWrite("update-response", {
        requerimientoId,
        itemId: item.id,
        data,
      });
      if (!data) {
        throw new Error(`Supabase no actualizó el ítem ${item.id} del requerimiento ${requerimientoId}.`);
      }
      updatedRows.push(data as SupabaseRequirementItem);
      continue;
    }

    const { data, error } = await supabase
      .from("requerimiento_items")
      .insert(payload)
      .select(REQUIREMENT_ITEMS_SELECT)
      .single();
    if (process.env.NODE_ENV === "development") {
      console.log("[RQ_SAVE_DEBUG] repository insert respuesta Supabase", {
        requerimientoId,
        itemId: item.id,
        data,
        error,
      });
    }
    if (error) {
      debugRequirementItemsWrite("insert-error", { requerimientoId, itemId: item.id, error });
      throw error;
    }
    debugRequirementItemsWrite("insert-response", {
      requerimientoId,
      itemId: item.id,
      data,
    });
    insertedRows.push(data as SupabaseRequirementItem);
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[RQ_SAVE_DEBUG] inserted rows", {
      requerimientoId,
      count: insertedRows.length,
      rows: insertedRows,
    });
    console.log("[RQ_SAVE_DEBUG] updated rows", {
      requerimientoId,
      count: updatedRows.length,
      rows: updatedRows,
    });
    console.log("[RQ_SAVE_DEBUG] skipped rows", {
      requerimientoId,
      count: skippedRows.length,
      itemIds: skippedRows,
    });
  }

  const confirmedRows = await fetchItemsByRequirementId(requerimientoId);
  if (process.env.NODE_ENV === "development") {
    console.log("[RQ_SAVE_DEBUG] repository readback Supabase", {
      requerimientoId,
      rowsLength: confirmedRows.length,
      rows: confirmedRows,
    });
  }
  if (confirmedRows.length === 0) {
    throw new Error(`Supabase guardó sin error aparente, pero el readback por requerimiento_id ${requerimientoId} devolvió 0 filas.`);
  }
  const rows = confirmedRows.map(mapSupabaseItem);
  const result: RequirementItemsListResult = {
    rows,
    total: rows.length,
    source: "supabase",
  };
  debugRequirementItemsWrite("save-confirmed", {
    requerimientoId,
    confirmedCount: result.rows.length,
    source: result.source,
    warning: result.warning ?? null,
  });
  return result;
}

export async function listRequirementItems(): Promise<RequirementItemsListResult> {
  if (!hasSupabaseConfig()) {
    const rows = demoData.listDetalleItems();
    return {
      rows,
      total: rows.length,
      source: "demo",
      warning: "No se encontraron variables públicas de Supabase; se usa data demo local.",
    };
  }

  try {
    const rawRows = await fetchAllRows<SupabaseRequirementItem>(
      "requerimiento_items",
      REQUIREMENT_ITEMS_SELECT,
      "id"
    );
    debugRequirementItemsSample(rawRows);
    const rows = rawRows.map(mapSupabaseItem);

    return {
      rows,
      total: rows.length,
      source: "supabase",
    };
  } catch (error) {
    const rows = demoData.listDetalleItems();
    return {
      rows,
      total: rows.length,
      source: "demo",
      warning:
        error instanceof Error
          ? `No se pudo leer public.requerimiento_items desde Supabase: ${error.message}. Se usa data demo local.`
          : "No se pudo leer public.requerimiento_items desde Supabase. Se usa data demo local.",
    };
  }
}

export async function listRequirementItemsByRequirementId(requirementId: string): Promise<RequirementItemsListResult> {
  if (!hasSupabaseConfig()) {
    const rows = demoData.listDetalleItems().filter((item) => item.requerimiento_id === requirementId);
    return {
      rows,
      total: rows.length,
      source: "demo",
      warning: "No se encontraron variables públicas de Supabase; se usa data demo local.",
    };
  }

  try {
    const rawRows = await fetchItemsByRequirementId(requirementId);
    debugRequirementItemsSample(rawRows);
    const rows = rawRows.map(mapSupabaseItem);

    return {
      rows,
      total: rows.length,
      source: "supabase",
    };
  } catch (error) {
    const rows = demoData.listDetalleItems().filter((item) => item.requerimiento_id === requirementId);
    return {
      rows,
      total: rows.length,
      source: "demo",
      warning:
        error instanceof Error
          ? `No se pudo leer detalle del RQ desde Supabase: ${error.message}. Se usa data demo local.`
          : "No se pudo leer detalle del RQ desde Supabase. Se usa data demo local.",
    };
  }
}

export async function listRequirementItemsWithContext(): Promise<{
  rows: RequirementItemsContextRow[];
  source: RequirementItemsDataSource;
  warning?: string;
}> {
  if (!hasSupabaseConfig()) {
    return {
      rows: [],
      source: "demo",
      warning: "No se encontraron variables públicas de Supabase para enriquecer detalle RQ.",
    };
  }

  try {
    const [items, requerimientos, cotizaciones] = await Promise.all([
      fetchAllRows<SupabaseRequirementItem>("requerimiento_items", REQUIREMENT_ITEMS_SELECT, "id"),
      fetchAllRows<SupabaseRequirementRelation>("requerimientos", REQUIREMENT_RELATION_SELECT, "codigo"),
      fetchAllRows<SupabaseQuotationRelation>("cotizaciones", QUOTATION_RELATION_SELECT, "codigo"),
    ]);

    const rqMap = new Map(requerimientos.map((row) => [row.id, row]));
    const cotMap = new Map(cotizaciones.map((row) => [row.id, row]));

    const rows = items.map((item) => {
      const rq = rqMap.get(item.requerimiento_id);
      const cot = rq ? cotMap.get(rq.cotizacion_id) : undefined;
      return {
        item_id: item.id,
        requerimiento_id: item.requerimiento_id,
        codigo_rq: normalizeString(rq?.codigo),
        cotizacion_codigo: normalizeString(rq?.cotizacion_codigo ?? cot?.codigo),
        proyecto_servicio: normalizeString(rq?.proyecto_servicio),
        oc: normalizeString(rq?.oc),
        responsable: normalizeString(rq?.responsable),
        cliente: normalizeString(cot?.cliente_nombre),
        unidad_trabajo: normalizeString(cot?.unidad_trabajo_nombre),
        historical_import_quality: readHistoricalImportQuality(item.metadata) ?? undefined,
      };
    });

    return {
      rows,
      source: "supabase",
    };
  } catch (error) {
    return {
      rows: [],
      source: "demo",
      warning:
        error instanceof Error
          ? `No se pudo complementar detalle RQ con relaciones Supabase: ${error.message}.`
          : "No se pudo complementar detalle RQ con relaciones Supabase.",
    };
  }
}
