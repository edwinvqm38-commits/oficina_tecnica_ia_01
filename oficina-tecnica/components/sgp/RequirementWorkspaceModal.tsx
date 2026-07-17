"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { RequirementItemsGrid, type EditableRequirementItem } from "@/components/sgp/RequirementItemsGrid";
import { StatusBadge } from "@/components/sgp/StatusBadge";
import { FieldLabelIcon, type IconName } from "@/components/sgp/ui/FieldLabelIcon";
import { FieldLockButton } from "@/components/sgp/ui/FieldLockButton";
import { DateTextInput } from "@/components/sgp/ui/DateTextInput";
import { EmailThreadButton } from "@/components/sgp/EmailThreadButton";
import type { EstadoRequerimiento, Recurso, Requerimiento } from "@/lib/sgp/demoData";
import { formatCurrencyNumber, formatDate } from "@/lib/sgp/utils";

type ResourceTypeSummary = {
  tipo_recurso: string;
  total: number;
};

type RequirementWorkspaceModalProps = {
  open: boolean;
  zIndexClassName?: string;
  onClose: () => void;
  requerimiento: Requerimiento | null;
  proyecto: string;
  cotizacionCodigo: string;
  cotizacionOc: string;
  cliente: string;
  unidadTrabajo: string;
  cotizacionMoneda: "PEN" | "USD";
  recursos: Recurso[];
  draft: Requerimiento | null;
  items: EditableRequirementItem[];
  resourceTypeSummary: ResourceTypeSummary[];
  totalsByCurrency: Record<string, number>;
  resourceTypeOptions: string[];
  currencyOptions: string[];
  statusOptions: string[];
  providerOptions: string[];
  solicitanteOptions: string[];
  tipoServicioOptions: string[];
  areaOptions: string[];
  eqOptions: string[];
  llOptions: string[];
  hbOptions: string[];
  logisticaCompraOptions: string[];
  onDraftChange: (patch: Partial<Requerimiento>) => void;
  onAddRow: () => string | void;
  onRemoveRow: (id: string) => void;
  onSelectRecurso: (rowId: string, recursoId: string) => void;
  onAssignCatalogRecurso?: (recursoId: string) => string | null;
  onCreateRecurso?: (rowId: string | null) => void;
  onPatchRow: (rowId: string, patch: Partial<EditableRequirementItem>) => void;
  onCancel: () => void;
  onSave: (itemsOverride?: EditableRequirementItem[]) => void | boolean | Promise<void | boolean>;
  onSaveTable?: (itemsOverride?: EditableRequirementItem[]) => void | boolean | Promise<void | boolean>;
  isSaving?: boolean;
  canCreateRecurso?: boolean;
  canEditItems?: boolean;
  canSaveItems?: boolean;
  canUseResourceCatalog?: boolean;
  canAddCatalogResource?: boolean;
  isCreatingRecurso?: boolean;
  hiddenItemColumnKeys?: string[];
  hiddenBusinessFields?: string[];
  canViewPrices?: boolean;
};

type LabelValueRowProps = {
  icon: IconName;
  label: string;
  value: ReactNode;
  noBorder?: boolean;
  hidden?: boolean;
  valueClassName?: string;
};

type WorkspaceActionIconName = "cancel" | "save" | "close";

const ResourceCatalogPanel = dynamic(
  () => import("@/components/sgp/resources/ResourceCatalogPanel").then((mod) => mod.ResourceCatalogPanel),
  { ssr: false },
);

function compactInfoRowClassName(): string {
  return "flex h-7 min-h-7 items-center justify-between gap-2 border-b border-stone-200 py-0 leading-none last:border-b-0";
}

function LabelValueRow({ icon, label, value, noBorder = false, hidden = false, valueClassName = "" }: LabelValueRowProps) {
  return (
    <div className={`${compactInfoRowClassName()} ${noBorder ? "!border-b-0" : ""}`}>
      {hidden ? <span className="block h-6" /> : <FieldLabelIcon icon={icon} label={label} className="whitespace-nowrap" />}
      <div className={`min-w-0 text-[11px] font-medium leading-none text-stone-700 ${valueClassName}`}>{hidden ? null : value}</div>
    </div>
  );
}

