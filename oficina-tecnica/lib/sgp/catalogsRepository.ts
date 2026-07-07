import { supabase } from "@/lib/sgp/supabaseClient";
import {
  demoData,
  type CatalogAprobacionItem,
  type CatalogArea,
  type CatalogCodigoCliente,
  type CatalogCodigoUnidadTrabajo,
  type CatalogEstadoCotizacion,
  type CatalogEstadoDetalleRq,
  type CatalogEstadoRecurso,
  type CatalogLogisticaCompraItem,
  type CatalogMarca,
  type CatalogMoneda,
  type CatalogProveedor,
  type CatalogSolicitanteCotizacion,
  type CatalogSolicitanteRq,
  type CatalogTipoRecurso,
  type CatalogTipoServicio,
  type CatalogUnidad,
  type ProyectoAdjudicado,
} from "@/lib/sgp/demoData";

export type CatalogKey =
  | "catalogTipoRecurso"
  | "catalogUnidades"
  | "catalogMarcas"
  | "catalogProveedores"
  | "catalogMonedas"
  | "catalogEstadosRecurso"
  | "catalogEstadoDetalleRq"
  | "catalogEq"
  | "catalogLl"
  | "catalogHb"
  | "catalogLogisticaCompra"
  | "catalogTipoServicio"
  | "catalogArea"
  | "catalogSolicitanteRq"
  | "catalogSolicitanteCotizacion"
  | "catalogEstadoCotizacion"
  | "catalogCodigoClientes"
  | "catalogCodigoUnidadesTrabajo"
  | "proyectosAdjudicados";

export type CatalogRecord =
  | CatalogCodigoCliente
  | CatalogCodigoUnidadTrabajo
  | ProyectoAdjudicado
  | CatalogTipoRecurso
  | CatalogUnidad
  | CatalogMarca
  | CatalogProveedor
  | CatalogMoneda
  | CatalogEstadoRecurso
  | CatalogEstadoDetalleRq
  | CatalogAprobacionItem
  | CatalogLogisticaCompraItem
  | CatalogTipoServicio
  | CatalogArea
  | CatalogSolicitanteRq
  | CatalogSolicitanteCotizacion
  | CatalogEstadoCotizacion;

export type CatalogListResult<T extends CatalogRecord = CatalogRecord> = {
  rows: T[];
  source: "supabase" | "demo";
  error?: string;
};

const catalogTableMap: Record<CatalogKey, string> = {
  catalogTipoRecurso: "catalog_tipos_recurso",
  catalogUnidades: "catalog_unidades_medida",
  catalogMarcas: "catalog_marcas",
  catalogProveedores: "catalog_proveedores",
  catalogMonedas: "catalog_monedas",
  catalogEstadosRecurso: "catalog_estados_recurso",
  catalogEstadoDetalleRq: "catalog_estado_detalle_rq",
  catalogEq: "catalog_vb_economico",
  catalogLl: "catalog_vb_tecnico",
  catalogHb: "catalog_vb_atencion",
  catalogLogisticaCompra: "catalog_logistica_compra",
  catalogTipoServicio: "catalog_tipos_servicio",
  catalogArea: "catalog_areas",
  catalogSolicitanteRq: "catalog_solicitantes_rq",
  catalogSolicitanteCotizacion: "catalog_solicitantes_cotizacion",
  catalogEstadoCotizacion: "catalog_estados_cotizacion",
  catalogCodigoClientes: "catalog_codigo_clientes",
  catalogCodigoUnidadesTrabajo: "catalog_codigo_unidades_trabajo",
  proyectosAdjudicados: "proyectos_adjudicados",
};

const catalogKeys = Object.keys(catalogTableMap) as CatalogKey[];

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function localCatalogRows<T extends CatalogRecord>(catalogKey: CatalogKey): T[] {
  switch (catalogKey) {
    case "catalogTipoRecurso":
      return demoData.listCatalogTipoRecurso() as T[];
    case "catalogUnidades":
      return demoData.listCatalogUnidades() as T[];
    case "catalogMarcas":
      return demoData.listCatalogMarcas() as T[];
    case "catalogProveedores":
      return demoData.listCatalogProveedores() as T[];
    case "catalogMonedas":
      return demoData.listCatalogMonedas() as T[];
    case "catalogEstadosRecurso":
      return demoData.listCatalogEstadosRecurso() as T[];
    case "catalogEstadoDetalleRq":
      return demoData.listCatalogEstadoDetalleRq() as T[];
    case "catalogEq":
      return demoData.listCatalogEq() as T[];
    case "catalogLl":
      return demoData.listCatalogLl() as T[];
    case "catalogHb":
      return demoData.listCatalogHb() as T[];
    case "catalogLogisticaCompra":
      return demoData.listCatalogLogisticaCompra() as T[];
    case "catalogTipoServicio":
      return demoData.listCatalogTipoServicio() as T[];
    case "catalogArea":
      return demoData.listCatalogArea() as T[];
    case "catalogSolicitanteRq":
      return demoData.listCatalogSolicitanteRq() as T[];
    case "catalogSolicitanteCotizacion":
      return demoData.listCatalogSolicitanteCotizacion() as T[];
    case "catalogEstadoCotizacion":
      return demoData.listCatalogEstadoCotizacion() as T[];
    case "catalogCodigoClientes":
      return demoData.listCatalogCodigoClientes() as T[];
    case "catalogCodigoUnidadesTrabajo":
      return demoData.listCatalogCodigoUnidadesTrabajo() as T[];
    case "proyectosAdjudicados":
      return demoData.listProyectosAdjudicados() as T[];
    default:
      return [];
  }
}

