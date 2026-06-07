"use client";

import { useMemo, useState } from "react";
import { FieldLabelIcon, type IconName } from "@/components/ui/FieldLabelIcon";
import { TableColumnHeader } from "@/components/ui/TableColumnHeader";

type CatalogTableProps<T extends { id: string } & Record<string, unknown>> = {
  rows: T[];
  columns: Array<{ key: string; title: string }>;
  onEdit: (row: T) => void;
  onDeactivate: (row: T) => void;
  onDelete: (row: T) => void;
};

type SortDirection = "asc" | "desc" | null;

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function iconForCatalogColumn(key: string, title: string): IconName {
  const token = `${key} ${title}`.toLowerCase();
  if (token.includes("codigo") || token.includes("código")) return "barcode";
  if (token.includes("nombre")) return "align-left";
  if (token.includes("orden")) return "hash";
  if (token.includes("activo")) return "check-circle";
  if (token.includes("email")) return "file-text";
  if (token.includes("ruc")) return "file-text";
  if (token.includes("contacto")) return "user";
  if (token.includes("simbolo") || token.includes("símbolo")) return "coins";
  return "file-text";
}

export function CatalogTable<T extends { id: string } & Record<string, unknown>>({
  rows,
  columns,
  onEdit,
  onDeactivate,
  onDelete,
}: CatalogTableProps<T>) {
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const visibleRows = useMemo(() => {
    const indexed = rows.map((row, originalIndex) => ({ row, originalIndex }));
    const filtered = indexed.filter(({ row }) =>
      columns.every((column) => {
        const query = (columnFilters[column.key] ?? "").trim();
        if (!query) return true;
        const value = String(row[column.key] ?? "");
        return normalizeSearchText(value).includes(normalizeSearchText(query));
      }),
    );

    if (!sortKey || !sortDirection) return filtered;
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a.row[sortKey];
      const bv = b.row[sortKey];
      const an = Number(av);
      const bn = Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn)) {
        const diff = (an - bn) * direction;
        if (diff !== 0) return diff;
        return a.originalIndex - b.originalIndex;
      }
      const diff = String(av ?? "").localeCompare(String(bv ?? ""), "es", { sensitivity: "base" }) * direction;
      if (diff !== 0) return diff;
      return a.originalIndex - b.originalIndex;
    });
  }, [columnFilters, columns, rows, sortDirection, sortKey]);

  function clearTableView() {
    setColumnFilters({});
    setSortKey(null);
    setSortDirection(null);
  }

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("asc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }
    if (sortDirection === "desc") {
      setSortKey(null);
      setSortDirection(null);
      return;
    }
    setSortDirection("asc");
  }

  function sortIndicator(key: string): string {
    if (sortKey !== key || !sortDirection) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  return (
    <div className="app-table-card min-w-0 overflow-hidden rounded-xl border border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <FieldLabelIcon icon="layout-grid" label="Tabla de catálogo" className="text-xs font-medium text-stone-700" />
        <button
          type="button"
          onClick={clearTableView}
          className="inline-flex h-6 min-h-6 items-center gap-1 rounded-md border border-border px-2 text-xs leading-none text-stone-600 hover:bg-stone-100"
          title="Limpiar filtros y orden"
        >
          <FieldLabelIcon icon="sliders-horizontal" label="Limpiar filtros" className="text-xs text-stone-600" />
        </button>
      </div>
      <div className="app-table-scroll max-h-[56vh]">
        <table className="w-max min-w-full border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
          <thead className="sticky top-0 z-10 bg-stone-50 text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="h-8 border-b border-border px-2 py-1 text-left font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="flex w-full items-center justify-between gap-1 rounded px-0.5 text-left hover:bg-stone-100"
                    title="Ordenar"
                  >
                    <TableColumnHeader icon={iconForCatalogColumn(column.key, column.title)} label={column.title} />
                    <span className="text-[9px] leading-none text-stone-400">{sortIndicator(column.key)}</span>
                  </button>
                </th>
              ))}
              <th className="h-8 border-b border-border px-2 py-1 text-left font-semibold">
                <TableColumnHeader icon="settings2" label="Acciones" />
              </th>
            </tr>
            <tr className="h-8">
              {columns.map((column) => (
                <th key={`filter-${column.key}`} className="border-b border-border bg-stone-50 px-2 py-1">
                  <input
                    value={columnFilters[column.key] ?? ""}
                    onChange={(event) =>
                      setColumnFilters((prev) => ({ ...prev, [column.key]: event.target.value }))
                    }
                    className="h-6 w-full rounded border border-stone-200 bg-white px-1 text-[10px] leading-none outline-none focus:border-stone-400"
                    placeholder=""
                  />
                </th>
              ))}
              <th className="border-b border-border bg-stone-50 px-2 py-1">
                <span className="block h-6" />
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ row }) => (
              <tr key={row.id} className="h-8 border-t border-border align-middle">
                {columns.map((column) => (
                  <td key={`${row.id}-${String(column.key)}`} className="h-8 px-2 py-1">
                    {String(row[column.key] ?? "-")}
                  </td>
                ))}
                <td className="h-8 px-2 py-1">
                  <div className="flex gap-1">
                    <button onClick={() => onEdit(row)} className="rounded border border-border px-2 py-0.5 text-[11px]">
                      Editar
                    </button>
                    <button onClick={() => onDeactivate(row)} className="rounded border border-border px-2 py-0.5 text-[11px]">
                      Desactivar
                    </button>
                    <button onClick={() => onDelete(row)} className="rounded border border-border px-2 py-0.5 text-[11px]">
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
