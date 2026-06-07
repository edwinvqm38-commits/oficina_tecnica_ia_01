import type { Cotizacion, DetalleRequerimientoItem, Recurso, Requerimiento } from "@/lib/demoData";
import { normalizeDateForStorage } from "@/lib/utils";
import { QUOTATION_RESOURCE_TYPES, normalizeCotizacionEconomicSummary } from "@/lib/quotationEconomics";

export type QuotationCashflowMonth = {
  key: string;
  label: string;
};

export type QuotationCashflowRow = {
  tipo_recurso: string;
  baseByMonth: number[];
  ofertaByMonth: number[];
  realByMonth: number[];
  totalBase: number;
  totalOferta: number;
  totalReal: number;
};

export type QuotationCashflowData = {
  months: QuotationCashflowMonth[];
  projectStartKey: string;
  projectEndKey: string;
  visibleEndKey: string;
  totalProjectMonths: number;
  rows: QuotationCashflowRow[];
  totals: {
    baseByMonth: number[];
    ofertaByMonth: number[];
    realByMonth: number[];
    totalBase: number;
    totalOferta: number;
    totalReal: number;
  };
};

export type QuotationCashflowWeeklyRow = {
  tipo_recurso: string;
  weekValues: number[];
  monthBase: number;
  monthOferta: number;
  monthReal: number;
  requirementCount: number;
  itemCount: number;
};

export type QuotationCashflowDrillItem = {
  id: string;
  requirementId: string;
  monthKey: string;
  weekIndex: number;
  tipo_recurso: string;
  rqCodigo: string;
  fecha: string;
  estado: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  montoReal: number;
  solicitante: string;
  precioUnitario: number;
};

export type QuotationCashflowItemRecord = QuotationCashflowDrillItem;

export type QuotationCashflowWeeklyDrilldown = {
  monthKey: string;
  monthLabel: string;
  rows: QuotationCashflowWeeklyRow[];
  totals: {
    weekValues: number[];
    monthBase: number;
    monthOferta: number;
    monthReal: number;
    requirementCount: number;
    itemCount: number;
  };
  items: QuotationCashflowDrillItem[];
};

