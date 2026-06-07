import { demoData, type Cotizacion, type DetalleRequerimientoItem, type Requerimiento } from "@/lib/demoData";
import { readHistoricalImportQuality } from "@/lib/historicalImportQuality";
import { supabase } from "@/lib/supabaseClient";

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
  proveedor_nombre: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
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
  proveedor_nombre,
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

function mapSupabaseItem(row: SupabaseRequirementItem): DetalleRequerimientoItem & {
  historical_import_quality?: ReturnType<typeof readHistoricalImportQuality>;
} {
  const quality = readHistoricalImportQuality(row.metadata);
  const historicalItemSource = readHistoricalItemSource(row.metadata);

  return {
    id: row.id,
    requerimiento_id: row.requerimiento_id,
    recurso_id: "",
    historical_item_source: historicalItemSource,
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
    recurso_ficha_tecnica_files: [],
    recurso_imagen_files: [],
    ficha_tecnica_a_suministrar: null,
    ficha_tecnica_a_suministrar_files: [],
    proveedor: normalizeString(row.proveedor_nombre),
    condicion_pago: "",
    tiempo_entrega: "",
    eq: "Pendiente",
    eq_fecha_aprob: "",
    ll: "Pendiente",
    ll_fecha_aprob: "",
    hb: "Pendiente",
    hb_fecha_aprob: "",
    logistica_compra: "Pendiente compra",
    fecha_compra: "",
    oc_os_recurso: "",
    fecha_entrega: "",
    guia_remision: "",
    archivo_guia: null,
    archivo_guia_files: [],
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
