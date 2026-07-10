"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataTable, type DataTableViewState } from "@/components/sgp/DataTable";
import { RequirementWorkspaceModal } from "@/components/sgp/RequirementWorkspaceModal";
import { NewRequirementModal } from "@/components/sgp/requirements/NewRequirementModal";
import { StatusBadge } from "@/components/sgp/StatusBadge";
import { debugDataSourceLoad, publishDataSourceSnapshot, type AppDataSource } from "@/lib/sgp/dataSourceDiagnostics";
import {
  demoData,
  type Cotizacion,
  type DetalleRequerimientoItem,
  type Recurso,
  type Requerimiento,
  type ResourceFileMeta,
} from "@/lib/sgp/demoData";
import { type EditableRequirementItem } from "@/components/sgp/RequirementItemsGrid";
import {
  clearRequirementItemsCache,
  getFreshCoreAppDataCache,
  loadCoreAppData,
  loadRequirementItemsForRequirement,
} from "@/lib/sgp/clientDataCache";
import { saveRequirementItemsForRequirement } from "@/lib/sgp/requirementItemsRepository";
import { updateRequirementSupabase } from "@/lib/sgp/requirementsRepository";
import { formatDate, normalizeDateForStorage } from "@/lib/sgp/utils";
import {
  attachLifecycleDiagnostics,
  debugUiState,
  readSessionUiState,
  readUrlNumberParam,
  readUrlStringParam,
  updateUrlState,
  writeSessionUiState,
  type PersistedTableUiState,
} from "@/lib/sgp/uiStatePersistence";

type ResourceTypeSummary = {
  tipo_recurso: string;
  total: number;
};

const DEFAULT_PAGE_SIZE = 12;
const REQUERIMIENTOS_UI_STATE_KEY = "opsia:requerimientos:ui-state";
const ROWS_PER_PAGE_OPTIONS = [12, 20, 40, 60, 80, 100] as const;

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

