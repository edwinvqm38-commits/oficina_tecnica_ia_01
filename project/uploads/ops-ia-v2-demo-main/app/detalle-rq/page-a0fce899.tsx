"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { RequirementWorkspaceModal } from "@/components/RequirementWorkspaceModal";
import { RequirementItemsGrid, type EditableRequirementItem } from "@/components/RequirementItemsGrid";
import { debugDataSourceLoad, publishDataSourceSnapshot, type AppDataSource } from "@/lib/dataSourceDiagnostics";
import { getModulePermissions, type ModulePermissions } from "@/lib/modulePermissionsRepository";
import {
  demoData,
  type Cotizacion,
  type DetalleRequerimientoItem,
  type Recurso,
  type Requerimiento,
  type ResourceFileMeta,
} from "@/lib/demoData";
import { getFreshCoreAppDataCache, loadCoreAppData, loadGlobalRequirementItems, loadRequirementItemsForRequirement } from "@/lib/clientDataCache";
import {
  attachLifecycleDiagnostics,
  debugUiState,
  readSessionUiState,
  readUrlNumberParam,
  readUrlStringParam,
  updateUrlState,
  writeSessionUiState,
  type PersistedTableUiState,
} from "@/lib/uiStatePersistence";
import { formatCurrencyNumber, formatDate, normalizeDateForStorage } from "@/lib/utils";

type ResourceTypeSummary = {
  tipo_recurso: string;
  total: number;
};

type DetailRqViewGroupPermissions = {
  detail_rq_general_data: boolean;
  detail_rq_indicators: boolean;
  detail_rq_resource_summary: boolean;
  detail_rq_items_table: boolean;
  detail_rq_item_detail: boolean;
  detail_rq_item_context: boolean;
  detail_rq_item_data: boolean;
  detail_rq_item_economic_data: boolean;
  detail_rq_item_supplier_data: boolean;
  detail_rq_documents: boolean;
  detail_rq_actions: boolean;
};

const DEFAULT_DETAIL_RQ_VIEW_GROUPS: DetailRqViewGroupPermissions = {
  detail_rq_general_data: true,
  detail_rq_indicators: true,
  detail_rq_resource_summary: true,
  detail_rq_items_table: true,
  detail_rq_item_detail: true,
  detail_rq_item_context: true,
  detail_rq_item_data: true,
  detail_rq_item_economic_data: true,
  detail_rq_item_supplier_data: true,
  detail_rq_documents: true,
  detail_rq_actions: true,
};

const CONSERVATIVE_DETAIL_RQ_VIEW_GROUPS: DetailRqViewGroupPermissions = {
  detail_rq_general_data: true,
  detail_rq_indicators: true,
  detail_rq_resource_summary: false,
  detail_rq_items_table: true,
  detail_rq_item_detail: true,
  detail_rq_item_context: true,
  detail_rq_item_data: true,
  detail_rq_item_economic_data: false,
  detail_rq_item_supplier_data: false,
  detail_rq_documents: false,
  detail_rq_actions: false,
};

const DETAIL_RQ_FIELD_ALIASES: Record<string, string[]> = {
  proyecto: ["proyecto"],
  cliente: ["cliente"],
  unidad_trabajo: ["unidad_trabajo", "unidadTrabajo"],
  oc: ["oc", "oc_os_recurso"],
  cotizacion: ["cotizacion", "cotizacion_codigo", "cotizacionCodigo"],
  requerimiento: ["requerimiento", "codigo_rq", "codigoRq"],
  moneda: ["moneda"],
  monto: ["monto", "total", "costo_total_presupuestado"],
  precio_unitario: ["precio_unitario"],
  total: ["total", "subtotal", "costo_total_presupuestado"],
  proveedor: ["proveedor"],
  ficha_tecnica: ["ficha_tecnica", "ficha"],
  imagen_referencial: ["imagen_referencial", "imagen"],
  archivos: ["archivos", "archivo_guia"],
};

function normalizePermissionKey(value: string): string {
  return value.trim().toLowerCase();
}

function readDetailRqViewGroupPermissions(
  permissions: ModulePermissions | null,
  isElevatedUser: boolean,
): DetailRqViewGroupPermissions {
  if (!permissions) {
    return isElevatedUser ? DEFAULT_DETAIL_RQ_VIEW_GROUPS : CONSERVATIVE_DETAIL_RQ_VIEW_GROUPS;
  }

  const root = permissions.metadata?.module_view_groups;
  if (!root || typeof root !== "object" || Array.isArray(root)) return DEFAULT_DETAIL_RQ_VIEW_GROUPS;
  const detailGroups = (root as Record<string, unknown>).detalle_rq;
  if (!detailGroups || typeof detailGroups !== "object" || Array.isArray(detailGroups)) {
    return DEFAULT_DETAIL_RQ_VIEW_GROUPS;
  }

  const values = detailGroups as Record<string, unknown>;
  return {
    detail_rq_general_data: values.detail_rq_general_data !== false,
    detail_rq_indicators: values.detail_rq_indicators !== false,
    detail_rq_resource_summary: values.detail_rq_resource_summary !== false,
    detail_rq_items_table: values.detail_rq_items_table !== false,
    detail_rq_item_detail: values.detail_rq_item_detail !== false,
    detail_rq_item_context: values.detail_rq_item_context !== false,
    detail_rq_item_data: values.detail_rq_item_data !== false,
    detail_rq_item_economic_data: values.detail_rq_item_economic_data !== false,
    detail_rq_item_supplier_data: values.detail_rq_item_supplier_data !== false,
    detail_rq_documents: values.detail_rq_documents !== false,
    detail_rq_actions: values.detail_rq_actions !== false,
  };
}

function readDetailRqSensitiveFlags(metadata: Record<string, unknown> | undefined): Record<string, boolean> {
  const fallback = { can_view_oc: true, can_view_variance: true };
  const root = metadata?.module_sensitive_permissions;
  if (!root || typeof root !== "object" || Array.isArray(root)) return fallback;
  const detailPermissions = (root as Record<string, unknown>).detalle_rq;
  if (!detailPermissions || typeof detailPermissions !== "object" || Array.isArray(detailPermissions)) return fallback;
  const values = detailPermissions as Record<string, unknown>;
  return {
    can_view_oc: values.can_view_oc !== false,
    can_view_variance: values.can_view_variance !== false,
  };
}
const DEFAULT_PAGE_SIZE = 12;
const DETALLE_RQ_UI_STATE_KEY = "opsia:detalle-rq:ui-state";
const ROWS_PER_PAGE_OPTIONS = [12, 20, 40, 60, 80, 100] as const;

