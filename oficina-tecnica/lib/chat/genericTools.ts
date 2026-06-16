// ── Herramientas genéricas de consulta cruzada ───────────────────────────────
//
// Fachadas delgadas sobre las tools ya probadas de `contextTools` + análisis
// determinístico de ítems. La idea (ver crossIntentRegistry) es que muchas
// consultas naturales se resuelvan con pocas herramientas genéricas en vez de
// una función por frase. Las capacidades que aún no existen se responden con
// honestidad (no se inventan datos).

import {
  buscarRequerimientosPorProyecto,
  buscarRequerimientoPorCodigo,
  buscarItemsDeRequerimiento,
  buscarRequerimientos,
  buscarCotizaciones,
  obtenerResumenProyecto,
  buscarRecursos,
  clasificarRecursosElectricos,
  DEFAULT_CONTEXT_LIMIT,
  type ContextToolResult,
} from "./contextTools";
import type { RequirementSummary, RequirementItemSummary, RequerimientoSearchFilters, CotizacionSearchFilters } from "./contextQuery";
import type { GenericQueryOptions, QueryStatus } from "./crossIntentRegistry";

function estadoLabel(status: QueryStatus | undefined): string | undefined {
  switch (status) {
    case "pendiente": return "Pendiente";
    case "en_proceso": return "En proceso";
    case "atendido": return "Atendido";
    default: return undefined;
  }
}

// ── Normalización de estado ──────────────────────────────────────────────────
function normEstado(estado: string | null | undefined): QueryStatus | "otro" {
  const e = (estado ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/pendiente/.test(e)) return "pendiente";
  if (/proceso|curso/.test(e)) return "en_proceso";
  if (/atendid|complet|finaliz|culmin/.test(e)) return "atendido";
  if (/historic/.test(e)) return "historico";
  return "otro";
}

// ── queryProjectRequirements ─────────────────────────────────────────────────
export interface GenericRequirementsResult {
  status: "success" | "empty" | "error";
  projectCode?: string;
  total: number;
  records: RequirementSummary[];
  message?: string;
  /** Filtro de estado aplicado del lado del cliente, si lo hubo. */
  statusFilter?: QueryStatus;
}

/**
 * Requerimientos de un proyecto/cotización/OC, con filtro opcional de estado
 * aplicado sobre la muestra recuperada. El conteo total exacto lo da la tool
 * subyacente (`buscarRequerimientosPorProyecto`).
 */
export async function queryProjectRequirements(options: GenericQueryOptions): Promise<GenericRequirementsResult> {
  const code = options.projectCode ?? options.cotizacionCode ?? options.ocCode;
  if (!code) return { status: "empty", total: 0, records: [], message: "No hay código de proyecto/cotización/OC en el alcance." };

  const res = await buscarRequerimientosPorProyecto(code, options.limitRequirements ?? DEFAULT_CONTEXT_LIMIT);
  if (res.status !== "success") {
    return { status: res.status === "error" ? "error" : "empty", projectCode: code, total: 0, records: [], message: res.message };
  }
  let records = res.records;
  if (options.status) records = records.filter((r) => normEstado(r.estado) === options.status);
  return { status: "success", projectCode: code, total: res.exactCount ?? res.total, records, statusFilter: options.status };
}

// ── queryRequirementItems ────────────────────────────────────────────────────
export interface GenericItemsResult {
  status: "success" | "empty" | "error";
  requirementCode?: string;
  requirement?: RequirementSummary;
  items: RequirementItemSummary[];
  message?: string;
}

/** Ítems de un requerimiento (por código): resuelve el RQ y trae sus ítems. */
export async function queryRequirementItems(options: GenericQueryOptions): Promise<GenericItemsResult> {
  const code = options.requirementCode;
  if (!code) return { status: "empty", items: [], message: "No hay código de requerimiento en el alcance." };

  const rqRes = await buscarRequerimientoPorCodigo(code);
  if (rqRes.status !== "success" || rqRes.records.length !== 1) {
    return { status: rqRes.status === "error" ? "error" : "empty", requirementCode: code, items: [], message: rqRes.message };
  }
  const rq = rqRes.records[0];
  const itemsRes = await buscarItemsDeRequerimiento(rq.id, options.limitItems ?? DEFAULT_CONTEXT_LIMIT, rq.codigo);
  return {
    status: itemsRes.status === "error" ? "error" : "success",
    requirementCode: rq.codigo,
    requirement: rq,
    items: itemsRes.status === "success" ? itemsRes.records : [],
    message: itemsRes.message,
  };
}