function sortCatalogRows<T extends CatalogRecord>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ar = a as Record<string, unknown>;
    const br = b as Record<string, unknown>;
    const ao = typeof ar.orden === "number" ? ar.orden : Number.MAX_SAFE_INTEGER;
    const bo = typeof br.orden === "number" ? br.orden : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    const al = String(ar.nombre ?? ar.cliente ?? ar.unidad_trabajo ?? ar.codigo_proyecto ?? "");
    const bl = String(br.nombre ?? br.cliente ?? br.unidad_trabajo ?? br.codigo_proyecto ?? "");
    return al.localeCompare(bl, "es");
  });
}

async function listLegacyCatalogItems<T extends CatalogRecord>(catalogKey: CatalogKey): Promise<T[]> {
  const { data, error } = await supabase
    .from("app_catalog_items")
    .select("catalog_key,item_id,payload")
    .eq("catalog_key", catalogKey);

  if (error) return [];
  return ((data ?? []) as Array<{ item_id: string; payload: CatalogRecord }>).map(
    (row) => ({ ...row.payload, id: row.item_id }) as T,
  );
}

function prepareSpecificPayload(catalogKey: CatalogKey, value: CatalogRecord): Record<string, unknown> {
  const payload = { ...(value as Record<string, unknown>) };
  if (catalogKey === "proyectosAdjudicados" && !String(payload.fecha_adjudicacion ?? "").trim()) {
    payload.fecha_adjudicacion = null;
  }
  return payload;
}

export async function listCatalogItems<T extends CatalogRecord>(catalogKey: CatalogKey): Promise<CatalogListResult<T>> {
  if (!hasSupabaseConfig()) {
    return { rows: localCatalogRows<T>(catalogKey), source: "demo", error: "Supabase no está configurado." };
  }

  const tableName = catalogTableMap[catalogKey];
  const { data, error } = await supabase.from(tableName).select("*");

  if (error) {
    const legacyRows = await listLegacyCatalogItems<T>(catalogKey);
    return {
      rows: sortCatalogRows(legacyRows.length > 0 ? legacyRows : localCatalogRows<T>(catalogKey)),
      source: "demo",
      error: `No se pudo leer ${tableName}. Ejecuta supabase/sql/160_catalog_specific_tables.sql. Detalle: ${error.message}`,
    };
  }

  const rows = (data ?? []) as T[];
  return { rows: sortCatalogRows(rows.length > 0 ? rows : localCatalogRows<T>(catalogKey)), source: "supabase" };
}

export async function listCatalogMap(): Promise<{
  catalogs: Partial<Record<CatalogKey, CatalogRecord[]>>;
  source: "supabase" | "demo";
  error?: string;
}> {
  if (!hasSupabaseConfig()) {
    return {
      catalogs: Object.fromEntries(catalogKeys.map((key) => [key, localCatalogRows(key)])) as Partial<Record<CatalogKey, CatalogRecord[]>>,
      source: "demo",
      error: "Supabase no está configurado.",
    };
  }

  const grouped: Partial<Record<CatalogKey, CatalogRecord[]>> = {};
  const errors: string[] = [];

  await Promise.all(
    catalogKeys.map(async (key) => {
      const tableName = catalogTableMap[key];
      const { data, error } = await supabase.from(tableName).select("*");
      if (error) {
        const legacyRows = await listLegacyCatalogItems(key);
        grouped[key] = sortCatalogRows(legacyRows.length > 0 ? legacyRows : localCatalogRows(key));
        errors.push(`${tableName}: ${error.message}`);
        return;
      }
      const rows = (data ?? []) as CatalogRecord[];
      grouped[key] = sortCatalogRows(rows.length > 0 ? rows : localCatalogRows(key));
    }),
  );

  return {
    catalogs: grouped,
    source: errors.length > 0 ? "demo" : "supabase",
    error:
      errors.length > 0
        ? `Algunos catálogos usan respaldo temporal. Ejecuta supabase/sql/160_catalog_specific_tables.sql. Detalle: ${errors.join(" | ")}`
        : undefined,
  };
}

export async function saveCatalogItem<T extends CatalogRecord>(catalogKey: CatalogKey, value: T): Promise<T> {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase no está configurado. El catálogo no se guardó.");
  }

  const itemId = String(value.id ?? "").trim();
  if (!itemId) {
    throw new Error("El registro de catálogo no tiene id.");
  }

  const tableName = catalogTableMap[catalogKey];
  const { error } = await supabase.from(tableName).upsert(prepareSpecificPayload(catalogKey, value), { onConflict: "id" });

  if (error) {
    throw new Error(`No se pudo guardar el catálogo en ${tableName}. Ejecuta supabase/sql/160_catalog_specific_tables.sql. Detalle: ${error.message}`);
  }

  demoData.saveCatalog(catalogKey, value);
  return value;
}

export async function removeCatalogItem(catalogKey: CatalogKey, id: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase no está configurado. El catálogo no se eliminó.");
  }

  const tableName = catalogTableMap[catalogKey];
  const { error } = await supabase.from(tableName).delete().eq("id", id);
  if (error) {
    throw new Error(`No se pudo eliminar el catálogo en ${tableName}. Detalle: ${error.message}`);
  }
  demoData.removeCatalog(catalogKey, id);
}
