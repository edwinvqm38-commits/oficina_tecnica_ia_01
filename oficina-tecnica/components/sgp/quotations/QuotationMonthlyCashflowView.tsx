"use client";

import { FieldLabelIcon, type IconName } from "@/components/sgp/ui/FieldLabelIcon";
import type { QuotationCashflowData } from "@/lib/sgp/quotationCashflow";
import { formatCurrencyNumber } from "@/lib/sgp/utils";

type QuotationMonthlyCashflowViewProps = {
  data: QuotationCashflowData;
  currency: "PEN" | "USD";
  activeMonthKey?: string | null;
  onMonthDoubleClick?: (monthKey: string) => void;
};

const INDICATORS = [
  { key: "base", label: "Base", tone: "text-sky-700 bg-sky-50" },
  { key: "oferta", label: "Oferta", tone: "text-amber-700 bg-amber-50" },
  { key: "real", label: "Real", tone: "text-emerald-700 bg-emerald-50" },
] as const;

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
  if (key.includes("utilidades")) return "tags";
  return "tags";
}

function money(value: number): string {
  return formatCurrencyNumber(value);
}

function compareTone(real: number, base: number): string {
  if (real <= 0) return "text-stone-700";
  if (base > 0 && real > base) return "font-semibold text-rose-700";
  return "font-semibold text-emerald-700";
}

function compareFillTone(real: number, base: number, oferta: number): string {
  if (real <= 0) return "";
  if (oferta > 0 && real > oferta) return "bg-rose-50";
  if (real < base) return "bg-emerald-50";
  if (real >= base && (oferta <= 0 || real <= oferta)) return "bg-amber-50";
  return "";
}

