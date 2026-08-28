"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  buildTechnicalProposalResourceTree,
  consolidateTechnicalProposalResources,
  displayResourceCategory,
  economicFieldsVisible,
  type ConsolidatedTechnicalProposalResource,
  type TechnicalProposalResourceEconomics,
  type TechnicalProposalScopeItemLike,
  type TechnicalProposalUsedResourceLike,
} from "@/lib/sgp/technicalProposalResourceUsage";
import type { ApplyBudgetResourcePriceReviewAction } from "@/lib/sgp/quotationBudgetsRepository";

type ResourceCategoryKey =
  | "mano_obra_directa"
  | "mano_obra_indirecta"
  | "materiales"
  | "consumibles"
  | "equipos_herramientas"
  | "subcontratos"
  | "gastos_generales"
  | "mano_obra"
  | "equipos"
  | "herramientas"
  | "vehiculos"
  | "transporte";

export type UsedResourceItem = TechnicalProposalUsedResourceLike & {
  resourceCategory: ResourceCategoryKey;
};

type TechnicalProposalUsedResourcesPanelProps = {
  items: UsedResourceItem[];
  scopeItems: TechnicalProposalScopeItemLike[];
  selectedRowId: string | null;
  canViewPrices?: boolean;
  economicsByResourceId?: Map<string, TechnicalProposalResourceEconomics>;
  canCreateBudgetFromTechnicalProposal?: boolean;
  canApplyPriceActions?: boolean;
  onCreateBudgetFromTechnicalProposal?: () => void | Promise<void>;
  onApplyPriceAction?: (
    recursoId: string,
    action: ApplyBudgetResourcePriceReviewAction,
    options?: { precioHistoricoId?: string | null; precioUnitario?: number | null },
  ) => void | Promise<void>;
  onSelectResource: (item: UsedResourceItem) => void;
  onReuseResource: (item: UsedResourceItem) => void;
};

type GroupingMode = "scope" | "unique";
type TreeNode = ReturnType<typeof buildTechnicalProposalResourceTree<UsedResourceItem>>[number];

