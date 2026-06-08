"use client";

import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { FieldLabelIcon, type IconName } from "@/components/sgp/ui/FieldLabelIcon";
import { TableColumnHeader } from "@/components/sgp/ui/TableColumnHeader";

type Column<T> = {
  key: keyof T | string;
  title: string;
  icon?: IconName;
  render?: (row: T, index: number) => ReactNode;
  getValue?: (row: T) => string | number;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  filterable?: boolean;
  minWidth?: number;
};

type DataTableProps<T extends { id: string }> = {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  maxHeightClassName?: string;
  tableTitle?: string;
  tableIcon?: IconName;
  toolbarActions?: ReactNode;
  enableFilters?: boolean;
  enableSorting?: boolean;
  rowWindow?: { start: number; size: number };
  onVisibleRowsChange?: (rows: T[]) => void;
  onTableStateChange?: () => void;
  initialColumnFilters?: Record<string, string>;
  initialSortKey?: string | null;
  initialSortDirection?: SortDirection;
  onTableViewChange?: (state: DataTableViewState) => void;
};

type SortDirection = "asc" | "desc" | null;

export type DataTableViewState = {
  columnFilters: Record<string, string>;
  sortKey: string | null;
  sortDirection: SortDirection;
};

const DEFAULT_COLUMN_WIDTH = 140;
const MIN_COLUMN_WIDTH = 80;
const columnWidthMemory = new Map<string, number[]>();

function buildColumnSignature<T extends { id: string }>(columns: Column<T>[]): string {
  return columns.map((column) => `${String(column.key)}:${column.minWidth ?? DEFAULT_COLUMN_WIDTH}`).join("|");
}

function buildColumnMinimums<T extends { id: string }>(columns: Column<T>[]): number[] {
  return columns.map((column) => Math.max(column.minWidth ?? DEFAULT_COLUMN_WIDTH, MIN_COLUMN_WIDTH));
}

function buildWidthStorageKey(routePath: string, tableTitle: string | undefined, columnSignature: string): string {
  const tableKey = (tableTitle ?? "tabla").toLowerCase().replace(/\s+/g, "-");
  return `sgp-lite:table-widths:${routePath}:${tableKey}:${columnSignature}`;
}

function readStoredWidths(storageKey: string, minimums: number[], fallbacks: number[]): number[] {
  const normalize = (values: number[]): number[] =>
    values.map((value, index) => {
      const minWidth = minimums[index] ?? MIN_COLUMN_WIDTH;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.max(Math.round(numeric), minWidth) : minWidth;
    });

  const cached = columnWidthMemory.get(storageKey);
  if (cached && cached.length === minimums.length) {
    return normalize(cached);
  }

  if (typeof window === "undefined") return normalize(fallbacks);

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return normalize(fallbacks);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== minimums.length) return normalize(fallbacks);
    const restored = normalize(parsed as number[]);
    columnWidthMemory.set(storageKey, [...restored]);
    return restored;
  } catch {
    return normalize(fallbacks);
  }
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_()\-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesNormalizedSearch(sourceValue: unknown, queryValue: string): boolean {
  const source = normalizeSearchText(String(sourceValue ?? ""));
  const query = normalizeSearchText(queryValue);
  if (!query) return true;
  if (source.includes(query)) return true;

  const compactSource = source.replace(/\s+/g, "");
  const compactQuery = query.replace(/\s+/g, "");
  return compactQuery.length > 0 ? compactSource.includes(compactQuery) : true;
}

function defaultIconForColumn(key: string, title: string): IconName {
  const token = `${key} ${title}`.toLowerCase();
  if (token.includes("codigo") || token.includes("código")) return "barcode";
  if (token.includes("oc")) return "file-text";
  if (token.includes("cliente")) return "building";
  if (token.includes("proyecto")) return "file-text";
  if (token.includes("unidad")) return "map-pin";
  if (token.includes("moneda")) return "coins";
  if (token.includes("estado")) return "circle-dot";
  if (token.includes("responsable")) return "user";
  if (token.includes("fecha")) return "calendar";
  if (token.includes("monto")) return "calculator";
  if (token.includes("tipo")) return "tags";
  if (token.includes("descripcion") || token.includes("descripción")) return "align-left";
  if (token.includes("proveedor")) return "store";
  if (token.includes("marca")) return "tags";
  if (token.includes("archivo") || token.includes("ficha") || token.includes("imagen")) return "file-up";
  if (token.includes("activo")) return "check-circle";
  return "file-text";
}

function alignmentClass(align: Column<never>["align"]): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

function estimateTextWidth(value: string): number {
  return Math.round(value.length * 7 + 32);
}