export function QuotationMonthlyCashflowView({
  data,
  currency,
  activeMonthKey = null,
  onMonthDoubleClick,
}: QuotationMonthlyCashflowViewProps) {
  const stickyTypeClass = "sticky left-0 z-20 bg-white";
  const stickyIndicatorClass = "sticky left-[220px] z-20 bg-white";
  const stickyTotalClass = "sticky left-[310px] z-20 bg-white";
  const stickyTypeHeaderClass = "sticky left-0 z-30 bg-stone-50";
  const stickyIndicatorHeaderClass = "sticky left-[220px] z-30 bg-stone-50";
  const stickyTotalHeaderClass = "sticky left-[310px] z-30 bg-stone-50";
  const stickyTypeFooterClass = "sticky left-0 z-30 bg-stone-50";
  const stickyIndicatorFooterClass = "sticky left-[220px] z-30 bg-stone-50";
  const stickyTotalFooterClass = "sticky left-[310px] z-30 bg-stone-50";

  return (
    <div className="flex min-h-0 flex-col">
      <div className="app-table-scroll min-h-0 overflow-auto border-t border-stone-200">
        <table className="w-max min-w-full table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
          <colgroup>
            <col style={{ width: "220px" }} />
            <col style={{ width: "90px" }} />
            <col style={{ width: "156px" }} />
            {data.months.map((month) => (
              <col key={month.key} style={{ width: "148px" }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-stone-50 text-muted">
            <tr>
              <th className={`h-[26px] px-2 py-0 text-left font-semibold ${stickyTypeHeaderClass}`}>Tipo recurso</th>
              <th className={`h-[26px] px-2 py-0 text-left font-semibold ${stickyIndicatorHeaderClass}`}>Indicador</th>
              <th className={`h-[26px] px-2 py-0 text-right font-semibold ${stickyTotalHeaderClass}`}>Total acumulado</th>
              {data.months.map((month) => (
                <th
                  key={month.key}
                  className={`h-[26px] px-2 py-0 text-right font-semibold whitespace-nowrap ${
                    activeMonthKey === month.key ? "bg-sky-50 text-sky-700" : ""
                  }`}
                >
                  <button
                    type="button"
                    onDoubleClick={() => onMonthDoubleClick?.(month.key)}
                    className="w-full text-right"
                    title={`Doble clic para ver el detalle semanal de ${month.label}`}
                  >
                    {month.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={data.months.length + 3} className="h-[52px] px-2 py-0 text-center text-stone-500">
                  No hay datos mensuales para mostrar en este proyecto.
                </td>
              </tr>
            ) : (
              data.rows.flatMap((row) =>
                INDICATORS.map((indicator, index) => {
                  const values =
                    indicator.key === "base"
                      ? row.baseByMonth
                      : indicator.key === "oferta"
                        ? row.ofertaByMonth
                        : row.realByMonth;
                  const total =
                    indicator.key === "base"
                      ? row.totalBase
                      : indicator.key === "oferta"
                        ? row.totalOferta
                        : row.totalReal;
                  const borderClass = index === 0 ? "border-t-2 border-stone-300" : "border-t border-border";

                  return (
                    <tr key={`${row.tipo_recurso}-${indicator.key}`} className={`h-[26px] ${borderClass} align-middle`}>
                      <td
                        className={`h-[26px] px-2 py-0 align-middle ${stickyTypeClass} ${
                          index === 0 ? "font-semibold text-stone-700" : ""
                        }`}
                      >
                        {index === 0 ? (
                          <div className="flex min-w-0 items-center gap-1">
                            <FieldLabelIcon
                              icon={summaryIconForType(row.tipo_recurso)}
                              label=""
                              className="shrink-0 [&>span:last-child]:hidden"
                            />
                            <span className="block truncate font-medium text-stone-700" title={row.tipo_recurso}>
                              {row.tipo_recurso}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className={`h-[26px] px-2 py-0 align-middle ${stickyIndicatorClass}`}>
                        <span className={`inline-flex rounded-full px-2 py-[1px] text-[10px] font-semibold ${indicator.tone}`}>
                          {indicator.label}
                        </span>
                      </td>
                      <td
                        className={`h-[26px] px-2 py-0 text-right align-middle font-medium whitespace-nowrap ${stickyTotalClass} ${
                          indicator.key === "base"
                            ? "text-sky-700"
                            : indicator.key === "oferta"
                              ? "text-amber-700"
                              : `${compareTone(total, row.totalBase)} ${compareFillTone(total, row.totalBase, row.totalOferta)}`
                        }`}
                      >
                        <span className="inline-block min-w-[108px] text-right tabular-nums">
                          {currency} {money(total)}
                        </span>
                      </td>
                      {values.map((value, valueIndex) => (
                        <td
                          key={`${row.tipo_recurso}-${indicator.key}-${valueIndex}`}
                          className={`h-[26px] px-2 py-0 text-right align-middle whitespace-nowrap ${
                            indicator.key === "base"
                              ? "text-sky-700"
                              : indicator.key === "oferta"
                                ? "text-amber-700"
                                : `${compareTone(value, row.baseByMonth[valueIndex] ?? 0)} ${compareFillTone(
                                    value,
                                    row.baseByMonth[valueIndex] ?? 0,
                                    row.ofertaByMonth[valueIndex] ?? 0,
                                  )}`
                          }`}
                        >
                          <span className="inline-block min-w-[96px] text-right tabular-nums">
                            {currency} {money(value)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                }),
              )
            )}
          </tbody>
          <tfoot className="border-t border-stone-300 bg-stone-50">
            {INDICATORS.map((indicator) => {
              const values =
                indicator.key === "base"
                  ? data.totals.baseByMonth
                  : indicator.key === "oferta"
                    ? data.totals.ofertaByMonth
                    : data.totals.realByMonth;
              const total =
                indicator.key === "base"
                  ? data.totals.totalBase
                  : indicator.key === "oferta"
                    ? data.totals.totalOferta
                    : data.totals.totalReal;

              return (
                <tr key={`total-${indicator.key}`} className="h-[26px] border-t border-stone-300 font-semibold align-middle">
                  <td className={`h-[26px] px-2 py-0 align-middle ${stickyTypeFooterClass}`}>
                    {indicator.key === "base" ? "Total" : ""}
                  </td>
                  <td className={`h-[26px] px-2 py-0 align-middle ${stickyIndicatorFooterClass}`}>
                    <span className={`inline-flex rounded-full px-2 py-[1px] text-[10px] font-semibold ${indicator.tone}`}>
                      {indicator.label}
                    </span>
                  </td>
                  <td
                    className={`h-[26px] px-2 py-0 text-right align-middle whitespace-nowrap ${stickyTotalFooterClass} ${
                      indicator.key === "base"
                        ? "text-sky-700"
                        : indicator.key === "oferta"
                          ? "text-amber-700"
                          : `${compareTone(total, data.totals.totalBase)} ${compareFillTone(
                              total,
                              data.totals.totalBase,
                              data.totals.totalOferta,
                            )}`
                    }`}
                  >
                    <span className="inline-block min-w-[108px] text-right tabular-nums">
                      {currency} {money(total)}
                    </span>
                  </td>
                  {values.map((value, index) => (
                    <td
                      key={`total-${indicator.key}-${index}`}
                      className={`h-[26px] px-2 py-0 text-right align-middle whitespace-nowrap ${
                        indicator.key === "base"
                          ? "text-sky-700"
                          : indicator.key === "oferta"
                            ? "text-amber-700"
                            : `${compareTone(value, data.totals.baseByMonth[index] ?? 0)} ${compareFillTone(
                                value,
                                data.totals.baseByMonth[index] ?? 0,
                                data.totals.ofertaByMonth[index] ?? 0,
                              )}`
                      }`}
                    >
                      <span className="inline-block min-w-[96px] text-right tabular-nums">
                        {currency} {money(value)}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
