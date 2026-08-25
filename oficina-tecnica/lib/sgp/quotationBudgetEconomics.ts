import type { CotizacionEconomicRow } from "@/lib/sgp/demoData";

export type BudgetNumericInput = number | string | null | undefined;

export type BudgetResourceEconomicInput = {
  id?: string;
  partidaId?: string;
  recursoId?: string;
  cantidadPresupuestada: BudgetNumericInput;
  precioBaseUnitario: BudgetNumericInput;
  precioOfertadoUnitario: BudgetNumericInput;
  tipoRecurso?: string | null;
};

export type BudgetResourceEconomicRow = {
  id?: string;
  partidaId?: string;
  recursoId?: string;
  tipoRecurso: string;
  cantidadPresupuestada: number;
  precioBaseUnitario: number;
  precioOfertadoUnitario: number;
  base: number;
  ofertado: number;
  margen: number;
  porcentajeMargen: number;
};

export type BudgetEconomicTotals = {
  base: number;
  ofertado: number;
  margen: number;
  porcentajeMargen: number;
};

export type BudgetPartidaEconomicRow = BudgetEconomicTotals & {
  partidaId: string;
};

export type BudgetResourceTypeEconomicRow = BudgetEconomicTotals & {
  tipoRecurso: string;
};

export type BudgetEconomicSummary = {
  recursos: BudgetResourceEconomicRow[];
  partidas: BudgetPartidaEconomicRow[];
  tiposRecurso: BudgetResourceTypeEconomicRow[];
  total: BudgetEconomicTotals;
};

const DEFAULT_RESOURCE_TYPE = "Sin tipo";

export function toBudgetNumber(value: BudgetNumericInput, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const numeric = Number(value.trim());
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  return fallback;
}

function computeTotals(base: number, ofertado: number): BudgetEconomicTotals {
  const margen = ofertado - base;
  return {
    base,
    ofertado,
    margen,
    porcentajeMargen: base > 0 ? margen / base : 0,
  };
}

function sumTotals(rows: Array<Pick<BudgetEconomicTotals, "base" | "ofertado">>): BudgetEconomicTotals {
  const base = rows.reduce((acc, row) => acc + toBudgetNumber(row.base), 0);
  const ofertado = rows.reduce((acc, row) => acc + toBudgetNumber(row.ofertado), 0);
  return computeTotals(base, ofertado);
}

export function computeBudgetResourceEconomics(resource: BudgetResourceEconomicInput): BudgetResourceEconomicRow {
  const cantidadPresupuestada = toBudgetNumber(resource.cantidadPresupuestada);
  const precioBaseUnitario = toBudgetNumber(resource.precioBaseUnitario);
  const precioOfertadoUnitario = toBudgetNumber(resource.precioOfertadoUnitario);
  const base = cantidadPresupuestada * precioBaseUnitario;
  const ofertado = cantidadPresupuestada * precioOfertadoUnitario;

  return {
    id: resource.id,
    partidaId: resource.partidaId,
    recursoId: resource.recursoId,
    tipoRecurso: normalizeResourceType(resource.tipoRecurso),
    cantidadPresupuestada,
    precioBaseUnitario,
    precioOfertadoUnitario,
    ...computeTotals(base, ofertado),
  };
}

export function computeBudgetPartidaEconomics(params: {
  partidaId: string;
  resources: BudgetResourceEconomicInput[];
}): BudgetPartidaEconomicRow {
  const resources = params.resources
    .filter((resource) => resource.partidaId === params.partidaId)
    .map(computeBudgetResourceEconomics);

  return {
    partidaId: params.partidaId,
    ...sumTotals(resources),
  };
}

export function aggregateBudgetByResourceType(
  resources: BudgetResourceEconomicInput[],
): BudgetResourceTypeEconomicRow[] {
  const totalsByType = new Map<string, BudgetEconomicTotals>();

  for (const resource of resources.map(computeBudgetResourceEconomics)) {
    const current = totalsByType.get(resource.tipoRecurso) ?? computeTotals(0, 0);
    totalsByType.set(resource.tipoRecurso, computeTotals(current.base + resource.base, current.ofertado + resource.ofertado));
  }

  return Array.from(totalsByType.entries())
    .map(([tipoRecurso, totals]) => ({ tipoRecurso, ...totals }))
    .sort((a, b) => a.tipoRecurso.localeCompare(b.tipoRecurso, "es", { sensitivity: "base" }));
}

export function computeBudgetEconomics(params: {
  partidaIds: string[];
  resources: BudgetResourceEconomicInput[];
}): BudgetEconomicSummary {
  const recursos = params.resources.map(computeBudgetResourceEconomics);
  const partidas = params.partidaIds.map((partidaId) => computeBudgetPartidaEconomics({ partidaId, resources: params.resources }));

  return {
    recursos,
    partidas,
    tiposRecurso: aggregateBudgetByResourceType(params.resources),
    total: sumTotals(recursos),
  };
}

export function buildBudgetEconomicSummaryRows(resources: BudgetResourceEconomicInput[]): CotizacionEconomicRow[] {
  return aggregateBudgetByResourceType(resources).map((row) => ({
    tipo_recurso: row.tipoRecurso,
    base: row.base,
    oferta: row.ofertado,
    margen_ofertado_manual: row.margen,
  }));
}

function normalizeResourceType(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  return normalized || DEFAULT_RESOURCE_TYPE;
}
