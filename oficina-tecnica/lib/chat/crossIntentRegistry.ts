// ── Registro amplio de intenciones cruzadas (crossIntentRegistry) ────────────
//
// En vez de escribir una función por cada frase exacta (150+), mapeamos muchas
// consultas naturales a un puñado de HERRAMIENTAS GENÉRICAS de Supabase. El
// registro tiene dos partes:
//
//   1) CROSS_INTENT_CATALOG: catálogo documentado de ≥30 patrones por familia
//      (A–E). Sirve de documentación viva y de base de pruebas.
//   2) matchCrossIntent(): el "cerebro" que generaliza — detecta la FAMILIA y los
//      MODIFICADORES (clasificación, estado, moneda, campo faltante, ranking) y
//      construye `GenericQueryOptions` para la herramienta genérica adecuada.
//
// La capacidad (implementada vs. pendiente) la decide el matcher según familia +
// modificadores + alcance: lo que las tools actuales NO pueden cruzar todavía se
// marca `capability: "pending"` y se responde con honestidad (no se inventa).

import type { ResolvedScope } from "./scopeResolver";

export type CrossIntentFamily =
  | "project_requirements"
  | "requirement_items"
  | "global_log"
  | "client_summary"
  | "catalog_resources";

export type GenericTool =
  | "queryProjectRequirements"
  | "queryRequirementItems"
  | "analyzeRequirementItems"
  | "queryGlobalRequirementLog"
  | "queryClientProjects"
  | "queryProjectSummary"
  | "queryCatalogResources"
  | "classifyTechnicalItems"
  | "buildClarificationOptions"
  | "recordQueryFeedback";

export type TechnicalClass = "electrico" | "mecanico" | "civil" | "instrumentacion" | "seguridad" | "otros";
export type QueryStatus = "pendiente" | "atendido" | "en_proceso" | "historico" | "ganada";
export type MissingField = "precio" | "precio_cero" | "proveedor" | "fecha" | "unidad" | "cantidad" | "trazabilidad" | "duplicado" | "incompleto";
export type SortBy = "costo_total_desc" | "precio_unitario_desc" | "fecha_desc" | "codigo_desc";

export interface GenericQueryOptions {
  scope?: "global" | "project" | "cotizacion" | "oc" | "requirement" | "client";
  projectCode?: string;
  cotizacionCode?: string;
  requirementCode?: string;
  ocCode?: string;
  client?: string;
  limitItems?: number;
  limitRequirements?: number;
  sortBy?: SortBy;
  status?: QueryStatus;
  classification?: TechnicalClass;
  missingField?: MissingField;
  currency?: "PEN" | "USD" | "mixta";
  includeEvidence?: boolean;
}

export interface CrossIntentEntry {
  id: string;
  family: CrossIntentFamily;
  example: string;
  tool: GenericTool;
  /** Capacidad nominal (la real la decide matchCrossIntent en runtime). */
  capability: "implemented" | "pending";
}

