"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/sgp/auth/AuthContext";
import { DataTable, type DataTableViewState } from "@/components/sgp/DataTable";
import { QuotationWorkspaceModal } from "@/components/sgp/quotations/QuotationWorkspaceModal";
import { RequirementWorkspaceModal } from "@/components/sgp/RequirementWorkspaceModal";
import type { EditableRequirementItem } from "@/components/sgp/RequirementItemsGrid";
import { StatusBadge } from "@/components/sgp/StatusBadge";
import { getModulePermissions, type ModulePermissions } from "@/lib/sgp/modulePermissionsRepository";
import {
  demoData,
  type CatalogCodigoCliente,
  type CatalogCodigoUnidadTrabajo,
  type CatalogEstadoCotizacion,
  type CatalogSolicitanteCotizacion,
  type CatalogSolicitanteRq,
  type CatalogTipoServicio,
  type Cotizacion,
  type Recurso,
  type Requerimiento,
  type DetalleRequerimientoItem,
  type ResourceFileMeta,
} from "@/lib/sgp/demoData";
import { listCatalogMap, type CatalogKey, type CatalogRecord } from "@/lib/sgp/catalogsRepository";
import { normalizeCotizacionEconomicSummary } from "@/lib/sgp/quotationEconomics";
import { formatCurrencyNumber, formatDate, normalizeDateForStorage } from "@/lib/sgp/utils";
import { publishDataSourceSnapshot, debugDataSourceLoad, type AppDataSource } from "@/lib/sgp/dataSourceDiagnostics";
import {
  clearRequirementItemsCache,
  clearCoreAppDataCache,
  getFreshCoreAppDataCache,
  loadCoreAppData,
  loadRequirementItemsForRequirement,
  type ClientDataLoadReason,
} from "@/lib/sgp/clientDataCache";
import {
  createRequirementFromWonQuotationSupabase,
  deleteNewRequirementIfEmpty,
  updateRequirementSupabase,
} from "@/lib/sgp/requirementsRepository";
import { saveRequirementItemsForRequirement } from "@/lib/sgp/requirementItemsRepository";
import { createCotizacion, CreateCotizacionError, updateCotizacion, UpdateCotizacionError } from "@/lib/sgp/quotationsRepository";
import { listRecursosLookupOptions } from "@/lib/sgp/recursosRepository";
import {
  debugUiState,
  attachLifecycleDiagnostics,
  readSessionUiState,
  readUrlNumberParam,
  readUrlStringParam,
  updateUrlState,
  writeSessionUiState,
  type PersistedTableUiState,
} from "@/lib/sgp/uiStatePersistence";

const DEFAULT_PAGE_SIZE = 12;
const COTIZACIONES_UI_STATE_KEY = "opsia:cotizaciones:ui-state";
const COTIZACION_CODE_PREFIX = "COT-EKA";
const ROWS_PER_PAGE_OPTIONS = [12, 20, 40, 60, 80, 100] as const;
const categoricalBadgePalette = [
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
];

function uniqueSortedOptions(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

function rowsFromCatalog<T extends CatalogRecord>(
  catalogs: Partial<Record<CatalogKey, CatalogRecord[]>> | null,
  key: CatalogKey,
  fallback: T[],
): T[] {
  return (catalogs?.[key] as T[] | undefined) ?? fallback;
}

type CotizacionSensitivePermissionFlags = {
  can_view_margin: boolean;
  can_view_economic_support: boolean;
  can_delete_associated_requirements: boolean;
};

type CotizacionViewGroupPermissions = {
  quotation_main_table: boolean;
  quotation_general_data: boolean;
  quotation_economic_summary: boolean;
  quotation_related_requirements: boolean;
  quotation_documents: boolean;
  quotation_traceability: boolean;
  quotation_actions: boolean;
};

const DEFAULT_COTIZACION_VIEW_GROUPS: CotizacionViewGroupPermissions = {
  quotation_main_table: true,
  quotation_general_data: true,
  quotation_economic_summary: true,
  quotation_related_requirements: true,
  quotation_documents: true,
  quotation_traceability: true,
  quotation_actions: true,
};

const CONSERVATIVE_COTIZACION_VIEW_GROUPS: CotizacionViewGroupPermissions = {
  quotation_main_table: true,
  quotation_general_data: true,
  quotation_economic_summary: false,
  quotation_related_requirements: true,
  quotation_documents: false,
  quotation_traceability: false,
  quotation_actions: false,
};

const COTIZACION_BUSINESS_FIELD_ALIAS_MAP: Record<string, string[]> = {
  codigo: ["codigo"],
  proyecto: ["proyecto"],
  cliente: ["cliente"],
  unidad_trabajo: ["unidad_trabajo", "unidad_trabajo_nombre", "unidadTrabajo"],
  oc: ["oc", "oc_os_recurso", "cotizacionOc"],
  monto: ["monto", "total_rq", "costo", "precio_unitario", "costo_total_presupuestado"],
  moneda_cotizacion: ["moneda_cotizacion", "moneda"],
};

function normalizeBusinessFieldKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeTipoRecurso(value: string): string {
  return value.trim().toLowerCase();
}

function buildHiddenBusinessFields(options: {
  visibleColumns: Array<{ key: string }>;
  canViewPrices: boolean;
}): string[] {
  const visibleColumnKeys = new Set(options.visibleColumns.map((column) => normalizeBusinessFieldKey(String(column.key))));
  const hidden = new Set<string>();

  Object.keys(COTIZACION_BUSINESS_FIELD_ALIAS_MAP).forEach((businessFieldKey) => {
    const normalized = normalizeBusinessFieldKey(businessFieldKey);
    if (!visibleColumnKeys.has(normalized)) {
      hidden.add(normalized);
      COTIZACION_BUSINESS_FIELD_ALIAS_MAP[businessFieldKey].forEach((alias) => hidden.add(normalizeBusinessFieldKey(alias)));
    }
  });

  if (!options.canViewPrices) {
    hidden.add("monto");
    hidden.add("moneda_cotizacion");
    COTIZACION_BUSINESS_FIELD_ALIAS_MAP.monto.forEach((alias) => hidden.add(normalizeBusinessFieldKey(alias)));
    COTIZACION_BUSINESS_FIELD_ALIAS_MAP.moneda_cotizacion.forEach((alias) => hidden.add(normalizeBusinessFieldKey(alias)));
  }

  return Array.from(hidden);
}

function readCotizacionSensitivePermissions(metadata: Record<string, unknown> | undefined): CotizacionSensitivePermissionFlags {
  const fallback: CotizacionSensitivePermissionFlags = {
    can_view_margin: true,
    can_view_economic_support: true,
    can_delete_associated_requirements: false,
  };

  if (!metadata) return fallback;
  const moduleSensitivePermissions = metadata.module_sensitive_permissions;
  if (!moduleSensitivePermissions || typeof moduleSensitivePermissions !== "object" || Array.isArray(moduleSensitivePermissions)) {
    return fallback;
  }

  const cotizacionesPermissions = (moduleSensitivePermissions as Record<string, unknown>).cotizaciones;
  if (!cotizacionesPermissions || typeof cotizacionesPermissions !== "object" || Array.isArray(cotizacionesPermissions)) {
    return fallback;
  }

  const values = cotizacionesPermissions as Record<string, unknown>;

  return {
    can_view_margin: values.can_view_margin !== false,
    can_view_economic_support: values.can_view_economic_support !== false,
    can_delete_associated_requirements: values.can_delete_associated_requirements === true,
  };
}

function readCotizacionViewGroupPermissions(
  permissions: ModulePermissions | null,
  isElevatedUser: boolean,
): CotizacionViewGroupPermissions {
  if (!permissions) {
    return isElevatedUser ? DEFAULT_COTIZACION_VIEW_GROUPS : CONSERVATIVE_COTIZACION_VIEW_GROUPS;
  }

  const root = permissions.metadata?.module_view_groups;
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    return DEFAULT_COTIZACION_VIEW_GROUPS;
  }

  const cotizacionesGroups = (root as Record<string, unknown>).cotizaciones;
  if (!cotizacionesGroups || typeof cotizacionesGroups !== "object" || Array.isArray(cotizacionesGroups)) {
    return DEFAULT_COTIZACION_VIEW_GROUPS;
  }

  const values = cotizacionesGroups as Record<string, unknown>;
  return {
    quotation_main_table: values.quotation_main_table !== false,
    quotation_general_data: values.quotation_general_data !== false,
    quotation_economic_summary: values.quotation_economic_summary !== false,
    quotation_related_requirements: values.quotation_related_requirements !== false,
    quotation_documents: values.quotation_documents !== false,
    quotation_traceability: values.quotation_traceability !== false,
    quotation_actions: values.quotation_actions !== false,
  };
}

