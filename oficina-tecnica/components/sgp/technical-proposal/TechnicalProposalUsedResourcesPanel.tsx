"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { QuotationBudgetDetail, QuotationBudgetResource } from "@/lib/sgp/quotationBudgetsRepository";
import {
  displayResourceCategory,
  resolveTechnicalProposalEconomicVisibility,
  type TechnicalProposalUsedResourceLike,
} from "@/lib/sgp/technicalProposalResourceUsage";

export type UsedResourceItem = TechnicalProposalUsedResourceLike & {
  resourceCategory: string;
  observation?: string;
};

type ScopeItem = {
  id: string;
  level: number;
  number: string;
  kind: "group" | "subgroup" | "activity";
  title: string;
};

type SubtotalVisibility = {
  item: boolean;
  subtitle: boolean;
  title: boolean;
  resource_type: boolean;
};

type TechnicalProposalUsedResourcesPanelProps = {
  items: UsedResourceItem[];
  scopeItems: ScopeItem[];
  canViewPrices?: boolean;
  canViewMargin?: boolean;
  canViewEconomicSupport?: boolean;
  budgetDetail: QuotationBudgetDetail | null;
  busy?: boolean;
  canCreateBudgetFromTechnicalProposal?: boolean;
  canApplyMargins?: boolean;
  canEditPrices?: boolean;
  canEditEconomicSupport?: boolean;
  marginPercentByType: Record<string, number>;
  basePricesLocked: boolean;
  subtotalVisibility: SubtotalVisibility;
  onBasePricesLockedChange: (locked: boolean) => void;
  onSubtotalVisibilityChange: (value: SubtotalVisibility) => void;
  onCreateBudgetFromTechnicalProposal?: () => void | Promise<void>;
  onApplyMarginByType?: (resourceType: string, percent: number) => void | Promise<void>;
  onResourceChange?: (rowId: string, patch: { cantidad?: number; precioBaseUnitario?: number; observaciones?: string }) => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
};

type EconomicRow = {
  item: UsedResourceItem;
  budgetResource: QuotationBudgetResource | null;
  typeLabel: string;
  quantity: number;
  baseUnit: number;
  offerUnit: number;
  base: number;
  offer: number;
  marginPercent: number;
};