// ── Catálogo documentado (≥30 por familia) ───────────────────────────────────
// Compacto a propósito: cada entrada documenta un patrón natural y la tool a la
// que mapea. `pending` = el cruce aún no está conectado a las tools actuales.
const A: Array<[string, GenericTool, "implemented" | "pending"]> = [
  ["cuántos requerimientos tiene este proyecto", "queryProjectRequirements", "implemented"],
  ["cuántos RQ tiene esta cotización", "queryProjectRequirements", "implemented"],
  ["cuántos RQ tiene esta OC", "queryProjectRequirements", "implemented"],
  ["lista los RQ del proyecto", "queryProjectRequirements", "implemented"],
  ["lista los RQ de la cotización", "queryProjectRequirements", "implemented"],
  ["lista los RQ de la OC", "queryProjectRequirements", "implemented"],
  ["qué RQ están pendientes", "queryProjectRequirements", "implemented"],
  ["qué RQ están atendidos", "queryProjectRequirements", "implemented"],
  ["qué RQ están en proceso", "queryProjectRequirements", "implemented"],
  ["qué RQ tienen avance 0%", "queryProjectRequirements", "implemented"],
  ["qué RQ tienen avance 50%", "queryProjectRequirements", "implemented"],
  ["qué RQ tienen avance 100%", "queryProjectRequirements", "implemented"],
  ["qué RQ tienen ítems eléctricos", "queryProjectRequirements", "pending"],
  ["qué RQ tienen ítems mecánicos", "queryProjectRequirements", "pending"],
  ["qué RQ tienen ítems de instrumentación", "queryProjectRequirements", "pending"],
  ["qué RQ tienen ítems civiles", "queryProjectRequirements", "pending"],
  ["qué RQ tienen ítems sin precio", "queryProjectRequirements", "pending"],
  ["qué RQ tienen ítems con precio 0", "queryProjectRequirements", "pending"],
  ["qué RQ tienen costos en USD", "queryProjectRequirements", "pending"],
  ["qué RQ tienen costos en PEN", "queryProjectRequirements", "pending"],
  ["qué RQ mezclan PEN y USD", "queryProjectRequirements", "pending"],
  ["qué RQ tienen proveedores registrados", "queryProjectRequirements", "pending"],
  ["qué RQ no tienen proveedor", "queryProjectRequirements", "pending"],
  ["qué RQ tienen fechas de entrega", "queryProjectRequirements", "implemented"],
  ["qué RQ no tienen fechas", "queryProjectRequirements", "implemented"],
  ["qué RQ tienen guías de remisión", "queryProjectRequirements", "pending"],
  ["qué RQ no tienen trazabilidad", "queryProjectRequirements", "pending"],
  ["qué RQ tienen partidas duplicadas", "queryProjectRequirements", "pending"],
  ["qué RQ tienen ítems incompletos", "queryProjectRequirements", "pending"],
  ["resumen del estado de RQ del proyecto", "queryProjectSummary", "implemented"],
];

const B: Array<[string, GenericTool, "implemented" | "pending"]> = [
  ["qué ítems tiene este RQ", "queryRequirementItems", "implemented"],
  ["lista los ítems del requerimiento", "queryRequirementItems", "implemented"],
  ["qué partidas tiene este RQ", "queryRequirementItems", "implemented"],
  ["qué materiales tiene este RQ", "queryRequirementItems", "implemented"],
  ["qué recursos/partidas tiene este RQ", "queryRequirementItems", "implemented"],
  ["qué ítems eléctricos tiene", "classifyTechnicalItems", "implemented"],
  ["qué ítems mecánicos tiene", "classifyTechnicalItems", "implemented"],
  ["qué ítems de instrumentación tiene", "classifyTechnicalItems", "implemented"],
  ["qué ítems civiles tiene", "classifyTechnicalItems", "implemented"],
  ["qué ítems son más caros", "analyzeRequirementItems", "implemented"],
  ["top 5 ítems más caros del RQ", "analyzeRequirementItems", "implemented"],
  ["qué ítems no tienen precio", "analyzeRequirementItems", "implemented"],
  ["qué ítems tienen precio 0", "analyzeRequirementItems", "implemented"],
  ["qué ítems tienen costo total", "analyzeRequirementItems", "implemented"],
  ["qué ítems están en USD", "analyzeRequirementItems", "implemented"],
  ["qué ítems están en PEN", "analyzeRequirementItems", "implemented"],
  ["qué proveedores participan", "analyzeRequirementItems", "implemented"],
  ["qué proveedor tiene mayor monto", "analyzeRequirementItems", "implemented"],
  ["qué ítems no tienen proveedor", "analyzeRequirementItems", "implemented"],
  ["qué ítems no tienen unidad", "analyzeRequirementItems", "implemented"],
  ["qué ítems no tienen cantidad", "analyzeRequirementItems", "implemented"],
  ["qué ítems no tienen fecha", "analyzeRequirementItems", "pending"],
  ["qué ítems tienen fecha de entrega", "analyzeRequirementItems", "pending"],
  ["qué ítems tienen descripción incompleta", "analyzeRequirementItems", "implemented"],
  ["qué ítems están duplicados", "analyzeRequirementItems", "implemented"],
  ["qué campos están rellenados", "analyzeRequirementItems", "implemented"],
  ["qué columnas faltan", "analyzeRequirementItems", "implemented"],
  ["suma total del RQ por moneda", "analyzeRequirementItems", "implemented"],
  ["resumen económico del RQ", "analyzeRequirementItems", "implemented"],
  ["resumen técnico/económico del RQ", "analyzeRequirementItems", "implemented"],
];

