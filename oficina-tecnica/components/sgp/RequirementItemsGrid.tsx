"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Recurso, ResourceFileMeta } from "@/lib/sgp/demoData";
import { formatCurrencyNumber, formatDate } from "@/lib/sgp/utils";
import { FieldLabelIcon, type IconName } from "@/components/sgp/ui/FieldLabelIcon";
import { TableColumnHeader } from "@/components/sgp/ui/TableColumnHeader";
import { FieldLockButton } from "@/components/sgp/ui/FieldLockButton";
import { FilePreviewModal } from "@/components/sgp/ui/FilePreviewModal";
import { DateTextInput } from "@/components/sgp/ui/DateTextInput";

export type EditableRequirementItem = {
  id: string;
  recurso_id: string;
  codigo_recurso: string;
  codigo_fabricante: string;
  tipo_recurso: string;
  descripcion: string;
  informacion_adicional: string;
  observaciones_item: string;
  recurso_ficha_tecnica: ResourceFileMeta | null;
  recurso_ficha_tecnica_files: ResourceFileMeta[];
  recurso_imagen: ResourceFileMeta | null;
  recurso_imagen_files: ResourceFileMeta[];
  recurso_archivos: ResourceFileMeta[];
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  moneda: string;
  subtotal: number;
  proveedor: string;
  marca: string;
  ajuste: number;
  atencion_real: number;
  cant_stock: number;
  compra: number;
  costo_unitario: number;
  tc: number;
  factor_eq_herr: number;
  costo_total_presupuestado: number;
  fecha_coti: string;
  estado: string;
  recurso_a_suministrar: string;
  ficha_tecnica_a_suministrar: ResourceFileMeta | null;
  ficha_tecnica_a_suministrar_files: ResourceFileMeta[];
  condicion_pago: string;
  tiempo_entrega: string;
  eq: string;
  eq_fecha_aprob: string;
  ll: string;
  ll_fecha_aprob: string;
  hb: string;
  hb_fecha_aprob: string;
  logistica_compra: string;
  fecha_compra: string;
  oc_os_recurso: string;
  fecha_entrega: string;
  guia_remision: string;
  archivo_guia: ResourceFileMeta | null;
  archivo_guia_files: ResourceFileMeta[];
};

type RequirementItemsGridProps = {
  items: EditableRequirementItem[];
  recursos: Recurso[];
  cotizacionMoneda: "PEN" | "USD";
  resourceTypeOptions: string[];
  currencyOptions: string[];
  statusOptions: string[];
  providerOptions: string[];
  eqOptions: string[];
  llOptions: string[];
  hbOptions: string[];
  logisticaCompraOptions: string[];
  onAddRow: () => string | void;
  onOpenResourceCatalog?: () => void;
  onRemoveRow: (id: string) => void;
  onSelectRecurso: (rowId: string, recursoId: string) => void;
  onCreateRecurso?: (rowId: string | null) => void;
  onActiveRowChange?: (rowId: string | null) => void;
  onEditingModeChange?: (editing: boolean) => void;
  onPatchRow: (rowId: string, patch: Partial<EditableRequirementItem>) => void;
  onSaveTable?: (itemsOverride?: EditableRequirementItem[]) => void | boolean | Promise<void | boolean>;
  isSavingTable?: boolean;
  canCreateRecurso?: boolean;
  canEditItems?: boolean;
  canSaveItems?: boolean;
  canUseResourceCatalog?: boolean;
  isCreatingRecurso?: boolean;
  titleLabel?: string;
  showAddRowButton?: boolean;
  hideIndexColumn?: boolean;
  maxHeightClassName?: string;
  bodyOverflowYClassName?: "overflow-y-auto" | "overflow-y-hidden";
  fullHeight?: boolean;
  requirementContextByItemId?: Record<string, RequirementItemContext>;
  onOpenRequirementFromContext?: (requirementId: string) => void;
  onRowClick?: (item: EditableRequirementItem) => void;
  hiddenColumnKeys?: string[];
};

type RequirementItemContext = {
  requirementId: string;
  proyecto: string;
  codigoRq: string;
  cotizacionCodigo: string;
  oc: string;
  cliente: string;
  unidadTrabajo: string;
  solicitanteRq: string;
  estadoRq: string;
  fechaSolicitud: string;
  fechaEntrega: string;
  tipoServicio: string;
  area: string;
  itemsTotales: number;
  pendientes: number;
  enProceso: number;
  atendidos: number;
  vbCompletos: number;
  conRecurso: number;
  sinRecurso: number;
  conFichaSuministrar: number;
  conOcOs: number;
  conGuia: number;
  avance: number;
  clienteProyecto: string;
};

type AutoField = "fabricante" | "descripcion" | "recurso_a_suministrar";

type SearchableResource = {
  resource: Recurso;
  codigoFabricante: string;
  codigoEka: string;
  codigoRecurso: string;
  descripcion: string;
};

type PreviewState = {
  title: string;
  files: ResourceFileMeta[];
} | null;

type ColumnKey =
  | "idx"
  | "proyecto"
  | "requerimiento"
  | "codigo_rq"
  | "cotizacion_codigo"
  | "oc"
  | "cliente"
  | "unidad_trabajo"
  | "solicitante_rq"
  | "estado_rq"
  | "fecha_solicitud"
  | "fecha_entrega_rq"
  | "tipo_servicio_rq"
  | "area_rq"
  | "items_totales"
  | "pendientes_rq"
  | "en_proceso_rq"
  | "atendidos_rq"
  | "vb_completos_rq"
  | "con_recurso_rq"
  | "sin_recurso_rq"
  | "con_ficha_suministrar_rq"
  | "con_oc_os_rq"
  | "con_guia_rq"
  | "avance_rq"
  | "cliente_proyecto"
  | "codigo_fabricante"
  | "tipo_recurso"
  | "descripcion"
  | "informacion_adicional"
  | "observaciones_item"
  | "ficha"
  | "imagen"
  | "archivos"
  | "recurso_a_suministrar"
  | "ficha_tecnica_a_suministrar"
  | "unidad"
  | "cantidad"
  | "ajuste"
  | "atencion_real"
  | "cant_stock"
  | "compra"
  | "precio_unitario"
  | "moneda"
  | "tc"
  | "factor_eq_herr"
  | "costo_total_presupuestado"
  | "fecha_coti"
  | "estado"
  | "proveedor"
  | "condicion_pago"
  | "tiempo_entrega"
  | "eq"
  | "eq_fecha_aprob"
  | "ll"
  | "ll_fecha_aprob"
  | "hb"
  | "hb_fecha_aprob"
  | "logistica_compra"
  | "fecha_compra"
  | "oc_os_recurso"
  | "fecha_entrega"
  | "guia_remision"
  | "archivo_guia"
  | "acciones";

type ColumnDef = {
  key: ColumnKey;
  width: number;
  minWidth: number;
  sticky?: boolean;
};

type SortDirection = "asc" | "desc" | null;
type SortConfig = {
  key: ColumnKey | null;
  direction: SortDirection;
};

type NumericField =
  | "cantidad"
  | "ajuste"
  | "atencion_real"
  | "cant_stock"
  | "compra"
  | "precio_unitario"
  | "tc"
  | "factor_eq_herr";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "idx", width: 44, minWidth: 40, sticky: true },
  { key: "proyecto", width: 180, minWidth: 150 },
  { key: "requerimiento", width: 130, minWidth: 120 },
  { key: "codigo_rq", width: 130, minWidth: 120 },
  { key: "cotizacion_codigo", width: 140, minWidth: 120 },
  { key: "oc", width: 130, minWidth: 120 },
  { key: "cliente", width: 170, minWidth: 140 },
  { key: "unidad_trabajo", width: 160, minWidth: 130 },
  { key: "solicitante_rq", width: 140, minWidth: 120 },
  { key: "estado_rq", width: 110, minWidth: 90 },
  { key: "fecha_solicitud", width: 120, minWidth: 100 },
  { key: "fecha_entrega_rq", width: 120, minWidth: 100 },
  { key: "tipo_servicio_rq", width: 160, minWidth: 130 },
  { key: "area_rq", width: 130, minWidth: 100 },
  { key: "items_totales", width: 110, minWidth: 90 },
  { key: "pendientes_rq", width: 100, minWidth: 90 },
  { key: "en_proceso_rq", width: 100, minWidth: 90 },
  { key: "atendidos_rq", width: 90, minWidth: 80 },
  { key: "vb_completos_rq", width: 110, minWidth: 90 },
  { key: "con_recurso_rq", width: 100, minWidth: 90 },
  { key: "sin_recurso_rq", width: 100, minWidth: 90 },
  { key: "con_ficha_suministrar_rq", width: 140, minWidth: 120 },
  { key: "con_oc_os_rq", width: 100, minWidth: 90 },
  { key: "con_guia_rq", width: 90, minWidth: 80 },
  { key: "avance_rq", width: 90, minWidth: 80 },
  { key: "cliente_proyecto", width: 190, minWidth: 150 },
  { key: "codigo_fabricante", width: 140, minWidth: 120, sticky: true },
  { key: "tipo_recurso", width: 150, minWidth: 120 },
  { key: "descripcion", width: 220, minWidth: 180 },
  { key: "informacion_adicional", width: 220, minWidth: 170 },
  { key: "observaciones_item", width: 220, minWidth: 170 },
  { key: "ficha", width: 150, minWidth: 130 },
  { key: "imagen", width: 150, minWidth: 130 },
  { key: "archivos", width: 150, minWidth: 130 },
  { key: "unidad", width: 80, minWidth: 70 },
  { key: "cantidad", width: 90, minWidth: 80 },
  { key: "ajuste", width: 90, minWidth: 80 },
  { key: "atencion_real", width: 110, minWidth: 90 },
  { key: "cant_stock", width: 100, minWidth: 80 },
  { key: "compra", width: 90, minWidth: 80 },
  { key: "precio_unitario", width: 120, minWidth: 100 },
  { key: "moneda", width: 90, minWidth: 80 },
  { key: "tc", width: 80, minWidth: 70 },
  { key: "factor_eq_herr", width: 140, minWidth: 110 },
  { key: "costo_total_presupuestado", width: 130, minWidth: 120 },
  { key: "fecha_coti", width: 120, minWidth: 100 },
  { key: "estado", width: 130, minWidth: 110 },
  { key: "recurso_a_suministrar", width: 220, minWidth: 170 },
  { key: "ficha_tecnica_a_suministrar", width: 190, minWidth: 140 },
  { key: "proveedor", width: 160, minWidth: 130 },
  { key: "condicion_pago", width: 120, minWidth: 100 },
  { key: "tiempo_entrega", width: 140, minWidth: 100 },
  { key: "eq", width: 90, minWidth: 80 },
  { key: "eq_fecha_aprob", width: 130, minWidth: 100 },
  { key: "ll", width: 90, minWidth: 80 },
  { key: "ll_fecha_aprob", width: 130, minWidth: 100 },
  { key: "hb", width: 90, minWidth: 80 },
  { key: "hb_fecha_aprob", width: 130, minWidth: 100 },
  { key: "logistica_compra", width: 150, minWidth: 120 },
  { key: "fecha_compra", width: 120, minWidth: 100 },
  { key: "oc_os_recurso", width: 150, minWidth: 110 },
  { key: "fecha_entrega", width: 120, minWidth: 100 },
  { key: "guia_remision", width: 150, minWidth: 110 },
  { key: "archivo_guia", width: 150, minWidth: 130 },
  { key: "acciones", width: 100, minWidth: 80 },
];
const REQUIREMENT_GRID_WIDTH_SIGNATURE = COLUMN_DEFS.map((col) => `${col.key}:${col.minWidth}`).join("|");
const requirementGridWidthMemory = new Map<string, Record<ColumnKey, number>>();

const NON_SORTABLE_COLUMNS = new Set<ColumnKey>(["idx", "acciones"]);
const NON_FILTERABLE_COLUMNS = new Set<ColumnKey>(["idx", "acciones"]);

const NUMERIC_SORT_COLUMNS = new Set<ColumnKey>([
  "cantidad",
  "ajuste",
  "atencion_real",
  "cant_stock",
  "compra",
  "precio_unitario",
  "tc",
  "factor_eq_herr",
  "costo_total_presupuestado",
]);

const DATE_SORT_COLUMNS = new Set<ColumnKey>([
  "fecha_coti",
  "eq_fecha_aprob",
  "ll_fecha_aprob",
  "hb_fecha_aprob",
  "fecha_compra",
  "fecha_entrega",
]);

