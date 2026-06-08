"use client";

import { FieldLabelIcon, type IconName } from "@/components/sgp/ui/FieldLabelIcon";
import type { QuotationCashflowDrillItem, QuotationCashflowWeeklyDrilldown } from "@/lib/sgp/quotationCashflow";
import { formatCurrencyNumber, formatDate } from "@/lib/sgp/utils";

type DrillSelection = {
  tipo_recurso: string;
  weekIndex: number | null;
};

type QuotationCashflowDrilldownPanelProps = {
  currency: "PEN" | "USD";
  selectedMonthLabel: string | null;
  weeklyData: QuotationCashflowWeeklyDrilldown | null;
  selection: DrillSelection | null;
  onOpenRequirement?: (requirementId: string) => void;
  onClearMonth: () => void;
  onSelectDrill: (selection: DrillSelection) => void;
  onClearDrill: () => void;
};

const WEEK_LABELS = ["Semana 1", "Semana 2", "Semana 3", "Semana 4", "Semana 5"] as const;
const WEEK_RANGES = ["1-7", "8-14", "15-21", "22-28", "29-fin"] as const;

function summaryIconForType(typeName: string): IconName {
  const key = typeName.toLowerCase();
  if (key.includes("mano de obra directa")) return "hard-hat";
  if (key.includes("mano de obra indirecta")) return "users";
  if (key.includes("epps")) return "shield";
  if (key.includes("examen médico")) return "heart-pulse";
  if (key.includes("capacitaciones")) return "graduation-cap";
  if (key.includes("inducción")) return "book-open";
  if (key.includes("eka")) return "book-marked";
  if (key.includes("lavado")) return "shirt";
  if (key.includes("alimentación")) return "store";
  if (key.includes("reglamento")) return "clipboard-list";
  if (key.includes("antecedentes")) return "file-search";
  if (key.includes("materiales")) return "package";
  if (key.includes("consumibles")) return "package-open";
  if (key.includes("herramientas")) return "wrench";
  if (key.includes("equipos")) return "cog";
  if (key.includes("vehículos")) return "truck";
  if (key.includes("transporte")) return "bus";
  if (key.includes("sub contratos")) return "handshake";
  if (key.includes("gastos generales")) return "wallet";
  return "tags";
}

function money(value: number): string {
  return formatCurrencyNumber(value);
}

function filterItems(items: QuotationCashflowDrillItem[], selection: DrillSelection | null): QuotationCashflowDrillItem[] {
  if (!selection) return [];
  return items.filter(
    (item) =>
      item.tipo_recurso === selection.tipo_recurso &&
      (selection.weekIndex === null || item.weekIndex === selection.weekIndex),
  );
}

