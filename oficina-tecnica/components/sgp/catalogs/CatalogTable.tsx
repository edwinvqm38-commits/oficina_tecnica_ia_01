"use client";

import { useMemo, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { FieldLabelIcon, type IconName } from "@/components/sgp/ui/FieldLabelIcon";
import { TableColumnHeader } from "@/components/sgp/ui/TableColumnHeader";

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

  function renderValue(row: T, key: string) {
    if (key === "activo") {
      return Boolean(row[key]) ? <Badge tone="success">Activo</Badge> : <Badge tone="neutral">Inactivo</Badge>;
    }
    return String(row[key] ?? "-");
  }

  return (
    <div className="app-table-card ops-table-card">
      <div className="ops-list-toolbar">
        <div className="ops-list-title-group">
          <FieldLabelIcon icon="layout-grid" label="Tabla de catálogo" className="ops-list-title" />
          <Badge tone="neutral">{visibleRows.length} registros</Badge>
        </div>
        <div className="ops-list-actions">
        <Button
          type="button"
          onClick={clearTableView}
          size="sm"
          variant="ghost"
          className="ops-list-action"
          title="Limpiar filtros y orden"
        >
          <FieldLabelIcon icon="sliders-horizontal" label="Limpiar filtros" className="ops-list-action-label" />
        </Button>
        </div>
      </div>
      <div className="app-table-scroll max-h-[56vh]">
        <table className="ops-table">
          <thead className="ops-table-head">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="ops-table-th">
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="ops-table-sort-button"
                    title="Ordenar"
                  >
                    <TableColumnHeader icon={iconForCatalogColumn(column.key, column.title)} label={column.title} />
                    <span className="ops-table-sort-indicator">{sortIndicator(column.key)}</span>
                  </button>
                </th>
              ))}
              <th className="ops-table-th">
                <TableColumnHeader icon="settings2" label="Acciones" />
              </th>
            </tr>
            <tr className="ops-table-filter-row">
              {columns.map((column) => (
                <th key={`filter-${column.key}`} className="ops-table-filter-cell">
                  <input
                    value={columnFilters[column.key] ?? ""}
                    onChange={(event) =>
                      setColumnFilters((prev) => ({ ...prev, [column.key]: event.target.value }))
                    }
                    className="ops-table-filter-input"
                    placeholder=""
                  />
                </th>
              ))}
              <th className="ops-table-filter-cell">
                <span className="ops-table-filter-placeholder" />
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr className="ops-table-empty-row">
                <td colSpan={columns.length + 1} className="ops-table-empty-cell">
                  No hay registros para los filtros aplicados.
                </td>
              </tr>
            ) : null}
            {visibleRows.map(({ row }) => (
              <tr key={row.id} className="ops-table-row">
                {columns.map((column) => (
                  <td key={`${row.id}-${String(column.key)}`} className="ops-table-td">
                    {renderValue(row, column.key)}
                  </td>
                ))}
                <td className="ops-table-td">
                  <div className="flex gap-1">
                    <Button type="button" onClick={() => onEdit(row)} size="sm" variant="ghost" className="ops-table-row-action">
                      Editar
                    </Button>
                    <Button type="button" onClick={() => onDeactivate(row)} size="sm" variant="ghost" className="ops-table-row-action ops-table-row-action--warning">
                      Desactivar
                    </Button>
                    <Button type="button" onClick={() => onDelete(row)} size="sm" variant="danger" className="ops-table-row-action">
                      Eliminar
                    </Button>
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