const C: Array<[string, GenericTool, "implemented" | "pending"]> = [
  ["top 5 ítems eléctricos más caros", "queryGlobalRequirementLog", "pending"],
  ["top 10 ítems eléctricos más caros", "queryGlobalRequirementLog", "pending"],
  ["últimos 5 RQ con ítems eléctricos", "queryGlobalRequirementLog", "pending"],
  ["últimos RQ con ítems mecánicos", "queryGlobalRequirementLog", "pending"],
  ["últimos RQ con instrumentación", "queryGlobalRequirementLog", "pending"],
  ["RQ con mayor costo total", "queryGlobalRequirementLog", "pending"],
  ["RQ con mayor monto en USD", "queryGlobalRequirementLog", "pending"],
  ["RQ con mayor monto en PEN", "queryGlobalRequirementLog", "pending"],
  ["RQ con ítems sin precio", "queryGlobalRequirementLog", "pending"],
  ["RQ con ítems en precio 0", "queryGlobalRequirementLog", "pending"],
  ["RQ atendidos sin fecha de entrega", "queryGlobalRequirementLog", "implemented"],
  ["RQ pendientes con ítems valorizados", "queryGlobalRequirementLog", "pending"],
  ["RQ en proceso con costos altos", "queryGlobalRequirementLog", "pending"],
  ["RQ con partidas duplicadas", "queryGlobalRequirementLog", "pending"],
  ["RQ con ítems incompletos", "queryGlobalRequirementLog", "pending"],
  ["proveedores más frecuentes en RQ", "queryGlobalRequirementLog", "pending"],
  ["proveedores con mayor monto", "queryGlobalRequirementLog", "pending"],
  ["ítems más frecuentes", "queryGlobalRequirementLog", "pending"],
  ["materiales eléctricos más solicitados", "queryGlobalRequirementLog", "pending"],
  ["equipos eléctricos más solicitados", "queryGlobalRequirementLog", "pending"],
  ["RQ con varios proveedores", "queryGlobalRequirementLog", "pending"],
  ["RQ sin proveedor", "queryGlobalRequirementLog", "pending"],
  ["RQ con moneda mixta", "queryGlobalRequirementLog", "pending"],
  ["RQ históricos con pendientes", "queryGlobalRequirementLog", "implemented"],
  ["RQ nuevos sin atención", "queryGlobalRequirementLog", "implemented"],
  ["RQ por cliente", "queryGlobalRequirementLog", "implemented"],
  ["RQ por proyecto", "queryGlobalRequirementLog", "implemented"],
  ["RQ por cotización", "queryGlobalRequirementLog", "implemented"],
  ["RQ por estado", "queryGlobalRequirementLog", "implemented"],
  ["resumen global del log de requerimientos", "queryGlobalRequirementLog", "implemented"],
];

