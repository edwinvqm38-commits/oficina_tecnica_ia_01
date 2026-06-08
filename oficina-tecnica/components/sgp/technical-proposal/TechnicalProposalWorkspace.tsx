"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { FieldLabelIcon, type IconName } from "@/components/sgp/ui/FieldLabelIcon";
import { ResourceAutocompleteInput } from "@/components/sgp/technical-proposal/ResourceAutocompleteInput";
import { TechnicalProposalResourceGrid } from "@/components/sgp/technical-proposal/TechnicalProposalResourceGrid";
import { TechnicalProposalResourceInspector } from "@/components/sgp/technical-proposal/TechnicalProposalResourceInspector";
import { TechnicalProposalTopbar } from "@/components/sgp/technical-proposal/TechnicalProposalTopbar";
import { TechnicalProposalUsedResourcesPanel, type UsedResourceItem } from "@/components/sgp/technical-proposal/TechnicalProposalUsedResourcesPanel";
import type { Cotizacion, Recurso } from "@/lib/sgp/demoData";
import { findClientLogo, findDefaultCompanyLogo, readProposalLogos, type ProposalLogo } from "@/lib/sgp/proposalLogos";
import { buildTechnicalProposalRpcPayload, validateTechnicalProposalRpcPayload } from "@/lib/sgp/technicalProposalMappers";
import { saveFullTechnicalProposal } from "@/lib/sgp/technicalProposalsRepository";

type TechnicalProposalWorkspaceModalProps = {
  open: boolean;
  cotizacion: Cotizacion;
  recursos: Recurso[];
  onClose: () => void;
};

type TechnicalProposalMetadata = {
  cotizacion_codigo: string;
  documento_codigo: string;
  documento_tipo: "PT";
  revision: "REV00";
  carpeta_madre: string;
  subcarpeta_revision: "01_REV00";
  archivo_docx: string;
  archivo_pdf: string;
  estructura_documental_version: "cotizacion_v1";
};

type ScopeKind = "group" | "subgroup" | "activity";
type ProposalMode = "cliente" | "interno";
type ProposalWorkStatus = "Borrador" | "En proceso" | "Completado";
type RightPanelView = "document" | "selected_resource" | "used_resources";
type ResourceCategoryKey = "mano_obra" | "materiales" | "equipos" | "herramientas" | "consumibles";

type ScopeItem = {
  id: string;
  level: number;
  number: string;
  kind: ScopeKind;
  title: string;
  description: string;
  time_value: number;
  time_unit: string;
  complete: boolean;
  collapsed: boolean;
  internal_comments: string;
};

type ProposalImage = {
  id: string;
  scope_item_id: string | null;
  resource_id: string | null;
  title: string;
  relation_label: string;
  size: "1" | "2" | "4";
  data_url: string;
};

type TechnicalProposalResourceSnapshot = {
  id: string;
  scope_item_id: string;
  recurso_id: string | null;
  codigo_recurso: string;
  codigo_fabricante: string;
  tipo_recurso: string;
  resource_category: ResourceCategoryKey;
  descripcion: string;
  unidad: string;
  precio_unitario_ref: number;
  moneda: "PEN" | "USD";
  proveedor: string;
  marca: string;
  cantidad: number;
  tiempo: number;
  comentario: string;
  detalle_adicional: string;
  estado_origen: "catalogo_copiado" | "nuevo_por_formalizar";
};

type QuickEntryRow = {
  id: string;
  recurso_id: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  tiempo: number;
  comentario: string;
};

type TechnicalProposalDraft = {
  metadata: TechnicalProposalMetadata;
  mode: ProposalMode;
  field_mode: boolean;
  work_status: ProposalWorkStatus;
  header: {
    ciudad: string;
    fecha: string;
    titulo: string;
    subtitulo: string;
    empresa_emisora: string;
    cliente_logo_label: string;
  };
  recipient: {
    cliente: string;
    unidad_trabajo: string;
    area_solicitante: string;
    atencion: string;
    contacto: string;
  };
  presentation: {
    referencia: string;
    texto: string;
  };
  scope_outline: string;
  scope_items: ScopeItem[];
  resources: TechnicalProposalResourceSnapshot[];
  general_images: ProposalImage[];
  activity_images: ProposalImage[];
  conditions: {
    notas_complementarias: string;
    presupuesto_no_incluye: string;
    propuesta_reajustada_si: string;
    plazo_entrega: string;
    forma_pago: string;
    validez_oferta: string;
    garantia: string;
    lugar_entrega: string;
    nota_comercial: string;
    cierre: string;
    firma_area: string;
    empresa_firma: string;
  };
  updated_at: string;
};

type ParsedScopeLine = {
  level: number;
  kind: ScopeKind;
  title: string;
  number: string;
};

type ScopeSubtreeRange = {
  start: number;
  end: number;
};

const REVISION = "REV00";
const REVISION_FOLDER = "01_REV00";

const RESOURCE_CATEGORIES: Array<{ key: ResourceCategoryKey; label: string; shortLabel: string; hasTime: boolean }> = [
  { key: "mano_obra", label: "Mano de obra", shortLabel: "MO", hasTime: true },
  { key: "materiales", label: "Materiales", shortLabel: "MAT", hasTime: false },
  { key: "equipos", label: "Equipos", shortLabel: "EQP", hasTime: true },
  { key: "herramientas", label: "Herramientas", shortLabel: "HER", hasTime: true },
  { key: "consumibles", label: "Consumibles / otros", shortLabel: "CON", hasTime: false },
];

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildDocumentMetadata(codigoCotizacion: string): TechnicalProposalMetadata {
  const documentoCodigo = `${codigoCotizacion}-PT-${REVISION}`;
  return {
    cotizacion_codigo: codigoCotizacion,
    documento_codigo: documentoCodigo,
    documento_tipo: "PT",
    revision: REVISION,
    carpeta_madre: codigoCotizacion,
    subcarpeta_revision: REVISION_FOLDER,
    archivo_docx: `${documentoCodigo}.docx`,
    archivo_pdf: `${documentoCodigo}.pdf`,
    estructura_documental_version: "cotizacion_v1",
  };
}