function buildAutoWidths<T extends { id: string }>(columns: Column<T>[], rows: T[]): number[] {
  const sampleRows = rows.slice(0, 150);
  return columns.map((column) => {
    const minWidth = Math.max(column.minWidth ?? DEFAULT_COLUMN_WIDTH, MIN_COLUMN_WIDTH);
    const headerWidth = estimateTextWidth(column.title);
    const contentWidth = sampleRows.reduce((max, row) => {
      const rawValue = column.getValue
        ? column.getValue(row)
        : (row[column.key as keyof T] as unknown);
      const text = String(rawValue ?? "").trim();
      return Math.max(max, estimateTextWidth(text));
    }, minWidth);
    return Math.max(minWidth, Math.min(520, Math.max(headerWidth, contentWidth)));
  });
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  maxHeightClassName = "max-h-[62vh]",
  tableTitle,
  tableIcon = "clipboard-list",
  toolbarActions,
  enableFilters = true,
  enableSorting = true,
  rowWindow,
  onVisibleRowsChange,
  onTableStateChange,
  initialColumnFilters,
  initialSortKey = null,
  initialSortDirection = null,
  onTableViewChange,
}: DataTableProps<T>) {
  const pathname = usePathname() || "/";
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(() => initialColumnFilters ?? {});
  const [sortKey, setSortKey] = useState<string | null>(() => initialSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => initialSortDirection);
  const [isWidthsReady, setIsWidthsReady] = useState(false);
  const columnSignature = useMemo(() => buildColumnSignature(columns), [columns]);
  const columnMinimums = useMemo(() => buildColumnMinimums(columns), [columns]);
  const autoWidths = useMemo(() => buildAutoWidths(columns, rows), [columns, rows]);
  const widthStorageKey = useMemo(
    () => buildWidthStorageKey(pathname, tableTitle, columnSignature),
    [pathname, tableTitle, columnSignature],
  );
  const [columnWidths, setColumnWidths] = useState<number[]>(() =>
    readStoredWidths(
      buildWidthStorageKey(pathname, tableTitle, buildColumnSignature(columns)),
      buildColumnMinimums(columns),
      buildAutoWidths(columns, rows),
    ),
  );

  useEffect(() => {
    setIsWidthsReady(false);
    const restored = readStoredWidths(widthStorageKey, columnMinimums, autoWidths);
    setColumnWidths(restored);
    setIsWidthsReady(true);
  }, [columnSignature, columnMinimums, widthStorageKey, autoWidths]);

  useEffect(() => {
    columnWidthMemory.set(widthStorageKey, [...columnWidths]);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(widthStorageKey, JSON.stringify(columnWidths));
    } catch {
      // Ignore storage failures (private mode/quota).
    }
  }, [columnWidths, widthStorageKey]);

  const rowsWithOriginalIndex = useMemo(
    () => rows.map((row, index) => ({ row, originalIndex: index })),
    [rows],
  );

  const visibleRows = useMemo(() => {
    const filtered = rowsWithOriginalIndex.filter(({ row }) => {
      for (const column of columns) {
        const key = String(column.key);
        const query = (columnFilters[key] ?? "").trim();
        if (!query) continue;
        if (column.filterable === false) continue;
        const rawValue = column.getValue
          ? column.getValue(row)
          : (row[column.key as keyof T] as unknown);
        if (!matchesNormalizedSearch(rawValue, query)) return false;
      }
      return true;
    });

    if (!enableSorting || !sortKey || !sortDirection) return filtered;
    const activeColumn = columns.find((column) => String(column.key) === sortKey);
    if (!activeColumn || activeColumn.sortable === false) return filtered;
    const direction = sortDirection === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const av = activeColumn.getValue
        ? activeColumn.getValue(a.row)
        : (a.row[activeColumn.key as keyof T] as unknown);
      const bv = activeColumn.getValue
        ? activeColumn.getValue(b.row)
        : (b.row[activeColumn.key as keyof T] as unknown);

      const an = Number(av);
      const bn = Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn)) {
        const diff = (an - bn) * direction;
        if (diff !== 0) return diff;
        return a.originalIndex - b.originalIndex;
      }

      const at = Date.parse(String(av));
      const bt = Date.parse(String(bv));
      if (Number.isFinite(at) && Number.isFinite(bt)) {
        const diff = (at - bt) * direction;
        if (diff !== 0) return diff;
        return a.originalIndex - b.originalIndex;
      }

      const diff = String(av ?? "").localeCompare(String(bv ?? ""), "es", { sensitivity: "base" }) * direction;
      if (diff !== 0) return diff;
      return a.originalIndex - b.originalIndex;
    });
  }, [rowsWithOriginalIndex, columns, columnFilters, enableSorting, sortDirection, sortKey]);

  const renderedRows = useMemo(() => {
    if (!rowWindow) return visibleRows;
    const start = Math.max(0, rowWindow.start);
    const end = start + Math.max(0, rowWindow.size);
    return visibleRows.slice(start, end);
  }, [rowWindow, visibleRows]);

  useEffect(() => {
    onVisibleRowsChange?.(visibleRows.map(({ row }) => row));
  }, [onVisibleRowsChange, visibleRows]);

  function emitTableViewChange(nextState: DataTableViewState) {
    onTableStateChange?.();
    onTableViewChange?.(nextState);
  }

  function toggleSort(columnKey: string, sortable: boolean) {
    if (!enableSorting || !sortable) return;
    if (sortKey !== columnKey) {
      setSortKey(columnKey);
      setSortDirection("asc");
      emitTableViewChange({ columnFilters, sortKey: columnKey, sortDirection: "asc" });
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      emitTableViewChange({ columnFilters, sortKey: columnKey, sortDirection: "desc" });
      return;
    }
    if (sortDirection === "desc") {
      setSortKey(null);
      setSortDirection(null);
      emitTableViewChange({ columnFilters, sortKey: null, sortDirection: null });
      return;
    }
    setSortDirection("asc");
    emitTableViewChange({ columnFilters, sortKey: columnKey, sortDirection: "asc" });
  }

  function clearTableView() {
    setColumnFilters({});
    setSortKey(null);
    setSortDirection(null);
    emitTableViewChange({ columnFilters: {}, sortKey: null, sortDirection: null });
  }

  function sortIndicator(columnKey: string): string {
    if (!enableSorting) return "";
    if (sortKey !== columnKey || !sortDirection) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function startColumnResize(columnIndex: number, event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const initialWidth = columnWidths[columnIndex];
    const currentMin = columnMinimums[columnIndex] ?? MIN_COLUMN_WIDTH;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = Math.max(currentMin, Math.round(initialWidth + deltaX));
      setColumnWidths((prev) => {
        const updated = [...prev];
        updated[columnIndex] = nextWidth;
        return updated;
      });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      className={`app-table-card min-w-0 overflow-hidden rounded-xl border border-border bg-panel ${
        isWidthsReady ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <FieldLabelIcon
          icon={tableIcon}
          label={tableTitle ?? "Tabla"}
          className="text-xs font-medium text-stone-700"
        />
        <div className="flex items-center gap-1.5">
          {enableFilters ? (
            <button
              type="button"
              onClick={clearTableView}
              className="inline-flex h-6 min-h-6 items-center gap-1 rounded-md border border-border px-2 text-xs leading-none text-stone-600 hover:bg-stone-100"
              title="Limpiar filtros y orden"
            >
              <FieldLabelIcon icon="sliders-horizontal" label="Limpiar filtros" className="text-xs text-stone-600" />
            </button>
          ) : null}
          {toolbarActions}
        </div>
      </div>

      <div className={`app-table-scroll ${maxHeightClassName}`}>
        <table className="w-max min-w-full table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
          <colgroup>
            {columnWidths.map((width, index) => (
              <col key={`col-${index}`} style={{ width: `${width}px` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-stone-50 text-muted">
            <tr>
              {columns.map((column, index) => {
                const key = String(column.key);
                const sortable = column.sortable !== false;
                return (
                  <th
                    key={key}
                    className={`relative h-8 border-b border-border px-2 py-1 font-semibold ${alignmentClass(column.align)}`}
                  >
                    {enableSorting && sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(key, sortable)}
                        className="flex w-full items-center justify-between gap-1 rounded px-0.5 text-left hover:bg-stone-100"
                      >
                        <TableColumnHeader
                          icon={column.icon ?? defaultIconForColumn(key, column.title)}
                          label={column.title}
                        />
                        <span className="text-[9px] leading-none text-stone-400">{sortIndicator(key)}</span>
                      </button>
                    ) : (
                      <TableColumnHeader
                        icon={column.icon ?? defaultIconForColumn(key, column.title)}
                        label={column.title}
                      />
                    )}
                    <button
                      type="button"
                      onMouseDown={(event) => startColumnResize(index, event)}
                      className="absolute right-[-3px] top-0 z-20 h-full w-2.5 cursor-col-resize bg-transparent hover:bg-stone-300/70"
                      style={{ touchAction: "none" }}
                      aria-label={`Ajustar ancho de ${column.title}`}
                      title={`Ajustar ancho de ${column.title}`}
                    />
                  </th>
                );
              })}
            </tr>
            {enableFilters ? (
              <tr className="h-8">
                {columns.map((column) => {
                  const key = String(column.key);
                  const filterable = column.filterable !== false;
                  return (
                    <th
                      key={`filter-${key}`}
                      className={`border-b border-border bg-stone-50 px-2 py-1 ${alignmentClass(column.align)}`}
                    >
                      {filterable ? (
                        <input
                          value={columnFilters[key] ?? ""}
                          onChange={(event) => {
                            const nextFilters = { ...columnFilters, [key]: event.target.value };
                            setColumnFilters(nextFilters);
                            emitTableViewChange({ columnFilters: nextFilters, sortKey, sortDirection });
                          }}
                          className="h-6 w-full rounded border border-stone-200 bg-white px-1 text-[10px] leading-none outline-none focus:border-stone-400"
                          placeholder=""
                        />
                      ) : (
                        <span className="block h-6" />
                      )}
                    </th>
                  );
                })}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {renderedRows.map(({ row }, index) => (
              <tr
                key={row.id}
                className={`h-8 border-t border-border text-[11px] align-middle transition hover:bg-stone-50 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
                onClick={() => onRowClick?.(row)}
                role={onRowClick ? "button" : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={`h-8 px-2 py-1 align-middle ${alignmentClass(column.align)}`}
                  >
                    {column.render
                      ? column.render(row, index)
                      : String(row[column.key as keyof T] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