function normalizeBusinessFieldKey(value: string): string {
  return value.trim().toLowerCase();
}

function generalInfoSelectClassName(isDisabled: boolean): string {
  return `h-6 min-h-6 w-[150px] rounded border px-1.5 py-0 text-[11px] leading-6 outline-none ${
    isDisabled
      ? "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-600"
      : "border-stone-300 bg-white text-stone-800"
  }`;
}

function generalInfoDateInputClassName(): string {
  return "h-6 min-h-6 w-[150px] rounded border border-stone-300 bg-white px-1.5 py-0 text-[11px] leading-6 outline-none";
}

function generalInfoTextInputClassName(): string {
  return "h-6 min-h-6 w-[190px] rounded border border-stone-300 bg-white px-1.5 py-0 text-[11px] font-semibold leading-6 text-stone-800 outline-none";
}

function generalInfoDateReadClassName(): string {
  return "inline-flex h-6 min-h-6 w-[150px] items-center justify-end px-1.5 text-[11px] font-medium leading-6 text-stone-700";
}

function generalInfoReadValueClassName(): string {
  return "inline-flex h-6 min-h-6 w-[150px] items-center justify-end px-1.5 text-[11px] font-semibold leading-6 text-stone-700";
}

function generalInfoCodeReadValueClassName(): string {
  return "inline-flex h-6 min-h-6 max-w-full items-center justify-end whitespace-nowrap px-1.5 text-[11px] font-semibold leading-6 text-stone-700";
}

function formatTotalsByCurrency(totals: Record<string, number>): string {
  const entries = Object.entries(totals);
  if (entries.length === 0) return "PEN 0.00";
  return entries.map(([currency, value]) => `${currency} ${formatCurrencyNumber(value)}`).join(" · ");
}

function splitInColumns<T>(items: T[], columns: number): T[][] {
  const perColumn = Math.ceil(items.length / columns);
  return Array.from({ length: columns }, (_, idx) =>
    items.slice(idx * perColumn, idx * perColumn + perColumn),
  );
}

function summaryIconForType(typeName: string): IconName {
  const key = typeName.toLowerCase();
  if (key.includes("mano de obra directa")) return "hard-hat";
  if (key.includes("mano de obra indirecta")) return "users";
  if (key.includes("epps")) return "shield";
  if (key.includes("examen médico")) return "heart-pulse";
  if (key.includes("capacitaciones")) return "graduation-cap";
  if (key.includes("inducción")) return "book-open";
  if (key.includes("eka")) return "book-marked";
  if (key.includes("lavado")) return "shirt";
  if (key.includes("alimentación")) return "store";
  if (key.includes("reglamento")) return "clipboard-list";
  if (key.includes("antecedentes")) return "file-search";
  if (key.includes("materiales")) return "package";
  if (key.includes("consumibles")) return "package-open";
  if (key.includes("herramientas")) return "wrench";
  if (key.includes("equipos")) return "cog";
  if (key.includes("vehículos")) return "truck";
  if (key.includes("transporte")) return "bus";
  if (key.includes("sub contratos")) return "handshake";
  if (key.includes("gastos generales")) return "wallet";
  return "tags";
}

function progressBadgeClass(progress: number): string {
  if (progress <= 0) return "border-rose-200 bg-rose-100 text-rose-700";
  if (progress <= 20) return "border-rose-200 bg-rose-50 text-rose-700";
  if (progress <= 40) return "border-amber-200 bg-amber-50 text-amber-700";
  if (progress <= 60) return "border-yellow-200 bg-yellow-50 text-yellow-700";
  if (progress <= 80) return "border-sky-200 bg-sky-50 text-sky-700";
  if (progress < 100) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-emerald-300 bg-emerald-100 text-emerald-800";
}