function buildStorageKey(codigoCotizacion: string): string {
  return `opsia:technical-proposal:draft:${codigoCotizacion}:${REVISION}`;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toFiniteNumber(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function mapResourceCategory(tipoRecurso: string): ResourceCategoryKey {
  const normalized = normalizeSearch(tipoRecurso);
  if (normalized.includes("mano de obra")) return "mano_obra";
  if (normalized.includes("material")) return "materiales";
  if (normalized.includes("equipo") || normalized.includes("vehiculo")) return "equipos";
  if (normalized.includes("herramienta")) return "herramientas";
  return "consumibles";
}

function defaultScopeItems(projectName: string): ScopeItem[] {
  return renumberScopeItems([
    {
      id: "scope-1",
      level: 0,
      number: "1",
      kind: "group",
      title: projectName || "ALCANCE GENERAL DEL SERVICIO",
      description: "",
      time_value: 0,
      time_unit: "dias",
      complete: false,
      collapsed: false,
      internal_comments: "",
    },
    {
      id: "scope-2",
      level: 1,
      number: "1.1",
      kind: "activity",
      title: "Actividad principal",
      description: projectName || "Describir actividad principal del alcance tecnico.",
      time_value: 1,
      time_unit: "dias",
      complete: false,
      collapsed: false,
      internal_comments: "",
    },
  ]);
}

function buildInitialDraft(cotizacion: Cotizacion): TechnicalProposalDraft {
  const metadata = buildDocumentMetadata(cotizacion.codigo);
  const scopeItems = defaultScopeItems(cotizacion.proyecto);
  return {
    metadata,
    mode: "cliente",
    field_mode: false,
    work_status: "Borrador",
    header: {
      ciudad: "Lima",
      fecha: todayIsoDate(),
      titulo: "PROPUESTA TECNICA",
      subtitulo: "ALCANCES Y DESCRIPCION DE LA OFERTA",
      empresa_emisora: "EKA MINING S.A.C.",
      cliente_logo_label: cotizacion.cliente || "CLIENTE",
    },
    recipient: {
      cliente: cotizacion.cliente,
      unidad_trabajo: cotizacion.unidad_trabajo,
      area_solicitante: cotizacion.tipo_servicio || "",
      atencion: cotizacion.solicitante || cotizacion.cliente,
      contacto: "",
    },
    presentation: {
      referencia: cotizacion.proyecto || cotizacion.codigo,
      texto: "De acuerdo a vuestra solicitud, tenemos el agrado de someter a su aprobacion la siguiente propuesta tecnica.",
    },
    scope_outline: scopeItemsToOutline(scopeItems),
    scope_items: scopeItems,
    resources: [],
    general_images: [],
    activity_images: [],
    conditions: {
      notas_complementarias: "Cliente dara facilidades de trabajo.",
      presupuesto_no_incluye: "Trabajos y/o suministros no indicados expresamente en la propuesta tecnica.",
      propuesta_reajustada_si: "Se realizan cambios o adicionales solicitados por el cliente durante el desarrollo del servicio.",
      plazo_entrega: "06 dias recibida Orden de Compra.",
      forma_pago: "Factura a 30 dias.",
      validez_oferta: "Siete (07) dias, contados a partir de la fecha del presente presupuesto.",
      garantia: "12 meses.",
      lugar_entrega: cotizacion.unidad_trabajo || "",
      nota_comercial: `Al colocar su Orden de Compra, favor referirse a nuestro Presupuesto: ${cotizacion.codigo}`,
      cierre: "Esperando ser favorecidos con su Orden de Compra, quedamos de Uds.",
      firma_area: "Departamento de Ingenieria y Proyectos",
      empresa_firma: "E.K.A MINING S.A.C.",
    },
    updated_at: new Date().toISOString(),
  };
}

function normalizeLegacyDraft(parsed: Partial<TechnicalProposalDraft> & Record<string, unknown>, cotizacion: Cotizacion): TechnicalProposalDraft {
  const initial = buildInitialDraft(cotizacion);
  const legacyActivities = Array.isArray(parsed.actividades)
    ? (parsed.actividades as Array<{ id?: string; titulo?: string; descripcion?: string }>)
    : [];
  const migratedItems =
    Array.isArray(parsed.scope_items) && parsed.scope_items.length > 0
      ? renumberScopeItems(parsed.scope_items as ScopeItem[])
      : legacyActivities.length
        ? renumberScopeItems(
            legacyActivities.map((activity, index) => ({
              id: activity.id || uid("scope"),
              level: index === 0 ? 0 : 1,
              number: "",
              kind: "activity" as ScopeKind,
              title: activity.titulo || `Actividad ${index + 1}`,
              description: activity.descripcion || "",
              time_value: 1,
              time_unit: "dias",
              complete: false,
              collapsed: false,
              internal_comments: "",
            })),
          )
        : initial.scope_items;

  const oldResources = Array.isArray(parsed.resources)
    ? (parsed.resources as TechnicalProposalResourceSnapshot[])
    : Array.isArray(parsed.recursos)
      ? (parsed.recursos as Array<TechnicalProposalResourceSnapshot & { activity_id?: string }>)
      : [];
  const firstActivity = migratedItems.find((item) => item.kind === "activity") ?? migratedItems[0];

  return {
    ...initial,
    ...parsed,
    metadata: initial.metadata,
    mode: parsed.mode === "interno" ? "interno" : "cliente",
    field_mode: Boolean(parsed.field_mode),
    work_status:
      parsed.work_status === "Completado" || parsed.work_status === "En proceso" || parsed.work_status === "Borrador"
        ? parsed.work_status
        : "Borrador",
    header: { ...initial.header, ...(parsed.header as Partial<TechnicalProposalDraft["header"]> | undefined) },
    recipient: { ...initial.recipient, ...(parsed.recipient as Partial<TechnicalProposalDraft["recipient"]> | undefined) },
    presentation: { ...initial.presentation, ...(parsed.presentation as Partial<TechnicalProposalDraft["presentation"]> | undefined) },
    scope_items: migratedItems,
    scope_outline: typeof parsed.scope_outline === "string" ? parsed.scope_outline : scopeItemsToOutline(migratedItems),
    resources: oldResources.map((resource) => {
      const legacyResource = resource as TechnicalProposalResourceSnapshot & { activity_id?: string };
      return {
        ...legacyResource,
        scope_item_id: legacyResource.scope_item_id || legacyResource.activity_id || firstActivity?.id || "scope-1",
        resource_category: legacyResource.resource_category || mapResourceCategory(legacyResource.tipo_recurso),
        tiempo: toFiniteNumber(legacyResource.tiempo),
      };
    }),
    general_images: Array.isArray(parsed.general_images) ? parsed.general_images : [],
    activity_images: Array.isArray(parsed.activity_images) ? parsed.activity_images : [],
    conditions: {
      ...initial.conditions,
      ...(parsed.conditions as Partial<TechnicalProposalDraft["conditions"]> | undefined),
    },
    updated_at: typeof parsed.updated_at === "string" ? parsed.updated_at : new Date().toISOString(),
  };
}

function readStoredDraft(cotizacion: Cotizacion): TechnicalProposalDraft {
  const initial = buildInitialDraft(cotizacion);
  if (typeof window === "undefined") return initial;

  try {
    const raw = window.localStorage.getItem(buildStorageKey(cotizacion.codigo));
    if (!raw) return initial;
    return normalizeLegacyDraft(JSON.parse(raw) as Partial<TechnicalProposalDraft> & Record<string, unknown>, cotizacion);
  } catch {
    return initial;
  }
}

function scopeLineHasActivity(line: string): boolean {
  return /\[(A|ACT|ACTIVIDAD)\]|^\s*(?:\d+(?:\.\d+)*\.?\s*)?[✓√]/i.test(line);
}

function cleanScopeTitle(line: string): string {
  return line
    .replace(/^\s*\d+(?:\.\d+)*\.?\s*/, "")
    .replace(/\[(A|ACT|ACTIVIDAD)\]/gi, "")
    .replace(/^[✓√]\s*/, "")
    .trim();
}

function parseScopeOutline(value: string): ParsedScopeLine[] {
  let lastTopGroupSeen = false;
  return value
    .split(/\r?\n/)
    .map((line) => {
      const raw = line.trimEnd();
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const numberMatch = trimmed.match(/^(\d+(?:\.\d+)*)\.?\s+/);
      const indentMatch = raw.match(/^\s*/);
      const isActivity = scopeLineHasActivity(trimmed);
      const levelFromNumber = numberMatch ? numberMatch[1].split(".").length - 1 : null;
      const indentDepth = Math.min(4, Math.floor(((indentMatch?.[0] ?? "").replace(/\t/g, "  ").length) / 2));
      const level = levelFromNumber ?? (indentDepth > 0 ? indentDepth : isActivity && lastTopGroupSeen ? 1 : 0);
      const kind: ScopeKind = isActivity ? "activity" : level === 0 ? "group" : "subgroup";
      if (kind === "group") lastTopGroupSeen = true;
      return {
        level,
        kind,
        title: cleanScopeTitle(trimmed),
        number: numberMatch?.[1] ?? "",
      };
    })
    .filter((item): item is ParsedScopeLine => Boolean(item));
}

function renumberScopeItems(items: ScopeItem[]): ScopeItem[] {
  const counters: number[] = [];
  return items.map((item) => {
    const level = Math.max(0, Math.min(4, item.level));
    counters[level] = (counters[level] ?? 0) + 1;
    counters.splice(level + 1);
    return {
      ...item,
      level,
      kind: item.kind === "activity" ? "activity" : level === 0 ? "group" : "subgroup",
      number: counters.slice(0, level + 1).join("."),
    };
  });
}

function scopeItemsToOutline(items: ScopeItem[]): string {
  return renumberScopeItems(items)
    .map((item) => `${item.number}${item.kind === "activity" ? " [A]" : ""} ${item.title}`)
    .join("\n");
}

function parsedLinesToScopeItems(lines: ParsedScopeLine[], existing: ScopeItem[]): ScopeItem[] {
  const usedIds = new Set<string>();
  const existingByNumber = new Map(existing.map((item) => [item.number, item]));
  const existingByKey = new Map<string, ScopeItem[]>();
  existing.forEach((item) => {
    const key = `${item.kind}:${normalizeSearch(item.title)}`;
    existingByKey.set(key, [...(existingByKey.get(key) ?? []), item]);
  });

  function takeExistingItem(line: ParsedScopeLine, index: number): ScopeItem | undefined {
    const byNumber = line.number ? existingByNumber.get(line.number) : undefined;
    if (byNumber && byNumber.kind === line.kind && !usedIds.has(byNumber.id)) {
      usedIds.add(byNumber.id);
      return byNumber;
    }

    const byIndex = existing[index];
    if (byIndex && byIndex.kind === line.kind && !usedIds.has(byIndex.id)) {
      usedIds.add(byIndex.id);
      return byIndex;
    }

    const key = `${line.kind}:${normalizeSearch(line.title)}`;
    const byTitle = existingByKey.get(key)?.find((item) => !usedIds.has(item.id));
    if (byTitle) {
      usedIds.add(byTitle.id);
      return byTitle;
    }

    return undefined;
  }

  return renumberScopeItems(
    lines.map((line, index) => {
      const existingItem = takeExistingItem(line, index);
      return {
        id: existingItem?.id ?? uid("scope"),
        level: line.level,
        number: "",
        kind: line.kind,
        title: line.title || (line.kind === "activity" ? `Actividad ${index + 1}` : `Grupo ${index + 1}`),
        description: existingItem?.description ?? "",
        time_value: existingItem?.time_value ?? (line.kind === "activity" ? 1 : 0),
        time_unit: existingItem?.time_unit ?? "dias",
        complete: existingItem?.complete ?? false,
        collapsed: existingItem?.collapsed ?? false,
        internal_comments: existingItem?.internal_comments ?? "",
      };
    }),
  );
}

function scopeSubtreeRange(items: ScopeItem[], itemId: string): ScopeSubtreeRange | null {
  const start = items.findIndex((item) => item.id === itemId);
  if (start < 0) return null;
  const baseLevel = items[start].level;
  let end = start + 1;
  while (end < items.length && items[end].level > baseLevel) end += 1;
  return { start, end };
}

function offsetScopeLevels(items: ScopeItem[], range: ScopeSubtreeRange, delta: number): ScopeItem[] {
  return items.map((item, index) => {
    if (index < range.start || index >= range.end) return item;
    return { ...item, level: Math.max(0, Math.min(4, item.level + delta)) };
  });
}

function indentScopeItem(items: ScopeItem[], itemId: string): ScopeItem[] {
  const range = scopeSubtreeRange(items, itemId);
  if (!range || range.start === 0) return items;
  const previousItem = items[range.start - 1];
  const nextLevel = Math.min(4, previousItem.level + 1);
  const delta = nextLevel - items[range.start].level;
  if (delta <= 0) return items;
  return offsetScopeLevels(items, range, delta);
}

function outdentScopeItem(items: ScopeItem[], itemId: string): ScopeItem[] {
  const range = scopeSubtreeRange(items, itemId);
  if (!range || items[range.start].level === 0) return items;
  return offsetScopeLevels(items, range, -1);
}

function previousSiblingRange(items: ScopeItem[], range: ScopeSubtreeRange): ScopeSubtreeRange | null {
  const level = items[range.start].level;
  for (let index = range.start - 1; index >= 0; index -= 1) {
    if (items[index].level === level) return scopeSubtreeRange(items, items[index].id);
    if (items[index].level < level) return null;
  }
  return null;
}

function nextSiblingRange(items: ScopeItem[], range: ScopeSubtreeRange): ScopeSubtreeRange | null {
  const level = items[range.start].level;
  for (let index = range.end; index < items.length; index += 1) {
    if (items[index].level === level) return scopeSubtreeRange(items, items[index].id);
    if (items[index].level < level) return null;
  }
  return null;
}

function moveScopeItemUp(items: ScopeItem[], itemId: string): ScopeItem[] {
  const current = scopeSubtreeRange(items, itemId);
  if (!current) return items;
  const previous = previousSiblingRange(items, current);
  if (!previous) return items;
  return [
    ...items.slice(0, previous.start),
    ...items.slice(current.start, current.end),
    ...items.slice(previous.start, previous.end),
    ...items.slice(current.end),
  ];
}

function moveScopeItemDown(items: ScopeItem[], itemId: string): ScopeItem[] {
  const current = scopeSubtreeRange(items, itemId);
  if (!current) return items;
  const next = nextSiblingRange(items, current);
  if (!next) return items;
  return [
    ...items.slice(0, current.start),
    ...items.slice(next.start, next.end),
    ...items.slice(current.start, current.end),
    ...items.slice(next.end),
  ];
}

function makeSnapshotFromResource(recurso: Recurso, scopeItemId: string, forcedCategory?: ResourceCategoryKey): TechnicalProposalResourceSnapshot {
  const category = forcedCategory ?? mapResourceCategory(recurso.tipo_recurso);
  return {
    id: uid("ptr"),
    scope_item_id: scopeItemId,
    recurso_id: recurso.id,
    codigo_recurso: recurso.codigo_recurso,
    codigo_fabricante: recurso.codigo_fabricante,
    tipo_recurso: recurso.tipo_recurso || RESOURCE_CATEGORIES.find((item) => item.key === category)?.label || "",
    resource_category: category,
    descripcion: recurso.descripcion,
    unidad: recurso.unidad,
    precio_unitario_ref: recurso.precio_unitario_ref,
    moneda: recurso.moneda,
    proveedor: recurso.proveedor,
    marca: recurso.marca,
    cantidad: 1,
    tiempo: category === "materiales" || category === "consumibles" ? 0 : 1,
    comentario: "",
    detalle_adicional: recurso.modelo || recurso.observaciones,
    estado_origen: "catalogo_copiado",
  };
}

function makeNewFormalizationResource(scopeItemId: string, category: ResourceCategoryKey): TechnicalProposalResourceSnapshot {
  return {
    id: uid("ptr"),
    scope_item_id: scopeItemId,
    recurso_id: null,
    codigo_recurso: "",
    codigo_fabricante: "",
    tipo_recurso: RESOURCE_CATEGORIES.find((item) => item.key === category)?.label ?? "Consumibles / otros",
    resource_category: category,
    descripcion: "Nuevo recurso por formalizar",
    unidad: "und",
    precio_unitario_ref: 0,
    moneda: "PEN",
    proveedor: "",
    marca: "",
    cantidad: 1,
    tiempo: category === "materiales" || category === "consumibles" ? 0 : 1,
    comentario: "",
    detalle_adicional: "",
    estado_origen: "nuevo_por_formalizar",
  };
}

function inputClassName(): string {
  return "h-7 w-full rounded-md border border-stone-300 bg-white px-2 text-[11px] text-stone-800 outline-none focus:border-teal-500 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400";
}

function spreadsheetControlClassName(extra = ""): string {
  return [
    "h-6 w-full min-w-0 border-0 bg-transparent px-1.5 text-[11px] leading-none text-stone-800 outline-none",
    "focus:bg-white focus:shadow-[inset_0_0_0_1px_#0f766e]",
    "disabled:cursor-not-allowed disabled:text-stone-400",
    extra,
  ].join(" ");
}

function textareaClassName(minHeight = "min-h-[72px]"): string {
  return `${minHeight} w-full resize-y rounded-md border border-stone-300 bg-white px-2 py-1.5 text-[11px] leading-5 text-stone-800 outline-none focus:border-teal-500 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400`;
}

function smallButtonClassName(variant: "primary" | "secondary" | "soft" | "danger" | "ghost" = "secondary"): string {
  const base = "inline-flex h-7 items-center justify-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold leading-none disabled:cursor-not-allowed disabled:opacity-45";
  if (variant === "primary") return `${base} border-teal-700 bg-teal-700 text-white hover:bg-teal-800`;
  if (variant === "soft") return `${base} border-stone-200 bg-stone-100 text-stone-700 hover:bg-stone-200`;
  if (variant === "danger") return `${base} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`;
  if (variant === "ghost") return `${base} border-transparent bg-transparent text-stone-500 hover:bg-stone-100`;
  return `${base} border-stone-200 bg-white text-stone-700 hover:bg-stone-100`;
}

function sectionCardClassName(fieldMode: boolean, sectionKey: string): string {
  const hiddenInFieldMode = fieldMode && !["c", "d"].includes(sectionKey);
  return `${hiddenInFieldMode ? "hidden" : ""} overflow-hidden rounded-lg border border-stone-200 bg-white`;
}

function SectionHeader({
  title,
  icon,
  collapsed,
  onToggle,
  actions,
}: {
  title: string;
  icon: IconName;
  collapsed?: boolean;
  onToggle?: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-3 py-2">
      <button type="button" onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left">
        <FieldLabelIcon icon={icon} label={title} className="text-[12px] font-bold text-stone-800" />
      </button>
      <div className="flex shrink-0 items-center gap-1.5">
        {actions}
        {onToggle ? (
          <button type="button" onClick={onToggle} className={smallButtonClassName("secondary")}>
            {collapsed ? "Expandir" : "Agrupar"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-[10px] font-bold uppercase tracking-wide text-stone-500 ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function scopeKindLabel(kind: ScopeKind): string {
  if (kind === "activity") return "Actividad";
  if (kind === "subgroup") return "Subgrupo";
  return "Grupo";
}

function scopeGridRowClassName(item: ScopeItem, selected: boolean): string {
  if (selected) return "bg-teal-50/80 ring-1 ring-inset ring-teal-300";
  if (item.kind === "group") return "bg-sky-50/70 hover:bg-sky-100/70";
  if (item.kind === "subgroup") return "bg-amber-50/70 hover:bg-amber-100/70";
  return "bg-white hover:bg-emerald-50/40";
}

function scopeKindCellClassName(kind: ScopeKind): string {
  if (kind === "group") return "font-bold text-sky-800";
  if (kind === "subgroup") return "font-semibold text-amber-800";
  return "text-stone-700";
}

function scopeGridActionButtonClassName(variant: "default" | "danger" = "default"): string {
  const base = "inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[10px] font-semibold leading-none disabled:cursor-not-allowed disabled:opacity-45";
  if (variant === "danger") return `${base} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`;
  return `${base} border-stone-300 bg-white text-stone-700 hover:bg-stone-100`;
}

function formatDateForDocument(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function resourceRowsFor(scopeItemId: string, resources: TechnicalProposalResourceSnapshot[], category: ResourceCategoryKey) {
  return resources.filter((resource) => resource.scope_item_id === scopeItemId && resource.resource_category === category);
}

function imageGridSpanClass(size: ProposalImage["size"]): string {
  if (size === "4") return "md:col-span-2";
  if (size === "2") return "md:col-span-2";
  return "";
}

function docImageClass(size: ProposalImage["size"]): string {
  if (size === "4") return "md:col-span-2 min-h-[170px]";
  if (size === "2") return "md:col-span-2 min-h-[120px]";
  return "min-h-[92px]";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function TechnicalProposalQuickEntryModal({
  open,
  scopeItems,
  recursos,
  defaultScopeItemId,
  onClose,
  onApply,
}: {
  open: boolean;
  scopeItems: ScopeItem[];
  recursos: Recurso[];
  defaultScopeItemId: string;
  onClose: () => void;
  onApply: (scopeItemId: string, category: ResourceCategoryKey, rows: QuickEntryRow[]) => void;
}) {
  const [scopeItemId, setScopeItemId] = useState(defaultScopeItemId);
  const [category, setCategory] = useState<ResourceCategoryKey>("mano_obra");
  const [rows, setRows] = useState<QuickEntryRow[]>([
    { id: uid("qr"), recurso_id: "", descripcion: "", cantidad: 1, unidad: "und", tiempo: 1, comentario: "" },
  ]);

  useEffect(() => {
    if (!open) return;
    setScopeItemId(defaultScopeItemId);
    setCategory("mano_obra");
    setRows([{ id: uid("qr"), recurso_id: "", descripcion: "", cantidad: 1, unidad: "und", tiempo: 1, comentario: "" }]);
  }, [defaultScopeItemId, open]);

  const categoryResources = useMemo(() => recursos.filter((resource) => mapResourceCategory(resource.tipo_recurso) === category), [category, recursos]);

  if (!open) return null;

  function updateRow(rowId: string, patch: Partial<QuickEntryRow>) {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function selectResource(rowId: string, recursoId: string) {
    const recurso = recursos.find((item) => item.id === recursoId);
    updateRow(rowId, {
      recurso_id: recursoId,
      descripcion: recurso?.descripcion ?? "",
      unidad: recurso?.unidad ?? "und",
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-3">
      <div className="flex max-h-[calc(100dvh-32px)] w-full max-w-[980px] flex-col overflow-hidden rounded-xl border border-stone-300 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-3 py-2">
          <div>
            <h3 className="text-[13px] font-bold text-stone-800">Ingreso rapido de recursos</h3>
            <p className="text-[11px] text-stone-500">Filas temporales aplicadas como snapshot editable a una actividad.</p>
          </div>
          <button type="button" onClick={onClose} className={smallButtonClassName("ghost")}>
            Cerrar
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
            <Field label="Actividad destino">
              <select value={scopeItemId} onChange={(event) => setScopeItemId(event.target.value)} className={inputClassName()}>
                {scopeItems
                  .filter((item) => item.kind === "activity")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.number} {item.title}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="flex flex-wrap items-end gap-1.5">
              {RESOURCE_CATEGORIES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setCategory(item.key)}
                  className={category === item.key ? smallButtonClassName("primary") : smallButtonClassName("secondary")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-[860px] text-[11px]">
              <thead className="bg-stone-100 text-left text-stone-500">
                <tr>
                  <th className="px-2 py-2 font-bold">Recurso maestro</th>
                  <th className="px-2 py-2 font-bold">Descripcion / nuevo por formalizar</th>
                  <th className="px-2 py-2 text-right font-bold">Cant.</th>
                  <th className="px-2 py-2 font-bold">Unidad</th>
                  <th className="px-2 py-2 text-right font-bold">Dia / tiempo</th>
                  <th className="px-2 py-2 font-bold">Comentario</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-stone-100 align-top">
                    <td className="px-2 py-2">
                      <ResourceAutocompleteInput
                        value={row.descripcion}
                        resources={categoryResources}
                        className={inputClassName()}
                        placeholder="Buscar en Recursos"
                        onTextChange={(value) => updateRow(row.id, { descripcion: value, recurso_id: "" })}
                        onSelect={(resource) => selectResource(row.id, resource.id)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input value={row.descripcion} onChange={(event) => updateRow(row.id, { descripcion: event.target.value })} className={inputClassName()} />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        value={row.cantidad}
                        onChange={(event) => updateRow(row.id, { cantidad: toFiniteNumber(event.target.value) })}
                        className={`${inputClassName()} text-right`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input value={row.unidad} onChange={(event) => updateRow(row.id, { unidad: event.target.value })} className={inputClassName()} />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        value={row.tiempo}
                        onChange={(event) => updateRow(row.id, { tiempo: toFiniteNumber(event.target.value) })}
                        className={`${inputClassName()} text-right`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input value={row.comentario} onChange={(event) => updateRow(row.id, { comentario: event.target.value })} className={inputClassName()} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button type="button" onClick={() => setRows((prev) => prev.filter((item) => item.id !== row.id))} className={smallButtonClassName("danger")}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, { id: uid("qr"), recurso_id: "", descripcion: "", cantidad: 1, unidad: "und", tiempo: 1, comentario: "" }])}
              className={smallButtonClassName("secondary")}
            >
              Agregar fila
            </button>
            <button type="button" onClick={() => onApply(scopeItemId, category, rows)} className={smallButtonClassName("primary")}>
              Aplicar recursos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TechnicalProposalWorkspaceModal({ open, cotizacion, recursos, onClose }: TechnicalProposalWorkspaceModalProps) {
  const [draft, setDraft] = useState<TechnicalProposalDraft>(() => buildInitialDraft(cotizacion));
  const [selectedScopeItemId, setSelectedScopeItemId] = useState("scope-2");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({ a: true, b: true, c: true, e: true });
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingLocked, setEditingLocked] = useState(true);
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>("document");
  const [activeMasterResource, setActiveMasterResource] = useState<Recurso | null>(null);
  const [selectedResourceRowId, setSelectedResourceRowId] = useState<string | null>(null);
  const [activeResourceTargetRowId, setActiveResourceTargetRowId] = useState<string | null>(null);
  const [editingResourceCellId, setEditingResourceCellId] = useState<string | null>(null);
  const [proposalLogos, setProposalLogos] = useState<ProposalLogo[]>([]);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [printingReady, setPrintingReady] = useState(false);
  const [savingToSupabase, setSavingToSupabase] = useState(false);
  const printInProgressRef = useRef(false);
  const previewDocumentRef = useRef<HTMLElement | null>(null);
  const scopeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = readStoredDraft(cotizacion);
    setDraft(next);
    setSelectedScopeItemId(next.scope_items.find((item) => item.kind === "activity")?.id ?? next.scope_items[0]?.id ?? "scope-1");
    setStatusMessage(null);
    setEditingLocked(true);
    setRightPanelView("document");
    setActiveMasterResource(null);
    setSelectedResourceRowId(null);
    setActiveResourceTargetRowId(null);
    setEditingResourceCellId(null);
    setProposalLogos(readProposalLogos());
    setPreviewRefreshKey((current) => current + 1);
    setSavingToSupabase(false);
  }, [cotizacion, open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(buildStorageKey(cotizacion.codigo), JSON.stringify(draft));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [cotizacion.codigo, draft, open]);

  const parsedScopePreview = useMemo(() => renumberScopeItems(parsedLinesToScopeItems(parseScopeOutline(draft.scope_outline), draft.scope_items)), [
    draft.scope_items,
    draft.scope_outline,
  ]);

  const selectedActionItem = draft.scope_items.find((item) => item.id === selectedScopeItemId) ?? null;
  const selectedScopeItem = selectedActionItem ?? draft.scope_items.find((item) => item.kind === "activity") ?? draft.scope_items[0];
  const selectedActivity = selectedScopeItem?.kind === "activity" ? selectedScopeItem : draft.scope_items.find((item) => item.kind === "activity");
  const showInternal = draft.mode === "interno";
  const isEditingProposalDocument = !editingLocked;
  const companyLogo = findDefaultCompanyLogo(proposalLogos);
  const clientLogo = findClientLogo(proposalLogos, draft.recipient.cliente || cotizacion.cliente);
  const activityNumberById = useMemo(() => new Map(draft.scope_items.map((item) => [item.id, item.number])), [draft.scope_items]);
  const usedResourceLookup = useMemo(() => {
    const lookup = new Map<string, { count: number; activityNumbers: string[] }>();
    draft.resources.forEach((resource) => {
      if (!resource.recurso_id) return;
      const current = lookup.get(resource.recurso_id) ?? { count: 0, activityNumbers: [] };
      current.count += 1;
      const activityNumber = activityNumberById.get(resource.scope_item_id);
      if (activityNumber && !current.activityNumbers.includes(activityNumber)) current.activityNumbers.push(activityNumber);
      lookup.set(resource.recurso_id, current);
    });
    return lookup;
  }, [activityNumberById, draft.resources]);
  const selectedResourceSnapshot = draft.resources.find((resource) => resource.id === selectedResourceRowId) ?? null;
  const selectedResourceMaster = selectedResourceSnapshot?.recurso_id ? recursos.find((resource) => resource.id === selectedResourceSnapshot.recurso_id) ?? null : null;
  const displayedResource = activeMasterResource ?? selectedResourceMaster;
  const displayedResourceSnapshot = activeMasterResource ? null : selectedResourceSnapshot;
  const usedResourceItems = useMemo<UsedResourceItem[]>(
    () =>
      draft.resources.map((resource) => {
        const activity = draft.scope_items.find((item) => item.id === resource.scope_item_id);
        return {
          rowId: resource.id,
          masterResourceId: resource.recurso_id,
          codigo: resource.codigo_recurso,
          descripcion: resource.descripcion,
          tipo: resource.tipo_recurso,
          cantidad: resource.cantidad,
          unidad: resource.unidad,
          precio: resource.precio_unitario_ref,
          moneda: resource.moneda,
          resourceCategory: resource.resource_category,
          activityNumber: activity?.number ?? "-",
          activityTitle: activity?.title ?? "",
        };
      }),
    [draft.resources, draft.scope_items],
  );
  const resourceInspectorPermissions = useMemo(
    () => ({
      canViewPrices: true,
      canViewSupplier: true,
      canViewImages: true,
      canViewDocuments: true,
      canViewMetadata: true,
    }),
    [],
  );

  if (!open) return null;

  function setDraftWithTouch(updater: (prev: TechnicalProposalDraft) => TechnicalProposalDraft) {
    setDraft((prev) => ({ ...updater(prev), updated_at: new Date().toISOString() }));
    setStatusMessage(null);
  }

  function patchDraft(patch: Partial<TechnicalProposalDraft>) {
    setDraftWithTouch((prev) => ({ ...prev, ...patch }));
  }

  function patchNested<K extends keyof TechnicalProposalDraft>(key: K, patch: Partial<TechnicalProposalDraft[K]>) {
    setDraftWithTouch((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...patch } }));
  }

  function toggleSection(section: string) {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function saveLocalDraft() {
    window.localStorage.setItem(buildStorageKey(cotizacion.codigo), JSON.stringify({ ...draft, updated_at: new Date().toISOString() }));
    setStatusMessage("Borrador temporal guardado en este navegador.");
  }

  async function saveDraftToSupabase() {
    saveLocalDraft();

    let payload: ReturnType<typeof buildTechnicalProposalRpcPayload>;
    try {
      payload = buildTechnicalProposalRpcPayload(draft, cotizacion);
    } catch (error) {
      console.error("[propuesta-tecnica] Error preparando payload RPC:", error);
      setStatusMessage("No se pudo preparar la propuesta para guardar. Falta informacion interna de actividades o recursos.");
      return;
    }

    const validationError = validateTechnicalProposalRpcPayload(payload);
    if (validationError) {
      setStatusMessage(`No se pudo preparar la propuesta para guardar. ${validationError}`);
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.debug("[propuesta-tecnica] payload RPC", {
        items: payload.items.length,
        resources: payload.resources.length,
        firstItem: payload.items[0]
          ? {
              client_key: payload.items[0].client_key,
              parent_client_key: payload.items[0].parent_client_key,
              item_type: payload.items[0].item_type,
              item_number: payload.items[0].item_number,
            }
          : null,
        firstResource: payload.resources[0]
          ? {
              client_item_key: payload.resources[0].client_item_key,
              resource_category: payload.resources[0].resource_category,
              descripcion: payload.resources[0].descripcion,
            }
          : null,
      });
    }

    setSavingToSupabase(true);
    setStatusMessage("Guardando en Supabase...");
    try {
      const technicalProposalId = await saveFullTechnicalProposal(payload);
      if (process.env.NODE_ENV === "development") {
        console.debug("[propuesta-tecnica] RPC guardada", { technicalProposalId });
      }
      setEditingResourceCellId(null);
      setEditingLocked(true);
      setStatusMessage(`Guardado en Supabase. ID: ${technicalProposalId}`);
    } catch (error) {
      console.error("[propuesta-tecnica] Error guardando en Supabase:", error);
      const message = error instanceof Error ? error.message : "Error desconocido.";
      setStatusMessage(`Borrador local guardado, pero Supabase rechazo el guardado: ${message}`);
    } finally {
      setSavingToSupabase(false);
    }
  }

  function handleEditToggle() {
    if (editingLocked) {
      setEditingLocked(false);
      setStatusMessage("Modo edicion activo. Los cambios se guardan como borrador local.");
      return;
    }

    if (savingToSupabase) return;
    void saveDraftToSupabase();
  }

  function refreshPreview() {
    setProposalLogos(readProposalLogos());
    setPreviewRefreshKey((current) => current + 1);
    setRightPanelView("document");
    setStatusMessage("Vista previa actualizada desde los datos locales.");
  }

  function safeExportFileName(extension: string): string {
    const base = draft.metadata.documento_codigo || draft.metadata.cotizacion_codigo || "propuesta_tecnica";
    return `${base.replace(/[\\/:*?"<>|]+/g, "_")}_propuesta_tecnica.${extension}`;
  }

  function downloadBlob(content: BlobPart, mimeType: string, fileName: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function clonePreviewWithInlineStyles(): HTMLElement | null {
    const source = previewDocumentRef.current;
    if (!source || typeof window === "undefined") return null;
    const clone = source.cloneNode(true) as HTMLElement;
    const sourceElements = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
    const cloneElements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
    sourceElements.forEach((sourceElement, index) => {
      const cloneElement = cloneElements[index];
      if (!cloneElement) return;
      const styles = window.getComputedStyle(sourceElement);
      cloneElement.removeAttribute("class");
      cloneElement.setAttribute(
        "style",
        Array.from(styles)
          .map((property) => `${property}:${styles.getPropertyValue(property)};`)
          .join(""),
      );
    });
    clone.removeAttribute("key");
    clone.classList.add("exported-proposal-document");
    return clone;
  }

  function buildPrintDocumentStyles(): string {
    return `
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; background: #ffffff; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .exported-proposal-document { box-sizing: border-box; margin: 0 auto; width: 210mm; min-height: 297mm; box-shadow: none !important; }
    table { border-collapse: collapse; }
    img { max-width: 100%; object-fit: contain; }
    @media print {
      .exported-proposal-document { margin: 0; width: 210mm; min-height: 297mm; break-after: page; page-break-after: always; }
    }
  `;
  }

  function buildTechnicalProposalPrintHtml(): string | null {
    const clone = clonePreviewWithInlineStyles();
    if (!clone) return null;
    const styles = buildPrintDocumentStyles();
    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${draft.metadata.documento_codigo} - Propuesta tecnica</title>
  <style>${styles}</style>
</head>
<body>
${clone.outerHTML}
</body>
</html>`;
  }

  function exportHtmlFromPreview() {
    refreshPreview();
    window.requestAnimationFrame(() => {
      const html = buildTechnicalProposalPrintHtml();
      if (!html) {
        setStatusMessage("No se encontro la vista previa A4 para exportar.");
        return;
      }
      downloadBlob(html, "text/html;charset=utf-8", safeExportFileName("html"));
      setStatusMessage("HTML de propuesta tecnica descargado.");
    });
  }

  function exportWordFromPreview() {
    refreshPreview();
    window.requestAnimationFrame(() => {
      const html = buildTechnicalProposalPrintHtml();
      if (!html) {
        setStatusMessage("No se encontro la vista previa A4 para exportar.");
        return;
      }
      downloadBlob(html, "application/msword;charset=utf-8", safeExportFileName("doc"));
      setStatusMessage("Word de propuesta tecnica descargado.");
    });
  }

  function exportJsonFromDraft() {
    const payload = {
      metadata: draft.metadata,
      mode: draft.mode,
      work_status: draft.work_status,
      header: draft.header,
      recipient: draft.recipient,
      presentation: draft.presentation,
      scope_items: draft.scope_items,
      resources: draft.resources,
      general_images: draft.general_images,
      activity_images: draft.activity_images,
      conditions: draft.conditions,
      exported_at: new Date().toISOString(),
    };
    downloadBlob(JSON.stringify(payload, null, 2), "application/json;charset=utf-8", safeExportFileName("json"));
    setStatusMessage("JSON de propuesta tecnica descargado.");
  }

  function handlePrintPdf(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    if (printInProgressRef.current) return;
    if (process.env.NODE_ENV === "development") {
      console.log("[print] click recibido");
    }

    printInProgressRef.current = true;
    document.body.classList.add("printing-ready");
    flushSync(() => {
      setPrintingReady(true);
      setProposalLogos(readProposalLogos());
      setPreviewRefreshKey((current) => current + 1);
      setRightPanelView("document");
      setStatusMessage("Preparando impresion / PDF.");
    });

    const previewDocument = previewDocumentRef.current;
    if (process.env.NODE_ENV === "development") {
      console.log("[print] documento A4 encontrado", Boolean(previewDocument));
    }
    if (!previewDocument) {
      printInProgressRef.current = false;
      document.body.classList.remove("printing-ready");
      setPrintingReady(false);
      setStatusMessage("No se encontro el documento A4 para imprimir.");
      return;
    }

    const styles = buildPrintDocumentStyles();
    const html = buildTechnicalProposalPrintHtml();
    if (process.env.NODE_ENV === "development") {
      console.log("[print] html length", html?.length ?? 0);
      console.log("[print] estilos length", styles.length);
    }
    if (!html || html.length < 500 || !html.includes("exported-proposal-document")) {
      printInProgressRef.current = false;
      document.body.classList.remove("printing-ready");
      setPrintingReady(false);
      setStatusMessage("No se pudo construir el documento A4 para imprimir.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (process.env.NODE_ENV === "development") {
      console.log("[print] ventana abierta", Boolean(printWindow));
    }
    if (!printWindow) {
      printInProgressRef.current = false;
      document.body.classList.remove("printing-ready");
      setPrintingReady(false);
      setStatusMessage("No se pudo abrir la impresion. Prueba habilitando ventanas emergentes o usa Ctrl + P.");
      return;
    }

    let fallbackTimer: number | null = null;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      printInProgressRef.current = false;
      document.body.classList.remove("printing-ready");
      setPrintingReady(false);
      window.removeEventListener("afterprint", cleanup);
      printWindow.removeEventListener("afterprint", cleanup);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
    };

    window.addEventListener("afterprint", cleanup);
    printWindow.addEventListener("afterprint", cleanup);

    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      const runPrint = () => {
        const printDocument = printWindow.document.querySelector(".exported-proposal-document");
        if (!printDocument) {
          throw new Error("La ventana de impresion no recibio el documento A4.");
        }
        printWindow.focus();
        if (process.env.NODE_ENV === "development") {
          console.log("[print] llamando window.print");
        }
        printWindow.print();
        fallbackTimer = window.setTimeout(cleanup, 3000);
      };
      const waitForImages = () => {
        const images = Array.from(printWindow.document.images);
        return Promise.all(
          images.map(
            (image) =>
              image.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    image.onload = () => resolve();
                    image.onerror = () => resolve();
                  }),
          ),
        );
      };
      const waitForFonts = () => printWindow.document.fonts?.ready ?? Promise.resolve();
      Promise.all([waitForImages(), waitForFonts()])
        .then(() =>
          window.setTimeout(() => {
            try {
              runPrint();
            } catch (error) {
              console.error("[propuesta-tecnica] Error ejecutando impresion/PDF:", error);
              setStatusMessage("No se pudo abrir la impresion. Prueba con Ctrl + P.");
              printWindow.close();
              cleanup();
            }
          }, 100),
        )
        .catch((error: unknown) => {
          console.error("[propuesta-tecnica] Error preparando impresion/PDF:", error);
          try {
            runPrint();
          } catch (printError) {
            console.error("[propuesta-tecnica] Error ejecutando impresion/PDF:", printError);
            setStatusMessage("No se pudo abrir la impresion. Prueba con Ctrl + P.");
            printWindow.close();
            cleanup();
          }
        });
    } catch (error) {
      console.error("[propuesta-tecnica] Error al imprimir/PDF:", error);
      setStatusMessage("No se pudo abrir la impresion. Prueba con Ctrl + P.");
      printWindow.close();
      cleanup();
    }
  }

  function generateStructureFromOutline() {
    const parsed = parseScopeOutline(draft.scope_outline);
    const nextItems = parsedLinesToScopeItems(parsed, draft.scope_items);
    setDraftWithTouch((prev) => ({
      ...prev,
      scope_items: nextItems.length ? nextItems : prev.scope_items,
      scope_outline: scopeItemsToOutline(nextItems.length ? nextItems : prev.scope_items),
    }));
    setSelectedScopeItemId(nextItems.find((item) => item.kind === "activity")?.id ?? nextItems[0]?.id ?? selectedScopeItemId);
    setStatusMessage("Estructura generada desde el listado jerarquico.");
  }

  function renumberOutline() {
    const parsed = parseScopeOutline(draft.scope_outline);
    const items = parsedLinesToScopeItems(parsed, draft.scope_items);
    patchDraft({ scope_outline: scopeItemsToOutline(items.length ? items : draft.scope_items) });
  }

  function clearScopeOutline() {
    patchDraft({ scope_outline: "" });
  }

  function updateScopeItem(itemId: string, patch: Partial<ScopeItem>) {
    setDraftWithTouch((prev) => {
      const nextItems = renumberScopeItems(prev.scope_items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
      return { ...prev, scope_items: nextItems, scope_outline: scopeItemsToOutline(nextItems) };
    });
  }

  function transformScopeItems(transform: (items: ScopeItem[]) => ScopeItem[]) {
    setDraftWithTouch((prev) => {
      const nextItems = renumberScopeItems(transform(prev.scope_items));
      return { ...prev, scope_items: nextItems, scope_outline: scopeItemsToOutline(nextItems) };
    });
  }

  function indentScopeItemById(itemId: string) {
    transformScopeItems((items) => indentScopeItem(items, itemId));
    setSelectedScopeItemId(itemId);
  }

  function outdentScopeItemById(itemId: string) {
    transformScopeItems((items) => outdentScopeItem(items, itemId));
    setSelectedScopeItemId(itemId);
  }

  function moveScopeItemUpById(itemId: string) {
    transformScopeItems((items) => moveScopeItemUp(items, itemId));
    setSelectedScopeItemId(itemId);
  }

  function moveScopeItemDownById(itemId: string) {
    transformScopeItems((items) => moveScopeItemDown(items, itemId));
    setSelectedScopeItemId(itemId);
  }

  function addScopeItem(kind: ScopeKind, afterId?: string) {
    const selected = afterId ? draft.scope_items.find((item) => item.id === afterId) : selectedScopeItem;
    const level = kind === "group" ? 0 : kind === "subgroup" ? Math.min(4, (selected?.level ?? 0) + 1) : Math.min(4, selected?.kind === "group" ? selected.level + 1 : selected?.level ?? 1);
    const nextItem: ScopeItem = {
      id: uid("scope"),
      level,
      number: "",
      kind,
      title: kind === "activity" ? "Nueva actividad" : kind === "subgroup" ? "Nuevo subgrupo" : "Nuevo grupo",
      description: "",
      time_value: kind === "activity" ? 1 : 0,
      time_unit: "dias",
      complete: false,
      collapsed: false,
      internal_comments: "",
    };
    setDraftWithTouch((prev) => {
      const targetIndex = selected ? prev.scope_items.findIndex((item) => item.id === selected.id) : -1;
      const nextRaw = [...prev.scope_items];
      nextRaw.splice(targetIndex >= 0 ? targetIndex + 1 : nextRaw.length, 0, nextItem);
      const nextItems = renumberScopeItems(nextRaw);
      return { ...prev, scope_items: nextItems, scope_outline: scopeItemsToOutline(nextItems) };
    });
    setSelectedScopeItemId(nextItem.id);
  }

  function duplicateScopeItem(itemId: string) {
    const source = draft.scope_items.find((item) => item.id === itemId);
    if (!source) return;
    const copyId = uid("scope");
    const copy: ScopeItem = { ...source, id: copyId, title: `${source.title} - copia`, collapsed: false };
    setDraftWithTouch((prev) => {
      const targetIndex = prev.scope_items.findIndex((item) => item.id === itemId);
      const nextRaw = [...prev.scope_items];
      nextRaw.splice(targetIndex + 1, 0, copy);
      const nextItems = renumberScopeItems(nextRaw);
      return { ...prev, scope_items: nextItems, scope_outline: scopeItemsToOutline(nextItems) };
    });
    setSelectedScopeItemId(copyId);
  }

  function deleteScopeItem(itemId: string) {
    setDraftWithTouch((prev) => {
      const nextItems = renumberScopeItems(prev.scope_items.filter((item) => item.id !== itemId));
      return {
        ...prev,
        scope_items: nextItems.length ? nextItems : defaultScopeItems(cotizacion.proyecto),
        scope_outline: scopeItemsToOutline(nextItems.length ? nextItems : defaultScopeItems(cotizacion.proyecto)),
        resources: prev.resources.filter((resource) => resource.scope_item_id !== itemId),
        activity_images: prev.activity_images.filter((image) => image.scope_item_id !== itemId),
      };
    });
    if (selectedScopeItemId === itemId) {
      const next = draft.scope_items.find((item) => item.id !== itemId && item.kind === "activity") ?? draft.scope_items.find((item) => item.id !== itemId);
      setSelectedScopeItemId(next?.id ?? "scope-1");
    }
  }

  function handleScopeOutlineKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Tab") {
      event.preventDefault();
      adjustCurrentScopeLineDepth(event.currentTarget, event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      insertScopeLine(event.currentTarget);
      return;
    }
    if (event.code === "Space" && event.ctrlKey) {
      event.preventDefault();
      toggleCurrentScopeLineActivity(event.currentTarget);
    }
  }

  function currentLineInfo(textarea: HTMLTextAreaElement) {
    const value = textarea.value;
    const pos = textarea.selectionStart ?? 0;
    const before = value.slice(0, pos);
    const lineIndex = before.split("\n").length - 1;
    const lines = value.split("\n");
    return { lines, lineIndex };
  }

  function setScopeTextareaLines(textarea: HTMLTextAreaElement, lines: string[], focusLineIndex: number) {
    const nextValue = lines.join("\n");
    patchDraft({ scope_outline: nextValue });
    window.requestAnimationFrame(() => {
      const lineStart = lines.slice(0, focusLineIndex).join("\n").length + (focusLineIndex > 0 ? 1 : 0);
      const lineEnd = lineStart + (lines[focusLineIndex]?.length ?? 0);
      textarea.focus();
      textarea.setSelectionRange(lineEnd, lineEnd);
    });
  }

  function adjustCurrentScopeLineDepth(textarea: HTMLTextAreaElement, delta: number) {
    const { lines, lineIndex } = currentLineInfo(textarea);
    const parsed = parseScopeOutline(lines[lineIndex] ?? "");
    const current = parsed[0] ?? { level: 0, kind: "group" as ScopeKind, title: cleanScopeTitle(lines[lineIndex] ?? ""), number: "" };
    current.level = Math.max(0, Math.min(4, current.level + delta));
    const prefix = "  ".repeat(current.level);
    lines[lineIndex] = `${prefix}${current.kind === "activity" ? "[A] " : ""}${current.title}`;
    setScopeTextareaLines(textarea, scopeItemsToOutline(parsedLinesToScopeItems(parseScopeOutline(lines.join("\n")), draft.scope_items)).split("\n"), lineIndex);
  }

  function insertScopeLine(textarea: HTMLTextAreaElement) {
    const { lines, lineIndex } = currentLineInfo(textarea);
    const parsed = parseScopeOutline(lines[lineIndex] ?? "");
    const level = parsed[0]?.level ?? 0;
    lines.splice(lineIndex + 1, 0, `${"  ".repeat(level)}`);
    setScopeTextareaLines(textarea, lines, lineIndex + 1);
  }

  function toggleCurrentScopeLineActivity(textarea: HTMLTextAreaElement) {
    const { lines, lineIndex } = currentLineInfo(textarea);
    const line = lines[lineIndex] ?? "";
    const isActivity = scopeLineHasActivity(line);
    const title = cleanScopeTitle(line);
    const parsed = parseScopeOutline(line);
    const level = parsed[0]?.level ?? 0;
    lines[lineIndex] = `${"  ".repeat(level)}${isActivity ? "" : "[A] "}${title}`;
    setScopeTextareaLines(textarea, scopeItemsToOutline(parsedLinesToScopeItems(parseScopeOutline(lines.join("\n")), draft.scope_items)).split("\n"), lineIndex);
  }

  function addNewResource(scopeItemId: string, category: ResourceCategoryKey) {
    const nextResource = makeNewFormalizationResource(scopeItemId, category);
    setDraftWithTouch((prev) => ({ ...prev, resources: [...prev.resources, nextResource] }));
    setSelectedResourceRowId(nextResource.id);
    setActiveResourceTargetRowId(nextResource.id);
    setActiveMasterResource(null);
    setRightPanelView("selected_resource");
    setStatusMessage("Recurso agregado como nuevo por formalizar.");
  }

  function updateResource(resourceId: string, patch: Partial<TechnicalProposalResourceSnapshot>) {
    setDraftWithTouch((prev) => ({
      ...prev,
      resources: prev.resources.map((resource) => (resource.id === resourceId ? { ...resource, ...patch } : resource)),
    }));
  }

  function deleteResource(resourceId: string) {
    setDraftWithTouch((prev) => ({ ...prev, resources: prev.resources.filter((resource) => resource.id !== resourceId) }));
    if (selectedResourceRowId === resourceId) {
      setSelectedResourceRowId(null);
      setEditingResourceCellId(null);
      setActiveMasterResource(null);
    }
    if (activeResourceTargetRowId === resourceId) setActiveResourceTargetRowId(null);
  }

  function selectUsedResourceForDetail(item: UsedResourceItem) {
    const snapshot = draft.resources.find((resource) => resource.id === item.rowId) ?? null;
    setSelectedResourceRowId(item.rowId);
    setEditingResourceCellId(null);
    setActiveMasterResource(item.masterResourceId ? recursos.find((resource) => resource.id === item.masterResourceId) ?? null : null);
    if (!snapshot?.recurso_id) setActiveMasterResource(null);
    setRightPanelView("selected_resource");
  }

  function reuseUsedResource(item: UsedResourceItem) {
    if (!isEditingProposalDocument) {
      setStatusMessage("Activa Editar para reutilizar recursos.");
      return;
    }
    if (!activeResourceTargetRowId) {
      setStatusMessage("Selecciona una fila de recurso para reutilizarlo.");
      return;
    }
    const target = draft.resources.find((resource) => resource.id === activeResourceTargetRowId);
    const source = draft.resources.find((resource) => resource.id === item.rowId);
    if (!target || !source) {
      setStatusMessage("Selecciona una fila de recurso para reutilizarlo.");
      return;
    }
    if (target.resource_category !== source.resource_category) {
      setStatusMessage("Este recurso pertenece a otro tipo.");
      return;
    }
    updateResource(target.id, {
      recurso_id: source.recurso_id,
      codigo_recurso: source.codigo_recurso,
      codigo_fabricante: source.codigo_fabricante,
      tipo_recurso: source.tipo_recurso,
      resource_category: source.resource_category,
      descripcion: source.descripcion,
      unidad: source.unidad,
      precio_unitario_ref: source.precio_unitario_ref,
      moneda: source.moneda,
      proveedor: source.proveedor,
      marca: source.marca,
      detalle_adicional: source.detalle_adicional,
      estado_origen: source.estado_origen,
    });
    setSelectedResourceRowId(target.id);
    setEditingResourceCellId(null);
    setActiveMasterResource(source.recurso_id ? recursos.find((resource) => resource.id === source.recurso_id) ?? null : null);
    setRightPanelView("selected_resource");
    setStatusMessage("Recurso reutilizado en la fila seleccionada.");
  }

  function applyQuickEntry(scopeItemId: string, category: ResourceCategoryKey, rows: QuickEntryRow[]) {
    setDraftWithTouch((prev) => {
      const snapshots = rows
        .filter((row) => row.descripcion.trim() || row.recurso_id)
        .map((row) => {
          const resource = recursos.find((item) => item.id === row.recurso_id);
          const snapshot = resource ? makeSnapshotFromResource(resource, scopeItemId, category) : makeNewFormalizationResource(scopeItemId, category);
          return {
            ...snapshot,
            descripcion: row.descripcion || snapshot.descripcion,
            cantidad: row.cantidad,
            unidad: row.unidad || snapshot.unidad,
            tiempo: row.tiempo,
            comentario: row.comentario,
          };
        });
      return { ...prev, resources: [...prev.resources, ...snapshots] };
    });
    setQuickEntryOpen(false);
    setStatusMessage("Recursos de ingreso rapido aplicados a la actividad.");
  }

  async function addImageFromFile(event: ChangeEvent<HTMLInputElement>, target: "general" | "activity", scopeItemId: string | null = null) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const nextImage: ProposalImage = {
      id: uid("img"),
      scope_item_id: scopeItemId,
      resource_id: null,
      title: file.name.replace(/\.[^.]+$/, ""),
      relation_label: target === "general" ? "Referencia general" : "Actividad completa",
      size: "1",
      data_url: dataUrl,
    };
    setDraftWithTouch((prev) =>
      target === "general"
        ? { ...prev, general_images: [...prev.general_images, nextImage] }
        : { ...prev, activity_images: [...prev.activity_images, nextImage] },
    );
  }

  function updateImage(imageId: string, target: "general" | "activity", patch: Partial<ProposalImage>) {
    setDraftWithTouch((prev) => {
      const key = target === "general" ? "general_images" : "activity_images";
      return { ...prev, [key]: prev[key].map((image) => (image.id === imageId ? { ...image, ...patch } : image)) };
    });
  }

  function deleteImage(imageId: string, target: "general" | "activity") {
    setDraftWithTouch((prev) => {
      const key = target === "general" ? "general_images" : "activity_images";
      return { ...prev, [key]: prev[key].filter((image) => image.id !== imageId) };
    });
  }

  function renderImageEditor(images: ProposalImage[], target: "general" | "activity", scopeItemId: string | null) {
    return (
      <div className="space-y-2">
        {images.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-5 text-center text-[11px] text-stone-500">
            No se adjuntan imagenes de referencia.
          </div>
        ) : null}
        {images.map((image) => (
          <div key={image.id} className="grid grid-cols-1 gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2 md:grid-cols-[110px_1fr_120px_90px_auto]">
            <div className="flex h-[82px] items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-white">
              <img src={image.data_url} alt={image.title} className="h-full w-full object-contain" />
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <input value={image.title} onChange={(event) => updateImage(image.id, target, { title: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
              <input value={image.relation_label} onChange={(event) => updateImage(image.id, target, { relation_label: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
            </div>
            <select
              value={image.scope_item_id ?? ""}
              onChange={(event) => updateImage(image.id, target, { scope_item_id: event.target.value || null })}
              className={inputClassName()}
              disabled={!isEditingProposalDocument}
            >
              <option value="">Referencia manual</option>
              {draft.scope_items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.number} {item.title}
                </option>
              ))}
            </select>
            <select value={image.size} onChange={(event) => updateImage(image.id, target, { size: event.target.value as ProposalImage["size"] })} className={inputClassName()} disabled={!isEditingProposalDocument}>
              <option value="1">1 espacio</option>
              <option value="2">2 espacios</option>
              <option value="4">4 espacios</option>
            </select>
            <button type="button" onClick={() => deleteImage(image.id, target)} className={smallButtonClassName("danger")} disabled={!isEditingProposalDocument}>
              Eliminar
            </button>
          </div>
        ))}
        <label className={`${smallButtonClassName("primary")} ${!isEditingProposalDocument ? "pointer-events-none opacity-45" : ""}`}>
          Agregar imagen
          <input type="file" accept="image/*" className="hidden" onChange={(event) => addImageFromFile(event, target, scopeItemId)} disabled={!isEditingProposalDocument} />
        </label>
      </div>
    );
  }

  function renderResourceGrid(activity: ScopeItem) {
    const rows = draft.resources.filter((resource) => resource.scope_item_id === activity.id);
    return (
      <TechnicalProposalResourceGrid
        activityNumber={activity.number}
        categories={RESOURCE_CATEGORIES}
        rows={rows}
        resources={recursos}
        usedResourceLookup={usedResourceLookup}
        selectedResourceRowId={selectedResourceRowId}
        editingResourceCellId={editingResourceCellId}
        editingEnabled={isEditingProposalDocument}
        onAddResource={(categoryKey) => addNewResource(activity.id, categoryKey)}
        onDeleteResource={deleteResource}
        onUpdateResource={updateResource}
        onSelectResourceRow={(resource) => {
          setSelectedResourceRowId(resource.id);
          setActiveResourceTargetRowId(resource.id);
          setEditingResourceCellId(null);
          setActiveMasterResource(resource.recurso_id ? recursos.find((item) => item.id === resource.recurso_id) ?? null : null);
          setRightPanelView("selected_resource");
        }}
        onEditResourceDescription={(resourceId) => {
          if (resourceId) setActiveResourceTargetRowId(resourceId);
          setEditingResourceCellId(resourceId);
        }}
        onActiveMasterResource={(resource) => {
          setActiveMasterResource(resource);
          if (resource) setRightPanelView("selected_resource");
        }}
        onSelectMasterResource={(resourceId, selectedResource) => {
          setSelectedResourceRowId(resourceId);
          setActiveResourceTargetRowId(resourceId);
          setEditingResourceCellId(null);
          setActiveMasterResource(selectedResource);
          setRightPanelView("selected_resource");
          updateResource(resourceId, {
            recurso_id: selectedResource.id,
            codigo_recurso: selectedResource.codigo_recurso,
            codigo_fabricante: selectedResource.codigo_fabricante,
            tipo_recurso: selectedResource.tipo_recurso,
            resource_category: mapResourceCategory(selectedResource.tipo_recurso),
            descripcion: selectedResource.descripcion,
            unidad: selectedResource.unidad,
            precio_unitario_ref: selectedResource.precio_unitario_ref,
            moneda: selectedResource.moneda,
            proveedor: selectedResource.proveedor,
            marca: selectedResource.marca,
            detalle_adicional: selectedResource.modelo || selectedResource.observaciones,
            estado_origen: "catalogo_copiado",
          });
        }}
      />
    );
  }

  function renderScopeItemEditor(item: ScopeItem) {
    const activityImages = draft.activity_images.filter((image) => image.scope_item_id === item.id);
    const childrenCount = draft.scope_items.filter((candidate) => candidate.number.startsWith(`${item.number}.`)).length;
    return (
      <div
        key={item.id}
        className={`rounded-lg border ${
          item.kind === "activity" ? "border-stone-200 bg-white" : "border-teal-100 bg-teal-50/40"
        }`}
        style={{ marginLeft: `${Math.min(item.level, 3) * 18}px` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-200 px-3 py-2">
          <button type="button" onClick={() => setSelectedScopeItemId(item.id)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-teal-200 bg-white px-1.5 text-[11px] font-bold text-teal-700">
              {item.number}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-bold text-stone-800">{item.title}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
                <span className={`rounded-full border px-2 py-0.5 ${item.kind === "activity" ? "border-teal-200 bg-teal-50 text-teal-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  {scopeKindLabel(item.kind)}
                </span>
                <span>{childrenCount} subitem(s)</span>
                {item.kind === "activity" ? <span>{draft.resources.filter((resource) => resource.scope_item_id === item.id).length} recurso(s)</span> : null}
                {item.kind === "activity" && item.complete ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">Completo</span> : null}
              </span>
            </span>
          </button>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => updateScopeItem(item.id, { collapsed: !item.collapsed })} className={smallButtonClassName("secondary")}>
              {item.collapsed ? "Expandir" : "Agrupar"}
            </button>
            <button type="button" onClick={() => duplicateScopeItem(item.id)} className={smallButtonClassName("secondary")} disabled={!isEditingProposalDocument}>
              Duplicar
            </button>
            <button type="button" onClick={() => deleteScopeItem(item.id)} className={smallButtonClassName("danger")} disabled={!isEditingProposalDocument}>
              Eliminar
            </button>
          </div>
        </div>
        {!item.collapsed ? (
          <div className="space-y-3 p-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_130px_130px_110px]">
              <Field label="Titulo">
                <input value={item.title} onChange={(event) => updateScopeItem(item.id, { title: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
              </Field>
              <Field label="Tipo">
                <select value={item.kind} onChange={(event) => updateScopeItem(item.id, { kind: event.target.value as ScopeKind })} className={inputClassName()} disabled={!isEditingProposalDocument}>
                  <option value="group">Grupo</option>
                  <option value="subgroup">Subgrupo</option>
                  <option value="activity">Actividad</option>
                </select>
              </Field>
              <Field label="Tiempo estimado">
                <input
                  type="number"
                  min={0}
                  value={item.time_value}
                  onChange={(event) => updateScopeItem(item.id, { time_value: toFiniteNumber(event.target.value) })}
                  className={inputClassName()}
                  disabled={!isEditingProposalDocument}
                />
              </Field>
              <Field label="Unidad">
                <select value={item.time_unit} onChange={(event) => updateScopeItem(item.id, { time_unit: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument}>
                  <option value="dias">dias</option>
                  <option value="horas">horas</option>
                  <option value="semanas">semanas</option>
                </select>
              </Field>
            </div>
            <Field label="Descripcion tecnica / alcance">
              <textarea value={item.description} onChange={(event) => updateScopeItem(item.id, { description: event.target.value })} className={textareaClassName()} disabled={!isEditingProposalDocument} />
            </Field>
            {item.kind === "activity" ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-stone-600">
                    <input
                      type="checkbox"
                      checked={item.complete}
                      onChange={(event) => updateScopeItem(item.id, { complete: event.target.checked })}
                      className="h-4 w-4 rounded border-stone-300"
                      disabled={!isEditingProposalDocument}
                    />
                    Actividad completa
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {RESOURCE_CATEGORIES.map((category) => (
                      <button key={category.key} type="button" onClick={() => addNewResource(item.id, category.key)} className={smallButtonClassName("secondary")} disabled={!isEditingProposalDocument}>
                        + {category.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {renderResourceGrid(item)}
                </div>
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <FieldLabelIcon icon="image" label="Imagenes de referencia" className="text-[11px] font-bold text-stone-700" />
                  </div>
                  {renderImageEditor(activityImages, "activity", item.id)}
                </div>
                {showInternal ? (
                  <Field label="Comentarios internos">
                    <textarea
                      value={item.internal_comments}
                      onChange={(event) => updateScopeItem(item.id, { internal_comments: event.target.value })}
                      className={textareaClassName("min-h-[56px]")}
                      disabled={!isEditingProposalDocument}
                    />
                  </Field>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function renderDocHeader() {
    return (
      <div className="grid grid-cols-[110px_1fr_110px] items-center gap-4 border-b-2 border-amber-600 pb-4">
        <div className="text-center">
          {companyLogo?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${companyLogo.id}-${companyLogo.updated_at}-${previewRefreshKey}`}
              src={companyLogo.logo_url}
              alt={companyLogo.display_name || companyLogo.entity_name || "Logo EKA"}
              className="mx-auto block max-h-[76px] max-w-[76px] border-0 bg-transparent p-0 object-contain shadow-none outline-none ring-0"
            />
          ) : (
            <div className="mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-full border border-stone-300 bg-stone-50 text-[22px] font-black text-stone-700">
              EKA
            </div>
          )}
          <div className="mt-2 text-[11px] font-black uppercase text-stone-800">{draft.header.empresa_emisora}</div>
        </div>
        <div className="text-center">
          <div className="text-[12px] font-black uppercase text-stone-900">FORMATO</div>
          <div className="text-[12px] font-black uppercase text-stone-900">GESTION DE PROYECTOS</div>
          <div className="text-[15px] font-black uppercase text-stone-900">PROPUESTA TECNICA</div>
        </div>
        <div className="text-center">
          {clientLogo?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${clientLogo.id}-${clientLogo.updated_at}-${previewRefreshKey}`}
              src={clientLogo.logo_url}
              alt={clientLogo.display_name || clientLogo.entity_name || "Logo cliente"}
              className="mx-auto block max-h-[76px] max-w-[96px] border-0 bg-transparent p-0 object-contain shadow-none outline-none ring-0"
            />
          ) : (
            <div className="mx-auto flex h-[76px] w-[96px] items-center justify-center rounded border border-dashed border-stone-300 bg-stone-50 px-2 text-[16px] font-black uppercase text-stone-700">
              {draft.header.cliente_logo_label || "Cliente"}
            </div>
          )}
          <div className="mt-2 text-[11px] font-black uppercase text-stone-800">{draft.recipient.cliente || cotizacion.cliente || "CLIENTE"}</div>
        </div>
      </div>
    );
  }

  function renderPreviewImages(images: ProposalImage[]) {
    if (!images.length) return null;
    return (
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        {images.map((image) => (
          <figure key={image.id} className={`${imageGridSpanClass(image.size)} rounded border border-stone-200 p-1.5`}>
            <div className={`${docImageClass(image.size)} flex items-center justify-center bg-stone-50`}>
              <img src={image.data_url} alt={image.title} className="max-h-full max-w-full object-contain" />
            </div>
            <figcaption className="mt-1 text-[8px] text-stone-500">
              <strong>{image.title}</strong> {image.relation_label ? `- ${image.relation_label}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }

  function renderPreviewResourceTable(activity: ScopeItem, category: (typeof RESOURCE_CATEGORIES)[number]) {
    const rows = resourceRowsFor(activity.id, draft.resources, category.key);
    if (!rows.length) return null;
    const showComments = showInternal && rows.some((row) => row.comentario.trim());
    return (
      <div key={category.key} className="mt-2">
        <div className="border-l-4 border-teal-700 pl-2 text-[9px] font-black uppercase text-teal-800">
          {activity.number}.{category.shortLabel} {category.label}
        </div>
        <table className="mt-1 w-full border-collapse text-[8px]">
          <thead>
            <tr className="bg-teal-50 text-teal-800">
              <th className="border border-stone-200 px-1.5 py-1">Item</th>
              <th className="border border-stone-200 px-1.5 py-1">Descripcion</th>
              <th className="border border-stone-200 px-1.5 py-1">Cant.</th>
              <th className="border border-stone-200 px-1.5 py-1">Unidad</th>
              {category.hasTime ? <th className="border border-stone-200 px-1.5 py-1">Dia / Tiempo</th> : null}
              {showComments ? <th className="border border-stone-200 px-1.5 py-1">Comentario interno</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td className="border border-stone-200 px-1.5 py-1 text-center">{index + 1}</td>
                <td className="border border-stone-200 px-1.5 py-1">
                  {row.descripcion}
                  {showInternal && row.estado_origen === "nuevo_por_formalizar" ? <strong className="text-amber-700"> (nuevo por formalizar)</strong> : null}
                </td>
                <td className="border border-stone-200 px-1.5 py-1 text-center">{row.cantidad}</td>
                <td className="border border-stone-200 px-1.5 py-1 text-center">{row.unidad}</td>
                {category.hasTime ? <td className="border border-stone-200 px-1.5 py-1 text-center">{row.tiempo || "-"}</td> : null}
                {showComments ? <td className="border border-stone-200 px-1.5 py-1">{row.comentario || "-"}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body.printing-ready * {
            visibility: hidden !important;
          }

          body.printing-ready .technical-proposal-a4-doc,
          body.printing-ready .technical-proposal-a4-doc * {
            visibility: visible !important;
          }

          body.printing-ready .technical-proposal-a4-doc {
            position: fixed !important;
            inset: 0 auto auto 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
          }
        }
      `}</style>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-2">
      <div className="flex h-[calc(100dvh-18px)] w-[98vw] max-w-[1920px] flex-col overflow-hidden rounded-xl border border-stone-300 bg-stone-100 shadow-2xl">
        <TechnicalProposalTopbar
          documentCode={draft.metadata.documento_codigo}
          revisionFolder={draft.metadata.subcarpeta_revision}
          mode={draft.mode}
          onModeChange={(mode) => patchDraft({ mode })}
          editingLocked={editingLocked}
          onEditToggle={handleEditToggle}
          onClose={onClose}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 xl:grid-cols-[minmax(700px,0.98fr)_minmax(520px,1.02fr)]">
          <main className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="min-h-0 space-y-2 overflow-y-auto p-3">
              <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-3 py-2">
                  <FieldLabelIcon icon="table" label="Datos generales compactos" className="text-[12px] font-bold text-stone-800" />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                      Estado PT
                      <select
                        value={draft.work_status}
                        onChange={(event) => patchDraft({ work_status: event.target.value as ProposalWorkStatus })}
                        className="h-6 border border-stone-300 bg-white px-2 text-[11px] font-semibold normal-case text-stone-700 outline-none focus:border-teal-500"
                        disabled={!isEditingProposalDocument}
                      >
                        <option value="Borrador">Borrador</option>
                        <option value="En proceso">En proceso</option>
                        <option value="Completado">Completado</option>
                      </select>
                    </label>
                    <span className="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                      {draft.metadata.revision}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-[11px]">
                    <tbody>
                      {[
                        ["Documento", draft.metadata.documento_codigo],
                        ["Cotizacion", draft.metadata.cotizacion_codigo],
                        ["Cliente", draft.recipient.cliente || cotizacion.cliente],
                        ["Unidad", draft.recipient.unidad_trabajo || cotizacion.unidad_trabajo],
                        ["Proyecto", cotizacion.proyecto],
                        ["Fecha", draft.header.fecha],
                        ["Referencia", draft.presentation.referencia],
                      ].map(([label, value], index) => (
                        <tr key={label} className={index % 2 === 0 ? "bg-white" : "bg-stone-50/60"}>
                          <td className="w-[130px] border-b border-stone-100 px-2 py-1 font-bold text-stone-500">{label}</td>
                          <td className="border-b border-stone-100 px-2 py-1 text-stone-800">{value || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={sectionCardClassName(draft.field_mode, "a")}>
                <SectionHeader title="A. Encabezado y documento" icon="file-text" collapsed={collapsedSections.a} onToggle={() => toggleSection("a")} />
                {!collapsedSections.a ? (
                  <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-3">
                    <Field label="Ciudad">
                      <input value={draft.header.ciudad} onChange={(event) => patchNested("header", { ciudad: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
                    </Field>
                    <Field label="Fecha">
                      <input type="date" value={draft.header.fecha} onChange={(event) => patchNested("header", { fecha: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
                    </Field>
                    <Field label="Presupuesto / documento">
                      <input value={draft.metadata.documento_codigo} readOnly className={`${inputClassName()} bg-stone-50 text-stone-500`} />
                    </Field>
                    <Field label="Titulo">
                      <input value={draft.header.titulo} onChange={(event) => patchNested("header", { titulo: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
                    </Field>
                    <Field label="Subtitulo">
                      <input value={draft.header.subtitulo} onChange={(event) => patchNested("header", { subtitulo: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
                    </Field>
                    <Field label="Logo cliente / placeholder">
                      <input value={draft.header.cliente_logo_label} onChange={(event) => patchNested("header", { cliente_logo_label: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
                    </Field>
                  </div>
                ) : null}
              </section>

              <section className={sectionCardClassName(draft.field_mode, "b")}>
                <SectionHeader title="B. Destinatario" icon="building" collapsed={collapsedSections.b} onToggle={() => toggleSection("b")} />
                {!collapsedSections.b ? (
                  <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
                    <Field label="Cliente">
                      <input value={draft.recipient.cliente} onChange={(event) => patchNested("recipient", { cliente: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
                    </Field>
                    <Field label="Unidad de trabajo">
                      <input value={draft.recipient.unidad_trabajo} onChange={(event) => patchNested("recipient", { unidad_trabajo: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
                    </Field>
                    <Field label="Area solicitante">
                      <input value={draft.recipient.area_solicitante} onChange={(event) => patchNested("recipient", { area_solicitante: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
                    </Field>
                    <Field label="Atencion">
                      <input value={draft.recipient.atencion} onChange={(event) => patchNested("recipient", { atencion: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
                    </Field>
                    <Field label="Contacto" className="md:col-span-2">
                      <input value={draft.recipient.contacto} onChange={(event) => patchNested("recipient", { contacto: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
                    </Field>
                  </div>
                ) : null}
              </section>

              <section className={sectionCardClassName(draft.field_mode, "c")}>
                <SectionHeader
                  title="C. Referencia y presentacion"
                  icon="align-left"
                  collapsed={collapsedSections.c}
                  onToggle={() => toggleSection("c")}
                  actions={
                    <button type="button" onClick={generateStructureFromOutline} className={smallButtonClassName("primary")} disabled={!isEditingProposalDocument}>
                      Generar estructura
                    </button>
                  }
                />
                {!collapsedSections.c ? (
                  <div className="space-y-3 p-3">
                    <Field label="Referencia">
                      <input value={draft.presentation.referencia} onChange={(event) => patchNested("presentation", { referencia: event.target.value })} className={inputClassName()} disabled={!isEditingProposalDocument} />
                    </Field>
                    <Field label="Texto de presentacion">
                      <textarea value={draft.presentation.texto} onChange={(event) => patchNested("presentation", { texto: event.target.value })} className={textareaClassName()} disabled={!isEditingProposalDocument} />
                    </Field>
                    <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-2">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <FieldLabelIcon icon="list-checks" label="Resumen de los alcances del servicio" className="text-[11px] font-black uppercase text-teal-800" />
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={clearScopeOutline} className={smallButtonClassName("secondary")} disabled={!isEditingProposalDocument}>
                            Limpiar resumen
                          </button>
                          <button type="button" onClick={renumberOutline} className={smallButtonClassName("secondary")} disabled={!isEditingProposalDocument}>
                            Renumerar
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_250px]">
                        <div>
                          <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[11px] text-stone-500">
                            <label className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-2 py-1 font-bold text-stone-700">
                              <input type="checkbox" onChange={() => scopeTextareaRef.current && toggleCurrentScopeLineActivity(scopeTextareaRef.current)} disabled={!isEditingProposalDocument} />
                              Actividad actual
                            </label>
                            <span>Enter: nuevo item · Tab: subitem · Shift+Tab: subir nivel · Ctrl+Espacio: actividad</span>
                          </div>
                          <textarea
                            ref={scopeTextareaRef}
                            value={draft.scope_outline}
                            onChange={(event) => patchDraft({ scope_outline: event.target.value })}
                            onKeyDown={handleScopeOutlineKeyDown}
                            className={`${textareaClassName("min-h-[158px]")} font-mono`}
                            disabled={!isEditingProposalDocument}
                          />
                        </div>
                        <aside className="rounded-lg border border-dashed border-stone-300 bg-white p-3 text-[11px] text-stone-600">
                          <div className="mb-1 font-bold text-stone-800">Modo de uso rapido</div>
                          <p>Escribe el alcance sin numerarlo; la app arma la numeracion automaticamente.</p>
                          <code className="mt-2 block rounded bg-stone-100 px-2 py-1">1 Titulo o grupo</code>
                          <code className="mt-1 block rounded bg-stone-100 px-2 py-1">1.1 Subtitulo o subgrupo</code>
                          <code className="mt-1 block rounded bg-stone-100 px-2 py-1">1.1.1 [A] Actividad</code>
                        </aside>
                      </div>
                      <div className="mt-3 max-h-[220px] overflow-y-auto rounded-lg border border-stone-200 bg-white p-2">
                        <div className="mb-2 text-[10px] font-black uppercase text-teal-800">Vista previa del arbol</div>
                        {parsedScopePreview.length ? (
                          parsedScopePreview.map((item) => (
                            <div key={`${item.number}-${item.title}`} className="flex items-center gap-2 py-1 text-[11px]" style={{ paddingLeft: `${item.level * 18}px` }}>
                              <span className="w-12 font-mono font-bold text-teal-700">{item.number}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${item.kind === "activity" ? "border-teal-200 bg-teal-50 text-teal-700" : "border-stone-200 bg-stone-50 text-stone-600"}`}>
                                {scopeKindLabel(item.kind)}
                              </span>
                              <span className="min-w-0 truncate text-stone-700">{item.title}</span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded border border-dashed border-stone-300 px-3 py-4 text-center text-stone-400">Empieza escribiendo el primer alcance.</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-stone-200 p-2">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <FieldLabelIcon icon="image" label="Imagenes generales de referencia" className="text-[11px] font-bold text-stone-700" />
                        <span className="text-[11px] text-stone-400">{draft.general_images.length} imagen(es)</span>
                      </div>
                      {renderImageEditor(draft.general_images, "general", null)}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className={sectionCardClassName(draft.field_mode, "d")}>
                <SectionHeader
                  title={`D. Alcances del servicio ${draft.scope_items.length} item(s)`}
                  icon="clipboard-list"
                  collapsed={false}
                  actions={
                    <>
                      <button type="button" onClick={() => generateStructureFromOutline()} className={smallButtonClassName("secondary")} disabled={!isEditingProposalDocument}>
                        Actualizar resumen
                      </button>
                      <button type="button" disabled={!isEditingProposalDocument || !selectedActionItem} onClick={() => selectedActionItem && outdentScopeItemById(selectedActionItem.id)} className={scopeGridActionButtonClassName()}>
                        ← Nivel -
                      </button>
                      <button type="button" disabled={!isEditingProposalDocument || !selectedActionItem} onClick={() => selectedActionItem && indentScopeItemById(selectedActionItem.id)} className={scopeGridActionButtonClassName()}>
                        → Nivel +
                      </button>
                      <button type="button" disabled={!isEditingProposalDocument || !selectedActionItem} onClick={() => selectedActionItem && moveScopeItemUpById(selectedActionItem.id)} className={scopeGridActionButtonClassName()}>
                        ↑
                      </button>
                      <button type="button" disabled={!isEditingProposalDocument || !selectedActionItem} onClick={() => selectedActionItem && moveScopeItemDownById(selectedActionItem.id)} className={scopeGridActionButtonClassName()}>
                        ↓
                      </button>
                      <button type="button" disabled={!isEditingProposalDocument || !selectedActionItem} onClick={() => selectedActionItem && duplicateScopeItem(selectedActionItem.id)} className={scopeGridActionButtonClassName()}>
                        ⧉
                      </button>
                      <button type="button" disabled={!isEditingProposalDocument || !selectedActionItem} onClick={() => selectedActionItem && deleteScopeItem(selectedActionItem.id)} className={scopeGridActionButtonClassName("danger")}>
                        🗑
                      </button>
                      <button type="button" onClick={() => addScopeItem("group", selectedActionItem?.id)} className={smallButtonClassName("secondary")} disabled={!isEditingProposalDocument}>
                        + Grupo
                      </button>
                      <button type="button" onClick={() => addScopeItem("subgroup", selectedActionItem?.id)} className={smallButtonClassName("secondary")} disabled={!isEditingProposalDocument}>
                        + Subgrupo
                      </button>
                      <button type="button" onClick={() => addScopeItem("activity", selectedActionItem?.id)} className={smallButtonClassName("primary")} disabled={!isEditingProposalDocument}>
                        + Actividad
                      </button>
                    </>
                  }
                />
                <div className="space-y-2 p-3">
                  <div className="overflow-hidden border border-stone-300 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] border-collapse text-[11px]">
                        <thead className="sticky top-0 z-10 bg-stone-200 text-left text-[10px] uppercase tracking-wide text-stone-600">
                          <tr>
                            <th className="w-[72px] border border-stone-300 px-1.5 py-1 font-bold">N°</th>
                            <th className="w-[118px] border border-stone-300 px-1.5 py-1 font-bold">Tipo</th>
                            <th className="border border-stone-300 px-1.5 py-1 font-bold">Titulo / alcance</th>
                            <th className="w-[86px] border border-stone-300 px-1.5 py-1 text-right font-bold">Tiempo</th>
                            <th className="w-[110px] border border-stone-300 px-1.5 py-1 font-bold">Unidad</th>
                            <th className="w-[80px] border border-stone-300 px-1.5 py-1 text-right font-bold">Rec.</th>
                            <th className="w-[80px] border border-stone-300 px-1.5 py-1 text-right font-bold">Img.</th>
                            <th className="w-[118px] border border-stone-300 px-1.5 py-1 font-bold">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draft.scope_items.map((item) => {
                            const isSelected = item.id === selectedScopeItem?.id;
                            const rowResources = draft.resources.filter((resource) => resource.scope_item_id === item.id).length;
                            const rowImages = draft.activity_images.filter((image) => image.scope_item_id === item.id).length;
                            return (
                              <tr
                                key={item.id}
                                onClick={() => setSelectedScopeItemId(item.id)}
                                className={scopeGridRowClassName(item, isSelected)}
                              >
                                <td className="border border-stone-200 bg-stone-50 px-1.5 py-0.5 align-middle">
                                  <span className="font-mono font-bold text-teal-700">{item.number}</span>
                                </td>
                                <td className="border border-stone-200 p-0 align-middle">
                                  <select
                                    value={item.kind}
                                    onChange={(event) => updateScopeItem(item.id, { kind: event.target.value as ScopeKind })}
                                    className={spreadsheetControlClassName(scopeKindCellClassName(item.kind))}
                                    disabled={!isEditingProposalDocument}
                                  >
                                    <option value="group">Grupo</option>
                                    <option value="subgroup">Subgrupo</option>
                                    <option value="activity">Actividad</option>
                                  </select>
                                </td>
                                <td className="border border-stone-200 p-0 align-middle">
                                  <input
                                    value={item.title}
                                    onChange={(event) => updateScopeItem(item.id, { title: event.target.value })}
                                    onKeyDown={(event) => {
                                      if (event.key !== "Enter") return;
                                      event.preventDefault();
                                      const index = draft.scope_items.findIndex((candidate) => candidate.id === item.id);
                                      const next = draft.scope_items[index + 1];
                                      if (next) setSelectedScopeItemId(next.id);
                                    }}
                                    className={spreadsheetControlClassName(item.kind === "activity" ? "" : "font-bold uppercase")}
                                    disabled={!isEditingProposalDocument}
                                  />
                                </td>
                                <td className="border border-stone-200 p-0 align-middle">
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.time_value}
                                    onChange={(event) => updateScopeItem(item.id, { time_value: toFiniteNumber(event.target.value) })}
                                    className={spreadsheetControlClassName("text-right tabular-nums")}
                                    disabled={!isEditingProposalDocument}
                                  />
                                </td>
                                <td className="border border-stone-200 p-0 align-middle">
                                  <select value={item.time_unit} onChange={(event) => updateScopeItem(item.id, { time_unit: event.target.value })} className={spreadsheetControlClassName()} disabled={!isEditingProposalDocument}>
                                    <option value="dias">dias</option>
                                    <option value="horas">horas</option>
                                    <option value="semanas">semanas</option>
                                  </select>
                                </td>
                                <td className="border border-stone-200 px-1.5 py-0.5 text-right align-middle tabular-nums">{item.kind === "activity" ? rowResources : "-"}</td>
                                <td className="border border-stone-200 px-1.5 py-0.5 text-right align-middle tabular-nums">{item.kind === "activity" ? rowImages : "-"}</td>
                                <td className="border border-stone-200 p-0 align-middle">
                                  {item.kind === "activity" ? (
                                    <select
                                      value={item.complete ? "complete" : "draft"}
                                      onChange={(event) => updateScopeItem(item.id, { complete: event.target.value === "complete" })}
                                      className={spreadsheetControlClassName(item.complete ? "font-semibold text-emerald-700" : "text-stone-700")}
                                      disabled={!isEditingProposalDocument}
                                    >
                                      <option value="draft">Borrador</option>
                                      <option value="complete">Completo</option>
                                    </select>
                                  ) : (
                                    <span className="px-1.5 text-stone-400">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selectedScopeItem ? (
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-2">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <FieldLabelIcon
                          icon={selectedScopeItem.kind === "activity" ? "clipboard-list" : "layout-grid"}
                          label={`Detalle seleccionado: ${selectedScopeItem.number} ${selectedScopeItem.title}`}
                          className="text-[11px] font-bold text-stone-700"
                        />
                        <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-stone-500">
                          {scopeKindLabel(selectedScopeItem.kind)}
                        </span>
                      </div>
                      {renderScopeItemEditor(selectedScopeItem)}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className={sectionCardClassName(draft.field_mode, "e")}>
                <SectionHeader title="E. Notas complementarias y condiciones comerciales" icon="receipt" collapsed={collapsedSections.e} onToggle={() => toggleSection("e")} />
                {!collapsedSections.e ? (
                  <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
                    {Object.entries(draft.conditions).map(([key, value]) => (
                      <Field key={key} label={key.replace(/_/g, " ")} className={key.includes("notas") || key.includes("incluye") || key.includes("cierre") ? "md:col-span-2" : ""}>
                        <textarea
                          value={String(value)}
                          onChange={(event) => patchNested("conditions", { [key]: event.target.value } as Partial<TechnicalProposalDraft["conditions"]>)}
                          className={textareaClassName("min-h-[52px]")}
                          disabled={!isEditingProposalDocument}
                        />
                      </Field>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="rounded-lg border border-stone-200 bg-stone-50 p-2">
                <div className="grid grid-cols-1 gap-2 text-[11px] md:grid-cols-3">
                  <div>
                    <span className="font-bold text-stone-600">Carpeta madre:</span> {draft.metadata.carpeta_madre}
                  </div>
                  <div>
                    <span className="font-bold text-stone-600">Subcarpeta:</span> {draft.metadata.subcarpeta_revision}
                  </div>
                  <div>
                    <span className="font-bold text-stone-600">Archivos:</span> {draft.metadata.archivo_docx} / {draft.metadata.archivo_pdf}
                  </div>
                </div>
                {statusMessage ? <div className="mt-2 rounded border border-teal-100 bg-teal-50 px-2 py-1 text-[11px] text-teal-700">{statusMessage}</div> : null}
              </section>
            </div>
          </main>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-stone-200 bg-stone-200">
            <div className="border-b border-stone-300 bg-stone-100 px-3 py-2">
              <h2 className="text-[14px] font-black text-stone-800">
                {rightPanelView === "document" ? "Vista previa A4" : rightPanelView === "selected_resource" ? "Recurso seleccionado" : "Recursos usados"}
              </h2>
              <p className="text-[11px] text-stone-500">
                {rightPanelView === "document"
                  ? "Vista preparada para exportacion futura Word/PDF."
                  : rightPanelView === "selected_resource"
                    ? "Ficha ejecutiva de solo lectura del recurso maestro."
                    : "Resumen de recursos usados y posibles repetidos en esta PT."}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {[
                  { key: "document" as const, label: "Documento A4" },
                  { key: "selected_resource" as const, label: "Recurso seleccionado" },
                  { key: "used_resources" as const, label: "Recursos usados" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setRightPanelView(tab.key)}
                    className={rightPanelView === tab.key ? smallButtonClassName("primary") : smallButtonClassName("secondary")}
                  >
                    {tab.label}
                  </button>
                ))}
                <button type="button" onClick={refreshPreview} className={smallButtonClassName("soft")}>
                  Actualizar vista previa
                </button>
                <button type="button" onClick={exportWordFromPreview} className={smallButtonClassName("secondary")}>
                  Exportar Word
                </button>
                <button type="button" onClick={exportHtmlFromPreview} className={smallButtonClassName("secondary")}>
                  Exportar HTML
                </button>
                <button type="button" onClick={exportJsonFromDraft} className={smallButtonClassName("secondary")}>
                  Exportar JSON
                </button>
                <button type="button" onClick={handlePrintPdf} disabled={printingReady} className={smallButtonClassName("primary")}>
                  Imprimir / PDF
                </button>
              </div>
            </div>
            {rightPanelView === "document" ? (
              <div className="min-h-0 overflow-auto p-4">
              <article
                key={previewRefreshKey}
                ref={previewDocumentRef}
                className="technical-proposal-a4-doc mx-auto min-h-[297mm] w-[210mm] bg-white px-[12mm] py-[10mm] text-stone-800 shadow-xl"
              >
                {renderDocHeader()}
                <div className="mt-6 grid grid-cols-[1fr_auto] gap-3 text-[10px]">
                  <div className="font-black">{draft.header.ciudad}, {formatDateForDocument(draft.header.fecha)}</div>
                  <div><span className="font-bold uppercase text-stone-500">Presupuesto</span> <strong>{draft.metadata.documento_codigo}</strong></div>
                </div>
                <div className="mt-5 text-[10px] leading-5">
                  <p className="font-black">Senores:</p>
                  <p className="font-black uppercase">{draft.recipient.cliente || cotizacion.cliente || "-"}</p>
                  <p><strong>Unidad de trabajo:</strong> {draft.recipient.unidad_trabajo || "-"}</p>
                  <p><strong>Area solicitante:</strong> {draft.recipient.area_solicitante || "-"}</p>
                  <p><strong>Atencion:</strong> {draft.recipient.atencion || "-"}</p>
                  <p className="mt-2">Presente.-</p>
                  <p className="mt-4">Estimados senores:</p>
                  <p className="whitespace-pre-line">{draft.presentation.texto}</p>
                </div>
                <h1 className="mt-6 text-center text-[17px] font-black uppercase text-stone-900">{draft.header.titulo}</h1>
                <div className="mt-2 text-center text-[10px] font-black uppercase text-stone-800">{draft.header.subtitulo}</div>
                <div className="mt-4 border-l-4 border-amber-600 bg-stone-50 px-3 py-2 text-[10px]">
                  <strong>REFERENCIA:</strong> {draft.presentation.referencia || "-"}
                </div>
                <div className="mt-4 border-l-4 border-teal-700 bg-teal-50/30 px-3 py-2">
                  <div className="text-[10px] font-black uppercase text-stone-800">Resumen de los alcances del servicio</div>
                  <div className="mt-2 space-y-1 text-[9px] leading-4">
                    {draft.scope_items.map((item) => (
                        <div key={item.id} className="grid grid-cols-[54px_1fr] gap-2" style={{ marginLeft: `${Math.min(item.level, 3) * 12}px` }}>
                          <span className="font-black tabular-nums">{item.number}.</span>
                          <span className={item.kind === "activity" ? "" : "font-bold uppercase"}>{item.title}</span>
                        </div>
                    ))}
                  </div>
                </div>
                {renderPreviewImages(draft.general_images)}

                <h2 className="mt-6 border-b border-amber-600 pb-1 text-[12px] font-black uppercase text-stone-900">I. Alcances del servicio</h2>
                <div className="mt-3 space-y-4">
                  {draft.scope_items.map((item) => {
                    if (item.kind !== "activity") {
                      return (
                        <div
                          key={item.id}
                          className="border-b border-stone-200 pb-1 text-[10px] font-black uppercase text-stone-900"
                          style={{ marginLeft: `${Math.min(item.level, 4) * 8}px` }}
                        >
                          {item.number}. {item.title}
                        </div>
                      );
                    }
                    const images = draft.activity_images.filter((image) => image.scope_item_id === item.id);
                    return (
                      <section
                        key={item.id}
                        className="border-l border-stone-200 pl-2 text-[9px] leading-4"
                        style={{ marginLeft: `${Math.min(item.level, 4) * 8}px` }}
                      >
                        <h3 className="border-b border-stone-200 pb-1 text-[10px] font-black text-stone-900">
                          {item.number}. {item.title}
                        </h3>
                        {item.description ? <p className="mt-1 whitespace-pre-line text-stone-700">{item.description}</p> : null}
                        {RESOURCE_CATEGORIES.map((category) => renderPreviewResourceTable(item, category))}
                        {renderPreviewImages(images)}
                        {showInternal && item.internal_comments ? (
                          <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] text-amber-800">
                            <strong>Comentario interno:</strong> {item.internal_comments}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
                <h2 className="mt-6 border-b border-amber-600 pb-1 text-[12px] font-black uppercase text-stone-900">
                  II. Notas complementarias y condiciones comerciales
                </h2>
                <div className="mt-3 text-[9px] leading-5">
                  <p className="whitespace-pre-line"><strong className="text-teal-800">Notas complementarias:</strong> {draft.conditions.notas_complementarias}</p>
                  <p className="whitespace-pre-line"><strong>Nuestro presupuesto no incluye:</strong> {draft.conditions.presupuesto_no_incluye}</p>
                  <p className="whitespace-pre-line"><strong>Nuestra propuesta sera reajustada si:</strong> {draft.conditions.propuesta_reajustada_si}</p>
                  <div className="mt-3 grid grid-cols-[130px_1fr] gap-y-1">
                    <strong>Plazo de entrega</strong><span className="whitespace-pre-line">{draft.conditions.plazo_entrega}</span>
                    <strong>Forma de pago</strong><span className="whitespace-pre-line">{draft.conditions.forma_pago}</span>
                    <strong>Validez de oferta</strong><span className="whitespace-pre-line">{draft.conditions.validez_oferta}</span>
                    <strong>Garantia</strong><span className="whitespace-pre-line">{draft.conditions.garantia}</span>
                    <strong>Lugar de entrega</strong><span className="whitespace-pre-line">{draft.conditions.lugar_entrega}</span>
                    <strong>Nota</strong><span className="whitespace-pre-line">{draft.conditions.nota_comercial}</span>
                  </div>
                  <p className="mt-5 whitespace-pre-line">{draft.conditions.cierre}</p>
                  <p className="mt-3 whitespace-pre-line"><strong>Atentamente,</strong><br />{draft.conditions.firma_area}<br />{draft.conditions.empresa_firma}</p>
                </div>
                <footer className="mt-8 flex items-center justify-between border-t border-amber-600 pt-2 text-[8px] text-stone-500">
                  <span>{draft.header.empresa_emisora} | Propuesta tecnica</span>
                  <span>Pagina 1 / preparado</span>
                </footer>
              </article>
              </div>
            ) : rightPanelView === "selected_resource" ? (
              <div className="min-h-0 overflow-auto p-4">
                <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(280px,0.9fr)_minmax(320px,1.1fr)]">
                  <TechnicalProposalResourceInspector
                    resource={displayedResource}
                    snapshot={displayedResourceSnapshot}
                    usage={displayedResource ? usedResourceLookup.get(displayedResource.id) : undefined}
                    permissions={resourceInspectorPermissions}
                  />
                  <TechnicalProposalUsedResourcesPanel
                    items={usedResourceItems}
                    selectedRowId={selectedResourceRowId}
                    onSelectResource={selectUsedResourceForDetail}
                    onReuseResource={reuseUsedResource}
                  />
                </div>
              </div>
            ) : (
              <div className="min-h-0 overflow-auto p-4">
                <TechnicalProposalUsedResourcesPanel
                  items={usedResourceItems}
                  selectedRowId={selectedResourceRowId}
                  onSelectResource={selectUsedResourceForDetail}
                  onReuseResource={reuseUsedResource}
                />
              </div>
            )}
          </aside>
        </div>

        <TechnicalProposalQuickEntryModal
          open={quickEntryOpen}
          scopeItems={draft.scope_items}
          recursos={recursos}
          defaultScopeItemId={selectedActivity?.id ?? draft.scope_items.find((item) => item.kind === "activity")?.id ?? ""}
          onClose={() => setQuickEntryOpen(false)}
          onApply={applyQuickEntry}
        />
      </div>
      </div>
    </>
  );
}
