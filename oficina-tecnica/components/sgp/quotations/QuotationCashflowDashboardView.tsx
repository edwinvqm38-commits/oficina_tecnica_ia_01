"use client";

import type { QuotationCashflowData, QuotationCashflowItemRecord } from "@/lib/sgp/quotationCashflow";
import type { Requerimiento } from "@/lib/sgp/demoData";
import { formatCurrencyNumber } from "@/lib/sgp/utils";

type QuotationCashflowDashboardViewProps = {
  data: QuotationCashflowData;
  currency: "PEN" | "USD";
  requirements: Requerimiento[];
  items: QuotationCashflowItemRecord[];
};

type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

function money(value: number): string {
  return formatCurrencyNumber(value);
}

function cumulative(values: number[]): number[] {
  let acc = 0;
  return values.map((value) => {
    acc += value;
    return Number(acc.toFixed(2));
  });
}

function buildLinePath(values: number[], width: number, height: number, maxValue: number): string {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const y = height - ((values[0] || 0) / Math.max(maxValue, 1)) * (height - 12) - 6;
    return `M 0 ${y} L ${width} ${y}`;
  }

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - (value / Math.max(maxValue, 1)) * (height - 12) - 6;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[], width: number, height: number, maxValue: number): string {
  if (values.length === 0) return "";
  const line = buildLinePath(values, width, height, maxValue);
  return `${line} L ${width} ${height} L 0 ${height} Z`;
}

function statusTone(value: number, baseline: number): string {
  if (baseline <= 0 && value <= 0) return "text-stone-600";
  if (value > baseline && baseline > 0) return "text-rose-700";
  return "text-emerald-700";
}