function safeUuid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Fallback for insecure contexts (HTTP over LAN) where randomUUID may throw.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function hashLabel(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function CategoricalBadge({ value }: { value: string }) {
  const safeValue = value?.trim() || "-";
  const style = categoricalBadgePalette[hashLabel(safeValue) % categoricalBadgePalette.length];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{safeValue}</span>;
}

function normalizeCotizacionDraft(row: Cotizacion): Cotizacion {
  const baseDate = row.fecha_registro || row.fecha_presentacion || row.fecha_invitacion || row.fecha_entrega;
  return {
    ...row,
    estado: row.estado || "Borrador",
    estado_propuesta: row.estado_propuesta || "Rev. Bases",
    solicitante: row.solicitante || demoData.listCatalogSolicitanteCotizacion()[0]?.nombre || "",
    responsable_tecnico: row.responsable_tecnico || row.responsable_economico || "",
    responsable_economico: row.responsable_economico || row.responsable_tecnico || "",
    fecha_registro: normalizeDateForStorage(baseDate),
    fecha_presentacion: normalizeDateForStorage(row.fecha_presentacion || baseDate),
    fecha_invitacion: normalizeDateForStorage(row.fecha_invitacion || baseDate),
    fecha_confirmacion: normalizeDateForStorage(row.fecha_confirmacion || row.fecha_invitacion || baseDate),
    fecha_visita_tecnica: normalizeDateForStorage(row.fecha_visita_tecnica || row.fecha_confirmacion || baseDate),
    fecha_consultas: normalizeDateForStorage(row.fecha_consultas || row.fecha_visita_tecnica || baseDate),
    fecha_abs_consultas: normalizeDateForStorage(row.fecha_abs_consultas || row.fecha_consultas || baseDate),
    fecha_entrega: normalizeDateForStorage(row.fecha_entrega || baseDate),
    fecha_entregada: normalizeDateForStorage(row.fecha_entregada || row.fecha_entrega || baseDate),
    fecha_oc: normalizeDateForStorage(row.fecha_oc || row.fecha_entregada || row.fecha_entrega || baseDate),
    resumen_economico: normalizeCotizacionEconomicSummary(row),
    tipo_servicio: row.tipo_servicio || demoData.listCatalogTipoServicio()[0]?.nombre || "Mantenimiento eléctrico",
    prioridad: row.prioridad || "Media",
    avance: Number.isFinite(row.avance) ? Number(Math.max(0, Math.min(100, row.avance)).toFixed(2)) : 0,
    observaciones: row.observaciones || "",
    flat_mensual: Boolean(row.flat_mensual),
    fecha_inicio_analisis: normalizeDateForStorage(row.fecha_inicio_analisis || ""),
    fecha_fin_analisis: normalizeDateForStorage(row.fecha_fin_analisis || ""),
    meses_analisis:
      typeof row.meses_analisis === "number" && Number.isFinite(row.meses_analisis) && row.meses_analisis > 0
        ? Math.round(row.meses_analisis)
        : null,
  };
}

function buildSupabaseQuotationModeMessage(canCreate: boolean): string {
  return canCreate
    ? "Origen de datos: Supabase. Creación y edición de cotizaciones disponibles según permisos."
    : "Origen de datos: Supabase. Edición disponible según permisos; creación requiere can_create.";
}

function buildNextCotizacionCode(rows: Cotizacion[], year = new Date().getFullYear()): string {
  const codePattern = new RegExp(`^${COTIZACION_CODE_PREFIX}-(\\d{4})-(\\d{3})$`, "i");
  const maxCorrelative = rows.reduce((max, row) => {
    const match = row.codigo.trim().match(codePattern);
    if (!match || Number(match[1]) !== year) return max;
    return Math.max(max, Number(match[2]));
  }, 0);

  return `${COTIZACION_CODE_PREFIX}-${year}-${String(maxCorrelative + 1).padStart(3, "0")}`;
}

function computeCurrencyTcAndTotal(
  row: Pick<EditableRequirementItem, "cant_stock" | "compra" | "precio_unitario" | "tc" | "moneda">,
  cotizacionMoneda: "PEN" | "USD",
): Pick<EditableRequirementItem, "tc" | "subtotal" | "costo_total_presupuestado" | "costo_unitario"> {
  const rowCurrency = (row.moneda || cotizacionMoneda) as "PEN" | "USD";
  const sameCurrency = rowCurrency === cotizacionMoneda;
  const safeTc = Number.isFinite(row.tc) && row.tc > 0 ? row.tc : 1;
  const tc = sameCurrency ? 1 : safeTc;
  const base = Math.max(0, (Number.isFinite(row.cant_stock) ? row.cant_stock : 0) + (Number.isFinite(row.compra) ? row.compra : 0));
  const precio = Math.max(0, Number.isFinite(row.precio_unitario) ? row.precio_unitario : 0);
  const baseAmount = base * precio;

  let costoTotalRaw = baseAmount;
  if (!sameCurrency) {
    if (cotizacionMoneda === "USD" && rowCurrency === "PEN") {
      costoTotalRaw = baseAmount / tc;
    } else {
      costoTotalRaw = baseAmount * tc;
    }
  }

  const costoTotal = Number(costoTotalRaw.toFixed(2));
  return {
    tc,
    subtotal: costoTotal,
    costo_total_presupuestado: costoTotal,
    costo_unitario: precio,
  };
}

function normalizeRequirementDates(row: Requerimiento): Requerimiento {
  return {
    ...row,
    fecha_solicitud: normalizeDateForStorage(row.fecha_solicitud),
    fecha_requerida: normalizeDateForStorage(row.fecha_requerida),
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatSupabaseSaveError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const values = error as Record<string, unknown>;
    const code = typeof values.code === "string" ? values.code : "";
    const message = typeof values.message === "string" ? values.message : "";
    const details = typeof values.details === "string" ? values.details : "";
    const hint = typeof values.hint === "string" ? values.hint : "";
    return [code, message, details, hint].filter(Boolean).join(" · ") || "Supabase rechazó el guardado.";
  }
  return "Revisa permisos de Supabase para requerimiento_items.";
}

function toEditableItem(
  item: DetalleRequerimientoItem,
  recurso: Recurso | undefined,
  cotizacionMoneda: "PEN" | "USD",
): EditableRequirementItem {
  const historicalSource = item.historical_item_source;
  const descripcion = recurso?.descripcion || historicalSource?.descripcion || "";
  const tipoRecurso = recurso?.tipo_recurso || historicalSource?.tipo_recurso || "";
  const codigoFabricante = recurso?.codigo_fabricante || historicalSource?.codigo_fabricante || "";
  const compra = historicalSource?.compra ?? item.compra;
  const base: EditableRequirementItem = {
    id: item.id,
    recurso_id: item.recurso_id,
    codigo_recurso: recurso?.codigo_recurso ?? "",
    codigo_fabricante: codigoFabricante,
    tipo_recurso: tipoRecurso,
    descripcion,
    recurso_ficha_tecnica:
      item.recurso_ficha_tecnica_files?.[0] ??
      recurso?.resourceFiles.fichasTecnicas?.[0] ??
      recurso?.resourceFiles.fichaTecnica ??
      null,
    recurso_ficha_tecnica_files: item.recurso_ficha_tecnica_files?.length
      ? item.recurso_ficha_tecnica_files
      : recurso?.resourceFiles.fichasTecnicas?.length
      ? recurso.resourceFiles.fichasTecnicas
      : recurso?.resourceFiles.fichaTecnica
        ? [recurso.resourceFiles.fichaTecnica]
        : [],
    recurso_imagen:
      item.recurso_imagen_files?.[0] ??
      recurso?.resourceFiles.imagenes?.[0] ??
      recurso?.resourceFiles.imagen ??
      null,
    recurso_imagen_files: item.recurso_imagen_files?.length
      ? item.recurso_imagen_files
      : recurso?.resourceFiles.imagenes?.length
      ? recurso.resourceFiles.imagenes
      : recurso?.resourceFiles.imagen
        ? [recurso.resourceFiles.imagen]
        : [],
    recurso_archivos: recurso?.resourceFiles.archivos ?? [],
    unidad: recurso?.unidad ?? historicalSource?.unidad ?? "",
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    moneda: item.moneda ?? recurso?.moneda ?? cotizacionMoneda,
    subtotal: item.subtotal || Number((item.cantidad * item.precio_unitario).toFixed(2)),
    proveedor: item.proveedor || recurso?.proveedor || "",
    marca: recurso?.marca ?? "",
    ajuste: item.ajuste,
    atencion_real: item.atencion_real,
    cant_stock: item.cant_stock,
    compra,
    costo_unitario: item.costo_unitario,
    tc: item.tc,
    factor_eq_herr: item.factor_eq_herr,
    costo_total_presupuestado: item.costo_total_presupuestado,
    fecha_coti: normalizeDateForStorage(item.fecha_coti),
    estado: item.estado,
    informacion_adicional: item.informacion_adicional ?? `${recurso?.marca ?? ""} ${recurso?.modelo ?? ""}`.trim(),
    observaciones_item: item.observaciones_item ?? recurso?.observaciones ?? "",
    recurso_a_suministrar: item.recurso_a_suministrar ?? recurso?.descripcion ?? item.a_suministrar ?? "",
    ficha_tecnica_a_suministrar:
      item.ficha_tecnica_a_suministrar ?? item.ficha_tecnica_suministrar ?? recurso?.resourceFiles.fichaTecnica ?? null,
    ficha_tecnica_a_suministrar_files:
      item.ficha_tecnica_a_suministrar_files?.length
        ? item.ficha_tecnica_a_suministrar_files
        : item.ficha_tecnica_a_suministrar
        ? [item.ficha_tecnica_a_suministrar]
        : item.ficha_tecnica_suministrar
          ? [item.ficha_tecnica_suministrar]
          : recurso?.resourceFiles.fichaTecnica
            ? [recurso.resourceFiles.fichaTecnica]
            : [],
    condicion_pago: item.condicion_pago,
    tiempo_entrega: item.tiempo_entrega,
    eq: item.eq,
    eq_fecha_aprob: normalizeDateForStorage(item.eq_fecha_aprob),
    ll: item.ll,
    ll_fecha_aprob: normalizeDateForStorage(item.ll_fecha_aprob),
    hb: item.hb,
    hb_fecha_aprob: normalizeDateForStorage(item.hb_fecha_aprob),
    logistica_compra: item.logistica_compra,
    fecha_compra: normalizeDateForStorage(item.fecha_compra),
    oc_os_recurso: item.oc_os_recurso,
    fecha_entrega: normalizeDateForStorage(item.fecha_entrega),
    guia_remision: item.guia_remision,
    archivo_guia: item.archivo_guia,
    archivo_guia_files: item.archivo_guia_files?.length ? item.archivo_guia_files : item.archivo_guia ? [item.archivo_guia] : [],
  };
  return { ...base, ...computeCurrencyTcAndTotal(base, cotizacionMoneda) };
}

function defaultRow(moneda: "PEN" | "USD"): EditableRequirementItem {
  const base: EditableRequirementItem = {
    id: `tmp-${safeUuid()}`,
    recurso_id: "",
    codigo_recurso: "",
    codigo_fabricante: "",
    tipo_recurso: "",
    descripcion: "",
    recurso_ficha_tecnica: null,
    recurso_ficha_tecnica_files: [],
    recurso_imagen: null,
    recurso_imagen_files: [],
    recurso_archivos: [],
    unidad: "",
    cantidad: 1,
    precio_unitario: 0,
    moneda,
    subtotal: 0,
    proveedor: "",
    marca: "",
    ajuste: 0,
    atencion_real: 0,
    cant_stock: 0,
    compra: 0,
    costo_unitario: 0,
    tc: 1,
    factor_eq_herr: 1,
    costo_total_presupuestado: 0,
    fecha_coti: "",
    estado: "Pendiente",
    informacion_adicional: "",
    observaciones_item: "",
    recurso_a_suministrar: "",
    ficha_tecnica_a_suministrar: null,
    ficha_tecnica_a_suministrar_files: [],
    condicion_pago: "",
    tiempo_entrega: "",
    eq: "Pendiente",
    eq_fecha_aprob: "",
    ll: "Pendiente",
    ll_fecha_aprob: "",
    hb: "Pendiente",
    hb_fecha_aprob: "",
    logistica_compra: "Pendiente compra",
    fecha_compra: "",
    oc_os_recurso: "",
    fecha_entrega: "",
    guia_remision: "",
    archivo_guia: null,
    archivo_guia_files: [],
  };
  return { ...base, ...computeCurrencyTcAndTotal(base, moneda) };
}

export default function CotizacionesPage() {
  const { profile, user } = useAuth();
  const initialUiStateRef = useRef<PersistedTableUiState | null>(null);
  const restoredUiStateRef = useRef(false);
  const restoredWorkspaceKeyRef = useRef<string | null>(null);
  const hasLoadedDataRef = useRef(false);
  if (initialUiStateRef.current === null) {
    initialUiStateRef.current = readSessionUiState<PersistedTableUiState>(COTIZACIONES_UI_STATE_KEY, {});
  }
  const initialUiState = initialUiStateRef.current;
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>([]);
  const [detalleItems, setDetalleItems] = useState<DetalleRequerimientoItem[]>([]);
  const [recursos, setRecursos] = useState<Recurso[]>(() => demoData.listRecursos());
  // Los recursos inactivos no se ofrecen para nuevas selecciones, pero se conserva la lista completa para historicos.
  const selectableRecursos = useMemo(() => recursos.filter((recurso) => recurso.estado !== "Inactivo"), [recursos]);
  const [modulePermissions, setModulePermissions] = useState<ModulePermissions | null>(null);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<AppDataSource>("demo");
  const [page, setPage] = useState(() => readUrlNumberParam("page") ?? initialUiState.page ?? 1);
  const [pageSize, setPageSize] = useState<number>(() => initialUiState.pageSize ?? DEFAULT_PAGE_SIZE);
  const [tableViewState, setTableViewState] = useState<DataTableViewState>(
    () => initialUiState.tableView ?? { columnFilters: {}, sortKey: null, sortDirection: null },
  );
  const [filteredRowsCount, setFilteredRowsCount] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Cotizacion | null>(null);
  const [isQuotationSaving, setIsQuotationSaving] = useState(false);
  const [requirementCreationError, setRequirementCreationError] = useState<string | null>(null);
  const [pendingNewQuotationConfirm, setPendingNewQuotationConfirm] = useState(false);
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [requirementDraft, setRequirementDraft] = useState<Requerimiento | null>(null);
  const [requirementItems, setRequirementItems] = useState<EditableRequirementItem[]>([]);
  const currentUserEmail = (profile.email ?? user.email ?? "").trim().toLowerCase();
  const [persistedCatalogs, setPersistedCatalogs] = useState<Partial<Record<CatalogKey, CatalogRecord[]>> | null>(null);

  useEffect(() => {
    debugUiState("cotizaciones", "mounted", {});
    const cleanupLifecycleDiagnostics = attachLifecycleDiagnostics("cotizaciones");
    return () => {
      debugUiState("cotizaciones", "unmounted", {});
      cleanupLifecycleDiagnostics();
    };
  }, []);

  useEffect(() => {
    let active = true;
    listCatalogMap()
      .then((result) => {
        if (!active) return;
        setPersistedCatalogs(result.catalogs);
        if (result.error) setWarning((prev) => prev ?? result.error ?? null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setWarning((prev) => prev ?? (error instanceof Error ? error.message : "No se pudieron cargar los catálogos desde Supabase."));
      });
    return () => {
      active = false;
    };
  }, []);

  const totalFilteredRows = filteredRowsCount ?? cotizaciones.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredRows / pageSize));
  const pageStartIndex = (page - 1) * pageSize;

  const clientOptions = useMemo(() => {
    const catalogClientes = rowsFromCatalog<CatalogCodigoCliente>(
      persistedCatalogs,
      "catalogCodigoClientes",
      demoData.listCatalogCodigoClientes(),
    );
    return uniqueSortedOptions([
      ...catalogClientes
        .filter((item) => item.activo !== false)
        .map((item) => item.cliente),
      ...cotizaciones.map((item) => item.cliente),
    ]);
  }, [cotizaciones, persistedCatalogs]);

  const unitOptions = useMemo(() => {
    const catalogUnidades = rowsFromCatalog<CatalogCodigoUnidadTrabajo>(
      persistedCatalogs,
      "catalogCodigoUnidadesTrabajo",
      demoData.listCatalogCodigoUnidadesTrabajo(),
    );
    return uniqueSortedOptions([
      ...catalogUnidades
        .filter((item) => item.activo !== false)
        .map((item) => item.unidad_trabajo),
      ...cotizaciones.map((item) => item.unidad_trabajo),
    ]);
  }, [cotizaciones, persistedCatalogs]);

  const serviceTypeOptions = useMemo(
    () => {
      const catalogTipoServicio = rowsFromCatalog<CatalogTipoServicio>(
        persistedCatalogs,
        "catalogTipoServicio",
        demoData.listCatalogTipoServicio(),
      );
      return uniqueSortedOptions(catalogTipoServicio.filter((item) => item.activo !== false).map((item) => item.nombre));
    },
    [persistedCatalogs],
  );
  const solicitanteOptions = useMemo(
    () => {
      const catalogSolicitantesCotizacion = rowsFromCatalog<CatalogSolicitanteCotizacion>(
        persistedCatalogs,
        "catalogSolicitanteCotizacion",
        demoData.listCatalogSolicitanteCotizacion(),
      );
      const catalogSolicitantesRq = rowsFromCatalog<CatalogSolicitanteRq>(
        persistedCatalogs,
        "catalogSolicitanteRq",
        demoData.listCatalogSolicitanteRq(),
      );
      return uniqueSortedOptions([
        ...catalogSolicitantesCotizacion.filter((item) => item.activo !== false).map((item) => item.nombre),
        ...catalogSolicitantesRq.filter((item) => item.activo !== false).map((item) => item.nombre),
        ...cotizaciones.map((item) => item.solicitante),
        currentUserEmail,
      ]);
    },
    [cotizaciones, currentUserEmail, persistedCatalogs],
  );
  const technicalResponsibleOptions = useMemo(() => {
    return uniqueSortedOptions([...cotizaciones.map((item) => item.responsable_tecnico), ...solicitanteOptions, currentUserEmail]);
  }, [cotizaciones, currentUserEmail, solicitanteOptions]);
  const economicResponsibleOptions = useMemo(() => {
    return uniqueSortedOptions([...cotizaciones.map((item) => item.responsable_economico), ...solicitanteOptions, currentUserEmail]);
  }, [cotizaciones, currentUserEmail, solicitanteOptions]);
  const estadoCotizacionOptions = useMemo<Array<Cotizacion["estado"]>>(
    () => {
      const catalogEstadosCotizacion = rowsFromCatalog<CatalogEstadoCotizacion>(
        persistedCatalogs,
        "catalogEstadoCotizacion",
        demoData.listCatalogEstadoCotizacion(),
      );
      return uniqueSortedOptions(catalogEstadosCotizacion.filter((item) => item.activo !== false).map((item) => item.nombre)) as Array<Cotizacion["estado"]>;
    },
    [persistedCatalogs],
  );
  const proposalStatusOptions = useMemo(() => {
    const defaults = ["Rev. Bases", "Visita Técnica"];
    const dynamic = cotizaciones.map((item) => item.estado_propuesta).filter(Boolean);
    return Array.from(new Set([...defaults, ...dynamic]));
  }, [cotizaciones]);
  const requirementResourceTypeCatalog = useMemo(
    () => demoData.listCatalogTipoRecurso().map((item) => item.nombre),
    [],
  );

  useEffect(() => {
    let active = true;
    setIsPermissionsLoading(true);
    if (!currentUserEmail) {
      setModulePermissions(null);
      setIsPermissionsLoading(false);
      return () => {
        active = false;
      };
    }

    getModulePermissions("cotizaciones", currentUserEmail)
      .then((permissions) => {
        if (!active) return;
        if (process.env.NODE_ENV === "development") {
          console.log("[cotizaciones] email autenticado:", currentUserEmail);
          console.log("[cotizaciones] permisos recibidos:", permissions);
        }
        setModulePermissions(permissions);
      })
      .catch(() => {
        if (!active) return;
        setModulePermissions(null);
      })
      .finally(() => {
        if (!active) return;
        setIsPermissionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUserEmail]);

  async function refreshCotizacionesData() {
    setIsDataLoading(true);
    debugUiState("cotizaciones", "manual-refresh-start", {});
    try {
      const [result, recursosResult] = await Promise.all([
        loadCoreAppData({ module: "cotizaciones", reason: "manual-refresh", forceRefresh: true }),
        listRecursosLookupOptions(),
      ]);
      const { cotizaciones: cotizacionesResult, requerimientos: requerimientosResult } = result;
      setCotizaciones(cotizacionesResult.rows.map(normalizeCotizacionDraft));
      setFilteredRowsCount(cotizacionesResult.rows.length);
      setRequerimientos(requerimientosResult.rows);
      setRecursos(recursosResult.rows);
      setDetalleItems([]);
      setDataSource(result.source);
      const sourceMessage =
        result.source === "supabase"
          ? "Origen de datos: Supabase. Edición disponible según permisos; creación requiere can_create."
          : result.warning;
      setWarning(
        recursosResult.warning ? [sourceMessage, recursosResult.warning].filter(Boolean).join(" ") : sourceMessage,
      );
      debugUiState("cotizaciones", "manual-refresh-end", {
        cacheStatus: result.cacheStatus,
        cotizaciones: cotizacionesResult.rows.length,
        requerimientos: requerimientosResult.rows.length,
      });
    } finally {
      setIsDataLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const cached = getFreshCoreAppDataCache();
    const reason: ClientDataLoadReason = hasLoadedDataRef.current ? "auth-change" : cached ? "cache-hydration" : "initial-load";
    hasLoadedDataRef.current = true;
    setIsDataLoading(!cached);
    debugUiState("cotizaciones", "fetch-start", { reason, cacheAvailable: Boolean(cached) });

    Promise.all([loadCoreAppData({ module: "cotizaciones", reason }), listRecursosLookupOptions()])
      .then(([result, recursosResult]) => {
        if (!active) return;

        const { cotizaciones: cotizacionesResult, requerimientos: requerimientosResult } = result;
        const source = result.source;
        const warningMessage = result.warning;

        setCotizaciones(cotizacionesResult.rows.map(normalizeCotizacionDraft));
        setFilteredRowsCount(cotizacionesResult.rows.length);
        setRequerimientos(requerimientosResult.rows);
        setRecursos(recursosResult.rows);
        setDataSource(source);
        const sourceMessage =
          source === "supabase"
            ? "Origen de datos: Supabase. Edición disponible según permisos; creación requiere can_create."
            : warningMessage;
        setWarning(
          recursosResult.warning ? [sourceMessage, recursosResult.warning].filter(Boolean).join(" ") : sourceMessage
        );
        publishDataSourceSnapshot({
          module: "cotizaciones",
          source,
          count: cotizacionesResult.rows.length,
          warning: warningMessage ?? undefined,
          userEmail: currentUserEmail || undefined,
        });
        debugDataSourceLoad({
          module: "cotizaciones",
          source,
          count: cotizacionesResult.rows.length,
          warning: warningMessage ?? undefined,
          userEmail: currentUserEmail || undefined,
          errorMessage: result.cacheStatus === "miss" ? undefined : `cache:${result.cacheStatus}`,
        });
        debugUiState("cotizaciones", "fetch-end", {
          reason: result.reason,
          cacheStatus: result.cacheStatus,
          source,
          cotizaciones: cotizacionesResult.rows.length,
          requerimientos: requerimientosResult.rows.length,
          detalleItems: "lazy",
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const fallbackCotizaciones = demoData.listCotizaciones().map(normalizeCotizacionDraft);
        const fallbackRequerimientos = demoData.listRequerimientos();
        const fallbackItems = demoData.listDetalleItems();
        const fallbackMessage =
          error instanceof Error
            ? `No se pudo cargar cotizaciones desde Supabase: ${error.message}. Se usa data demo local.`
            : "No se pudo cargar cotizaciones desde Supabase. Se usa data demo local.";

        setCotizaciones(fallbackCotizaciones);
        setFilteredRowsCount(fallbackCotizaciones.length);
        setRequerimientos(fallbackRequerimientos);
        setDetalleItems(fallbackItems);
        setDataSource("demo");
        setWarning(fallbackMessage);
        publishDataSourceSnapshot({
          module: "cotizaciones",
          source: "demo",
          count: fallbackCotizaciones.length,
          warning: fallbackMessage,
          userEmail: currentUserEmail || undefined,
        });
        debugDataSourceLoad({
          module: "cotizaciones",
          source: "demo",
          count: fallbackCotizaciones.length,
          warning: fallbackMessage,
          userEmail: currentUserEmail || undefined,
          errorMessage: error instanceof Error ? error.message : "sin detalle",
        });
      })
      .finally(() => {
        if (active) setIsDataLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUserEmail]);

  const cotizacionesColumns = useMemo(
    () => [
      { key: "codigo", title: "Cotización" },
      { key: "proyecto", title: "Proyecto" },
      { key: "tipo_servicio", title: "Tipo de servicio", render: (row: Cotizacion) => <CategoricalBadge value={row.tipo_servicio} /> },
      { key: "estado_propuesta", title: "Estado propuesta", render: (row: Cotizacion) => <CategoricalBadge value={row.estado_propuesta} /> },
      { key: "cliente", title: "Cliente" },
      { key: "unidad_trabajo", title: "Unidad de Trabajo" },
      { key: "solicitante", title: "Solicitante" },
      { key: "prioridad", title: "Prioridad" },
      { key: "responsable_tecnico", title: "Resp. Técnico" },
      { key: "responsable_economico", title: "Resp. Económico" },
      { key: "avance", title: "Avance", align: "right" as const, render: (row: Cotizacion) => `${Number(row.avance ?? 0).toFixed(2)}%` },
      { key: "fecha_registro", title: "Fecha registro", render: (row: Cotizacion) => formatDate(row.fecha_registro) || "-" },
      { key: "fecha_invitacion", title: "Fecha invitación", render: (row: Cotizacion) => formatDate(row.fecha_invitacion) || "-" },
      { key: "fecha_confirmacion", title: "Fecha confirmación", render: (row: Cotizacion) => formatDate(row.fecha_confirmacion) || "-" },
      { key: "fecha_visita_tecnica", title: "Fecha visita téc.", render: (row: Cotizacion) => formatDate(row.fecha_visita_tecnica) || "-" },
      { key: "fecha_consultas", title: "Fecha consultas", render: (row: Cotizacion) => formatDate(row.fecha_consultas) || "-" },
      { key: "fecha_abs_consultas", title: "Fecha abs. consultas", render: (row: Cotizacion) => formatDate(row.fecha_abs_consultas) || "-" },
      { key: "fecha_entrega", title: "Fecha entrega", render: (row: Cotizacion) => formatDate(row.fecha_entrega) || "-" },
      { key: "fecha_entregada", title: "Fecha entregada", render: (row: Cotizacion) => formatDate(row.fecha_entregada) || "-" },
      {
        key: "monto",
        title: "Monto",
        align: "right" as const,
        render: (row: Cotizacion) => `${row.moneda_cotizacion} ${formatCurrencyNumber(row.monto)}`,
      },
      { key: "moneda_cotizacion", title: "Moneda" },
      { key: "estado", title: "Estado oferta", render: (row: Cotizacion) => <StatusBadge status={row.estado} /> },
      { key: "oc", title: "OC" },
    ],
    [],
  );

  const isElevatedQuotationUser =
    profile?.is_super_admin === true || profile?.role === "admin" || currentUserEmail === "edwin.qm@outlook.com";
  const effectiveCanView = modulePermissions?.can_view ?? true;
  const effectiveCanViewPrices = modulePermissions?.can_view_prices ?? isElevatedQuotationUser;
  const effectiveCanViewSupplier = modulePermissions?.can_view_supplier ?? isElevatedQuotationUser;
  const effectiveSensitiveFlags = readCotizacionSensitivePermissions(modulePermissions?.metadata);
  const viewGroupPermissions = useMemo(
    () => readCotizacionViewGroupPermissions(modulePermissions, isElevatedQuotationUser),
    [isElevatedQuotationUser, modulePermissions],
  );
  const canViewQuotationMainTable = viewGroupPermissions.quotation_main_table;
  const canViewQuotationEconomicSummary = viewGroupPermissions.quotation_economic_summary;
  const canViewQuotationRelatedRequirements = viewGroupPermissions.quotation_related_requirements;
  // In demo mode there are no real permission restrictions — always allow actions so
  // the "Nueva cotización" button renders for all users.
  const canViewQuotationActions = dataSource === "demo" ? true : viewGroupPermissions.quotation_actions;
  const canOpenRequirementsFromQuotation = canViewQuotationRelatedRequirements;
  const canDeleteAssociatedRequirements =
    canViewQuotationActions &&
    canOpenRequirementsFromQuotation &&
    (effectiveSensitiveFlags.can_delete_associated_requirements || isElevatedQuotationUser);

  const visibleCotizacionesColumns = useMemo(() => {
    const afterSensitiveRestrictions = cotizacionesColumns.filter((column) => {
      if (!effectiveCanViewPrices && (column.key === "monto" || column.key === "moneda_cotizacion")) {
        return false;
      }
      if (!effectiveCanViewSupplier && column.key === "proveedor") {
        return false;
      }
      if (!effectiveSensitiveFlags.can_view_margin && column.key === "margen") {
        return false;
      }
      if (!effectiveSensitiveFlags.can_view_economic_support && column.key === "sustento_economico") {
        return false;
      }
      return true;
    });

    const allowedColumns = new Set(modulePermissions?.visible_columns ?? []);
    if (allowedColumns.size === 0) {
      return afterSensitiveRestrictions;
    }

    return afterSensitiveRestrictions.filter((column) => allowedColumns.has(String(column.key)));
  }, [
    cotizacionesColumns,
    effectiveCanViewPrices,
    effectiveCanViewSupplier,
    effectiveSensitiveFlags.can_view_economic_support,
    effectiveSensitiveFlags.can_view_margin,
    modulePermissions?.visible_columns,
  ]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.log(
      "[cotizaciones] columnas visibles finales:",
      visibleCotizacionesColumns.map((column) => String(column.key)),
    );
    console.log("[cotizaciones] grupos visibles finales:", viewGroupPermissions);
  }, [viewGroupPermissions, visibleCotizacionesColumns]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    const hasPendingRestore =
      !restoredUiStateRef.current &&
      Boolean(
        readUrlStringParam("quotationCode") ||
          readUrlStringParam("rqCode") ||
          initialUiState.quotationCode ||
          initialUiState.rqCode,
      );
    if (hasPendingRestore) return;

    const snapshot: PersistedTableUiState = {
      page,
      pageSize,
      tableView: tableViewState,
      quotationCode: draft?.codigo ?? null,
      rqCode: requirementDraft?.codigo ?? null,
    };
    writeSessionUiState(COTIZACIONES_UI_STATE_KEY, snapshot);
    updateUrlState({
      page,
      quotationCode: snapshot.quotationCode,
      rqCode: snapshot.rqCode,
    });
    debugUiState("cotizaciones", "saved", {
      page,
      pageSize,
      quotationCode: snapshot.quotationCode,
      rqCode: snapshot.rqCode,
      filters: Object.keys(tableViewState.columnFilters).filter((key) => tableViewState.columnFilters[key]?.trim()),
    });
  }, [
    draft?.codigo,
    initialUiState.quotationCode,
    initialUiState.rqCode,
    page,
    pageSize,
    requirementDraft?.codigo,
    tableViewState,
  ]);

  useEffect(() => {
    if (isDataLoading) return;
    const quotationCode = readUrlStringParam("quotationCode") ?? initialUiState.quotationCode ?? null;
    const rqCode = readUrlStringParam("rqCode") ?? initialUiState.rqCode ?? null;

    if (!quotationCode && !rqCode) {
      restoredUiStateRef.current = true;
      return;
    }

    const normalizedQCode = quotationCode?.trim().toLowerCase() ?? null;
    const normalizedRqCode = rqCode?.trim().toLowerCase() ?? null;
    const currentKey = `${normalizedQCode ?? ""}|${normalizedRqCode ?? ""}`;

    if (restoredWorkspaceKeyRef.current === currentKey) return;

    let quotation: Cotizacion | null = null;
    if (normalizedQCode) {
      quotation = cotizaciones.find((item) => item.codigo.trim().toLowerCase() === normalizedQCode) ?? null;
      if (!quotation) {
        debugUiState("cotizaciones", "restore-pending", { quotationCode, rqCode, reason: "quotation-not-found" });
        return;
      }
    }

    let requirement: Requerimiento | null = null;
    if (normalizedRqCode) {
      requirement =
        requerimientos.find(
          (item) =>
            item.codigo.trim().toLowerCase() === normalizedRqCode ||
            item.id.trim().toLowerCase() === normalizedRqCode,
        ) ?? null;
      if (!requirement) {
        debugUiState("cotizaciones", "restore-pending", { quotationCode, rqCode, reason: "requirement-not-found" });
        return;
      }
    }

    if (quotation) {
      const normalizedQuotation = normalizeCotizacionDraft(quotation);
      setEditingId(quotation.id);
      setDraft(normalizedQuotation);
      setRequirementCreationError(null);
      const relatedIds = requerimientos
        .filter((item) => item.cotizacion_id === normalizedQuotation.id || item.cotizacion_codigo === normalizedQuotation.codigo)
        .map((item) => item.id);
      void Promise.all(
        relatedIds.map((requirementId) =>
          loadRequirementItemsForRequirement({ module: "cotizaciones", requirementId, reason: "cache-hydration" }),
        ),
      ).then((results) => {
        setDetalleItems((prev) => {
          const loadedIds = new Set(relatedIds);
          const withoutLoaded = prev.filter((item) => !loadedIds.has(item.requerimiento_id));
          return [...withoutLoaded, ...results.flatMap((result) => result.rows)];
        });
      });
    }

    if (requirement) {
      setSelectedRequirementId(requirement.id);
      const normalizedRequirement = normalizeRequirementDates(requirement);
      setRequirementDraft({ ...normalizedRequirement });
      const quote = quotation ?? cotizaciones.find((item) => item.id === normalizedRequirement.cotizacion_id);
      const quoteCurrency = quote?.moneda_cotizacion ?? "PEN";
      void loadRequirementItemsForRequirement({
        module: "cotizaciones",
        requirementId: normalizedRequirement.id,
        reason: "cache-hydration",
      }).then((result) => {
        setDetalleItems((prev) => {
          const withoutCurrent = prev.filter((item) => item.requerimiento_id !== normalizedRequirement.id);
          return [...withoutCurrent, ...result.rows];
        });
        const list = result.rows.map((item) =>
          toEditableItem(item, recursos.find((recurso) => recurso.id === item.recurso_id), quoteCurrency),
        );
        setRequirementItems(list);
      });
    }

    restoredWorkspaceKeyRef.current = currentKey;
    restoredUiStateRef.current = true;
    debugUiState("cotizaciones", "restored", {
      quotationCode,
      quotationFound: Boolean(quotation),
      rqCode,
      rqFound: Boolean(requirement),
    });
  }, [
    cotizaciones,
    initialUiState.quotationCode,
    initialUiState.rqCode,
    isDataLoading,
    recursos,
    requerimientos,
  ]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    console.debug("[cotizaciones] diagnostico tabla", {
      rawCount: cotizaciones.length,
      filteredCount: totalFilteredRows,
      page,
      source: dataSource,
    });
  }, [cotizaciones.length, dataSource, page, totalFilteredRows]);

  const hiddenBusinessFields = useMemo(
    () =>
      buildHiddenBusinessFields({
        visibleColumns: visibleCotizacionesColumns.map((column) => ({ key: String(column.key) })),
        canViewPrices: effectiveCanViewPrices,
      }),
    [visibleCotizacionesColumns, effectiveCanViewPrices],
  );

  const permissionsReady = !isPermissionsLoading;
  const isSupabaseReadOnly = dataSource === "supabase";
  const canCreateQuotationByPermission = modulePermissions?.can_create === true;
  const canEditQuotationByPermission = modulePermissions?.can_edit === true || isElevatedQuotationUser;
  const canUploadQuotationDocumentsByPermission =
    modulePermissions?.can_upload_files === true || canEditQuotationByPermission || canCreateQuotationByPermission;
  const canCreateSupabaseQuotation =
    dataSource === "supabase" && permissionsReady && !isDataLoading && canCreateQuotationByPermission;
  const canEditQuotationInCurrentSource =
    dataSource === "demo" || (dataSource === "supabase" && permissionsReady && !isDataLoading && canEditQuotationByPermission);
  const canUploadQuotationDocumentsInCurrentSource =
    dataSource === "demo" ||
    (dataSource === "supabase" && permissionsReady && !isDataLoading && canUploadQuotationDocumentsByPermission);
  const canCreateQuotationInCurrentSource = dataSource === "demo" || canCreateSupabaseQuotation;
  const canSaveCurrentQuotation = editingId ? canEditQuotationInCurrentSource : canCreateQuotationInCurrentSource;
  const canViewQuotationTable = effectiveCanView && canViewQuotationMainTable;

  useEffect(() => {
    if (dataSource !== "supabase" || isDataLoading || !permissionsReady) return;
    setWarning(buildSupabaseQuotationModeMessage(canCreateSupabaseQuotation));
  }, [canCreateSupabaseQuotation, dataSource, isDataLoading, permissionsReady]);

  const selectedRequirement = selectedRequirementId
    ? requerimientos.find((item) => item.id === selectedRequirementId) ?? null
    : null;
  const selectedRequirementCotizacion = selectedRequirement
    ? cotizaciones.find((item) => item.id === selectedRequirement.cotizacion_id) ?? null
    : null;
  const requirementCotizacionMoneda = selectedRequirementCotizacion?.moneda_cotizacion ?? "PEN";

  function buildBlankQuotationDraft(): Cotizacion {
    const seed = demoData.nextCotizacionDraft();
    return {
      ...seed,
      codigo: dataSource === "supabase" ? buildNextCotizacionCode(cotizaciones) : seed.codigo,
      oc: "",
      cliente: "",
      proyecto: "",
      unidad_trabajo: "",
      estado_propuesta: "",
      solicitante: "",
      responsable_tecnico: "",
      responsable_economico: "",
      fecha_registro: "",
      fecha_presentacion: "",
      fecha_invitacion: "",
      fecha_confirmacion: "",
      fecha_visita_tecnica: "",
      fecha_consultas: "",
      fecha_abs_consultas: "",
      fecha_entrega: "",
      fecha_entregada: "",
      fecha_oc: "",
      tipo_servicio: "",
      prioridad: "" as Cotizacion["prioridad"],
      estado: "Borrador",
      avance: 0,
      monto: 0,
      observaciones: "",
      flat_mensual: false,
      fecha_inicio_analisis: "",
      fecha_fin_analisis: "",
      meses_analisis: null,
    };
  }

  function openNewQuotation() {
    if (!canCreateQuotationInCurrentSource) {
      setWarning(
        dataSource === "supabase"
          ? "No tienes permiso can_create para crear cotizaciones en Supabase."
          : "No se puede crear una cotización en el estado actual de la vista.",
      );
      return;
    }
    const next = buildBlankQuotationDraft();
    setEditingId(null);
    setDraft(next);
    setRequirementCreationError(null);
  }

  function persistWorkspaceState(next: Partial<PersistedTableUiState>) {
    const snapshot: PersistedTableUiState = {
      page,
      pageSize,
      tableView: tableViewState,
      quotationCode: draft?.codigo ?? null,
      rqCode: requirementDraft?.codigo ?? null,
      ...next,
    };
    writeSessionUiState(COTIZACIONES_UI_STATE_KEY, snapshot);
    updateUrlState({
      page: snapshot.page,
      quotationCode: snapshot.quotationCode,
      rqCode: snapshot.rqCode,
    });
    debugUiState("cotizaciones", "workspace-updated", {
      quotationCode: snapshot.quotationCode,
      rqCode: snapshot.rqCode,
    });
  }

  function openEditQuotation(row: Cotizacion, options: { persist?: boolean } = {}) {
    const normalized = normalizeCotizacionDraft(row);
    setEditingId(row.id);
    setDraft(normalized);
    setRequirementCreationError(null);
    void loadItemsForQuotation(normalized, "workspace-open");
    if (options.persist !== false) {
      persistWorkspaceState({ quotationCode: normalized.codigo, rqCode: null });
    }
  }

  function updateDraft(patch: Partial<Cotizacion>) {
    setDraft((prev) => (prev ? normalizeCotizacionDraft({ ...prev, ...patch }) : prev));
  }

  function updateEconomicRow(
    tipo_recurso: string,
    patch: Partial<{ base: number; oferta: number; margen_ofertado_manual: number | null }>,
  ) {
    setDraft((prev) => {
      if (!prev) return prev;
      const summary = normalizeCotizacionEconomicSummary(prev).map((row) =>
        row.tipo_recurso === tipo_recurso ? { ...row, ...patch } : row,
      );
      return { ...prev, resumen_economico: summary };
    });
  }

  function closeModal() {
    setEditingId(null);
    setDraft(null);
    setRequirementCreationError(null);
    persistWorkspaceState({ quotationCode: null, rqCode: null });
  }

  async function saveDraft(finalPatch: Partial<Cotizacion> = {}): Promise<Cotizacion | false> {
    if (!draft) return false;
    if (isQuotationSaving) return false;
    const normalized = normalizeCotizacionDraft({ ...draft, ...finalPatch });

    setIsQuotationSaving(true);

    try {
      if (process.env.NODE_ENV === "development") {
        console.debug("[cotizaciones] saveDraft ejecutado", {
          dataSource,
          editingId,
          codigo: normalized.codigo,
          finalPatch,
          canEditQuotationInCurrentSource,
          canCreateSupabaseQuotation,
        });
      }

      if (dataSource === "supabase" && editingId) {
        if (!canEditQuotationInCurrentSource) {
          if (canUploadQuotationDocumentsInCurrentSource && Object.keys(finalPatch).length === 0) {
            setWarning("Cotización sin cambios. Se guardará únicamente la documentación pendiente.");
            return normalized;
          }
          setWarning("No tienes permiso para editar esta cotización.");
          return false;
        }

        if (!normalized.codigo.trim() || !normalized.proyecto.trim()) {
          setWarning("Completa código y proyecto antes de guardar la cotización.");
          return false;
        }

        if (process.env.NODE_ENV === "development") {
          console.debug("[cotizaciones] guardando cotizacion en Supabase", {
            id: editingId,
            codigo: normalized.codigo,
            proyecto: normalized.proyecto,
            cliente: normalized.cliente,
            unidad_trabajo: normalized.unidad_trabajo,
            estado: normalized.estado,
            estado_propuesta: normalized.estado_propuesta,
            prioridad: normalized.prioridad,
            oc: normalized.oc,
            monto: normalized.monto,
            avance: normalized.avance,
          });
        }

        try {
          const updated = normalizeCotizacionDraft(await updateCotizacion(editingId, normalized, { userEmail: currentUserEmail }));
          clearCoreAppDataCache();
          setCotizaciones((prev) => prev.map((row) => (row.id === editingId ? updated : row)));
          setDraft(updated);
          persistWorkspaceState({ quotationCode: updated.codigo, rqCode: null });
          setWarning("Cotización guardada correctamente.");
          if (process.env.NODE_ENV === "development") {
            console.debug("[cotizaciones] cotizacion guardada en Supabase", {
              id: updated.id,
              codigo: updated.codigo,
            });
          }
          return updated;
        } catch (error) {
          const errorSummary =
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  rawKeys: Object.keys(error),
                }
              : {
                  message: String(error),
                  rawKeys: error && typeof error === "object" ? Object.keys(error) : [],
                };
          if (process.env.NODE_ENV === "development") {
            console.error("[cotizaciones] error guardando cotizacion en Supabase", {
              id: editingId,
              codigo: normalized.codigo,
              error: errorSummary,
            });
          }
          setWarning(
            error instanceof UpdateCotizacionError
              ? error.message
              : error instanceof Error
                ? `No se pudo guardar la cotización. ${error.message}`
                : "No se pudo guardar la cotización. Revisa tu conexión o permisos.",
          );
          return false;
        }
      }

      if (dataSource === "supabase") {
        if (!canCreateSupabaseQuotation) {
          setWarning("No tienes permiso can_create para crear cotizaciones en Supabase.");
          return false;
        }

        if (!normalized.codigo.trim() || !normalized.proyecto.trim()) {
          setWarning("Completa código y proyecto antes de crear la cotización.");
          return false;
        }

        try {
          const created = normalizeCotizacionDraft(
            await createCotizacion(
              {
                ...normalized,
                estado: "Borrador",
              },
              { userEmail: currentUserEmail },
            ),
          );
          clearCoreAppDataCache();
          setCotizaciones((prev) => [created, ...prev.filter((row) => row.id !== created.id)]);
          setFilteredRowsCount(null);
          setPage(1);
          setEditingId(created.id);
          setDraft(created);
          persistWorkspaceState({ page: 1, quotationCode: created.codigo, rqCode: null });
          setWarning(`Cotización ${created.codigo} creada en Supabase como Borrador.`);
          return created;
        } catch (error) {
          if (error instanceof CreateCotizacionError) {
            setWarning(error.message);
          } else {
            setWarning(error instanceof Error ? `No se pudo crear la cotización: ${error.message}` : "No se pudo crear la cotización.");
          }
          return false;
        }
      }

      if (editingId) {
        demoData.updateCotizacion(editingId, normalized);
        setCotizaciones((prev) => prev.map((row) => (row.id === editingId ? normalized : row)));
        setWarning("Cotización guardada correctamente en datos demo/locales. No se actualizó Supabase.");
      } else {
        demoData.createCotizacion(normalized);
        setCotizaciones((prev) => [normalized, ...prev]);
        setPage(1);
        setEditingId(normalized.id);
        setWarning("Cotización guardada correctamente en datos demo/locales. No se actualizó Supabase.");
      }
      setDraft(normalized);
      return normalized;
    } finally {
      setIsQuotationSaving(false);
    }
  }

  async function loadItemsForRequirement(requirementId: string, reason: ClientDataLoadReason = "workspace-open") {
    const result = await loadRequirementItemsForRequirement({
      module: "cotizaciones",
      requirementId,
      reason,
    });
    setDetalleItems((prev) => {
      const withoutCurrent = prev.filter((item) => item.requerimiento_id !== requirementId);
      return [...withoutCurrent, ...result.rows];
    });
    debugUiState("cotizaciones", "rq-items-loaded", {
      requirementId,
      count: result.rows.length,
      cacheStatus: result.cacheStatus,
      reason: result.reason,
    });
    return result.rows;
  }

  async function loadItemsForQuotation(row: Cotizacion, reason: ClientDataLoadReason = "workspace-open") {
    const relatedIds = requerimientos
      .filter((item) => item.cotizacion_id === row.id || item.cotizacion_codigo === row.codigo)
      .map((item) => item.id);
    if (relatedIds.length === 0) return;
    await Promise.all(relatedIds.map((requirementId) => loadItemsForRequirement(requirementId, reason)));
  }

  async function openRequirementOverlay(requirementId: string, options: { persist?: boolean } = {}) {
    const requirement = requerimientos.find((item) => item.id === requirementId);
    if (!requirement) return;
    setSelectedRequirementId(requirement.id);
    const normalized = normalizeRequirementDates(requirement);
    setRequirementDraft({ ...normalized });
    const quote = cotizaciones.find((item) => item.id === normalized.cotizacion_id);
    const quoteCurrency = quote?.moneda_cotizacion ?? "PEN";
    const loadedItems = await loadItemsForRequirement(normalized.id, "workspace-open");
    const list = loadedItems
      .map((item) => toEditableItem(item, recursos.find((recurso) => recurso.id === item.recurso_id), quoteCurrency));
    setRequirementItems(list);
    if (options.persist !== false) {
      const quoteCode = quote?.codigo ?? draft?.codigo ?? null;
      persistWorkspaceState({ quotationCode: quoteCode, rqCode: normalized.codigo });
    }
  }

  function closeRequirementOverlay() {
    setSelectedRequirementId(null);
    setRequirementDraft(null);
    setRequirementItems([]);
    persistWorkspaceState({ rqCode: null });
  }

  function patchRequirementRow(rowId: string, patch: Partial<EditableRequirementItem>) {
    setRequirementItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = { ...row, ...patch };
        const computed = computeCurrencyTcAndTotal(next, requirementCotizacionMoneda);
        next.tc = computed.tc;
        next.subtotal = computed.subtotal;
        next.costo_total_presupuestado = computed.costo_total_presupuestado;
        next.costo_unitario = computed.costo_unitario;
        return next;
      }),
    );
  }

  function selectRequirementRecurso(rowId: string, recursoId: string) {
    const recurso = recursos.find((item) => item.id === recursoId);
    if (!recurso || recurso.estado === "Inactivo") return;
    setRequirementItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const proveedor = demoData
          .listCatalogProveedores()
          .find((item) => item.nombre === recurso.proveedor)?.nombre ?? recurso.proveedor;
        const next = {
          ...row,
          recurso_id: recurso.id,
          codigo_recurso: recurso.codigo_recurso,
          codigo_fabricante: recurso.codigo_fabricante,
          tipo_recurso: recurso.tipo_recurso,
          descripcion: recurso.descripcion,
          informacion_adicional: `${recurso.marca} ${recurso.modelo}`.trim(),
          observaciones_item: row.observaciones_item || recurso.observaciones,
          recurso_a_suministrar: recurso.descripcion,
          recurso_ficha_tecnica: recurso.resourceFiles.fichaTecnica,
          recurso_ficha_tecnica_files: recurso.resourceFiles.fichasTecnicas?.length
            ? recurso.resourceFiles.fichasTecnicas
            : recurso.resourceFiles.fichaTecnica
              ? [recurso.resourceFiles.fichaTecnica]
              : [],
          recurso_imagen: recurso.resourceFiles.imagen,
          recurso_imagen_files: recurso.resourceFiles.imagenes?.length
            ? recurso.resourceFiles.imagenes
            : recurso.resourceFiles.imagen
              ? [recurso.resourceFiles.imagen]
              : [],
          recurso_archivos: recurso.resourceFiles.archivos,
          unidad: recurso.unidad,
          precio_unitario: row.precio_unitario > 0 ? row.precio_unitario : recurso.precio_unitario_ref,
          moneda: requirementCotizacionMoneda,
          proveedor,
          marca: recurso.marca,
          ficha_tecnica_a_suministrar: recurso.resourceFiles.fichaTecnica as ResourceFileMeta | null,
          ficha_tecnica_a_suministrar_files: recurso.resourceFiles.fichaTecnica
            ? [recurso.resourceFiles.fichaTecnica]
            : [],
          tiempo_entrega: recurso.tiempo_entrega_ref,
        };
        return { ...next, ...computeCurrencyTcAndTotal(next, requirementCotizacionMoneda) };
      }),
    );
  }

  async function saveRequirementOverlay(itemsOverride?: EditableRequirementItem[]) {
    if (!requirementDraft || !selectedRequirementId) return;
    const itemsToSave = itemsOverride ?? requirementItems;
    const normalizedDraft = normalizeRequirementDates(requirementDraft);
    const shouldPersistToSupabase = isUuid(selectedRequirementId);
    if (process.env.NODE_ENV === "development") {
      console.log("[RQ_SAVE_DEBUG] CotizacionesPage onSaveTable wrapper ejecutado", {
        requirementId: selectedRequirementId,
        requirementCodigo: selectedRequirement?.codigo ?? requirementDraft.codigo,
        currentItemsLength: itemsOverride?.length ?? null,
        requirementItemsLength: requirementItems.length,
      });
      console.log("[RQ_SAVE_DEBUG] CotizacionesPage requirementId", {
        requirementId: selectedRequirementId,
        isUuid: shouldPersistToSupabase,
        codigoRq: selectedRequirement?.codigo ?? requirementDraft.codigo,
      });
      console.log("[RQ_SAVE_DEBUG] CotizacionesPage currentItems.length", {
        currentItemsLength: itemsToSave.length,
      });
    }
    const normalized: DetalleRequerimientoItem[] = itemsToSave
      .filter((row) =>
        Boolean(
          row.recurso_id ||
            row.codigo_fabricante.trim() ||
            row.descripcion.trim() ||
            row.recurso_a_suministrar.trim() ||
            row.informacion_adicional.trim(),
        ),
      )
      .map((row, index) => ({
        id: row.id.startsWith("tmp-") ? `dtrq-${selectedRequirementId}-${index + 1}` : row.id,
        requerimiento_id: selectedRequirementId,
        recurso_id: row.recurso_id,
        historical_item_source: {
          tipo_recurso: row.tipo_recurso,
          codigo_fabricante: row.codigo_fabricante,
          descripcion: row.descripcion,
          a_suministrar: row.recurso_a_suministrar,
          unidad: row.unidad,
          cantidad: row.cantidad,
          ajuste: row.ajuste,
          atencion_real: row.atencion_real,
          cant_stock: row.cant_stock,
          compra: row.compra,
          precio_unitario: row.precio_unitario,
          tipo_cambio: row.tc,
          costo_total_presupuestado: row.costo_total_presupuestado,
          moneda: (row.moneda as "PEN" | "USD") || requirementCotizacionMoneda,
          observaciones_item: row.observaciones_item,
        },
        cantidad: row.cantidad,
        precio_unitario: row.precio_unitario,
        subtotal: row.subtotal,
        ajuste: row.ajuste,
        atencion_real: row.atencion_real,
        cant_stock: row.cant_stock,
        compra: row.compra,
        costo_unitario: row.costo_unitario,
        moneda: (row.moneda as "PEN" | "USD") || requirementCotizacionMoneda,
        tc: row.moneda === requirementCotizacionMoneda ? 1 : row.tc,
        factor_eq_herr: row.factor_eq_herr,
        costo_total_presupuestado: row.costo_total_presupuestado,
        fecha_coti: normalizeDateForStorage(row.fecha_coti),
        estado: row.estado,
        informacion_adicional: row.informacion_adicional,
        observaciones_item: row.observaciones_item,
        recurso_a_suministrar: row.recurso_a_suministrar,
        recurso_ficha_tecnica_files: row.recurso_ficha_tecnica_files,
        recurso_imagen_files: row.recurso_imagen_files,
        recurso_archivos: row.recurso_archivos,
        ficha_tecnica_a_suministrar: row.ficha_tecnica_a_suministrar_files[0] ?? null,
        ficha_tecnica_a_suministrar_files: row.ficha_tecnica_a_suministrar_files,
        proveedor: row.proveedor,
        condicion_pago: row.condicion_pago,
        tiempo_entrega: row.tiempo_entrega,
        eq: row.eq,
        eq_fecha_aprob: normalizeDateForStorage(row.eq_fecha_aprob),
        ll: row.ll,
        ll_fecha_aprob: normalizeDateForStorage(row.ll_fecha_aprob),
        hb: row.hb,
        hb_fecha_aprob: normalizeDateForStorage(row.hb_fecha_aprob),
        logistica_compra: row.logistica_compra,
        fecha_compra: normalizeDateForStorage(row.fecha_compra),
        oc_os_recurso: row.oc_os_recurso,
        fecha_entrega: normalizeDateForStorage(row.fecha_entrega),
        guia_remision: row.guia_remision,
        archivo_guia: row.archivo_guia_files[0] ?? null,
        archivo_guia_files: row.archivo_guia_files,
      }));
    if (!shouldPersistToSupabase) {
      demoData.updateRequerimiento(selectedRequirementId, normalizedDraft);
      if (normalized.length > 0) {
        demoData.replaceDetalleItems(selectedRequirementId, normalized);
        setDetalleItems((prev) => [...normalized, ...prev.filter((it) => it.requerimiento_id !== selectedRequirementId)]);
      }
      setRequirementDraft(normalizedDraft);
      setRequerimientos((prev) => prev.map((rq) => (rq.id === selectedRequirementId ? normalizedDraft : rq)));
      setWarning(
        normalized.length > 0
          ? "Requerimiento guardado correctamente en datos demo/locales. No se actualizó Supabase."
          : "Datos del requerimiento guardados correctamente en datos demo/locales. No se actualizó Supabase.",
      );
      return;
    }

    let persistedDraft = normalizedDraft;
    try {
      const draftSave = await updateRequirementSupabase(selectedRequirementId, normalizedDraft);
      if (!draftSave.ok) {
        setWarning(`Error al guardar datos del requerimiento: ${draftSave.message}`);
        return;
      }
      persistedDraft = normalizeRequirementDates(draftSave.requerimiento);
      setRequirementDraft(persistedDraft);
      setRequerimientos((prev) => prev.map((rq) => (rq.id === selectedRequirementId ? persistedDraft : rq)));
      persistWorkspaceState({ rqCode: persistedDraft.codigo, quotationCode: draft?.codigo ?? null });
    } catch (error) {
      setWarning(`Error al guardar datos del requerimiento: ${formatSupabaseSaveError(error)}`);
      return;
    }

    if (itemsToSave.length > 0 && normalized.length === 0) {
      setWarning("Error al guardar tabla: las filas visibles no tienen recurso o descripción para guardar.");
      return;
    }

    if (normalized.length === 0) {
      setWarning("Datos del requerimiento guardados correctamente en Supabase.");
      return;
    }

    try {
      if (process.env.NODE_ENV === "development") {
        console.log("[RQ_SAVE_DEBUG] CotizacionesPage repository llamado", {
          requirementId: selectedRequirementId,
          payloadLength: normalized.length,
          payload: normalized,
        });
      }
      const saved = await saveRequirementItemsForRequirement(selectedRequirementId, normalized);
      if (process.env.NODE_ENV === "development") {
        console.log("[RQ_SAVE_DEBUG] CotizacionesPage repository result", {
          requirementId: selectedRequirementId,
          source: saved.source,
          total: saved.total,
          warning: saved.warning ?? null,
          rowsLength: saved.rows.length,
          rows: saved.rows,
        });
      }
      if (saved.source !== "supabase") {
        throw new Error(saved.warning ?? "El guardado no llegó a Supabase.");
      }

      clearRequirementItemsCache();
      const readback = await loadRequirementItemsForRequirement({
        module: "cotizaciones",
        requirementId: selectedRequirementId,
        reason: "manual-refresh",
        forceRefresh: true,
      });
      if (process.env.NODE_ENV === "development") {
        console.log("[RQ_SAVE_DEBUG] CotizacionesPage readback rows", {
          requirementId: selectedRequirementId,
          source: readback.source,
          total: readback.total,
          warning: readback.warning ?? null,
          rowsLength: readback.rows.length,
          rows: readback.rows,
        });
      }
      if (readback.source !== "supabase") {
        throw new Error(readback.warning ?? "La lectura posterior no vino desde Supabase.");
      }
      if (readback.rows.length === 0) {
        throw new Error("Supabase no devolvió filas persistidas para este requerimiento después de guardar.");
      }

      setDetalleItems((prev) => [...readback.rows, ...prev.filter((it) => it.requerimiento_id !== selectedRequirementId)]);
      const list = readback.rows.map((item) =>
        toEditableItem(item, recursos.find((recurso) => recurso.id === item.recurso_id), requirementCotizacionMoneda),
      );
      setRequirementItems(list);
      setWarning("Tabla del requerimiento guardada correctamente en Supabase.");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[RQ_SAVE_DEBUG] CotizacionesPage error al guardar tabla", error);
      }
      setWarning(`Error al guardar tabla: ${formatSupabaseSaveError(error)}`);
    }
  }

  async function createRequirementFromQuotation() {
    if (!draft) return;

    // Regla obligatoria: Solo Ganada
    if (draft.estado !== "Ganada") {
      setRequirementCreationError("Solo se pueden crear requerimientos desde cotizaciones con estado 'Ganada'.");
      return;
    }

    if (dataSource === "demo") {
      const created = demoData.createRequerimientoFromCotizacion(draft.id);
      if (!created.ok) {
        setRequirementCreationError(created.message);
        return;
      }
      setRequirementCreationError(null);
      setRequerimientos(demoData.listRequerimientos());
      void openRequirementOverlay(created.requerimiento.id);
      return;
    }

    // Flujo Supabase Real
    setIsQuotationSaving(true);
    try {
      const result = await createRequirementFromWonQuotationSupabase(draft, { userEmail: currentUserEmail });
      
      if (!result.ok) {
        setRequirementCreationError(result.message);
        return;
      }

      setRequirementCreationError(null);
      // Recargamos datos para sincronizar la lista lateral de requerimientos
      await refreshCotizacionesData();
      void openRequirementOverlay(result.requerimiento.id);
    } catch (error) {
      setRequirementCreationError(error instanceof Error ? error.message : "Error fatal al crear RQ.");
    } finally {
      setIsQuotationSaving(false);
    }
  }

  async function deleteRequirementFromQuotation(requirementId: string) {
    if (!canDeleteAssociatedRequirements) {
      setRequirementCreationError("No tienes permiso para eliminar RQ.");
      return false;
    }

    if (isSupabaseReadOnly) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[cotizaciones] delete_new_requirement_if_empty llamado", {
          requirementId,
          dataSource,
          currentUserEmail,
        });
      }
      const result = await deleteNewRequirementIfEmpty(requirementId);
      if (!result.ok) {
        setRequirementCreationError(result.message);
        return false;
      }

      setRequirementCreationError(null);
      setWarning(result.message);
      clearCoreAppDataCache();
      clearRequirementItemsCache();
      await refreshCotizacionesData();
      if (selectedRequirementId === requirementId) {
        closeRequirementOverlay();
      }
      return true;
    }
    if (process.env.NODE_ENV === "development") {
      console.debug("[cotizaciones] accion X RQ asociado en demo", {
        requirementId,
        dataSource,
      });
    }
    const deleted = demoData.deleteRequerimiento(requirementId);
    if (!deleted) return false;
    setRequerimientos(demoData.listRequerimientos());
    setDetalleItems(demoData.listDetalleItems());
    if (selectedRequirementId === requirementId) {
      closeRequirementOverlay();
    }
    return true;
  }

  const requirementResourceTypeSummary = useMemo(
    () =>
      requirementResourceTypeCatalog.map((tipo) => {
        const rows = requirementItems.filter(
          (item) => normalizeTipoRecurso(item.tipo_recurso) === normalizeTipoRecurso(tipo),
        );
        return {
          tipo_recurso: tipo,
          total: Number(rows.reduce((acc, row) => acc + row.costo_total_presupuestado, 0).toFixed(2)),
        };
      }),
    [requirementItems, requirementResourceTypeCatalog],
  );
  const requirementTotal = useMemo(
    () => Number(requirementResourceTypeSummary.reduce((acc, row) => acc + row.total, 0).toFixed(2)),
    [requirementResourceTypeSummary],
  );
  const requirementTotalsByCurrency = useMemo(
    () => ({ [requirementCotizacionMoneda]: requirementTotal }),
    [requirementCotizacionMoneda, requirementTotal],
  );

  return (
    <section className="sgp-page app-table-section min-w-0">
      {!permissionsReady ? (
        <div className="rounded-xl border border-border bg-panel px-3 py-4 text-sm text-stone-600">
          Cargando permisos...
        </div>
      ) : isDataLoading && cotizaciones.length === 0 ? (
        <div className="rounded-xl border border-border bg-panel px-3 py-4 text-sm text-stone-600">
          Cargando cotizaciones...
        </div>
      ) : canViewQuotationTable ? (
        <DataTable
          rows={cotizaciones}
          onRowClick={openEditQuotation}
          maxHeightClassName="max-h-[62vh]"
          tableTitle="Log de cotizaciones"
          tableIcon="file-text"
          rowWindow={{ start: pageStartIndex, size: pageSize }}
          onVisibleRowsChange={(rows) => setFilteredRowsCount(rows.length)}
          onTableStateChange={() => setPage(1)}
          initialColumnFilters={tableViewState.columnFilters}
          initialSortKey={tableViewState.sortKey}
          initialSortDirection={tableViewState.sortDirection}
          onTableViewChange={(state) => {
            setTableViewState(state);
            setPage(1);
          }}
          toolbarActions={
            <>
              <button
                type="button"
                onClick={() => void refreshCotizacionesData()}
                className="inline-flex h-6 min-h-6 items-center gap-1 rounded-md border border-border px-2 text-xs leading-none text-stone-600 hover:bg-stone-100"
                title="Forzar recarga de cotizaciones y requerimientos"
              >
                Actualizar datos
              </button>
              {canViewQuotationActions ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!canCreateQuotationInCurrentSource) {
                      setWarning(
                        dataSource === "supabase"
                          ? "No tienes permiso can_create para crear cotizaciones en Supabase."
                          : "No se puede crear una cotización en el estado actual de la vista.",
                      );
                      return;
                    }
                    setPendingNewQuotationConfirm(true);
                  }}
                  disabled={!canCreateQuotationInCurrentSource}
                  className="inline-flex h-6 min-h-6 items-center gap-1 rounded-md border border-border px-2 text-xs leading-none text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                  title={
                    canCreateQuotationInCurrentSource
                      ? "Nueva cotización"
                      : dataSource === "supabase"
                        ? "Requiere permiso can_create en cotizaciones"
                        : "Nueva cotización no disponible"
                  }
                >
                  <span className="text-sm leading-none">+</span>
                  <span>Nueva cotización</span>
                </button>
              ) : null}
            </>
          }
          columns={visibleCotizacionesColumns}
        />
      ) : effectiveCanView ? (
        <div className="rounded-xl border border-border bg-panel px-3 py-4 text-sm text-stone-600">
          Tabla principal oculta por permisos.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-panel px-3 py-4 text-sm text-stone-600">
          No tienes permiso para ver el Log de cotizaciones.
        </div>
      )}
      {permissionsReady && effectiveCanView && canViewQuotationActions && canCreateQuotationInCurrentSource && pendingNewQuotationConfirm ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/20 p-3">
          <div className="w-full max-w-[420px] rounded-lg border border-stone-300 bg-panel p-3 shadow-md">
            <p className="text-[12px] font-medium text-stone-700">¿Deseas crear una nueva cotización?</p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingNewQuotationConfirm(false)}
                className="inline-flex h-6 min-h-6 items-center justify-center gap-1 rounded border border-stone-200 px-1.5 text-[11px] leading-none text-stone-500 hover:border-stone-300 hover:bg-stone-100 active:bg-stone-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingNewQuotationConfirm(false);
                  openNewQuotation();
                }}
                className="inline-flex h-6 min-h-6 items-center justify-center gap-1 rounded border border-stone-300 bg-stone-100 px-1.5 text-[11px] leading-none text-stone-700 hover:bg-stone-200"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {permissionsReady && effectiveCanView && canViewQuotationTable ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Fuente: {dataSource === "supabase" ? "Supabase" : "Demo local"}</span>
          <span>Registros: {totalFilteredRows}</span>
          {isDataLoading && cotizaciones.length > 0 ? <span className="text-stone-400">Actualizando...</span> : null}
          {warning ? <span className="text-amber-700">{warning}</span> : null}
        </div>
      ) : null}

      {permissionsReady && canViewQuotationTable ? (
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <p>
            Mostrando {totalFilteredRows === 0 ? 0 : pageStartIndex + 1} - {Math.min(page * pageSize, totalFilteredRows)} de{" "}
            {totalFilteredRows}
          </p>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1 text-xs text-stone-600">
              Filas
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="h-7 rounded border border-border bg-white px-1 text-xs text-stone-700"
              >
                {ROWS_PER_PAGE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-border px-2 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <span>
              {page}/{totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-border px-2 py-1 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}

      <QuotationWorkspaceModal
        open={!!draft}
        draft={draft}
        requerimientos={requerimientos}
        detalleItems={detalleItems}
        recursos={recursos}
        clientOptions={clientOptions}
        unitOptions={unitOptions}
        serviceTypeOptions={serviceTypeOptions}
        solicitanteOptions={solicitanteOptions}
        technicalResponsibleOptions={technicalResponsibleOptions}
        economicResponsibleOptions={economicResponsibleOptions}
        proposalStatusOptions={proposalStatusOptions}
        statusOptions={estadoCotizacionOptions}
        priorityOptions={["Alta", "Media", "Baja"]}
        autoEditOnOpen={!editingId}
        canEditQuotation={canSaveCurrentQuotation}
        canUploadQuotationDocuments={canUploadQuotationDocumentsInCurrentSource}
        isSavingQuotation={isQuotationSaving}
        onClose={closeModal}
        onSave={saveDraft}
        onDraftChange={updateDraft}
        onEconomicRowChange={updateEconomicRow}
        onOpenRequirement={canOpenRequirementsFromQuotation ? openRequirementOverlay : undefined}
        onCreateRequirement={
          canOpenRequirementsFromQuotation && canViewQuotationActions
            ? createRequirementFromQuotation
            : undefined
        }
        onDeleteRequirement={
          canOpenRequirementsFromQuotation && canViewQuotationActions
            ? deleteRequirementFromQuotation
            : undefined
        }
        canDeleteAssociatedRequirements={canDeleteAssociatedRequirements}
        requirementCreationError={requirementCreationError}
        hiddenBusinessFields={hiddenBusinessFields}
        canViewPrices={effectiveCanViewPrices && canViewQuotationEconomicSummary}
        viewGroupPermissions={viewGroupPermissions}
      />

      <RequirementWorkspaceModal
        open={!!selectedRequirementId}
        zIndexClassName="z-[70]"
        onClose={closeRequirementOverlay}
        requerimiento={selectedRequirement}
        proyecto={selectedRequirementCotizacion?.proyecto ?? "Sin definir"}
        cotizacionCodigo={selectedRequirementCotizacion?.codigo ?? "-"}
        cotizacionOc={selectedRequirementCotizacion?.oc ?? "-"}
        cliente={selectedRequirementCotizacion?.cliente ?? "Sin definir"}
        unidadTrabajo={selectedRequirementCotizacion?.unidad_trabajo ?? "Sin definir"}
        cotizacionMoneda={requirementCotizacionMoneda}
        recursos={selectableRecursos}
        draft={requirementDraft}
        items={requirementItems}
        resourceTypeSummary={requirementResourceTypeSummary}
        totalsByCurrency={requirementTotalsByCurrency}
        resourceTypeOptions={requirementResourceTypeCatalog}
        currencyOptions={demoData.listCatalogMonedas().map((item) => item.codigo)}
        statusOptions={demoData.listCatalogEstadoDetalleRq().map((item) => item.nombre)}
        providerOptions={demoData.listCatalogProveedores().map((item) => item.nombre)}
        solicitanteOptions={demoData.listCatalogSolicitanteRq().map((item) => item.nombre)}
        tipoServicioOptions={demoData.listCatalogTipoServicio().map((item) => item.nombre)}
        areaOptions={demoData.listCatalogArea().map((item) => item.nombre)}
        eqOptions={demoData.listCatalogEq().map((item) => item.nombre)}
        llOptions={demoData.listCatalogLl().map((item) => item.nombre)}
        hbOptions={demoData.listCatalogHb().map((item) => item.nombre)}
        logisticaCompraOptions={demoData.listCatalogLogisticaCompra().map((item) => item.nombre)}
        onDraftChange={(patch) => setRequirementDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
        onAddRow={() => setRequirementItems((prev) => [...prev, defaultRow(requirementCotizacionMoneda)])}
        onRemoveRow={(id) => setRequirementItems((prev) => prev.filter((row) => row.id !== id))}
        onSelectRecurso={selectRequirementRecurso}
        onPatchRow={patchRequirementRow}
        onCancel={() => {
          if (!selectedRequirement) return;
          openRequirementOverlay(selectedRequirement.id);
        }}
        onSave={saveRequirementOverlay}
        onSaveTable={(currentItems) => saveRequirementOverlay(currentItems)}
        hiddenBusinessFields={hiddenBusinessFields}
        canViewPrices={effectiveCanViewPrices && canViewQuotationEconomicSummary}
      />
    </section>
  );
}