function formatAmount(value: number | null | undefined, currency?: string | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${currency ?? ""} ${new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`.trim();
}

function categoryLabel(item: Pick<UsedResourceItem, "tipo" | "resourceCategory">): string {
  return displayResourceCategory(item.tipo, item.resourceCategory);
}

function kindLabel(kind: TechnicalProposalScopeItemLike["kind"]): string {
  if (kind === "group") return "Titulo";
  if (kind === "subgroup") return "Subtitulo";
  return "Actividad";
}

function actionButtonClassName(): string {
  return "h-6 rounded border border-stone-200 bg-white px-1.5 text-[9px] font-semibold text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50";
}

export function TechnicalProposalUsedResourcesPanel({
  items,
  scopeItems,
  selectedRowId,
  canViewPrices = true,
  economicsByResourceId,
  canCreateBudgetFromTechnicalProposal = false,
  canApplyPriceActions = false,
  onCreateBudgetFromTechnicalProposal,
  onApplyPriceAction,
  onSelectResource,
  onReuseResource,
}: TechnicalProposalUsedResourcesPanelProps) {
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("scope");
  const showEconomics = economicFieldsVisible(canViewPrices);
  const uniqueRows = useMemo(() => consolidateTechnicalProposalResources(items), [items]);
  const scopeTree = useMemo(() => buildTechnicalProposalResourceTree(scopeItems, items), [items, scopeItems]);

  function handleNewPrice(row: ConsolidatedTechnicalProposalResource) {
    if (!row.masterResourceId || !onApplyPriceAction) return;
    const value = window.prompt("Nuevo precio base unitario para este presupuesto:");
    if (value === null) return;
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) return;
    void onApplyPriceAction(row.masterResourceId, "NUEVO_PRECIO", { precioUnitario: price });
  }

  function renderResourceButton(item: UsedResourceItem) {
    return (
      <button
        key={item.rowId}
        type="button"
        onClick={() => onSelectResource(item)}
        onDoubleClick={(event) => {
          event.preventDefault();
          onReuseResource(item);
        }}
        title={item.descripcion || "-"}
        className={`block w-full rounded px-2 py-1.5 text-left text-[11px] ${
          selectedRowId === item.rowId ? "bg-teal-50 shadow-[inset_3px_0_0_#0f766e]" : "bg-white hover:bg-teal-50/50"
        }`}
      >
        <span className="block truncate font-semibold text-stone-800">{item.descripcion || "-"}</span>
        <span className="block truncate text-[10px] text-stone-500">
          {item.codigo || "-"} · {categoryLabel(item)} · {item.cantidad} {item.unidad || ""}
        </span>
      </button>
    );
  }

  function renderScopeNode(node: TreeNode, depth = 0): ReactNode {
    const groups = new Map<string, UsedResourceItem[]>();
    node.resources.forEach((resource) => {
      const label = categoryLabel(resource);
      groups.set(label, [...(groups.get(label) ?? []), resource]);
    });

    return (
      <div key={node.id} className="border border-stone-200 bg-stone-50">
        <div className="flex items-center justify-between gap-2 border-b border-stone-200 bg-stone-100 px-2 py-1" style={{ paddingLeft: `${8 + depth * 12}px` }}>
          <span className="min-w-0 truncate text-[11px] font-black text-stone-700">
            <span className="mr-1 text-[9px] uppercase text-stone-400">{kindLabel(node.kind)}</span>
            {node.number}. {node.title || "Item"}
          </span>
          <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-bold text-stone-500">
            {node.resources.length}
          </span>
        </div>
        {groups.size > 0 ? (
          <div className="space-y-1 p-1.5" style={{ paddingLeft: `${6 + depth * 12}px` }}>
            {[...groups.entries()].map(([label, rows]) => (
              <div key={label} className="overflow-hidden border border-stone-200 bg-white">
                <div className="border-b border-stone-100 bg-teal-50 px-2 py-1 text-[10px] font-black uppercase text-teal-800">
                  {label}
                </div>
                <div className="divide-y divide-stone-100">{rows.map(renderResourceButton)}</div>
              </div>
            ))}
          </div>
        ) : null}
        {node.children.length > 0 ? <div className="space-y-2 p-1.5">{node.children.map((child) => renderScopeNode(child, depth + 1))}</div> : null}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-[12px] font-black text-stone-800">Recursos usados</h3>
          <p className="text-[10px] text-stone-500">{items.length} registro(s) en la propuesta.</p>
        </div>
        <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-400">
          Agrupar
          <select
            value={groupingMode}
            onChange={(event) => setGroupingMode(event.target.value as GroupingMode)}
            className="h-6 border border-stone-300 bg-white px-2 text-[11px] font-semibold normal-case text-stone-700"
          >
            <option value="scope">Por alcance</option>
            <option value="unique">Unicos</option>
          </select>
        </label>
      </div>

      {!items.length ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-center text-[11px] text-stone-500">
          Aun no hay recursos usados en esta propuesta.
        </div>
      ) : (
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {groupingMode === "unique" ? (
            <div className="overflow-x-auto border border-stone-200 bg-white">
              <div
                className={`grid min-w-[620px] border-b border-stone-200 bg-stone-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-stone-500 ${
                  showEconomics
                    ? "grid-cols-[72px_minmax(150px,1.2fr)_92px_56px_58px_78px_88px_88px_96px_84px_92px_180px]"
                    : "grid-cols-[72px_minmax(150px,1.4fr)_92px_56px_70px_90px]"
                }`}
              >
                <span>Codigo</span>
                <span>Recurso</span>
                <span>Tipo</span>
                <span>Und.</span>
                <span>Apar.</span>
                <span className="text-right">Cantidad</span>
                {showEconomics ? (
                  <>
                    <span className="text-right">Maestro</span>
                    <span className="text-right">Historico</span>
                    <span className="text-right">Cotizacion</span>
                    <span>Origen</span>
                    <span>Revision</span>
                    <span>Acciones</span>
                  </>
                ) : null}
              </div>
              <div className="divide-y divide-stone-100">
                {uniqueRows.map((item) => {
                  const economics = item.masterResourceId ? economicsByResourceId?.get(item.masterResourceId) : undefined;
                  const canActOnRow = Boolean(canApplyPriceActions && item.masterResourceId && economics?.presupuestoEstado === "BORRADOR" && onApplyPriceAction);
                  return (
                    <div
                      key={item.key}
                      className={`grid min-w-[620px] items-center px-2 py-1.5 text-left text-[11px] ${
                        selectedRowId && item.rows.some((row) => row.rowId === selectedRowId) ? "bg-teal-50 shadow-[inset_3px_0_0_#0f766e]" : "bg-white hover:bg-teal-50/50"
                      } ${
                        showEconomics
                          ? "grid-cols-[72px_minmax(150px,1.2fr)_92px_56px_58px_78px_88px_88px_96px_84px_92px_180px]"
                          : "grid-cols-[72px_minmax(150px,1.4fr)_92px_56px_70px_90px]"
                      }`}
                    >
                      <button type="button" onClick={() => onSelectResource(item.rows[0] as UsedResourceItem)} className="truncate text-left font-bold text-teal-700">
                        {item.codigo || "-"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectResource(item.rows[0] as UsedResourceItem)}
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          onReuseResource(item.rows[0] as UsedResourceItem);
                        }}
                        className="truncate text-left font-semibold text-stone-800"
                      >
                        {item.descripcion || "-"}
                      </button>
                      <span className="truncate text-stone-500">{displayResourceCategory(item.tipo, item.rows[0]?.resourceCategory ?? "")}</span>
                      <span className="truncate text-stone-500">{item.unidad ?? "-"}</span>
                      <span className="text-stone-600 tabular-nums">{item.apariciones}</span>
                      <span className="text-right font-semibold tabular-nums text-stone-700">{item.noSumable ? "No sumable" : item.cantidadTotal}</span>
                      {showEconomics ? (
                        <>
                          <span className="text-right tabular-nums text-stone-600">{formatAmount(economics?.precioMaestroActual, economics?.monedaMaestro)}</span>
                          <span className="text-right tabular-nums text-stone-600">
                            {formatAmount(economics?.ultimoHistorico?.precioUnitario, economics?.ultimoHistorico?.monedaCodigo)}
                          </span>
                          <span className="text-right tabular-nums text-stone-600">
                            {economics?.costoCotizacionActual === null ? economics.costoCotizacionLabel : formatAmount(economics?.costoCotizacionActual, economics?.monedaMaestro)}
                          </span>
                          <span className="truncate text-stone-500">{economics?.origenPrecio ?? "-"}</span>
                          <span className="truncate text-stone-500">{economics?.estadoRevision ?? "-"}</span>
                          <span className="flex flex-wrap gap-1">
                            {economics?.presupuestoId ? (
                              <>
                                <button type="button" disabled={!canActOnRow} onClick={() => item.masterResourceId && onApplyPriceAction?.(item.masterResourceId, "MANTENER")} className={actionButtonClassName()}>
                                  Mantener
                                </button>
                                <button type="button" disabled={!canActOnRow} onClick={() => item.masterResourceId && onApplyPriceAction?.(item.masterResourceId, "MAESTRO")} className={actionButtonClassName()}>
                                  Maestro
                                </button>
                                <button
                                  type="button"
                                  disabled={!canActOnRow || !economics?.ultimoHistorico}
                                  onClick={() =>
                                    item.masterResourceId &&
                                    onApplyPriceAction?.(item.masterResourceId, "HISTORICO", { precioHistoricoId: economics?.ultimoHistorico?.id ?? null })
                                  }
                                  className={actionButtonClassName()}
                                >
                                  Historico
                                </button>
                                <button type="button" disabled={!canActOnRow} onClick={() => handleNewPrice(item)} className={actionButtonClassName()}>
                                  Nuevo
                                </button>
                              </>
                            ) : canCreateBudgetFromTechnicalProposal ? (
                              <button type="button" onClick={() => void onCreateBudgetFromTechnicalProposal?.()} className={actionButtonClassName()}>
                                Crear presupuesto
                              </button>
                            ) : (
                              <span className="text-[10px] text-stone-400">Solo lectura</span>
                            )}
                          </span>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            scopeTree.map((node) => renderScopeNode(node))
          )}
        </div>
      )}
    </section>
  );
}