function WorkspaceActionIcon({ name }: { name: WorkspaceActionIconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "cancel") {
    return (
      <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden>
        <circle {...common} cx="12" cy="12" r="8" />
        <path {...common} d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
      </svg>
    );
  }
  if (name === "save") {
    return (
      <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden>
        <path {...common} d="M5 4h11l3 3v13H5z" />
        <path {...common} d="M8 4v5h8V4M9 20v-5h6v5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden>
      <path {...common} d="m8 8 8 8M16 8l-8 8" />
    </svg>
  );
}

function workspaceActionButtonClassName(iconOnly = false): string {
  return `inline-flex h-6 min-h-6 items-center justify-center gap-1 rounded border border-stone-200 text-[11px] leading-none text-stone-500 hover:bg-stone-100 hover:border-stone-300 active:bg-stone-200 ${
    iconOnly ? "w-6 px-0" : "px-1.5 whitespace-nowrap"
  }`;
}

export function RequirementWorkspaceModal({
  open,
  zIndexClassName = "z-50",
  onClose,
  requerimiento,
  proyecto,
  cotizacionCodigo,
  cotizacionOc,
  cliente,
  unidadTrabajo,
  cotizacionMoneda,
  recursos,
  draft,
  items,
  resourceTypeSummary,
  totalsByCurrency,
  resourceTypeOptions,
  currencyOptions,
  statusOptions,
  providerOptions,
  solicitanteOptions,
  tipoServicioOptions,
  areaOptions,
  eqOptions,
  llOptions,
  hbOptions,
  logisticaCompraOptions,
  onDraftChange,
  onAddRow,
  onRemoveRow,
  onSelectRecurso,
  onAssignCatalogRecurso,
  onCreateRecurso,
  onPatchRow,
  onCancel,
  onSave,
  onSaveTable,
  isSaving = false,
  canCreateRecurso = false,
  canEditItems = true,
  canSaveItems = true,
  canUseResourceCatalog = true,
  canAddCatalogResource = true,
  isCreatingRecurso = false,
  hiddenItemColumnKeys = [],
  hiddenBusinessFields = [],
  canViewPrices = true,
}: RequirementWorkspaceModalProps) {
  const [isGeneralInfoEditing, setIsGeneralInfoEditing] = useState(false);
  const [catalogPanelOpen, setCatalogPanelOpen] = useState(false);
  const generalSnapshotRef = useRef("");
  const hiddenBusinessFieldSet = useMemo(
    () => new Set(hiddenBusinessFields.map((field) => normalizeBusinessFieldKey(field))),
    [hiddenBusinessFields],
  );
  const isBusinessFieldHidden = (fieldKey: string): boolean => hiddenBusinessFieldSet.has(normalizeBusinessFieldKey(fieldKey));

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setIsGeneralInfoEditing(false);
      generalSnapshotRef.current = "";
    }
  }, [open, draft?.id]);

  const generalComparable = useMemo(() => {
    if (!draft) return "";
    return JSON.stringify({
      codigo: draft.codigo,
      solicitante_rq: draft.solicitante_rq,
      estado: draft.estado,
      fecha_solicitud: draft.fecha_solicitud,
      fecha_requerida: draft.fecha_requerida,
      tipo_servicio: draft.tipo_servicio,
      area: draft.area,
    });
  }, [draft]);

  const statusIndicators = useMemo(() => {
    const total = items.length;
    const pending = items.filter((item) => item.estado.toLowerCase().includes("pend")).length;
    const inProgress = items.filter((item) => item.estado.toLowerCase().includes("proceso")).length;
    const attended = items.filter((item) => item.estado.toLowerCase().includes("atendid")).length;
    const approvals = items.filter(
      (item) =>
        item.eq.toLowerCase() === "aprobado" &&
        item.ll.toLowerCase() === "aprobado" &&
        item.hb.toLowerCase() === "aprobado",
    ).length;
    const progress = total > 0 ? Math.round((attended / total) * 100) : 0;
    const withResource = items.filter((item) => Boolean(item.recurso_id)).length;
    const withoutResource = total - withResource;
    const withFichaSuministrar = items.filter((item) => Boolean(item.ficha_tecnica_a_suministrar)).length;
    const withOcOs = items.filter((item) => item.oc_os_recurso.trim().length > 0).length;
    const withGuia = items.filter((item) => item.guia_remision.trim().length > 0).length;
    return {
      total,
      pending,
      inProgress,
      attended,
      approvals,
      progress,
      withResource,
      withoutResource,
      withFichaSuministrar,
      withOcOs,
      withGuia,
    };
  }, [items]);
  function toggleGeneralInfoEdition() {
    if (!isGeneralInfoEditing) {
      generalSnapshotRef.current = generalComparable;
      setIsGeneralInfoEditing(true);
      return;
    }
    const hasGeneralInfoChanges = generalComparable !== generalSnapshotRef.current;
    if (hasGeneralInfoChanges) {
      generalSnapshotRef.current = generalComparable;
    }
    setIsGeneralInfoEditing(false);
  }

  async function handleSaveTable(itemsOverride: EditableRequirementItem[] = items) {
    if (process.env.NODE_ENV === "development") {
      console.log("[RQ_SAVE_DEBUG] RequirementWorkspaceModal ejecuta onSaveTable", {
        itemsPropLength: items.length,
        itemsOverrideLength: itemsOverride.length,
        requerimientoId: requerimiento?.id ?? null,
        codigoRq: requerimiento?.codigo ?? null,
        hasOnSave: Boolean(onSave),
        hasOnSaveTable: Boolean(onSaveTable),
      });
      if (!onSaveTable) {
        console.error("[RQ_SAVE_DEBUG] onSaveTable no está conectado en RequirementWorkspaceModal", {
          itemsPropLength: items.length,
          itemsOverrideLength: itemsOverride.length,
          requerimientoId: requerimiento?.id ?? null,
          codigoRq: requerimiento?.codigo ?? null,
          hasOnSave: Boolean(onSave),
        });
      }
    }
    return await (onSaveTable ?? onSave)(itemsOverride);
  }

  const closeResourceCatalog = useCallback(() => {
    setCatalogPanelOpen(false);
  }, []);

  const openResourceCatalog = useCallback(() => {
    if (!canUseResourceCatalog) return;
    setCatalogPanelOpen(true);
  }, [canUseResourceCatalog]);

  const handleTableEditingModeChange = useCallback((editing: boolean) => {
    if (!editing) {
      setCatalogPanelOpen(false);
    }
  }, []);

  const handleCatalogResourceSelect = useCallback((resourceId: string) => {
    if (!canAddCatalogResource) return;
    const targetRowId = onAssignCatalogRecurso
      ? onAssignCatalogRecurso(resourceId)
      : onAddRow();
    if (!targetRowId) return;
    if (!onAssignCatalogRecurso) {
      onSelectRecurso(targetRowId, resourceId);
    }
  }, [canAddCatalogResource, onAddRow, onAssignCatalogRecurso, onSelectRecurso]);

  if (!open || !requerimiento || !draft) return null;

  if (!generalSnapshotRef.current) {
    generalSnapshotRef.current = generalComparable;
  }

  const requirementEmailSubject = [
    cotizacionCodigo,
    cotizacionOc || "SIN OC",
    draft.codigo,
    proyecto,
  ].map((part) => String(part || "-").trim() || "-").join(" / ");
  const requirementEmailRows = [
    { label: "Cotización", value: cotizacionCodigo },
    { label: "OC", value: cotizacionOc || "-" },
    { label: "Requerimiento", value: draft.codigo },
    { label: "Proyecto", value: proyecto },
    { label: "Cliente", value: cliente },
    { label: "Unidad de trabajo", value: unidadTrabajo },
    { label: "Estado", value: draft.estado },
    { label: "Fecha requerida", value: formatDate(draft.fecha_requerida) || "-" },
    { label: "Total RQ", value: `${cotizacionMoneda} ${formatCurrencyNumber(draft.total_rq ?? 0)}` },
  ];
  const isResourceCatalogVisible = catalogPanelOpen && canUseResourceCatalog && canEditItems;
  const workspaceActions = (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
      <EmailThreadButton
        kind="requirement"
        entityCode={draft.codigo}
        subject={requirementEmailSubject}
        title={`Requerimiento ${draft.codigo}`}
        linkPath={`/requerimientos?rqCode=${encodeURIComponent(draft.codigo)}`}
        summaryRows={requirementEmailRows}
        className={workspaceActionButtonClassName()}
        buttonLabel="Correo"
      />
      <button onClick={onCancel} className={workspaceActionButtonClassName()}>
        <WorkspaceActionIcon name="cancel" />
        <span>Cancelar</span>
      </button>
      <button onClick={() => void handleSaveTable(items)} disabled={isSaving} className={workspaceActionButtonClassName()}>
        <WorkspaceActionIcon name="save" />
        <span>{isSaving ? "Guardando..." : "Guardar"}</span>
      </button>
      <button
        onClick={onClose}
        title="Cerrar"
        aria-label="Cerrar"
        className={workspaceActionButtonClassName(true)}
      >
        <WorkspaceActionIcon name="close" />
      </button>
    </div>
  );

  return (
    <div className={`fixed inset-0 ${zIndexClassName} bg-black/20 p-3 md:p-4`}>
      <div className="mx-auto flex h-[calc(100vh-24px)] max-h-[calc(100vh-24px)] w-[92vw] max-w-[1600px] flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-lg">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
          <div className="mb-2 flex flex-none items-center justify-end lg:hidden">
            <button
              type="button"
              onClick={() => setCatalogPanelOpen((current) => !current)}
              className="inline-flex h-7 items-center rounded border border-border bg-white px-2 text-[11px] font-medium text-stone-600"
            >
              {catalogPanelOpen ? "Ocultar catálogo" : "Catálogo de recursos"}
            </button>
          </div>
          <div
            className={`grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden ${
              catalogPanelOpen ? "lg:grid-cols-[minmax(0,1fr)_minmax(340px,390px)]" : "lg:grid-cols-1"
            }`}
          >
            <div className="flex min-h-0 flex-col overflow-hidden">
          <section className="mb-2 flex-none">
            <div
              className={`grid grid-cols-1 items-stretch gap-2 ${
                catalogPanelOpen ? "" : "xl:grid-cols-[1.35fr_1fr]"
              }`}
            >
              <div className="flex min-w-0 flex-col">
                <div className="mb-1 flex min-h-6 items-center justify-between gap-2">
                  <FieldLabelIcon icon="file-text" label="Datos generales" className="text-[11px] font-medium" />
                  <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
                    {catalogPanelOpen ? workspaceActions : null}
                    <FieldLockButton
                      locked={!isGeneralInfoEditing}
                      label={isGeneralInfoEditing ? "Guardar datos" : "Editar datos"}
                      onToggle={toggleGeneralInfoEdition}
                    />
                  </div>
                </div>
                <div className="rounded border border-border bg-white px-2 pt-2 pb-2">
                  <div className="relative grid grid-cols-1 gap-x-3 gap-y-0 border-t border-stone-200 md:grid-cols-3 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:border-b after:border-stone-200 after:content-['']">
                    <div className="border-b border-stone-200 md:col-span-3">
                      <LabelValueRow
                        icon="file-text"
                        label="Proyecto"
                        value={proyecto || "Sin definir"}
                        noBorder
                        hidden={isBusinessFieldHidden("proyecto")}
                      />
                    </div>
                    <div className="min-w-0 md:col-span-2">
                      <LabelValueRow
                        icon="clipboard-list"
                        label="Requerimiento"
                        value={
                          isGeneralInfoEditing ? (
                            <input
                              value={draft.codigo}
                              onChange={(event) => onDraftChange({ codigo: event.target.value })}
                              className={`${generalInfoTextInputClassName()} w-full min-w-0 whitespace-nowrap`}
                              placeholder="Código RQ"
                            />
                          ) : (
                            <span className={generalInfoCodeReadValueClassName()}>{draft.codigo}</span>
                          )
                        }
                        valueClassName="flex-1 text-right"
                      />
                    </div>
                    <LabelValueRow icon="file-text" label="Cotización" value={cotizacionCodigo} />
                    <LabelValueRow icon="file-text" label="OC" value={cotizacionOc || "-"} hidden={isBusinessFieldHidden("oc")} />
                    <LabelValueRow icon="building" label="Cliente" value={cliente} hidden={isBusinessFieldHidden("cliente")} />
                    <LabelValueRow
                      icon="map-pin"
                      label="Unidad de trabajo"
                      value={unidadTrabajo || "Sin definir"}
                      hidden={isBusinessFieldHidden("unidad_trabajo")}
                    />
                    <LabelValueRow
                      icon="user"
                      label="Solicitante de RQ"
                      value={
                        isGeneralInfoEditing ? (
                          <select
                            value={draft.solicitante_rq}
                            onChange={(event) => onDraftChange({ solicitante_rq: event.target.value })}
                            className={generalInfoSelectClassName(false)}
                          >
                            {solicitanteOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={generalInfoReadValueClassName()}>{draft.solicitante_rq}</span>
                        )
                      }
                    />
                    <LabelValueRow
                      icon="circle-dot"
                      label="Estado"
                      value={
                        isGeneralInfoEditing ? (
                          <select
                            value={draft.estado}
                            onChange={(event) => onDraftChange({ estado: event.target.value as EstadoRequerimiento })}
                            className={generalInfoSelectClassName(false)}
                          >
                            {statusOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={generalInfoReadValueClassName()}>{draft.estado}</span>
                        )
                      }
                    />
                    <LabelValueRow
                      icon="calendar"
                      label="Fecha solicitud"
                      value={
                        isGeneralInfoEditing ? (
                          <DateTextInput
                            value={draft.fecha_solicitud}
                            onChange={(value) => onDraftChange({ fecha_solicitud: value })}
                            className={generalInfoDateInputClassName()}
                          />
                        ) : (
                          <span className={generalInfoDateReadClassName()}>
                            {formatDate(draft.fecha_solicitud) || "-"}
                          </span>
                        )
                      }
                    />
                    <LabelValueRow
                      icon="calendar-days"
                      label="Fecha de entrega"
                      value={
                        isGeneralInfoEditing ? (
                          <DateTextInput
                            value={draft.fecha_requerida}
                            onChange={(value) => onDraftChange({ fecha_requerida: value })}
                            className={generalInfoDateInputClassName()}
                          />
                        ) : (
                          <span className={generalInfoDateReadClassName()}>
                            {formatDate(draft.fecha_requerida) || "-"}
                          </span>
                        )
                      }
                    />
                    <LabelValueRow
                      icon="tags"
                      label="Tipo de servicio"
                      noBorder
                      value={
                        isGeneralInfoEditing ? (
                          <select
                            value={draft.tipo_servicio}
                            onChange={(event) => onDraftChange({ tipo_servicio: event.target.value })}
                            className={generalInfoSelectClassName(false)}
                          >
                            {tipoServicioOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={generalInfoReadValueClassName()}>{draft.tipo_servicio}</span>
                        )
                      }
                    />
                    <LabelValueRow
                      icon="layout-grid"
                      label="Área"
                      noBorder
                      value={
                        isGeneralInfoEditing ? (
                          <select
                            value={draft.area}
                            onChange={(event) => onDraftChange({ area: event.target.value })}
                            className={generalInfoSelectClassName(false)}
                          >
                            {areaOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={generalInfoReadValueClassName()}>{draft.area}</span>
                        )
                      }
                    />
                    <div className="hidden md:block" />
                  </div>
                </div>

                <div className="mt-auto mb-px pt-[8px]">
                  <div className="mb-1">
                    <FieldLabelIcon icon="circle-dot" label="Indicadores del requerimiento" className="text-[11px] font-medium" />
                  </div>
                  <div className="rounded border border-border bg-white px-2 pt-2 pb-[7px]">
                    <div className="relative mt-px grid grid-cols-1 gap-x-3 border-t border-stone-200 md:grid-cols-2 xl:grid-cols-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:border-b after:border-stone-200 after:content-['']">
                      <LabelValueRow icon="hash" label="Ítems totales" value={statusIndicators.total} />
                      <LabelValueRow icon="circle-dot" label="Estado RQ" value={<StatusBadge status={draft.estado} />} />
                      <LabelValueRow icon="clock" label="Pendientes" value={statusIndicators.pending} />
                      <LabelValueRow icon="clipboard-check" label="En proceso" value={statusIndicators.inProgress} />
                      <LabelValueRow icon="check-circle" label="Atendidos" value={statusIndicators.attended} />
                      <LabelValueRow icon="shield-check" label="VB completos" value={statusIndicators.approvals} />
                      <LabelValueRow icon="list-checks" label="Con recurso" value={statusIndicators.withResource} />
                      <LabelValueRow icon="list-checks" label="Sin recurso" value={statusIndicators.withoutResource} />
                      <LabelValueRow
                        icon="file-up"
                        label="Con ficha suministrar"
                        value={statusIndicators.withFichaSuministrar}
                        noBorder
                      />
                      <LabelValueRow icon="file-text" label="Con OC/OS" value={statusIndicators.withOcOs} noBorder />
                      <LabelValueRow icon="truck" label="Con guía" value={statusIndicators.withGuia} noBorder />
                      <LabelValueRow
                        icon="percent"
                        label="Avance"
                        noBorder
                        value={
                          <span
                            className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${progressBadgeClass(
                              statusIndicators.progress,
                            )}`}
                          >
                            {statusIndicators.progress}%
                          </span>
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {!catalogPanelOpen ? (
              <div className="flex h-full min-w-0 flex-col">
                <div className="mb-1 flex min-h-6 items-center justify-between gap-2">
                  <FieldLabelIcon
                    icon="pie-chart"
                    label="Resumen por tipo de recurso"
                    className="text-[11px] font-medium"
                  />
                  {workspaceActions}
                </div>
                <div className="rounded border border-border bg-white px-2 pt-2 pb-[7px]">
                  <div className="relative mt-px grid grid-cols-1 gap-1.5 border-t border-stone-200 sm:grid-cols-2 xl:grid-cols-2 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:border-b after:border-stone-200 after:content-['']">
                    {splitInColumns(resourceTypeSummary, 2).map((column, columnIdx) => (
                      <div key={columnIdx} className="space-y-0 px-1">
                        {column.map((row) => (
                          <div
                            key={row.tipo_recurso}
                            className={compactInfoRowClassName()}
                          >
                            <div className="min-w-0">
                              <FieldLabelIcon icon={summaryIconForType(row.tipo_recurso)} label={`${row.tipo_recurso}:`} />
                            </div>
                            <p className="whitespace-nowrap text-[11px] font-medium text-stone-700">
                              {canViewPrices ? `${cotizacionMoneda} ${formatCurrencyNumber(row.total)}` : ""}
                            </p>
                          </div>
                        ))}
                        {columnIdx === 1 ? (
                          <div className={compactInfoRowClassName()}>
                            <span />
                            <p className="inline-flex rounded-md border border-stone-900 bg-stone-900 px-2.5 py-[3px] text-[11px] font-semibold text-white leading-none">
                              {canViewPrices ? `Total RQ: ${formatTotalsByCurrency(totalsByCurrency)}` : ""}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              ) : null}
            </div>
          </section>

          <div className="min-h-0 flex-1 overflow-hidden">
            <RequirementItemsGrid
              items={items}
              recursos={recursos}
              cotizacionMoneda={cotizacionMoneda}
              resourceTypeOptions={resourceTypeOptions}
              currencyOptions={currencyOptions}
              statusOptions={statusOptions}
              providerOptions={providerOptions}
              eqOptions={eqOptions}
              llOptions={llOptions}
              hbOptions={hbOptions}
              logisticaCompraOptions={logisticaCompraOptions}
              onAddRow={onAddRow}
              onOpenResourceCatalog={openResourceCatalog}
              onRemoveRow={onRemoveRow}
              onSelectRecurso={onSelectRecurso}
              onCreateRecurso={onCreateRecurso}
              onEditingModeChange={handleTableEditingModeChange}
              onPatchRow={onPatchRow}
              onSaveTable={handleSaveTable}
              isSavingTable={isSaving}
              canCreateRecurso={canCreateRecurso}
              canEditItems={canEditItems}
              canSaveItems={canSaveItems}
              canUseResourceCatalog={canUseResourceCatalog}
              canAddCatalogResource={canAddCatalogResource}
              isCreatingRecurso={isCreatingRecurso}
              hiddenColumnKeys={hiddenItemColumnKeys}
              fullHeight
              maxHeightClassName="h-full"
            />
          </div>
            </div>
            <div className={`${isResourceCatalogVisible ? "flex min-h-[320px]" : "hidden"} min-h-0 lg:min-h-0`}>
              {isResourceCatalogVisible ? (
                <ResourceCatalogPanel
                  resources={recursos}
                  onSelectResource={handleCatalogResourceSelect}
                  onClose={closeResourceCatalog}
                  canAddResource={canAddCatalogResource}
                  className="h-full"
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
