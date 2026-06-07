import type { Cotizacion, CotizacionEconomicRow, DetalleRequerimientoItem, Recurso, Requerimiento } from "@/lib/demoData";

export type QuotationEconomicComputedRow = {
  tipo_recurso: string;
  base: number;
  oferta: number;
  real: number;
  margen_ofertado: number;
  porcentaje_margen_ofertado: number;
  margen_real: number;
  porcentaje_margen_real: number;
};

export const QUOTATION_RESOURCE_TYPES: string[] = [
  "Mano de obra directa",
  "Mano de obra indirecta",
  "EPPs",
  "Examen médico",
  "Capacitaciones",
  "Cursos de inducción",
  "Cursos EKA",
  "Lavado de uniforme",
  "Alimentación",
  "Reglamento de ingreso",
  "Antecedentes policiales",
  "Materiales",
  "Consumibles",
  "Herramientas",
  "Equipos",
  "Vehículos",
  "Transporte",
  "Sub contratos",
  "Gastos generales",
  "Utilidades",
];

const NON_SUBTOTAL_TYPES = new Set(["Gastos generales", "Utilidades"]);

function safeNumber(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value);
}

export function buildEmptyQuotationEconomicSummary(): CotizacionEconomicRow[] {
  return QUOTATION_RESOURCE_TYPES.map((tipo) => ({
    tipo_recurso: tipo,
    base: 0,
    oferta: 0,
    margen_ofertado_manual: null,
  }));
}

export function normalizeCotizacionEconomicSummary(cotizacion: Cotizacion): CotizacionEconomicRow[] {
  const map = new Map((cotizacion.resumen_economico ?? []).map((row) => [row.tipo_recurso, row]));
  return QUOTATION_RESOURCE_TYPES.map((tipo) => {
    const source = map.get(tipo);
    return {
      tipo_recurso: tipo,
      base: safeNumber(source?.base),
      oferta: safeNumber(source?.oferta),
      margen_ofertado_manual:
        source?.margen_ofertado_manual === null || source?.margen_ofertado_manual === undefined
          ? null
          : safeNumber(source.margen_ofertado_manual),
    };
  });
}

export function computeQuotationEconomicRows(params: {
  cotizacion: Cotizacion;
  requerimientos: Requerimiento[];
  detalleItems: DetalleRequerimientoItem[];
  recursos: Recurso[];
}): {
  rows: QuotationEconomicComputedRow[];
  subtotal: QuotationEconomicComputedRow;
  total: QuotationEconomicComputedRow;
  relatedRequirements: Requerimiento[];
} {
  const { cotizacion, requerimientos, detalleItems, recursos } = params;
  const normalizedRows = normalizeCotizacionEconomicSummary(cotizacion);
  const relatedRequirements = requerimientos.filter((rq) => rq.cotizacion_id === cotizacion.id);
  const requirementIds = new Set(relatedRequirements.map((rq) => rq.id));
  const resourceTypeById = new Map(recursos.map((recurso) => [recurso.id, recurso.tipo_recurso]));
  const realByType = new Map<string, number>();

  for (const item of detalleItems) {
    if (!requirementIds.has(item.requerimiento_id)) continue;
    const tipo = resourceTypeById.get(item.recurso_id) ?? "";
    if (!tipo) continue;
    const current = realByType.get(tipo) ?? 0;
    realByType.set(tipo, current + safeNumber(item.costo_total_presupuestado));
  }

  const rows = normalizedRows.map((row) => {
    const base = safeNumber(row.base);
    const oferta = safeNumber(row.oferta);
    const real = safeNumber(realByType.get(row.tipo_recurso));
    const margen_ofertado =
      row.margen_ofertado_manual === null || row.margen_ofertado_manual === undefined
        ? oferta - base
        : safeNumber(row.margen_ofertado_manual);
    const porcentaje_margen_ofertado = base > 0 ? margen_ofertado / base : 0;
    const margen_real = oferta - real;
    const porcentaje_margen_real = base > 0 ? margen_real / base : 0;

    return {
      tipo_recurso: row.tipo_recurso,
      base,
      oferta,
      real,
      margen_ofertado,
      porcentaje_margen_ofertado,
      margen_real,
      porcentaje_margen_real,
    };
  });

  const subtotalRows = rows.filter((row) => !NON_SUBTOTAL_TYPES.has(row.tipo_recurso));
  const subtotalBase = subtotalRows.reduce((acc, row) => acc + row.base, 0);
  const subtotalOferta = subtotalRows.reduce((acc, row) => acc + row.oferta, 0);
  const subtotalReal = subtotalRows.reduce((acc, row) => acc + row.real, 0);
  const subtotalMargenOfertado = subtotalOferta - subtotalBase;
  const subtotalMargenReal = subtotalOferta - subtotalReal;

  const subtotal: QuotationEconomicComputedRow = {
    tipo_recurso: "Sub total",
    base: subtotalBase,
    oferta: subtotalOferta,
    real: subtotalReal,
    margen_ofertado: subtotalMargenOfertado,
    porcentaje_margen_ofertado: subtotalBase > 0 ? subtotalMargenOfertado / subtotalBase : 0,
    margen_real: subtotalMargenReal,
    porcentaje_margen_real: subtotalBase > 0 ? subtotalMargenReal / subtotalBase : 0,
  };

  const totalBase = rows.reduce((acc, row) => acc + row.base, 0);
  const totalOferta = rows.reduce((acc, row) => acc + row.oferta, 0);
  const totalReal = rows.reduce((acc, row) => acc + row.real, 0);
  const totalMargenOfertado = totalOferta - totalBase;
  const totalMargenReal = totalOferta - totalReal;

  const total: QuotationEconomicComputedRow = {
    tipo_recurso: "Total",
    base: totalBase,
    oferta: totalOferta,
    real: totalReal,
    margen_ofertado: totalMargenOfertado,
    porcentaje_margen_ofertado: totalBase > 0 ? totalMargenOfertado / totalBase : 0,
    margen_real: totalMargenReal,
    porcentaje_margen_real: totalBase > 0 ? totalMargenReal / totalBase : 0,
  };

  return { rows, subtotal, total, relatedRequirements };
}

export function importEconomicSummaryFromExcel(): null {
  return null;
}