type MatrixContext = {
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

type MatrixItemModalProps = {
  open: boolean;
  item: EditableRequirementItem | null;
  context: MatrixContext | null;
  isEditing: boolean;
  resourceTypeOptions: string[];
  currencyOptions: string[];
  statusOptions: string[];
  providerOptions: string[];
  onPatch: (patch: Partial<EditableRequirementItem>) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onClose: () => void;
  hiddenBusinessFields?: string[];
  canViewPrices?: boolean;
  canViewSupplier?: boolean;
  viewGroupPermissions?: DetailRqViewGroupPermissions;
};

function cloneEditableItem(item: EditableRequirementItem): EditableRequirementItem {
  return {
    ...item,
    recurso_archivos: [...item.recurso_archivos],
    recurso_ficha_tecnica_files: [...item.recurso_ficha_tecnica_files],
    recurso_imagen_files: [...item.recurso_imagen_files],
    ficha_tecnica_a_suministrar_files: [...item.ficha_tecnica_a_suministrar_files],
    archivo_guia_files: [...item.archivo_guia_files],
  };
}

function parseNumericField(value: string): number {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function MatrixItemModal({
  open,
  item,
  context,
  isEditing,
  resourceTypeOptions,
  currencyOptions,
  statusOptions,
  providerOptions,
  onPatch,
  onEdit,
  onSave,
  onCancelEdit,
  onClose,
  hiddenBusinessFields = [],
  canViewPrices = true,
  canViewSupplier = true,
  viewGroupPermissions = DEFAULT_DETAIL_RQ_VIEW_GROUPS,
}: MatrixItemModalProps) {
  if (!open || !item) return null;

  const contextValue = (value: string | undefined) => value?.trim() || "-";
  const hiddenFields = new Set(hiddenBusinessFields.map((field) => normalizePermissionKey(field)));
  const isFieldHidden = (field: string) => hiddenFields.has(normalizePermissionKey(field));
  const canViewContext = viewGroupPermissions.detail_rq_item_context;
  const canViewItemData = viewGroupPermissions.detail_rq_item_data;
  const canViewEconomicData = viewGroupPermissions.detail_rq_item_economic_data && canViewPrices;
  const canViewSupplierData = viewGroupPermissions.detail_rq_item_supplier_data && canViewSupplier;
  const canViewItemActions = viewGroupPermissions.detail_rq_actions;

  const contextRows = [
    { field: "proyecto", label: "Proyecto", value: context?.proyecto },
    { field: "requerimiento", label: "Requerimiento", value: context?.codigoRq },
    { field: "cotizacion", label: "Cotización", value: context?.cotizacionCodigo },
    { field: "oc", label: "OC", value: context?.oc },
    { field: "cliente", label: "Cliente", value: context?.cliente },
    { field: "unidad_trabajo", label: "Unidad", value: context?.unidadTrabajo },
    { field: "solicitante_rq", label: "Solicitante", value: context?.solicitanteRq },
    { field: "estado_rq", label: "Estado RQ", value: context?.estadoRq },
  ].filter((row) => !isFieldHidden(row.field));

  return (
    <div className="fixed inset-0 z-[70] bg-black/20 p-3 md:p-6">
      <div className="mx-auto flex max-h-[calc(100vh-36px)] w-full max-w-[1080px] flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h3 className="text-sm font-semibold text-stone-700">Detalle de ítem de RQ</h3>
          <div className="flex items-center gap-1.5">
            {canViewItemActions && isEditing ? (
              <>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="h-7 rounded border border-stone-200 px-2 text-xs text-stone-600 hover:bg-stone-100"
                >
                  Cancelar edición
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  className="h-7 rounded border border-stone-200 px-2 text-xs text-stone-700 hover:bg-stone-100"
                >
                  Guardar item de RQ
                </button>
              </>
            ) : canViewItemActions ? (
              <button
                type="button"
                onClick={onEdit}
                className="h-7 rounded border border-stone-200 px-2 text-xs text-stone-700 hover:bg-stone-100"
              >
                Editar item de RQ
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded border border-stone-200 text-xs text-stone-600 hover:bg-stone-100"
              aria-label="Cerrar"
              title="Cerrar"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {canViewContext ? (
          <section className="rounded border border-border bg-white p-2">
            <p className="mb-1 text-[11px] font-medium text-stone-600">Contexto del requerimiento</p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-4">
              {contextRows.length > 0 ? (
                contextRows.map((row) => (
                  <p key={row.field}>
                    <span className="text-stone-500">{row.label}:</span>{" "}
                    <span className="font-medium">{contextValue(row.value)}</span>
                  </p>
                ))
              ) : (
                <p className="text-stone-500">Contexto oculto por permisos.</p>
              )}
            </div>
          </section>
          ) : (
            <section className="rounded border border-border bg-white p-4 text-center text-xs text-stone-500">
              Contexto del ítem oculto por permisos.
            </section>
          )}

          {canViewItemData ? (
          <section className="mt-2 rounded border border-border bg-white p-2">
            <p className="mb-1 text-[11px] font-medium text-stone-600">Datos del ítem</p>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-stone-600">
                Código fabricante
                {isEditing ? (
                  <input
                    value={item.codigo_fabricante}
                    onChange={(event) => onPatch({ codigo_fabricante: event.target.value })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-xs text-stone-700 outline-none"
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{item.codigo_fabricante || "-"}</p>
                )}
              </label>

              <label className="text-xs text-stone-600">
                Tipo recurso
                {isEditing ? (
                  <select
                    value={item.tipo_recurso}
                    onChange={(event) => onPatch({ tipo_recurso: event.target.value })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-xs text-stone-700 outline-none"
                  >
                    {resourceTypeOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{item.tipo_recurso || "-"}</p>
                )}
              </label>

              <label className="text-xs text-stone-600">
                Estado
                {isEditing ? (
                  <select
                    value={item.estado}
                    onChange={(event) => onPatch({ estado: event.target.value })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-xs text-stone-700 outline-none"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{item.estado || "-"}</p>
                )}
              </label>

              <label className="text-xs text-stone-600 md:col-span-2">
                Descripción
                {isEditing ? (
                  <input
                    value={item.descripcion}
                    onChange={(event) => onPatch({ descripcion: event.target.value })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-xs text-stone-700 outline-none"
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{item.descripcion || "-"}</p>
                )}
              </label>

              {canViewSupplierData ? (
              <label className="text-xs text-stone-600">
                Proveedor
                {isEditing ? (
                  <select
                    value={item.proveedor}
                    onChange={(event) => onPatch({ proveedor: event.target.value })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-xs text-stone-700 outline-none"
                  >
                    {providerOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{item.proveedor || "-"}</p>
                )}
              </label>
              ) : null}

              <label className="text-xs text-stone-600">
                Unidad
                {isEditing ? (
                  <input
                    value={item.unidad}
                    onChange={(event) => onPatch({ unidad: event.target.value })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-xs text-stone-700 outline-none"
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{item.unidad || "-"}</p>
                )}
              </label>

              {canViewEconomicData && !isFieldHidden("moneda") ? (
              <label className="text-xs text-stone-600">
                Moneda
                {isEditing ? (
                  <select
                    value={item.moneda}
                    onChange={(event) => onPatch({ moneda: event.target.value })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-xs text-stone-700 outline-none"
                  >
                    {currencyOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{item.moneda || "-"}</p>
                )}
              </label>
              ) : null}

              <label className="text-xs text-stone-600">
                Cantidad
                {isEditing ? (
                  <input
                    value={item.cantidad}
                    onChange={(event) => onPatch({ cantidad: parseNumericField(event.target.value) })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-right text-xs text-stone-700 outline-none"
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{formatCurrencyNumber(item.cantidad)}</p>
                )}
              </label>

              {canViewEconomicData && !isFieldHidden("precio_unitario") ? (
              <label className="text-xs text-stone-600">
                Precio unitario
                {isEditing ? (
                  <input
                    value={item.precio_unitario}
                    onChange={(event) => onPatch({ precio_unitario: parseNumericField(event.target.value) })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-right text-xs text-stone-700 outline-none"
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">
                    {item.moneda} {formatCurrencyNumber(item.precio_unitario)}
                  </p>
                )}
              </label>
              ) : null}

              {canViewEconomicData ? (
              <label className="text-xs text-stone-600">
                Cant. stock
                {isEditing ? (
                  <input
                    value={item.cant_stock}
                    onChange={(event) => onPatch({ cant_stock: parseNumericField(event.target.value) })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-right text-xs text-stone-700 outline-none"
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{formatCurrencyNumber(item.cant_stock)}</p>
                )}
              </label>
              ) : null}

              {canViewEconomicData ? (
              <label className="text-xs text-stone-600">
                Compra
                {isEditing ? (
                  <input
                    value={item.compra}
                    onChange={(event) => onPatch({ compra: parseNumericField(event.target.value) })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-right text-xs text-stone-700 outline-none"
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{formatCurrencyNumber(item.compra)}</p>
                )}
              </label>
              ) : null}

              {canViewEconomicData ? (
              <label className="text-xs text-stone-600">
                Ajuste
                {isEditing ? (
                  <input
                    value={item.ajuste}
                    onChange={(event) => onPatch({ ajuste: parseNumericField(event.target.value) })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-right text-xs text-stone-700 outline-none"
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{formatCurrencyNumber(item.ajuste)}</p>
                )}
              </label>
              ) : null}

              <label className="text-xs text-stone-600">
                Fecha coti
                {isEditing ? (
                  <input
                    value={item.fecha_coti}
                    onChange={(event) => onPatch({ fecha_coti: normalizeDateForStorage(event.target.value) })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-xs text-stone-700 outline-none"
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{formatDate(item.fecha_coti) || "-"}</p>
                )}
              </label>

              <label className="text-xs text-stone-600">
                Fecha entrega
                {isEditing ? (
                  <input
                    value={item.fecha_entrega}
                    onChange={(event) => onPatch({ fecha_entrega: normalizeDateForStorage(event.target.value) })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-xs text-stone-700 outline-none"
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{formatDate(item.fecha_entrega) || "-"}</p>
                )}
              </label>

              <label className="text-xs text-stone-600 md:col-span-2">
                Información adicional
                {isEditing ? (
                  <input
                    value={item.informacion_adicional}
                    onChange={(event) => onPatch({ informacion_adicional: event.target.value })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-xs text-stone-700 outline-none"
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{item.informacion_adicional || "-"}</p>
                )}
              </label>

              <label className="text-xs text-stone-600 md:col-span-2">
                Observaciones
                {isEditing ? (
                  <input
                    value={item.observaciones_item}
                    onChange={(event) => onPatch({ observaciones_item: event.target.value })}
                    className="mt-1 h-7 w-full rounded border border-stone-300 bg-white px-2 text-xs text-stone-700 outline-none"
                  />
                ) : (
                  <p className="mt-1 text-xs font-medium text-stone-700">{item.observaciones_item || "-"}</p>
                )}
              </label>
            </div>
          </section>
          ) : (
            <section className="mt-2 rounded border border-border bg-white p-4 text-center text-xs text-stone-500">
              Datos del ítem ocultos por permisos.
            </section>
          )}
        </div>
      </div>
    </div>
  );
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

function buildGlobalMatrix(params: {
  requerimientos: Requerimiento[];
  cotizaciones: Cotizacion[];
  detalleItems: DetalleRequerimientoItem[];
  recursos: Recurso[];
}) {
  const { requerimientos, cotizaciones, detalleItems, recursos } = params;
  const rqById = new Map(requerimientos.map((rq) => [rq.id, rq]));
  const cotById = new Map(cotizaciones.map((cot) => [cot.id, cot]));
  const recursoById = new Map(recursos.map((recurso) => [recurso.id, recurso]));
  const detailByRqId = new Map<string, DetalleRequerimientoItem[]>();

  for (const detail of detalleItems) {
    const list = detailByRqId.get(detail.requerimiento_id);
    if (list) list.push(detail);
    else detailByRqId.set(detail.requerimiento_id, [detail]);
  }

  const items: EditableRequirementItem[] = [];
  const contextByItemId: Record<string, MatrixContext> = {};

  for (const detail of detalleItems) {
    const rq = rqById.get(detail.requerimiento_id);
    if (!rq) continue;
    const cot = cotById.get(rq.cotizacion_id);
    const moneda = cot?.moneda_cotizacion ?? "PEN";
    const rqDetails = detailByRqId.get(rq.id) ?? [];
    const total = rqDetails.length;
    const pendientes = rqDetails.filter((item) => item.estado.toLowerCase().includes("pend")).length;
    const enProceso = rqDetails.filter((item) => item.estado.toLowerCase().includes("proceso")).length;
    const atendidos = rqDetails.filter((item) => item.estado.toLowerCase().includes("atendid")).length;
    const vbCompletos = rqDetails.filter(
      (item) =>
        item.eq.toLowerCase() === "aprobado" &&
        item.ll.toLowerCase() === "aprobado" &&
        item.hb.toLowerCase() === "aprobado",
    ).length;
    const conRecurso = rqDetails.filter((item) => Boolean(item.recurso_id)).length;
    const sinRecurso = total - conRecurso;
    const conFichaSuministrar = rqDetails.filter((item) => Boolean(item.ficha_tecnica_a_suministrar)).length;
    const conOcOs = rqDetails.filter((item) => item.oc_os_recurso.trim().length > 0).length;
    const conGuia = rqDetails.filter((item) => item.guia_remision.trim().length > 0).length;
    const avance = total > 0 ? Math.round((atendidos / total) * 100) : 0;

    items.push(toEditableItem(detail, recursoById.get(detail.recurso_id), moneda));
    contextByItemId[detail.id] = {
      requirementId: rq.id,
      proyecto: cot?.proyecto ?? "-",
      codigoRq: rq.codigo,
      cotizacionCodigo: cot?.codigo ?? "-",
      oc: cot?.oc ?? "-",
      cliente: cot?.cliente ?? "-",
      unidadTrabajo: cot?.unidad_trabajo ?? "-",
      solicitanteRq: rq.solicitante_rq ?? "-",
      estadoRq: rq.estado ?? "-",
      fechaSolicitud: rq.fecha_solicitud ?? "",
      fechaEntrega: rq.fecha_requerida ?? "",
      tipoServicio: rq.tipo_servicio ?? "-",
      area: rq.area ?? "-",
      itemsTotales: total,
      pendientes,
      enProceso,
      atendidos,
      vbCompletos,
      conRecurso,
      sinRecurso,
      conFichaSuministrar,
      conOcOs,
      conGuia,
      avance,
      clienteProyecto: cot ? `${cot.cliente} / ${cot.proyecto}` : "-",
    };
  }

  return { items, contextByItemId };
}

export default function DetalleRqPage() {
  const { profile, user } = useAuth();
  const queryOpenedRef = useRef<string | null>(null);
  const restoredUiStateRef = useRef(false);
  const hasLoadedDataRef = useRef(false);
  const initialUiStateRef = useRef<PersistedTableUiState | null>(null);
  if (initialUiStateRef.current === null) {
    initialUiStateRef.current = readSessionUiState<PersistedTableUiState>(DETALLE_RQ_UI_STATE_KEY, {});
  }
  const initialUiState = initialUiStateRef.current;
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [recursos] = useState(() => demoData.listRecursos());
  const [detalleItems, setDetalleItems] = useState<DetalleRequerimientoItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Requerimiento | null>(null);
  const [workspaceItems, setWorkspaceItems] = useState<EditableRequirementItem[]>([]);
  const [matrixItems, setMatrixItems] = useState<EditableRequirementItem[]>([]);
  const [page, setPage] = useState(() => readUrlNumberParam("page") ?? initialUiState.page ?? 1);
  const [pageSize, setPageSize] = useState<number>(() => initialUiState.pageSize ?? DEFAULT_PAGE_SIZE);
  const [selectedMatrixItemId, setSelectedMatrixItemId] = useState<string | null>(null);
  const [selectedMatrixItemDraft, setSelectedMatrixItemDraft] = useState<EditableRequirementItem | null>(null);
  const [isMatrixItemEditing, setIsMatrixItemEditing] = useState(false);
  const [modulePermissions, setModulePermissions] = useState<ModulePermissions | null>(null);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<AppDataSource>("demo");
  const currentUserEmail = (profile.email ?? user.email ?? "").trim().toLowerCase();
  const isSupabaseReadOnly = dataSource === "supabase";

  useEffect(() => {
    debugUiState("detalle-rq", "mounted", {});
    const cleanupLifecycleDiagnostics = attachLifecycleDiagnostics("detalle-rq");
    return () => {
      debugUiState("detalle-rq", "unmounted", {});
      cleanupLifecycleDiagnostics();
    };
  }, []);

  const selected = selectedId ? requerimientos.find((item) => item.id === selectedId) ?? null : null;
  const selectedCotizacion = selected ? cotizaciones.find((cot) => cot.id === selected.cotizacion_id) ?? null : null;
  const cotizacionMoneda = selectedCotizacion?.moneda_cotizacion ?? "PEN";
  const resourceTypeCatalog = useMemo(() => demoData.listCatalogTipoRecurso().map((item) => item.nombre), []);
  const matrixContextByItemId = useMemo(
    () => buildGlobalMatrix({ requerimientos, cotizaciones, detalleItems, recursos }).contextByItemId,
    [cotizaciones, detalleItems, recursos, requerimientos],
  );
  const selectedMatrixContext = selectedMatrixItemId ? matrixContextByItemId[selectedMatrixItemId] ?? null : null;

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

    getModulePermissions("detalle_rq", currentUserEmail)
      .then((permissions) => {
        if (!active) return;
        if (process.env.NODE_ENV === "development") {
          console.log("[detalle-rq] email autenticado:", currentUserEmail);
          console.log("[detalle-rq] permisos recibidos:", permissions);
        }
        setModulePermissions(permissions);
      })
      .catch(() => {
        if (!active) return;
        setModulePermissions(null);
      })
      .finally(() => {
        if (active) setIsPermissionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUserEmail]);

  async function refreshDetalleRqData() {
    setIsDataLoading(true);
    debugUiState("detalle-rq", "manual-refresh-start", {});
    try {
      const [coreResult, detalleItemsResult] = await Promise.all([
        loadCoreAppData({ module: "detalle-rq", reason: "manual-refresh", forceRefresh: true }),
        loadGlobalRequirementItems({ module: "detalle-rq", reason: "manual-refresh", forceRefresh: true }),
      ]);
      setRequerimientos(coreResult.requerimientos.rows.map(normalizeRequirementDates));
      setCotizaciones(coreResult.cotizaciones.rows);
      setDetalleItems(detalleItemsResult.rows);
      setDataSource(coreResult.source);
      setWarning(
        coreResult.source === "supabase"
          ? "Origen de datos: Supabase en modo solo lectura inicial."
          : coreResult.warning ?? detalleItemsResult.warning ?? null,
      );
      debugUiState("detalle-rq", "manual-refresh-end", {
        coreCacheStatus: coreResult.cacheStatus,
        detailCacheStatus: detalleItemsResult.cacheStatus,
        detalleItems: detalleItemsResult.rows.length,
      });
    } finally {
      setIsDataLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const cached = getFreshCoreAppDataCache();
    const reason = hasLoadedDataRef.current ? "auth-change" : cached ? "cache-hydration" : "initial-load";
    hasLoadedDataRef.current = true;
    setIsDataLoading(!cached);
    debugUiState("detalle-rq", "fetch-start", { reason, cacheAvailable: Boolean(cached) });

    loadCoreAppData({ module: "detalle-rq", reason })
      .then(async (result) => {
        if (!active) return;

        const { requerimientos: requerimientosResult, cotizaciones: cotizacionesResult } = result;
        const detalleItemsResult = await loadGlobalRequirementItems({ module: "detalle-rq", reason });
        if (!active) return;
        const source = result.source;
        const warningMessage = result.warning ?? detalleItemsResult.warning ?? null;

        setRequerimientos(requerimientosResult.rows.map(normalizeRequirementDates));
        setCotizaciones(cotizacionesResult.rows);
        setDetalleItems(detalleItemsResult.rows);
        setDataSource(source);
        setWarning(source === "supabase" ? "Origen de datos: Supabase en modo solo lectura inicial." : warningMessage);
        publishDataSourceSnapshot({
          module: "detalle-rq",
          source,
          count: detalleItemsResult.rows.length,
          warning: warningMessage ?? undefined,
          userEmail: currentUserEmail || undefined,
        });
        debugDataSourceLoad({
          module: "detalle-rq",
          source,
          count: detalleItemsResult.rows.length,
          warning: warningMessage ?? undefined,
          userEmail: currentUserEmail || undefined,
          errorMessage:
            result.cacheStatus === "miss" && detalleItemsResult.cacheStatus === "miss"
              ? undefined
              : `cache:${result.cacheStatus}/${detalleItemsResult.cacheStatus}`,
        });
        debugUiState("detalle-rq", "fetch-end", {
          reason: result.reason,
          cacheStatus: `${result.cacheStatus}/${detalleItemsResult.cacheStatus}`,
          source,
          detalleItems: detalleItemsResult.rows.length,
          requerimientos: requerimientosResult.rows.length,
          cotizaciones: cotizacionesResult.rows.length,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const fallbackRequerimientos = demoData.listRequerimientos().map(normalizeRequirementDates);
        const fallbackCotizaciones = demoData.listCotizaciones();
        const fallbackItems = demoData.listDetalleItems();
        const fallbackMessage =
          error instanceof Error
            ? `No se pudo cargar el detalle RQ desde Supabase: ${error.message}. Se usa data demo local.`
            : "No se pudo cargar el detalle RQ desde Supabase. Se usa data demo local.";

        setRequerimientos(fallbackRequerimientos);
        setCotizaciones(fallbackCotizaciones);
        setDetalleItems(fallbackItems);
        setDataSource("demo");
        setWarning(fallbackMessage);
        publishDataSourceSnapshot({
          module: "detalle-rq",
          source: "demo",
          count: fallbackItems.length,
          warning: fallbackMessage,
          userEmail: currentUserEmail || undefined,
        });
        debugDataSourceLoad({
          module: "detalle-rq",
          source: "demo",
          count: fallbackItems.length,
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

  const isElevatedDetailUser =
    profile?.is_super_admin === true || profile?.role === "admin" || currentUserEmail === "edwin.qm@outlook.com";
  const detailViewGroups = useMemo(
    () => readDetailRqViewGroupPermissions(modulePermissions, isElevatedDetailUser),
    [isElevatedDetailUser, modulePermissions],
  );
  const detailSensitiveFlags = readDetailRqSensitiveFlags(modulePermissions?.metadata);
  const canViewDetailRq = modulePermissions?.can_view ?? true;
  const canViewPrices = modulePermissions?.can_view_prices ?? isElevatedDetailUser;
  const canViewSupplier = modulePermissions?.can_view_supplier ?? isElevatedDetailUser;

  const hiddenBusinessFields = useMemo(() => {
    const hidden = new Set<string>();
    const allowedColumns = new Set(modulePermissions?.visible_columns ?? []);
    const useVisibleColumns = allowedColumns.size > 0;

    Object.keys(DETAIL_RQ_FIELD_ALIASES).forEach((field) => {
      if (useVisibleColumns && !allowedColumns.has(field)) {
        hidden.add(field);
        DETAIL_RQ_FIELD_ALIASES[field].forEach((alias) => hidden.add(normalizePermissionKey(alias)));
      }
    });

    if (!canViewPrices || !detailViewGroups.detail_rq_item_economic_data || !detailViewGroups.detail_rq_resource_summary) {
      ["moneda", "monto", "precio_unitario", "total"].forEach((field) => {
        hidden.add(field);
        DETAIL_RQ_FIELD_ALIASES[field]?.forEach((alias) => hidden.add(normalizePermissionKey(alias)));
      });
    }

    if (!canViewSupplier || !detailViewGroups.detail_rq_item_supplier_data) {
      hidden.add("proveedor");
      DETAIL_RQ_FIELD_ALIASES.proveedor.forEach((alias) => hidden.add(normalizePermissionKey(alias)));
    }

    if (!detailSensitiveFlags.can_view_oc) {
      hidden.add("oc");
      DETAIL_RQ_FIELD_ALIASES.oc.forEach((alias) => hidden.add(normalizePermissionKey(alias)));
    }

    if (!detailViewGroups.detail_rq_documents) {
      ["ficha_tecnica", "imagen_referencial", "archivos"].forEach((field) => {
        hidden.add(field);
        DETAIL_RQ_FIELD_ALIASES[field].forEach((alias) => hidden.add(normalizePermissionKey(alias)));
      });
    }

    return Array.from(hidden);
  }, [
    canViewPrices,
    canViewSupplier,
    detailSensitiveFlags.can_view_oc,
    detailViewGroups.detail_rq_documents,
    detailViewGroups.detail_rq_item_economic_data,
    detailViewGroups.detail_rq_item_supplier_data,
    detailViewGroups.detail_rq_resource_summary,
    modulePermissions?.visible_columns,
  ]);

  const hiddenDetailRqColumns = useMemo(() => {
    const hidden = new Set<string>();
    const allowedColumns = new Set(modulePermissions?.visible_columns ?? []);
    const useVisibleColumns = allowedColumns.size > 0;
    const hide = (keys: string[]) => keys.forEach((key) => hidden.add(key));

    if (!detailViewGroups.detail_rq_general_data) {
      hide(["proyecto", "requerimiento", "codigo_rq", "cotizacion_codigo", "oc", "cliente", "unidad_trabajo", "solicitante_rq", "estado_rq", "fecha_solicitud", "fecha_entrega_rq", "tipo_servicio_rq", "area_rq", "cliente_proyecto"]);
    }
    if (!detailViewGroups.detail_rq_indicators) {
      hide(["items_totales", "pendientes_rq", "en_proceso_rq", "atendidos_rq", "vb_completos_rq", "con_recurso_rq", "sin_recurso_rq", "con_ficha_suministrar_rq", "con_oc_os_rq", "con_guia_rq", "avance_rq"]);
    }
    if (!canViewPrices || !detailViewGroups.detail_rq_resource_summary || !detailViewGroups.detail_rq_item_economic_data) {
      hide(["precio_unitario", "moneda", "tc", "factor_eq_herr", "costo_total_presupuestado", "cant_stock", "compra", "ajuste", "atencion_real"]);
    }
    if (!canViewSupplier || !detailViewGroups.detail_rq_item_supplier_data) {
      hide(["proveedor", "condicion_pago", "tiempo_entrega"]);
    }
    if (!detailSensitiveFlags.can_view_oc) {
      hide(["oc", "oc_os_recurso"]);
    }
    if (!detailViewGroups.detail_rq_documents) {
      hide(["ficha", "imagen", "archivos", "ficha_tecnica_a_suministrar", "archivo_guia", "con_ficha_suministrar_rq", "con_guia_rq"]);
    }
    if (!detailViewGroups.detail_rq_actions) {
      hide(["acciones"]);
    }
    if (useVisibleColumns) {
      [
        "proyecto",
        "codigo_rq",
        "cotizacion_codigo",
        "oc",
        "cliente",
        "unidad_trabajo",
        "estado_rq",
        "avance_rq",
        "codigo_fabricante",
        "tipo_recurso",
        "descripcion",
        "informacion_adicional",
        "observaciones_item",
        "unidad",
        "cantidad",
        "precio_unitario",
        "moneda",
        "tc",
        "costo_total_presupuestado",
        "estado",
        "proveedor",
        "logistica_compra",
        "fecha_compra",
        "oc_os_recurso",
        "fecha_entrega",
        "guia_remision",
        "archivo_guia",
        "acciones",
      ].forEach((key) => {
        if (!allowedColumns.has(key)) hidden.add(key);
      });
    }

    return Array.from(hidden);
  }, [
    canViewPrices,
    canViewSupplier,
    detailSensitiveFlags.can_view_oc,
    detailViewGroups.detail_rq_actions,
    detailViewGroups.detail_rq_documents,
    detailViewGroups.detail_rq_general_data,
    detailViewGroups.detail_rq_indicators,
    detailViewGroups.detail_rq_item_economic_data,
    detailViewGroups.detail_rq_item_supplier_data,
    detailViewGroups.detail_rq_resource_summary,
    modulePermissions?.visible_columns,
  ]);

  useEffect(() => {
    const matrix = buildGlobalMatrix({ requerimientos, cotizaciones, detalleItems, recursos });
    setMatrixItems(matrix.items);
  }, [cotizaciones, detalleItems, recursos, requerimientos]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(matrixItems.length / pageSize));
    setPage((prev) => Math.min(prev, totalPages));
  }, [matrixItems.length, pageSize]);

  const openWorkspace = useCallback((row: Requerimiento) => {
    setSelectedId(row.id);
    const normalized = normalizeRequirementDates(row);
    setDraft({ ...normalized });
    const cot = cotizaciones.find((item) => item.id === normalized.cotizacion_id);
    const quoteCurrency = cot?.moneda_cotizacion ?? "PEN";
    const localItems = detalleItems.filter((item) => item.requerimiento_id === normalized.id);
    if (localItems.length > 0) {
      const list = localItems.map((item) =>
        toEditableItem(item, recursos.find((recurso) => recurso.id === item.recurso_id), quoteCurrency),
      );
      setWorkspaceItems(list);
    } else {
      setWorkspaceItems([]);
      void loadRequirementItemsForRequirement({
        module: "detalle-rq",
        requirementId: normalized.id,
        reason: "workspace-open",
      }).then((result) => {
        setDetalleItems((prev) => {
          const withoutCurrent = prev.filter((item) => item.requerimiento_id !== normalized.id);
          return [...withoutCurrent, ...result.rows];
        });
        const list = result.rows.map((item) =>
          toEditableItem(item, recursos.find((recurso) => recurso.id === item.recurso_id), quoteCurrency),
        );
        setWorkspaceItems(list);
      });
    }
    writeSessionUiState(DETALLE_RQ_UI_STATE_KEY, {
      page,
      pageSize,
      rqCode: normalized.codigo,
    });
    updateUrlState({ page, rqCode: normalized.codigo, rqId: normalized.id });
    debugUiState("detalle-rq", "workspace-opened", { rqCode: normalized.codigo });
  }, [cotizaciones, detalleItems, page, pageSize, recursos]);

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
        debugUiState("detalle-rq", "restore-missing-record", { rqCode, rqId });
      }
      return;
    }
    queryOpenedRef.current = restoreKey;
    restoredUiStateRef.current = true;
    openWorkspace(target);
    debugUiState("detalle-rq", "restored", { rqCode, rqId, found: true });
  }, [initialUiState.rqCode, requerimientos, openWorkspace]);

  useEffect(() => {
    const hasPendingRestore =
      !restoredUiStateRef.current &&
      Boolean(readUrlStringParam("rqCode") || readUrlStringParam("rqId") || initialUiState.rqCode);
    if (hasPendingRestore) return;

    writeSessionUiState(DETALLE_RQ_UI_STATE_KEY, {
      page,
      pageSize,
      rqCode: draft?.codigo ?? null,
    });
    updateUrlState({ page, rqCode: draft?.codigo ?? null });
    debugUiState("detalle-rq", "saved", {
      page,
      pageSize,
      rqCode: draft?.codigo ?? null,
      source: dataSource,
    });
  }, [dataSource, draft?.codigo, initialUiState.rqCode, page, pageSize]);

  function patchRow(rowId: string, patch: Partial<EditableRequirementItem>) {
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
    if (!recurso) return;
    setWorkspaceItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const precio = row.precio_unitario > 0 ? row.precio_unitario : recurso.precio_unitario_ref;
        const proveedor = demoData.listCatalogProveedores().find((item) => item.nombre === recurso.proveedor)?.nombre ?? recurso.proveedor;
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
          ficha_tecnica_a_suministrar_files: recurso.resourceFiles.fichaTecnica ? [recurso.resourceFiles.fichaTecnica] : [],
          tiempo_entrega: recurso.tiempo_entrega_ref,
        };
        return { ...next, ...computeCurrencyTcAndTotal(next, cotizacionMoneda) };
      }),
    );
  }

  function saveWorkspace() {
    if (!draft || !selectedId) return;
    if (isSupabaseReadOnly) {
      setWarning("El detalle RQ importado desde Supabase está disponible solo en lectura por ahora.");
      return;
    }
    const normalizedDraft = normalizeRequirementDates(draft);
    demoData.updateRequerimiento(selectedId, normalizedDraft);
    setRequerimientos((prev) => prev.map((rq) => (rq.id === selectedId ? normalizedDraft : rq)));
    const normalized: DetalleRequerimientoItem[] = workspaceItems
      .filter((row) => row.recurso_id)
      .map((row, index) => ({
        id: row.id.startsWith("tmp-") ? `dtrq-${selectedId}-${index + 1}` : row.id,
        requerimiento_id: selectedId,
        recurso_id: row.recurso_id,
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

    demoData.replaceDetalleItems(selectedId, normalized);
    setDetalleItems((prev) => [...normalized, ...prev.filter((it) => it.requerimiento_id !== selectedId)]);
  }

  const totalPages = Math.max(1, Math.ceil(matrixItems.length / pageSize));
  const pagedMatrixItems = useMemo(
    () => matrixItems.slice((page - 1) * pageSize, page * pageSize),
    [matrixItems, page, pageSize],
  );

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

  const requirementTotal = useMemo(
    () => Number(resourceTypeSummary.reduce((acc, row) => acc + row.total, 0).toFixed(2)),
    [resourceTypeSummary],
  );

  const requirementTotalsByCurrency = useMemo(() => ({ [cotizacionMoneda]: requirementTotal }), [cotizacionMoneda, requirementTotal]);

  function matrixCurrencyForRow(rowId: string): "PEN" | "USD" {
    const context = matrixContextByItemId[rowId];
    if (!context) return "PEN";
    const rq = requerimientos.find((item) => item.id === context.requirementId);
    if (!rq) return "PEN";
    const cot = cotizaciones.find((item) => item.id === rq.cotizacion_id);
    return cot?.moneda_cotizacion ?? "PEN";
  }

  function patchMatrixRow(rowId: string, patch: Partial<EditableRequirementItem>) {
    const quoteCurrency = matrixCurrencyForRow(rowId);
    setMatrixItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = { ...row, ...patch };
        const computed = computeCurrencyTcAndTotal(next, quoteCurrency);
        next.tc = computed.tc;
        next.subtotal = computed.subtotal;
        next.costo_total_presupuestado = computed.costo_total_presupuestado;
        next.costo_unitario = computed.costo_unitario;
        return next;
      }),
    );
  }

  function selectMatrixRecurso(rowId: string, recursoId: string) {
    const recurso = recursos.find((item) => item.id === recursoId);
    if (!recurso) return;
    const quoteCurrency = matrixCurrencyForRow(rowId);
    setMatrixItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const precio = row.precio_unitario > 0 ? row.precio_unitario : recurso.precio_unitario_ref;
        const proveedor = demoData.listCatalogProveedores().find((item) => item.nombre === recurso.proveedor)?.nombre ?? recurso.proveedor;
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
          moneda: quoteCurrency,
          proveedor,
          marca: recurso.marca,
          ficha_tecnica_a_suministrar: recurso.resourceFiles.fichaTecnica as ResourceFileMeta | null,
          ficha_tecnica_a_suministrar_files: recurso.resourceFiles.fichaTecnica ? [recurso.resourceFiles.fichaTecnica] : [],
          tiempo_entrega: recurso.tiempo_entrega_ref,
        };
        return { ...next, ...computeCurrencyTcAndTotal(next, quoteCurrency) };
      }),
    );
  }

  function openMatrixItemModal(item: EditableRequirementItem) {
    setSelectedMatrixItemId(item.id);
    setSelectedMatrixItemDraft(cloneEditableItem(item));
    setIsMatrixItemEditing(false);
  }

  function closeMatrixItemModal() {
    setSelectedMatrixItemId(null);
    setSelectedMatrixItemDraft(null);
    setIsMatrixItemEditing(false);
  }

  function saveMatrixItemDraft() {
    if (!selectedMatrixItemId || !selectedMatrixItemDraft) return;
    if (isSupabaseReadOnly) {
      setWarning("Los ítems importados desde Supabase están disponibles solo en lectura por ahora.");
      return;
    }
    const quoteCurrency = matrixCurrencyForRow(selectedMatrixItemId);
    const normalized = {
      ...selectedMatrixItemDraft,
      fecha_coti: normalizeDateForStorage(selectedMatrixItemDraft.fecha_coti),
      fecha_entrega: normalizeDateForStorage(selectedMatrixItemDraft.fecha_entrega),
      fecha_compra: normalizeDateForStorage(selectedMatrixItemDraft.fecha_compra),
      eq_fecha_aprob: normalizeDateForStorage(selectedMatrixItemDraft.eq_fecha_aprob),
      ll_fecha_aprob: normalizeDateForStorage(selectedMatrixItemDraft.ll_fecha_aprob),
      hb_fecha_aprob: normalizeDateForStorage(selectedMatrixItemDraft.hb_fecha_aprob),
    };
    const computed = computeCurrencyTcAndTotal(normalized, quoteCurrency);
    setMatrixItems((prev) =>
      prev.map((row) =>
        row.id === selectedMatrixItemId
          ? {
              ...normalized,
              tc: computed.tc,
              subtotal: computed.subtotal,
              costo_total_presupuestado: computed.costo_total_presupuestado,
              costo_unitario: computed.costo_unitario,
            }
          : row,
      ),
    );
    setIsMatrixItemEditing(false);
  }

  return (
    <section className="app-table-section min-w-0">
      {isPermissionsLoading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-white text-sm text-muted">
          Cargando permisos...
        </div>
      ) : isDataLoading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-white text-sm text-muted">
          Cargando detalle RQ...
        </div>
      ) : !canViewDetailRq ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-white text-sm text-muted">
          No tienes permiso para ver el Detalle RQ.
        </div>
      ) : !detailViewGroups.detail_rq_items_table ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-border bg-white text-sm text-muted">
          Detalle de requerimiento oculto por permisos.
        </div>
      ) : (
        <RequirementItemsGrid
          items={pagedMatrixItems}
          recursos={recursos}
          cotizacionMoneda="PEN"
          resourceTypeOptions={resourceTypeCatalog}
          currencyOptions={demoData.listCatalogMonedas().map((item) => item.codigo)}
          statusOptions={demoData.listCatalogEstadoDetalleRq().map((item) => item.nombre)}
          providerOptions={demoData.listCatalogProveedores().map((item) => item.nombre)}
          eqOptions={demoData.listCatalogEq().map((item) => item.nombre)}
          llOptions={demoData.listCatalogLl().map((item) => item.nombre)}
          hbOptions={demoData.listCatalogHb().map((item) => item.nombre)}
          logisticaCompraOptions={demoData.listCatalogLogisticaCompra().map((item) => item.nombre)}
          onAddRow={() => setMatrixItems((prev) => [...prev, defaultRow("PEN")])}
          onRemoveRow={(id) => setMatrixItems((prev) => prev.filter((row) => row.id !== id))}
          onSelectRecurso={selectMatrixRecurso}
          onPatchRow={patchMatrixRow}
          titleLabel="Detalle de RQ"
          showAddRowButton={false}
          hideIndexColumn
          hiddenColumnKeys={hiddenDetailRqColumns}
          maxHeightClassName={pageSize === 12 ? "" : "max-h-[62vh]"}
          bodyOverflowYClassName={pageSize === 12 ? "overflow-y-hidden" : "overflow-y-auto"}
          onRowClick={detailViewGroups.detail_rq_item_detail ? openMatrixItemModal : undefined}
        />
      )}
      {!isPermissionsLoading && !isDataLoading && canViewDetailRq && detailViewGroups.detail_rq_items_table ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Fuente: {dataSource === "supabase" ? "Supabase" : "Demo local"}</span>
          <span>Registros: {matrixItems.length}</span>
          <button
            type="button"
            onClick={() => void refreshDetalleRqData()}
            className="inline-flex h-6 min-h-6 items-center gap-1 rounded-md border border-border px-2 text-xs leading-none text-stone-600 hover:bg-stone-100"
            title="Forzar recarga del detalle RQ"
          >
            Actualizar datos
          </button>
          {warning ? <span className="text-amber-700">{warning}</span> : null}
        </div>
      ) : null}
      {!isPermissionsLoading && canViewDetailRq && detailViewGroups.detail_rq_items_table ? (
      <div className="mt-2 flex flex-none items-center justify-between text-xs text-muted">
        <p>
          Mostrando {matrixItems.length === 0 ? 0 : (page - 1) * pageSize + 1} -{" "}
          {Math.min(page * pageSize, matrixItems.length)} de {matrixItems.length}
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

      <RequirementWorkspaceModal
        open={!!selectedId}
        onClose={() => {
          setSelectedId(null);
          setDraft(null);
          writeSessionUiState(DETALLE_RQ_UI_STATE_KEY, {
            page,
            pageSize,
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
        recursos={recursos}
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
        onAddRow={() => setWorkspaceItems((prev) => [...prev, defaultRow(cotizacionMoneda)])}
        onRemoveRow={(id) => setWorkspaceItems((prev) => prev.filter((row) => row.id !== id))}
        onSelectRecurso={selectRecurso}
        onPatchRow={patchRow}
        onCancel={() => {
          if (!selected) return;
          openWorkspace(selected);
        }}
        onSave={saveWorkspace}
        hiddenBusinessFields={hiddenBusinessFields}
        canViewPrices={canViewPrices && detailViewGroups.detail_rq_resource_summary}
      />

      <MatrixItemModal
        open={!!selectedMatrixItemId && !!selectedMatrixItemDraft}
        item={selectedMatrixItemDraft}
        context={selectedMatrixContext}
        isEditing={isMatrixItemEditing}
        resourceTypeOptions={resourceTypeCatalog}
        currencyOptions={demoData.listCatalogMonedas().map((item) => item.codigo)}
        statusOptions={demoData.listCatalogEstadoDetalleRq().map((item) => item.nombre)}
        providerOptions={demoData.listCatalogProveedores().map((item) => item.nombre)}
        hiddenBusinessFields={hiddenBusinessFields}
        canViewPrices={canViewPrices}
        canViewSupplier={canViewSupplier}
        viewGroupPermissions={detailViewGroups}
        onPatch={(patch) =>
          setSelectedMatrixItemDraft((prev) => (prev ? { ...prev, ...patch } : prev))
        }
        onEdit={() => setIsMatrixItemEditing(true)}
        onSave={saveMatrixItemDraft}
        onCancelEdit={() => {
          if (!selectedMatrixItemId) return;
          const source = matrixItems.find((row) => row.id === selectedMatrixItemId);
          if (!source) return;
          setSelectedMatrixItemDraft(cloneEditableItem(source));
          setIsMatrixItemEditing(false);
        }}
        onClose={closeMatrixItemModal}
      />
    </section>
  );
}