const D: Array<[string, GenericTool, "implemented" | "pending"]> = [
  ["últimas cotizaciones adjudicadas de NEXA", "queryClientProjects", "implemented"],
  ["últimos proyectos adjudicados de NEXA", "queryClientProjects", "pending"],
  ["últimas cotizaciones ganadas por cliente", "queryClientProjects", "implemented"],
  ["cotizaciones de NEXA con RQ asociados", "queryClientProjects", "pending"],
  ["proyectos adjudicados con cantidad de RQ", "queryClientProjects", "pending"],
  ["proyectos históricos con RQ pendientes", "queryClientProjects", "pending"],
  ["proyectos con monto 0 pero RQ con costos", "queryClientProjects", "pending"],
  ["proyectos sin RQ", "queryClientProjects", "pending"],
  ["proyectos con RQ atendidos", "queryClientProjects", "pending"],
  ["proyectos con RQ en proceso", "queryClientProjects", "pending"],
  ["proyectos con RQ pendientes", "queryClientProjects", "pending"],
  ["proyectos con ítems eléctricos", "queryClientProjects", "pending"],
  ["proyectos con ítems sin precio", "queryClientProjects", "pending"],
  ["proyectos con costos en USD", "queryClientProjects", "pending"],
  ["proyectos por OC", "queryClientProjects", "pending"],
  ["OC con RQ asociados", "queryProjectRequirements", "implemented"],
  ["OC sin requerimientos", "queryClientProjects", "pending"],
  ["cliente con más cotizaciones", "queryClientProjects", "pending"],
  ["cliente con más RQ", "queryClientProjects", "pending"],
  ["cliente con más RQ pendientes", "queryClientProjects", "pending"],
  ["cotizaciones por estado", "queryClientProjects", "implemented"],
  ["cotizaciones ganadas", "queryClientProjects", "implemented"],
  ["cotizaciones perdidas", "queryClientProjects", "pending"],
  ["cotizaciones históricas", "queryClientProjects", "implemented"],
  ["cotizaciones con avance 0%", "queryClientProjects", "implemented"],
  ["cotizaciones con avance 100%", "queryClientProjects", "implemented"],
  ["cotizaciones con monto registrado", "queryClientProjects", "implemented"],
  ["cotizaciones sin monto", "queryClientProjects", "implemented"],
  ["resumen de proyecto + RQ + costos", "queryProjectSummary", "implemented"],
  ["resumen ejecutivo por cliente", "queryClientProjects", "pending"],
];

const E: Array<[string, GenericTool, "implemented" | "pending"]> = [
  ["recursos eléctricos del catálogo", "queryCatalogResources", "implemented"],
  ["recursos mecánicos del catálogo", "queryCatalogResources", "implemented"],
  ["recursos civiles del catálogo", "queryCatalogResources", "implemented"],
  ["recursos de instrumentación", "queryCatalogResources", "implemented"],
  ["recursos por tipo", "queryCatalogResources", "implemented"],
  ["recursos por marca", "queryCatalogResources", "implemented"],
  ["recursos por proveedor", "queryCatalogResources", "implemented"],
  ["recursos activos", "queryCatalogResources", "implemented"],
  ["recursos inactivos", "queryCatalogResources", "implemented"],
  ["recursos por revisar", "queryCatalogResources", "implemented"],
  ["recursos sin marca", "queryCatalogResources", "implemented"],
  ["recursos sin proveedor", "queryCatalogResources", "implemented"],
  ["recursos sin precio", "queryCatalogResources", "implemented"],
  ["recursos en USD", "queryCatalogResources", "implemented"],
  ["recursos en PEN", "queryCatalogResources", "implemented"],
  ["recursos eléctricos más caros", "queryCatalogResources", "implemented"],
  ["recursos más baratos", "queryCatalogResources", "implemented"],
  ["recursos por moneda", "queryCatalogResources", "implemented"],
  ["recursos por categoría", "queryCatalogResources", "implemented"],
  ["recursos de Schneider", "queryCatalogResources", "implemented"],
  ["recursos de ABB", "queryCatalogResources", "implemented"],
  ["recursos de Siemens", "queryCatalogResources", "implemented"],
  ["recursos de Indeco", "queryCatalogResources", "implemented"],
  ["recursos de Fluke", "queryCatalogResources", "implemented"],
  ["consumibles eléctricos", "classifyTechnicalItems", "implemented"],
  ["herramientas eléctricas", "classifyTechnicalItems", "implemented"],
  ["materiales eléctricos", "classifyTechnicalItems", "implemented"],
  ["equipos eléctricos", "classifyTechnicalItems", "implemented"],
  ["recursos dudosos que requieren revisión", "classifyTechnicalItems", "implemented"],
  ["resumen del catálogo", "queryCatalogResources", "implemented"],
];

