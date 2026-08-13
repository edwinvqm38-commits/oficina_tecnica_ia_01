"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Recurso } from "@/lib/sgp/demoData";
import type { ModulePermissions } from "@/lib/sgp/modulePermissionsRepository";
import type {
  RecursosColumnFilters,
  RecursosFilterOptions,
  RecursoSortDirection,
  RecursoSortField,
} from "@/lib/sgp/recursosRepository";
import { Badge, Button } from "@/components/ui";
import { StatusBadge } from "@/components/sgp/StatusBadge";
import { FieldLabelIcon } from "@/components/sgp/ui/FieldLabelIcon";
import { TableColumnHeader } from "@/components/sgp/ui/TableColumnHeader";

type ResourcesTableProps = {
  rows: Recurso[];
  emptyMessage?: string;
  filters: RecursosColumnFilters;
  filterOptions: RecursosFilterOptions;
  onFilterChange: (key: keyof RecursosColumnFilters, value: string) => void;
  onClearFilters: () => void;
  onCreate: () => void;
  onEdit: (resource: Recurso) => void;
  onDeactivate?: (resource: Recurso) => void;
  onReactivate?: (resource: Recurso) => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDeactivate?: boolean;
  modulePermissions?: ModulePermissions | null;
  sortBy: RecursoSortField;
  sortDirection: RecursoSortDirection;
  onSortChange: (sortBy: RecursoSortField, sortDirection: RecursoSortDirection) => void;
};

type ColumnDef = {
  key: string;
  label: string;
  icon: Parameters<typeof TableColumnHeader>[0]["icon"];
  minWidth?: number;
  align?: "left" | "right";
  sortField?: RecursoSortField;
  filterKey?: keyof RecursosColumnFilters;
  filterType?: "text" | "select";
  permissionKeys?: string[];
  operational?: boolean;
};

const COLUMNS: ColumnDef[] = [
  {
    key: "codigo_recurso",
    label: "Código recurso",
    icon: "barcode",
    minWidth: 130,
    sortField: "codigo_recurso",
    filterKey: "codigoRecurso",
    filterType: "text",
    permissionKeys: ["codigo_recurso"],
  },
  {
    key: "codigo_eka",
    label: "Código EKA",
    icon: "barcode",
    minWidth: 120,
    filterKey: "codigoEka",
    filterType: "text",
    permissionKeys: ["codigo_eka"],
  },
  {
    key: "codigo_fabricante",
    label: "Código fabricante",
    icon: "barcode",
    minWidth: 150,
    filterKey: "codigoFabricante",
    filterType: "text",
    permissionKeys: ["codigo_fabricante"],
  },
  {
    key: "tipo_recurso",
    label: "Tipo recurso",
    icon: "tags",
    minWidth: 150,
    sortField: "tipo_recurso_nombre",
    filterKey: "tipoRecurso",
    filterType: "select",
    permissionKeys: ["tipo_recurso", "tipo_recurso_nombre"],
  },
  {
    key: "descripcion",
    label: "Descripción",
    icon: "align-left",
    minWidth: 260,
    sortField: "descripcion",
    filterKey: "descripcion",
    filterType: "text",
    permissionKeys: ["descripcion"],
  },
  { key: "unidad", label: "Unidad", icon: "ruler", minWidth: 90, permissionKeys: ["unidad", "unidad_codigo"] },
  {
    key: "precio_unitario_ref",
    label: "P.U. ref.",
    icon: "calculator",
    minWidth: 110,
    align: "right",
    sortField: "precio_unitario_ref",
    permissionKeys: ["precio_unitario_ref"],
  },
  {
    key: "moneda",
    label: "Moneda",
    icon: "coins",
    minWidth: 90,
    filterKey: "moneda",
    filterType: "select",
    permissionKeys: ["moneda", "moneda_codigo"],
  },
  {
    key: "proveedor",
    label: "Proveedor",
    icon: "store",
    minWidth: 150,
    sortField: "proveedor_nombre",
    filterKey: "proveedor",
    filterType: "text",
    permissionKeys: ["proveedor", "proveedor_nombre"],
  },
  {
    key: "marca",
    label: "Marca",
    icon: "tags",
    minWidth: 120,
    sortField: "marca_nombre",
    filterKey: "marca",
    filterType: "text",
    permissionKeys: ["marca", "marca_nombre"],
  },
  {
    key: "modelo",
    label: "Modelo",
    icon: "tags",
    minWidth: 130,
    filterKey: "modelo",
    filterType: "text",
    permissionKeys: ["modelo"],
  },
  {
    key: "tiempo_entrega_ref",
    label: "Tiempo entrega ref.",
    icon: "clock",
    minWidth: 150,
    permissionKeys: ["tiempo_entrega_ref"],
  },
  {
    key: "fecha_actualizacion",
    label: "F. actualización",
    icon: "clock",
    minWidth: 130,
    sortField: "fecha_actualizacion",
    permissionKeys: ["fecha_actualizacion"],
  },
  {
    key: "estado",
    label: "Estado",
    icon: "circle-dot",
    minWidth: 120,
    sortField: "estado",
    filterKey: "estado",
    filterType: "select",
    permissionKeys: ["estado"],
  },
  { key: "docs", label: "Archivos", icon: "files", minWidth: 120, operational: true },
  { key: "acciones", label: "Acciones", icon: "settings2", minWidth: 240, operational: true },
];

