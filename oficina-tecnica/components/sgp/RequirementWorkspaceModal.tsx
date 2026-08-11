"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  RequirementItemsGrid,
  type EditableRequirementItem,
  type RequirementObservationStatus,
} from "@/components/sgp/RequirementItemsGrid";
import { StatusBadge } from "@/components/sgp/StatusBadge";
import { FieldLabelIcon, type IconName } from "@/components/sgp/ui/FieldLabelIcon";
import { FieldLockButton } from "@/components/sgp/ui/FieldLockButton";
import { DateTextInput } from "@/components/sgp/ui/DateTextInput";
import { EmailThreadButton, copyEmailHtmlWithFallback } from "@/components/sgp/EmailThreadButton";
import {
  RequirementObservationPanel,
  canReassignObservation,
  canReopenObservation,
  canRespondToObservation,
  canReviewObservation,
  observationCanResolveReason,
  observationEvidenceCount,
  observationStatusForItem,
  observationStatusLabel,
  resolveObservationUser,
  resolveObservationUserId,
  type ObservationEvidence,
  type ObservationAssignmentSource,
  type ObservationPriority,
  type ObservationUser,
  type ObservationWorkflowStatus,
  type RequirementObservation,
} from "@/components/sgp/RequirementObservationPanel";
import type { EstadoRequerimiento, Recurso, Requerimiento } from "@/lib/sgp/demoData";
import { buildPublicAppUrl } from "@/lib/app/publicUrl";
import { formatCurrencyNumber, formatDate } from "@/lib/sgp/utils";

type ResourceTypeSummary = {
  tipo_recurso: string;
  total: number;
};

type ManagementEconomicSummary = {
  base: number;
  oferta: number;
  real: number;
  margen_ofertado: number;
  porcentaje_margen_ofertado: number;
  margen_real: number;
  porcentaje_margen_real: number;
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
  managementEconomicSummary?: ManagementEconomicSummary | null;
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
  canSendRequirementEmail?: boolean;
  canSendManagementEmail?: boolean;
  currentUser?: ObservationUser | null;
  userDirectory?: ObservationUser[];
  loadingUsers?: boolean;
  usersLoadError?: string;
  onRetryUsers?: () => void;
};

type LabelValueRowProps = {
  icon: IconName;
  label: string;
  value: ReactNode;
  noBorder?: boolean;
  hidden?: boolean;
  valueClassName?: string;
};

type WorkspaceActionIconName = "cancel" | "save" | "close" | "copy" | "menu";
type WorkspaceTab = "recursos" | "observaciones";

type ObservationEmailAttachment = {
  name: string;
  size?: number;
  type?: string;
  url?: string | null;
};

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