function buildCatalog(family: CrossIntentFamily, rows: Array<[string, GenericTool, "implemented" | "pending"]>, prefix: string): CrossIntentEntry[] {
  return rows.map(([example, tool, capability], i) => ({ id: `${prefix}${i + 1}`, family, example, tool, capability }));
}

export const CROSS_INTENT_CATALOG: CrossIntentEntry[] = [
  ...buildCatalog("project_requirements", A, "A"),
  ...buildCatalog("requirement_items", B, "B"),
  ...buildCatalog("global_log", C, "C"),
  ...buildCatalog("client_summary", D, "D"),
  ...buildCatalog("catalog_resources", E, "E"),
];

// ── Normalizador ─────────────────────────────────────────────────────────────
export function normalizeQuery(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// ── Extracción de modificadores ──────────────────────────────────────────────
const CLASS_RE: Array<[RegExp, TechnicalClass]> = [
  [/\belectric/, "electrico"],
  [/\bmecanic/, "mecanico"],
  [/\binstrumentac|\binstrument\b|\bmedicion\b/, "instrumentacion"],
  [/\bcivil(es)?\b|\bconcreto\b|\bestructur/, "civil"],
  [/\bseguridad\b|\bepp\b|\bproteccion personal\b/, "seguridad"],
];
const STATUS_RE: Array<[RegExp, QueryStatus]> = [
  [/\bpendientes?\b/, "pendiente"],
  [/\bproceso\b|\bcurso\b/, "en_proceso"],
  [/\batendidos?\b|\bcompletad|\bfinalizad|\bculminad/, "atendido"],
  [/\bhistoric/, "historico"],
  [/\bganad|\badjudicad/, "ganada"],
];
const MISSING_RE: Array<[RegExp, MissingField]> = [
  [/\bsin\s+precio\b|\bno\s+tienen?\s+precio\b/, "precio"],
  [/\bprecio\s+0\b|\bprecio\s+cero\b|\bprecio\s+en\s+0\b/, "precio_cero"],
  [/\bsin\s+proveedor\b|\bno\s+tienen?\s+proveedor\b/, "proveedor"],
  [/\bsin\s+fecha\b|\bno\s+tienen?\s+fecha\b/, "fecha"],
  [/\bsin\s+unidad\b|\bno\s+tienen?\s+unidad\b/, "unidad"],
  [/\bsin\s+cantidad\b|\bno\s+tienen?\s+cantidad\b/, "cantidad"],
  [/\bsin\s+trazabilidad\b|\bno\s+tienen?\s+trazabilidad\b/, "trazabilidad"],
  [/\bduplicad/, "duplicado"],
  [/\bincompletos?\b|\bincompleta\b/, "incompleto"],
];

export interface QueryModifiers {
  classification?: TechnicalClass;
  status?: QueryStatus;
  missingField?: MissingField;
  currency?: "PEN" | "USD" | "mixta";
  sortBy?: SortBy;
  limit?: number;
  count?: boolean;
  summary?: boolean;
}

export function extractModifiers(query: string): QueryModifiers {
  const t = normalizeQuery(query);
  const mods: QueryModifiers = {};

  for (const [re, cls] of CLASS_RE) if (re.test(t)) { mods.classification = cls; break; }
  for (const [re, st] of STATUS_RE) if (re.test(t)) { mods.status = st; break; }
  for (const [re, mf] of MISSING_RE) if (re.test(t)) { mods.missingField = mf; break; }

  const hasUsd = /\busd\b|\bdolar|\bd[oó]lares?\b/.test(t);
  const hasPen = /\bpen\b|\bsoles?\b|\bs\/\b/.test(t);
  if (/\bmixt|\bmezcl/.test(t) || (hasUsd && hasPen)) mods.currency = "mixta";
  else if (hasUsd) mods.currency = "USD";
  else if (hasPen) mods.currency = "PEN";

  if (/\bmas\s+car|\bmayor\s+(?:costo|monto|precio)|\bmas\s+costos/.test(t)) mods.sortBy = "costo_total_desc";
  else if (/\bmas\s+barat|\bmenor\s+(?:costo|precio)/.test(t)) mods.sortBy = "precio_unitario_desc";
  else if (/\bultim|\breciente|\bnuevos?\b/.test(t)) mods.sortBy = "fecha_desc";

  const numM = t.match(/\btop\s+(\d{1,2})\b|\b(\d{1,2})\s+(?:mas|items|recursos|rq|requerimientos)/);
  if (numM) mods.limit = Math.min(Math.max(parseInt(numM[1] ?? numM[2], 10), 1), 20);

  if (/\bcuantos?\b|\bnumero de\b|\bcantidad de\b/.test(t)) mods.count = true;
  if (/\bresumen\b|\bpanorama\b|\bresume/.test(t)) mods.summary = true;

  return mods;
}

// ── Detección de familia ──────────────────────────────────────────────────────
const RECURSO_RE = /\brecursos?\b|\bcatalogo\b/;
const ITEMS_RE = /\bitems?\b|\bpartidas?\b|\bmateriales?\b/;
const RQ_RE = /\brequerimientos?\b|\brqs?\b/;
const PROVIDER_LOG_RE = /\bproveedor(es)?\b|\blog\b|\btodos los requerimientos\b|\bglobal\b/;
const CLIENT_RE = /\bcliente\b|\badjudicad|\bganad|\bcotizaci/;

export interface CrossIntentMatch {
  family: CrossIntentFamily;
  tool: GenericTool;
  options: GenericQueryOptions;
  capability: "implemented" | "pending";
  confidence: number;
  reason: string;
}

/**
 * Generaliza una consulta natural a (familia, tool, opciones). Usa el alcance ya
 * resuelto (scopeResolver) para decidir scope/códigos. Devuelve null si no
 * reconoce ninguna familia de datos.
 */
export function matchCrossIntent(query: string, scope: ResolvedScope): CrossIntentMatch | null {
  const t = normalizeQuery(query);
  const mods = extractModifiers(query);

  const scopeOpts: GenericQueryOptions = {
    projectCode: scope.projectCode,
    cotizacionCode: scope.cotizacionCode,
    requirementCode: scope.requirementCode,
    ocCode: scope.ocCode,
    client: scope.client,
    status: mods.status,
    classification: mods.classification,
    missingField: mods.missingField,
    currency: mods.currency,
    sortBy: mods.sortBy,
    limitItems: mods.limit,
    limitRequirements: mods.limit,
  };

  // E) Catálogo de recursos — la palabra "recurso/catálogo" lo ancla.
  if (RECURSO_RE.test(t)) {
    const tool: GenericTool = mods.classification ? "classifyTechnicalItems" : "queryCatalogResources";
    return { family: "catalog_resources", tool, options: { ...scopeOpts, scope: "global" }, capability: "implemented", confidence: 0.8, reason: "Consulta sobre el catálogo de recursos." };
  }

  // B) Ítems de un requerimiento concreto (scope = requirement).
  if (scope.kind === "requirement" && (ITEMS_RE.test(t) || mods.classification || mods.sortBy || mods.missingField || mods.summary)) {
    const tool: GenericTool = mods.classification ? "classifyTechnicalItems"
      : (mods.sortBy || mods.missingField || mods.summary || mods.currency) ? "analyzeRequirementItems"
      : "queryRequirementItems";
    const capability = tool === "analyzeRequirementItems" && mods.missingField === "fecha" ? "pending" : "implemented";
    return { family: "requirement_items", tool, options: { ...scopeOpts, scope: "requirement" }, capability, confidence: 0.85, reason: "Análisis de ítems del requerimiento en alcance." };
  }

  // A) RQ de un proyecto/cotización/OC concreto.
  const projectScopeKind: "project" | "cotizacion" | "oc" | null =
    scope.kind === "project" || scope.kind === "cotizacion" || scope.kind === "oc" ? scope.kind : null;
  if (RQ_RE.test(t) && projectScopeKind) {
    if (mods.summary) {
      return { family: "project_requirements", tool: "queryProjectSummary", options: { ...scopeOpts, scope: projectScopeKind }, capability: "implemented", confidence: 0.8, reason: "Resumen de RQ del proyecto/cotización/OC." };
    }
    // Cruces a nivel de ítem (clasificación/precio/moneda) sobre todos los RQ del
    // proyecto requieren escaneo por ítem: aún no implementado.
    const itemLevel = Boolean(mods.classification || mods.missingField || mods.currency);
    return {
      family: "project_requirements",
      tool: "queryProjectRequirements",
      options: { ...scopeOpts, scope: projectScopeKind },
      capability: itemLevel ? "pending" : "implemented",
      confidence: 0.8,
      reason: itemLevel ? "Cruce ítem-sobre-proyecto (pendiente de capacidad)." : "Requerimientos del proyecto/cotización/OC.",
    };
  }

  // D) Cliente / cotizaciones / adjudicados.
  if (CLIENT_RE.test(t) && (scope.kind === "client" || /\bcotizaci|\bcliente\b|\badjudicad|\bganad/.test(t))) {
    const itemLevel = Boolean(mods.classification || mods.missingField);
    const crossRq = /\brq\b|\brequerimientos?\b|\badjudicad|\bproyectos?\b/.test(t) && !/\bcotizaci/.test(t);
    return {
      family: "client_summary",
      tool: "queryClientProjects",
      options: { ...scopeOpts, scope: "client" },
      capability: itemLevel || crossRq ? "pending" : "implemented",
      confidence: 0.7,
      reason: itemLevel || crossRq ? "Cruce cliente↔RQ/ítems (pendiente de capacidad)." : "Resumen de cotizaciones por cliente/estado.",
    };
  }

  // C) Log global de requerimientos (sin alcance concreto): análisis transversal.
  if (RQ_RE.test(t) || PROVIDER_LOG_RE.test(t)) {
    // Filtros simples por estado SÍ están soportados; los análisis transversales
    // (rankings por costo, sin-precio, frecuencias, duplicados) aún no.
    const analytical = Boolean(mods.sortBy || mods.missingField || mods.currency || mods.classification || /\bproveedor|\bfrecuent|\bduplicad/.test(t));
    return {
      family: "global_log",
      tool: "queryGlobalRequirementLog",
      options: { ...scopeOpts, scope: "global" },
      capability: analytical ? "pending" : "implemented",
      confidence: 0.55,
      reason: analytical ? "Análisis transversal del log (pendiente de capacidad)." : "Consulta/filtro del log de requerimientos.",
    };
  }

  return null;
}

/** Conteo de patrones por familia (para pruebas/documentación). */
export function catalogStats(): Record<CrossIntentFamily, number> {
  const out = { project_requirements: 0, requirement_items: 0, global_log: 0, client_summary: 0, catalog_resources: 0 } as Record<CrossIntentFamily, number>;
  for (const e of CROSS_INTENT_CATALOG) out[e.family]++;
  return out;
}