export function QuotationCashflowDrilldownPanel({
  currency,
  selectedMonthLabel,
  weeklyData,
  selection,
  onOpenRequirement,
  onClearMonth,
  onSelectDrill,
  onClearDrill,
}: QuotationCashflowDrilldownPanelProps) {
  const detailItems = filterItems(weeklyData?.items ?? [], selection);

  if (!weeklyData || !selectedMonthLabel) {
    return (
      <div className="mt-1 flex min-h-0 flex-1 flex-col rounded border border-border bg-white px-3 py-3">
        <div className="rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-[11px] leading-relaxed text-stone-500">
          Haz doble clic sobre el encabezado de un mes en la vista <span className="font-semibold text-stone-700">Flujo mensual</span> para revisar
          el gasto real semanal por tipo de recurso dentro de este proyecto.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex min-h-0 flex-1 flex-col rounded border border-border bg-white px-2 pt-2 pb-0">
      <div className="mb-2 flex items-start justify-between gap-2 px-1">
        <div>
          <div className="text-[11px] font-semibold text-stone-700">Detalle semanal del gasto real · {selectedMonthLabel}</div>
          <div className="mt-1 text-[10px] leading-relaxed text-stone-500">
            Doble clic en una semana o en <span className="font-semibold text-stone-700">Total mes</span> para ver los ítems que explican ese gasto.
          </div>
        </div>
        <button type="button" onClick={onClearMonth} className="rounded border border-stone-200 px-2 py-1 text-[10px] text-stone-500 hover:bg-stone-100">
          Cerrar
        </button>
      </div>

      <div className="app-table-scroll max-h-[260px] overflow-auto border-t border-stone-200">
        <table className="w-max min-w-full table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
          <colgroup>
            <col style={{ width: "180px" }} />
            {WEEK_LABELS.map((label) => (
              <col key={label} style={{ width: "96px" }} />
            ))}
            <col style={{ width: "148px" }} />
            <col style={{ width: "48px" }} />
            <col style={{ width: "56px" }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-stone-50 text-muted">
            <tr>
              <th className="h-[26px] px-2 py-0 text-left font-semibold">Tipo recurso</th>
              {WEEK_LABELS.map((label, index) => (
                <th key={label} className="h-[26px] px-2 py-0 text-right font-semibold whitespace-nowrap">
                  {label}
                  <div className="text-[9px] font-normal text-stone-400">{WEEK_RANGES[index]}</div>
                </th>
              ))}
              <th className="h-[26px] px-2 py-0 text-right font-semibold">Total mes</th>
              <th className="h-[26px] px-2 py-0 text-right font-semibold">RQ</th>
              <th className="h-[26px] px-2 py-0 text-right font-semibold">Ítems</th>
            </tr>
          </thead>
          <tbody>
            {weeklyData.rows.map((row) => (
              <tr key={row.tipo_recurso} className="h-[26px] border-t border-border align-middle">
                <td className="h-[26px] px-2 py-0 align-middle">
                  <div className="flex min-w-0 items-center gap-1">
                    <FieldLabelIcon icon={summaryIconForType(row.tipo_recurso)} label="" className="shrink-0 [&>span:last-child]:hidden" />
                    <span className="block truncate font-medium text-stone-700" title={row.tipo_recurso}>
                      {row.tipo_recurso}
                    </span>
                  </div>
                </td>
                {row.weekValues.map((value, index) => (
                  <td key={`${row.tipo_recurso}-${index}`} className="h-[26px] px-2 py-0 text-right align-middle">
                    <button
                      type="button"
                      onDoubleClick={() => onSelectDrill({ tipo_recurso: row.tipo_recurso, weekIndex: index })}
                      className={`w-full rounded px-1 py-0.5 text-right ${
                        selection?.tipo_recurso === row.tipo_recurso && selection.weekIndex === index ? "bg-sky-50 text-sky-700" : "text-stone-700 hover:bg-stone-100"
                      }`}
                      title={`Ver detalle de ${row.tipo_recurso} · ${WEEK_LABELS[index]}`}
                    >
                      {currency} {money(value)}
                    </button>
                  </td>
                ))}
                <td className="h-[26px] px-2 py-0 align-middle">
                  <button
                    type="button"
                    onDoubleClick={() => onSelectDrill({ tipo_recurso: row.tipo_recurso, weekIndex: null })}
                    className={`flex w-full flex-col rounded px-1 py-0.5 text-right ${
                      selection?.tipo_recurso === row.tipo_recurso && selection.weekIndex === null ? "bg-sky-50" : "hover:bg-stone-100"
                    }`}
                    title={`Ver total mensual de ${row.tipo_recurso}`}
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-sky-700">
                      BASE <span className="font-medium text-stone-700">{currency} {money(row.monthBase)}</span>
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                      OFERTA <span className="font-medium text-stone-700">{currency} {money(row.monthOferta)}</span>
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                      REAL <span className="font-semibold text-stone-800">{currency} {money(row.monthReal)}</span>
                    </span>
                  </button>
                </td>
                <td className="h-[26px] px-2 py-0 text-right align-middle">{row.requirementCount}</td>
                <td className="h-[26px] px-2 py-0 text-right align-middle">{row.itemCount}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-stone-300 bg-stone-50">
            <tr className="h-[26px] border-t border-stone-300 font-semibold align-middle">
              <td className="h-[26px] px-2 py-0">Total real del mes</td>
              {weeklyData.totals.weekValues.map((value, index) => (
                <td key={`week-total-${index}`} className="h-[26px] px-2 py-0 text-right">
                  {currency} {money(value)}
                </td>
              ))}
              <td className="h-[26px] px-2 py-0 text-right">
                {currency} {money(weeklyData.totals.monthReal)}
              </td>
              <td className="h-[26px] px-2 py-0 text-right">{weeklyData.totals.requirementCount}</td>
              <td className="h-[26px] px-2 py-0 text-right">{weeklyData.totals.itemCount}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-stone-200 pt-2">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <div className="text-[11px] font-semibold text-stone-700">
            {selection
              ? `Detalle de ítems · ${selection.tipo_recurso}${selection.weekIndex !== null ? ` · ${WEEK_LABELS[selection.weekIndex]}` : " · Total mes"}`
              : "Detalle de ítems"}
          </div>
          {selection ? (
            <button type="button" onClick={onClearDrill} className="rounded border border-stone-200 px-2 py-1 text-[10px] text-stone-500 hover:bg-stone-100">
              Limpiar
            </button>
          ) : null}
        </div>
        {selection ? (
          <div className="app-table-scroll min-h-0 flex-1 overflow-auto">
            <table className="w-max min-w-full table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
              <colgroup>
                <col style={{ width: "118px" }} />
                <col style={{ width: "78px" }} />
                <col style={{ width: "84px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "210px" }} />
                <col style={{ width: "54px" }} />
                <col style={{ width: "54px" }} />
                <col style={{ width: "82px" }} />
                <col style={{ width: "110px" }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-stone-50 text-muted">
                <tr>
                  <th className="h-[26px] px-2 py-0 text-left font-semibold">RQ</th>
                  <th className="h-[26px] px-2 py-0 text-left font-semibold">Fecha</th>
                  <th className="h-[26px] px-2 py-0 text-left font-semibold">Estado</th>
                  <th className="h-[26px] px-2 py-0 text-left font-semibold">Tipo</th>
                  <th className="h-[26px] px-2 py-0 text-left font-semibold">Descripción</th>
                  <th className="h-[26px] px-2 py-0 text-left font-semibold">Und</th>
                  <th className="h-[26px] px-2 py-0 text-right font-semibold">Cant.</th>
                  <th className="h-[26px] px-2 py-0 text-right font-semibold">{currency}</th>
                  <th className="h-[26px] px-2 py-0 text-left font-semibold">Solicitante</th>
                </tr>
              </thead>
              <tbody>
                {detailItems.map((item) => (
                  <tr key={item.id} className="h-[26px] border-t border-border align-middle">
                    <td className="h-[26px] px-2 py-0">
                      {item.requirementId && onOpenRequirement ? (
                        <button
                          type="button"
                          onClick={() => onOpenRequirement(item.requirementId)}
                          className="rounded-sm text-left font-medium text-sky-700 underline-offset-2 hover:underline hover:text-sky-800"
                          title={`Abrir ${item.rqCodigo}`}
                        >
                          {item.rqCodigo}
                        </button>
                      ) : (
                        <span className="font-medium text-sky-700">{item.rqCodigo}</span>
                      )}
                    </td>
                    <td className="h-[26px] px-2 py-0 whitespace-nowrap">{formatDate(item.fecha) || "-"}</td>
                    <td className="h-[26px] px-2 py-0">{item.estado}</td>
                    <td className="h-[26px] px-2 py-0">{item.tipo_recurso}</td>
                    <td className="h-[26px] px-2 py-0">{item.descripcion}</td>
                    <td className="h-[26px] px-2 py-0">{item.unidad}</td>
                    <td className="h-[26px] px-2 py-0 text-right">{item.cantidad.toFixed(2)}</td>
                    <td className="h-[26px] px-2 py-0 text-right whitespace-nowrap">
                      {currency} {money(item.montoReal)}
                    </td>
                    <td className="h-[26px] px-2 py-0">{item.solicitante}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-[11px] leading-relaxed text-stone-500">
            Selecciona con doble clic un valor semanal o el <span className="font-semibold text-stone-700">Total mes</span> para ver los ítems que componen ese gasto.
          </div>
        )}
      </div>
    </div>
  );
}