const resourcesTableWidthMemory = new Map<string, Record<string, number>>();
const RESOURCES_TABLE_WIDTH_SIGNATURE = COLUMNS.map((column) => `${column.key}:${column.minWidth ?? 120}`).join("|");

function readResourceViewGroups(modulePermissions: ModulePermissions | null): Record<string, boolean> {
  const root = modulePermissions?.metadata?.module_view_groups;
  if (!root || typeof root !== "object" || Array.isArray(root)) return {};
  const groups = (root as Record<string, unknown>).recursos;
  if (!groups || typeof groups !== "object" || Array.isArray(groups)) return {};
  return groups as Record<string, boolean>;
}

function buildResourcesWidthStorageKey(routePath: string): string {
  return `sgp-lite:resources-widths:${routePath}:${RESOURCES_TABLE_WIDTH_SIGNATURE}`;
}

function buildResourcesDefaultWidths(): Record<string, number> {
  return COLUMNS.reduce(
    (acc, column) => {
      acc[column.key] = column.minWidth ?? 120;
      return acc;
    },
    {} as Record<string, number>,
  );
}

function readResourcesWidths(storageKey: string, fallbacks: Record<string, number>): Record<string, number> {
  const defaults = buildResourcesDefaultWidths();
  const normalize = (candidate: Partial<Record<string, unknown>>): Record<string, number> =>
    COLUMNS.reduce(
      (acc, column) => {
        const minimum = column.minWidth ?? 120;
        const raw = Number(candidate[column.key]);
        acc[column.key] = Number.isFinite(raw)
          ? Math.max(minimum, Math.round(raw))
          : Number(fallbacks[column.key] ?? defaults[column.key]);
        return acc;
      },
      {} as Record<string, number>,
    );

  const memory = resourcesTableWidthMemory.get(storageKey);
  if (memory) return normalize(memory);

  if (typeof window === "undefined") return normalize(fallbacks);

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return normalize(fallbacks);
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    const restored = normalize(parsed);
    resourcesTableWidthMemory.set(storageKey, restored);
    return restored;
  } catch {
    return normalize(fallbacks);
  }
}

function estimateTextWidth(value: string): number {
  return Math.round(value.length * 7 + 32);
}

function getColumnValue(row: Recurso, key: string): string | number {
  if (key === "docs") return "FT IMG ARCH";
  if (key === "acciones") return "Solo lectura / Ver / Editar";
  return (row as unknown as Record<string, string | number | undefined>)[key] ?? "";
}