// ── queryGlobalRequirementLog ────────────────────────────────────────────────
/** Log de requerimientos con filtro simple por estado (sin análisis transversal). */
export async function queryGlobalRequirementLog(options: GenericQueryOptions): Promise<ContextToolResult> {
  const filters: RequerimientoSearchFilters = {};
  const estado = estadoLabel(options.status);
  if (estado) filters.estado = estado;
  return buscarRequerimientos(filters, options.limitRequirements ?? DEFAULT_CONTEXT_LIMIT);
}

// ── queryClientProjects ──────────────────────────────────────────────────────
/** Cotizaciones de un cliente / por estado (cruces RQ↔cliente quedan pendientes). */
export async function queryClientProjects(options: GenericQueryOptions): Promise<ContextToolResult> {
  const filters: CotizacionSearchFilters = {};
  if (options.client) filters.q = options.client;
  const estado = options.status === "ganada" ? "Ganada" : estadoLabel(options.status);
  if (estado) filters.estado = estado;
  return buscarCotizaciones(filters, options.limitRequirements ?? DEFAULT_CONTEXT_LIMIT);
}

// ── queryProjectSummary ──────────────────────────────────────────────────────
/** Resumen de proyecto por código (cascada cotización → RQ → histórico). */
export async function queryProjectSummary(options: GenericQueryOptions): Promise<ContextToolResult> {
  const code = options.projectCode ?? options.cotizacionCode ?? options.ocCode;
  if (!code) return { source: "proyecto", status: "empty", query: {}, code: "", reference: { source: "none" }, records: [], total: 0 };
  return obtenerResumenProyecto(code);
}

// ── queryCatalogResources ────────────────────────────────────────────────────
/** Catálogo de recursos: clasificación técnica si se pide, si no listado filtrado. */
export async function queryCatalogResources(options: GenericQueryOptions): Promise<ContextToolResult> {
  if (options.classification === "electrico") return clasificarRecursosElectricos();
  return buscarRecursos({}, options.limitItems ?? DEFAULT_CONTEXT_LIMIT);
}

// ── analyzeRequirementItems (puro, determinístico) ───────────────────────────
export interface ProviderAgg {
  name: string;
  count: number;
  total: number;
  currency: string;
}

export interface ItemsAnalysis {
  total: number;
  /** Suma de costos por moneda (solo valores reales). */
  byCurrency: Record<string, { count: number; total: number }>;
  /** True si hay más de una moneda (no se debe rankear mezclando sin TC). */
  mixedCurrency: boolean;
  /** Ítems ordenados por costo descendente (dentro de su moneda). */
  ranking: Array<{ item: RequirementItemSummary; cost: number; currency: string }>;
  missingPrice: RequirementItemSummary[];
  priceZero: RequirementItemSummary[];
  missingProvider: RequirementItemSummary[];
  missingUnit: RequirementItemSummary[];
  missingQty: RequirementItemSummary[];
  duplicates: Array<{ descripcion: string; count: number }>;
  providers: ProviderAgg[];
  topProvider?: ProviderAgg;
}

function itemCost(it: RequirementItemSummary): number | null {
  if (it.costo_total_presupuestado != null) return it.costo_total_presupuestado;
  if (it.precio_unitario != null && it.cantidad != null) return it.precio_unitario * it.cantidad;
  return null;
}

/**
 * Análisis determinístico de los ítems de un requerimiento: ranking por costo
 * (sin mezclar monedas), faltantes (precio/proveedor/unidad/cantidad),
 * duplicados y agregados por proveedor. 100% sobre datos reales — nunca rellena.
 */
