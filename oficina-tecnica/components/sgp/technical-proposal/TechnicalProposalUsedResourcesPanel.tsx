"use client";

import { useMemo, useState } from "react";
import type { QuotationBudgetDetail } from "@/lib/sgp/quotationBudgetsRepository";
import { displayResourceCategory, type TechnicalProposalUsedResourceLike } from "@/lib/sgp/technicalProposalResourceUsage";

export type UsedResourceItem = TechnicalProposalUsedResourceLike & {
  resourceCategory: string;
};

type MarginRow = {
  key: string;
  label: string;
  base: number;
  offer: number | null;
};

type TechnicalProposalUsedResourcesPanelProps = {
  items: UsedResourceItem[];
  canViewPrices?: boolean;
  budgetDetail: QuotationBudgetDetail | null;
  busy?: boolean;
  canCreateBudgetFromTechnicalProposal?: boolean;
  canApplyMargins?: boolean;
  onCreateBudgetFromTechnicalProposal?: () => void | Promise<void>;
  onApplyMarginByType?: (resourceType: string, percent: number) => void | Promise<void>;
};

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatAmount(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${currency} ${new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function marginPercent(row: MarginRow): number {
  if (row.offer === null || row.base <= 0) return 0;
  return ((row.offer / row.base) - 1) * 100;
}

export function TechnicalProposalUsedResourcesPanel({
  items,
  canViewPrices = false,
  budgetDetail,
  busy = false,
  canCreateBudgetFromTechnicalProposal = false,
  canApplyMargins = false,
  onCreateBudgetFromTechnicalProposal,
  onApplyMarginByType,
}: TechnicalProposalUsedResourcesPanelProps) {
  const [editingType, setEditingType] = useState<string | null>(null);
  const [percentDraft, setPercentDraft] = useState("");
  const currency = budgetDetail?.presupuesto.monedaCodigo ?? items[0]?.moneda ?? "PEN";

  const rows = useMemo<MarginRow[]>(() => {
    const grouped = new Map<string, MarginRow>();
    const itemByRowId = new Map(items.map((item) => [item.rowId, item]));
    const itemByMasterId = new Map(items.filter((item) => item.masterResourceId).map((item) => [item.masterResourceId as string, item]));

    if (budgetDetail) {
      for (const resource of budgetDetail.recursos) {
        const item = (resource.propuestaTecnicaRecursoId ? itemByRowId.get(resource.propuestaTecnicaRecursoId) : null)
          ?? itemByMasterId.get(resource.recursoId);
        if (!item) continue;
        const label = displayResourceCategory(
          resource.tipoRecursoSnapshot ?? resource.recurso?.tipoRecurso ?? item.tipo,
          item.resourceCategory,
        );
        const key = normalizeKey(label);
        const current = grouped.get(key) ?? { key, label, base: 0, offer: 0 };
        current.base += resource.cantidadPresupuestada * resource.precioBaseUnitario;
        current.offer = (current.offer ?? 0) + resource.cantidadPresupuestada * resource.precioOfertadoUnitario;
        grouped.set(key, current);
      }
    } else {
      for (const item of items) {
        const label = displayResourceCategory(item.tipo, item.resourceCategory);
        const key = normalizeKey(label);
        const current = grouped.get(key) ?? { key, label, base: 0, offer: null };
        current.base += item.cantidad * item.precio;
        grouped.set(key, current);
      }
    }

    return [...grouped.values()].sort((left, right) => left.label.localeCompare(right.label, "es", { sensitivity: "base" }));
  }, [budgetDetail, items]);

  const total = rows.reduce<MarginRow>(
    (result, row) => ({
      key: "total",
      label: "Total",
      base: result.base + row.base,
      offer: result.offer === null || row.offer === null ? null : result.offer + row.offer,
    }),
    { key: "total", label: "Total", base: 0, offer: budgetDetail ? 0 : null },
  );

  function beginPercentEdit(row: MarginRow) {
    if (!canApplyMargins) return;
    setEditingType(row.key);
    setPercentDraft(marginPercent(row).toFixed(2));
  }

  async function commitPercent(row: MarginRow) {
    if (!canApplyMargins || !onApplyMarginByType) return;
    const nextPercent = Number(percentDraft.replace(",", "."));
    setEditingType(null);
    if (!Number.isFinite(nextPercent)) return;
    await onApplyMarginByType(row.label, nextPercent);
  }

  if (!canViewPrices) return null;

  return (
    <section className="panel panel-margins active" aria-label="Margenes por tipo de recurso">
      <div className="margin-status">
        <div>
          <strong>{budgetDetail ? `Presupuesto ${budgetDetail.presupuesto.estado}` : "Sin presupuesto vinculado"}</strong>
          <span>{budgetDetail ? "Economia real del presupuesto" : "Base referencial de snapshots PT"}</span>
        </div>
        {!budgetDetail && onCreateBudgetFromTechnicalProposal ? (
          <button
            type="button"
            className="margin-create"
            onClick={() => void onCreateBudgetFromTechnicalProposal()}
            disabled={!canCreateBudgetFromTechnicalProposal || busy}
          >
            Crear presupuesto
          </button>
        ) : null}
      </div>

      <div className="margin-table-wrap">
        <table className="margin-table">
          <thead>
            <tr>
              <th>Tipo recurso</th>
              <th>Base</th>
              <th>Oferta</th>
              <th>Margen</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const margin = row.offer === null ? null : row.offer - row.base;
              const editing = editingType === row.key;
              return (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td className="money sensitive-cost">{formatAmount(row.base, currency)}</td>
                  <td className="money sensitive-cost">{formatAmount(row.offer, currency)}</td>
                  <td className="money sensitive-cost">{formatAmount(margin, currency)}</td>
                  <td className="num">
                    {editing ? (
                      <input
                        autoFocus
                        value={percentDraft}
                        onChange={(event) => setPercentDraft(event.target.value)}
                        onBlur={() => void commitPercent(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                          if (event.key === "Escape") setEditingType(null);
                        }}
                        aria-label={`Margen porcentual ${row.label}`}
                      />
                    ) : (
                      <button
                        type="button"
                        className="margin-percent"
                        onClick={() => beginPercentEdit(row)}
                        disabled={!canApplyMargins || busy}
                        title={canApplyMargins ? "Editar margen del presupuesto" : "Disponible al crear presupuesto"}
                      >
                        {row.offer === null ? "-" : `${marginPercent(row).toFixed(2)}%`}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="margin-empty">No hay recursos utilizados en la propuesta.</td>
              </tr>
            ) : null}
            {rows.length > 0 ? (
              <tr className="total2">
                <td>Total</td>
                <td className="money sensitive-cost">{formatAmount(total.base, currency)}</td>
                <td className="money sensitive-cost">{formatAmount(total.offer, currency)}</td>
                <td className="money sensitive-cost">{formatAmount(total.offer === null ? null : total.offer - total.base, currency)}</td>
                <td className="num">{total.offer === null ? "-" : `${marginPercent(total).toFixed(2)}%`}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="margin-note">
        {budgetDetail
          ? canApplyMargins
            ? "El porcentaje actualiza el precio ofertado de los recursos de ese tipo en el presupuesto BORRADOR."
            : "Solo lectura. La edicion requiere permiso economico y presupuesto BORRADOR."
          : "La oferta y el margen estaran disponibles al crear presupuesto."}
      </p>
    </section>
  );
}