function buildInitialWidths(): Record<ColumnKey, number> {
  return COLUMN_DEFS.reduce(
    (acc, col) => {
      acc[col.key] = col.width;
      return acc;
    },
    {} as Record<ColumnKey, number>,
  );
}

function buildRequirementGridWidthStorageKey(routePath: string, contextKey: string): string {
  return `sgp-lite:rq-grid-widths:${routePath}:${contextKey}:${REQUIREMENT_GRID_WIDTH_SIGNATURE}`;
}

function readRequirementGridWidths(
  storageKey: string,
  fallbackWidths: Record<ColumnKey, number>,
): Record<ColumnKey, number> {
  const defaults = buildInitialWidths();
  const normalize = (candidate: Partial<Record<ColumnKey, unknown>>): Record<ColumnKey, number> =>
    COLUMN_DEFS.reduce(
      (acc, col) => {
        const raw = Number(candidate[col.key]);
        acc[col.key] = Number.isFinite(raw)
          ? Math.max(col.minWidth, Math.round(raw))
          : Number(fallbackWidths[col.key] ?? defaults[col.key]);
        return acc;
      },
      {} as Record<ColumnKey, number>,
    );

  const memory = requirementGridWidthMemory.get(storageKey);
  if (memory) return normalize(memory);

  if (typeof window === "undefined") return normalize(fallbackWidths);
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return normalize(fallbackWidths);
    const parsed = JSON.parse(raw) as Partial<Record<ColumnKey, unknown>>;
    const restored = normalize(parsed);
    requirementGridWidthMemory.set(storageKey, restored);
    return restored;
  } catch {
    return normalize(fallbackWidths);
  }
}

function estimateTextWidth(value: string): number {
  return Math.round(value.length * 7 + 32);
}

function autoColumnLabel(key: ColumnKey): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function autoValueForColumn(
  key: ColumnKey,
  item: EditableRequirementItem,
  context?: RequirementItemContext,
): string {
  const direct = (item as Record<string, unknown>)[key];
  if (direct !== undefined && direct !== null) return String(direct);

  if (!context) return "";
  const map: Partial<Record<ColumnKey, string | number>> = {
    proyecto: context.proyecto,
    requerimiento: context.requirementId,
    codigo_rq: context.codigoRq,
    cotizacion_codigo: context.cotizacionCodigo,
    oc: context.oc,
    cliente: context.cliente,
    unidad_trabajo: context.unidadTrabajo,
    solicitante_rq: context.solicitanteRq,
    estado_rq: context.estadoRq,
    fecha_solicitud: context.fechaSolicitud,
    fecha_entrega_rq: context.fechaEntrega,
    tipo_servicio_rq: context.tipoServicio,
    area_rq: context.area,
    items_totales: context.itemsTotales,
    pendientes_rq: context.pendientes,
    en_proceso_rq: context.enProceso,
    atendidos_rq: context.atendidos,
    vb_completos_rq: context.vbCompletos,
    con_recurso_rq: context.conRecurso,
    sin_recurso_rq: context.sinRecurso,
    con_ficha_suministrar_rq: context.conFichaSuministrar,
    con_oc_os_rq: context.conOcOs,
    con_guia_rq: context.conGuia,
    avance_rq: context.avance,
    cliente_proyecto: context.clienteProyecto,
  };
  return String(map[key] ?? "");
}

function buildAutoRequirementGridWidths(
  items: EditableRequirementItem[],
  contextByItemId?: Record<string, RequirementItemContext>,
): Record<ColumnKey, number> {
  const defaults = buildInitialWidths();
  const sampleRows = items.slice(0, 150);

  return COLUMN_DEFS.reduce(
    (acc, col) => {
      const minimum = col.minWidth;
      const headerWidth = estimateTextWidth(autoColumnLabel(col.key));
      const contentWidth = sampleRows.reduce((max, item) => {
        const text = autoValueForColumn(col.key, item, contextByItemId?.[item.id]);
        return Math.max(max, estimateTextWidth(text));
      }, minimum);
      acc[col.key] = Math.max(minimum, Math.min(560, Math.max(defaults[col.key], headerWidth, contentWidth)));
      return acc;
    },
    {} as Record<ColumnKey, number>,
  );
}

function serializeRows(rows: EditableRequirementItem[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      ...row,
      recurso_archivos: row.recurso_archivos.map((f) => `${f.name}-${f.size}-${f.type}`),
      recurso_ficha_tecnica_files: row.recurso_ficha_tecnica_files.map((f) => `${f.name}-${f.size}-${f.type}`),
      recurso_imagen_files: row.recurso_imagen_files.map((f) => `${f.name}-${f.size}-${f.type}`),
      recurso_ficha_tecnica: row.recurso_ficha_tecnica
        ? `${row.recurso_ficha_tecnica.name}-${row.recurso_ficha_tecnica.size}-${row.recurso_ficha_tecnica.type}`
        : "",
      recurso_imagen: row.recurso_imagen
        ? `${row.recurso_imagen.name}-${row.recurso_imagen.size}-${row.recurso_imagen.type}`
        : "",
      ficha_tecnica_a_suministrar: row.ficha_tecnica_a_suministrar
        ? `${row.ficha_tecnica_a_suministrar.name}-${row.ficha_tecnica_a_suministrar.size}-${row.ficha_tecnica_a_suministrar.type}`
        : "",
      ficha_tecnica_a_suministrar_files: row.ficha_tecnica_a_suministrar_files.map((f) => `${f.name}-${f.size}-${f.type}`),
      archivo_guia: row.archivo_guia
        ? `${row.archivo_guia.name}-${row.archivo_guia.size}-${row.archivo_guia.type}`
        : "",
      archivo_guia_files: row.archivo_guia_files.map((f) => `${f.name}-${f.size}-${f.type}`),
    })),
  );
}

function cellClassName(): string {
  return "rq-cell-control h-[var(--rq-grid-control-height)] min-h-[var(--rq-grid-control-height)] max-h-[var(--rq-grid-control-height)] w-full rounded border border-stone-300 bg-white px-1.5 py-0 text-[11px] font-normal leading-[var(--rq-grid-control-height)] box-border align-middle outline-none focus:border-stone-500";
}

function numericCellClassName(): string {
  return `${cellClassName()} text-right`;
}

function selectCellClassName(): string {
  return `${cellClassName()} pr-6`;
}

function dateCellClassName(): string {
  return `${cellClassName()} rq-date-cell pr-6 tabular-nums [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:mr-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:p-0`;
}

function readSelectCellClassName(): string {
  return `${readCellClassName()} pr-6`;
}

function readDateCellClassName(): string {
  return `${readCellClassName()} pr-6 tabular-nums`;
}

function readCellClassName(alignRight?: boolean, clickable?: boolean): string {
  return `rq-cell-read inline-flex h-[var(--rq-grid-control-height)] min-h-[var(--rq-grid-control-height)] max-h-[var(--rq-grid-control-height)] w-full items-center rounded border-0 bg-transparent px-1.5 text-[11px] font-normal leading-[var(--rq-grid-control-height)] ${
    alignRight ? "justify-end" : ""
  } ${clickable ? "cursor-pointer hover:bg-stone-100" : ""}`;
}

function readWrapCellClassName(): string {
  return "rq-cell-read inline-flex h-[var(--rq-grid-control-height)] min-h-[var(--rq-grid-control-height)] max-h-[var(--rq-grid-control-height)] w-full items-center overflow-hidden rounded border-0 bg-transparent px-1.5 text-[11px] font-normal leading-[var(--rq-grid-control-height)] text-ellipsis whitespace-nowrap";
}

function multilineRows(value: string, max = 4): number {
  const count = value.split(/\r?\n/).length;
  return Math.max(1, Math.min(max, count));
}

function rowHeightPx(item: EditableRequirementItem): number {
  const infoLines = multilineRows(item.informacion_adicional);
  const obsLines = multilineRows(item.observaciones_item);
  const fileLines = Math.max(
    item.recurso_ficha_tecnica_files.length,
    item.recurso_imagen_files.length,
    item.recurso_archivos.length,
    item.ficha_tecnica_a_suministrar_files.length,
    item.archivo_guia_files.length,
  );
  const lines = Math.max(infoLines, obsLines, fileLines);
  const compactHeight = 32;
  const multilineHeight = lines * 18 + 8;
  return Math.max(compactHeight, multilineHeight);
}

function buildLocalFileMeta(file: File): ResourceFileMeta {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    localPreviewUrl: URL.createObjectURL(file),
    futureDriveFileId: "",
    futureDriveUrl: "",
  };
}

function sanitizeNumber(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEditableNumber(value: number): string {
  return formatCurrencyNumber(Number.isFinite(value) ? value : 0);
}

function fileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext;
}

function fileIconByExtension(extension: string, multiple = false): IconName {
  if (multiple) return "files";
  if (["jpg", "jpeg", "png", "webp"].includes(extension)) return "image";
  if (extension === "pdf") return "file-text";
  if (["doc", "docx"].includes(extension)) return "file-type";
  if (["xls", "xlsx"].includes(extension)) return "table";
  if (["zip", "rar"].includes(extension)) return "archive";
  if (["dwg", "dxf", "cad"].includes(extension)) return "file-cog";
  return "paperclip";
}

function MiniPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden>
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MiniCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden>
      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function getStickyLeft(widths: Record<ColumnKey, number>, key: ColumnKey, showIndexColumn: boolean): number {
  if (key === "idx") return 0;
  if (key === "codigo_fabricante") return showIndexColumn ? widths.idx : 0;
  return 0;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type DraftTextCellProps = {
  value: string;
  className: string;
  onCommit: (value: string) => void;
};

const DraftTextCell = memo(function DraftTextCell({ value, className, onCommit }: DraftTextCellProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit(nextValue = draft) {
    if (nextValue !== value) onCommit(nextValue);
  }

  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit(event.currentTarget.value);
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
});

type DraftTextareaCellProps = {
  value: string;
  className: string;
  maxLength?: number;
  onCommit: (value: string) => void;
};

const DraftTextareaCell = memo(function DraftTextareaCell({ value, className, maxLength, onCommit }: DraftTextareaCellProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit(nextValue = draft) {
    if (nextValue !== value) onCommit(nextValue);
  }

  return (
    <textarea
      value={draft}
      maxLength={maxLength}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.altKey) {
          event.preventDefault();
          const target = event.currentTarget;
          const start = target.selectionStart ?? draft.length;
          const end = target.selectionEnd ?? draft.length;
          const nextValue = `${draft.slice(0, start)}\n${draft.slice(end)}`;
          setDraft(nextValue);
          window.requestAnimationFrame(() => {
            target.selectionStart = start + 1;
            target.selectionEnd = start + 1;
          });
          return;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          commit(event.currentTarget.value);
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
});

type ResourceAutocompleteCellProps = {
  field: AutoField;
  value: string;
  className: string;
  searchableResources: SearchableResource[];
  dropdownClassName: string;
  renderSuggestion: (resource: Recurso) => ReactNode;
  onCommit: (value: string) => void;
  onSelectResource: (resource: Recurso) => void;
};

function resourceMatchesQuery(item: SearchableResource, field: AutoField, query: string): boolean {
  if (!query) return true;
  if (field === "fabricante") {
    return item.codigoFabricante.includes(query) || item.codigoEka.includes(query) || item.codigoRecurso.includes(query);
  }
  return item.descripcion.includes(query) || item.codigoFabricante.includes(query) || item.codigoEka.includes(query) || item.codigoRecurso.includes(query);
}

function findExactResourceMatch(items: SearchableResource[], field: AutoField, rawValue: string): Recurso | null {
  if (field === "recurso_a_suministrar") return null;
  const value = normalizeSearchText(rawValue);
  if (!value) return null;
  return (
    items.find((item) => {
      const byDescripcion = item.descripcion === value;
      const byFabricante = item.codigoFabricante === value || item.codigoEka === value || item.codigoRecurso === value;
      if (field === "fabricante") return byFabricante;
      return byDescripcion || byFabricante;
    })?.resource ?? null
  );
}

const ResourceAutocompleteCell = memo(function ResourceAutocompleteCell({
  field,
  value,
  className,
  searchableResources,
  dropdownClassName,
  renderSuggestion,
  onCommit,
  onSelectResource,
}: ResourceAutocompleteCellProps) {
  const [draft, setDraft] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const deferredQuery = useDeferredValue(draft);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const suggestions = useMemo(() => {
    const query = normalizeSearchText(deferredQuery);
    if (!isOpen || query.length < 2) return [];
    return searchableResources.filter((item) => resourceMatchesQuery(item, field, query)).slice(0, 20).map((item) => item.resource);
  }, [deferredQuery, field, isOpen, searchableResources]);

  useEffect(() => {
    setActiveIndex(0);
  }, [deferredQuery, field]);

  function commit(nextValue = draft) {
    if (nextValue !== value) onCommit(nextValue);
    const exactMatch = findExactResourceMatch(searchableResources, field, nextValue);
    if (exactMatch) onSelectResource(exactMatch);
  }

  function selectSuggestion(resource: Recurso) {
    onSelectResource(resource);
    setDraft(field === "fabricante" ? resource.codigo_fabricante || resource.codigo_eka || resource.codigo_recurso || "" : resource.descripcion || "");
    setIsOpen(false);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={draft}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => {
          setDraft(event.target.value);
          setIsOpen(true);
        }}
        onBlur={() => {
          commit();
          window.setTimeout(() => setIsOpen(false), 80);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft(value);
            setIsOpen(false);
            event.currentTarget.blur();
            return;
          }
          if (event.key === "ArrowDown" && suggestions.length > 0) {
            event.preventDefault();
            setActiveIndex((prev) => (prev + 1) % suggestions.length);
            return;
          }
          if (event.key === "ArrowUp" && suggestions.length > 0) {
            event.preventDefault();
            setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (suggestions.length > 0 && isOpen) {
              selectSuggestion(suggestions[Math.max(0, Math.min(activeIndex, suggestions.length - 1))]);
              return;
            }
            commit(event.currentTarget.value);
            event.currentTarget.blur();
          }
        }}
        className={className}
      />
      {isOpen && suggestions.length > 0 ? (
        <div className={dropdownClassName}>
          {suggestions.map((resource, idx) => (
            <button
              key={resource.id}
              type="button"
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                selectSuggestion(resource);
              }}
              className={`block w-full border-b border-stone-100 px-2 py-1 text-left text-xs ${
                idx === activeIndex ? "bg-stone-100" : "hover:bg-stone-50"
              }`}
            >
              {renderSuggestion(resource)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});

export function RequirementItemsGrid({
  items,
  recursos,
  cotizacionMoneda,
  resourceTypeOptions,
  currencyOptions,
  statusOptions,
  providerOptions,
  eqOptions,
  llOptions,
  hbOptions,
  logisticaCompraOptions,
  onAddRow,
  onOpenResourceCatalog,
  onRemoveRow,
  onSelectRecurso,
  onCreateRecurso,
  onActiveRowChange,
  onEditingModeChange,
  onPatchRow,
  onSaveTable,
  isSavingTable = false,
  canCreateRecurso = false,
  canEditItems = true,
  canSaveItems = true,
  canUseResourceCatalog = true,
  isCreatingRecurso = false,
  titleLabel = "Detalle de requerimiento",
  showAddRowButton = true,
  hideIndexColumn = false,
  maxHeightClassName = "max-h-[62vh]",
  bodyOverflowYClassName = "overflow-y-auto",
  fullHeight = false,
  requirementContextByItemId,
  onOpenRequirementFromContext,
  onRowClick,
  hiddenColumnKeys = [],
}: RequirementItemsGridProps) {
  const pathname = usePathname() || "/";
  const hasContextColumns = Boolean(requirementContextByItemId);
  const showIndexColumn = !hideIndexColumn;
  const [isWidthsReady, setIsWidthsReady] = useState(false);
  const widthContextKey = hasContextColumns ? "with-context" : "base";
  const autoWidths = useMemo(
    () => buildAutoRequirementGridWidths(items, requirementContextByItemId),
    [items, requirementContextByItemId],
  );
  const widthStorageKey = useMemo(
    () => buildRequirementGridWidthStorageKey(pathname, widthContextKey),
    [pathname, widthContextKey],
  );
  const codigoFabricanteSticky = !hasContextColumns;
  const hiddenColumnSet = useMemo(() => new Set(hiddenColumnKeys as ColumnKey[]), [hiddenColumnKeys]);
  const isColumnHidden = useCallback((key: ColumnKey) => hiddenColumnSet.has(key), [hiddenColumnSet]);
  const [editingMode, setEditingMode] = useState(false);
  const canUseGridActions = !isColumnHidden("acciones");
  const canEditGridItems = canUseGridActions && canEditItems && canSaveItems;
  const canOpenCatalogFromGrid = Boolean(onOpenResourceCatalog && canUseResourceCatalog);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
  const [columnFilters, setColumnFilters] = useState<Partial<Record<ColumnKey, string>>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });
  const searchableResources = useMemo<SearchableResource[]>(
    () =>
      recursos
        // Los recursos inactivos no se ofrecen para nuevas selecciones.
        .filter((resource) => resource.estado !== "Inactivo")
        .map((resource) => ({
          resource,
          codigoFabricante: normalizeSearchText(resource.codigo_fabricante),
          codigoEka: normalizeSearchText(resource.codigo_eka),
          codigoRecurso: normalizeSearchText(resource.codigo_recurso),
          descripcion: normalizeSearchText(resource.descripcion),
        })),
    [recursos],
  );
  const resourceById = useMemo(() => new Map(recursos.map((resource) => [resource.id, resource])), [recursos]);
  const activeRowExists = useMemo(
    () => Boolean(activeRowId && items.some((item) => item.id === activeRowId)),
    [activeRowId, items],
  );
  const effectiveActiveRowId = editingMode && activeRowExists ? activeRowId : null;
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(() =>
    readRequirementGridWidths(
      buildRequirementGridWidthStorageKey(pathname, widthContextKey),
      buildAutoRequirementGridWidths(items, requirementContextByItemId),
    ),
  );
  const initialSnapshotRef = useRef<string>(serializeRows(items));
  const resizingRef = useRef<{ key: ColumnKey; startX: number; startWidth: number } | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const originalOrderRef = useRef<Record<string, number>>({});
  const itemIdsKey = useMemo(() => items.map((item) => item.id).join("|"), [items]);
  const gridSizingVars = useMemo(
    () =>
      ({
        "--rq-grid-row-height": "32px",
        "--rq-grid-control-height": "24px",
        "--rq-grid-cell-padding-y": "2px",
      }) as CSSProperties,
    [],
  );

  useEffect(() => {
    tableWrapperRef.current?.scrollTo({ left: 0 });
  }, []);

  useEffect(() => {
    if (!canEditGridItems) setEditingMode(false);
  }, [canEditGridItems]);

  useEffect(() => {
    onActiveRowChange?.(effectiveActiveRowId);
  }, [effectiveActiveRowId, onActiveRowChange]);

  useEffect(() => {
    setIsWidthsReady(false);
    const restored = readRequirementGridWidths(widthStorageKey, autoWidths);
    setColumnWidths(restored);
    setIsWidthsReady(true);
  }, [widthStorageKey, autoWidths]);

  useEffect(() => {
    requirementGridWidthMemory.set(widthStorageKey, { ...columnWidths });
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(widthStorageKey, JSON.stringify(columnWidths));
    } catch {
      // Ignore storage quota/private mode issues.
    }
  }, [columnWidths, widthStorageKey]);

  useEffect(() => {
    const previous = originalOrderRef.current;
    const usedPositions = Object.values(previous);
    let nextPosition = usedPositions.length > 0 ? Math.max(...usedPositions) + 1 : 0;
    const next: Record<string, number> = {};

    for (const item of items) {
      if (previous[item.id] !== undefined) {
        next[item.id] = previous[item.id];
      } else {
        next[item.id] = nextPosition;
        nextPosition += 1;
      }
    }

    originalOrderRef.current = next;
  }, [itemIdsKey, items]);

  const getItemContext = useCallback((itemId: string): RequirementItemContext => {
    return (
      requirementContextByItemId?.[itemId] ?? {
        requirementId: "",
        proyecto: "-",
        codigoRq: "-",
        cotizacionCodigo: "-",
        oc: "-",
        cliente: "-",
        unidadTrabajo: "-",
        solicitanteRq: "-",
        estadoRq: "-",
        fechaSolicitud: "",
        fechaEntrega: "",
        tipoServicio: "-",
        area: "-",
        itemsTotales: 0,
        pendientes: 0,
        enProceso: 0,
        atendidos: 0,
        vbCompletos: 0,
        conRecurso: 0,
        sinRecurso: 0,
        conFichaSuministrar: 0,
        conOcOs: 0,
        conGuia: 0,
        avance: 0,
        clienteProyecto: "-",
      }
    );
  }, [requirementContextByItemId]);

  const getColumnFilterValue = useCallback((item: EditableRequirementItem, key: ColumnKey): string => {
    const context = getItemContext(item.id);
    switch (key) {
      case "proyecto":
        return context.proyecto;
      case "requerimiento":
        return context.codigoRq;
      case "codigo_rq":
        return context.codigoRq;
      case "cotizacion_codigo":
        return context.cotizacionCodigo;
      case "oc":
        return context.oc;
      case "cliente":
        return context.cliente;
      case "unidad_trabajo":
        return context.unidadTrabajo;
      case "solicitante_rq":
        return context.solicitanteRq;
      case "estado_rq":
        return context.estadoRq;
      case "fecha_solicitud":
        return context.fechaSolicitud;
      case "fecha_entrega_rq":
        return context.fechaEntrega;
      case "tipo_servicio_rq":
        return context.tipoServicio;
      case "area_rq":
        return context.area;
      case "items_totales":
        return String(context.itemsTotales);
      case "pendientes_rq":
        return String(context.pendientes);
      case "en_proceso_rq":
        return String(context.enProceso);
      case "atendidos_rq":
        return String(context.atendidos);
      case "vb_completos_rq":
        return String(context.vbCompletos);
      case "con_recurso_rq":
        return String(context.conRecurso);
      case "sin_recurso_rq":
        return String(context.sinRecurso);
      case "con_ficha_suministrar_rq":
        return String(context.conFichaSuministrar);
      case "con_oc_os_rq":
        return String(context.conOcOs);
      case "con_guia_rq":
        return String(context.conGuia);
      case "avance_rq":
        return `${context.avance}%`;
      case "cliente_proyecto":
        return context.clienteProyecto;
      case "codigo_fabricante":
        return `${item.codigo_fabricante} ${item.codigo_recurso}`;
      case "tipo_recurso":
        return item.tipo_recurso;
      case "descripcion":
        return item.descripcion;
      case "informacion_adicional":
        return item.informacion_adicional;
      case "observaciones_item":
        return item.observaciones_item;
      case "ficha":
        return item.recurso_ficha_tecnica?.name ?? "";
      case "imagen":
        return item.recurso_imagen?.name ?? "";
      case "archivos":
        return item.recurso_archivos.map((f) => f.name).join(" ");
      case "recurso_a_suministrar":
        return item.recurso_a_suministrar;
      case "ficha_tecnica_a_suministrar":
        return item.ficha_tecnica_a_suministrar?.name ?? "";
      case "unidad":
        return item.unidad;
      case "cantidad":
      case "ajuste":
      case "atencion_real":
      case "cant_stock":
      case "compra":
      case "precio_unitario":
      case "tc":
      case "factor_eq_herr":
      case "costo_total_presupuestado":
        return formatCurrencyNumber(item[key] as number);
      case "moneda":
        return item.moneda;
      case "fecha_coti":
      case "eq_fecha_aprob":
      case "ll_fecha_aprob":
      case "hb_fecha_aprob":
      case "fecha_compra":
      case "fecha_entrega":
        return `${item[key] || ""} ${formatDate(item[key] || "")}`;
      case "estado":
        return item.estado;
      case "proveedor":
        return item.proveedor;
      case "condicion_pago":
        return item.condicion_pago;
      case "tiempo_entrega":
        return item.tiempo_entrega;
      case "eq":
      case "ll":
      case "hb":
        return item[key];
      case "logistica_compra":
        return item.logistica_compra;
      case "oc_os_recurso":
        return item.oc_os_recurso;
      case "guia_remision":
        return item.guia_remision;
      case "archivo_guia":
        return item.archivo_guia?.name ?? "";
      default:
        return "";
    }
  }, [getItemContext]);

  const getColumnSortValue = useCallback((item: EditableRequirementItem, key: ColumnKey): string | number => {
    const context = getItemContext(item.id);
    switch (key) {
      case "proyecto":
        return context.proyecto;
      case "requerimiento":
        return context.codigoRq;
      case "codigo_rq":
        return context.codigoRq;
      case "cotizacion_codigo":
        return context.cotizacionCodigo;
      case "oc":
        return context.oc;
      case "cliente":
        return context.cliente;
      case "unidad_trabajo":
        return context.unidadTrabajo;
      case "solicitante_rq":
        return context.solicitanteRq;
      case "estado_rq":
        return context.estadoRq;
      case "fecha_solicitud":
        return context.fechaSolicitud;
      case "fecha_entrega_rq":
        return context.fechaEntrega;
      case "tipo_servicio_rq":
        return context.tipoServicio;
      case "area_rq":
        return context.area;
      case "items_totales":
        return context.itemsTotales;
      case "pendientes_rq":
        return context.pendientes;
      case "en_proceso_rq":
        return context.enProceso;
      case "atendidos_rq":
        return context.atendidos;
      case "vb_completos_rq":
        return context.vbCompletos;
      case "con_recurso_rq":
        return context.conRecurso;
      case "sin_recurso_rq":
        return context.sinRecurso;
      case "con_ficha_suministrar_rq":
        return context.conFichaSuministrar;
      case "con_oc_os_rq":
        return context.conOcOs;
      case "con_guia_rq":
        return context.conGuia;
      case "avance_rq":
        return context.avance;
      case "cliente_proyecto":
        return context.clienteProyecto;
      case "codigo_fabricante":
        return item.codigo_fabricante || "";
      case "tipo_recurso":
        return item.tipo_recurso || "";
      case "descripcion":
        return item.descripcion || "";
      case "informacion_adicional":
        return item.informacion_adicional || "";
      case "observaciones_item":
        return item.observaciones_item || "";
      case "ficha":
        return item.recurso_ficha_tecnica?.name || "";
      case "imagen":
        return item.recurso_imagen?.name || "";
      case "archivos":
        return item.recurso_archivos.length;
      case "recurso_a_suministrar":
        return item.recurso_a_suministrar || "";
      case "ficha_tecnica_a_suministrar":
        return item.ficha_tecnica_a_suministrar?.name || "";
      case "unidad":
        return item.unidad || "";
      case "cantidad":
      case "ajuste":
      case "atencion_real":
      case "cant_stock":
      case "compra":
      case "precio_unitario":
      case "tc":
      case "factor_eq_herr":
      case "costo_total_presupuestado":
        return item[key] as number;
      case "moneda":
        return item.moneda || "";
      case "fecha_coti":
      case "eq_fecha_aprob":
      case "ll_fecha_aprob":
      case "hb_fecha_aprob":
      case "fecha_compra":
      case "fecha_entrega":
        return item[key] || "";
      case "estado":
        return item.estado || "";
      case "proveedor":
        return item.proveedor || "";
      case "condicion_pago":
        return item.condicion_pago || "";
      case "tiempo_entrega":
        return item.tiempo_entrega || "";
      case "eq":
      case "ll":
      case "hb":
        return item[key] || "";
      case "logistica_compra":
        return item.logistica_compra || "";
      case "oc_os_recurso":
        return item.oc_os_recurso || "";
      case "guia_remision":
        return item.guia_remision || "";
      case "archivo_guia":
        return item.archivo_guia?.name || "";
      default:
        return "";
    }
  }, [getItemContext]);

  const filteredSortedItems = useMemo(() => {
    const getOriginalOrder = (id: string) => originalOrderRef.current[id] ?? Number.MAX_SAFE_INTEGER;
    const filtered = items.filter((row) => {
      for (const [key, value] of Object.entries(columnFilters)) {
        const filterValue = (value ?? "").trim();
        if (!filterValue) continue;
        const columnKey = key as ColumnKey;
        const source = normalizeSearchText(getColumnFilterValue(row, columnKey));
        const query = normalizeSearchText(filterValue);
        if (!source.includes(query)) return false;
      }
      return true;
    });

    if (!sortConfig.key || !sortConfig.direction) {
      return [...filtered].sort((a, b) => getOriginalOrder(a.id) - getOriginalOrder(b.id));
    }

    const direction = sortConfig.direction === "asc" ? 1 : -1;
    const key = sortConfig.key;
    const sorted = [...filtered].sort((a, b) => {
      const av = getColumnSortValue(a, key);
      const bv = getColumnSortValue(b, key);

      if (NUMERIC_SORT_COLUMNS.has(key)) {
        const an = Number(av) || 0;
        const bn = Number(bv) || 0;
        return (an - bn) * direction;
      }

      if (DATE_SORT_COLUMNS.has(key)) {
        const at = Date.parse(String(av)) || 0;
        const bt = Date.parse(String(bv)) || 0;
        const diff = (at - bt) * direction;
        if (diff !== 0) return diff;
        return getOriginalOrder(a.id) - getOriginalOrder(b.id);
      }

      const diff = String(av).localeCompare(String(bv), "es", { sensitivity: "base" }) * direction;
      if (diff !== 0) return diff;
      return getOriginalOrder(a.id) - getOriginalOrder(b.id);
    });
    return sorted;
  }, [items, columnFilters, sortConfig, getColumnFilterValue, getColumnSortValue]);

  function requestRemoveRow(rowId: string) {
    if (!editingMode) return;
    onRemoveRow(rowId);
  }

  async function toggleTableEdit() {
    if (!canEditGridItems) return;
    if (!editingMode) {
      initialSnapshotRef.current = serializeRows(items);
      setNumericDrafts({});
      if (showAddRowButton && items.length === 0) {
        onAddRow();
      }
      setEditingMode(true);
      onEditingModeChange?.(true);
      return;
    }
    const current = serializeRows(items);
    const hasTableChanges = current !== initialSnapshotRef.current;
    if (process.env.NODE_ENV === "development") {
      console.log("[RQ_SAVE_DEBUG] RequirementItemsGrid Guardar tabla presionado", {
        totalItemsProp: items.length,
        visibleItems: filteredSortedItems.length,
        hasTableChanges,
        hasOnSaveTable: Boolean(onSaveTable),
        willExecuteOnSave: hasTableChanges && Boolean(onSaveTable),
      });
    }
    if (hasTableChanges) {
      if (onSaveTable) {
        if (process.env.NODE_ENV === "development") {
          console.log("[RQ_SAVE_DEBUG] RequirementItemsGrid ejecuta onSaveTable", {
            totalItemsProp: items.length,
            visibleItems: filteredSortedItems.length,
          });
        }
        await onSaveTable(items);
      }
      initialSnapshotRef.current = current;
    }
    setNumericDrafts({});
    setActiveRowId(null);
    setEditingMode(false);
    onEditingModeChange?.(false);
  }

  function clearTableView() {
    setColumnFilters({});
    setSortConfig({ key: null, direction: null });
  }

  function numericDraftKey(rowId: string, field: NumericField): string {
    return `${rowId}:${field}`;
  }

  function openNumericDraft(rowId: string, field: NumericField, value: number) {
    const key = numericDraftKey(rowId, field);
    setNumericDrafts((prev) => {
      if (prev[key] !== undefined) return prev;
      return { ...prev, [key]: formatEditableNumber(value) };
    });
  }

  function updateNumericDraft(rowId: string, field: NumericField, nextValue: string) {
    const key = numericDraftKey(rowId, field);
    setNumericDrafts((prev) => ({ ...prev, [key]: nextValue }));
  }

  function clearNumericDraft(rowId: string, field: NumericField) {
    const key = numericDraftKey(rowId, field);
    setNumericDrafts((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function commitNumericDraft(
    rowId: string,
    field: NumericField,
    currentValue: number,
    patchBuilder?: (parsedValue: number) => Partial<EditableRequirementItem>,
  ) {
    const key = numericDraftKey(rowId, field);
    const draftValue = numericDrafts[key];
    if (draftValue !== undefined) {
      const parsed = sanitizeNumber(draftValue);
      const patch = patchBuilder ? patchBuilder(parsed) : ({ [field]: parsed } as Partial<EditableRequirementItem>);
      onPatchRow(rowId, patch);
    } else if (patchBuilder) {
      onPatchRow(rowId, patchBuilder(currentValue));
    }
    clearNumericDraft(rowId, field);
  }

  function cancelNumericDraft(rowId: string, field: NumericField) {
    clearNumericDraft(rowId, field);
  }

  function numericInputValue(rowId: string, field: NumericField, fallbackValue: number): string {
    const key = numericDraftKey(rowId, field);
    return numericDrafts[key] ?? formatEditableNumber(fallbackValue);
  }

  function onResizeStart(event: React.MouseEvent, key: ColumnKey) {
    event.preventDefault();
    const startWidth = columnWidths[key];
    resizingRef.current = { key, startX: event.clientX, startWidth };
    const onMove = (ev: MouseEvent) => {
      const state = resizingRef.current;
      if (!state) return;
      const col = COLUMN_DEFS.find((item) => item.key === state.key);
      if (!col) return;
      const next = Math.max(col.minWidth, state.startWidth + (ev.clientX - state.startX));
      setColumnWidths((prev) => ({ ...prev, [state.key]: next }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      resizingRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function shouldIgnoreRowClick(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest("button, a, input, select, textarea, label, [role='button'], [data-no-row-open='true']"),
    );
  }

  function headerCell(
    key: ColumnKey,
    content: React.ReactNode,
    className = "",
    sticky?: boolean,
  ) {
    if (isColumnHidden(key)) return null;
    return (
      <th
        key={key}
        className={`relative border-b border-border bg-stone-50 px-1.5 py-1 text-left font-semibold ${className}`}
        style={{
          width: columnWidths[key],
          minWidth: columnWidths[key],
          maxWidth: columnWidths[key],
          ...(sticky
            ? { position: "sticky", left: getStickyLeft(columnWidths, key, showIndexColumn), zIndex: 30 }
            : {}),
        }}
      >
        {content}
        <div
          onMouseDown={(event) => onResizeStart(event, key)}
          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-stone-300/50"
        />
      </th>
    );
  }

  function cellStyle(key: ColumnKey, sticky?: boolean): React.CSSProperties {
    if (isColumnHidden(key)) {
      return { display: "none" };
    }

    return {
      width: columnWidths[key],
      minWidth: columnWidths[key],
      maxWidth: columnWidths[key],
      ...(sticky
        ? { position: "sticky", left: getStickyLeft(columnWidths, key, showIndexColumn), zIndex: 10, background: "white" }
        : {}),
    };
  }

  function toggleSort(key: ColumnKey) {
    if (NON_SORTABLE_COLUMNS.has(key)) return;
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      if (prev.direction === "desc") return { key: null, direction: null };
      return { key, direction: "asc" };
    });
  }

  function sortIndicator(key: ColumnKey): string {
    if (NON_SORTABLE_COLUMNS.has(key)) return "";
    if (sortConfig.key !== key || !sortConfig.direction) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  }

  function headerContent(key: ColumnKey, icon: IconName, label: string): React.ReactNode {
    if (NON_SORTABLE_COLUMNS.has(key)) {
      return <TableColumnHeader icon={icon} label={label} />;
    }
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="flex w-full items-center justify-between gap-1 rounded px-0.5 text-left hover:bg-stone-100"
        title="Ordenar"
      >
        <TableColumnHeader icon={icon} label={label} />
        <span className="text-[9px] leading-none text-stone-400">{sortIndicator(key)}</span>
      </button>
    );
  }

  function updateColumnFilter(key: ColumnKey, value: string) {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }

  function filterCell(
    key: ColumnKey,
    content: React.ReactNode,
    className = "",
    sticky?: boolean,
  ) {
    if (isColumnHidden(key)) return null;
    return (
      <th
        key={`filter-${key}`}
        className={`h-[var(--rq-grid-row-height)] max-h-[var(--rq-grid-row-height)] border-b border-border bg-stone-50 px-1.5 py-[var(--rq-grid-cell-padding-y)] align-middle ${className}`}
        style={{
          width: columnWidths[key],
          minWidth: columnWidths[key],
          maxWidth: columnWidths[key],
          ...(sticky
            ? { position: "sticky", left: getStickyLeft(columnWidths, key, showIndexColumn), zIndex: 25, background: "#fafaf9" }
            : {}),
        }}
      >
        {content}
      </th>
    );
  }

  function filterInputFor(key: ColumnKey): React.ReactNode {
    if (NON_FILTERABLE_COLUMNS.has(key)) return <span className="block h-5" />;
    return (
      <input
        value={columnFilters[key] ?? ""}
        onChange={(event) => updateColumnFilter(key, event.target.value)}
        placeholder=""
        className="h-[var(--rq-grid-control-height)] min-h-[var(--rq-grid-control-height)] max-h-[var(--rq-grid-control-height)] w-full rounded border border-stone-200 bg-white px-1 text-[10px] leading-[var(--rq-grid-control-height)] outline-none"
      />
    );
  }

  function renderFileRows(
    title: string,
    files: ResourceFileMeta[],
    onRemoveFile?: (index: number) => void,
  ) {
    if (files.length === 0) return <span className={readCellClassName()}>-</span>;
    return (
      <div className="w-full space-y-0.5">
        {files.map((file, index) => (
          <div key={`${file.name}-${index}`} className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setPreview({ title, files: [file] })}
              className="inline-flex min-w-0 w-full flex-1 items-center rounded px-1 py-[1px] text-left text-[10px] text-stone-600 hover:bg-stone-100"
              title={file.name}
            >
              <span className="inline-flex min-w-0 w-full items-center gap-1">
                <span className="shrink-0">
                  <FieldLabelIcon
                    icon={fileIconByExtension(fileExtension(file.name))}
                    label={file.name}
                    className="text-[10px] [&>span:last-child]:hidden"
                  />
                </span>
                <span className="min-w-0 flex-1 truncate whitespace-nowrap">{file.name}</span>
              </span>
            </button>
            {onRemoveFile ? (
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="inline-flex h-5 w-5 items-center justify-center rounded border border-stone-300 text-stone-500 hover:bg-stone-100"
                title="Quitar archivo"
                aria-label="Quitar archivo"
              >
                <MiniCloseIcon />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  function toolbarButtonClassName(): string {
    return "inline-flex h-6 min-h-6 items-center gap-1 rounded border border-border px-1.5 text-[11px] leading-none text-stone-600 hover:bg-stone-100";
  }

  function regularizationBadge(item: EditableRequirementItem): React.ReactNode {
    const resource = item.recurso_id ? resourceById.get(item.recurso_id) : null;
    if (resource?.estado !== "Por revisar") return null;
    return (
      <span className="ml-1 inline-flex h-4 shrink-0 items-center rounded border border-amber-200 bg-amber-50 px-1 text-[9px] font-medium leading-none text-amber-700">
        Por regularizar
      </span>
    );
  }

  return (
    <div
      className={`flex min-h-0 flex-col rounded-xl border border-border bg-panel ${fullHeight ? "h-full" : ""} ${
        isWidthsReady ? "opacity-100" : "opacity-0"
      }`}
      style={gridSizingVars}
    >
      <div className="flex flex-none items-center justify-between border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-2">
          <FieldLabelIcon icon="clipboard-list" label={titleLabel} className="text-xs font-medium" />
          {editingMode && showAddRowButton && canUseGridActions && (canOpenCatalogFromGrid || !onOpenResourceCatalog) ? (
            <button
              type="button"
              onClick={canOpenCatalogFromGrid ? onOpenResourceCatalog : onAddRow}
              className={toolbarButtonClassName()}
            >
              + Agregar recurso
            </button>
          ) : null}
          {editingMode && canUseGridActions && canEditGridItems && canCreateRecurso && onCreateRecurso ? (
            <button
              type="button"
              onClick={() => onCreateRecurso(effectiveActiveRowId)}
              disabled={isCreatingRecurso}
              className={`${toolbarButtonClassName()} min-w-[92px] shrink-0 justify-center whitespace-nowrap text-stone-600 disabled:cursor-not-allowed disabled:opacity-60`}
              title={effectiveActiveRowId ? "Crear recurso para la fila activa" : "Crear recurso"}
              aria-label="Crear recurso"
            >
              <span className="inline-flex shrink-0 whitespace-nowrap text-stone-600">+ Crear recurso</span>
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {canUseGridActions ? (
          <>
          <button
            type="button"
            onClick={clearTableView}
            className={toolbarButtonClassName()}
            title="Limpiar filtros y orden"
          >
            <FieldLabelIcon icon="sliders-horizontal" label="Limpiar filtros" className="text-xs text-stone-600" />
          </button>
          {canEditGridItems ? (
            <FieldLockButton
              locked={!editingMode}
              label={editingMode ? (isSavingTable ? "Guardando..." : "Guardar tabla") : "Editar tabla"}
              onToggle={() => void toggleTableEdit()}
            />
          ) : null}
          </>
          ) : null}
        </div>
      </div>

      <div
        ref={tableWrapperRef}
        className={`min-h-0 overflow-x-auto ${bodyOverflowYClassName} ${fullHeight ? "flex-1" : ""} ${maxHeightClassName}`}
      >
        <table className="requirement-items-grid w-max table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0 [&_tbody_tr]:min-h-[var(--rq-grid-row-height)] [&_tbody_td]:min-h-[var(--rq-grid-row-height)] [&_tbody_td]:py-[var(--rq-grid-cell-padding-y)] [&_tbody_td]:align-middle [&_tbody_td]:box-border [&_.rq-cell-control]:!h-[var(--rq-grid-control-height)] [&_.rq-cell-control]:!min-h-[var(--rq-grid-control-height)] [&_.rq-cell-control]:!max-h-[var(--rq-grid-control-height)] [&_.rq-cell-control]:!my-0 [&_.rq-cell-control]:leading-[var(--rq-grid-control-height)] [&_.rq-cell-control]:align-middle [&_.rq-cell-read]:!h-[var(--rq-grid-control-height)] [&_.rq-cell-read]:!min-h-[var(--rq-grid-control-height)] [&_.rq-cell-read]:!max-h-[var(--rq-grid-control-height)] [&_.rq-cell-read]:leading-[var(--rq-grid-control-height)] [&_.rq-cell-read]:align-middle">
          <thead className="sticky top-0 z-20 bg-stone-50 text-muted">
            <tr className="filters-row h-[var(--rq-grid-row-height)] max-h-[var(--rq-grid-row-height)]">
              {showIndexColumn ? headerCell("idx", headerContent("idx", "hash", "#"), "", true) : null}
              {hasContextColumns
                ? headerCell("proyecto", headerContent("proyecto", "file-text", "Proyecto"))
                : null}
              {hasContextColumns
                ? headerCell("requerimiento", headerContent("requerimiento", "clipboard-list", "Requerimiento"))
                : null}
              {hasContextColumns
                ? headerCell("codigo_rq", headerContent("codigo_rq", "clipboard-list", "Código RQ"))
                : null}
              {hasContextColumns
                ? headerCell("cotizacion_codigo", headerContent("cotizacion_codigo", "file-text", "Cotización"))
                : null}
              {hasContextColumns
                ? headerCell("oc", headerContent("oc", "file-text", "OC"))
                : null}
              {hasContextColumns
                ? headerCell("cliente", headerContent("cliente", "building", "Cliente"))
                : null}
              {hasContextColumns
                ? headerCell("unidad_trabajo", headerContent("unidad_trabajo", "map-pin", "Unidad de trabajo"))
                : null}
              {hasContextColumns
                ? headerCell("solicitante_rq", headerContent("solicitante_rq", "user", "Solicitante de RQ"))
                : null}
              {hasContextColumns
                ? headerCell("estado_rq", headerContent("estado_rq", "circle-dot", "Estado RQ"))
                : null}
              {hasContextColumns
                ? headerCell("fecha_solicitud", headerContent("fecha_solicitud", "calendar", "Fecha solicitud"))
                : null}
              {hasContextColumns
                ? headerCell("fecha_entrega_rq", headerContent("fecha_entrega_rq", "calendar-days", "Fecha de entrega"))
                : null}
              {hasContextColumns
                ? headerCell("tipo_servicio_rq", headerContent("tipo_servicio_rq", "tags", "Tipo de servicio"))
                : null}
              {hasContextColumns
                ? headerCell("area_rq", headerContent("area_rq", "layout-grid", "Área"))
                : null}
              {hasContextColumns
                ? headerCell("items_totales", headerContent("items_totales", "hash", "Ítems totales"))
                : null}
              {hasContextColumns
                ? headerCell("pendientes_rq", headerContent("pendientes_rq", "clock", "Pendientes"))
                : null}
              {hasContextColumns
                ? headerCell("en_proceso_rq", headerContent("en_proceso_rq", "clipboard-check", "En proceso"))
                : null}
              {hasContextColumns
                ? headerCell("atendidos_rq", headerContent("atendidos_rq", "check-circle", "Atendidos"))
                : null}
              {hasContextColumns
                ? headerCell("vb_completos_rq", headerContent("vb_completos_rq", "shield-check", "VB completos"))
                : null}
              {hasContextColumns
                ? headerCell("con_recurso_rq", headerContent("con_recurso_rq", "list-checks", "Con recurso"))
                : null}
              {hasContextColumns
                ? headerCell("sin_recurso_rq", headerContent("sin_recurso_rq", "list-checks", "Sin recurso"))
                : null}
              {hasContextColumns
                ? headerCell(
                    "con_ficha_suministrar_rq",
                    headerContent("con_ficha_suministrar_rq", "file-up", "Con ficha suministrar"),
                  )
                : null}
              {hasContextColumns
                ? headerCell("con_oc_os_rq", headerContent("con_oc_os_rq", "file-text", "Con OC/OS"))
                : null}
              {hasContextColumns
                ? headerCell("con_guia_rq", headerContent("con_guia_rq", "truck", "Con guía"))
                : null}
              {hasContextColumns
                ? headerCell("avance_rq", headerContent("avance_rq", "percent", "Avance"))
                : null}
              {hasContextColumns
                ? headerCell("cliente_proyecto", headerContent("cliente_proyecto", "building", "Cliente / Proyecto"))
                : null}
              {headerCell(
                "codigo_fabricante",
                headerContent("codigo_fabricante", "barcode", "Código fabricante"),
                "",
                codigoFabricanteSticky,
              )}
              {headerCell("tipo_recurso", headerContent("tipo_recurso", "tags", "Tipo recurso"))}
              {headerCell("descripcion", headerContent("descripcion", "align-left", "Descripción"))}
              {headerCell("informacion_adicional", headerContent("informacion_adicional", "file-text", "Información adicional"))}
              {headerCell("observaciones_item", headerContent("observaciones_item", "clipboard-list", "Observaciones"))}
              {headerCell("ficha", headerContent("ficha", "file-up", "Ficha técnica"))}
              {headerCell("imagen", headerContent("imagen", "image", "Imagen referencial"))}
              {headerCell("archivos", headerContent("archivos", "files", "Archivos"))}
              {headerCell("unidad", headerContent("unidad", "ruler", "Unidad"))}
              {headerCell("cantidad", headerContent("cantidad", "hash", "Cantidad"))}
              {headerCell("ajuste", headerContent("ajuste", "sliders-horizontal", "Ajuste"))}
              {headerCell("atencion_real", headerContent("atencion_real", "clipboard-check", "Atención real"))}
              {headerCell("cant_stock", headerContent("cant_stock", "package", "Cant. stock"))}
              {headerCell("compra", headerContent("compra", "shopping-cart", "Compra"))}
              {headerCell("precio_unitario", headerContent("precio_unitario", "dollar", "Precio unitario"))}
              {headerCell("moneda", headerContent("moneda", "coins", "Moneda"))}
              {headerCell("tc", headerContent("tc", "badge-dollar-sign", "TC"))}
              {headerCell("factor_eq_herr", headerContent("factor_eq_herr", "percent", "Factor eq. y herr."))}
              {headerCell("costo_total_presupuestado", headerContent("costo_total_presupuestado", "calculator", "Costo total"))}
              {headerCell("fecha_coti", headerContent("fecha_coti", "calendar", "Fecha de coti"))}
              {headerCell("estado", headerContent("estado", "circle-dot", "Estado"))}
              {headerCell("recurso_a_suministrar", headerContent("recurso_a_suministrar", "list-checks", "Recurso a suministrar"))}
              {headerCell("ficha_tecnica_a_suministrar", headerContent("ficha_tecnica_a_suministrar", "file-up", "Ficha técnica a suministrar"))}
              {headerCell("proveedor", headerContent("proveedor", "store", "Proveedor"))}
              {headerCell("condicion_pago", headerContent("condicion_pago", "receipt", "Cond. pago"))}
              {headerCell("tiempo_entrega", headerContent("tiempo_entrega", "clock", "Tiempo de entrega"))}
              {headerCell("eq", headerContent("eq", "shield-check", "VB Económico"))}
              {headerCell("eq_fecha_aprob", headerContent("eq_fecha_aprob", "calendar-check", "F. aprob. VB Económico"))}
              {headerCell("ll", headerContent("ll", "shield-check", "VB Técnico"))}
              {headerCell("ll_fecha_aprob", headerContent("ll_fecha_aprob", "calendar-check", "F. aprob. VB Técnico"))}
              {headerCell("hb", headerContent("hb", "shield-check", "VB Atención"))}
              {headerCell("hb_fecha_aprob", headerContent("hb_fecha_aprob", "calendar-check", "F. aprob. VB Atención"))}
              {headerCell("logistica_compra", headerContent("logistica_compra", "truck", "Logística compra"))}
              {headerCell("fecha_compra", headerContent("fecha_compra", "calendar-check", "F. compra"))}
              {headerCell("oc_os_recurso", headerContent("oc_os_recurso", "file-text", "OC/OS del recurso"))}
              {headerCell("fecha_entrega", headerContent("fecha_entrega", "calendar-days", "F. entrega"))}
              {headerCell("guia_remision", headerContent("guia_remision", "truck", "Guía de remisión"))}
              {headerCell("archivo_guia", headerContent("archivo_guia", "paperclip", "Archivo guía"))}
              {headerCell("acciones", headerContent("acciones", "settings2", "Acciones"))}
            </tr>
            <tr>
              {showIndexColumn ? filterCell("idx", filterInputFor("idx"), "", true) : null}
              {hasContextColumns ? filterCell("proyecto", filterInputFor("proyecto")) : null}
              {hasContextColumns ? filterCell("requerimiento", filterInputFor("requerimiento")) : null}
              {hasContextColumns ? filterCell("codigo_rq", filterInputFor("codigo_rq")) : null}
              {hasContextColumns ? filterCell("cotizacion_codigo", filterInputFor("cotizacion_codigo")) : null}
              {hasContextColumns ? filterCell("oc", filterInputFor("oc")) : null}
              {hasContextColumns ? filterCell("cliente", filterInputFor("cliente")) : null}
              {hasContextColumns ? filterCell("unidad_trabajo", filterInputFor("unidad_trabajo")) : null}
              {hasContextColumns ? filterCell("solicitante_rq", filterInputFor("solicitante_rq")) : null}
              {hasContextColumns ? filterCell("estado_rq", filterInputFor("estado_rq")) : null}
              {hasContextColumns ? filterCell("fecha_solicitud", filterInputFor("fecha_solicitud")) : null}
              {hasContextColumns ? filterCell("fecha_entrega_rq", filterInputFor("fecha_entrega_rq")) : null}
              {hasContextColumns ? filterCell("tipo_servicio_rq", filterInputFor("tipo_servicio_rq")) : null}
              {hasContextColumns ? filterCell("area_rq", filterInputFor("area_rq")) : null}
              {hasContextColumns ? filterCell("items_totales", filterInputFor("items_totales")) : null}
              {hasContextColumns ? filterCell("pendientes_rq", filterInputFor("pendientes_rq")) : null}
              {hasContextColumns ? filterCell("en_proceso_rq", filterInputFor("en_proceso_rq")) : null}
              {hasContextColumns ? filterCell("atendidos_rq", filterInputFor("atendidos_rq")) : null}
              {hasContextColumns ? filterCell("vb_completos_rq", filterInputFor("vb_completos_rq")) : null}
              {hasContextColumns ? filterCell("con_recurso_rq", filterInputFor("con_recurso_rq")) : null}
              {hasContextColumns ? filterCell("sin_recurso_rq", filterInputFor("sin_recurso_rq")) : null}
              {hasContextColumns ? filterCell("con_ficha_suministrar_rq", filterInputFor("con_ficha_suministrar_rq")) : null}
              {hasContextColumns ? filterCell("con_oc_os_rq", filterInputFor("con_oc_os_rq")) : null}
              {hasContextColumns ? filterCell("con_guia_rq", filterInputFor("con_guia_rq")) : null}
              {hasContextColumns ? filterCell("avance_rq", filterInputFor("avance_rq")) : null}
              {hasContextColumns ? filterCell("cliente_proyecto", filterInputFor("cliente_proyecto")) : null}
              {filterCell("codigo_fabricante", filterInputFor("codigo_fabricante"), "", codigoFabricanteSticky)}
              {filterCell("tipo_recurso", filterInputFor("tipo_recurso"))}
              {filterCell("descripcion", filterInputFor("descripcion"))}
              {filterCell("informacion_adicional", filterInputFor("informacion_adicional"))}
              {filterCell("observaciones_item", filterInputFor("observaciones_item"))}
              {filterCell("ficha", filterInputFor("ficha"))}
              {filterCell("imagen", filterInputFor("imagen"))}
              {filterCell("archivos", filterInputFor("archivos"))}
              {filterCell("unidad", filterInputFor("unidad"))}
              {filterCell("cantidad", filterInputFor("cantidad"))}
              {filterCell("ajuste", filterInputFor("ajuste"))}
              {filterCell("atencion_real", filterInputFor("atencion_real"))}
              {filterCell("cant_stock", filterInputFor("cant_stock"))}
              {filterCell("compra", filterInputFor("compra"))}
              {filterCell("precio_unitario", filterInputFor("precio_unitario"))}
              {filterCell("moneda", filterInputFor("moneda"))}
              {filterCell("tc", filterInputFor("tc"))}
              {filterCell("factor_eq_herr", filterInputFor("factor_eq_herr"))}
              {filterCell("costo_total_presupuestado", filterInputFor("costo_total_presupuestado"))}
              {filterCell("fecha_coti", filterInputFor("fecha_coti"))}
              {filterCell("estado", filterInputFor("estado"))}
              {filterCell("recurso_a_suministrar", filterInputFor("recurso_a_suministrar"))}
              {filterCell("ficha_tecnica_a_suministrar", filterInputFor("ficha_tecnica_a_suministrar"))}
              {filterCell("proveedor", filterInputFor("proveedor"))}
              {filterCell("condicion_pago", filterInputFor("condicion_pago"))}
              {filterCell("tiempo_entrega", filterInputFor("tiempo_entrega"))}
              {filterCell("eq", filterInputFor("eq"))}
              {filterCell("eq_fecha_aprob", filterInputFor("eq_fecha_aprob"))}
              {filterCell("ll", filterInputFor("ll"))}
              {filterCell("ll_fecha_aprob", filterInputFor("ll_fecha_aprob"))}
              {filterCell("hb", filterInputFor("hb"))}
              {filterCell("hb_fecha_aprob", filterInputFor("hb_fecha_aprob"))}
              {filterCell("logistica_compra", filterInputFor("logistica_compra"))}
              {filterCell("fecha_compra", filterInputFor("fecha_compra"))}
              {filterCell("oc_os_recurso", filterInputFor("oc_os_recurso"))}
              {filterCell("fecha_entrega", filterInputFor("fecha_entrega"))}
              {filterCell("guia_remision", filterInputFor("guia_remision"))}
              {filterCell("archivo_guia", filterInputFor("archivo_guia"))}
              {filterCell("acciones", filterInputFor("acciones"))}
            </tr>
          </thead>
          <tbody>
            {filteredSortedItems.map((item, index) => {
              const context = getItemContext(item.id);
              const dynamicRowHeight = rowHeightPx(item);
              const fabricanteCellStyle = cellStyle("codigo_fabricante", codigoFabricanteSticky);
              const multilineCellHeight = Math.max(
                24,
                Math.max(multilineRows(item.informacion_adicional), multilineRows(item.observaciones_item)) * 16 + 8,
              );
              return (
                <tr
                  key={item.id}
                  className={`border-t border-stone-200 align-middle ${
                    onRowClick && !editingMode ? "cursor-pointer hover:bg-stone-50" : ""
                  } ${effectiveActiveRowId === item.id ? "bg-amber-50/40" : ""}`}
                  style={{ height: `${dynamicRowHeight}px`, minHeight: `${dynamicRowHeight}px` }}
                  onClick={(event) => {
                    if (editingMode) {
                      setActiveRowId(item.id);
                      return;
                    }
                    if (!onRowClick || editingMode) return;
                    if (shouldIgnoreRowClick(event.target)) return;
                    onRowClick(item);
                  }}
                  onFocusCapture={() => {
                    if (editingMode) setActiveRowId(item.id);
                  }}
                >
                  {showIndexColumn ? (
                    <td style={cellStyle("idx", true)} className="px-1.5 py-0.5">
                      {index + 1}
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("proyecto")} className="px-1.5 py-0.5">
                      <span className={readWrapCellClassName()} title={context.proyecto || "-"}>
                        {context.proyecto || "-"}
                      </span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("requerimiento")} className="px-1.5 py-0.5">
                      <span className={readCellClassName()}>{context.codigoRq || "-"}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("codigo_rq")} className="px-1.5 py-0.5">
                      {context.requirementId && onOpenRequirementFromContext ? (
                        <button
                          type="button"
                          onClick={() => onOpenRequirementFromContext(context.requirementId)}
                          className="inline-flex w-full items-center rounded px-0.5 text-left text-[11px] text-sky-700 underline-offset-2 hover:text-sky-800 hover:underline"
                          title={`Abrir ${context.codigoRq}`}
                        >
                          {context.codigoRq}
                        </button>
                      ) : (
                        <span className={readCellClassName()}>{context.codigoRq || "-"}</span>
                      )}
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("cotizacion_codigo")} className="px-1.5 py-0.5">
                      <span className={readCellClassName()}>{context.cotizacionCodigo || "-"}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("oc")} className="px-1.5 py-0.5">
                      <span className={readCellClassName()}>{context.oc || "-"}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("cliente")} className="px-1.5 py-0.5">
                      <span className={readWrapCellClassName()} title={context.cliente || "-"}>
                        {context.cliente || "-"}
                      </span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("unidad_trabajo")} className="px-1.5 py-0.5">
                      <span className={readWrapCellClassName()} title={context.unidadTrabajo || "-"}>
                        {context.unidadTrabajo || "-"}
                      </span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("solicitante_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName()}>{context.solicitanteRq || "-"}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("estado_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName()}>{context.estadoRq || "-"}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("fecha_solicitud")} className="px-1.5 py-0.5">
                      <span className={readDateCellClassName()}>{formatDate(context.fechaSolicitud) || "-"}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("fecha_entrega_rq")} className="px-1.5 py-0.5">
                      <span className={readDateCellClassName()}>{formatDate(context.fechaEntrega) || "-"}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("tipo_servicio_rq")} className="px-1.5 py-0.5">
                      <span className={readWrapCellClassName()} title={context.tipoServicio || "-"}>
                        {context.tipoServicio || "-"}
                      </span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("area_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName()}>{context.area || "-"}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("items_totales")} className="px-1.5 py-0.5">
                      <span className={readCellClassName(true)}>{context.itemsTotales}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("pendientes_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName(true)}>{context.pendientes}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("en_proceso_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName(true)}>{context.enProceso}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("atendidos_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName(true)}>{context.atendidos}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("vb_completos_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName(true)}>{context.vbCompletos}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("con_recurso_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName(true)}>{context.conRecurso}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("sin_recurso_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName(true)}>{context.sinRecurso}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("con_ficha_suministrar_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName(true)}>{context.conFichaSuministrar}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("con_oc_os_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName(true)}>{context.conOcOs}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("con_guia_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName(true)}>{context.conGuia}</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("avance_rq")} className="px-1.5 py-0.5">
                      <span className={readCellClassName(true)}>{context.avance}%</span>
                    </td>
                  ) : null}
                  {hasContextColumns ? (
                    <td style={cellStyle("cliente_proyecto")} className="px-1.5 py-0.5">
                      <span className={readWrapCellClassName()} title={context.clienteProyecto || "-"}>
                        {context.clienteProyecto || "-"}
                      </span>
                    </td>
                  ) : null}

                  <td style={fabricanteCellStyle} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <ResourceAutocompleteCell
                        field="fabricante"
                        value={item.codigo_fabricante}
                        searchableResources={searchableResources}
                        onCommit={(value) => onPatchRow(item.id, { codigo_fabricante: value })}
                        onSelectResource={(resource) => onSelectRecurso(item.id, resource.id)}
                        className={cellClassName()}
                        dropdownClassName="absolute left-0 top-full z-[320] mt-1 max-h-40 w-full min-w-[260px] overflow-y-auto rounded border border-border bg-white shadow-xl"
                        renderSuggestion={(resource) => (
                          <span className="block truncate text-[11px]">
                            {[resource.codigo_fabricante, resource.codigo_eka, resource.codigo_recurso]
                              .filter((code, codeIndex, arr) => !!code && arr.indexOf(code) === codeIndex)
                              .join(" · ") || "-"}
                          </span>
                        )}
                      />
                    ) : (
                      <span className={readCellClassName()}>{item.codigo_fabricante || "-"}</span>
                    )}
                  </td>

                  <td style={cellStyle("tipo_recurso")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <select value={item.tipo_recurso} onChange={(e) => onPatchRow(item.id, { tipo_recurso: e.target.value })} className={cellClassName()}>
                        {resourceTypeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <span className={readCellClassName()}>{item.tipo_recurso || "-"}</span>
                    )}
                  </td>

                  <td style={cellStyle("descripcion")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <ResourceAutocompleteCell
                        field="descripcion"
                        value={item.descripcion}
                        searchableResources={searchableResources}
                        onCommit={(value) => onPatchRow(item.id, { descripcion: value })}
                        onSelectResource={(resource) => onSelectRecurso(item.id, resource.id)}
                        className={cellClassName()}
                        dropdownClassName="absolute left-0 top-full z-[120] mt-1 max-h-40 w-[420px] overflow-y-auto rounded border border-border bg-white shadow-xl"
                        renderSuggestion={(resource) => resource.descripcion}
                      />
                    ) : (
                      <span className="inline-flex h-[var(--rq-grid-control-height)] w-full min-w-0 items-center overflow-hidden">
                        <span className={`${readCellClassName()} min-w-0 flex-1 truncate`}>{item.descripcion || "-"}</span>
                        {regularizationBadge(item)}
                      </span>
                    )}
                  </td>

                  <td style={cellStyle("informacion_adicional")} className="px-1.5 py-0.5">
                    <div style={{ height: `${multilineCellHeight}px` }} className="w-full">
                      {editingMode ? (
                        <DraftTextareaCell
                          value={item.informacion_adicional}
                          onCommit={(value) => onPatchRow(item.id, { informacion_adicional: value })}
                          maxLength={180}
                          className="h-full w-full resize-none overflow-y-auto rounded border border-stone-300 bg-white px-1.5 py-1 text-[11px] leading-4 outline-none box-border focus:border-stone-500"
                        />
                      ) : (
                        <span
                          className="inline-block h-full w-full overflow-y-auto whitespace-pre-wrap break-words rounded border-0 px-1.5 py-1 text-[11px] leading-4 box-border"
                          title={item.informacion_adicional || "-"}
                        >
                          {item.informacion_adicional || "-"}
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={cellStyle("observaciones_item")} className="px-1.5 py-0.5">
                    <div style={{ height: `${multilineCellHeight}px` }} className="w-full">
                      {editingMode ? (
                        <DraftTextareaCell
                          value={item.observaciones_item}
                          onCommit={(value) => onPatchRow(item.id, { observaciones_item: value })}
                          className="h-full w-full resize-none overflow-y-auto overflow-x-hidden rounded border border-stone-300 bg-white px-1.5 py-1 text-[11px] leading-4 outline-none box-border focus:border-stone-500"
                        />
                      ) : (
                        <span
                          className="inline-block h-full w-full overflow-y-auto whitespace-pre-wrap break-words rounded border-0 px-1.5 py-1 text-[11px] leading-4 box-border"
                          title={item.observaciones_item || "-"}
                        >
                          {item.observaciones_item || "-"}
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={cellStyle("ficha")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <div className="flex w-full items-center gap-1">
                        <label className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-stone-300 text-stone-500 hover:bg-stone-100" title="Subir archivo">
                          <MiniPlusIcon />
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              const files = Array.from(event.target.files ?? []);
                              if (files.length === 0) return;
                              const appended = [...item.recurso_ficha_tecnica_files, ...files.map((file) => buildLocalFileMeta(file))];
                              onPatchRow(item.id, {
                                recurso_ficha_tecnica_files: appended,
                                recurso_ficha_tecnica: appended[0] ?? null,
                              });
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <div className="min-w-0 flex-1">
                          {renderFileRows(
                            "Ficha técnica",
                            item.recurso_ficha_tecnica_files,
                            (fileIndex) => {
                              const nextFiles = item.recurso_ficha_tecnica_files.filter((_, idx) => idx !== fileIndex);
                              onPatchRow(item.id, {
                                recurso_ficha_tecnica_files: nextFiles,
                                recurso_ficha_tecnica: nextFiles[0] ?? null,
                              });
                            },
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex w-full items-center gap-1">
                        <span className="inline-flex h-5 w-5 shrink-0" aria-hidden />
                        <div className="min-w-0 flex-1">{renderFileRows("Ficha técnica", item.recurso_ficha_tecnica_files)}</div>
                      </div>
                    )}
                  </td>

                  <td style={cellStyle("imagen")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <div className="flex w-full items-center gap-1">
                        <label className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-stone-300 text-stone-500 hover:bg-stone-100" title="Subir imagen">
                          <MiniPlusIcon />
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              const files = Array.from(event.target.files ?? []);
                              if (files.length === 0) return;
                              const appended = [...item.recurso_imagen_files, ...files.map((file) => buildLocalFileMeta(file))];
                              onPatchRow(item.id, {
                                recurso_imagen_files: appended,
                                recurso_imagen: appended[0] ?? null,
                              });
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <div className="min-w-0 flex-1">
                          {renderFileRows(
                            "Imagen referencial",
                            item.recurso_imagen_files,
                            (fileIndex) => {
                              const nextFiles = item.recurso_imagen_files.filter((_, idx) => idx !== fileIndex);
                              onPatchRow(item.id, {
                                recurso_imagen_files: nextFiles,
                                recurso_imagen: nextFiles[0] ?? null,
                              });
                            },
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex w-full items-center gap-1">
                        <span className="inline-flex h-5 w-5 shrink-0" aria-hidden />
                        <div className="min-w-0 flex-1">{renderFileRows("Imagen referencial", item.recurso_imagen_files)}</div>
                      </div>
                    )}
                  </td>

                  <td style={cellStyle("archivos")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <div className="flex w-full items-center gap-1">
                        <label className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-stone-300 text-stone-500 hover:bg-stone-100" title="Subir archivos">
                          <MiniPlusIcon />
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              const files = Array.from(event.target.files ?? []);
                              if (files.length === 0) return;
                              onPatchRow(item.id, {
                                recurso_archivos: [...item.recurso_archivos, ...files.map((file) => buildLocalFileMeta(file))],
                              });
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <div className="min-w-0 flex-1">
                          {renderFileRows("Archivos", item.recurso_archivos, (fileIndex) =>
                            onPatchRow(item.id, {
                              recurso_archivos: item.recurso_archivos.filter((_, idx) => idx !== fileIndex),
                            }),
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex w-full items-center gap-1">
                        <span className="inline-flex h-5 w-5 shrink-0" aria-hidden />
                        <div className="min-w-0 flex-1">{renderFileRows("Archivos", item.recurso_archivos)}</div>
                      </div>
                    )}
                  </td>

                  <td style={cellStyle("unidad")} className="px-1.5 py-0.5"><span className={readCellClassName()}>{item.unidad || "-"}</span></td>
                  <td style={cellStyle("cantidad")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={numericInputValue(item.id, "cantidad", item.cantidad)}
                        onFocus={(e) => {
                          openNumericDraft(item.id, "cantidad", item.cantidad);
                          e.currentTarget.select();
                        }}
                        onChange={(e) => updateNumericDraft(item.id, "cantidad", e.target.value)}
                        onBlur={() => commitNumericDraft(item.id, "cantidad", item.cantidad)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            commitNumericDraft(item.id, "cantidad", item.cantidad);
                            (e.currentTarget as HTMLInputElement).blur();
                          }
                          if (e.key === "Escape") {
                            cancelNumericDraft(item.id, "cantidad");
                            (e.currentTarget as HTMLInputElement).blur();
                          }
                        }}
                        className={numericCellClassName()}
                      />
                    ) : <span className={readCellClassName(true)}>{formatCurrencyNumber(item.cantidad)}</span>}
                  </td>
                  <td style={cellStyle("ajuste")} className="px-1.5 py-0.5">{editingMode ? <input type="text" inputMode="decimal" value={numericInputValue(item.id, "ajuste", item.ajuste)} onFocus={(e) => { openNumericDraft(item.id, "ajuste", item.ajuste); e.currentTarget.select(); }} onChange={(e) => updateNumericDraft(item.id, "ajuste", e.target.value)} onBlur={() => commitNumericDraft(item.id, "ajuste", item.ajuste)} onKeyDown={(e) => { if (e.key === "Enter") { commitNumericDraft(item.id, "ajuste", item.ajuste); (e.currentTarget as HTMLInputElement).blur(); } if (e.key === "Escape") { cancelNumericDraft(item.id, "ajuste"); (e.currentTarget as HTMLInputElement).blur(); } }} className={numericCellClassName()} /> : <span className={readCellClassName(true)}>{formatCurrencyNumber(item.ajuste)}</span>}</td>
                  <td style={cellStyle("atencion_real")} className="px-1.5 py-0.5">{editingMode ? <input type="text" inputMode="decimal" value={numericInputValue(item.id, "atencion_real", item.atencion_real)} onFocus={(e) => { openNumericDraft(item.id, "atencion_real", item.atencion_real); e.currentTarget.select(); }} onChange={(e) => updateNumericDraft(item.id, "atencion_real", e.target.value)} onBlur={() => commitNumericDraft(item.id, "atencion_real", item.atencion_real)} onKeyDown={(e) => { if (e.key === "Enter") { commitNumericDraft(item.id, "atencion_real", item.atencion_real); (e.currentTarget as HTMLInputElement).blur(); } if (e.key === "Escape") { cancelNumericDraft(item.id, "atencion_real"); (e.currentTarget as HTMLInputElement).blur(); } }} className={numericCellClassName()} /> : <span className={readCellClassName(true)}>{formatCurrencyNumber(item.atencion_real)}</span>}</td>
                  <td style={cellStyle("cant_stock")} className="px-1.5 py-0.5">{editingMode ? <input type="text" inputMode="decimal" value={numericInputValue(item.id, "cant_stock", item.cant_stock)} onFocus={(e) => { openNumericDraft(item.id, "cant_stock", item.cant_stock); e.currentTarget.select(); }} onChange={(e) => updateNumericDraft(item.id, "cant_stock", e.target.value)} onBlur={() => commitNumericDraft(item.id, "cant_stock", item.cant_stock)} onKeyDown={(e) => { if (e.key === "Enter") { commitNumericDraft(item.id, "cant_stock", item.cant_stock); (e.currentTarget as HTMLInputElement).blur(); } if (e.key === "Escape") { cancelNumericDraft(item.id, "cant_stock"); (e.currentTarget as HTMLInputElement).blur(); } }} className={numericCellClassName()} /> : <span className={readCellClassName(true)}>{formatCurrencyNumber(item.cant_stock)}</span>}</td>
                  <td style={cellStyle("compra")} className="px-1.5 py-0.5">{editingMode ? <input type="text" inputMode="decimal" value={numericInputValue(item.id, "compra", item.compra)} onFocus={(e) => { openNumericDraft(item.id, "compra", item.compra); e.currentTarget.select(); }} onChange={(e) => updateNumericDraft(item.id, "compra", e.target.value)} onBlur={() => commitNumericDraft(item.id, "compra", item.compra)} onKeyDown={(e) => { if (e.key === "Enter") { commitNumericDraft(item.id, "compra", item.compra); (e.currentTarget as HTMLInputElement).blur(); } if (e.key === "Escape") { cancelNumericDraft(item.id, "compra"); (e.currentTarget as HTMLInputElement).blur(); } }} className={numericCellClassName()} /> : <span className={readCellClassName(true)}>{formatCurrencyNumber(item.compra)}</span>}</td>
                  <td style={cellStyle("precio_unitario")} className="px-1.5 py-0.5">
                    {editingMode ? <input type="text" inputMode="decimal" value={numericInputValue(item.id, "precio_unitario", item.precio_unitario)} onFocus={(e) => { openNumericDraft(item.id, "precio_unitario", item.precio_unitario); e.currentTarget.select(); }} onChange={(e) => updateNumericDraft(item.id, "precio_unitario", e.target.value)} onBlur={() => commitNumericDraft(item.id, "precio_unitario", item.precio_unitario, (v) => ({ precio_unitario: v, costo_unitario: v }))} onKeyDown={(e) => { if (e.key === "Enter") { commitNumericDraft(item.id, "precio_unitario", item.precio_unitario, (v) => ({ precio_unitario: v, costo_unitario: v })); (e.currentTarget as HTMLInputElement).blur(); } if (e.key === "Escape") { cancelNumericDraft(item.id, "precio_unitario"); (e.currentTarget as HTMLInputElement).blur(); } }} className={numericCellClassName()} /> : <span className={readCellClassName(true)}>{formatCurrencyNumber(item.precio_unitario)}</span>}
                  </td>
                  <td style={cellStyle("moneda")} className="px-1.5 py-0.5">
                    {editingMode ? <select value={item.moneda} onChange={(e) => onPatchRow(item.id, { moneda: e.target.value })} className={selectCellClassName()}>{currencyOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select> : <span className={readSelectCellClassName()}>{item.moneda}</span>}
                  </td>
                  <td style={cellStyle("tc")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={numericInputValue(item.id, "tc", item.tc)}
                        disabled={item.moneda === cotizacionMoneda}
                        onFocus={(e) => {
                          openNumericDraft(item.id, "tc", item.tc);
                          e.currentTarget.select();
                        }}
                        onChange={(e) => updateNumericDraft(item.id, "tc", e.target.value)}
                        onBlur={() => commitNumericDraft(item.id, "tc", item.tc)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            commitNumericDraft(item.id, "tc", item.tc);
                            (e.currentTarget as HTMLInputElement).blur();
                          }
                          if (e.key === "Escape") {
                            cancelNumericDraft(item.id, "tc");
                            (e.currentTarget as HTMLInputElement).blur();
                          }
                        }}
                        className={`${numericCellClassName()} ${item.moneda === cotizacionMoneda ? "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-500" : ""}`}
                      />
                    ) : (
                      <span className={readCellClassName(true)}>{formatCurrencyNumber(item.tc)}</span>
                    )}
                  </td>
                  <td style={cellStyle("factor_eq_herr")} className="px-1.5 py-0.5">{editingMode ? <input type="text" inputMode="decimal" value={numericInputValue(item.id, "factor_eq_herr", item.factor_eq_herr)} onFocus={(e) => { openNumericDraft(item.id, "factor_eq_herr", item.factor_eq_herr); e.currentTarget.select(); }} onChange={(e) => updateNumericDraft(item.id, "factor_eq_herr", e.target.value)} onBlur={() => commitNumericDraft(item.id, "factor_eq_herr", item.factor_eq_herr)} onKeyDown={(e) => { if (e.key === "Enter") { commitNumericDraft(item.id, "factor_eq_herr", item.factor_eq_herr); (e.currentTarget as HTMLInputElement).blur(); } if (e.key === "Escape") { cancelNumericDraft(item.id, "factor_eq_herr"); (e.currentTarget as HTMLInputElement).blur(); } }} className={numericCellClassName()} /> : <span className={readCellClassName(true)}>{formatCurrencyNumber(item.factor_eq_herr)}</span>}</td>
                  <td style={cellStyle("costo_total_presupuestado")} className="px-1.5 py-0.5"><span className={readCellClassName(true)}>{formatCurrencyNumber(item.costo_total_presupuestado)}</span></td>
                  <td style={cellStyle("fecha_coti")} className="px-1.5 py-0.5">{editingMode ? <DateTextInput value={item.fecha_coti} onChange={(value) => onPatchRow(item.id, { fecha_coti: value })} className={dateCellClassName()} /> : <span className={readDateCellClassName()}>{formatDate(item.fecha_coti) || "-"}</span>}</td>
                  <td style={cellStyle("estado")} className="px-1.5 py-0.5">
                    {editingMode ? <select value={item.estado} onChange={(e) => onPatchRow(item.id, { estado: e.target.value })} className={selectCellClassName()}>{statusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select> : <span className={readSelectCellClassName()}>{item.estado}</span>}
                  </td>
                  <td style={cellStyle("recurso_a_suministrar")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <ResourceAutocompleteCell
                        field="recurso_a_suministrar"
                        value={item.recurso_a_suministrar}
                        searchableResources={searchableResources}
                        onCommit={(value) => onPatchRow(item.id, { recurso_a_suministrar: value })}
                        onSelectResource={(resource) => onSelectRecurso(item.id, resource.id)}
                        className={cellClassName()}
                        dropdownClassName="absolute left-0 top-full z-[120] mt-1 max-h-40 w-[420px] overflow-y-auto rounded border border-border bg-white shadow-lg"
                        renderSuggestion={(resource) => resource.descripcion}
                      />
                    ) : (
                      <span className={readCellClassName()}>{item.recurso_a_suministrar || "-"}</span>
                    )}
                  </td>
                  <td style={cellStyle("ficha_tecnica_a_suministrar")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <div className="flex w-full items-center gap-1">
                        <label className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-stone-300 text-stone-500 hover:bg-stone-100" title="Subir archivo">
                          <MiniPlusIcon />
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              const files = Array.from(event.target.files ?? []);
                              if (files.length === 0) return;
                              const appended = [
                                ...item.ficha_tecnica_a_suministrar_files,
                                ...files.map((file) => buildLocalFileMeta(file)),
                              ];
                              onPatchRow(item.id, {
                                ficha_tecnica_a_suministrar_files: appended,
                                ficha_tecnica_a_suministrar: appended[0] ?? null,
                              });
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <div className="min-w-0 flex-1">
                          {renderFileRows(
                            "Ficha técnica a suministrar",
                            item.ficha_tecnica_a_suministrar_files,
                            (fileIndex) => {
                              const nextFiles = item.ficha_tecnica_a_suministrar_files.filter((_, idx) => idx !== fileIndex);
                              onPatchRow(item.id, {
                                ficha_tecnica_a_suministrar_files: nextFiles,
                                ficha_tecnica_a_suministrar: nextFiles[0] ?? null,
                              });
                            },
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex w-full items-center gap-1">
                        <span className="inline-flex h-5 w-5 shrink-0" aria-hidden />
                        <div className="min-w-0 flex-1">
                          {renderFileRows(
                            "Ficha técnica a suministrar",
                            item.ficha_tecnica_a_suministrar_files,
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                  <td style={cellStyle("proveedor")} className="px-1.5 py-0.5">
                    {editingMode ? <select value={item.proveedor} onChange={(e) => onPatchRow(item.id, { proveedor: e.target.value })} className={selectCellClassName()}>{providerOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select> : <span className={readSelectCellClassName()}>{item.proveedor}</span>}
                  </td>
                  <td style={cellStyle("condicion_pago")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <DraftTextCell value={item.condicion_pago} onCommit={(value) => onPatchRow(item.id, { condicion_pago: value })} className={cellClassName()} />
                    ) : (
                      <span className={readCellClassName()}>{item.condicion_pago || "-"}</span>
                    )}
                  </td>
                  <td style={cellStyle("tiempo_entrega")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <DraftTextCell value={item.tiempo_entrega} onCommit={(value) => onPatchRow(item.id, { tiempo_entrega: value })} className={cellClassName()} />
                    ) : (
                      <span className={readCellClassName()}>{item.tiempo_entrega || "-"}</span>
                    )}
                  </td>
                  <td style={cellStyle("eq")} className="px-1.5 py-0.5">{editingMode ? <select value={item.eq} onChange={(e) => onPatchRow(item.id, { eq: e.target.value })} className={selectCellClassName()}>{eqOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select> : <span className={readSelectCellClassName()}>{item.eq || "-"}</span>}</td>
                  <td style={cellStyle("eq_fecha_aprob")} className="px-1.5 py-0.5">{editingMode ? <DateTextInput value={item.eq_fecha_aprob} onChange={(value) => onPatchRow(item.id, { eq_fecha_aprob: value })} className={dateCellClassName()} /> : <span className={readDateCellClassName()}>{formatDate(item.eq_fecha_aprob) || "-"}</span>}</td>
                  <td style={cellStyle("ll")} className="px-1.5 py-0.5">{editingMode ? <select value={item.ll} onChange={(e) => onPatchRow(item.id, { ll: e.target.value })} className={selectCellClassName()}>{llOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select> : <span className={readSelectCellClassName()}>{item.ll || "-"}</span>}</td>
                  <td style={cellStyle("ll_fecha_aprob")} className="px-1.5 py-0.5">{editingMode ? <DateTextInput value={item.ll_fecha_aprob} onChange={(value) => onPatchRow(item.id, { ll_fecha_aprob: value })} className={dateCellClassName()} /> : <span className={readDateCellClassName()}>{formatDate(item.ll_fecha_aprob) || "-"}</span>}</td>
                  <td style={cellStyle("hb")} className="px-1.5 py-0.5">{editingMode ? <select value={item.hb} onChange={(e) => onPatchRow(item.id, { hb: e.target.value })} className={selectCellClassName()}>{hbOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select> : <span className={readSelectCellClassName()}>{item.hb || "-"}</span>}</td>
                  <td style={cellStyle("hb_fecha_aprob")} className="px-1.5 py-0.5">{editingMode ? <DateTextInput value={item.hb_fecha_aprob} onChange={(value) => onPatchRow(item.id, { hb_fecha_aprob: value })} className={dateCellClassName()} /> : <span className={readDateCellClassName()}>{formatDate(item.hb_fecha_aprob) || "-"}</span>}</td>
                  <td style={cellStyle("logistica_compra")} className="px-1.5 py-0.5">{editingMode ? <select value={item.logistica_compra} onChange={(e) => onPatchRow(item.id, { logistica_compra: e.target.value })} className={selectCellClassName()}>{logisticaCompraOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select> : <span className={readSelectCellClassName()}>{item.logistica_compra || "-"}</span>}</td>
                  <td style={cellStyle("fecha_compra")} className="px-1.5 py-0.5">{editingMode ? <DateTextInput value={item.fecha_compra} onChange={(value) => onPatchRow(item.id, { fecha_compra: value })} className={dateCellClassName()} /> : <span className={readDateCellClassName()}>{formatDate(item.fecha_compra) || "-"}</span>}</td>
                  <td style={cellStyle("oc_os_recurso")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <DraftTextCell value={item.oc_os_recurso} onCommit={(value) => onPatchRow(item.id, { oc_os_recurso: value })} className={cellClassName()} />
                    ) : (
                      <span className={readCellClassName()}>{item.oc_os_recurso || "-"}</span>
                    )}
                  </td>
                  <td style={cellStyle("fecha_entrega")} className="px-1.5 py-0.5">{editingMode ? <DateTextInput value={item.fecha_entrega} onChange={(value) => onPatchRow(item.id, { fecha_entrega: value })} className={dateCellClassName()} /> : <span className={readDateCellClassName()}>{formatDate(item.fecha_entrega) || "-"}</span>}</td>
                  <td style={cellStyle("guia_remision")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <DraftTextCell value={item.guia_remision} onCommit={(value) => onPatchRow(item.id, { guia_remision: value })} className={cellClassName()} />
                    ) : (
                      <span className={readCellClassName()}>{item.guia_remision || "-"}</span>
                    )}
                  </td>
                  <td style={cellStyle("archivo_guia")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <div className="flex w-full items-center gap-1">
                        <label className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-stone-300 text-stone-500 hover:bg-stone-100" title="Subir archivo">
                          <MiniPlusIcon />
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              const files = Array.from(event.target.files ?? []);
                              if (files.length === 0) return;
                              const appended = [...item.archivo_guia_files, ...files.map((file) => buildLocalFileMeta(file))];
                              onPatchRow(item.id, {
                                archivo_guia_files: appended,
                                archivo_guia: appended[0] ?? null,
                              });
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <div className="min-w-0 flex-1">
                          {renderFileRows(
                            "Archivo guía",
                            item.archivo_guia_files,
                            (fileIndex) => {
                              const nextFiles = item.archivo_guia_files.filter((_, idx) => idx !== fileIndex);
                              onPatchRow(item.id, {
                                archivo_guia_files: nextFiles,
                                archivo_guia: nextFiles[0] ?? null,
                              });
                            },
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex w-full items-center gap-1">
                        <span className="inline-flex h-5 w-5 shrink-0" aria-hidden />
                        <div className="min-w-0 flex-1">{renderFileRows("Archivo guía", item.archivo_guia_files)}</div>
                      </div>
                    )}
                  </td>
                  <td style={cellStyle("acciones")} className="px-1.5 py-0.5">
                    {editingMode ? (
                      <button onClick={() => requestRemoveRow(item.id)} className="rounded border border-stone-300 px-1.5 py-0.5 text-[10px] hover:bg-stone-100">
                        Del
                      </button>
                    ) : (
                      <span className="text-[10px] font-semibold text-stone-300">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FilePreviewModal
        open={!!preview}
        title={preview?.title ?? ""}
        files={preview?.files ?? []}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