export function analyzeRequirementItems(items: RequirementItemSummary[], options: GenericQueryOptions = {}): ItemsAnalysis {
  const byCurrency: Record<string, { count: number; total: number }> = {};
  const ranking: Array<{ item: RequirementItemSummary; cost: number; currency: string }> = [];
  const missingPrice: RequirementItemSummary[] = [];
  const priceZero: RequirementItemSummary[] = [];
  const missingProvider: RequirementItemSummary[] = [];
  const missingUnit: RequirementItemSummary[] = [];
  const missingQty: RequirementItemSummary[] = [];
  const descCount = new Map<string, number>();
  const providerMap = new Map<string, ProviderAgg>();

  for (const it of items) {
    const cur = it.moneda ?? "PEN";
    const cost = itemCost(it);

    if (it.precio_unitario == null) missingPrice.push(it);
    else if (it.precio_unitario === 0) priceZero.push(it);
    if (!it.proveedor_nombre) missingProvider.push(it);
    if (!it.unidad) missingUnit.push(it);
    if (it.cantidad == null) missingQty.push(it);

    if (cost != null) {
      byCurrency[cur] = byCurrency[cur] ?? { count: 0, total: 0 };
      byCurrency[cur].count++;
      byCurrency[cur].total += cost;
      ranking.push({ item: it, cost, currency: cur });
    }

    const key = (it.descripcion ?? "").trim().toLowerCase();
    if (key) descCount.set(key, (descCount.get(key) ?? 0) + 1);

    if (it.proveedor_nombre) {
      const p = providerMap.get(it.proveedor_nombre) ?? { name: it.proveedor_nombre, count: 0, total: 0, currency: cur };
      p.count++;
      if (cost != null) p.total += cost;
      providerMap.set(it.proveedor_nombre, p);
    }
  }

  // Ranking por costo descendente (dentro de cada moneda; no se mezcla).
  ranking.sort((a, b) => (a.currency === b.currency ? b.cost - a.cost : a.currency.localeCompare(b.currency)));
  const limit = options.limitItems ?? ranking.length;

  const duplicates = [...descCount.entries()].filter(([, n]) => n > 1).map(([descripcion, count]) => ({ descripcion, count }));
  const providers = [...providerMap.values()].sort((a, b) => b.total - a.total);
  const topProvider = providers[0];

  return {
    total: items.length,
    byCurrency,
    mixedCurrency: Object.keys(byCurrency).length > 1,
    ranking: ranking.slice(0, limit),
    missingPrice, priceZero, missingProvider, missingUnit, missingQty,
    duplicates, providers, topProvider,
  };
}

// ── Renderers determinísticos (markdown, datos reales) ───────────────────────
const DASH = "—";
function money(n: number | null | undefined, cur = "PEN"): string {
  return n == null ? DASH : `${cur} ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function cell(v: unknown): string {
  if (v == null || v === "") return DASH;
  return String(v).replace(/\|/g, "\\|").replace(/\n/g, " ").trim() || DASH;
}

/** Tabla de ranking económico, separada por moneda (no mezcla PEN/USD). */
export function renderItemsAnalysis(code: string, analysis: ItemsAnalysis, options: GenericQueryOptions = {}): string {
  const lines: string[] = [`Análisis económico de los ítems de **${code}** (Supabase, ${analysis.total} ítem(s)):`];

  // Totales por moneda.
  const curLines = Object.entries(analysis.byCurrency).map(([cur, v]) => `- ${cur}: ${v.count} ítem(s), total ${money(v.total, cur)}`);
  if (curLines.length) lines.push("", "Totales por moneda:", ...curLines);
  if (analysis.mixedCurrency) {
    lines.push("", "⚠️ Hay más de una moneda. No mezclo PEN y USD en un solo ranking sin un tipo de cambio verificado: muestro el ranking por moneda.");
  }

  // Ranking.
  if (analysis.ranking.length) {
    const rows = analysis.ranking.map((r, i) => [String(i + 1), cell(r.item.descripcion), cell(r.item.cantidad), cell(r.item.unidad), money(r.cost, r.currency), cell(r.item.proveedor_nombre)]);
    lines.push("", `Ranking por costo (${options.sortBy === "precio_unitario_desc" ? "precio unitario" : "costo total"}):`, "",
      `| # | Descripción | Cant. | Und. | Costo | Proveedor |`, `| - | --- | --- | --- | --- | --- |`,
      ...rows.map((r) => `| ${r.join(" | ")} |`));
  }

  // Faltantes / calidad de datos.
  const flags: string[] = [];
  if (analysis.missingPrice.length) flags.push(`${analysis.missingPrice.length} sin precio`);
  if (analysis.priceZero.length) flags.push(`${analysis.priceZero.length} con precio 0`);
  if (analysis.missingProvider.length) flags.push(`${analysis.missingProvider.length} sin proveedor`);
  if (analysis.missingUnit.length) flags.push(`${analysis.missingUnit.length} sin unidad`);
  if (analysis.missingQty.length) flags.push(`${analysis.missingQty.length} sin cantidad`);
  if (analysis.duplicates.length) flags.push(`${analysis.duplicates.length} descripción(es) duplicada(s)`);
  if (flags.length) lines.push("", `Calidad de datos: ${flags.join(", ")}.`);

  if (analysis.topProvider) {
    lines.push("", `Proveedor con mayor monto: **${analysis.topProvider.name}** (${money(analysis.topProvider.total, analysis.topProvider.currency)} en ${analysis.topProvider.count} ítem(s)).`);
  }

  return lines.join("\n");
}