function buildAutoResourceWidths(rows: Recurso[]): Record<string, number> {
  const defaults = buildResourcesDefaultWidths();
  const sampleRows = rows.slice(0, 150);
  return COLUMNS.reduce(
    (acc, column) => {
      const minimum = column.minWidth ?? 120;
      const headerWidth = estimateTextWidth(column.label);
      const contentWidth = sampleRows.reduce(
        (max, row) => Math.max(max, estimateTextWidth(String(getColumnValue(row, column.key) ?? ""))),
        minimum,
      );
      acc[column.key] = Math.max(minimum, Math.min(520, Math.max(headerWidth, contentWidth, defaults[column.key])));
      return acc;
    },
    {} as Record<string, number>,
  );
}

function getSelectOptions(column: ColumnDef, filterOptions: RecursosFilterOptions): string[] {
  if (column.filterKey === "tipoRecurso") return filterOptions.tipos;
  if (column.filterKey === "estado") return filterOptions.estados;
  if (column.filterKey === "moneda") return filterOptions.monedas;
  return [];
}

function isInactiveResource(row: Recurso): boolean {
  return row.estado === "Inactivo";
}

function alignmentClass(align: ColumnDef["align"]): string {
  return align === "right" ? "text-right" : "text-left";
}

export function ResourcesTable({
  rows,
  emptyMessage = "No se encontraron recursos con los filtros aplicados.",
  filters,
  filterOptions,
  onFilterChange,
  onClearFilters,
  onCreate,
  onEdit,
  onDeactivate,
  onReactivate,
  canCreate = false,
  canEdit = false,
  canDeactivate = false,
  modulePermissions = null,
  sortBy,
  sortDirection,
  onSortChange,
}: ResourcesTableProps) {
  const pathname = usePathname() || "/";
  const [isWidthsReady, setIsWidthsReady] = useState(false);
  const widthStorageKey = useMemo(() => buildResourcesWidthStorageKey(pathname), [pathname]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    readResourcesWidths(buildResourcesWidthStorageKey(pathname), buildAutoResourceWidths(rows)),
  );
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const viewGroups = useMemo(() => readResourceViewGroups(modulePermissions), [modulePermissions]);
  const canViewActions = viewGroups.resources_actions !== false;
  const visibleColumns = useMemo(() => {
    const allowedColumns = new Set(modulePermissions?.visible_columns ?? []);
    const shouldUseVisibleColumns = allowedColumns.size > 0;
    const canViewEconomicData = modulePermissions?.can_view_prices !== false && viewGroups.resources_economic_data !== false;
    const canViewSupplierData = modulePermissions?.can_view_supplier !== false && viewGroups.resources_supplier_data !== false;
    const canViewDocuments = viewGroups.resources_documents !== false;

    return COLUMNS.filter((column) => {
      if ((column.key === "precio_unitario_ref" || column.key === "moneda") && !canViewEconomicData) {
        return false;
      }

      if ((column.key === "proveedor" || column.key === "marca") && !canViewSupplierData) {
        return false;
      }

      if (column.key === "docs" && !canViewDocuments) {
        return false;
      }

      if (column.key === "acciones" && !canViewActions) {
        return false;
      }

      if (column.operational || !shouldUseVisibleColumns) {
        return true;
      }

      return (column.permissionKeys ?? [column.key]).some((key) => allowedColumns.has(key));
    });
  }, [canViewActions, modulePermissions, viewGroups.resources_documents, viewGroups.resources_economic_data, viewGroups.resources_supplier_data]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.log(
      "[recursos] columnas visibles finales:",
      visibleColumns.map((column) => column.key),
    );
  }, [visibleColumns]);

  useEffect(() => {
    setColumnWidths(readResourcesWidths(widthStorageKey, buildResourcesDefaultWidths()));
    setIsWidthsReady(true);
  }, [widthStorageKey]);

  useEffect(() => {
    resourcesTableWidthMemory.set(widthStorageKey, { ...columnWidths });
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(widthStorageKey, JSON.stringify(columnWidths));
    } catch {
      // Ignore storage errors.
    }
  }, [columnWidths, widthStorageKey]);

  function toggleSort(column: ColumnDef) {
    if (!column.sortField) return;
    const nextDirection = sortBy === column.sortField && sortDirection === "asc" ? "desc" : "asc";
    onSortChange(column.sortField, nextDirection);
  }

  function sortIndicator(column: ColumnDef): string {
    if (!column.sortField) return "";
    if (sortBy !== column.sortField) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function renderCell(row: Recurso, column: ColumnDef): ReactNode {
    if (column.key === "codigo_recurso") return row.codigo_recurso;
    if (column.key === "codigo_eka") return row.codigo_eka || "-";
    if (column.key === "codigo_fabricante") return row.codigo_fabricante || "-";
    if (column.key === "tipo_recurso") return <StatusBadge status={row.tipo_recurso} />;
    if (column.key === "descripcion") return row.descripcion;
    if (column.key === "unidad") return row.unidad;
    if (column.key === "precio_unitario_ref") return row.precio_unitario_ref.toFixed(2);
    if (column.key === "moneda") return row.moneda;
    if (column.key === "proveedor") return row.proveedor;
    if (column.key === "marca") return row.marca;
    if (column.key === "modelo") return row.modelo || "-";
    if (column.key === "tiempo_entrega_ref") return row.tiempo_entrega_ref || "-";
    if (column.key === "fecha_actualizacion") return row.fecha_actualizacion || "-";
    if (column.key === "estado") {
      if (isInactiveResource(row)) {
        return <Badge tone="neutral">Inactivo</Badge>;
      }
      return <StatusBadge status={row.estado} />;
    }
    if (column.key === "docs") {
      return (
        <div className="flex gap-1">
          {row.resourceFiles.fichaTecnica ? <Badge tone="neutral">FT</Badge> : null}
          {row.resourceFiles.imagen ? <Badge tone="neutral">IMG</Badge> : null}
          {row.resourceFiles.cotizacion ? <Badge tone="neutral">COT</Badge> : null}
          {row.resourceFiles.archivos.length > 0 ? (
            <Badge tone="neutral">ARCH</Badge>
          ) : null}
        </div>
      );
    }
    if (column.key === "acciones") {
      const isInactive = isInactiveResource(row);
      return canEdit || canDeactivate ? (
        <div className="flex flex-wrap gap-1">
          {canEdit ? (
            <Button type="button" onClick={() => onEdit(row)} size="sm" variant="ghost" className="ops-table-row-action">
              Ver / Editar
            </Button>
          ) : null}
          {canDeactivate ? (
            <Button
              type="button"
              onClick={() => onDeactivate?.(row)}
              disabled={isInactive}
              size="sm"
              variant="ghost"
              className="ops-table-row-action ops-table-row-action--warning"
              title={isInactive ? "El recurso ya está inactivo" : "Desactivar recurso sin borrarlo"}
            >
              Desactivar
            </Button>
          ) : null}
          {canDeactivate && isInactive ? (
            <Button
              type="button"
              onClick={() => onReactivate?.(row)}
              size="sm"
              variant="ghost"
              className="ops-table-row-action ops-table-row-action--success"
              title="Reactivar recurso y volver a mostrarlo como activo"
            >
              Reactivar
            </Button>
          ) : null}
        </div>
      ) : (
        <Badge tone="neutral">Solo lectura</Badge>
      );
    }
    return null;
  }

  function startColumnResize(event: ReactMouseEvent<HTMLButtonElement>, key: string) {
    event.preventDefault();
    event.stopPropagation();
    const minimum = COLUMNS.find((column) => column.key === key)?.minWidth ?? 120;
    resizingRef.current = {
      key,
      startX: event.clientX,
      startWidth: columnWidths[key] ?? minimum,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const state = resizingRef.current;
      if (!state) return;
      const next = Math.max(minimum, Math.round(state.startWidth + (moveEvent.clientX - state.startX)));
      setColumnWidths((prev) => ({ ...prev, [state.key]: next }));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      resizingRef.current = null;
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
      className={`app-table-card ops-table-card min-h-0 ${
        isWidthsReady ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="ops-list-toolbar">
        <div className="ops-list-title-group">
          <FieldLabelIcon icon="tags" label="Log de recursos" className="ops-list-title" />
          <Badge tone="neutral">{rows.length} visibles</Badge>
        </div>
        <div className="ops-list-actions">
          {canViewActions ? (
            <Button
              type="button"
              onClick={onClearFilters}
              size="sm"
              variant="ghost"
              className="ops-list-action"
              title="Limpiar filtros y orden"
            >
              <FieldLabelIcon icon="sliders-horizontal" label="Limpiar filtros" className="ops-list-action-label" />
            </Button>
          ) : null}
          {canViewActions && !canCreate ? (
            <Button
              type="button"
              disabled
              size="sm"
              variant="ghost"
              className="ops-list-action"
              title="Crear recursos requiere Supabase y permiso can_create"
            >
              <span className="text-sm leading-none">+</span>
              <span>Nuevo recurso</span>
            </Button>
          ) : canViewActions ? (
            <Button
              type="button"
              onClick={onCreate}
              size="sm"
              variant="secondary"
              className="ops-list-action"
              title="Nuevo recurso"
            >
              <span className="text-sm leading-none">+</span>
              <span>Nuevo recurso</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="app-table-scroll min-h-0 w-full min-w-0">
        <table className="ops-table">
          <colgroup>
            {visibleColumns.map((column) => (
              <col key={`col-${column.key}`} style={{ width: `${columnWidths[column.key] ?? column.minWidth ?? 120}px` }} />
            ))}
          </colgroup>
          <thead className="ops-table-head">
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  className={`ops-table-th ${alignmentClass(column.align)}`}
                >
                  {!column.sortField ? (
                    <TableColumnHeader icon={column.icon} label={column.label} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className="ops-table-sort-button"
                      title="Ordenar"
                    >
                      <TableColumnHeader icon={column.icon} label={column.label} />
                      <span className="ops-table-sort-indicator">{sortIndicator(column)}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onMouseDown={(event) => startColumnResize(event, column.key)}
                    className="ops-table-resizer"
                    style={{ touchAction: "none" }}
                    aria-label={`Ajustar ancho de ${column.label}`}
                    title={`Ajustar ancho de ${column.label}`}
                  />
                </th>
              ))}
            </tr>
            <tr className="ops-table-filter-row">
              {visibleColumns.map((column) => (
                <th
                  key={`filter-${column.key}`}
                  className={`ops-table-filter-cell ${alignmentClass(column.align)}`}
                >
                  {!column.filterKey ? (
                    <span className="ops-table-filter-placeholder" />
                  ) : column.filterType === "select" ? (
                    <select
                      value={filters[column.filterKey]}
                      onChange={(event) => onFilterChange(column.filterKey!, event.target.value)}
                      className="ops-table-filter-input"
                    >
                      <option value="">Todos</option>
                      {getSelectOptions(column, filterOptions).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={filters[column.filterKey]}
                      onChange={(event) => onFilterChange(column.filterKey!, event.target.value)}
                      className="ops-table-filter-input"
                      placeholder=""
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="ops-table-empty-row">
                <td colSpan={visibleColumns.length} className="ops-table-empty-cell">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const isInactive = isInactiveResource(row);
              return (
                <tr
                  key={row.id}
                  className={`ops-table-row ${isInactive ? "ops-table-row--inactive" : ""}`}
                >
                  {visibleColumns.map((column) => (
                    <td
                      key={`${row.id}-${column.key}`}
                      className={`ops-table-td ${alignmentClass(column.align)}`}
                    >
                      {renderCell(row, column)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