function cleanEmailValue(value: string | number | null | undefined, fallback = "-"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function escapeEmailHtml(value: string | number | null | undefined): string {
  return cleanEmailValue(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatEmailQuantity(value: number): string {
  return Number.isFinite(value) ? formatCurrencyNumber(value) : "-";
}

function cleanLower(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function itemLooksPending(item: EditableRequirementItem): boolean {
  const state = cleanLower(item.estado);
  return state.includes("pend") || state.includes("observ") || state.includes("rechaz");
}

function itemLooksInProgress(item: EditableRequirementItem): boolean {
  const state = cleanLower(item.estado);
  const logistics = cleanLower(item.logistica_compra);
  return state.includes("proceso") || logistics.includes("proceso") || logistics.includes("compra");
}

function itemLooksAttended(item: EditableRequirementItem): boolean {
  const state = cleanLower(item.estado);
  return state.includes("atendid") || state.includes("complet") || state.includes("cerrad") || Boolean(item.guia_remision.trim());
}

function itemLooksDelivered(item: EditableRequirementItem): boolean {
  const state = cleanLower(item.estado);
  return state.includes("entreg") || Boolean(item.fecha_entrega.trim()) || Boolean(item.guia_remision.trim());
}

function itemHasQuotedData(item: EditableRequirementItem): boolean {
  return Boolean(item.fecha_coti.trim()) || item.precio_unitario > 0 || item.costo_total_presupuestado > 0;
}

function itemHasCostData(item: EditableRequirementItem): boolean {
  return item.precio_unitario > 0 || item.costo_total_presupuestado > 0;
}

function daysUntilLabel(rawDate: string): string {
  const formatted = formatDate(rawDate);
  if (!formatted) return "-";
  const [day, month, year] = formatted.split("/");
  const due = new Date(Number(year), Number(month) - 1, Number(day));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return `Atrasado ${Math.abs(diffDays)} d`;
  if (diffDays === 0) return "Vence hoy";
  return `${diffDays} d restantes`;
}

function buildRequirementEmailMetrics(
  items: EditableRequirementItem[],
  fechaEntrega: string,
  canViewPrices: boolean,
  totalsByCurrency: Record<string, number>,
) {
  const total = items.length;
  const attended = items.filter(itemLooksAttended).length;
  const pending = items.filter(itemLooksPending).length;
  const inProgress = items.filter(itemLooksInProgress).length;
  const delivered = items.filter(itemLooksDelivered).length;
  const quoted = items.filter(itemHasQuotedData).length;
  const withCost = items.filter(itemHasCostData).length;
  const progress = total > 0 ? Math.round((attended / total) * 100) : 0;
  return {
    total,
    attended,
    pending,
    inProgress,
    delivered,
    quoted,
    withCost,
    missingCost: Math.max(0, total - withCost),
    withOcOs: items.filter((item) => item.oc_os_recurso.trim().length > 0).length,
    withGuia: items.filter((item) => item.guia_remision.trim().length > 0).length,
    progress,
    daysLabel: daysUntilLabel(fechaEntrega),
    totalCostLabel: canViewPrices ? formatTotalsByCurrency(totalsByCurrency) : "",
  };
}

function emailKpiCell(label: string, value: string | number): string {
  return `
    <td style="width:25%;padding:0 6px 8px 0;vertical-align:top;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #dbe3ea;background:#ffffff;">
        <tr><td style="padding:8px 9px 2px;font-size:10px;line-height:13px;color:#64748b;text-transform:uppercase;font-weight:700;">${escapeEmailHtml(label)}</td></tr>
        <tr><td style="padding:0 9px 9px;font-size:15px;line-height:18px;color:#0f172a;font-weight:700;">${escapeEmailHtml(value)}</td></tr>
      </table>
    </td>`;
}

type ManagementKpiTone = "info" | "success" | "warning" | "danger" | "neutral";

function managementKpiStyle(tone: ManagementKpiTone): { border: string; background: string; label: string; value: string } {
  if (tone === "success") return { border: "#bbf7d0", background: "#f0fdf4", label: "#166534", value: "#14532d" };
  if (tone === "warning") return { border: "#fde68a", background: "#fffbeb", label: "#92400e", value: "#78350f" };
  if (tone === "danger") return { border: "#fecaca", background: "#fff1f2", label: "#be123c", value: "#881337" };
  if (tone === "neutral") return { border: "#e5e7eb", background: "#f8fafc", label: "#475569", value: "#111827" };
  return { border: "#bfdbfe", background: "#eff6ff", label: "#1d4ed8", value: "#172554" };
}

function managementKpiCell(label: string, value: string | number, tone: ManagementKpiTone): string {
  const style = managementKpiStyle(tone);
  return `
    <td style="width:20%;padding:4px;vertical-align:top;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;height:64px;border-collapse:collapse;border:1px solid ${style.border};background:${style.background};">
        <tr><td style="height:22px;padding:7px 8px 1px;font-size:9.5px;line-height:12px;color:${style.label};text-transform:uppercase;font-weight:700;white-space:nowrap;">${escapeEmailHtml(label)}</td></tr>
        <tr><td style="height:34px;padding:0 8px 8px;font-size:15px;line-height:18px;color:${style.value};font-weight:700;">${escapeEmailHtml(value)}</td></tr>
      </table>
    </td>`;
}

function managementKpiGridHtml(kpis: Array<{ label: string; value: string | number; tone: ManagementKpiTone }>): string {
  const visible = kpis.slice(0, 10);
  const rows = [visible.slice(0, 5), visible.slice(5, 10)];
  return rows
    .filter((row) => row.length > 0)
    .map((row) => {
      const filled = [...row];
      while (filled.length < 5) filled.push({ label: "", value: "", tone: "neutral" });
      return `<tr>${filled.map((item) => item.label ? managementKpiCell(item.label, item.value, item.tone) : `<td style="width:20%;padding:4px;"></td>`).join("")}</tr>`;
    })
    .join("");
}

function resourceTypeReportRows(input: {
  items: EditableRequirementItem[];
  resourceTypeSummary: ResourceTypeSummary[];
  canViewPrices: boolean;
  currency: string;
}): Array<{ tipo: string; cantidad: number; presencia: string; total: string }> {
  const countByType = new Map<string, number>();
  const labelByType = new Map<string, string>();
  input.items.forEach((item) => {
    const label = cleanEmailValue(item.tipo_recurso, "Sin tipo");
    const key = cleanLower(label);
    labelByType.set(key, label);
    countByType.set(key, (countByType.get(key) ?? 0) + 1);
  });

  input.resourceTypeSummary.forEach((row) => {
    const label = cleanEmailValue(row.tipo_recurso, "Sin tipo");
    labelByType.set(cleanLower(label), label);
  });

  return Array.from(labelByType.entries())
    .map(([key, label]) => {
      const summaryTotal = input.resourceTypeSummary.find((row) => cleanLower(row.tipo_recurso) === key)?.total ?? 0;
      const count = countByType.get(key) ?? 0;
      return {
        tipo: label,
        cantidad: count,
        presencia: count > 0 ? "Incluido" : "Sin ítems",
        totalValue: summaryTotal,
        total: input.canViewPrices ? `${input.currency} ${formatCurrencyNumber(summaryTotal)}` : "Oculto",
      };
    })
    .filter((row) => row.cantidad > 0 || row.totalValue > 0)
    .map((row) => ({
      tipo: row.tipo,
      cantidad: row.cantidad,
      presencia: row.presencia,
      total: row.total,
    }))
    .sort((a, b) => b.cantidad - a.cantidad || a.tipo.localeCompare(b.tipo, "es", { sensitivity: "base" }));
}

function economicValueLabel(value: number | null | undefined, currency: string, canViewPrices: boolean, isPercent = false): string {
  if (!canViewPrices) return "Oculto";
  if (!Number.isFinite(value)) return "-";
  if (isPercent) return `${formatCurrencyNumber(Number(value) * 100)}%`;
  return `${currency} ${formatCurrencyNumber(Number(value))}`;
}

function hasEconomicSummaryData(summary: ManagementEconomicSummary | null | undefined): boolean {
  if (!summary) return false;
  return [
    summary.base,
    summary.oferta,
    summary.real,
    summary.margen_ofertado,
    summary.porcentaje_margen_ofertado,
    summary.margen_real,
    summary.porcentaje_margen_real,
  ].some((value) => Number.isFinite(value) && Math.abs(Number(value)) > 0);
}

function compactEmailRows(rows: Array<[string, string | number | null | undefined]>): string {
  return rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="width:34%;padding:7px 9px;border:1px solid #e5e7eb;background:#f8fafc;font-size:11px;line-height:15px;color:#475569;font-weight:700;">${escapeEmailHtml(label)}</td>
          <td style="padding:7px 9px;border:1px solid #e5e7eb;font-size:11px;line-height:15px;color:#111827;">${escapeEmailHtml(value)}</td>
        </tr>`,
    )
    .join("");
}

function buildRequirementEmailPlainBody(input: {
  title: string;
  link: string;
  codigo: string;
  proyecto: string;
  cliente: string;
  unidadTrabajo: string;
  cotizacionCodigo: string;
  cotizacionOc: string;
  solicitante: string;
  fechaSolicitud: string;
  fechaEntrega: string;
  updatedAt: string;
  estado: string;
  items: EditableRequirementItem[];
  totalsByCurrency: Record<string, number>;
  canViewPrices: boolean;
}): string {
  const metrics = buildRequirementEmailMetrics(input.items, input.fechaEntrega, false, input.totalsByCurrency);
  const resourceLines = input.items.length
    ? input.items
        .map((item, index) =>
          [
            `${index + 1}. ${cleanEmailValue(item.descripcion)}`,
            `   Tipo recurso: ${cleanEmailValue(item.tipo_recurso)}`,
            `   Información adicional: ${cleanEmailValue(item.informacion_adicional)}`,
            `   Cantidad solicitada: ${formatEmailQuantity(item.cantidad)} ${cleanEmailValue(item.unidad, "")}`.trim(),
            `   Estado: ${cleanEmailValue(item.estado)}`,
            `   Fecha requerida/entrega: ${cleanEmailValue(formatDate(item.fecha_entrega) || formatDate(input.fechaEntrega))}`,
          ].join("\n"),
        )
        .join("\n\n")
    : "Sin recursos registrados.";

  return [
    "Hola,",
    "",
    "Se remite el requerimiento para revisión, atención y seguimiento.",
    "",
    `Código RQ: ${cleanEmailValue(input.codigo)}`,
    `Proyecto: ${cleanEmailValue(input.proyecto)}`,
    `Cliente: ${cleanEmailValue(input.cliente)}`,
    `Unidad de trabajo: ${cleanEmailValue(input.unidadTrabajo)}`,
    `Solicitante: ${cleanEmailValue(input.solicitante)}`,
    `Cotización: ${cleanEmailValue(input.cotizacionCodigo)}`,
    `OC: ${cleanEmailValue(input.cotizacionOc)}`,
    `Fecha solicitud: ${cleanEmailValue(input.fechaSolicitud)}`,
    `Fecha entrega comprometida: ${cleanEmailValue(input.fechaEntrega)}`,
    `Estado: ${cleanEmailValue(input.estado)}`,
    `Actualización: ${cleanEmailValue(input.updatedAt)}`,
    "",
    "Indicadores:",
    `Recursos: ${metrics.total}`,
    `Atendidos: ${metrics.attended}`,
    `Pendientes: ${metrics.pending}`,
    `Entregados: ${metrics.delivered}`,
    `Avance: ${metrics.progress}%`,
    `Plazo: ${metrics.daysLabel}`,
    "",
    "Detalle de recursos:",
    resourceLines,
    "",
    `Abrir requerimiento: ${input.link}`,
    "",
    "Para mantener el historial, responder este mismo hilo conservando el asunto.",
  ].join("\n");
}

function buildRequirementEmailHtmlBody(input: {
  title: string;
  link: string;
  codigo: string;
  proyecto: string;
  cliente: string;
  unidadTrabajo: string;
  cotizacionCodigo: string;
  cotizacionOc: string;
  solicitante: string;
  fechaSolicitud: string;
  fechaEntrega: string;
  updatedAt: string;
  estado: string;
  items: EditableRequirementItem[];
  totalsByCurrency: Record<string, number>;
  canViewPrices: boolean;
}): string {
  const metrics = buildRequirementEmailMetrics(input.items, input.fechaEntrega, false, input.totalsByCurrency);
  const dataRows = compactEmailRows([
    ["Cliente", input.cliente],
    ["Proyecto", input.proyecto],
    ["Unidad de trabajo", input.unidadTrabajo],
    ["Solicitante", input.solicitante],
    ["Cotización", input.cotizacionCodigo],
    ["OC", input.cotizacionOc],
    ["Fecha solicitud", input.fechaSolicitud],
    ["Fecha entrega", input.fechaEntrega],
    ["Estado", input.estado],
  ]);
  const kpiCells = [
    ["Recursos", metrics.total],
    ["Atendidos", metrics.attended],
    ["Pendientes", metrics.pending],
    ["Avance", `${metrics.progress}%`],
    ["Entregados", metrics.delivered],
    ["Con OC/OS", metrics.withOcOs],
    ["Con guía", metrics.withGuia],
    ["Plazo", metrics.daysLabel],
  ].map(([label, value]) => emailKpiCell(String(label), value)).join("");

  const resourceRows = input.items.length
    ? input.items
        .map(
          (item, index) => `
            <tr style="background:${index % 2 === 0 ? "#ffffff" : "#fbfcfd"};">
              <td style="padding:6px 7px;border:1px solid #e5e7eb;text-align:right;font-size:11px;line-height:15px;color:#374151;">${index + 1}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;line-height:15px;color:#374151;">${escapeEmailHtml(item.tipo_recurso)}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;line-height:15px;color:#111827;">${escapeEmailHtml(item.descripcion)}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;text-align:right;font-size:11px;line-height:15px;color:#111827;font-weight:700;">${escapeEmailHtml(formatEmailQuantity(item.cantidad))}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;line-height:15px;color:#374151;">${escapeEmailHtml(item.unidad)}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;line-height:15px;color:#374151;">${escapeEmailHtml(item.estado)}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;line-height:15px;color:#374151;">${escapeEmailHtml(formatDate(item.fecha_entrega) || formatDate(input.fechaEntrega) || "-")}</td>
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="7" style="padding:10px;border:1px solid #e5e7eb;color:#6b7280;font-size:12px;">Sin recursos registrados.</td></tr>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef1f4;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;color:#eef1f4;">Requerimiento ${escapeEmailHtml(input.codigo)} - ${escapeEmailHtml(input.estado)}</div>
    <div style="max-width:920px;margin:0 auto;padding:22px 14px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #d9dee5;">
      <tr>
        <td style="padding:18px 22px;background:#102a43;color:#ffffff;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top;">
                <div style="font-size:11px;line-height:14px;letter-spacing:1.2px;text-transform:uppercase;color:#cbd5e1;font-weight:700;">REQUERIMIENTO</div>
                <div style="margin-top:4px;font-size:22px;line-height:27px;color:#ffffff;font-weight:700;">${escapeEmailHtml(input.codigo)}</div>
              </td>
              <td style="vertical-align:top;text-align:right;">
                <div style="display:inline-block;margin-bottom:6px;padding:4px 8px;border:1px solid #31536f;background:#1f3f5b;color:#f8fafc;font-size:11px;line-height:14px;font-weight:700;">Estado: ${escapeEmailHtml(input.estado)}</div>
                <div style="font-size:12px;line-height:16px;color:#dbeafe;">Actualización: ${escapeEmailHtml(input.updatedAt)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 22px 8px;background:#ffffff;">
          <p style="margin:0 0 14px;font-size:13px;line-height:18px;color:#374151;">Se remite el requerimiento para revisión, atención y seguimiento.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:12px;">
            ${dataRows}
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr>${kpiCells}</tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 22px 18px;background:#ffffff;">
          <div style="margin:0 0 8px;font-size:13px;line-height:17px;color:#111827;font-weight:700;">Detalle de recursos</div>
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
            <thead>
                <tr style="background:#f3f4f6;">
                  <th style="width:38px;padding:7px;border:1px solid #e5e7eb;text-align:right;font-size:10px;line-height:13px;color:#374151;text-transform:uppercase;">N°</th>
                <th style="width:120px;padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;line-height:13px;color:#374151;text-transform:uppercase;">Tipo recurso</th>
                <th style="padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;line-height:13px;color:#374151;text-transform:uppercase;">Descripción</th>
                <th style="width:80px;padding:7px;border:1px solid #e5e7eb;text-align:right;font-size:10px;line-height:13px;color:#374151;text-transform:uppercase;">Cantidad</th>
                <th style="width:70px;padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;line-height:13px;color:#374151;text-transform:uppercase;">Unidad</th>
                <th style="width:95px;padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;line-height:13px;color:#374151;text-transform:uppercase;">Estado</th>
                <th style="width:105px;padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;line-height:13px;color:#374151;text-transform:uppercase;">Fecha entrega</th>
              </tr>
            </thead>
            <tbody>${resourceRows}</tbody>
          </table>
          <p style="margin:18px 0 0;">
            <a href="${escapeEmailHtml(input.link)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:4px;font-size:13px;line-height:16px;font-weight:700;">Revisar requerimiento en plataforma</a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 22px;background:#f8fafc;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 4px;font-size:11px;line-height:15px;color:#6b7280;">Este mensaje fue generado automáticamente por el Sistema de Gestión de Proyectos - Oficina Técnica.</p>
          <p style="margin:0;font-size:11px;line-height:15px;color:#6b7280;">No responder directamente a este correo.</p>
        </td>
      </tr>
    </table>
    </div>
  </body>
</html>`;
}

function priorityWeight(priority: ObservationPriority): number {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function buildManagementAreaRows(input: {
  area: string;
  responsable: string;
  estado: string;
  metrics: ReturnType<typeof buildRequirementEmailMetrics>;
  items: EditableRequirementItem[];
}): Array<[string, string, string, string]> {
  const rows: Array<[string, string, string, string]> = [];
  rows.push([
    cleanEmailValue(input.area, "Oficina Técnica"),
    cleanEmailValue(input.responsable, "-"),
    cleanEmailValue(input.estado),
    input.metrics.pending > 0 ? `${input.metrics.pending} recursos pendientes` : "Sin pendientes registrados",
  ]);

  const logisticsItems = input.items.filter((item) => item.logistica_compra.trim().length > 0);
  if (logisticsItems.length > 0) {
    const pendingLogistics = logisticsItems.filter((item) => !itemLooksAttended(item) && !item.guia_remision.trim()).length;
    rows.push([
      "Logística",
      "-",
      `${logisticsItems.length} recursos con dato logístico`,
      pendingLogistics > 0 ? `${pendingLogistics} por completar` : "Sin pendientes logísticos registrados",
    ]);
  }

  const purchaseItems = input.items.filter((item) => item.oc_os_recurso.trim().length > 0 || item.fecha_compra.trim().length > 0);
  if (purchaseItems.length > 0) {
    rows.push([
      "Compras",
      "-",
      `${purchaseItems.length} recursos con OC/OS o fecha de compra`,
      input.metrics.withOcOs < input.metrics.total ? `${input.metrics.total - input.metrics.withOcOs} sin OC/OS` : "OC/OS completo",
    ]);
  }

  const warehouseItems = input.items.filter((item) => item.guia_remision.trim().length > 0 || item.fecha_entrega.trim().length > 0);
  if (warehouseItems.length > 0) {
    rows.push([
      "Almacén / entrega",
      "-",
      `${warehouseItems.length} recursos con entrega o guía`,
      input.metrics.delivered < input.metrics.total ? `${input.metrics.total - input.metrics.delivered} sin entrega registrada` : "Entregas completas",
    ]);
  }

  return rows;
}

function buildManagementAlerts(input: {
  fechaEntrega: string;
  observacionesGenerales: string;
  observations: RequirementObservation[];
  items: EditableRequirementItem[];
  canViewPrices: boolean;
}): string[] {
  const alerts: string[] = [];
  const deadline = daysUntilLabel(input.fechaEntrega);
  if (deadline.startsWith("Atrasado") || deadline === "Vence hoy") alerts.push(`Plazo comprometido: ${deadline}.`);

  input.observations
    .filter((observation) => observation.status !== "resolved")
    .sort((left, right) => priorityWeight(right.priority) - priorityWeight(left.priority))
    .slice(0, 4)
    .forEach((observation) => {
      alerts.push(`${observationStatusLabel(observation.status)} / ${observation.priority}: ${observation.itemCode || "-"} - ${observation.description}`);
    });

  input.items
    .filter((item) => item.observaciones_item.trim().length > 0)
    .slice(0, 3)
    .forEach((item) => alerts.push(`Recurso ${item.codigo_recurso || "-"}: ${item.observaciones_item}`));

  if (input.canViewPrices) {
    const missingCost = input.items.filter((item) => !itemHasCostData(item)).length;
    if (missingCost > 0) alerts.push(`${missingCost} recursos sin costo/precio registrado.`);
  }

  if (input.observacionesGenerales.trim()) alerts.push(`Observación general: ${input.observacionesGenerales.trim()}`);
  return alerts.slice(0, 8);
}

function criticalResourceRows(input: {
  items: EditableRequirementItem[];
  observations: RequirementObservation[];
  fechaEntrega: string;
  canViewPrices: boolean;
}): EditableRequirementItem[] {
  const observedItemIds = new Set(
    input.observations
      .filter((observation) => observation.status !== "resolved")
      .map((observation) => observation.itemId),
  );
  const generalDeadline = daysUntilLabel(input.fechaEntrega);
  return input.items
    .filter((item) => {
      if (observedItemIds.has(item.id)) return true;
      if (itemLooksPending(item) || itemLooksInProgress(item)) return true;
      if (!item.fecha_entrega.trim() && (generalDeadline.startsWith("Atrasado") || generalDeadline === "Vence hoy")) return true;
      return input.canViewPrices && !itemHasCostData(item);
    })
    .slice(0, 6);
}

function buildManagementEmailPlainBody(input: {
  title: string;
  link: string;
  codigo: string;
  proyecto: string;
  cliente: string;
  unidadTrabajo: string;
  cotizacionCodigo: string;
  cotizacionOc: string;
  solicitante: string;
  responsable: string;
  fechaSolicitud: string;
  fechaEntrega: string;
  updatedAt: string;
  estado: string;
  area: string;
  observacionesGenerales: string;
  items: EditableRequirementItem[];
  observations: RequirementObservation[];
  totalsByCurrency: Record<string, number>;
  resourceTypeSummary: ResourceTypeSummary[];
  cotizacionMoneda: "PEN" | "USD";
  managementEconomicSummary?: ManagementEconomicSummary | null;
  canViewPrices: boolean;
}): string {
  const metrics = buildRequirementEmailMetrics(input.items, input.fechaEntrega, input.canViewPrices, input.totalsByCurrency);
  const unresolvedObservations = input.observations.filter((observation) => observation.status !== "resolved").length;
  const alerts = buildManagementAlerts(input);
  const areas = buildManagementAreaRows({
    area: input.area,
    responsable: input.responsable,
    estado: input.estado,
    metrics,
    items: input.items,
  });
  const criticalRows = criticalResourceRows(input);
  const resourceTypeRows = resourceTypeReportRows({
    items: input.items,
    resourceTypeSummary: input.resourceTypeSummary,
    canViewPrices: input.canViewPrices,
    currency: input.cotizacionMoneda,
  });
  const hasEconomicData = hasEconomicSummaryData(input.managementEconomicSummary);
  const economic = input.managementEconomicSummary;

  return [
    "Hola,",
    "",
    `Estado ejecutivo del requerimiento ${cleanEmailValue(input.codigo)}.`,
    `Situación: avance ${metrics.progress}% (${metrics.attended}/${metrics.total} atendidos), ${metrics.pending} pendientes y ${unresolvedObservations} observaciones abiertas.`,
    input.canViewPrices && metrics.totalCostLabel ? `Costo registrado: ${metrics.totalCostLabel}.` : "Costos omitidos por permisos del remitente.",
    "",
    "Datos generales:",
    `Cliente: ${cleanEmailValue(input.cliente)}`,
    `Proyecto: ${cleanEmailValue(input.proyecto)}`,
    `Unidad de trabajo: ${cleanEmailValue(input.unidadTrabajo)}`,
    `Cotización: ${cleanEmailValue(input.cotizacionCodigo)}`,
    `OC: ${cleanEmailValue(input.cotizacionOc)}`,
    `Solicitante: ${cleanEmailValue(input.solicitante)}`,
    `Responsable: ${cleanEmailValue(input.responsable)}`,
    `Fecha solicitud: ${cleanEmailValue(input.fechaSolicitud)}`,
    `Fecha entrega comprometida: ${cleanEmailValue(input.fechaEntrega)}`,
    `Actualización: ${cleanEmailValue(input.updatedAt)}`,
    "",
    "KPIs:",
    `Recursos totales: ${metrics.total}`,
    `Avance: ${metrics.progress}%`,
    `Atendidos: ${metrics.attended}`,
    `Pendientes: ${metrics.pending}`,
    `En proceso: ${metrics.inProgress}`,
    `Cotizados/con precio: ${metrics.quoted}`,
    `Entregados: ${metrics.delivered}`,
    `Plazo: ${metrics.daysLabel}`,
    ...(input.canViewPrices ? [`Recursos sin costo: ${metrics.missingCost}`, `Costo total registrado: ${metrics.totalCostLabel || "-"}`] : []),
    "",
    "Resumen por tipo de recurso:",
    ...(resourceTypeRows.length
      ? resourceTypeRows.map((row) => `- ${row.tipo}: ${row.cantidad} ítem(s), ${row.presencia}, total ${row.total}.`)
      : ["- Sin tipos de recurso registrados."]),
    "",
    "Resumen económico:",
    hasEconomicData && economic
      ? `Base: ${economicValueLabel(economic.base, input.cotizacionMoneda, input.canViewPrices)} | Oferta: ${economicValueLabel(economic.oferta, input.cotizacionMoneda, input.canViewPrices)} | Real: ${economicValueLabel(economic.real, input.cotizacionMoneda, input.canViewPrices)}`
      : "No disponible",
    hasEconomicData && economic
      ? `Marg. ofertado: ${economicValueLabel(economic.margen_ofertado, input.cotizacionMoneda, input.canViewPrices)} (${economicValueLabel(economic.porcentaje_margen_ofertado, input.cotizacionMoneda, input.canViewPrices, true)})`
      : "",
    hasEconomicData && economic
      ? `Marg. real: ${economicValueLabel(economic.margen_real, input.cotizacionMoneda, input.canViewPrices)} (${economicValueLabel(economic.porcentaje_margen_real, input.cotizacionMoneda, input.canViewPrices, true)})`
      : "",
    "",
    "Avance por área:",
    ...areas.map(([area, owner, status, pending]) => `- ${area}: ${status}. Responsable: ${owner}. Pendiente: ${pending}.`),
    "",
    "Observaciones y alertas:",
    ...(alerts.length ? alerts.map((alert) => `- ${alert}`) : ["- Sin alertas u observaciones abiertas registradas."]),
    "",
    "Recursos críticos:",
    ...(criticalRows.length
      ? criticalRows.map((item, index) =>
          `${index + 1}. ${cleanEmailValue(item.descripcion)} | Estado: ${cleanEmailValue(item.estado)} | Pendiente: ${cleanEmailValue(item.observaciones_item, "Seguimiento operativo")}${
            input.canViewPrices ? ` | Costo: ${cleanEmailValue(item.moneda)} ${formatEmailQuantity(item.costo_total_presupuestado)}` : ""
          }`,
        )
      : ["Sin recursos críticos registrados."]),
    "",
    `Abrir requerimiento: ${input.link}`,
  ].join("\n");
}

function buildManagementEmailHtmlBody(input: Parameters<typeof buildManagementEmailPlainBody>[0]): string {
  const metrics = buildRequirementEmailMetrics(input.items, input.fechaEntrega, input.canViewPrices, input.totalsByCurrency);
  const unresolvedObservations = input.observations.filter((observation) => observation.status !== "resolved").length;
  const alerts = buildManagementAlerts(input);
  const areas = buildManagementAreaRows({
    area: input.area,
    responsable: input.responsable,
    estado: input.estado,
    metrics,
    items: input.items,
  });
  const criticalRows = criticalResourceRows(input);
  const summaryText = `Avance ${metrics.progress}% (${metrics.attended}/${metrics.total} atendidos), ${metrics.pending} pendientes y ${unresolvedObservations} observaciones abiertas.`;
  const kpis = managementKpiGridHtml([
    { label: "Recursos", value: metrics.total, tone: "info" },
    { label: "Avance", value: `${metrics.progress}%`, tone: metrics.progress >= 80 ? "success" : metrics.progress >= 45 ? "warning" : "danger" },
    { label: "Atendidos", value: metrics.attended, tone: "success" },
    { label: "Pendientes", value: metrics.pending, tone: metrics.pending > 0 ? "warning" : "success" },
    { label: "En proceso", value: metrics.inProgress, tone: "info" },
    { label: "Cotizados", value: metrics.quoted, tone: "neutral" },
    { label: "Entregados", value: metrics.delivered, tone: "success" },
    { label: "Plazo", value: metrics.daysLabel, tone: metrics.daysLabel.startsWith("Atrasado") || metrics.daysLabel === "Vence hoy" ? "danger" : "neutral" },
    ...(input.canViewPrices
      ? [
          { label: "Sin costo", value: metrics.missingCost, tone: metrics.missingCost > 0 ? "warning" : "success" },
          { label: "Costo", value: metrics.totalCostLabel || "-", tone: "neutral" },
        ] satisfies Array<{ label: string; value: string | number; tone: ManagementKpiTone }>
      : []),
  ]);
  const resourceTypeRows = resourceTypeReportRows({
    items: input.items,
    resourceTypeSummary: input.resourceTypeSummary,
    canViewPrices: input.canViewPrices,
    currency: input.cotizacionMoneda,
  });
  const resourceTypeHtmlRows = resourceTypeRows.length
    ? resourceTypeRows
        .map(
          (row, index) => `
            <tr style="background:${index % 2 === 0 ? "#ffffff" : "#fbfcfd"};">
              <td style="padding:7px;border:1px solid #e5e7eb;font-size:11px;color:#111827;font-weight:700;">${escapeEmailHtml(row.tipo)}</td>
              <td style="width:80px;padding:7px;border:1px solid #e5e7eb;text-align:right;font-size:11px;color:#374151;">${row.cantidad}</td>
              <td style="width:95px;padding:7px;border:1px solid #e5e7eb;font-size:11px;color:#374151;">${escapeEmailHtml(row.presencia)}</td>
              <td style="width:125px;padding:7px;border:1px solid #e5e7eb;text-align:right;font-size:11px;color:#111827;font-weight:700;">${escapeEmailHtml(row.total)}</td>
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" style="padding:10px;border:1px solid #e5e7eb;color:#64748b;font-size:12px;">Sin tipos de recurso registrados.</td></tr>`;
  const hasEconomicData = hasEconomicSummaryData(input.managementEconomicSummary);
  const economic = input.managementEconomicSummary;
  const economicHtmlRows = hasEconomicData && economic
    ? compactEmailRows([
        ["Base", economicValueLabel(economic.base, input.cotizacionMoneda, input.canViewPrices)],
        ["Oferta", economicValueLabel(economic.oferta, input.cotizacionMoneda, input.canViewPrices)],
        ["Real", economicValueLabel(economic.real, input.cotizacionMoneda, input.canViewPrices)],
        ["Marg. ofertado", economicValueLabel(economic.margen_ofertado, input.cotizacionMoneda, input.canViewPrices)],
        ["% marg. ofertado", economicValueLabel(economic.porcentaje_margen_ofertado, input.cotizacionMoneda, input.canViewPrices, true)],
        ["Marg. real", economicValueLabel(economic.margen_real, input.cotizacionMoneda, input.canViewPrices)],
        ["% marg. real", economicValueLabel(economic.porcentaje_margen_real, input.cotizacionMoneda, input.canViewPrices, true)],
      ])
    : `<tr><td colspan="2" style="padding:10px;border:1px solid #e5e7eb;color:#64748b;font-size:12px;">No disponible</td></tr>`;
  const areaRows = areas
    .map(
      ([area, owner, status, pending]) => `
        <tr>
          <td style="padding:7px;border:1px solid #e5e7eb;font-size:11px;font-weight:700;color:#111827;">${escapeEmailHtml(area)}</td>
          <td style="padding:7px;border:1px solid #e5e7eb;font-size:11px;color:#374151;">${escapeEmailHtml(owner)}</td>
          <td style="padding:7px;border:1px solid #e5e7eb;font-size:11px;color:#374151;">${escapeEmailHtml(status)}</td>
          <td style="padding:7px;border:1px solid #e5e7eb;font-size:11px;color:#374151;">${escapeEmailHtml(pending)}</td>
        </tr>`,
    )
    .join("");
  const alertRows = alerts.length
    ? alerts.map((alert) => `<li style="margin:0 0 6px;color:#374151;font-size:12px;line-height:17px;">${escapeEmailHtml(alert)}</li>`).join("")
    : `<li style="margin:0;color:#64748b;font-size:12px;line-height:17px;">Sin alertas u observaciones abiertas registradas.</li>`;
  const criticalHtmlRows = criticalRows.length
    ? criticalRows
        .map(
          (item, index) => `
            <tr style="background:${index % 2 === 0 ? "#ffffff" : "#fbfcfd"};">
              <td style="padding:6px 7px;border:1px solid #e5e7eb;text-align:right;font-size:11px;color:#374151;">${index + 1}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;color:#111827;font-weight:700;">${escapeEmailHtml(item.tipo_recurso)}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;color:#111827;">${escapeEmailHtml(item.descripcion)}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;color:#374151;">${escapeEmailHtml(item.estado)}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;color:#374151;">${escapeEmailHtml(item.observaciones_item || "Seguimiento operativo")}</td>
              ${
                input.canViewPrices
                  ? `<td style="padding:6px 7px;border:1px solid #e5e7eb;text-align:right;font-size:11px;color:#111827;font-weight:700;">${escapeEmailHtml(`${item.moneda || ""} ${formatEmailQuantity(item.costo_total_presupuestado)}`)}</td>`
                  : ""
              }
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="${input.canViewPrices ? 6 : 5}" style="padding:10px;border:1px solid #e5e7eb;color:#64748b;font-size:12px;">Sin recursos críticos registrados.</td></tr>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;color:#f1f5f9;">Estado gerencial RQ ${escapeEmailHtml(input.codigo)} - ${escapeEmailHtml(summaryText)}</div>
    <div style="max-width:940px;margin:0 auto;padding:22px 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #d7dee8;">
        <tr>
          <td style="padding:18px 22px;background:#17324d;color:#ffffff;">
            <div style="font-size:11px;line-height:14px;letter-spacing:1.1px;text-transform:uppercase;color:#cbd5e1;font-weight:700;">ESTADO A GERENCIA</div>
            <div style="margin-top:4px;font-size:22px;line-height:27px;color:#ffffff;font-weight:700;">${escapeEmailHtml(input.codigo)}</div>
            <div style="margin-top:8px;font-size:13px;line-height:18px;color:#e2e8f0;">${escapeEmailHtml(summaryText)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 22px 6px;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:12px;">
              ${compactEmailRows([
                ["Cliente", input.cliente],
                ["Proyecto", input.proyecto],
                ["Unidad de trabajo", input.unidadTrabajo],
                ["Cotización", input.cotizacionCodigo],
                ["OC", input.cotizacionOc],
                ["Responsable", input.responsable],
                ["Fecha solicitud", input.fechaSolicitud],
                ["Fecha entrega comprometida", input.fechaEntrega],
                ["Actualización", input.updatedAt],
              ])}
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
              ${kpis}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 22px;background:#ffffff;">
            <div style="margin:0 0 8px;font-size:13px;line-height:17px;color:#111827;font-weight:700;">Resumen por tipo de recurso</div>
            <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;color:#475569;text-transform:uppercase;">Tipo de recurso</th>
                  <th style="width:80px;padding:7px;border:1px solid #e5e7eb;text-align:right;font-size:10px;color:#475569;text-transform:uppercase;">Cantidad</th>
                  <th style="width:95px;padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;color:#475569;text-transform:uppercase;">Presencia</th>
                  <th style="width:125px;padding:7px;border:1px solid #e5e7eb;text-align:right;font-size:10px;color:#475569;text-transform:uppercase;">Total</th>
                </tr>
              </thead>
              <tbody>${resourceTypeHtmlRows}</tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 22px;background:#ffffff;">
            <div style="margin:0 0 8px;font-size:13px;line-height:17px;color:#111827;font-weight:700;">Resumen económico</div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:12px;">
              ${economicHtmlRows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 22px;background:#ffffff;">
            <div style="margin:0 0 8px;font-size:13px;line-height:17px;color:#111827;font-weight:700;">Avance por área</div>
            <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;color:#475569;text-transform:uppercase;">Área</th>
                  <th style="padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;color:#475569;text-transform:uppercase;">Responsable</th>
                  <th style="padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;color:#475569;text-transform:uppercase;">Estado</th>
                  <th style="padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;color:#475569;text-transform:uppercase;">Pendiente principal</th>
                </tr>
              </thead>
              <tbody>${areaRows}</tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 22px;background:#ffffff;">
            <div style="margin:0 0 8px;font-size:13px;line-height:17px;color:#111827;font-weight:700;">Observaciones y alertas</div>
            <ul style="margin:0;padding-left:18px;">${alertRows}</ul>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 22px 18px;background:#ffffff;">
            <div style="margin:0 0 8px;font-size:13px;line-height:17px;color:#111827;font-weight:700;">Recursos críticos</div>
            <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="width:38px;padding:7px;border:1px solid #e5e7eb;text-align:right;font-size:10px;color:#475569;text-transform:uppercase;">N°</th>
                  <th style="width:130px;padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;color:#475569;text-transform:uppercase;">Tipo</th>
                  <th style="padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;color:#475569;text-transform:uppercase;">Descripción</th>
                  <th style="width:95px;padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;color:#475569;text-transform:uppercase;">Estado</th>
                  <th style="width:180px;padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;color:#475569;text-transform:uppercase;">Observación</th>
                  ${input.canViewPrices ? `<th style="width:115px;padding:7px;border:1px solid #e5e7eb;text-align:right;font-size:10px;color:#475569;text-transform:uppercase;">Costo</th>` : ""}
                </tr>
              </thead>
              <tbody>${criticalHtmlRows}</tbody>
            </table>
            <p style="margin:18px 0 0;">
              <a href="${escapeEmailHtml(input.link)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:4px;font-size:13px;line-height:16px;font-weight:700;">Revisar requerimiento en plataforma</a>
            </p>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;
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
  if (name === "copy") {
    return (
      <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden>
        <rect {...common} x="8" y="8" width="10" height="10" rx="1.5" />
        <path {...common} d="M6 14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
      </svg>
    );
  }
  if (name === "menu") {
    return (
      <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden>
        <path {...common} d="M4 7h16M4 12h16M4 17h16" />
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
  return `inline-flex h-6 min-h-6 shrink-0 items-center justify-center gap-1 rounded border border-stone-200 text-[11px] leading-none text-stone-500 hover:bg-stone-100 hover:border-stone-300 active:bg-stone-200 ${
    iconOnly ? "w-6 px-0" : "px-1.5 whitespace-nowrap"
  } disabled:cursor-not-allowed disabled:opacity-50`;
}

function nowPreviewTimestamp(): string {
  return new Date().toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function makePreviewId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function observationStatusClassName(status: RequirementObservationStatus): string {
  if (status === "Levantado") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "En seguimiento") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Observado") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-stone-200 bg-stone-50 text-stone-500";
}

function collectObservationEmailAttachments(observations: RequirementObservation[]): ObservationEmailAttachment[] {
  return observations.flatMap((observation) =>
    [
      ...observation.initialEvidence,
      ...observation.responses.flatMap((response) => response.evidenceFiles),
    ].map((file) => ({
      name: file.name,
      size: file.size,
      type: file.mimeType,
      url: file.localObjectUrl || null,
    })),
  );
}

function observationUserEmailLabel(userDirectory: ObservationUser[], userId: string | null | undefined): string {
  const user = resolveObservationUser(userDirectory, userId);
  return user?.displayName || user?.email || "-";
}

function buildObservationEmailPlainBody(input: {
  title: string;
  link: string;
  codigo: string;
  proyecto: string;
  cliente: string;
  observations: RequirementObservation[];
  userDirectory: ObservationUser[];
}): string {
  const observationLines = input.observations.length
    ? input.observations
        .map((observation, index) => {
          const evidenceFiles = [
            ...observation.initialEvidence,
            ...observation.responses.flatMap((response) => response.evidenceFiles),
          ];
          return [
            `${index + 1}. ${observation.code} - ${observation.description}`,
            `   Recurso: ${observation.itemCode || "-"} - ${observation.itemDescription || "-"}`,
            `   Estado: ${observationStatusLabel(observation.status)}`,
            `   Prioridad: ${observation.priority}`,
            `   Observador: ${observationUserEmailLabel(input.userDirectory, observation.observerUserId)}`,
            `   Responsable: ${observationUserEmailLabel(input.userDirectory, observation.assignedUserId)}`,
            `   Respuestas: ${observation.responses.length}`,
            `   Evidencias locales: ${evidenceFiles.length}`,
            `   Adjuntos: ${
              evidenceFiles.length ? evidenceFiles.map((file) => file.name).join(", ") : "-"
            }`,
          ].join("\n");
        })
        .join("\n\n")
    : "Sin observaciones registradas.";

  return [
    "Hola,",
    "",
    `Se comparte trazabilidad piloto del requerimiento ${input.codigo}.`,
    "",
    `Proyecto: ${input.proyecto || "-"}`,
    `Cliente: ${input.cliente || "-"}`,
    "",
    "Historial de observaciones:",
    observationLines,
    "",
    `Abrir RQ: ${input.link}`,
    "",
    "Correo generado en modo preview. No se ha enviado desde Gmail real.",
  ].join("\n");
}

function buildObservationEmailHtmlBody(input: {
  title: string;
  link: string;
  codigo: string;
  proyecto: string;
  cliente: string;
  observations: RequirementObservation[];
  userDirectory: ObservationUser[];
}): string {
  const rows = input.observations.length
    ? input.observations
        .map((observation, index) => {
          const evidenceFiles = [
            ...observation.initialEvidence,
            ...observation.responses.flatMap((response) => response.evidenceFiles),
          ];
          const attachments = evidenceFiles.length
            ? evidenceFiles
                .map((file) => escapeEmailHtml(file.name))
                .join("<br>")
            : "-";
          return `
            <tr>
              <td style="padding:7px;border:1px solid #e5e7eb;text-align:right;color:#374151;">${index + 1}</td>
              <td style="padding:7px;border:1px solid #e5e7eb;font-weight:700;color:#111827;">${escapeEmailHtml(observation.itemCode || "-")}</td>
              <td style="padding:7px;border:1px solid #e5e7eb;color:#111827;">${escapeEmailHtml(`${observation.code} - ${observation.description}`)}</td>
              <td style="padding:7px;border:1px solid #e5e7eb;color:#374151;">${escapeEmailHtml(observationStatusLabel(observation.status))}</td>
              <td style="padding:7px;border:1px solid #e5e7eb;text-align:right;color:#111827;">${evidenceFiles.length}</td>
              <td style="padding:7px;border:1px solid #e5e7eb;color:#374151;">${attachments}</td>
              <td style="padding:7px;border:1px solid #e5e7eb;text-align:right;color:#111827;">${observation.responses.length}</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="7" style="padding:12px;border:1px solid #e5e7eb;color:#6b7280;">Sin observaciones registradas.</td></tr>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:860px;margin:0 auto;padding:22px 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #d9dee5;">
        <tr>
          <td style="padding:16px 20px;background:#0f172a;color:#ffffff;">
            <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#cbd5e1;font-weight:700;">TRAZABILIDAD SGP PILOTO</div>
            <div style="margin-top:4px;font-size:21px;font-weight:700;">Observaciones RQ ${escapeEmailHtml(input.codigo)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 12px;font-size:13px;line-height:18px;color:#374151;">Resumen de observaciones, respuestas y evidencias locales para pruebas.</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px;">
              <tr>
                <td style="width:50%;padding:8px;border:1px solid #e5e7eb;background:#f8fafc;font-weight:700;">Proyecto</td>
                <td style="padding:8px;border:1px solid #e5e7eb;">${escapeEmailHtml(input.proyecto || "-")}</td>
              </tr>
              <tr>
                <td style="width:50%;padding:8px;border:1px solid #e5e7eb;background:#f8fafc;font-weight:700;">Cliente</td>
                <td style="padding:8px;border:1px solid #e5e7eb;">${escapeEmailHtml(input.cliente || "-")}</td>
              </tr>
            </table>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="width:38px;padding:7px;border:1px solid #e5e7eb;text-align:right;">N</th>
                  <th style="width:130px;padding:7px;border:1px solid #e5e7eb;text-align:left;">Recurso</th>
                  <th style="padding:7px;border:1px solid #e5e7eb;text-align:left;">Observación</th>
                  <th style="width:100px;padding:7px;border:1px solid #e5e7eb;text-align:left;">Estado</th>
                  <th style="width:80px;padding:7px;border:1px solid #e5e7eb;text-align:right;">Evidencias</th>
                  <th style="width:150px;padding:7px;border:1px solid #e5e7eb;text-align:left;">Adjuntos</th>
                  <th style="width:90px;padding:7px;border:1px solid #e5e7eb;text-align:right;">Respuestas</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <p style="margin:18px 0 0;"><a href="${escapeEmailHtml(input.link)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:4px;font-size:13px;font-weight:700;">Abrir RQ en preview</a></p>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;
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
  managementEconomicSummary = null,
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
  canSendRequirementEmail = true,
  canSendManagementEmail = false,
  currentUser = null,
  userDirectory = [],
  loadingUsers = false,
  usersLoadError = "",
  onRetryUsers,
}: RequirementWorkspaceModalProps) {
  const [isGeneralInfoEditing, setIsGeneralInfoEditing] = useState(false);
  const [catalogPanelOpen, setCatalogPanelOpen] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("recursos");
  const [observations, setObservations] = useState<RequirementObservation[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedObservationItemIds, setSelectedObservationItemIds] = useState<string[]>([]);
  const [filteredObservationItemIds, setFilteredObservationItemIds] = useState<string[]>([]);
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);
  const [copyStatusMessage, setCopyStatusMessage] = useState("");
  const generalSnapshotRef = useRef("");
  const localEvidenceUrlSetRef = useRef<Set<string>>(new Set());
  const hiddenBusinessFieldSet = useMemo(
    () => new Set(hiddenBusinessFields.map((field) => normalizeBusinessFieldKey(field))),
    [hiddenBusinessFields],
  );
  const isBusinessFieldHidden = (fieldKey: string): boolean => hiddenBusinessFieldSet.has(normalizeBusinessFieldKey(fieldKey));
  const observationUserDirectory = useMemo(() => {
    const byId = new Map<string, ObservationUser>();
    [...userDirectory, ...(currentUser?.id ? [currentUser] : [])].forEach((user) => {
      if (!user.id) return;
      byId.set(user.id, {
        ...user,
        displayName: user.displayName || user.email || user.id,
      });
    });
    return Array.from(byId.values()).sort((a, b) => {
      const byName = a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" });
      if (byName !== 0) return byName;
      return (a.email ?? "").localeCompare(b.email ?? "", "es", { sensitivity: "base" });
    });
  }, [currentUser, userDirectory]);
  const requesterObservationUserId = useMemo(
    () => resolveObservationUserId(observationUserDirectory, draft?.solicitante_rq),
    [draft?.solicitante_rq, observationUserDirectory],
  );
  const requirementResponsibleObservationUserId = useMemo(
    () => resolveObservationUserId(observationUserDirectory, draft?.responsable),
    [draft?.responsable, observationUserDirectory],
  );
  const defaultAssignedObservationUserId = requesterObservationUserId ?? requirementResponsibleObservationUserId ?? "";
  const defaultAssignedObservationSource: ObservationAssignmentSource = requesterObservationUserId
    ? "rq_requester"
    : requirementResponsibleObservationUserId
      ? "requirement_responsible"
      : "manual";
  const requesterIsRegistered = Boolean(!draft?.solicitante_rq || requesterObservationUserId);
  const currentObservationUser = currentUser?.id ? currentUser : null;

  const revokeAllLocalEvidenceUrls = useCallback(() => {
    localEvidenceUrlSetRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    localEvidenceUrlSetRef.current.clear();
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => revokeAllLocalEvidenceUrls, [revokeAllLocalEvidenceUrls]);

  useEffect(() => {
    if (open) {
      setIsGeneralInfoEditing(false);
      setCatalogPanelOpen(false);
      setActiveWorkspaceTab("recursos");
      revokeAllLocalEvidenceUrls();
      setObservations([]);
      setSelectedItemId(null);
      setSelectedObservationItemIds([]);
      setFilteredObservationItemIds([]);
      setSelectedObservationId(null);
      setCopyStatusMessage("");
      generalSnapshotRef.current = "";
    }
  }, [open, draft?.id, revokeAllLocalEvidenceUrls]);

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

  const observationsByItemId = useMemo(
    () =>
      observations.reduce<Record<string, RequirementObservation[]>>((acc, observation) => {
        acc[observation.itemId] = acc[observation.itemId] ?? [];
        acc[observation.itemId].push(observation);
        return acc;
      }, {}),
    [observations],
  );
  const observationStatusByItemId = useMemo(
    () =>
      items.reduce<Record<string, RequirementObservationStatus>>((acc, item) => {
        acc[item.id] = observationStatusForItem(observationsByItemId[item.id] ?? []);
        return acc;
      }, {}),
    [items, observationsByItemId],
  );
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );
  const selectedItemObservations = useMemo(
    () => (selectedItem ? observationsByItemId[selectedItem.id] ?? [] : []),
    [observationsByItemId, selectedItem],
  );
  const selectedObservation = useMemo(
    () =>
      selectedItemObservations.find((observation) => observation.id === selectedObservationId) ??
      selectedItemObservations[0] ??
      null,
    [selectedItemObservations, selectedObservationId],
  );
  const selectedObservationGridStatus = selectedObservation
    ? observationStatusForItem([selectedObservation])
    : observationStatusForItem(selectedItemObservations);
  const observedItemIdSet = useMemo(() => new Set(observations.map((observation) => observation.itemId)), [observations]);
  const selectedObservationItemIdSet = useMemo(() => new Set(selectedObservationItemIds), [selectedObservationItemIds]);
  const filteredObservationItemIdSet = useMemo(() => new Set(filteredObservationItemIds), [filteredObservationItemIds]);
  const selectedObservationItems = useMemo(
    () => items.filter((item) => selectedObservationItemIdSet.has(item.id) && observedItemIdSet.has(item.id)),
    [items, observedItemIdSet, selectedObservationItemIdSet],
  );
  const filteredObservedItems = useMemo(
    () => items.filter((item) => filteredObservationItemIdSet.has(item.id) && observedItemIdSet.has(item.id)),
    [items, filteredObservationItemIdSet, observedItemIdSet],
  );
  const selectedEmailObservations = useMemo(
    () => observations.filter((observation) => selectedObservationItemIdSet.has(observation.itemId)),
    [observations, selectedObservationItemIdSet],
  );
  const filteredEmailObservations = useMemo(
    () => observations.filter((observation) => filteredObservationItemIdSet.has(observation.itemId)),
    [filteredObservationItemIdSet, observations],
  );
  const selectedEmailAttachments = useMemo(
    () => collectObservationEmailAttachments(selectedEmailObservations),
    [selectedEmailObservations],
  );
  const filteredEmailAttachments = useMemo(
    () => collectObservationEmailAttachments(filteredEmailObservations),
    [filteredEmailObservations],
  );
  useEffect(() => {
    if (!selectedItem) {
      setSelectedObservationId(null);
      return;
    }
    const currentBelongsToSelectedItem = selectedObservationId
      ? selectedItemObservations.some((observation) => observation.id === selectedObservationId)
      : false;
    if (!currentBelongsToSelectedItem) {
      setSelectedObservationId(selectedItemObservations[0]?.id ?? null);
    }
  }, [selectedItem, selectedItemObservations, selectedObservationId]);

  useEffect(() => {
    const validItemIds = new Set(items.map((item) => item.id));
    setSelectedObservationItemIds((current) =>
      current.filter((itemId) => validItemIds.has(itemId) && observedItemIdSet.has(itemId)),
    );
  }, [items, observedItemIdSet]);
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

  const createEvidenceFromFile = useCallback(
    (
      file: File,
      associatedTo: "observation" | "response",
      observationId: string,
      responseId?: string,
    ): ObservationEvidence => {
      const localObjectUrl = typeof URL !== "undefined" ? URL.createObjectURL(file) : "";
      if (localObjectUrl) localEvidenceUrlSetRef.current.add(localObjectUrl);
      return {
        id: makePreviewId("ev"),
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        localObjectUrl,
        associatedTo,
        observationId,
        responseId,
        uploadedByUserId: currentObservationUser?.id ?? "",
        createdAt: new Date().toISOString(),
      };
    },
    [currentObservationUser?.id],
  );

  const makeStatusHistoryEntry = useCallback(
    (previousStatus: ObservationWorkflowStatus | null, nextStatus: ObservationWorkflowStatus, note?: string) => ({
      id: makePreviewId("status"),
      previousStatus,
      nextStatus,
      actorUserId: currentObservationUser?.id ?? "",
      createdAt: nowPreviewTimestamp(),
      note,
    }),
    [currentObservationUser?.id],
  );

  const createObservationForSelectedItem = useCallback(
    (input: {
      description: string;
      priority: ObservationPriority;
      requiresEvidence: boolean;
      assignedUserId: string;
      participantUserIds: string[];
      delegatedReviewerUserId?: string;
      files: File[];
    }) => {
      if (!selectedItem || !currentObservationUser?.id || !input.assignedUserId) return;
      const id = makePreviewId("obs");
      const createdAt = nowPreviewTimestamp();
      const code = `OBS-${String(observations.length + 1).padStart(3, "0")}`;
      const initialEvidence = input.files.map((file) => createEvidenceFromFile(file, "observation", id));
      const observation: RequirementObservation = {
        id,
        code,
        requirementId: draft?.id ?? requerimiento?.id ?? "preview-rq",
        itemId: selectedItem.id,
        itemCode: selectedItem.codigo_fabricante || selectedItem.codigo_recurso || "-",
        itemDescription: selectedItem.descripcion || selectedItem.recurso_a_suministrar || "-",
        description: input.description,
        priority: input.priority,
        requiresEvidence: input.requiresEvidence,
        status: "pending",
        observerUserId: currentObservationUser.id,
        assignedUserId: input.assignedUserId,
        participantUserIds: Array.from(new Set(input.participantUserIds)).filter((userId) => userId && userId !== input.assignedUserId),
        delegatedReviewerUserId: input.delegatedReviewerUserId,
        createdAt,
        initialEvidence,
        responses: [],
        statusHistory: [
          {
            id: makePreviewId("status"),
            previousStatus: null,
            nextStatus: "pending",
            actorUserId: currentObservationUser.id,
            createdAt,
            note: "Observación registrada.",
          },
        ],
      };
      setObservations((current) => [observation, ...current]);
      setSelectedObservationId(id);
      setCatalogPanelOpen(false);
    },
    [createEvidenceFromFile, currentObservationUser, draft?.id, observations.length, requerimiento?.id, selectedItem],
  );

  const handleSelectObservationItem = useCallback((item: EditableRequirementItem) => {
    setSelectedItemId(item.id);
    setCatalogPanelOpen(false);
  }, []);

  const handleToggleObservationItemSelection = useCallback(
    (itemId: string) => {
      if (!observedItemIdSet.has(itemId)) return;
      setSelectedObservationItemIds((current) =>
        current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
      );
    },
    [observedItemIdSet],
  );

  const handleToggleFilteredObservationItems = useCallback((itemIds: string[], selected: boolean) => {
    setSelectedObservationItemIds((current) => {
      const next = new Set(current);
      itemIds.forEach((itemId) => {
        if (selected) next.add(itemId);
        else next.delete(itemId);
      });
      return Array.from(next);
    });
  }, []);

  const handleFilteredObservationItemsChange = useCallback((visibleItems: EditableRequirementItem[]) => {
    setFilteredObservationItemIds(visibleItems.map((item) => item.id));
  }, []);

  const addResponseToObservation = useCallback(
    (observationId: string, responseText: string, files: File[]) => {
      if (!currentObservationUser) return;
      const responseId = makePreviewId("response");
      const createdAt = nowPreviewTimestamp();
      setObservations((current) =>
        current.map((observation) => {
          if (observation.id !== observationId) return observation;
          if (!canRespondToObservation(observation, currentObservationUser)) return observation;
          if (observation.requiresEvidence && files.length === 0) return observation;
          const evidenceFiles = files.map((file) => createEvidenceFromFile(file, "response", observationId, responseId));
          return {
            ...observation,
            status: "under_review",
                responses: [
                  ...observation.responses,
                  {
                    id: responseId,
                    observationId,
                    responseText,
                authorUserId: currentObservationUser.id,
                    createdAt,
                    evidenceFiles,
                  },
                ],
            statusHistory: [
              makeStatusHistoryEntry(observation.status, "under_review", "Respuesta registrada. Pendiente de revisión."),
              ...observation.statusHistory,
            ],
          };
        }),
      );
    },
    [createEvidenceFromFile, currentObservationUser, makeStatusHistoryEntry],
  );

  const resolveObservation = useCallback(
    (observationId: string) => {
      if (!currentObservationUser) return;
      setObservations((current) =>
        current.map((observation) => {
          if (observation.id !== observationId) return observation;
          if (!canReviewObservation(observation, currentObservationUser)) return observation;
          if (observationCanResolveReason(observation)) return observation;
          return {
            ...observation,
            status: "resolved",
            statusHistory: [
              makeStatusHistoryEntry(observation.status, "resolved", "Levantamiento aprobado."),
              ...observation.statusHistory,
            ],
          };
        }),
      );
    },
    [currentObservationUser, makeStatusHistoryEntry],
  );

  const requestCorrectionObservation = useCallback(
    (observationId: string, reason: string) => {
      if (!currentObservationUser || !reason.trim()) return;
      setObservations((current) =>
        current.map((observation) => {
          if (observation.id !== observationId || !canReviewObservation(observation, currentObservationUser)) return observation;
          return {
            ...observation,
            status: "correction_requested",
            statusHistory: [
              makeStatusHistoryEntry(observation.status, "correction_requested", `Motivo: ${reason.trim()}`),
              ...observation.statusHistory,
            ],
          };
        }),
      );
    },
    [currentObservationUser, makeStatusHistoryEntry],
  );

  const reopenObservation = useCallback(
    (observationId: string, reason: string) => {
      if (!currentObservationUser || !reason.trim()) return;
      setObservations((current) =>
        current.map((observation) => {
          if (observation.id !== observationId || !canReopenObservation(observation, currentObservationUser)) return observation;
          return {
            ...observation,
            status: "reopened",
            statusHistory: [
              makeStatusHistoryEntry(observation.status, "reopened", `Motivo: ${reason.trim()}`),
              ...observation.statusHistory,
            ],
          };
        }),
      );
    },
    [currentObservationUser, makeStatusHistoryEntry],
  );

  const reassignObservation = useCallback(
    (observationId: string, assignedUserId: string) => {
      if (!currentObservationUser || !assignedUserId || !canReassignObservation(currentObservationUser)) return;
      setObservations((current) =>
        current.map((observation) => {
          if (observation.id !== observationId) return observation;
          const assignedUser = resolveObservationUser(observationUserDirectory, assignedUserId);
          return {
            ...observation,
            assignedUserId,
            participantUserIds: observation.participantUserIds.filter((userId) => userId !== assignedUserId),
            statusHistory: [
              makeStatusHistoryEntry(
                observation.status,
                observation.status,
                `Responsable reasignado a ${assignedUser?.displayName || assignedUser?.email || "usuario seleccionado"}.`,
              ),
              ...observation.statusHistory,
            ],
          };
        }),
      );
    },
    [currentObservationUser, makeStatusHistoryEntry, observationUserDirectory],
  );

  const buildRequirementPlainEmail = useCallback(
    ({ title, link }: { title: string; link: string }) =>
      buildRequirementEmailPlainBody({
        title,
        link,
        codigo: draft?.codigo ?? "",
        proyecto,
        cliente,
        unidadTrabajo,
        cotizacionCodigo,
        cotizacionOc,
        solicitante: draft?.solicitante_rq ?? "",
        fechaSolicitud: formatDate(draft?.fecha_solicitud ?? "") || "-",
        fechaEntrega: formatDate(draft?.fecha_requerida ?? "") || "-",
        updatedAt: nowPreviewTimestamp(),
        estado: draft?.estado ?? "",
        items,
        totalsByCurrency,
        canViewPrices,
      }),
    [canViewPrices, cliente, cotizacionCodigo, cotizacionOc, draft?.codigo, draft?.estado, draft?.fecha_requerida, draft?.fecha_solicitud, draft?.solicitante_rq, items, proyecto, totalsByCurrency, unidadTrabajo],
  );

  const buildRequirementHtmlEmail = useCallback(
    ({ title, link }: { title: string; link: string }) =>
      buildRequirementEmailHtmlBody({
        title,
        link,
        codigo: draft?.codigo ?? "",
        proyecto,
        cliente,
        unidadTrabajo,
        cotizacionCodigo,
        cotizacionOc,
        solicitante: draft?.solicitante_rq ?? "",
        fechaSolicitud: formatDate(draft?.fecha_solicitud ?? "") || "-",
        fechaEntrega: formatDate(draft?.fecha_requerida ?? "") || "-",
        updatedAt: nowPreviewTimestamp(),
        estado: draft?.estado ?? "",
        items,
        totalsByCurrency,
        canViewPrices,
      }),
    [canViewPrices, cliente, cotizacionCodigo, cotizacionOc, draft?.codigo, draft?.estado, draft?.fecha_requerida, draft?.fecha_solicitud, draft?.solicitante_rq, items, proyecto, totalsByCurrency, unidadTrabajo],
  );

  const buildManagementPlainEmail = useCallback(
    ({ title, link }: { title: string; link: string }) =>
      buildManagementEmailPlainBody({
        title,
        link,
        codigo: draft?.codigo ?? "",
        proyecto,
        cliente,
        unidadTrabajo,
        cotizacionCodigo,
        cotizacionOc,
        solicitante: draft?.solicitante_rq ?? "",
        responsable: draft?.responsable ?? "",
        fechaSolicitud: formatDate(draft?.fecha_solicitud ?? "") || "-",
        fechaEntrega: formatDate(draft?.fecha_requerida ?? "") || "-",
        updatedAt: nowPreviewTimestamp(),
        estado: draft?.estado ?? "",
        area: draft?.area ?? "",
        observacionesGenerales: draft?.observaciones ?? "",
        items,
        observations,
        totalsByCurrency,
        resourceTypeSummary,
        cotizacionMoneda,
        managementEconomicSummary,
        canViewPrices,
      }),
    [canViewPrices, cliente, cotizacionCodigo, cotizacionMoneda, cotizacionOc, draft?.area, draft?.codigo, draft?.estado, draft?.fecha_requerida, draft?.fecha_solicitud, draft?.observaciones, draft?.responsable, draft?.solicitante_rq, items, managementEconomicSummary, observations, proyecto, resourceTypeSummary, totalsByCurrency, unidadTrabajo],
  );

  const buildManagementHtmlEmail = useCallback(
    ({ title, link }: { title: string; link: string }) =>
      buildManagementEmailHtmlBody({
        title,
        link,
        codigo: draft?.codigo ?? "",
        proyecto,
        cliente,
        unidadTrabajo,
        cotizacionCodigo,
        cotizacionOc,
        solicitante: draft?.solicitante_rq ?? "",
        responsable: draft?.responsable ?? "",
        fechaSolicitud: formatDate(draft?.fecha_solicitud ?? "") || "-",
        fechaEntrega: formatDate(draft?.fecha_requerida ?? "") || "-",
        updatedAt: nowPreviewTimestamp(),
        estado: draft?.estado ?? "",
        area: draft?.area ?? "",
        observacionesGenerales: draft?.observaciones ?? "",
        items,
        observations,
        totalsByCurrency,
        resourceTypeSummary,
        cotizacionMoneda,
        managementEconomicSummary,
        canViewPrices,
      }),
    [canViewPrices, cliente, cotizacionCodigo, cotizacionMoneda, cotizacionOc, draft?.area, draft?.codigo, draft?.estado, draft?.fecha_requerida, draft?.fecha_solicitud, draft?.observaciones, draft?.responsable, draft?.solicitante_rq, items, managementEconomicSummary, observations, proyecto, resourceTypeSummary, totalsByCurrency, unidadTrabajo],
  );

  const buildObservationPlainEmail = useCallback(
    ({ title, link }: { title: string; link: string }) =>
      buildObservationEmailPlainBody({
        title,
        link,
        codigo: draft?.codigo ?? "",
        proyecto,
        cliente,
        observations,
        userDirectory: observationUserDirectory,
      }),
    [cliente, draft?.codigo, observationUserDirectory, observations, proyecto],
  );

  const buildObservationHtmlEmail = useCallback(
    ({ title, link }: { title: string; link: string }) =>
      buildObservationEmailHtmlBody({
        title,
        link,
        codigo: draft?.codigo ?? "",
        proyecto,
        cliente,
        observations,
        userDirectory: observationUserDirectory,
      }),
    [cliente, draft?.codigo, observationUserDirectory, observations, proyecto],
  );

  const buildSelectedObservationPlainEmail = useCallback(
    ({ title, link }: { title: string; link: string }) =>
      buildObservationEmailPlainBody({
        title,
        link,
        codigo: draft?.codigo ?? "",
        proyecto,
        cliente,
        observations: selectedEmailObservations,
        userDirectory: observationUserDirectory,
      }),
    [cliente, draft?.codigo, observationUserDirectory, proyecto, selectedEmailObservations],
  );

  const buildSelectedObservationHtmlEmail = useCallback(
    ({ title, link }: { title: string; link: string }) =>
      buildObservationEmailHtmlBody({
        title,
        link,
        codigo: draft?.codigo ?? "",
        proyecto,
        cliente,
        observations: selectedEmailObservations,
        userDirectory: observationUserDirectory,
      }),
    [cliente, draft?.codigo, observationUserDirectory, proyecto, selectedEmailObservations],
  );

  const buildFilteredObservationPlainEmail = useCallback(
    ({ title, link }: { title: string; link: string }) =>
      buildObservationEmailPlainBody({
        title,
        link,
        codigo: draft?.codigo ?? "",
        proyecto,
        cliente,
        observations: filteredEmailObservations,
        userDirectory: observationUserDirectory,
      }),
    [cliente, draft?.codigo, filteredEmailObservations, observationUserDirectory, proyecto],
  );

  const buildFilteredObservationHtmlEmail = useCallback(
    ({ title, link }: { title: string; link: string }) =>
      buildObservationEmailHtmlBody({
        title,
        link,
        codigo: draft?.codigo ?? "",
        proyecto,
        cliente,
        observations: filteredEmailObservations,
        userDirectory: observationUserDirectory,
      }),
    [cliente, draft?.codigo, filteredEmailObservations, observationUserDirectory, proyecto],
  );

  if (!open || !requerimiento || !draft) return null;

  if (!generalSnapshotRef.current) {
    generalSnapshotRef.current = generalComparable;
  }

  const draftCode = draft.codigo;
  const requirementEmailSubject = [
    cotizacionCodigo,
    cotizacionOc || "SIN OC",
    draftCode,
    proyecto,
  ].map((part) => String(part || "-").trim() || "-").join(" / ");
  const requirementEmailRows = [
    { label: "Código RQ", value: draftCode },
    { label: "Proyecto", value: proyecto },
    { label: "Cliente", value: cliente },
    { label: "Unidad de trabajo", value: unidadTrabajo },
    { label: "Solicitante", value: draft.solicitante_rq },
    { label: "Fecha solicitud", value: formatDate(draft.fecha_solicitud) || "-" },
    { label: "Fecha entrega", value: formatDate(draft.fecha_requerida) || "-" },
    { label: "Estado", value: draft.estado },
  ];
  const managementEmailRows = [
    ...requirementEmailRows,
    { label: "Responsable", value: draft.responsable },
    { label: "Avance", value: `${statusIndicators.progress}%` },
    { label: "Pendientes", value: statusIndicators.pending },
    { label: "Observaciones abiertas", value: observations.filter((observation) => observation.status !== "resolved").length },
    ...(canViewPrices ? [{ label: "Costo registrado", value: formatTotalsByCurrency(totalsByCurrency) }] : []),
  ];
  const isResourceCatalogVisible = catalogPanelOpen && canUseResourceCatalog && canEditItems;
  const isObservationPanelVisible = activeWorkspaceTab === "recursos" && Boolean(selectedItem) && !isResourceCatalogVisible;
  const hasWorkspaceSidePanel = isResourceCatalogVisible || isObservationPanelVisible;
  const requirementLinkPath = `/requerimientos?rqCode=${encodeURIComponent(draftCode)}`;
  const requirementLink = buildPublicAppUrl(requirementLinkPath);
  const requirementTitle = `Requerimiento ${draftCode}`;
  const managementSubject = `Estado a Gerencia / ${draftCode} / ${proyecto || "-"}`;
  const managementTitle = `Estado gerencial ${draftCode}`;
  const canSendManagementReportEmail = canSendRequirementEmail || canSendManagementEmail;
  const managementPreviewDescription = "Preview seguro: esta acción no envía Gmail; usa Enviar reporte gerencial para el envío real.";

  async function copyPreparedEmailHtml(
    html: string,
    plain: string,
    successMessage: string,
  ) {
    try {
      await copyEmailHtmlWithFallback(html, plain);
      setCopyStatusMessage(successMessage);
      window.setTimeout(() => setCopyStatusMessage(""), 2600);
    } catch {
      setCopyStatusMessage("No se pudo copiar. Revisa permisos del portapapeles.");
      window.setTimeout(() => setCopyStatusMessage(""), 3200);
    }
  }

  function copyRequirementHtml() {
    const plain = buildRequirementPlainEmail({ title: requirementTitle, link: requirementLink });
    const html = buildRequirementHtmlEmail({ title: requirementTitle, link: requirementLink });
    void copyPreparedEmailHtml(html, plain, "Requerimiento copiado");
  }

  function copyManagementHtml() {
    const plain = buildManagementPlainEmail({ title: managementTitle, link: requirementLink });
    const html = buildManagementHtmlEmail({ title: managementTitle, link: requirementLink });
    void copyPreparedEmailHtml(html, plain, "Reporte gerencial copiado");
  }

  function copySelectedObservationsHtml() {
    if (selectedEmailObservations.length === 0) return;
    const title = `Observaciones seleccionadas ${draftCode}`;
    const link = buildPublicAppUrl(`${requirementLinkPath}&scope=seleccionados`);
    const plain = buildSelectedObservationPlainEmail({ title, link });
    const html = buildSelectedObservationHtmlEmail({ title, link });
    void copyPreparedEmailHtml(html, plain, "Observaciones seleccionadas copiadas");
  }

  function copyFilteredObservationsHtml() {
    if (filteredEmailObservations.length === 0) return;
    const title = `Observaciones filtradas ${draftCode}`;
    const link = buildPublicAppUrl(`${requirementLinkPath}&scope=filtrados`);
    const plain = buildFilteredObservationPlainEmail({ title, link });
    const html = buildFilteredObservationHtmlEmail({ title, link });
    void copyPreparedEmailHtml(html, plain, "Observaciones filtradas copiadas");
  }

  function copyAllObservationsHtml() {
    if (observations.length === 0) return;
    const title = `Observaciones ${draftCode}`;
    const link = buildPublicAppUrl(`${requirementLinkPath}&tab=observaciones`);
    const plain = buildObservationPlainEmail({ title, link });
    const html = buildObservationHtmlEmail({ title, link });
    void copyPreparedEmailHtml(html, plain, "Observaciones copiadas");
  }

  const workspaceActions = (
    <div className="relative flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5">
      <div className="flex shrink-0 items-center justify-end gap-1.5">
        <EmailThreadButton
          kind="requirement"
          entityCode={draftCode}
          subject={requirementEmailSubject}
          title={requirementTitle}
          linkPath={requirementLinkPath}
          summaryRows={requirementEmailRows}
          buildPlainBody={buildRequirementPlainEmail}
          buildHtmlBody={buildRequirementHtmlEmail}
          showHtmlPreview
          sendEnabled
          emailPurpose="operational_request"
          className={workspaceActionButtonClassName()}
          buttonLabel="Enviar RQ"
          modalTitle="Enviar requerimiento"
          sendButtonLabel="Enviar requerimiento"
        />
        <details className="relative shrink-0">
          <summary className={`${workspaceActionButtonClassName()} cursor-pointer list-none`}>
            <WorkspaceActionIcon name="menu" />
            <span>Acciones RQ</span>
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-56 rounded border border-stone-200 bg-white p-1 shadow-lg">
            <button
              type="button"
              onClick={copyRequirementHtml}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium text-stone-600 hover:bg-stone-50"
            >
              <WorkspaceActionIcon name="copy" />
              <span className="whitespace-nowrap">Copiar RQ</span>
            </button>
            <EmailThreadButton
              kind="requirement"
              emailPurpose="management_report"
              entityCode={draftCode}
              subject={managementSubject}
              title={managementTitle}
              linkPath={requirementLinkPath}
              summaryRows={managementEmailRows}
              buildPlainBody={buildManagementPlainEmail}
              buildHtmlBody={buildManagementHtmlEmail}
              showHtmlPreview
              previewOnly
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium text-stone-600 hover:bg-stone-50"
              buttonLabel="Reporte gerencial"
              modalTitle="Reporte gerencial"
              modalDescription={managementPreviewDescription}
            />
            <EmailThreadButton
              kind="requirement"
              emailPurpose="management_report"
              entityCode={draftCode}
              subject={managementSubject}
              title={managementTitle}
              linkPath={requirementLinkPath}
              summaryRows={managementEmailRows}
              buildPlainBody={buildManagementPlainEmail}
              buildHtmlBody={buildManagementHtmlEmail}
              showHtmlPreview
              sendEnabled={canSendManagementReportEmail}
              disabled={!canSendManagementReportEmail}
              disabledTitle="No tienes permiso para enviar el reporte gerencial."
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              buttonLabel="Enviar reporte gerencial"
              modalTitle="Enviar reporte gerencial"
              modalDescription="Envío Gmail real en hilo gerencial independiente para este RQ."
              sendButtonLabel="Enviar reporte gerencial"
            />
            <button
              type="button"
              onClick={copyManagementHtml}
              title="Copiar reporte gerencial"
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium text-stone-600 hover:bg-stone-50"
            >
              <WorkspaceActionIcon name="copy" />
              <span className="whitespace-nowrap">Copiar reporte</span>
            </button>
          </div>
        </details>
        <details className="relative shrink-0">
          <summary className={`${workspaceActionButtonClassName()} cursor-pointer list-none`}>
            <WorkspaceActionIcon name="menu" />
            <span>Observaciones</span>
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-52 rounded border border-stone-200 bg-white p-1 shadow-lg">
            <button
              type="button"
              onClick={copySelectedObservationsHtml}
              disabled={selectedEmailObservations.length === 0}
              className="block w-full rounded px-2 py-1.5 text-left text-[11px] font-medium text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Copiar seleccionadas ({selectedEmailObservations.length})
            </button>
            <button
              type="button"
              onClick={copyFilteredObservationsHtml}
              disabled={filteredEmailObservations.length === 0}
              className="block w-full rounded px-2 py-1.5 text-left text-[11px] font-medium text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Copiar filtradas ({filteredEmailObservations.length})
            </button>
            <button
              type="button"
              onClick={copyAllObservationsHtml}
              disabled={observations.length === 0}
              className="block w-full rounded px-2 py-1.5 text-left text-[11px] font-medium text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Copiar todas ({observations.length})
            </button>
          </div>
        </details>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-1.5">
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
      {copyStatusMessage ? (
        <span className="pointer-events-none absolute right-0 top-full z-30 mt-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm" aria-live="polite">
          {copyStatusMessage}
        </span>
      ) : null}
    </div>
  );
  const tabButtonClassName = (tab: WorkspaceTab) =>
    `inline-flex h-7 items-center rounded border px-2 text-[11px] font-semibold ${
      activeWorkspaceTab === tab
        ? "border-stone-900 bg-stone-900 text-white"
        : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
    }`;
  const resourceObservationPanelFooter = (
    <div className="rounded border border-stone-200 bg-stone-50 p-2">
      <div className="mb-2 grid grid-cols-2 gap-1.5 text-[10.5px]">
        <div className="rounded border border-stone-200 bg-white px-2 py-1">
          <span className="block font-semibold text-stone-500">Seleccionados</span>
          <span className="text-[12px] font-semibold text-stone-800">
            {selectedObservationItems.length} recursos · {selectedEmailAttachments.length} adjuntos
          </span>
        </div>
        <div className="rounded border border-stone-200 bg-white px-2 py-1">
          <span className="block font-semibold text-stone-500">Filtrados</span>
          <span className="text-[12px] font-semibold text-stone-800">
            {filteredObservedItems.length} recursos · {filteredEmailAttachments.length} adjuntos
          </span>
        </div>
      </div>
      <div className="text-[10.5px] font-medium text-stone-500">
        Usa el menú Observaciones de la barra superior para copiar seleccionadas, filtradas o todas.
      </div>
    </div>
  );
  const resourceObservationPanel = (
    <RequirementObservationPanel
      selectedItem={selectedItem}
      observations={selectedItemObservations}
      selectedObservationId={selectedObservation?.id ?? null}
      selectedObservation={selectedObservation}
      requirementCode={draft.codigo}
      currentUser={currentObservationUser}
      userDirectory={observationUserDirectory}
      defaultAssignedUserId={defaultAssignedObservationUserId}
      defaultAssignedSource={defaultAssignedObservationSource}
      requesterLabel={draft.solicitante_rq}
      requesterIsRegistered={requesterIsRegistered}
      loadingUsers={loadingUsers}
      usersLoadError={usersLoadError}
      onRetryUsers={onRetryUsers}
      footer={resourceObservationPanelFooter}
      onClose={() => setSelectedItemId(null)}
      onSelectObservation={setSelectedObservationId}
      onCreateObservation={createObservationForSelectedItem}
      onAddResponse={addResponseToObservation}
      onApproveObservation={resolveObservation}
      onRequestCorrection={requestCorrectionObservation}
      onReopenObservation={reopenObservation}
      onReassignObservation={reassignObservation}
    />
  );
  const observationsPanel = (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-panel">
      <div className="flex flex-none items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FieldLabelIcon icon="clipboard-list" label="Observaciones del requerimiento" className="text-xs font-medium" />
          <span className="rounded border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-stone-500">
            Preview local
          </span>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <a
            href={`/requerimientos?rqCode=${encodeURIComponent(draft.codigo)}`}
            className={workspaceActionButtonClassName()}
            onClick={(event) => event.preventDefault()}
            title="Link simulado al RQ"
          >
            Abrir RQ
          </a>
          <span className="inline-flex h-6 min-h-6 items-center gap-1 whitespace-nowrap rounded border border-stone-200 bg-stone-50 px-1.5 text-[11px] font-medium text-stone-500">
            ✓ Disponible para copiar desde Observaciones
          </span>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-h-0 overflow-auto rounded border border-border bg-white">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 bg-stone-50 text-stone-500">
              <tr>
                <th className="w-[110px] border-b border-stone-200 px-2 py-1.5 text-left font-semibold">Recurso</th>
                <th className="border-b border-stone-200 px-2 py-1.5 text-left font-semibold">Observación</th>
                <th className="w-[100px] border-b border-stone-200 px-2 py-1.5 text-left font-semibold">Estado</th>
                <th className="w-[90px] border-b border-stone-200 px-2 py-1.5 text-right font-semibold">Respuestas</th>
                <th className="w-[90px] border-b border-stone-200 px-2 py-1.5 text-right font-semibold">Evidencias</th>
              </tr>
            </thead>
            <tbody>
              {observations.length ? (
                observations.map((observation) => (
                  <tr
                    key={observation.id}
                    className={`cursor-pointer border-b border-stone-100 align-top hover:bg-stone-50 ${
                      selectedObservation?.id === observation.id ? "bg-amber-50/60" : ""
                    }`}
                    onClick={() => {
                      setSelectedItemId(observation.itemId);
                      setSelectedObservationId(observation.id);
                    }}
                  >
                    <td className="px-2 py-2 font-semibold text-stone-700">{observation.itemCode}</td>
                    <td className="px-2 py-2">
                      <p className="font-medium text-stone-800">{observation.code} · {observation.description}</p>
                      <p className="mt-0.5 line-clamp-2 text-[10.5px] text-stone-500">{observation.itemDescription}</p>
                      <p className="mt-1 text-[10px] text-stone-400">
                        {observation.createdAt} · Resp. {observationUserEmailLabel(observationUserDirectory, observation.assignedUserId)}
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${observationStatusClassName(observationStatusForItem([observation]))}`}>
                        {observationStatusLabel(observation.status)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-stone-700">{observation.responses.length}</td>
                    <td className="px-2 py-2 text-right font-semibold text-stone-700">{observationEvidenceCount(observation)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[11px] text-stone-400">
                    Selecciona un recurso en la grilla para iniciar la trazabilidad local.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
          <div className="rounded border border-border bg-white p-3">
            {selectedObservation ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-stone-800">
                      {selectedObservation.code} · {selectedObservation.description}
                    </p>
                    <p className="mt-1 text-[11px] text-stone-500">
                      {selectedObservation.itemCode} · {selectedObservation.itemDescription}
                    </p>
                  </div>
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${observationStatusClassName(selectedObservationGridStatus)}`}>
                    {observationStatusLabel(selectedObservation.status)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded border border-stone-200 bg-stone-50 px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-stone-500">Respuestas</p>
                    <p className="text-[12px] font-semibold text-stone-800">{selectedObservation.responses.length}</p>
                  </div>
                  <div className="rounded border border-stone-200 bg-stone-50 px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-stone-500">Evidencias</p>
                    <p className="text-[12px] font-semibold text-stone-800">{observationEvidenceCount(selectedObservation)}</p>
                  </div>
                  <div className="rounded border border-stone-200 bg-stone-50 px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-stone-500">Requiere evidencia</p>
                    <p className="text-[12px] font-semibold text-stone-800">{selectedObservation.requiresEvidence ? "Sí" : "No"}</p>
                  </div>
                </div>
                <p className="mt-2 text-[10.5px] text-stone-500">
                  Observó <strong className="text-stone-700">{observationUserEmailLabel(observationUserDirectory, selectedObservation.observerUserId)}</strong> · Responsable{" "}
                  <strong className="text-stone-700">{observationUserEmailLabel(observationUserDirectory, selectedObservation.assignedUserId)}</strong>
                </p>
              </>
            ) : (
              <p className="text-[11px] text-stone-400">Selecciona una observación para ver respuestas y evidencias.</p>
            )}
          </div>
          <div className="min-h-0 overflow-auto rounded border border-border bg-white p-3">
            {selectedObservation ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-stone-700">Actividad</p>
                {selectedObservation.statusHistory.map((entry) => (
                  <div key={entry.id} className="rounded border border-stone-200 bg-stone-50 px-2 py-1.5">
                    <p className="text-[10.5px] font-semibold text-stone-700">
                      {entry.previousStatus ? `${observationStatusLabel(entry.previousStatus)} → ` : ""}
                      {observationStatusLabel(entry.nextStatus)}
                    </p>
                    <p className="text-[10px] text-stone-500">
                      {observationUserEmailLabel(observationUserDirectory, entry.actorUserId)} · {entry.createdAt}
                    </p>
                    {entry.note ? <p className="mt-0.5 text-[10px] text-stone-600">{entry.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-stone-400">Sin observación activa.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`fixed inset-0 ${zIndexClassName} bg-black/20 p-3 md:p-4`}>
      <div className="mx-auto flex h-[calc(100vh-24px)] max-h-[calc(100vh-24px)] w-[92vw] max-w-[1600px] flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-lg">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
          <div className="mb-2 flex flex-none flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab("recursos")}
                className={tabButtonClassName("recursos")}
              >
                Recursos
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveWorkspaceTab("observaciones");
                  setCatalogPanelOpen(false);
                }}
                className={tabButtonClassName("observaciones")}
              >
                Observaciones {observations.length ? `(${observations.length})` : ""}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCatalogPanelOpen((current) => !current)}
              className="inline-flex h-7 items-center rounded border border-border bg-white px-2 text-[11px] font-medium text-stone-600 lg:hidden"
            >
              {catalogPanelOpen ? "Ocultar catálogo" : "Catálogo de recursos"}
            </button>
          </div>
          <div
            className={`grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden ${
              hasWorkspaceSidePanel
                ? "lg:grid-cols-[minmax(0,2fr)_clamp(460px,32vw,520px)]"
                : "lg:grid-cols-1"
            }`}
          >
            <div className="flex min-h-0 flex-col overflow-hidden">
          <section className="mb-2 flex-none">
            <div
              className={`grid grid-cols-1 items-stretch gap-2 ${
                hasWorkspaceSidePanel ? "" : "xl:grid-cols-[1.35fr_1fr]"
              }`}
            >
              <div className="flex min-w-0 flex-col">
                <div className="mb-1 flex min-h-6 items-center justify-between gap-2">
                  <FieldLabelIcon icon="file-text" label="Datos generales" className="text-[11px] font-medium" />
                  <div className="flex min-w-0 flex-col items-end gap-1">
                    {hasWorkspaceSidePanel ? workspaceActions : null}
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

              {!hasWorkspaceSidePanel ? (
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
            {activeWorkspaceTab === "recursos" ? (
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
                onRowClick={handleSelectObservationItem}
                selectedObservationItemId={selectedItemId}
                selectedObservationItemIds={selectedObservationItemIds}
                observationStatusByItemId={observationStatusByItemId}
                onToggleObservationItemSelection={handleToggleObservationItemSelection}
                onToggleFilteredObservationItems={handleToggleFilteredObservationItems}
                onFilteredObservationItemsChange={handleFilteredObservationItemsChange}
                fullHeight
                maxHeightClassName="h-full"
              />
            ) : (
              observationsPanel
            )}
          </div>
            </div>
            <div
              className={`${
                hasWorkspaceSidePanel
                  ? "fixed inset-x-3 bottom-3 top-14 z-[85] flex overflow-hidden rounded-xl border border-border bg-white shadow-xl lg:static lg:inset-auto lg:z-auto lg:min-h-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none"
                  : "hidden"
              } min-h-0`}
            >
              {isResourceCatalogVisible ? (
                <ResourceCatalogPanel
                  resources={recursos}
                  onSelectResource={handleCatalogResourceSelect}
                  onClose={closeResourceCatalog}
                  canAddResource={canAddCatalogResource}
                  className="h-full"
                />
              ) : null}
              {isObservationPanelVisible ? resourceObservationPanel : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
