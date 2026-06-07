"use client";

import { useMemo, useState } from "react";

type ResourceCategoryKey = "mano_obra" | "materiales" | "equipos" | "herramientas" | "consumibles";

export type UsedResourceItem = {
  rowId: string;
  masterResourceId: string | null;
  codigo: string;
  descripcion: string;
  tipo: string;
  cantidad: number;
  unidad: string;
  precio: number;
  moneda: "PEN" | "USD";
  resourceCategory: ResourceCategoryKey;
  activityNumber: string;
  activityTitle: string;
};

type TechnicalProposalUsedResourcesPanelProps = {
  items: UsedResourceItem[];
  selectedRowId: string | null;
  onSelectResource: (item: UsedResourceItem) => void;
  onReuseResource: (item: UsedResourceItem) => void;
};

type GroupingMode = "activity" | "type";

function groupLabel(mode: GroupingMode, item: UsedResourceItem): string {
  if (mode === "activity") return `${item.activityNumber} ${item.activityTitle || "Actividad"}`;
  return item.tipo || "Otros";
}

export function TechnicalProposalUsedResourcesPanel({ items, selectedRowId, onSelectResource, onReuseResource }: TechnicalProposalUsedResourcesPanelProps) {
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("activity");

  const groups = useMemo(() => {
    const grouped = new Map<string, UsedResourceItem[]>();
    items.forEach((item) => {
      const label = groupLabel(groupingMode, item);
      grouped.set(label, [...(grouped.get(label) ?? []), item]);
    });
    return [...grouped.entries()].map(([label, rows]) => ({ label, rows }));
  }, [groupingMode, items]);

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
            <option value="activity">Actividad</option>
            <option value="type">Tipo</option>
          </select>
        </label>
      </div>

      {!items.length ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-center text-[11px] text-stone-500">
          Aun no hay recursos usados en esta propuesta.
        </div>
      ) : (
        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {groups.map((group) => (
            <div key={group.label} className="overflow-hidden border border-stone-200 bg-stone-50">
              <div className="flex items-center justify-between border-b border-stone-200 bg-stone-100 px-2 py-1">
                <span className="truncate text-[11px] font-black text-stone-700">{group.label}</span>
                <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-bold text-stone-500">
                  {group.rows.length}
                </span>
              </div>
              <div className="divide-y divide-stone-200">
                {group.rows.map((item) => (
                  <button
                    key={item.rowId}
                    type="button"
                    onClick={() => onSelectResource(item)}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      onReuseResource(item);
                    }}
                    title={item.descripcion || "-"}
                    className={`block w-full px-2 py-1.5 text-left text-[11px] ${
                      selectedRowId === item.rowId ? "bg-teal-50 shadow-[inset_3px_0_0_#0f766e]" : "bg-white hover:bg-teal-50/50"
                    }`}
                  >
                    <span className="block truncate font-semibold text-stone-800">{item.descripcion || "-"}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
