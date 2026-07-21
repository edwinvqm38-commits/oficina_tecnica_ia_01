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
import { EmailThreadButton } from "@/components/sgp/EmailThreadButton";
import { ObservationComments, type ObservationComment } from "@/components/sgp/ObservationComments";
import { ObservationDocumentUpload, formatFileSize } from "@/components/sgp/ObservationDocumentUpload";
import type { EstadoRequerimiento, Recurso, Requerimiento, ResourceFileMeta } from "@/lib/sgp/demoData";
import { authFetch } from "@/lib/api/authFetch";
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
type WorkspaceTab = "recursos" | "observaciones";

type RequirementObservation = {
  id: string;
  requirementId: string;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  title: string;
  status: Exclude<RequirementObservationStatus, "Sin observación">;
  author: string;
  createdAt: string;
  documents: ResourceFileMeta[];
};

type ObservationUploadMode = "attach" | "lift";

type DriveUploadResponse = {
  file_id: string;
  name: string;
  mime_type: string;
  size: number;
  folder_id: string;
  web_view_link: string;
  web_content_link?: string | null;
};

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

function buildRequirementEmailPlainBody(input: {
  title: string;
  link: string;
  codigo: string;
  proyecto: string;
  cliente: string;
  unidadTrabajo: string;
  solicitante: string;
  fechaSolicitud: string;
  estado: string;
  items: EditableRequirementItem[];
}): string {
  const resourceLines = input.items.length
    ? input.items
        .map((item, index) =>
          [
            `${index + 1}. ${cleanEmailValue(item.descripcion)}`,
            `   Código fabricante: ${cleanEmailValue(item.codigo_fabricante)}`,
            `   Tipo recurso: ${cleanEmailValue(item.tipo_recurso)}`,
            `   Información adicional: ${cleanEmailValue(item.informacion_adicional)}`,
            `   Cantidad solicitada: ${formatEmailQuantity(item.cantidad)} ${cleanEmailValue(item.unidad, "")}`.trim(),
          ].join("\n"),
        )
        .join("\n\n")
    : "Sin recursos registrados.";

  return [
    "Hola,",
    "",
    `Se comparte ${input.title.toLowerCase()} para revisión/seguimiento.`,
    "",
    `Código RQ: ${cleanEmailValue(input.codigo)}`,
    `Proyecto: ${cleanEmailValue(input.proyecto)}`,
    `Cliente: ${cleanEmailValue(input.cliente)}`,
    `Unidad de trabajo: ${cleanEmailValue(input.unidadTrabajo)}`,
    `Solicitante: ${cleanEmailValue(input.solicitante)}`,
    `Fecha solicitud: ${cleanEmailValue(input.fechaSolicitud)}`,
    `Estado: ${cleanEmailValue(input.estado)}`,
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
  solicitante: string;
  fechaSolicitud: string;
  estado: string;
  items: EditableRequirementItem[];
}): string {
  const summaryCells = [
    ["Cliente", input.cliente],
    ["Proyecto", input.proyecto],
    ["Unidad de trabajo", input.unidadTrabajo],
    ["Solicitante", input.solicitante],
    ["Total de recursos", input.items.length],
    ["Estado", input.estado],
  ]
    .map(
      ([label, value]) => `
        <td style="width:33.333%;padding:0 6px 8px 0;vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;background:#ffffff;">
            <tr>
              <td style="padding:7px 9px 2px;font-size:10px;line-height:14px;color:#6b7280;text-transform:uppercase;letter-spacing:.2px;">${escapeEmailHtml(label)}</td>
            </tr>
            <tr>
              <td style="padding:0 9px 8px;font-size:12px;line-height:16px;color:#111827;font-weight:700;">${escapeEmailHtml(value)}</td>
            </tr>
          </table>
        </td>`,
    )
    .join("");

  const resourceRows = input.items.length
    ? input.items
        .map(
          (item, index) => `
            <tr style="background:${index % 2 === 0 ? "#ffffff" : "#fbfcfd"};">
              <td style="padding:6px 7px;border:1px solid #e5e7eb;text-align:right;font-size:11px;line-height:15px;color:#374151;">${index + 1}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;line-height:15px;color:#111827;font-weight:600;">${escapeEmailHtml(item.codigo_fabricante)}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;line-height:15px;color:#374151;">${escapeEmailHtml(item.tipo_recurso)}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;line-height:15px;color:#111827;">${escapeEmailHtml(item.descripcion)}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;text-align:right;font-size:11px;line-height:15px;color:#111827;font-weight:700;">${escapeEmailHtml(formatEmailQuantity(item.cantidad))}</td>
              <td style="padding:6px 7px;border:1px solid #e5e7eb;font-size:11px;line-height:15px;color:#374151;">${escapeEmailHtml(item.unidad)}</td>
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="6" style="padding:10px;border:1px solid #e5e7eb;color:#6b7280;font-size:12px;">Sin recursos registrados.</td></tr>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef1f4;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;color:#eef1f4;">Requerimiento ${escapeEmailHtml(input.codigo)} - ${escapeEmailHtml(input.estado)}</div>
    <div style="max-width:920px;margin:0 auto;padding:22px 14px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #d9dee5;">
      <tr>
        <td style="padding:18px 22px;background:#0f172a;color:#ffffff;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top;">
                <div style="font-size:11px;line-height:14px;letter-spacing:1.2px;text-transform:uppercase;color:#cbd5e1;font-weight:700;">REQUERIMIENTO</div>
                <div style="margin-top:4px;font-size:22px;line-height:27px;color:#ffffff;font-weight:700;">${escapeEmailHtml(input.codigo)}</div>
              </td>
              <td style="vertical-align:top;text-align:right;">
                <div style="display:inline-block;margin-bottom:6px;padding:4px 8px;border:1px solid #334155;background:#1e293b;color:#f8fafc;font-size:11px;line-height:14px;font-weight:700;">Estado: ${escapeEmailHtml(input.estado)}</div>
                <div style="font-size:12px;line-height:16px;color:#cbd5e1;">Fecha: ${escapeEmailHtml(input.fechaSolicitud)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 22px 8px;background:#ffffff;">
          <p style="margin:0 0 14px;font-size:13px;line-height:18px;color:#374151;">Se comparte el requerimiento para revisión y seguimiento del equipo de proyecto.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr>${summaryCells}</tr>
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
                <th style="width:140px;padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;line-height:13px;color:#374151;text-transform:uppercase;">Código fabricante</th>
                <th style="width:120px;padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;line-height:13px;color:#374151;text-transform:uppercase;">Tipo recurso</th>
                <th style="padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;line-height:13px;color:#374151;text-transform:uppercase;">Descripción</th>
                <th style="width:80px;padding:7px;border:1px solid #e5e7eb;text-align:right;font-size:10px;line-height:13px;color:#374151;text-transform:uppercase;">Cantidad</th>
                <th style="width:70px;padding:7px;border:1px solid #e5e7eb;text-align:left;font-size:10px;line-height:13px;color:#374151;text-transform:uppercase;">Unidad</th>
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

function observationStatusForItem(observations: RequirementObservation[]): RequirementObservationStatus {
  if (observations.length === 0) return "Sin observación";
  if (observations.some((observation) => observation.status === "Observado")) return "Observado";
  if (observations.some((observation) => observation.status === "En seguimiento")) return "En seguimiento";
  return "Levantado";
}

function collectObservationEmailAttachments(observations: RequirementObservation[]): ObservationEmailAttachment[] {
  return observations.flatMap((observation) =>
    observation.documents.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.futureDriveUrl || null,
    })),
  );
}

function buildObservationEmailPlainBody(input: {
  title: string;
  link: string;
  codigo: string;
  proyecto: string;
  cliente: string;
  observations: RequirementObservation[];
  comments: ObservationComment[];
}): string {
  const observationLines = input.observations.length
    ? input.observations
        .map((observation, index) => {
          const commentCount = input.comments.filter((comment) => comment.observationId === observation.id).length;
          return [
            `${index + 1}. ${observation.title}`,
            `   Recurso: ${observation.itemCode || "-"} - ${observation.itemDescription || "-"}`,
            `   Estado: ${observation.status}`,
            `   Evidencias Drive: ${observation.documents.length}`,
            `   Adjuntos: ${
              observation.documents.length
                ? observation.documents
                    .map((file) => `${file.name}${file.futureDriveUrl ? ` (${file.futureDriveUrl})` : ""}`)
                    .join(", ")
                : "-"
            }`,
            `   Comentarios: ${commentCount}`,
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
  comments: ObservationComment[];
}): string {
  const rows = input.observations.length
    ? input.observations
        .map((observation, index) => {
          const commentCount = input.comments.filter((comment) => comment.observationId === observation.id).length;
          const attachments = observation.documents.length
            ? observation.documents
                .map((file) =>
                  file.futureDriveUrl
                    ? `<a href="${escapeEmailHtml(file.futureDriveUrl)}" style="color:#0f766e;text-decoration:underline;">${escapeEmailHtml(file.name)}</a>`
                    : escapeEmailHtml(file.name),
                )
                .join("<br>")
            : "-";
          return `
            <tr>
              <td style="padding:7px;border:1px solid #e5e7eb;text-align:right;color:#374151;">${index + 1}</td>
              <td style="padding:7px;border:1px solid #e5e7eb;font-weight:700;color:#111827;">${escapeEmailHtml(observation.itemCode || "-")}</td>
              <td style="padding:7px;border:1px solid #e5e7eb;color:#111827;">${escapeEmailHtml(observation.title)}</td>
              <td style="padding:7px;border:1px solid #e5e7eb;color:#374151;">${escapeEmailHtml(observation.status)}</td>
              <td style="padding:7px;border:1px solid #e5e7eb;text-align:right;color:#111827;">${observation.documents.length}</td>
              <td style="padding:7px;border:1px solid #e5e7eb;color:#374151;">${attachments}</td>
              <td style="padding:7px;border:1px solid #e5e7eb;text-align:right;color:#111827;">${commentCount}</td>
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
            <p style="margin:0 0 12px;font-size:13px;line-height:18px;color:#374151;">Resumen de observaciones, comentarios y evidencias Drive para pruebas locales.</p>
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
                  <th style="width:80px;padding:7px;border:1px solid #e5e7eb;text-align:right;">Docs</th>
                  <th style="width:150px;padding:7px;border:1px solid #e5e7eb;text-align:left;">Adjuntos</th>
                  <th style="width:90px;padding:7px;border:1px solid #e5e7eb;text-align:right;">Comentarios</th>
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
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("recursos");
  const [observations, setObservations] = useState<RequirementObservation[]>([]);
  const [comments, setComments] = useState<ObservationComment[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedObservationItemIds, setSelectedObservationItemIds] = useState<string[]>([]);
  const [filteredObservationItemIds, setFilteredObservationItemIds] = useState<string[]>([]);
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);
  const [uploadObservationId, setUploadObservationId] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<ObservationUploadMode>("attach");
  const [isUploadingObservationFile, setIsUploadingObservationFile] = useState(false);
  const [observationMessage, setObservationMessage] = useState("");
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
      setCatalogPanelOpen(false);
      setActiveWorkspaceTab("recursos");
      setObservations([]);
      setComments([]);
      setSelectedItemId(null);
      setSelectedObservationItemIds([]);
      setFilteredObservationItemIds([]);
      setSelectedObservationId(null);
      setUploadObservationId(null);
      setUploadMode("attach");
      setIsUploadingObservationFile(false);
      setObservationMessage("");
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
  const selectedObservationComments = useMemo(
    () => comments.filter((comment) => comment.observationId === selectedObservation?.id),
    [comments, selectedObservation?.id],
  );
  const uploadObservation = useMemo(
    () => observations.find((observation) => observation.id === uploadObservationId) ?? null,
    [observations, uploadObservationId],
  );
  const selectedObservationStatus = selectedObservation?.status ?? observationStatusForItem(selectedItemObservations);
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
  const allObservationEmailAttachments = useMemo(
    () => collectObservationEmailAttachments(observations),
    [observations],
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

  const createObservationForItem = useCallback(
    (item: EditableRequirementItem, titleOverride?: string): string => {
      const id = makePreviewId("obs");
      const title = titleOverride || `Observación sobre ${item.codigo_fabricante || item.descripcion || "recurso"}`;
      const createdAt = nowPreviewTimestamp();
      const author = draft?.solicitante_rq || "Usuario preview";
      const observation: RequirementObservation = {
        id,
        requirementId: draft?.id ?? requerimiento?.id ?? "preview-rq",
        itemId: item.id,
        itemCode: item.codigo_fabricante || item.codigo_recurso || "-",
        itemDescription: item.descripcion || item.recurso_a_suministrar || "-",
        title,
        status: "Observado",
        author,
        createdAt,
        documents: [],
      };
      setObservations((current) => [observation, ...current]);
      setComments((current) => [
        {
          id: makePreviewId("comment"),
          observationId: id,
          author,
          message: title,
          createdAt,
        },
        ...current,
      ]);
      setSelectedItemId(item.id);
      setSelectedObservationId(id);
      setCatalogPanelOpen(false);
      return id;
    },
    [draft?.id, draft?.solicitante_rq, requerimiento?.id],
  );

  const handleSelectObservationItem = useCallback((item: EditableRequirementItem) => {
    setSelectedItemId(item.id);
    setCatalogPanelOpen(false);
    setObservationMessage("");
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

  const openObservationUpload = useCallback(
    (mode: ObservationUploadMode) => {
      if (!selectedItem) return;
      const observationId =
        selectedObservation?.id ??
        createObservationForItem(selectedItem, `Observación sobre ${selectedItem.codigo_fabricante || selectedItem.descripcion || "recurso"}`);
      setUploadMode(mode);
      setSelectedObservationId(observationId);
      setUploadObservationId(observationId);
      setObservationMessage("");
    },
    [createObservationForItem, selectedItem, selectedObservation?.id],
  );

  const addCommentToSelectedObservation = useCallback(
    (message: string) => {
      if (!selectedObservation) return;
      setComments((current) => [
        {
          id: makePreviewId("comment"),
          observationId: selectedObservation.id,
          author: draft?.solicitante_rq || "Usuario preview",
          message,
          createdAt: nowPreviewTimestamp(),
        },
        ...current,
      ]);
    },
    [draft?.solicitante_rq, selectedObservation],
  );

  const createObservationFromPanel = useCallback(
    (message: string) => {
      const title = message.trim();
      if (!selectedItem || !title) return;
      createObservationForItem(selectedItem, title);
      setObservationMessage("");
    },
    [createObservationForItem, selectedItem],
  );

  const updateObservationStatus = useCallback(
    (observationId: string, status: Exclude<RequirementObservationStatus, "Sin observación">) => {
      setObservations((current) =>
        current.map((observation) => (observation.id === observationId ? { ...observation, status } : observation)),
      );
      if (status === "En seguimiento" || status === "Levantado") {
        setComments((current) => [
          {
            id: makePreviewId("comment"),
            observationId,
            author: draft?.solicitante_rq || "Usuario preview",
            message: `Estado actualizado a ${status}.`,
            createdAt: nowPreviewTimestamp(),
          },
          ...current,
        ]);
      }
    },
    [draft?.solicitante_rq],
  );

  const uploadObservationFileToDrive = useCallback(
    async (file: File): Promise<ResourceFileMeta> => {
      if (!draft?.codigo) throw new Error("Falta código RQ para subir evidencia a Drive.");
      const form = new FormData();
      form.append("file", file);
      form.append("entityType", "requirement");
      form.append("entityCode", draft.codigo);
      form.append("category", "attachment");

      const response = await authFetch("/api/drive/upload", {
        method: "POST",
        body: form,
      });
      const json = (await response.json().catch(() => ({}))) as Partial<DriveUploadResponse> & { error?: string };
      if (!response.ok || !json.file_id) {
        throw new Error(json.error || `No se pudo subir ${file.name} a Drive.`);
      }

      return {
        name: json.name || file.name,
        size: Number(json.size ?? file.size),
        type: json.mime_type || file.type || "application/octet-stream",
        localPreviewUrl: "",
        futureDriveFileId: json.file_id,
        futureDriveUrl: json.web_view_link || `https://drive.google.com/file/d/${json.file_id}/view`,
        driveFolderId: json.folder_id,
        driveWebContentLink: json.web_content_link ?? undefined,
        file_name: json.name || file.name,
        file_type: "attachment",
        mime_type: json.mime_type || file.type || "application/octet-stream",
        uploaded_at: new Date().toISOString(),
      };
    },
    [draft?.codigo],
  );

  const attachFilesToObservation = useCallback(
    async (files: File[]) => {
      if (!uploadObservationId || files.length === 0) return;
      setIsUploadingObservationFile(true);
      setObservationMessage("");
      try {
        const uploadedFiles: ResourceFileMeta[] = [];
        for (const file of files) {
          uploadedFiles.push(await uploadObservationFileToDrive(file));
        }

        setObservations((current) =>
          current.map((observation) =>
            observation.id === uploadObservationId
              ? {
                  ...observation,
                  status: uploadMode === "lift" ? "Levantado" : observation.status,
                  documents: [...uploadedFiles, ...observation.documents],
                }
              : observation,
          ),
        );
        setComments((current) => [
          {
            id: makePreviewId("comment"),
            observationId: uploadObservationId,
            author: draft?.solicitante_rq || "Usuario preview",
            message:
              uploadMode === "lift"
                ? `Observación levantada con evidencia Drive: ${uploadedFiles.map((file) => file.name).join(", ")}`
                : `Se adjuntaron ${uploadedFiles.length} archivo(s) en Drive: ${uploadedFiles.map((file) => file.name).join(", ")}`,
            createdAt: nowPreviewTimestamp(),
          },
          ...current,
        ]);
        setObservationMessage(`Evidencia subida a Drive: ${uploadedFiles.map((file) => file.name).join(", ")}`);
        setUploadObservationId(null);
      } catch (error) {
        setObservationMessage(error instanceof Error ? error.message : "No se pudo subir la evidencia a Drive.");
      } finally {
        setIsUploadingObservationFile(false);
      }
    },
    [draft?.solicitante_rq, uploadMode, uploadObservationFileToDrive, uploadObservationId],
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
        solicitante: draft?.solicitante_rq ?? "",
        fechaSolicitud: formatDate(draft?.fecha_solicitud ?? "") || "-",
        estado: draft?.estado ?? "",
        items,
      }),
    [cliente, draft?.codigo, draft?.estado, draft?.fecha_solicitud, draft?.solicitante_rq, items, proyecto, unidadTrabajo],
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
        solicitante: draft?.solicitante_rq ?? "",
        fechaSolicitud: formatDate(draft?.fecha_solicitud ?? "") || "-",
        estado: draft?.estado ?? "",
        items,
      }),
    [cliente, draft?.codigo, draft?.estado, draft?.fecha_solicitud, draft?.solicitante_rq, items, proyecto, unidadTrabajo],
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
        comments,
      }),
    [cliente, comments, draft?.codigo, observations, proyecto],
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
        comments,
      }),
    [cliente, comments, draft?.codigo, observations, proyecto],
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
        comments,
      }),
    [cliente, comments, draft?.codigo, proyecto, selectedEmailObservations],
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
        comments,
      }),
    [cliente, comments, draft?.codigo, proyecto, selectedEmailObservations],
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
        comments,
      }),
    [cliente, comments, draft?.codigo, filteredEmailObservations, proyecto],
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
        comments,
      }),
    [cliente, comments, draft?.codigo, filteredEmailObservations, proyecto],
  );

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
    { label: "Código RQ", value: draft.codigo },
    { label: "Proyecto", value: proyecto },
    { label: "Cliente", value: cliente },
    { label: "Unidad de trabajo", value: unidadTrabajo },
    { label: "Solicitante", value: draft.solicitante_rq },
    { label: "Fecha solicitud", value: formatDate(draft.fecha_solicitud) || "-" },
    { label: "Estado", value: draft.estado },
  ];
  const isResourceCatalogVisible = catalogPanelOpen && canUseResourceCatalog && canEditItems;
  const isObservationPanelVisible = activeWorkspaceTab === "recursos" && Boolean(selectedItem) && !isResourceCatalogVisible;
  const hasWorkspaceSidePanel = isResourceCatalogVisible || isObservationPanelVisible;
  const workspaceActions = (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
      <EmailThreadButton
        kind="requirement"
        entityCode={draft.codigo}
        subject={requirementEmailSubject}
        title={`Requerimiento ${draft.codigo}`}
        linkPath={`/requerimientos?rqCode=${encodeURIComponent(draft.codigo)}`}
        summaryRows={requirementEmailRows}
        buildPlainBody={buildRequirementPlainEmail}
        buildHtmlBody={buildRequirementHtmlEmail}
        showHtmlPreview
        previewOnly
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
  const observationEmailRows = [
    { label: "Código RQ", value: draft.codigo },
    { label: "Proyecto", value: proyecto },
    { label: "Cliente", value: cliente },
    { label: "Observaciones", value: observations.length },
    { label: "Comentarios", value: comments.length },
    { label: "Evidencias Drive", value: observations.reduce((total, observation) => total + observation.documents.length, 0) },
  ];
  const selectedObservationEmailRows = [
    { label: "Código RQ", value: draft.codigo },
    { label: "Proyecto", value: proyecto },
    { label: "Cliente", value: cliente },
    { label: "Recursos seleccionados", value: selectedObservationItems.length },
    { label: "Observaciones", value: selectedEmailObservations.length },
    { label: "Adjuntos preparados", value: selectedEmailAttachments.length },
  ];
  const filteredObservationEmailRows = [
    { label: "Código RQ", value: draft.codigo },
    { label: "Proyecto", value: proyecto },
    { label: "Cliente", value: cliente },
    { label: "Recursos filtrados", value: filteredObservedItems.length },
    { label: "Observaciones", value: filteredEmailObservations.length },
    { label: "Adjuntos preparados", value: filteredEmailAttachments.length },
  ];
  const tabButtonClassName = (tab: WorkspaceTab) =>
    `inline-flex h-7 items-center rounded border px-2 text-[11px] font-semibold ${
      activeWorkspaceTab === tab
        ? "border-stone-900 bg-stone-900 text-white"
        : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
    }`;
  const resourceObservationPanel = (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-white">
      <div className="flex flex-none items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <FieldLabelIcon icon="clipboard-list" label="Observaciones del recurso" className="text-xs font-medium" />
            <span
              className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${observationStatusClassName(
                selectedObservationStatus,
              )}`}
            >
              {selectedObservationStatus}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-stone-500" title={selectedItem?.descripcion || ""}>
            {selectedItem ? selectedItem.descripcion || selectedItem.recurso_a_suministrar || "Recurso sin descripción" : "Selecciona un recurso"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSelectedItemId(null)}
          title="Cerrar panel"
          aria-label="Cerrar panel de observaciones"
          className={workspaceActionButtonClassName(true)}
        >
          <WorkspaceActionIcon name="close" />
        </button>
      </div>

      {selectedItem ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2">
          <div className="rounded border border-stone-200 bg-stone-50 p-2">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <span className="font-semibold text-stone-500">Código</span>
              <span className="truncate text-right font-semibold text-stone-800" title={selectedItem.codigo_fabricante || selectedItem.codigo_recurso}>
                {selectedItem.codigo_fabricante || selectedItem.codigo_recurso || "-"}
              </span>
              <span className="font-semibold text-stone-500">Tipo</span>
              <span className="truncate text-right text-stone-700" title={selectedItem.tipo_recurso}>{selectedItem.tipo_recurso || "-"}</span>
              <span className="font-semibold text-stone-500">Cantidad</span>
              <span className="text-right text-stone-700">
                {formatCurrencyNumber(selectedItem.cantidad)} {selectedItem.unidad || ""}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap justify-end gap-1.5">
              <a
                href={`/requerimientos?rqCode=${encodeURIComponent(draft.codigo)}&item=${encodeURIComponent(selectedItem.id)}`}
                onClick={(event) => event.preventDefault()}
                className={workspaceActionButtonClassName()}
                title="Link simulado al recurso"
              >
                Abrir recurso
              </a>
              <a
                href={`/requerimientos?rqCode=${encodeURIComponent(draft.codigo)}`}
                onClick={(event) => event.preventDefault()}
                className={workspaceActionButtonClassName()}
                title="Link simulado al RQ"
              >
                Abrir RQ
              </a>
            </div>
          </div>

          <form
            action={(formData) => createObservationFromPanel(String(formData.get("message") ?? ""))}
            className="rounded border border-stone-200 bg-white p-2"
          >
            <label className="block text-[10.5px] font-semibold text-stone-500">
              Nueva observación
              <textarea
                name="message"
                rows={3}
                className="mt-1 w-full resize-none rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 outline-none focus:border-teal-500"
                placeholder="Registra el hallazgo o comentario técnico"
              />
            </label>
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                className="h-7 rounded border border-teal-700 bg-teal-700 px-3 text-[11px] font-semibold text-white hover:bg-teal-800"
              >
                Registrar
              </button>
            </div>
          </form>

          <div className="rounded border border-stone-200 bg-white">
            <div className="flex items-center justify-between border-b border-stone-200 px-2 py-1.5">
              <p className="text-[11px] font-semibold text-stone-700">Historial del recurso</p>
              <span className="text-[10px] font-semibold text-stone-400">{selectedItemObservations.length}</span>
            </div>
            <div className="max-h-[150px] overflow-auto">
              {selectedItemObservations.length ? (
                selectedItemObservations.map((observation) => (
                  <button
                    key={observation.id}
                    type="button"
                    onClick={() => setSelectedObservationId(observation.id)}
                    className={`block w-full border-b border-stone-100 px-2 py-1.5 text-left hover:bg-stone-50 ${
                      selectedObservation?.id === observation.id ? "bg-amber-50" : ""
                    }`}
                  >
                    <span className="block truncate text-[11px] font-semibold text-stone-800" title={observation.title}>
                      {observation.title}
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-stone-500">
                      <span>{observation.createdAt}</span>
                      <span className={`rounded border px-1.5 py-0.5 font-semibold ${observationStatusClassName(observation.status)}`}>
                        {observation.status}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-2 py-4 text-center text-[11px] text-stone-400">
                  Sin observaciones para este recurso.
                </p>
              )}
            </div>
          </div>

          <div className="rounded border border-stone-200 bg-white p-2">
            {selectedObservation ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[10.5px] font-semibold text-stone-500">
                    Estado
                    <select
                      value={selectedObservation.status}
                      onChange={(event) =>
                        updateObservationStatus(
                          selectedObservation.id,
                          event.target.value as Exclude<RequirementObservationStatus, "Sin observación">,
                        )
                      }
                      className={`ml-2 h-7 rounded border px-2 text-[11px] font-semibold outline-none ${observationStatusClassName(
                        selectedObservation.status,
                      )}`}
                    >
                      <option>Observado</option>
                      <option>En seguimiento</option>
                      <option>Levantado</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => openObservationUpload("attach")}
                      className={workspaceActionButtonClassName()}
                    >
                      Adjuntar evidencia
                    </button>
                    <button
                      type="button"
                      onClick={() => openObservationUpload("lift")}
                      className="inline-flex h-6 min-h-6 items-center justify-center rounded border border-emerald-700 bg-emerald-700 px-1.5 text-[11px] font-semibold leading-none text-white hover:bg-emerald-800"
                    >
                      Levantar con evidencia
                    </button>
                  </div>
                </div>
                {observationMessage ? (
                  <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800">
                    {observationMessage}
                  </p>
                ) : null}
                <div className="mt-2 grid grid-cols-1 gap-1.5">
                  {selectedObservation.documents.length ? (
                    selectedObservation.documents.map((file, index) => (
                      <a
                        key={`${file.name}-${index}`}
                        href={file.futureDriveUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => {
                          if (!file.futureDriveUrl) event.preventDefault();
                        }}
                        className="rounded border border-stone-200 bg-stone-50 px-2 py-1.5 hover:bg-white"
                      >
                        <span className="block truncate text-[11px] font-semibold text-stone-700" title={file.name}>{file.name}</span>
                        <span className="mt-0.5 block text-[10px] text-stone-500">
                          {file.type || "archivo"} · {formatFileSize(file.size)}
                        </span>
                      </a>
                    ))
                  ) : (
                    <p className="text-[11px] text-stone-400">Sin evidencias adjuntas.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-stone-400">
                Registra una observación para habilitar comentarios y evidencias.
              </p>
            )}
          </div>

          <div className="min-h-[260px]">
            <ObservationComments comments={selectedObservationComments} onAddComment={addCommentToSelectedObservation} />
          </div>

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
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <EmailThreadButton
                kind="requirement"
                entityCode={`${draft.codigo}-observaciones-seleccionadas`}
                subject={`Observaciones SGP seleccionadas / ${draft.codigo} / ${proyecto || "-"}`}
                title={`Observaciones seleccionadas ${draft.codigo}`}
                linkPath={`/requerimientos?rqCode=${encodeURIComponent(draft.codigo)}&scope=seleccionados`}
                summaryRows={selectedObservationEmailRows}
                buildPlainBody={buildSelectedObservationPlainEmail}
                buildHtmlBody={buildSelectedObservationHtmlEmail}
                showHtmlPreview
                previewOnly
                disabled={selectedObservationItems.length === 0}
                attachments={selectedEmailAttachments}
                className={workspaceActionButtonClassName()}
                buttonLabel={`Enviar seleccionados (${selectedObservationItems.length})`}
              />
              <EmailThreadButton
                kind="requirement"
                entityCode={`${draft.codigo}-observaciones-filtradas`}
                subject={`Observaciones SGP filtradas / ${draft.codigo} / ${proyecto || "-"}`}
                title={`Observaciones filtradas ${draft.codigo}`}
                linkPath={`/requerimientos?rqCode=${encodeURIComponent(draft.codigo)}&scope=filtrados`}
                summaryRows={filteredObservationEmailRows}
                buildPlainBody={buildFilteredObservationPlainEmail}
                buildHtmlBody={buildFilteredObservationHtmlEmail}
                showHtmlPreview
                previewOnly
                disabled={filteredObservedItems.length === 0}
                attachments={filteredEmailAttachments}
                className={workspaceActionButtonClassName()}
                buttonLabel={`Enviar filtrados (${filteredObservedItems.length})`}
              />
            </div>
          </div>
        </div>
      ) : null}
    </aside>
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
          <EmailThreadButton
            kind="requirement"
            entityCode={`${draft.codigo}-observaciones`}
            subject={`Observaciones SGP / ${draft.codigo} / ${proyecto || "-"}`}
            title={`Observaciones ${draft.codigo}`}
            linkPath={`/requerimientos?rqCode=${encodeURIComponent(draft.codigo)}&tab=observaciones`}
            summaryRows={observationEmailRows}
            buildPlainBody={buildObservationPlainEmail}
            buildHtmlBody={buildObservationHtmlEmail}
            showHtmlPreview
            previewOnly
            attachments={allObservationEmailAttachments}
            className={workspaceActionButtonClassName()}
            buttonLabel="Correo preview"
          />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-h-0 overflow-auto rounded border border-border bg-white">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 bg-stone-50 text-stone-500">
              <tr>
                <th className="w-[110px] border-b border-stone-200 px-2 py-1.5 text-left font-semibold">Recurso</th>
                <th className="border-b border-stone-200 px-2 py-1.5 text-left font-semibold">Observación</th>
                <th className="w-[86px] border-b border-stone-200 px-2 py-1.5 text-left font-semibold">Estado</th>
                <th className="w-[70px] border-b border-stone-200 px-2 py-1.5 text-right font-semibold">Docs</th>
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
                      <p className="font-medium text-stone-800">{observation.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[10.5px] text-stone-500">{observation.itemDescription}</p>
                      <p className="mt-1 text-[10px] text-stone-400">{observation.createdAt} · {observation.author}</p>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={observation.status}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          updateObservationStatus(observation.id, event.target.value as RequirementObservation["status"]);
                        }}
                        className={`h-6 w-full rounded border px-1 text-[10px] font-semibold outline-none ${observationStatusClassName(
                          observation.status,
                        )}`}
                      >
                        <option>Observado</option>
                        <option>En seguimiento</option>
                        <option>Levantado</option>
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-stone-700">{observation.documents.length}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[11px] text-stone-400">
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
                    <p className="text-[12px] font-semibold text-stone-800">{selectedObservation.title}</p>
                    <p className="mt-1 text-[11px] text-stone-500">
                      {selectedObservation.itemCode} · {selectedObservation.itemDescription}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openObservationUpload("attach")}
                    className="rounded border border-stone-200 bg-white px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-50"
                  >
                    Adjuntar archivo
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {selectedObservation.documents.length ? (
                    selectedObservation.documents.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="rounded border border-stone-200 bg-stone-50 px-2 py-1.5">
                        <p className="truncate text-[11px] font-semibold text-stone-700" title={file.name}>{file.name}</p>
                        <p className="mt-0.5 text-[10px] text-stone-500">{file.type || "archivo"} · {formatFileSize(file.size)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-stone-400">Sin evidencias adjuntas.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-stone-400">Selecciona una observación para ver comentarios y documentos.</p>
            )}
          </div>
          <ObservationComments comments={selectedObservationComments} onAddComment={addCommentToSelectedObservation} />
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
                ? "lg:grid-cols-[minmax(0,1fr)_minmax(460px,560px)] xl:grid-cols-[minmax(0,1fr)_minmax(540px,640px)]"
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
                  <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
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
            <div className={`${hasWorkspaceSidePanel ? "flex min-h-[320px]" : "hidden"} min-h-0 lg:min-h-0`}>
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
      <ObservationDocumentUpload
        open={Boolean(uploadObservation)}
        title={`${uploadMode === "lift" ? "Levantar con evidencia" : "Adjuntar evidencia"} - ${uploadObservation?.itemCode ?? "observación"}`}
        onClose={() => setUploadObservationId(null)}
        isUploading={isUploadingObservationFile}
        onAttachFiles={attachFilesToObservation}
      />
    </div>
  );
}