function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function formatAmount(value: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

function numberValue(value: string): number {
  const next = Number(value.replace(",", "."));
  return Number.isFinite(next) && next >= 0 ? next : 0;
}

export function TechnicalProposalUsedResourcesPanel({
  items,
  scopeItems,
  canViewPrices = false,
  canViewMargin = false,
  canViewEconomicSupport = false,
  budgetDetail,
  busy = false,
  canCreateBudgetFromTechnicalProposal = false,
  canApplyMargins = false,
  canEditPrices = false,
  canEditEconomicSupport = false,
  marginPercentByType,
  basePricesLocked,
  subtotalVisibility,
  onBasePricesLockedChange,
  onSubtotalVisibilityChange,
  onCreateBudgetFromTechnicalProposal,
  onApplyMarginByType,
  onResourceChange,
  onRefresh,
}: TechnicalProposalUsedResourcesPanelProps) {
  const [editingType, setEditingType] = useState<string | null>(null);
  const [percentDraft, setPercentDraft] = useState("");
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});
  const currency = budgetDetail?.presupuesto.monedaCodigo ?? items[0]?.moneda ?? "PEN";

  const rows = useMemo<EconomicRow[]>(() => {
    const byProposalRow = new Map(
      (budgetDetail?.recursos ?? []).filter((row) => row.propuestaTecnicaRecursoId).map((row) => [row.propuestaTecnicaRecursoId as string, row]),
    );
    const byMaster = new Map<string, QuotationBudgetResource[]>();
    for (const row of budgetDetail?.recursos ?? []) {
      byMaster.set(row.recursoId, [...(byMaster.get(row.recursoId) ?? []), row]);
    }

    return items.map((item) => {
      const budgetResource = byProposalRow.get(item.rowId) ?? (item.masterResourceId ? byMaster.get(item.masterResourceId)?.[0] : null) ?? null;
      const typeLabel = displayResourceCategory(
        budgetResource?.tipoRecursoSnapshot ?? budgetResource?.recurso?.tipoRecurso ?? item.tipo,
        item.resourceCategory,
      );
      const baseUnit = budgetResource?.precioBaseUnitario ?? item.precio;
      const configuredPercent = marginPercentByType[normalizeKey(typeLabel)] ?? 0;
      const offerUnit = budgetResource?.precioOfertadoUnitario ?? baseUnit * (1 + configuredPercent / 100);
      const quantity = item.cantidad;
      return {
        item,
        budgetResource,
        typeLabel,
        quantity,
        baseUnit,
        offerUnit,
        base: quantity * baseUnit,
        offer: quantity * offerUnit,
        marginPercent: baseUnit > 0 ? ((offerUnit / baseUnit) - 1) * 100 : configuredPercent,
      };
    });
  }, [budgetDetail, items, marginPercentByType]);

  const marginRows = useMemo(() => {
    const grouped = new Map<string, { key: string; label: string; base: number; offer: number }>();
    for (const row of rows) {
      const key = normalizeKey(row.typeLabel);
      const current = grouped.get(key) ?? { key, label: row.typeLabel, base: 0, offer: 0 };
      current.base += row.base;
      current.offer += row.offer;
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  }, [rows]);

  const totals = rows.reduce(
    (result, row) => ({ base: result.base + row.base, offer: result.offer + row.offer }),
    { base: 0, offer: 0 },
  );
  const totalMargin = totals.offer - totals.base;
  const totalPercent = totals.base > 0 ? totalMargin / totals.base * 100 : 0;
  const activityCount = new Set(items.map((item) => item.scopeItemId)).size;
  const visibility = resolveTechnicalProposalEconomicVisibility({
    canViewPrices,
    canViewMargin,
    canViewEconomicSupport,
  });
  const summaryCards = [
    ["Base total", formatAmount(totals.base, currency)],
    ["Oferta total", formatAmount(totals.offer, currency)],
    ...(visibility.showMargins
      ? [
          ["Margen", formatAmount(totalMargin, currency)],
          ["% margen", `${totalPercent.toFixed(2)}%`],
        ]
      : []),
    ["Rec. / partidas", `${rows.length} / ${activityCount}`],
  ];
  const tableColumnCount = 9 + (visibility.showMargins ? 1 : 0) + (visibility.showEconomicSupport ? 1 : 0);

  function beginPercentEdit(key: string, base: number, offer: number) {
    if (!canApplyMargins && budgetDetail) return;
    setEditingType(key);
    setPercentDraft((base > 0 ? ((offer / base) - 1) * 100 : marginPercentByType[key] ?? 0).toFixed(2));
  }

  async function commitPercent(label: string) {
    const nextPercent = numberValue(percentDraft);
    setEditingType(null);
    await onApplyMarginByType?.(label, nextPercent);
  }

  function changeSubtotal(key: keyof SubtotalVisibility, checked: boolean) {
    onSubtotalVisibilityChange({ ...subtotalVisibility, [key]: checked });
  }

  if (!visibility.showEconomicPanel) return null;

  return (
    <section className="flex h-full min-h-0 flex-col bg-white" aria-label="Presupuesto económico vivo">
      <div className="shrink-0 border-b border-slate-200 p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-wide text-slate-800">Presupuesto económico vivo</h3>
            <p className="text-[9px] text-slate-500">Misma estructura y cantidades de la propuesta técnica.</p>
          </div>
          <div className="flex items-center gap-1">
            <label className="flex items-center gap-1.5 px-1 text-[9px] font-semibold text-slate-500" title="Evita cambios accidentales al costo unitario base">
              <input type="checkbox" checked={basePricesLocked} onChange={(event) => onBasePricesLockedChange(event.target.checked)} disabled={!canEditPrices} /> Bloquear precio base
            </label>
            <button type="button" onClick={() => void onRefresh?.()} disabled={busy} className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Actualizar</button>
            <details className="relative">
              <summary className="cursor-pointer list-none rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 [&::-webkit-details-marker]:hidden">Más ▾</summary>
              <div className="absolute right-0 top-[calc(100%+4px)] z-40 grid w-52 gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                <div className="mb-1 text-[9px] font-black uppercase text-slate-500">Vista económica · Subtotales</div>
                {([['item', 'Partida'], ['subtitle', 'Subtítulo'], ['title', 'Título'], ['resource_type', 'Tipo de recurso']] as Array<[keyof SubtotalVisibility, string]>).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 py-1 text-[10px] text-slate-700">
                    <input type="checkbox" checked={subtotalVisibility[key]} onChange={(event) => changeSubtotal(key, event.target.checked)} /> {label}
                  </label>
                ))}
              </div>
            </details>
          </div>
        </div>

        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${summaryCards.length}, minmax(0, 1fr))` }}>
          {summaryCards.map(([label, value]) => (
            <div key={label} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1">
              <div className="truncate text-[8px] font-bold uppercase text-slate-400">{label}</div>
              <div className="truncate text-[10px] font-black tabular-nums text-slate-800" title={value}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {visibility.showMargins ? <div className="shrink-0 border-b border-slate-200 p-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h4 className="text-[9px] font-black uppercase tracking-wide text-slate-600">Márgenes por tipo de recurso</h4>
        </div>
        <div className="max-h-32 overflow-auto rounded border border-slate-200">
          <table className="w-full border-collapse text-[9px]">
            <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-2 py-1 text-left">Tipo</th><th className="px-2 py-1 text-right">Base</th><th className="px-2 py-1 text-right">%</th><th className="px-2 py-1 text-right">Oferta</th></tr></thead>
            <tbody>
              {marginRows.map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="px-2 py-1 font-semibold text-slate-700">{row.label}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{formatAmount(row.base, currency)}</td>
                  <td className="px-2 py-1 text-right">
                    {editingType === row.key ? (
                      <input autoFocus value={percentDraft} onChange={(event) => setPercentDraft(event.target.value)} onBlur={() => void commitPercent(row.label)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setEditingType(null); }} className="h-6 w-16 rounded border border-blue-300 px-1 text-right" />
                    ) : (
                      <button type="button" onClick={() => beginPercentEdit(row.key, row.base, row.offer)} disabled={Boolean(budgetDetail) && !canApplyMargins} className="rounded px-1 py-0.5 font-bold text-blue-700 hover:bg-blue-50 disabled:text-slate-400">{(row.base > 0 ? ((row.offer / row.base) - 1) * 100 : 0).toFixed(2)}%</button>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{formatAmount(row.offer, currency)}</td>
                </tr>
              ))}
              {marginRows.length === 0 ? <tr><td colSpan={4} className="px-2 py-4 text-center text-slate-400">Agrega recursos a una partida para proyectar su economía.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {!budgetDetail && onCreateBudgetFromTechnicalProposal ? (
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] text-slate-500">
            <span>Proyección local; al completar y guardar la PT se vincula el presupuesto.</span>
            <button type="button" onClick={() => void onCreateBudgetFromTechnicalProposal()} disabled={!canCreateBudgetFromTechnicalProposal || busy} className="rounded border border-slate-200 px-2 py-1 font-semibold disabled:opacity-50">Vincular ahora</button>
          </div>
        ) : null}
      </div> : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[1120px] w-full border-collapse text-[9px]">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
            <tr>{[
              "Tipo",
              "Código",
              "Descripción",
              "Unidad",
              "Cantidad",
              "Costo unit. base",
              "Parcial base",
              "Costo unit. oferta",
              "Parcial oferta",
              ...(visibility.showMargins ? ["Margen %"] : []),
              ...(visibility.showEconomicSupport ? ["Observación"] : []),
            ].map((label) => <th key={label} className="border-b border-r border-slate-200 px-1.5 py-1.5 text-left font-bold last:border-r-0">{label}</th>)}</tr>
          </thead>
          <tbody>
            {scopeItems.map((scopeItem) => {
              const itemRows = rows.filter((row) => row.item.scopeItemId === scopeItem.id);
              if (itemRows.length === 0) return null;
              const showSubtotal = scopeItem.kind === "activity" ? subtotalVisibility.item : scopeItem.level === 0 ? subtotalVisibility.title : subtotalVisibility.subtitle;
              const subtotalBase = itemRows.reduce((sum, row) => sum + row.base, 0);
              const subtotalOffer = itemRows.reduce((sum, row) => sum + row.offer, 0);
              return (
                <FragmentRows key={scopeItem.id}>
                  <tr className="border-y border-slate-200 bg-slate-50">
                    <td colSpan={tableColumnCount} className="px-2 py-1.5 font-bold text-slate-700" style={{ paddingLeft: `${8 + scopeItem.level * 12}px` }}>
                      {scopeItem.number}. {scopeItem.title}
                      {showSubtotal ? <span className="ml-2 font-normal text-slate-400">Base {formatAmount(subtotalBase, currency)} · Oferta {formatAmount(subtotalOffer, currency)}</span> : null}
                    </td>
                  </tr>
                  {itemRows.map((row) => {
                    const quantityKey = `${row.item.rowId}:quantity`;
                    const baseKey = `${row.item.rowId}:base`;
                    return (
                      <tr key={row.item.rowId} className="border-b border-slate-100 align-top hover:bg-blue-50/30">
                        <td className="border-r border-slate-100 px-1.5 py-1">{row.typeLabel}</td>
                        <td className="border-r border-slate-100 px-1.5 py-1 font-semibold">{row.item.codigo || "S/C"}</td>
                        <td className="max-w-52 border-r border-slate-100 px-1.5 py-1"><span className="block truncate" title={row.item.descripcion}>{row.item.descripcion}</span></td>
                        <td className="border-r border-slate-100 px-1.5 py-1">{row.item.unidad || "-"}</td>
                        <td className="border-r border-slate-100 px-1 py-0.5"><input value={cellDrafts[quantityKey] ?? String(row.quantity)} onChange={(event) => setCellDrafts((current) => ({ ...current, [quantityKey]: event.target.value }))} onBlur={(event) => { const value = numberValue(event.target.value); setCellDrafts((current) => { const next = { ...current }; delete next[quantityKey]; return next; }); void onResourceChange?.(row.item.rowId, { cantidad: value }); }} className="h-6 w-16 rounded border border-slate-200 px-1 text-right tabular-nums" /></td>
                        <td className="border-r border-slate-100 px-1 py-0.5"><input value={cellDrafts[baseKey] ?? row.baseUnit.toFixed(2)} onChange={(event) => setCellDrafts((current) => ({ ...current, [baseKey]: event.target.value }))} onBlur={(event) => { const value = numberValue(event.target.value); setCellDrafts((current) => { const next = { ...current }; delete next[baseKey]; return next; }); void onResourceChange?.(row.item.rowId, { precioBaseUnitario: value }); }} disabled={basePricesLocked || !canEditPrices} className="h-6 w-24 rounded border border-slate-200 px-1 text-right tabular-nums disabled:border-transparent disabled:bg-transparent" /></td>
                        <td className="border-r border-slate-100 px-1.5 py-1 text-right tabular-nums">{row.base.toFixed(2)}</td>
                        <td className="border-r border-slate-100 px-1.5 py-1 text-right tabular-nums">{row.offerUnit.toFixed(2)}</td>
                        <td className="border-r border-slate-100 px-1.5 py-1 text-right tabular-nums">{row.offer.toFixed(2)}</td>
                        {visibility.showMargins ? <td className="border-r border-slate-100 px-1.5 py-1 text-right tabular-nums">{row.marginPercent.toFixed(2)}%</td> : null}
                        {visibility.showEconomicSupport ? <td className="px-1 py-0.5"><input defaultValue={row.budgetResource?.observaciones ?? row.item.observation ?? ""} onBlur={(event) => void onResourceChange?.(row.item.rowId, { observaciones: event.target.value })} disabled={!canEditEconomicSupport} className="h-6 w-36 rounded border border-slate-200 px-1 disabled:border-transparent disabled:bg-transparent" /></td> : null}
                      </tr>
                    );
                  })}
                  {subtotalVisibility.resource_type ? Array.from(new Set(itemRows.map((row) => row.typeLabel))).map((typeLabel) => {
                    const typeRows = itemRows.filter((row) => row.typeLabel === typeLabel);
                    const typeBase = typeRows.reduce((sum, row) => sum + row.base, 0);
                    const typeOffer = typeRows.reduce((sum, row) => sum + row.offer, 0);
                    return (
                      <tr key={`${scopeItem.id}:subtotal:${typeLabel}`} className="bg-slate-50/70 text-slate-500">
                        <td colSpan={tableColumnCount} className="px-2 py-1 text-right font-semibold">
                          Subtotal {typeLabel} · Base {typeBase.toFixed(2)} · Oferta {typeOffer.toFixed(2)}
                        </td>
                      </tr>
                    );
                  }) : null}
                </FragmentRows>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FragmentRows({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