function DonutChart({ title, subtitle, segments }: { title: string; subtitle: string; segments: DonutSegment[] }) {
  const total = segments.reduce((acc, segment) => acc + segment.value, 0);
  const gradient = segments
    .filter((segment) => segment.value > 0)
    .map((segment, index, array) => {
      const start = (array.slice(0, index).reduce((acc, item) => acc + item.value, 0) / Math.max(total, 1)) * 100;
      const end = ((array.slice(0, index + 1).reduce((acc, item) => acc + item.value, 0) / Math.max(total, 1)) * 100);
      return `${segment.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="rounded border border-stone-200 bg-white p-3">
      <div className="text-[12px] font-semibold text-stone-700">{title}</div>
      <div className="mt-1 text-[10px] leading-relaxed text-stone-500">{subtitle}</div>
      <div className="mt-3 flex items-center gap-3">
        <div
          className="h-24 w-24 shrink-0 rounded-full border border-stone-200"
          style={{
            background: total > 0 ? `conic-gradient(${gradient})` : "#f5f5f4",
            mask: "radial-gradient(circle at center, transparent 46%, black 47%)",
            WebkitMask: "radial-gradient(circle at center, transparent 46%, black 47%)",
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1 text-stone-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                {segment.label}
              </span>
              <span className="font-semibold text-stone-700">{segment.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HorizontalBars({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: number; color: string }>;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="rounded border border-stone-200 bg-white p-3">
      <div className="text-[12px] font-semibold text-stone-700">{title}</div>
      <div className="mt-1 text-[10px] leading-relaxed text-stone-500">{subtitle}</div>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <div className="rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-[10px] text-stone-500">
            No hay datos para este filtro.
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[110px_1fr_48px] items-center gap-2 text-[10px]">
              <span className="truncate text-stone-600">{row.label}</span>
              <div className="h-3 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, backgroundColor: row.color }} />
              </div>
              <span className="text-right font-semibold text-stone-700">{row.value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LineChartCard({
  title,
  subtitle,
  months,
  series,
  currency,
  cumulativeMode = false,
}: {
  title: string;
  subtitle: string;
  months: string[];
  series: Array<{ label: string; values: number[]; color: string; fill?: string }>;
  currency: "PEN" | "USD";
  cumulativeMode?: boolean;
}) {
  const width = 520;
  const height = 180;
  const maxValue = Math.max(1, ...series.flatMap((item) => item.values));

  return (
    <div className="rounded border border-stone-200 bg-white p-3">
      <div className="text-[12px] font-semibold text-stone-700">{title}</div>
      <div className="mt-1 text-[10px] leading-relaxed text-stone-500">{subtitle}</div>
      <div className="mt-3 overflow-hidden rounded border border-stone-200 bg-stone-50/60 p-2">
        <svg viewBox={`0 0 ${width} ${height + 30}`} className="h-[190px] w-full">
          {Array.from({ length: 5 }, (_, index) => {
            const y = 10 + (index * (height - 20)) / 4;
            return <line key={`grid-${index}`} x1="0" y1={y} x2={width} y2={y} stroke="#e7e5e4" strokeWidth="1" />;
          })}
          {series.map((item) =>
            item.fill ? (
              <path key={`${item.label}-fill`} d={buildAreaPath(item.values, width, height, maxValue)} fill={item.fill} />
            ) : null,
          )}
          {series.map((item) => (
            <path
              key={item.label}
              d={buildLinePath(item.values, width, height, maxValue)}
              fill="none"
              stroke={item.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {series.flatMap((item) =>
            item.values.map((value, index) => {
              const x = item.values.length === 1 ? width / 2 : (index / Math.max(item.values.length - 1, 1)) * width;
              const y = height - (value / Math.max(maxValue, 1)) * (height - 12) - 6;
              return <circle key={`${item.label}-${index}`} cx={x} cy={y} r="3" fill="#fff" stroke={item.color} strokeWidth="2" />;
            }),
          )}
          {months.map((month, index) => {
            const x = months.length === 1 ? width / 2 : (index / Math.max(months.length - 1, 1)) * width;
            return (
              <text key={month} x={x} y={height + 18} textAnchor="middle" fontSize="10" fill="#78716c">
                {month}
              </text>
            );
          })}
          <text x="0" y="10" fontSize="10" fill="#78716c">
            {currency} {cumulativeMode ? money(maxValue) : money(maxValue)}
          </text>
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {series.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] text-stone-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function QuotationCashflowDashboardView({
  data,
  currency,
  requirements,
  items,
}: QuotationCashflowDashboardViewProps) {
  const months = data.months.map((month) => month.label);
  const baseSeries = data.totals.baseByMonth;
  const offerSeries = data.totals.ofertaByMonth;
  const realSeries = data.totals.realByMonth;
  const baseCum = cumulative(baseSeries);
  const offerCum = cumulative(offerSeries);
  const realCum = cumulative(realSeries);

  const requirementStatusCounts = [
    { label: "Pendiente", value: requirements.filter((rq) => rq.estado === "Pendiente").length, color: "#f59e0b" },
    { label: "En proceso", value: requirements.filter((rq) => rq.estado === "En proceso").length, color: "#3b82f6" },
    { label: "Atendido", value: requirements.filter((rq) => rq.estado === "Atendido").length, color: "#10b981" },
  ];

  const coveredItems = items.filter((item) => item.precioUnitario > 0).length;
  const missingPriceItems = items.filter((item) => item.precioUnitario <= 0).length;
  const blankTypeItems = items.filter((item) => !item.tipo_recurso).length;
  const noManagementItems = items.filter((item) => !item.estado).length;

  const coverageCounts = [
    { label: "Costeado", value: coveredItems, color: "#059669" },
    { label: "Sin precio", value: missingPriceItems, color: "#f59e0b" },
    { label: "Tipo en blanco", value: blankTypeItems, color: "#94a3b8" },
    { label: "Sin gestión", value: noManagementItems, color: "#dc2626" },
  ];

  const missingByTypeMap = new Map<string, number>();
  for (const item of items) {
    if (item.precioUnitario > 0) continue;
    const current = missingByTypeMap.get(item.tipo_recurso || "Sin tipo") ?? 0;
    missingByTypeMap.set(item.tipo_recurso || "Sin tipo", current + 1);
  }
  const missingByTypeRows = [...missingByTypeMap.entries()]
    .map(([label, value]) => ({ label, value, color: "#f59e0b" }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="flex min-h-0 flex-col gap-3 pb-2">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <div className="rounded border border-stone-200 bg-white px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Meses analizados</div>
          <div className="mt-1 text-[14px] font-semibold text-stone-700">{data.months.length}</div>
        </div>
        <div className="rounded border border-stone-200 bg-white px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Tipos visibles</div>
          <div className="mt-1 text-[14px] font-semibold text-stone-700">{data.rows.length}</div>
        </div>
        <div className="rounded border border-stone-200 bg-white px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Base total</div>
          <div className="mt-1 text-[14px] font-semibold text-sky-700">
            {currency} {money(data.totals.totalBase)}
          </div>
        </div>
        <div className="rounded border border-stone-200 bg-white px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Real total</div>
          <div className={`mt-1 text-[14px] font-semibold ${statusTone(data.totals.totalReal, data.totals.totalBase)}`}>
            {currency} {money(data.totals.totalReal)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <LineChartCard
          title="Flujo mensual del costo"
          subtitle="Comparación mensual de Base, Oferta y Real según el filtro aplicado."
          months={months}
          currency={currency}
          series={[
            { label: "Base", values: baseSeries, color: "#0ea5e9", fill: "rgba(14,165,233,0.06)" },
            { label: "Oferta", values: offerSeries, color: "#f59e0b", fill: "rgba(245,158,11,0.05)" },
            { label: "Real", values: realSeries, color: "#059669", fill: "rgba(5,150,105,0.05)" },
          ]}
        />
        <LineChartCard
          title="Flujo acumulado mensual"
          subtitle="Curva acumulada para medir desviación del consumo real frente a Base y Oferta."
          months={months}
          currency={currency}
          cumulativeMode
          series={[
            { label: "Base acumulada", values: baseCum, color: "#0ea5e9", fill: "rgba(14,165,233,0.06)" },
            { label: "Oferta acumulada", values: offerCum, color: "#f59e0b", fill: "rgba(245,158,11,0.05)" },
            { label: "Real acumulado", values: realCum, color: "#059669", fill: "rgba(5,150,105,0.05)" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <DonutChart
          title="Estado de requerimientos"
          subtitle="Distribución de RQ únicos en el alcance filtrado."
          segments={requirementStatusCounts}
        />
        <DonutChart
          title="Cobertura de costeo de ítems"
          subtitle="Lectura rápida del estado de costeo del proyecto."
          segments={coverageCounts}
        />
        <HorizontalBars
          title="Ítems sin precio por tipo"
          subtitle="Tipos de recurso con más ítems pendientes de valorización."
          rows={missingByTypeRows}
        />
      </div>
    </div>
  );
}