function normalizeTipoRecurso(value: string): string {
  return value.trim().toLowerCase();
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

export default function RequerimientosPage() {
  const queryOpenedRef = useRef<string | null>(null);
  const restoredUiStateRef = useRef(false);
  const hasLoadedDataRef = useRef(false);
  const workspaceLoadRequestRef = useRef(0);
  const workspaceSelectedIdRef = useRef<string | null>(null);
  const workspaceDirtyRef = useRef(false);
  const initialUiStateRef = useRef<PersistedTableUiState | null>(null);
  if (initialUiStateRef.current === null) {
    initialUiStateRef.current = readSessionUiState<PersistedTableUiState>(REQUERIMIENTOS_UI_STATE_KEY, {});
  }
  const initialUiState = initialUiStateRef.current;
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [recursos] = useState(() => demoData.listRecursos());
  // Los recursos inactivos se conservan para historicos, pero no se ofrecen para nuevas selecciones.
  const selectableRecursos = useMemo(() => recursos.filter((recurso) => recurso.estado !== "Inactivo"), [recursos]);
  const [detalleItems, setDetalleItems] = useState<DetalleRequerimientoItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Requerimiento | null>(null);
  const [workspaceItems, setWorkspaceItems] = useState<EditableRequirementItem[]>([]);
  const [newRequirementOpen, setNewRequirementOpen] = useState(false);
  const [newRequirementError, setNewRequirementError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<AppDataSource>("demo");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(() => readUrlNumberParam("page") ?? initialUiState.page ?? 1);
  const [pageSize, setPageSize] = useState<number>(() => initialUiState.pageSize ?? DEFAULT_PAGE_SIZE);
  const [tableViewState, setTableViewState] = useState<DataTableViewState>(
    () => initialUiState.tableView ?? { columnFilters: {}, sortKey: null, sortDirection: null },
  );
  const [filteredRowsCount, setFilteredRowsCount] = useState<number | null>(null);
  const isSupabaseReadOnly = dataSource === "supabase";

  useEffect(() => {
    debugUiState("requerimientos", "mounted", {});
    const cleanupLifecycleDiagnostics = attachLifecycleDiagnostics("requerimientos");
    return () => {
      debugUiState("requerimientos", "unmounted", {});
      cleanupLifecycleDiagnostics();
    };
  }, []);

  async function refreshRequerimientosData() {
    setLoading(true);
    debugUiState("requerimientos", "manual-refresh-start", {});
    try {
      const result = await loadCoreAppData({ module: "requerimientos", reason: "manual-refresh", forceRefresh: true });
      const { requerimientos: requerimientosResult, cotizaciones: cotizacionesResult } = result;
      setRequerimientos(requerimientosResult.rows.map(normalizeRequirementDates));
      setCotizaciones(cotizacionesResult.rows);
      setDetalleItems([]);
      setFilteredRowsCount(requerimientosResult.rows.length);
      setDataSource(result.source);
      setWarning(result.source === "supabase" ? "Origen de datos: Supabase en modo solo lectura inicial." : result.warning);
      debugUiState("requerimientos", "manual-refresh-end", {
        cacheStatus: result.cacheStatus,
        requerimientos: requerimientosResult.rows.length,
        cotizaciones: cotizacionesResult.rows.length,
      });
    } finally {
      setLoading(false);
    }
  }

  const selected = selectedId ? requerimientos.find((item) => item.id === selectedId) ?? null : null;
  const selectedCotizacion = selected
    ? cotizaciones.find((cot) => cot.id === selected.cotizacion_id) ?? null
    : null;
  const cotizacionMoneda = selectedCotizacion?.moneda_cotizacion ?? "PEN";
  const resourceTypeCatalog = useMemo(
    () => demoData.listCatalogTipoRecurso().map((item) => item.nombre),
    [],
  );

  function markWorkspaceDirty() {
    workspaceDirtyRef.current = true;
  }

  const openWorkspace = useCallback((row: Requerimiento) => {
    const requestId = workspaceLoadRequestRef.current + 1;
    workspaceLoadRequestRef.current = requestId;
    workspaceSelectedIdRef.current = row.id;
    workspaceDirtyRef.current = false;
    setSelectedId(row.id);
    const normalized = normalizeRequirementDates(row);
    setDraft({ ...normalized });
    const cot = cotizaciones.find((item) => item.id === normalized.cotizacion_id);
    const quoteCurrency = cot?.moneda_cotizacion ?? "PEN";
    setWorkspaceItems([]);
    void loadRequirementItemsForRequirement({
      module: "requerimientos",
      requirementId: normalized.id,
      reason: "workspace-open",
    }).then((result) => {
      const isCurrentRequest = workspaceLoadRequestRef.current === requestId;
      const isCurrentRequirement = workspaceSelectedIdRef.current === normalized.id;
      const hasLocalEdits = workspaceDirtyRef.current;
      if (process.env.NODE_ENV === "development") {
        console.debug("[requerimientos] rq-items async load completed", {
          requestId,
          requirementId: normalized.id,
          currentRequirementId: workspaceSelectedIdRef.current,
          returnedRows: result.rows.length,
          source: result.source,
          isCurrentRequest,
          isCurrentRequirement,
          hasLocalEdits,
        });
      }
      if (!isCurrentRequest || !isCurrentRequirement || hasLocalEdits) {
        if (process.env.NODE_ENV === "development") {
          console.debug("[requerimientos] rq-items async load ignored", {
            requestId,
            requirementId: normalized.id,
            reason: !isCurrentRequest ? "stale-request" : !isCurrentRequirement ? "different-requirement" : "local-edits",
            returnedRows: result.rows.length,
          });
        }
        return;
      }
      setDetalleItems((prev) => {
        const withoutCurrent = prev.filter((item) => item.requerimiento_id !== normalized.id);
        return [...withoutCurrent, ...result.rows];
      });
      const list = result.rows.map((item) =>
        toEditableItem(item, recursos.find((recurso) => recurso.id === item.recurso_id), quoteCurrency),
      );
      setWorkspaceItems(list);
      debugUiState("requerimientos", "rq-items-loaded", {
        requirementId: normalized.id,
        count: result.rows.length,
        cacheStatus: result.cacheStatus,
      });
    });
    writeSessionUiState(REQUERIMIENTOS_UI_STATE_KEY, {
      page,
      pageSize,
      tableView: tableViewState,
      rqCode: normalized.codigo,
    });
    updateUrlState({ page, rqCode: normalized.codigo, rqId: normalized.id });
    debugUiState("requerimientos", "workspace-opened", { rqCode: normalized.codigo });
  }, [cotizaciones, page, pageSize, recursos, tableViewState]);

  useEffect(() => {
    let active = true;
    const cached = getFreshCoreAppDataCache();
    const reason = hasLoadedDataRef.current ? "auth-change" : cached ? "cache-hydration" : "initial-load";
    hasLoadedDataRef.current = true;
    setLoading(!cached);
    debugUiState("requerimientos", "fetch-start", { reason, cacheAvailable: Boolean(cached) });

    loadCoreAppData({ module: "requerimientos", reason })
      .then((result) => {
        if (!active) return;

        const { requerimientos: requerimientosResult, cotizaciones: cotizacionesResult } = result;
        const source = result.source;
        const warningMessage = result.warning;

        setRequerimientos(requerimientosResult.rows.map(normalizeRequirementDates));
        setCotizaciones(cotizacionesResult.rows);
        setFilteredRowsCount(requerimientosResult.rows.length);
        setDataSource(source);
        setWarning(source === "supabase" ? "Origen de datos: Supabase en modo solo lectura inicial." : warningMessage);
        publishDataSourceSnapshot({
          module: "requerimientos",
          source,
          count: requerimientosResult.rows.length,
          warning: warningMessage ?? undefined,
        });
        debugDataSourceLoad({
          module: "requerimientos",
          source,
          count: requerimientosResult.rows.length,
          warning: warningMessage ?? undefined,
          errorMessage: result.cacheStatus === "miss" ? undefined : `cache:${result.cacheStatus}`,
        });
        debugUiState("requerimientos", "fetch-end", {
          reason: result.reason,
          cacheStatus: result.cacheStatus,
          source,
          requerimientos: requerimientosResult.rows.length,
          cotizaciones: cotizacionesResult.rows.length,
          detalleItems: "lazy",
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const fallbackRequerimientos = demoData.listRequerimientos().map(normalizeRequirementDates);
        const fallbackCotizaciones = demoData.listCotizaciones();
        const fallbackItems = demoData.listDetalleItems();
        const fallbackMessage =
          error instanceof Error
            ? `No se pudo cargar requerimientos desde Supabase: ${error.message}. Se usa data demo local.`
            : "No se pudo cargar requerimientos desde Supabase. Se usa data demo local.";

        setRequerimientos(fallbackRequerimientos);
        setCotizaciones(fallbackCotizaciones);
        setDetalleItems(fallbackItems);
        setFilteredRowsCount(fallbackRequerimientos.length);
        setDataSource("demo");
        setWarning(fallbackMessage);
        publishDataSourceSnapshot({
          module: "requerimientos",
          source: "demo",
          count: fallbackRequerimientos.length,
          warning: fallbackMessage,
        });
        debugDataSourceLoad({
          module: "requerimientos",
          source: "demo",
          count: fallbackRequerimientos.length,
          warning: fallbackMessage,
          errorMessage: error instanceof Error ? error.message : "sin detalle",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rqCode = readUrlStringParam("rqCode") ?? initialUiState.rqCode ?? null;
    const rqId = readUrlStringParam("rqId");
    const restoreKey = rqCode ?? rqId;
    if (!restoreKey) {
      restoredUiStateRef.current = true;
      return;
    }
    if (queryOpenedRef.current === restoreKey) return;
    const target = requerimientos.find((item) => item.codigo === rqCode || item.id === rqId);
    if (!target) {
      if (requerimientos.length > 0) {
        restoredUiStateRef.current = true;
        debugUiState("requerimientos", "restore-missing-record", { rqCode, rqId });
      }
      return;
    }
    queryOpenedRef.current = restoreKey;
    restoredUiStateRef.current = true;
    openWorkspace(target);
    debugUiState("requerimientos", "restored", { rqCode, rqId, found: true });
  }, [initialUiState.rqCode, requerimientos, openWorkspace]);

  useEffect(() => {
    const hasPendingRestore =
      !restoredUiStateRef.current &&
      Boolean(readUrlStringParam("rqCode") || readUrlStringParam("rqId") || initialUiState.rqCode);
    if (hasPendingRestore) return;

    writeSessionUiState(REQUERIMIENTOS_UI_STATE_KEY, {
      page,
      pageSize,
      tableView: tableViewState,
      rqCode: draft?.codigo ?? null,
    });
    updateUrlState({ page, rqCode: draft?.codigo ?? null });
    debugUiState("requerimientos", "saved", {
      page,
      pageSize,
      rqCode: draft?.codigo ?? null,
      filters: Object.keys(tableViewState.columnFilters).filter((key) => tableViewState.columnFilters[key]?.trim()),
    });
  }, [draft?.codigo, initialUiState.rqCode, page, pageSize, tableViewState]);

  function patchRow(rowId: string, patch: Partial<EditableRequirementItem>) {
    markWorkspaceDirty();
    setWorkspaceItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = { ...row, ...patch };
        const computed = computeCurrencyTcAndTotal(next, cotizacionMoneda);
        next.tc = computed.tc;
        next.subtotal = computed.subtotal;
        next.costo_total_presupuestado = computed.costo_total_presupuestado;
        next.costo_unitario = computed.costo_unitario;
        return next;
      }),
    );
  }

  function selectRecurso(rowId: string, recursoId: string) {
    const recurso = recursos.find((item) => item.id === recursoId);
    if (!recurso || recurso.estado === "Inactivo") return;
    markWorkspaceDirty();
    setWorkspaceItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const precio = row.precio_unitario > 0 ? row.precio_unitario : recurso.precio_unitario_ref;
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
          precio_unitario: precio,
          moneda: cotizacionMoneda,
          proveedor,
          marca: recurso.marca,
          ficha_tecnica_a_suministrar: recurso.resourceFiles.fichaTecnica as ResourceFileMeta | null,
          ficha_tecnica_a_suministrar_files: recurso.resourceFiles.fichaTecnica
            ? [recurso.resourceFiles.fichaTecnica]
            : [],
          tiempo_entrega: recurso.tiempo_entrega_ref,
        };
        return { ...next, ...computeCurrencyTcAndTotal(next, cotizacionMoneda) };
      }),
    );
  }

  function addRow() {
    markWorkspaceDirty();
    setWorkspaceItems((prev) => [...prev, defaultRow(cotizacionMoneda)]);
  }

  function removeRow(id: string) {
    markWorkspaceDirty();
    setWorkspaceItems((prev) => prev.filter((row) => row.id !== id));
  }

  function cancelWorkspace() {
    if (!selected) return;
    openWorkspace(selected);
  }

  async function saveWorkspace(itemsOverride?: EditableRequirementItem[]) {
    if (!draft || !selectedId) return;
    const itemsToSave = itemsOverride ?? workspaceItems;
    const shouldPersistToSupabase = isUuid(selectedId);
    if (process.env.NODE_ENV === "development") {
      console.log("[RQ_SAVE_DEBUG] RequerimientosPage onSaveTable wrapper ejecutado", {
        selectedRequirementId: selected?.id ?? selectedId,
        selectedRequirementCodigo: selected?.codigo ?? draft.codigo,
        currentItemsLength: itemsOverride?.length ?? null,
        workspaceItemsLength: workspaceItems.length,
      });
    }
    const normalizedDraft = normalizeRequirementDates(draft);
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
        id: row.id.startsWith("tmp-") ? `dtrq-${selectedId}-${index + 1}` : row.id,
        requerimiento_id: selectedId,
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
          moneda: (row.moneda as "PEN" | "USD") || cotizacionMoneda,
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
        moneda: (row.moneda as "PEN" | "USD") || cotizacionMoneda,
        tc: row.moneda === cotizacionMoneda ? 1 : row.tc,
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
      demoData.updateRequerimiento(selectedId, normalizedDraft);
      if (normalized.length > 0) {
        demoData.replaceDetalleItems(selectedId, normalized);
        setDetalleItems((prev) => [...normalized, ...prev.filter((it) => it.requerimiento_id !== selectedId)]);
      }
      setDraft(normalizedDraft);
      setRequerimientos((prev) => prev.map((rq) => (rq.id === selectedId ? normalizedDraft : rq)));
      workspaceDirtyRef.current = false;
      setWarning(
        normalized.length > 0
          ? "Requerimiento guardado correctamente en datos demo/locales. No se actualizó Supabase."
          : "Datos del requerimiento guardados correctamente en datos demo/locales. No se actualizó Supabase.",
      );
      return;
    }

    let persistedDraft = normalizedDraft;
    try {
      const draftSave = await updateRequirementSupabase(selectedId, normalizedDraft);
      if (!draftSave.ok) {
        setWarning(`Error al guardar datos del requerimiento: ${draftSave.message}`);
        return;
      }
      persistedDraft = normalizeRequirementDates(draftSave.requerimiento);
      setDraft(persistedDraft);
      setRequerimientos((prev) => prev.map((rq) => (rq.id === selectedId ? persistedDraft : rq)));
      updateUrlState({ page, rqCode: persistedDraft.codigo, rqId: persistedDraft.id });
    } catch (error) {
      setWarning(`Error al guardar datos del requerimiento: ${formatSupabaseSaveError(error)}`);
      return;
    }

    if (itemsToSave.length > 0 && normalized.length === 0) {
      setWarning(
        workspaceDirtyRef.current
          ? "Error al guardar tabla: había cambios locales, pero las filas llegaron sin recurso o descripción. No se guardó en Supabase."
          : "Error al guardar tabla: las filas visibles no tienen recurso o descripción para guardar.",
      );
      return;
    }

    if (normalized.length === 0) {
      workspaceDirtyRef.current = false;
      setWarning("Datos del requerimiento guardados correctamente en Supabase.");
      return;
    }

    try {
      if (process.env.NODE_ENV === "development") {
        console.log("[RQ_SAVE_DEBUG] RequerimientosPage repository llamado", {
          selectedRequirementId: selectedId,
          payloadLength: normalized.length,
          payload: normalized,
        });
      }
      const saved = await saveRequirementItemsForRequirement(selectedId, normalized);
      if (process.env.NODE_ENV === "development") {
        console.log("[RQ_SAVE_DEBUG] RequerimientosPage repository result", {
          selectedRequirementId: selectedId,
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
        module: "requerimientos",
        requirementId: selectedId,
        reason: "manual-refresh",
        forceRefresh: true,
      });
      if (process.env.NODE_ENV === "development") {
        console.log("[RQ_SAVE_DEBUG] RequerimientosPage readback rows", {
          selectedRequirementId: selectedId,
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

      setDetalleItems((prev) => [...readback.rows, ...prev.filter((it) => it.requerimiento_id !== selectedId)]);
      setWorkspaceItems(
        readback.rows.map((item) =>
          toEditableItem(item, recursos.find((recurso) => recurso.id === item.recurso_id), cotizacionMoneda),
        ),
      );
      workspaceDirtyRef.current = false;
      setWarning("Tabla del requerimiento guardada correctamente en Supabase.");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[RQ_SAVE_DEBUG] RequerimientosPage error al guardar tabla", error);
      }
      setWarning(`Error al guardar tabla: ${formatSupabaseSaveError(error)}`);
    }
  }

  function createRequirementFromModal(payload: Omit<Requerimiento, "id" | "codigo">) {
    if (isSupabaseReadOnly) {
      setNewRequirementError("La creación de requerimientos queda deshabilitada mientras la vista use Supabase en modo solo lectura.");
      return;
    }
    // Try the standard path first (generates a proper RQ code + project record).
    const created = demoData.createRequerimientoFromCotizacion(payload.cotizacion_id);
    if (created.ok) {
      const patched = demoData.updateRequerimiento(created.requerimiento.id, payload) ?? { ...created.requerimiento, ...payload };
      setRequerimientos(demoData.listRequerimientos());
      setNewRequirementError(null);
      setNewRequirementOpen(false);
      openWorkspace(patched);
      return;
    }
    // Fallback for demo mode: the standard path failed (e.g. missing client/unit
    // code catalog entries). Create the RQ directly in local state so the button
    // always works in demo mode.
    const cot = cotizaciones.find((c) => c.id === payload.cotizacion_id);
    const now = new Date().toISOString().slice(0, 10);
    const fallbackRq: Requerimiento = {
      id: `rq-demo-${safeUuid()}`,
      codigo: `RQ-DEMO-${Date.now().toString(36).toUpperCase()}`,
      cotizacion_id: payload.cotizacion_id,
      cotizacion_codigo: cot?.codigo ?? "",
      proyecto_servicio: cot?.proyecto ?? "",
      oc: cot?.oc ?? "",
      solicitante_rq: payload.solicitante_rq,
      tipo_servicio: payload.tipo_servicio,
      area: payload.area,
      estado: payload.estado,
      fecha_solicitud: normalizeDateForStorage(payload.fecha_solicitud) || now,
      fecha_requerida: normalizeDateForStorage(payload.fecha_requerida) || now,
      responsable: payload.responsable,
      observaciones: payload.observaciones,
      avance: 0,
      total_rq: 0,
    };
    setRequerimientos((prev) => [fallbackRq, ...prev]);
    setNewRequirementError(null);
    setNewRequirementOpen(false);
    openWorkspace(fallbackRq);
  }

  const tableRows = useMemo(() => {
    return requerimientos.map((rq) => {
      const cot = cotizaciones.find((c) => c.id === rq.cotizacion_id);
      const rqItems = detalleItems.filter((item) => item.requerimiento_id === rq.id);
      const itemsTotales = rqItems.length;
      const pendientes = rqItems.filter((item) => item.estado.toLowerCase().includes("pend")).length;
      const enProceso = rqItems.filter((item) => item.estado.toLowerCase().includes("proceso")).length;
      const atendidos = rqItems.filter((item) => item.estado.toLowerCase().includes("atendid")).length;
      const vbCompletos = rqItems.filter(
        (item) =>
          item.eq.toLowerCase() === "aprobado" &&
          item.ll.toLowerCase() === "aprobado" &&
          item.hb.toLowerCase() === "aprobado",
      ).length;
      const conRecurso = rqItems.filter((item) => Boolean(item.recurso_id)).length;
      const sinRecurso = Math.max(0, itemsTotales - conRecurso);
      const conFichaSuministrar = rqItems.filter((item) => Boolean(item.ficha_tecnica_a_suministrar)).length;
      const conOcOs = rqItems.filter((item) => item.oc_os_recurso.trim().length > 0).length;
      const conGuia = rqItems.filter((item) => item.guia_remision.trim().length > 0).length;
      const avance = itemsTotales > 0 ? Math.round((atendidos / itemsTotales) * 100) : 0;

      return {
        ...rq,
        proyecto: cot?.proyecto ?? rq.proyecto_servicio ?? "-",
        cotizacion_codigo: cot?.codigo ?? "-",
        oc: cot?.oc ?? rq.oc ?? "-",
        cliente: cot?.cliente ?? "-",
        unidad_trabajo: cot?.unidad_trabajo ?? "-",
        items_totales: itemsTotales,
        estado_rq: rq.estado,
        pendientes,
        en_proceso: enProceso,
        atendidos,
        vb_completos: vbCompletos,
        con_recurso: conRecurso,
        sin_recurso: sinRecurso,
        con_ficha_suministrar: conFichaSuministrar,
        con_oc_os: conOcOs,
        con_guia: conGuia,
        avance,
      };
    });
  }, [requerimientos, cotizaciones, detalleItems]);

  const resourceTypeSummary = useMemo<ResourceTypeSummary[]>(() => {
    return resourceTypeCatalog.map((tipo) => {
      const rows = workspaceItems.filter(
        (item) => normalizeTipoRecurso(item.tipo_recurso) === normalizeTipoRecurso(tipo),
      );
      return {
        tipo_recurso: tipo,
        total: Number(rows.reduce((acc, row) => acc + row.costo_total_presupuestado, 0).toFixed(2)),
      };
    });
  }, [resourceTypeCatalog, workspaceItems]);

  const requirementTotal = useMemo(() => {
    return Number(resourceTypeSummary.reduce((acc, row) => acc + row.total, 0).toFixed(2));
  }, [resourceTypeSummary]);

  const requirementTotalsByCurrency = useMemo(() => {
    return { [cotizacionMoneda]: requirementTotal };
  }, [cotizacionMoneda, requirementTotal]);

  const totalFilteredRows = filteredRowsCount ?? tableRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredRows / pageSize));
  const pageStartIndex = (page - 1) * pageSize;

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[requerimientos] diagnostico tabla", {
        rawCount: tableRows.length,
        filteredCount: totalFilteredRows,
        page,
        source: dataSource,
      });
    }
  }, [dataSource, page, tableRows.length, totalFilteredRows]);

  return (
    <section className="sgp-page app-table-section min-w-0">
      {loading ? (
        <div className="rounded-xl border border-border bg-panel px-3 py-4 text-sm text-stone-600">
          Cargando requerimientos...
        </div>
      ) : null}
      <DataTable
        rows={tableRows}
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
        onRowClick={openWorkspace}
        maxHeightClassName="max-h-[62vh]"
        tableTitle="Log de requerimientos"
        tableIcon="clipboard-list"
        toolbarActions={
          <>
          <button
            type="button"
            onClick={() => void refreshRequerimientosData()}
            className="inline-flex h-6 min-h-6 items-center gap-1 rounded-md border border-border px-2 text-xs leading-none text-stone-600 hover:bg-stone-100"
            title="Forzar recarga de requerimientos"
          >
            Actualizar datos
          </button>
          <button
            type="button"
            onClick={() => {
              if (isSupabaseReadOnly) {
                setWarning("El log de requerimientos está conectado a Supabase en modo solo lectura inicial.");
                return;
              }
              setNewRequirementError(null);
              setNewRequirementOpen(true);
            }}
            disabled={isSupabaseReadOnly}
            className="inline-flex h-6 min-h-6 items-center gap-1 rounded-md border border-border px-2 text-xs leading-none text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
            title={isSupabaseReadOnly ? "Supabase conectado en modo solo lectura" : "Nuevo requerimiento"}
          >
            <span className="text-sm leading-none">+</span>
            <span>Nuevo requerimiento</span>
          </button>
          </>
        }
        columns={[
          { key: "proyecto", title: "Proyecto" },
          { key: "codigo", title: "Requerimiento" },
          { key: "cotizacion_codigo", title: "Cotización" },
          { key: "oc", title: "OC" },
          { key: "cliente", title: "Cliente" },
          { key: "unidad_trabajo", title: "Unidad de trabajo" },
          { key: "solicitante_rq", title: "Solicitante de RQ" },
          { key: "estado", title: "Estado", render: (row) => <StatusBadge status={row.estado} /> },
          { key: "fecha_solicitud", title: "Fecha solicitud", render: (row) => formatDate(row.fecha_solicitud) || "-" },
          { key: "responsable", title: "Responsable" },
          { key: "fecha_requerida", title: "Fecha entrega", render: (row) => formatDate(row.fecha_requerida) || "-" },
          { key: "tipo_servicio", title: "Tipo de servicio" },
          { key: "area", title: "Área" },
          { key: "items_totales", title: "Ítems totales", align: "right" },
          { key: "estado_rq", title: "Estado RQ" },
          { key: "pendientes", title: "Pendientes", align: "right" },
          { key: "en_proceso", title: "En proceso", align: "right" },
          { key: "atendidos", title: "Atendidos", align: "right" },
          { key: "vb_completos", title: "VB completos", align: "right" },
          { key: "con_recurso", title: "Con recurso", align: "right" },
          { key: "sin_recurso", title: "Sin recurso", align: "right" },
          { key: "con_ficha_suministrar", title: "Con ficha suministrar", align: "right" },
          { key: "con_oc_os", title: "Con OC/OS", align: "right" },
          { key: "con_guia", title: "Con guía", align: "right" },
          { key: "avance", title: "Avance", align: "right", render: (row) => `${row.avance}%` },
        ]}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Fuente: {dataSource === "supabase" ? "Supabase" : "Demo local"}</span>
        <span>Registros: {totalFilteredRows}</span>
        {warning ? <span className="text-amber-700">{warning}</span> : null}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <p>
          Mostrando {totalFilteredRows === 0 ? 0 : pageStartIndex + 1} - {Math.min(pageStartIndex + pageSize, totalFilteredRows)} de{" "}
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

      <RequirementWorkspaceModal
        open={!!selectedId}
        onClose={() => {
          workspaceLoadRequestRef.current += 1;
          workspaceSelectedIdRef.current = null;
          workspaceDirtyRef.current = false;
          setSelectedId(null);
          setDraft(null);
          writeSessionUiState(REQUERIMIENTOS_UI_STATE_KEY, {
            page,
            pageSize,
            tableView: tableViewState,
            rqCode: null,
          });
          updateUrlState({ rqCode: null, rqId: null });
        }}
        requerimiento={selected}
        proyecto={selectedCotizacion?.proyecto ?? "Sin definir"}
        cotizacionCodigo={selectedCotizacion?.codigo ?? "-"}
        cotizacionOc={selectedCotizacion?.oc ?? "-"}
        cliente={selectedCotizacion?.cliente ?? "Sin definir"}
        unidadTrabajo={selectedCotizacion?.unidad_trabajo ?? "Sin definir"}
        cotizacionMoneda={cotizacionMoneda}
        recursos={selectableRecursos}
        draft={draft}
        items={workspaceItems}
        resourceTypeSummary={resourceTypeSummary}
        totalsByCurrency={requirementTotalsByCurrency}
        resourceTypeOptions={resourceTypeCatalog}
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
        onDraftChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
        onAddRow={addRow}
        onRemoveRow={removeRow}
        onSelectRecurso={selectRecurso}
        onPatchRow={patchRow}
        onCancel={cancelWorkspace}
        onSave={saveWorkspace}
        onSaveTable={(currentItems) => saveWorkspace(currentItems)}
      />

      <NewRequirementModal
        open={newRequirementOpen}
        cotizaciones={cotizaciones}
        solicitanteOptions={demoData.listCatalogSolicitanteRq().map((item) => item.nombre)}
        tipoServicioOptions={demoData.listCatalogTipoServicio().map((item) => item.nombre)}
        areaOptions={demoData.listCatalogArea().map((item) => item.nombre)}
        estadoOptions={["Pendiente", "En proceso", "Atendido"]}
        errorMessage={newRequirementError}
        onClose={() => {
          setNewRequirementOpen(false);
          setNewRequirementError(null);
        }}
        onSave={createRequirementFromModal}
      />
    </section>
  );
}