function safeNumber(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function toMonthKey(dateValue: string): string | null {
  const normalized = normalizeDateForStorage(dateValue);
  if (!normalized) return null;
  return normalized.slice(0, 7);
}

function fromMonthKey(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function toMonthKeyFromDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftDateByMonths(dateValue: string, monthsToAdd: number): string {
  const normalized = normalizeDateForStorage(dateValue);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  const shifted = new Date(year, month - 1 + monthsToAdd, day);
  return normalizeDateForStorage(
    `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`,
  );
}

function countInclusiveMonthsBetween(startDateValue: string, endDateValue: string): number {
  const start = normalizeDateForStorage(startDateValue);
  const end = normalizeDateForStorage(endDateValue);
  if (!start || !end) return 0;
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
}

function formatMonthLabel(monthKey: string): string {
  const date = fromMonthKey(monthKey);
  return new Intl.DateTimeFormat("es-PE", {
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(".", "")
    .replace(/\s+/g, " ");
}

function listMonthKeys(startKey: string, endKey: string): string[] {
  const start = fromMonthKey(startKey);
  const end = fromMonthKey(endKey);
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    keys.push(
      `${String(cursor.getFullYear()).padStart(4, "0")}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
}

function roundSeries(values: number[]): number[] {
  return values.map((value) => Number(value.toFixed(2)));
}

function balanceRounding(values: number[], expectedTotal: number): number[] {
  if (values.length === 0) return values;
  const rounded = roundSeries(values);
  const current = rounded.reduce((acc, value) => acc + value, 0);
  const diff = Number((expectedTotal - current).toFixed(2));
  if (diff === 0) return rounded;

  const lastIndex = rounded.length - 1;
  rounded[lastIndex] = Number((rounded[lastIndex] + diff).toFixed(2));
  return rounded;
}

function distributeMonthly(total: number, monthCount: number, realDistribution: number[]): number[] {
  if (monthCount === 0 || total <= 0) return Array.from({ length: monthCount }, () => 0);

  const realTotal = realDistribution.reduce((acc, value) => acc + value, 0);
  if (realTotal > 0) {
    return balanceRounding(realDistribution.map((value) => (value / realTotal) * total), total);
  }

  return balanceRounding(Array.from({ length: monthCount }, () => total / monthCount), total);
}

function resolveItemMonth(
  item: DetalleRequerimientoItem,
  requirementById: Map<string, Requerimiento>,
  quote: Cotizacion,
): string | null {
  const requirement = requirementById.get(item.requerimiento_id);

  return (
    toMonthKey(item.fecha_entrega) ||
    toMonthKey(item.fecha_compra) ||
    toMonthKey(item.fecha_coti) ||
    toMonthKey(requirement?.fecha_requerida ?? "") ||
    toMonthKey(requirement?.fecha_solicitud ?? "") ||
    toMonthKey(quote.fecha_entrega) ||
    toMonthKey(quote.fecha_entregada) ||
    toMonthKey(quote.fecha_oc) ||
    toMonthKey(quote.fecha_registro)
  );
}

function resolveWeekIndex(dateValue: string): number {
  const normalized = normalizeDateForStorage(dateValue);
  if (!normalized) return 4;
  const day = Number(normalized.slice(8, 10));
  if (day <= 7) return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  if (day <= 28) return 3;
  return 4;
}

export function collectQuotationCashflowItems(params: {
  cotizacion: Cotizacion;
  requerimientos: Requerimiento[];
  detalleItems: DetalleRequerimientoItem[];
  recursos: Recurso[];
}): QuotationCashflowItemRecord[] {
  const { cotizacion, requerimientos, detalleItems, recursos } = params;
  const relatedRequirements = requerimientos.filter((rq) => rq.cotizacion_id === cotizacion.id);
  const requirementById = new Map(relatedRequirements.map((rq) => [rq.id, rq]));
  const requirementIds = new Set(relatedRequirements.map((rq) => rq.id));
  const resourceById = new Map(recursos.map((resource) => [resource.id, resource]));

  return detalleItems
    .filter((item) => requirementIds.has(item.requerimiento_id))
    .map((item) => {
      const requirement = requirementById.get(item.requerimiento_id);
      const resource = resourceById.get(item.recurso_id);
      const monthKey = resolveItemMonth(item, requirementById, cotizacion);
      if (!monthKey) return null;

      const effectiveDate =
        normalizeDateForStorage(item.fecha_entrega) ||
        normalizeDateForStorage(item.fecha_compra) ||
        normalizeDateForStorage(item.fecha_coti) ||
        normalizeDateForStorage(requirement?.fecha_requerida ?? "") ||
        normalizeDateForStorage(requirement?.fecha_solicitud ?? "") ||
        "";

      return {
        id: item.id,
        requirementId: item.requerimiento_id,
        monthKey,
        weekIndex: resolveWeekIndex(effectiveDate),
        tipo_recurso: resource?.tipo_recurso ?? "",
        rqCodigo: requirement?.codigo ?? "",
        fecha: effectiveDate,
        estado: item.estado,
        descripcion: resource?.descripcion || item.historical_item_source?.descripcion || "-",
        unidad: resource?.unidad ?? item.historical_item_source?.unidad ?? "-",
        cantidad: safeNumber(item.cantidad),
        montoReal: safeNumber(item.costo_total_presupuestado),
        solicitante: requirement?.solicitante_rq ?? "",
        precioUnitario: safeNumber(item.precio_unitario),
      } satisfies QuotationCashflowItemRecord;
    })
    .filter((item): item is QuotationCashflowItemRecord => Boolean(item));
}

export function computeQuotationCashflow(params: {
  cotizacion: Cotizacion;
  requerimientos: Requerimiento[];
  detalleItems: DetalleRequerimientoItem[];
  recursos: Recurso[];
}): QuotationCashflowData {
  const { cotizacion, requerimientos, detalleItems, recursos } = params;
  const relatedRequirements = requerimientos.filter((rq) => rq.cotizacion_id === cotizacion.id);
  const requirementById = new Map(relatedRequirements.map((rq) => [rq.id, rq]));
  const requirementIds = new Set(relatedRequirements.map((rq) => rq.id));
  const resourceTypeById = new Map(recursos.map((resource) => [resource.id, resource.tipo_recurso]));
  const summaryRows = normalizeCotizacionEconomicSummary(cotizacion);

  const monthCandidates = new Set<string>();
  const realByTypeAndMonth = new Map<string, Map<string, number>>();

  const quoteMonthKeys = [
    cotizacion.fecha_registro,
    cotizacion.fecha_invitacion,
    cotizacion.fecha_consultas,
    cotizacion.fecha_entrega,
    cotizacion.fecha_entregada,
    cotizacion.fecha_oc,
  ]
    .map((value) => toMonthKey(value))
    .filter((value): value is string => Boolean(value));

  for (const key of quoteMonthKeys) {
    monthCandidates.add(key);
  }

  for (const rq of relatedRequirements) {
    const requestMonth = toMonthKey(rq.fecha_solicitud);
    const dueMonth = toMonthKey(rq.fecha_requerida);
    if (requestMonth) monthCandidates.add(requestMonth);
    if (dueMonth) monthCandidates.add(dueMonth);
  }

  for (const item of detalleItems) {
    if (!requirementIds.has(item.requerimiento_id)) continue;
    const tipo = resourceTypeById.get(item.recurso_id);
    if (!tipo) continue;

    const monthKey = resolveItemMonth(item, requirementById, cotizacion);
    if (!monthKey) continue;
    monthCandidates.add(monthKey);

    const typeMap = realByTypeAndMonth.get(tipo) ?? new Map<string, number>();
    typeMap.set(monthKey, safeNumber(typeMap.get(monthKey)) + safeNumber(item.costo_total_presupuestado));
    realByTypeAndMonth.set(tipo, typeMap);
  }

  const sortedCandidates = [...monthCandidates].sort();
  const fallbackMonthKey = toMonthKey(cotizacion.fecha_registro) ?? toMonthKey(cotizacion.fecha_entrega) ?? "2026-01";
  const inferredStartKey = sortedCandidates[0] ?? fallbackMonthKey;
  const inferredEndKey = sortedCandidates[sortedCandidates.length - 1] ?? fallbackMonthKey;

  const configuredStartDate =
    normalizeDateForStorage(cotizacion.fecha_inicio_analisis || "") ||
    normalizeDateForStorage(cotizacion.fecha_registro || "") ||
    "";
  const configuredEndDate =
    normalizeDateForStorage(cotizacion.fecha_fin_analisis || "") ||
    (configuredStartDate && cotizacion.meses_analisis && cotizacion.meses_analisis > 0
      ? shiftDateByMonths(configuredStartDate, cotizacion.meses_analisis - 1)
      : "");

  const projectStartKey = toMonthKey(configuredStartDate) ?? inferredStartKey;
  const projectEndKey = toMonthKey(configuredEndDate) ?? inferredEndKey;
  const currentMonthKey = toMonthKeyFromDate(new Date());
  const visibleEndKey = currentMonthKey < projectStartKey ? projectStartKey : currentMonthKey > projectEndKey ? projectEndKey : currentMonthKey;
  const projectMonthKeys = listMonthKeys(projectStartKey, projectEndKey);
  const visibleMonthKeys = listMonthKeys(projectStartKey, visibleEndKey);

  const months = visibleMonthKeys.map((key) => ({ key, label: formatMonthLabel(key) }));

  const rows = QUOTATION_RESOURCE_TYPES.map((tipo) => {
    const summaryRow = summaryRows.find((row) => row.tipo_recurso === tipo);
    const totalBase = safeNumber(summaryRow?.base);
    const totalOferta = safeNumber(summaryRow?.oferta);
    const realMap = realByTypeAndMonth.get(tipo) ?? new Map<string, number>();
    const projectRealByMonth = balanceRounding(
      projectMonthKeys.map((key) => safeNumber(realMap.get(key))),
      projectMonthKeys.reduce((acc, key) => acc + safeNumber(realMap.get(key)), 0),
    );
    const projectBaseByMonth = cotizacion.flat_mensual
      ? balanceRounding(Array.from({ length: projectMonthKeys.length }, () => (projectMonthKeys.length > 0 ? totalBase / projectMonthKeys.length : 0)), totalBase)
      : distributeMonthly(totalBase, projectMonthKeys.length, projectRealByMonth);
    const projectOfertaByMonth = cotizacion.flat_mensual
      ? balanceRounding(Array.from({ length: projectMonthKeys.length }, () => (projectMonthKeys.length > 0 ? totalOferta / projectMonthKeys.length : 0)), totalOferta)
      : distributeMonthly(totalOferta, projectMonthKeys.length, projectRealByMonth);

    const visibleStartIndex = 0;
    const visibleEndIndex = visibleMonthKeys.length - 1;
    const baseByMonth = projectBaseByMonth.slice(visibleStartIndex, visibleEndIndex + 1);
    const ofertaByMonth = projectOfertaByMonth.slice(visibleStartIndex, visibleEndIndex + 1);
    const realByMonth = projectRealByMonth.slice(visibleStartIndex, visibleEndIndex + 1);
    const totalReal = Number(realByMonth.reduce((acc, value) => acc + value, 0).toFixed(2));

    return {
      tipo_recurso: tipo,
      baseByMonth,
      ofertaByMonth,
      realByMonth,
      totalBase: Number(baseByMonth.reduce((acc, value) => acc + value, 0).toFixed(2)),
      totalOferta: Number(ofertaByMonth.reduce((acc, value) => acc + value, 0).toFixed(2)),
      totalReal,
    };
  }).filter((row) => row.totalBase > 0 || row.totalOferta > 0 || row.totalReal > 0);

  const totals = {
    baseByMonth: visibleMonthKeys.map((_, index) => Number(rows.reduce((acc, row) => acc + row.baseByMonth[index], 0).toFixed(2))),
    ofertaByMonth: visibleMonthKeys.map((_, index) =>
      Number(rows.reduce((acc, row) => acc + row.ofertaByMonth[index], 0).toFixed(2)),
    ),
    realByMonth: visibleMonthKeys.map((_, index) => Number(rows.reduce((acc, row) => acc + row.realByMonth[index], 0).toFixed(2))),
    totalBase: Number(rows.reduce((acc, row) => acc + row.totalBase, 0).toFixed(2)),
    totalOferta: Number(rows.reduce((acc, row) => acc + row.totalOferta, 0).toFixed(2)),
    totalReal: Number(rows.reduce((acc, row) => acc + row.totalReal, 0).toFixed(2)),
  };

  return {
    months,
    projectStartKey,
    projectEndKey,
    visibleEndKey,
    totalProjectMonths:
      cotizacion.meses_analisis && cotizacion.meses_analisis > 0
        ? cotizacion.meses_analisis
        : countInclusiveMonthsBetween(configuredStartDate, configuredEndDate) || projectMonthKeys.length,
    rows,
    totals,
  };
}

export function computeQuotationCashflowWeeklyDrilldown(params: {
  cotizacion: Cotizacion;
  requerimientos: Requerimiento[];
  detalleItems: DetalleRequerimientoItem[];
  recursos: Recurso[];
  monthKey: string;
}): QuotationCashflowWeeklyDrilldown {
  const { cotizacion, requerimientos, detalleItems, recursos, monthKey } = params;
  const cashflow = computeQuotationCashflow({
    cotizacion,
    requerimientos,
    detalleItems,
    recursos,
  });
  const monthIndex = cashflow.months.findIndex((month) => month.key === monthKey);
  const monthLabel = cashflow.months.find((month) => month.key === monthKey)?.label ?? formatMonthLabel(monthKey);

  const items = collectQuotationCashflowItems({
    cotizacion,
    requerimientos,
    detalleItems,
    recursos,
  }).filter((item) => item.monthKey === monthKey);

  const rows = cashflow.rows
    .map((row) => {
      const rowItems = items.filter((item) => item.tipo_recurso === row.tipo_recurso);
      const weekValues = Array.from({ length: 5 }, (_, weekIndex) =>
        Number(
          rowItems
            .filter((item) => item.weekIndex === weekIndex)
            .reduce((acc, item) => acc + item.montoReal, 0)
            .toFixed(2),
        ),
      );
      const requirementCount = new Set(rowItems.map((item) => item.rqCodigo).filter(Boolean)).size;
      const itemCount = rowItems.length;

      return {
        tipo_recurso: row.tipo_recurso,
        weekValues,
        monthBase: monthIndex >= 0 ? row.baseByMonth[monthIndex] ?? 0 : 0,
        monthOferta: monthIndex >= 0 ? row.ofertaByMonth[monthIndex] ?? 0 : 0,
        monthReal: monthIndex >= 0 ? row.realByMonth[monthIndex] ?? 0 : 0,
        requirementCount,
        itemCount,
      } satisfies QuotationCashflowWeeklyRow;
    })
    .filter((row) => row.monthBase > 0 || row.monthOferta > 0 || row.monthReal > 0 || row.itemCount > 0);

  return {
    monthKey,
    monthLabel,
    rows,
    totals: {
      weekValues: Array.from({ length: 5 }, (_, weekIndex) =>
        Number(rows.reduce((acc, row) => acc + row.weekValues[weekIndex], 0).toFixed(2)),
      ),
      monthBase: Number(rows.reduce((acc, row) => acc + row.monthBase, 0).toFixed(2)),
      monthOferta: Number(rows.reduce((acc, row) => acc + row.monthOferta, 0).toFixed(2)),
      monthReal: Number(rows.reduce((acc, row) => acc + row.monthReal, 0).toFixed(2)),
      requirementCount: new Set(items.map((item) => item.rqCodigo).filter(Boolean)).size,
      itemCount: items.length,
    },
    items,
  };
}
