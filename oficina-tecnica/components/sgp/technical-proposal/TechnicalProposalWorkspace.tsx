"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { FieldLabelIcon } from "@/components/sgp/ui/FieldLabelIcon";
import { ResourceAutocompleteInput } from "@/components/sgp/technical-proposal/ResourceAutocompleteInput";
import { TechnicalProposalResourceCatalogPanel } from "@/components/sgp/technical-proposal/TechnicalProposalResourceCatalogPanel";
import { TechnicalProposalTopbar } from "@/components/sgp/technical-proposal/TechnicalProposalTopbar";
import { TechnicalProposalUsedResourcesPanel, type UsedResourceItem } from "@/components/sgp/technical-proposal/TechnicalProposalUsedResourcesPanel";
import { ResourceFormModal } from "@/components/sgp/resources/ResourceFormModal";
import type {
  CatalogEstadoRecurso,
  CatalogMarca,
  CatalogMoneda,
  CatalogProveedor,
  CatalogTipoRecurso,
  CatalogUnidad,
  Cotizacion,
  Recurso,
  ResourceFileMeta,
} from "@/lib/sgp/demoData";
import type { AdjudicatedTechnicalProposalOption } from "@/lib/sgp/adjudicatedProjectsRepository";
import { listCatalogMap } from "@/lib/sgp/catalogsRepository";
import { findClientLogo, findDefaultCompanyLogo, readProposalLogos, type ProposalLogo } from "@/lib/sgp/proposalLogos";
import {
  createQuotationBudgetFromTechnicalProposal,
  getQuotationBudgetDetail,
  listQuotationBudgets,
  updateBudgetResource,
  type QuotationBudgetDetail,
} from "@/lib/sgp/quotationBudgetsRepository";
import { buildTechnicalProposalResourceTree, displayResourceCategory } from "@/lib/sgp/technicalProposalResourceUsage";
import { buildTechnicalProposalRpcPayload, validateTechnicalProposalRpcPayload } from "@/lib/sgp/technicalProposalMappers";
import {
  createRecurso,
  createResourceFileSignedUrl,
  getNextResourceDraftCode,
  RecursoWriteError,
  uploadResourceFile,
  type ResourceStorageFileCategory,
} from "@/lib/sgp/recursosRepository";
import {
  getTechnicalProposalByCotizacionRevision,
  listTechnicalProposalItems,
  listTechnicalProposalResources,
  saveFullTechnicalProposal,
} from "@/lib/sgp/technicalProposalsRepository";

type TechnicalProposalWorkspaceModalProps = {
  open: boolean;
  cotizacion: Cotizacion;
  recursos: Recurso[];
  technicalProposalOptions?: AdjudicatedTechnicalProposalOption[];
  canViewPrices?: boolean;
  canCreateResource?: boolean;
  canManageResourceDocuments?: boolean;
  canEditBudgetPrices?: boolean;
  onClose: () => void;
};

type TechnicalProposalMetadata = {
  cotizacion_codigo: string;
  documento_codigo: string;
  documento_tipo: "PT";
  revision: string;
  carpeta_madre: string;
  subcarpeta_revision: string;
  archivo_docx: string;
  archivo_pdf: string;
  estructura_documental_version: "cotizacion_drive_v2";
  propuesta_tecnica_id?: string | null;
};

type ScopeKind = "group" | "subgroup" | "activity";
type ProposalMode = "cliente" | "interno";
type ProposalWorkStatus = "Borrador" | "En proceso" | "Completado";
type RightPanelView = "margins" | "resources";
type ScopeContextMenuState = { x: number; y: number; scopeItemId: string | null };
type ResourceCategoryKey =
  | "mano_obra_directa"
  | "mano_obra_indirecta"
  | "materiales"
  | "consumibles"
  | "equipos_herramientas"
  | "subcontratos"
  | "gastos_generales"
  | "mano_obra"
  | "equipos"
  | "herramientas"
  | "vehiculos"
  | "transporte";

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

type ResourceFormCatalogs = {
  tipos: CatalogTipoRecurso[];
  unidades: CatalogUnidad[];
  marcas: CatalogMarca[];
  proveedores: CatalogProveedor[];
  monedas: CatalogMoneda[];
  estados: CatalogEstadoRecurso[];
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
const REVISION_FOLDER = "02_PROPUESTA";

const RESOURCE_CATEGORIES: Array<{ key: ResourceCategoryKey; label: string; shortLabel: string; hasTime: boolean }> = [
  { key: "mano_obra", label: "Mano de obra", shortLabel: "MO", hasTime: true },
  { key: "materiales", label: "Materiales", shortLabel: "MAT", hasTime: false },
  { key: "consumibles", label: "Consumibles", shortLabel: "CON", hasTime: false },
  { key: "equipos", label: "Equipos", shortLabel: "EQP", hasTime: true },
  { key: "herramientas", label: "Herramientas", shortLabel: "HER", hasTime: true },
  { key: "subcontratos", label: "Subcontratos", shortLabel: "SUB", hasTime: false },
  { key: "vehiculos", label: "Vehiculos", shortLabel: "VEH", hasTime: true },
  { key: "transporte", label: "Transporte", shortLabel: "TRA", hasTime: false },
  { key: "gastos_generales", label: "Gastos generales", shortLabel: "GG", hasTime: false },
];

const EMPTY_RESOURCE_FORM_CATALOGS: ResourceFormCatalogs = {
  tipos: [],
  unidades: [],
  marcas: [],
  proveedores: [],
  monedas: [],
  estados: [],
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeRevision(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (/^REV\d{2}$/.test(normalized)) return normalized;
  return REVISION;
}

function nextRevisionCode(currentRevision: string): string {
  const normalized = normalizeRevision(currentRevision);
  const numeric = Number(normalized.slice(3));
  return `REV${String(Number.isFinite(numeric) ? numeric + 1 : 1).padStart(2, "0")}`;
}

function revisionFolderFor(revision: string): string {
  const normalized = normalizeRevision(revision);
  return normalized === REVISION ? REVISION_FOLDER : `${REVISION_FOLDER}_${normalized}`;
}

function buildDocumentMetadata(codigoCotizacion: string, revision = REVISION): TechnicalProposalMetadata {
  const normalizedRevision = normalizeRevision(revision);
  const documentoCodigo = `${codigoCotizacion}-PT-${normalizedRevision}`;
  return {
    cotizacion_codigo: codigoCotizacion,
    documento_codigo: documentoCodigo,
    documento_tipo: "PT",
    revision: normalizedRevision,
    carpeta_madre: codigoCotizacion,
    subcarpeta_revision: revisionFolderFor(normalizedRevision),
    archivo_docx: `${documentoCodigo}.docx`,
    archivo_pdf: `${documentoCodigo}.pdf`,
    estructura_documental_version: "cotizacion_drive_v2",
  };
}

function buildStorageKey(codigoCotizacion: string, revision = REVISION): string {
  return `opsia:technical-proposal:draft:${codigoCotizacion}:${normalizeRevision(revision)}`;
}

function cloneDraftAsNewRevision(draft: TechnicalProposalDraft, cotizacion: Cotizacion, nextRevision: string): TechnicalProposalDraft {
  const scopeItemIdMap = new Map(draft.scope_items.map((item) => [item.id, uid("scope")]));
  const resourceIdMap = new Map(draft.resources.map((resource) => [resource.id, uid("ptr")]));
  const remapScopeItemId = (value: string | null): string | null => (value ? scopeItemIdMap.get(value) ?? null : null);
  const remapResourceId = (value: string | null): string | null => (value ? resourceIdMap.get(value) ?? null : null);

  const nextScopeItems = draft.scope_items.map((item) => ({
    ...item,
    id: scopeItemIdMap.get(item.id) ?? uid("scope"),
    collapsed: false,
  }));

  return {
    ...draft,
    metadata: buildDocumentMetadata(cotizacion.codigo, nextRevision),
    work_status: "Borrador",
    scope_items: nextScopeItems,
    scope_outline: scopeItemsToOutline(nextScopeItems),
    resources: draft.resources.map((resource) => ({
      ...resource,
      id: resourceIdMap.get(resource.id) ?? uid("ptr"),
      scope_item_id: remapScopeItemId(resource.scope_item_id) ?? resource.scope_item_id,
    })),
    general_images: draft.general_images.map((image) => ({
      ...image,
      id: uid("img"),
      resource_id: remapResourceId(image.resource_id),
    })),
    activity_images: draft.activity_images.map((image) => ({
      ...image,
      id: uid("img"),
      scope_item_id: remapScopeItemId(image.scope_item_id),
      resource_id: remapResourceId(image.resource_id),
    })),
    updated_at: new Date().toISOString(),
  };
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
  if (normalized.includes("mano de obra") || /\bmo[di]\b/.test(normalized)) return "mano_obra";
  if (normalized.includes("material")) return "materiales";
  if (normalized.includes("subcontr")) return "subcontratos";
  if (normalized.includes("vehiculo")) return "vehiculos";
  if (normalized.includes("transporte")) return "transporte";
  if (normalized.includes("gasto general") || normalized.includes("indirecto")) return "gastos_generales";
  if (normalized.includes("herramienta")) return "herramientas";
  if (normalized.includes("equipo")) return "equipos";
  return "consumibles";
}

function normalizeResourceCategoryKey(value: string | null | undefined, tipoRecurso = ""): ResourceCategoryKey {
  if (value === "mano_obra_directa" || value === "mano_obra_indirecta") return "mano_obra";
  if (value === "equipos_herramientas") return mapResourceCategory(tipoRecurso || "Equipos");
  if (
    value === "materiales" ||
    value === "consumibles" ||
    value === "equipos" ||
    value === "herramientas" ||
    value === "subcontratos" ||
    value === "gastos_generales" ||
    value === "mano_obra" ||
    value === "vehiculos" ||
    value === "transporte"
  ) {
    return value;
  }
  return mapResourceCategory(tipoRecurso);
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

function buildInitialDraft(cotizacion: Cotizacion, revision = REVISION): TechnicalProposalDraft {
  const metadata = buildDocumentMetadata(cotizacion.codigo, revision);
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

function normalizeLegacyDraft(
  parsed: Partial<TechnicalProposalDraft> & Record<string, unknown>,
  cotizacion: Cotizacion,
  revision = REVISION,
): TechnicalProposalDraft {
  const initial = buildInitialDraft(cotizacion, revision);
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
  const normalizedScopeItems =
    typeof parsed.scope_outline === "string" && parsed.scope_outline.trim()
      ? parsedLinesToScopeItems(parseScopeOutline(parsed.scope_outline), migratedItems)
      : migratedItems;
  const firstActivity = normalizedScopeItems.find((item) => item.kind === "activity") ?? normalizedScopeItems[0];

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
    scope_items: normalizedScopeItems,
    scope_outline: scopeItemsToOutline(normalizedScopeItems),
    resources: oldResources.map((resource) => {
      const legacyResource = resource as TechnicalProposalResourceSnapshot & { activity_id?: string };
      return {
        ...legacyResource,
        scope_item_id: legacyResource.scope_item_id || legacyResource.activity_id || firstActivity?.id || "scope-1",
        resource_category: normalizeResourceCategoryKey(legacyResource.resource_category, legacyResource.tipo_recurso),
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

function readStoredDraft(cotizacion: Cotizacion, revision = REVISION): TechnicalProposalDraft {
  const initial = buildInitialDraft(cotizacion, revision);
  if (typeof window === "undefined") return initial;

  try {
    const raw = window.localStorage.getItem(buildStorageKey(cotizacion.codigo, revision));
    if (!raw) return initial;
    return normalizeLegacyDraft(JSON.parse(raw) as Partial<TechnicalProposalDraft> & Record<string, unknown>, cotizacion, revision);
  } catch {
    return initial;
  }
}

async function readPersistedDraft(cotizacion: Cotizacion, revision: string): Promise<TechnicalProposalDraft | null> {
  const proposal = await getTechnicalProposalByCotizacionRevision(cotizacion.id, revision);
  if (!proposal) return null;

  const [items, resources] = await Promise.all([
    listTechnicalProposalItems(proposal.id),
    listTechnicalProposalResources(proposal.id),
  ]);
  const scopeItems = renumberScopeItems(
    items.map((item) => ({
      id: item.id,
      level: item.level,
      number: item.item_number,
      kind: item.item_type,
      title: item.title,
      description: item.technical_description ?? "",
      time_value: toFiniteNumber(item.estimated_time_value),
      time_unit: item.estimated_time_unit ?? "dias",
      complete: item.is_complete,
      collapsed: false,
      internal_comments: item.internal_comments ?? "",
    })),
  );

  const resourceRows: TechnicalProposalResourceSnapshot[] = resources.map((resource) => ({
    id: resource.id,
    scope_item_id: resource.technical_proposal_item_id,
    recurso_id: resource.resource_id,
    codigo_recurso: resource.codigo_recurso ?? "",
    codigo_fabricante: resource.codigo_fabricante ?? "",
    tipo_recurso: resource.tipo_recurso ?? "",
    resource_category: normalizeResourceCategoryKey(resource.resource_category, resource.tipo_recurso ?? ""),
    descripcion: resource.descripcion,
    unidad: resource.unidad ?? "",
    precio_unitario_ref: toFiniteNumber(resource.precio_unitario_ref),
    moneda: resource.moneda_codigo === "USD" ? "USD" : "PEN",
    proveedor: resource.proveedor ?? "",
    marca: resource.marca ?? "",
    cantidad: toFiniteNumber(resource.cantidad),
    tiempo: toFiniteNumber(resource.tiempo),
    comentario: resource.comentario ?? "",
    detalle_adicional: resource.detalle_adicional ?? "",
    estado_origen: resource.origin_status === "catalogo_copiado" ? "catalogo_copiado" : "nuevo_por_formalizar",
  }));

  const persistedPayload = {
    metadata: {
      ...buildDocumentMetadata(cotizacion.codigo, proposal.revision),
      propuesta_tecnica_id: proposal.id,
    },
    mode: proposal.mode,
    work_status: proposal.work_status,
    header: proposal.header,
    recipient: proposal.recipient,
    presentation: proposal.presentation,
    conditions: proposal.commercial_terms,
    scope_items: scopeItems.length ? scopeItems : defaultScopeItems(cotizacion.proyecto),
    scope_outline: scopeItemsToOutline(scopeItems.length ? scopeItems : defaultScopeItems(cotizacion.proyecto)),
    resources: resourceRows,
    general_images: [],
    activity_images: [],
    updated_at: proposal.updated_at,
  } as unknown as Partial<TechnicalProposalDraft> & Record<string, unknown>;

  return normalizeLegacyDraft(persistedPayload, cotizacion, proposal.revision);
}

function scopeLineHasActivity(line: string): boolean {
  return /\[(A|ACT|ACTIVIDAD)\]|^\s*(?:\d+(?:\.\d+)*\.?\s*)?[*✓√]/i.test(line);
}

function cleanScopeTitle(line: string): string {
  return line
    .replace(/^\s*\d+(?:\.\d+)*\.?\s*/, "")
    .replace(/\[(A|ACT|ACTIVIDAD)\]/gi, "")
    .replace(/^[*✓√]\s*/, "")
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
    .map((item) => `${"\t".repeat(item.level)}${item.kind === "activity" ? "* " : ""}${item.title}`)
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

function smallButtonClassName(variant: "primary" | "secondary" | "soft" | "danger" | "ghost" = "secondary"): string {
  const base = "inline-flex h-7 items-center justify-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold leading-none disabled:cursor-not-allowed disabled:opacity-45";
  if (variant === "primary") return `${base} border-teal-700 bg-teal-700 text-white hover:bg-teal-800`;
  if (variant === "soft") return `${base} border-stone-200 bg-stone-100 text-stone-700 hover:bg-stone-200`;
  if (variant === "danger") return `${base} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`;
  if (variant === "ghost") return `${base} border-transparent bg-transparent text-stone-500 hover:bg-stone-100`;
  return `${base} border-stone-200 bg-white text-stone-700 hover:bg-stone-100`;
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-[10px] font-bold uppercase tracking-wide text-stone-500 ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function emptyResourceFiles(): Recurso["resourceFiles"] {
  return {
    fichaTecnica: null,
    imagen: null,
    cotizacion: null,
    fichasTecnicas: [],
    imagenes: [],
    cotizaciones: [],
    archivos: [],
  };
}

function buildTechnicalProposalResourceDraft(code: string): Recurso {
  return {
    id: `rec-${uid("draft")}`,
    codigo_recurso: code,
    codigo_eka: "",
    codigo_fabricante: "",
    tipo_recurso: "",
    descripcion: "",
    unidad: "und",
    precio_unitario_ref: 0,
    moneda: "PEN",
    proveedor: "",
    marca: "",
    modelo: "",
    tiempo_entrega_ref: "",
    ficha_tecnica: "",
    imagen: "",
    archivos: "",
    estado: "Por revisar",
    fecha_actualizacion: todayIsoDate(),
    observaciones: "",
    resourceFiles: emptyResourceFiles(),
  };
}

function upsertResource(rows: Recurso[], resource: Recurso): Recurso[] {
  return rows.some((item) => item.id === resource.id)
    ? rows.map((item) => (item.id === resource.id ? resource : item))
    : [resource, ...rows];
}

function TechnicalProposalQuickEntryModal({
  open,
  scopeItems,
  recursos,
  defaultScopeItemId,
  canViewPrices,
  onClose,
  onApply,
}: {
  open: boolean;
  scopeItems: ScopeItem[];
  recursos: Recurso[];
  defaultScopeItemId: string;
  canViewPrices: boolean;
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
            <p className="text-[11px] text-stone-500">Filas temporales aplicadas como snapshot editable al item elegido.</p>
          </div>
          <button type="button" onClick={onClose} className={smallButtonClassName("ghost")}>
            Cerrar
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
            <Field label="Item destino">
              <select value={scopeItemId} onChange={(event) => setScopeItemId(event.target.value)} className={inputClassName()}>
                {scopeItems.map((item) => (
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
                        canViewPrices={canViewPrices}
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

export function TechnicalProposalWorkspaceModal({
  open,
  cotizacion,
  recursos,
  technicalProposalOptions = [],
  canViewPrices = true,
  canCreateResource = false,
  canManageResourceDocuments = false,
  canEditBudgetPrices = false,
  onClose,
}: TechnicalProposalWorkspaceModalProps) {
  const [selectedRevision, setSelectedRevision] = useState(REVISION);
  const [draft, setDraft] = useState<TechnicalProposalDraft>(() => buildInitialDraft(cotizacion));
  const [selectedScopeItemId, setSelectedScopeItemId] = useState("scope-2");
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingLocked, setEditingLocked] = useState(true);
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>(() => (canViewPrices ? "margins" : "resources"));
  const [createdResources, setCreatedResources] = useState<Recurso[]>([]);
  const [activeMasterResource, setActiveMasterResource] = useState<Recurso | null>(null);
  const [selectedResourceRowId, setSelectedResourceRowId] = useState<string | null>(null);
  const [activeResourceTargetRowId, setActiveResourceTargetRowId] = useState<string | null>(null);
  const [expandedEmptyDescriptionIds, setExpandedEmptyDescriptionIds] = useState<Set<string>>(() => new Set());
  const [cleanTableView, setCleanTableView] = useState(false);
  const [scopeContextMenu, setScopeContextMenu] = useState<ScopeContextMenuState | null>(null);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resourceDraft, setResourceDraft] = useState<Recurso | null>(null);
  const [savingResource, setSavingResource] = useState(false);
  const [resourceFormMessage, setResourceFormMessage] = useState<string | null>(null);
  const [proposalLogos, setProposalLogos] = useState<ProposalLogo[]>([]);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [printingReady, setPrintingReady] = useState(false);
  const [savingToSupabase, setSavingToSupabase] = useState(false);
  const [resourceCatalogs, setResourceCatalogs] = useState<ResourceFormCatalogs>(EMPTY_RESOURCE_FORM_CATALOGS);
  const [linkedBudgetDetail, setLinkedBudgetDetail] = useState<QuotationBudgetDetail | null>(null);
  const [budgetContextLoading, setBudgetContextLoading] = useState(false);
  const printInProgressRef = useRef(false);
  const previewDocumentRef = useRef<HTMLDivElement | null>(null);
  const scopeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scopeGutterRef = useRef<HTMLDivElement | null>(null);
  const resourceCatalog = useMemo(
    () => createdResources.reduce((rows, resource) => upsertResource(rows, resource), recursos),
    [createdResources, recursos],
  );
  const revisionOptions = useMemo(() => {
    const revisions = new Set<string>([REVISION, selectedRevision, draft.metadata.revision]);
    technicalProposalOptions.forEach((option) => revisions.add(normalizeRevision(option.revision)));
    return [...revisions].sort((left, right) => Number(left.slice(3)) - Number(right.slice(3)));
  }, [draft.metadata.revision, selectedRevision, technicalProposalOptions]);

  useEffect(() => {
    if (!open) return;
    const next = readStoredDraft(cotizacion, selectedRevision);
    let cancelled = false;
    setDraft(next);
    setSelectedScopeItemId(next.scope_items.find((item) => item.kind === "activity")?.id ?? next.scope_items[0]?.id ?? "scope-1");
    setStatusMessage(null);
    setEditingLocked(true);
    setRightPanelView(canViewPrices ? "margins" : "resources");
    setActiveMasterResource(null);
    setSelectedResourceRowId(null);
    setActiveResourceTargetRowId(null);
    setResourceModalOpen(false);
    setResourceDraft(null);
    setSavingResource(false);
    setResourceFormMessage(null);
    setProposalLogos(readProposalLogos());
    setPreviewRefreshKey((current) => current + 1);
    setSavingToSupabase(false);
    void readPersistedDraft(cotizacion, selectedRevision)
      .then((persistedDraft) => {
        if (cancelled || !persistedDraft) return;
        setDraft(persistedDraft);
        setSelectedScopeItemId(
          persistedDraft.scope_items.find((item) => item.kind === "activity")?.id ?? persistedDraft.scope_items[0]?.id ?? "scope-1",
        );
      })
      .catch(() => {
        if (!cancelled) setStatusMessage("No se pudo cargar la revision PT persistida; se muestra el borrador local.");
      });
    return () => {
      cancelled = true;
    };
  }, [canViewPrices, cotizacion, open, selectedRevision]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void listCatalogMap()
      .then((result) => {
        if (cancelled) return;
        setResourceCatalogs({
          tipos: (result.catalogs.catalogTipoRecurso ?? []) as CatalogTipoRecurso[],
          unidades: (result.catalogs.catalogUnidades ?? []) as CatalogUnidad[],
          marcas: (result.catalogs.catalogMarcas ?? []) as CatalogMarca[],
          proveedores: (result.catalogs.catalogProveedores ?? []) as CatalogProveedor[],
          monedas: (result.catalogs.catalogMonedas ?? []) as CatalogMoneda[],
          estados: (result.catalogs.catalogEstadosRecurso ?? []) as CatalogEstadoRecurso[],
        });
      })
      .catch(() => {
        if (!cancelled) setResourceCatalogs(EMPTY_RESOURCE_FORM_CATALOGS);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(buildStorageKey(cotizacion.codigo, draft.metadata.revision), JSON.stringify(draft));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [cotizacion.codigo, draft, open]);

  const parsedScopePreview = useMemo(() => renumberScopeItems(parsedLinesToScopeItems(parseScopeOutline(draft.scope_outline), draft.scope_items)), [
    draft.scope_items,
    draft.scope_outline,
  ]);
  const scopeGutterRows = useMemo(() => {
    let itemIndex = 0;
    return draft.scope_outline.split(/\r?\n/).map((line, lineIndex) => {
      if (!line.trim()) return { key: `blank-${lineIndex}`, label: "" };
      const item = parsedScopePreview[itemIndex++];
      return {
        key: item?.id ?? `scope-${lineIndex}`,
        label: item?.kind === "activity" ? "•" : item?.number ?? "",
      };
    });
  }, [draft.scope_outline, parsedScopePreview]);

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
      const itemNumber = activityNumberById.get(resource.scope_item_id);
      if (itemNumber && !current.activityNumbers.includes(itemNumber)) current.activityNumbers.push(itemNumber);
      lookup.set(resource.recurso_id, current);
    });
    return lookup;
  }, [activityNumberById, draft.resources]);
  const selectedResourceSnapshot = draft.resources.find((resource) => resource.id === selectedResourceRowId) ?? null;
  const selectedResourceMaster = selectedResourceSnapshot?.recurso_id ? resourceCatalog.find((resource) => resource.id === selectedResourceSnapshot.recurso_id) ?? null : null;
  const displayedResource = activeMasterResource ?? selectedResourceMaster;
  const usedResourceItems = useMemo<UsedResourceItem[]>(
    () =>
      draft.resources.map((resource) => {
        const activity = draft.scope_items.find((item) => item.id === resource.scope_item_id);
        return {
          rowId: resource.id,
          scopeItemId: resource.scope_item_id,
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
  const scopeItemsForResourceTree = useMemo(
    () => draft.scope_items.map((item) => ({ id: item.id, level: item.level, number: item.number, kind: item.kind, title: item.title })),
    [draft.scope_items],
  );
  const previewScopeTree = useMemo(
    () => buildTechnicalProposalResourceTree(scopeItemsForResourceTree, usedResourceItems),
    [scopeItemsForResourceTree, usedResourceItems],
  );
  const scopeNodeById = useMemo(() => {
    const result = new Map<string, (typeof previewScopeTree)[number]>();
    function visit(nodes: typeof previewScopeTree) {
      nodes.forEach((node) => {
        result.set(node.id, node);
        visit(node.children);
      });
    }
    visit(previewScopeTree);
    return result;
  }, [previewScopeTree]);
  const documentScopePages = useMemo(() => {
    const pages: string[][] = [];
    let current: string[] = [];
    let usedUnits = 0;
    const pageCapacity = 34;
    draft.scope_items.forEach((item) => {
      const resourceCount = draft.resources.filter((resource) => resource.scope_item_id === item.id).length;
      const imageCount = draft.activity_images.filter((image) => image.scope_item_id === item.id).length;
      const descriptionLines = Math.max(1, Math.ceil(item.description.length / 95));
      const estimatedUnits = (item.kind === "activity" ? 4 : 2) + descriptionLines + resourceCount * 2 + imageCount * 11;
      if (current.length > 0 && usedUnits + estimatedUnits > pageCapacity) {
        pages.push(current);
        current = [];
        usedUnits = 0;
      }
      current.push(item.id);
      usedUnits += estimatedUnits;
    });
    if (current.length > 0) pages.push(current);
    return pages.length > 0 ? pages : [[]];
  }, [draft.activity_images, draft.resources, draft.scope_items]);
  const technicalProposalId = draft.metadata.propuesta_tecnica_id ?? null;

  useEffect(() => {
    if (!open || !canViewPrices) {
      void Promise.resolve().then(() => {
        setLinkedBudgetDetail(null);
        setBudgetContextLoading(false);
      });
      return;
    }

    let cancelled = false;
    async function loadBudgetContext() {
      setBudgetContextLoading(true);
      try {
        let detail: QuotationBudgetDetail | null = null;
        if (technicalProposalId) {
          const budgets = await listQuotationBudgets(cotizacion.id);
          const linkedBudget = [...budgets]
            .filter((budget) => budget.propuestaTecnicaId === technicalProposalId)
            .sort((left, right) => right.revision - left.revision)[0];
          detail = linkedBudget ? await getQuotationBudgetDetail(linkedBudget.id) : null;
        }
        if (!cancelled) {
          setLinkedBudgetDetail(detail);
        }
      } catch (error) {
        if (!cancelled) {
          setLinkedBudgetDetail(null);
          setStatusMessage(error instanceof Error ? error.message : "No se pudo cargar economia de recursos usados.");
        }
      } finally {
        if (!cancelled) setBudgetContextLoading(false);
      }
    }

    void loadBudgetContext();
    return () => {
      cancelled = true;
    };
  }, [canViewPrices, cotizacion.id, open, technicalProposalId]);

  if (!open) return null;

  function setDraftWithTouch(updater: (prev: TechnicalProposalDraft) => TechnicalProposalDraft) {
    setDraft((prev) => ({ ...updater(prev), updated_at: new Date().toISOString() }));
    setStatusMessage(null);
  }

  function patchDraft(patch: Partial<TechnicalProposalDraft>) {
    setDraftWithTouch((prev) => ({ ...prev, ...patch }));
  }

  function handleRevisionChange(revision: string) {
    setSelectedRevision(normalizeRevision(revision));
  }

  function handleCreateNextRevision() {
    const highestRevision = revisionOptions.at(-1) ?? draft.metadata.revision;
    const nextRevision = nextRevisionCode(highestRevision);
    const nextDraft = cloneDraftAsNewRevision(draft, cotizacion, nextRevision);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(buildStorageKey(cotizacion.codigo, nextRevision), JSON.stringify(nextDraft));
    }
    setSelectedRevision(nextRevision);
    setDraft(nextDraft);
    setEditingLocked(false);
    setStatusMessage(`Nueva revision ${nextRevision} creada desde ${draft.metadata.revision}.`);
  }

  function patchNested<K extends keyof TechnicalProposalDraft>(key: K, patch: Partial<TechnicalProposalDraft[K]>) {
    setDraftWithTouch((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...patch } }));
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
    setStatusMessage("Documento actualizado desde los datos locales.");
  }

  function selectedResourceTargetItem(): ScopeItem | null {
    return selectedScopeItem ?? selectedActivity ?? draft.scope_items[0] ?? null;
  }

  function attachCatalogResourceToSelectedItem(resource: Recurso) {
    if (!isEditingProposalDocument) {
      setStatusMessage("Activa Editar para agregar recursos desde el catalogo.");
      return;
    }
    const target = selectedResourceTargetItem();
    if (!target) {
      setStatusMessage("No hay un item de alcance seleccionado para asociar el recurso.");
      return;
    }
    const snapshot = makeSnapshotFromResource(resource, target.id);
    setDraftWithTouch((prev) => ({ ...prev, resources: [...prev.resources, snapshot] }));
    setSelectedResourceRowId(snapshot.id);
    setActiveResourceTargetRowId(snapshot.id);
    setActiveMasterResource(resource);
    setRightPanelView("resources");
    setStatusMessage(`Recurso ${resource.codigo_recurso || resource.descripcion} agregado a ${target.number}.`);
  }

  function handleAddCatalogResource(resourceId: string) {
    const resource = resourceCatalog.find((item) => item.id === resourceId);
    if (!resource) {
      setStatusMessage("El recurso seleccionado ya no esta disponible en el catalogo cargado.");
      return;
    }
    attachCatalogResourceToSelectedItem(resource);
  }

  async function openCreateResourceFromTechnicalProposal() {
    if (!isEditingProposalDocument) {
      setStatusMessage("Activa Editar para crear recursos desde la propuesta tecnica.");
      return;
    }
    if (!canCreateResource) {
      setStatusMessage("No tienes permiso para crear recursos maestros.");
      return;
    }
    setResourceFormMessage("Calculando siguiente codigo de recurso...");
    try {
      const code = await getNextResourceDraftCode();
      setResourceDraft(buildTechnicalProposalResourceDraft(code));
      setResourceModalOpen(true);
      setResourceFormMessage(null);
    } catch (error) {
      setResourceFormMessage(null);
      setStatusMessage(error instanceof Error ? error.message : "No se pudo preparar el formulario de recurso.");
    }
  }

  async function saveCreatedResourceFromTechnicalProposal(value: Recurso) {
    if (!canCreateResource) {
      setResourceFormMessage("No tienes permiso para crear recursos maestros.");
      return;
    }
    setSavingResource(true);
    setResourceFormMessage(null);
    try {
      const savedResource = await createRecurso({
        ...value,
        estado: value.estado || "Por revisar",
        metadata: {
          origen_registro: "propuesta_tecnica",
          cotizacion_id: cotizacion.id,
          cotizacion_codigo: cotizacion.codigo,
          propuesta_tecnica_revision: draft.metadata.revision,
        },
      });
      setCreatedResources((prev) => upsertResource(prev, savedResource));
      setResourceModalOpen(false);
      setResourceDraft(null);
      attachCatalogResourceToSelectedItem(savedResource);
    } catch (error) {
      if (error instanceof RecursoWriteError) {
        setResourceFormMessage(error.code === "duplicate_code" ? "Codigo de recurso duplicado." : error.message);
      } else {
        setResourceFormMessage(error instanceof Error ? error.message : "No se pudo crear el recurso.");
      }
    } finally {
      setSavingResource(false);
    }
  }

  async function handleOpenResourceFile(file: ResourceFileMeta) {
    const url = await createResourceFileSignedUrl(file);
    if (!url) {
      throw new Error("El archivo no tiene una URL o ruta de Storage disponible.");
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleUploadResourceFile(
    resourceId: string,
    category: ResourceStorageFileCategory,
    file: File,
  ): Promise<ResourceFileMeta> {
    if (!canManageResourceDocuments || !canCreateResource) {
      throw new Error("No tienes permiso para gestionar archivos de recursos desde PT.");
    }
    if (!resourceId.trim()) throw new Error("Completa el codigo del recurso antes de subir archivos.");
    return uploadResourceFile(resourceId, category, file);
  }

  async function handleCreateBudgetFromTechnicalProposal() {
    if (!technicalProposalId) {
      setStatusMessage("Guarda la propuesta tecnica antes de crear el presupuesto asociado.");
      return;
    }
    if (!canViewPrices || !canEditBudgetPrices) {
      setStatusMessage("Crear presupuesto desde PT requiere permiso economico.");
      return;
    }
    setBudgetContextLoading(true);
    try {
      const budget = await createQuotationBudgetFromTechnicalProposal(technicalProposalId);
      const detail = await getQuotationBudgetDetail(budget.id);
      setLinkedBudgetDetail(detail);
      setStatusMessage("Presupuesto creado desde la propuesta tecnica.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo crear el presupuesto desde PT.");
    } finally {
      setBudgetContextLoading(false);
    }
  }

  async function handleApplyMarginByType(resourceType: string, percent: number) {
    if (!linkedBudgetDetail) {
      setStatusMessage("No hay presupuesto asociado a esta propuesta tecnica.");
      return;
    }
    if (!canViewPrices || !canEditBudgetPrices || linkedBudgetDetail.presupuesto.estado !== "BORRADOR") {
      setStatusMessage("La revision de precios requiere permiso economico y presupuesto BORRADOR.");
      return;
    }
    setBudgetContextLoading(true);
    try {
      const itemByRowId = new Map(draft.resources.map((resource) => [resource.id, resource]));
      const itemByMasterId = new Map(draft.resources.filter((resource) => resource.recurso_id).map((resource) => [resource.recurso_id as string, resource]));
      const targetRows = linkedBudgetDetail.recursos.filter((resource) => {
        const proposalResource = (resource.propuestaTecnicaRecursoId ? itemByRowId.get(resource.propuestaTecnicaRecursoId) : null)
          ?? itemByMasterId.get(resource.recursoId);
        if (!proposalResource) return false;
        const label = displayResourceCategory(
          resource.tipoRecursoSnapshot ?? resource.recurso?.tipoRecurso ?? proposalResource.tipo_recurso,
          proposalResource.resource_category,
        );
        return normalizeSearch(label) === normalizeSearch(resourceType);
      });
      await Promise.all(targetRows.map((resource) => updateBudgetResource(resource.id, {
        precioOfertadoUnitario: resource.precioBaseUnitario * (1 + percent / 100),
      })));
      const detail = await getQuotationBudgetDetail(linkedBudgetDetail.presupuesto.id);
      setLinkedBudgetDetail(detail);
      setStatusMessage(`Margen de ${resourceType} actualizado en el presupuesto.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo actualizar el margen del presupuesto.");
    } finally {
      setBudgetContextLoading(false);
    }
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
    const clonedScopeEditors = Array.from(clone.querySelectorAll<HTMLElement>(".scope-editor-main"));
    const clonedScopeHelp = Array.from(clone.querySelectorAll<HTMLElement>(".scope-editor-help"));
    const clonedScopePrintLists = Array.from(clone.querySelectorAll<HTMLElement>(".scope-print-list"));
    const clonedButtons = Array.from(clone.querySelectorAll<HTMLButtonElement>("button"));
    const printableButtons = new Set(clone.querySelectorAll<HTMLButtonElement>(".scope-print-list button,.resource-cell-readonly,.sheet-btn"));
    const clonedTableColumns = Array.from(clone.querySelectorAll<HTMLTableElement>(".doc-table")).map((table) => {
      const observationColumns = Array.from(table.querySelectorAll<HTMLElement>(".observation-column"));
      const hasObservationContent = observationColumns.some((column) =>
        Array.from(column.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea")).some((input) => input.value.trim()),
      );
      return {
        actionColumns: Array.from(table.querySelectorAll<HTMLElement>(".operational-column")),
        observationColumns,
        hasObservationContent,
      };
    });
    const sourceElements = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
    const cloneElements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
    sourceElements.forEach((sourceElement, index) => {
      const cloneElement = cloneElements[index];
      if (!cloneElement) return;
      if (sourceElement instanceof HTMLInputElement && cloneElement instanceof HTMLInputElement) {
        cloneElement.setAttribute("value", sourceElement.value);
      }
      if (sourceElement instanceof HTMLTextAreaElement && cloneElement instanceof HTMLTextAreaElement) {
        cloneElement.textContent = sourceElement.value;
      }
      const styles = window.getComputedStyle(sourceElement);
      cloneElement.removeAttribute("class");
      cloneElement.setAttribute(
        "style",
        Array.from(styles)
          .map((property) => `${property}:${styles.getPropertyValue(property)};`)
          .join(""),
      );
    });
    clonedButtons.forEach((button) => {
      if (!printableButtons.has(button)) {
        button.remove();
        return;
      }
      const text = document.createElement("span");
      text.textContent = button.textContent;
      text.setAttribute("style", button.getAttribute("style") ?? "");
      text.style.border = "0";
      text.style.background = "transparent";
      button.replaceWith(text);
    });
    clonedTableColumns.forEach(({ actionColumns, observationColumns, hasObservationContent }) => {
      actionColumns.forEach((column) => column.remove());
      if (!hasObservationContent) observationColumns.forEach((column) => column.remove());
    });
    clonedScopeEditors.forEach((element) => element.remove());
    clonedScopeHelp.forEach((element) => element.remove());
    clonedScopePrintLists.forEach((element) => {
      element.style.display = "block";
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
    .exported-proposal-document { box-sizing: border-box; display: block; margin: 0; width: 210mm; background: #fff; }
    .exported-proposal-document .doc-page { box-sizing: border-box; margin: 0; width: 210mm; height: 296.8mm; min-height: 296.8mm; max-height: 296.8mm; box-shadow: none !important; break-after: page; page-break-after: always; }
    .exported-proposal-document .doc-page:last-child { break-after: auto; page-break-after: auto; }
    table { border-collapse: collapse; }
    img { max-width: 100%; object-fit: contain; }
    @media print {
      .exported-proposal-document { margin: 0; width: 210mm; }
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
    syncScopeOutline(nextValue);
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
    const prefix = "\t".repeat(current.level);
    lines[lineIndex] = `${prefix}${current.kind === "activity" ? "* " : ""}${current.title}`;
    setScopeTextareaLines(textarea, scopeItemsToOutline(parsedLinesToScopeItems(parseScopeOutline(lines.join("\n")), draft.scope_items)).split("\n"), lineIndex);
  }

  function insertScopeLine(textarea: HTMLTextAreaElement) {
    const { lines, lineIndex } = currentLineInfo(textarea);
    const parsed = parseScopeOutline(lines[lineIndex] ?? "");
    const level = parsed[0]?.level ?? 0;
    lines.splice(lineIndex + 1, 0, `${"\t".repeat(level)}`);
    setScopeTextareaLines(textarea, lines, lineIndex + 1);
  }

  function toggleCurrentScopeLineActivity(textarea: HTMLTextAreaElement) {
    const { lines, lineIndex } = currentLineInfo(textarea);
    const line = lines[lineIndex] ?? "";
    const isActivity = scopeLineHasActivity(line);
    const title = cleanScopeTitle(line);
    const parsed = parseScopeOutline(line);
    const level = parsed[0]?.level ?? 0;
    lines[lineIndex] = `${"\t".repeat(level)}${isActivity ? "" : "* "}${title}`;
    setScopeTextareaLines(textarea, scopeItemsToOutline(parsedLinesToScopeItems(parseScopeOutline(lines.join("\n")), draft.scope_items)).split("\n"), lineIndex);
  }

  function addNewResource(scopeItemId: string, category: ResourceCategoryKey) {
    const nextResource = { ...makeNewFormalizationResource(scopeItemId, category), descripcion: "" };
    setDraftWithTouch((prev) => ({ ...prev, resources: [...prev.resources, nextResource] }));
    setSelectedResourceRowId(nextResource.id);
    setActiveResourceTargetRowId(nextResource.id);
    setActiveMasterResource(null);
    setRightPanelView("resources");
    setStatusMessage("Recurso agregado como nuevo por formalizar.");
  }

  function showScopeDescription(itemId: string) {
    setExpandedEmptyDescriptionIds((current) => new Set(current).add(itemId));
  }

  function removeScopeDescription(itemId: string) {
    updateScopeItem(itemId, { description: "" });
    setExpandedEmptyDescriptionIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  }

  function syncScopeOutline(value: string) {
    setDraftWithTouch((prev) => {
      const nextItems = parsedLinesToScopeItems(parseScopeOutline(value), prev.scope_items);
      return {
        ...prev,
        scope_outline: value,
        scope_items: nextItems.length ? nextItems : prev.scope_items,
      };
    });
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
      setActiveMasterResource(null);
    }
    if (activeResourceTargetRowId === resourceId) setActiveResourceTargetRowId(null);
  }

  function openScopeContextMenu(event: MouseEvent<HTMLElement>, scopeItemId: string | null) {
    event.preventDefault();
    event.stopPropagation();
    if (scopeItemId) setSelectedScopeItemId(scopeItemId);
    setScopeContextMenu({ x: event.clientX, y: event.clientY, scopeItemId });
  }

  function closeScopeContextMenu() {
    setScopeContextMenu(null);
  }

  function contextScopeItem(): ScopeItem | null {
    const targetId = scopeContextMenu?.scopeItemId ?? selectedScopeItemId;
    return draft.scope_items.find((item) => item.id === targetId) ?? null;
  }

  function runScopeContextAction(action: "group" | "subgroup" | "activity" | "outdent" | "indent" | "up" | "down" | "duplicate" | "delete") {
    const target = contextScopeItem();
    const targetId = target?.id;
    if (action === "group" || action === "subgroup" || action === "activity") addScopeItem(action, targetId);
    if (!targetId) {
      closeScopeContextMenu();
      return;
    }
    if (action === "outdent") outdentScopeItemById(targetId);
    if (action === "indent") indentScopeItemById(targetId);
    if (action === "up") moveScopeItemUpById(targetId);
    if (action === "down") moveScopeItemDownById(targetId);
    if (action === "duplicate") duplicateScopeItem(targetId);
    if (action === "delete") deleteScopeItem(targetId);
    closeScopeContextMenu();
  }

  function runScopeResourceContextAction(category: ResourceCategoryKey) {
    const target = contextScopeItem();
    if (!target) {
      closeScopeContextMenu();
      return;
    }
    addNewResource(target.id, category);
    closeScopeContextMenu();
  }

  function applyQuickEntry(scopeItemId: string, category: ResourceCategoryKey, rows: QuickEntryRow[]) {
    setDraftWithTouch((prev) => {
      const snapshots = rows
        .filter((row) => row.descripcion.trim() || row.recurso_id)
        .map((row) => {
          const resource = resourceCatalog.find((item) => item.id === row.recurso_id);
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

  function a4FieldClassName(extra = ""): string {
    return [
      "direct-edit w-full min-w-0 border-0 border-b border-transparent bg-transparent px-0.5 py-0.5 text-[9px] leading-4 text-stone-800 outline-none",
      "hover:border-stone-200 hover:bg-stone-50 focus:border-teal-600 focus:bg-white",
      "disabled:cursor-not-allowed disabled:text-stone-500",
      extra,
    ].join(" ");
  }

  function a4TextareaClassName(extra = ""): string {
    return [
      "direct-edit w-full min-w-0 resize-none border-0 bg-transparent px-0.5 py-0.5 text-[9px] leading-4 text-stone-700 outline-none",
      "hover:bg-stone-50 focus:bg-white focus:shadow-[inset_0_0_0_1px_#0f766e]",
      "disabled:cursor-not-allowed disabled:text-stone-500",
      extra,
    ].join(" ");
  }

  function renderA4CoverData(label: string, children: ReactNode) {
    return (
      <label className="cover-data-v66">
        <span>{label}</span>
        <strong>{children}</strong>
      </label>
    );
  }

  function renderA4MetaRow(label: string, children: ReactNode) {
    return (
      <label className="grid grid-cols-[96px_1fr] items-start gap-2 text-[9px] leading-4">
        <span className="font-black text-stone-700">{label}</span>
        {children}
      </label>
    );
  }

  function applyMasterResourceToSnapshot(resourceId: string, selectedResource: Recurso) {
    setSelectedResourceRowId(resourceId);
    setActiveResourceTargetRowId(resourceId);
    setActiveMasterResource(selectedResource);
    setRightPanelView("resources");
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
  }

  function focusResourceSnapshot(resource: TechnicalProposalResourceSnapshot, view: RightPanelView = "resources") {
    setSelectedResourceRowId(resource.id);
    setActiveResourceTargetRowId(resource.id);
    setActiveMasterResource(resource.recurso_id ? resourceCatalog.find((item) => item.id === resource.recurso_id) ?? null : null);
    setRightPanelView(view);
  }

  function renderA4ResourceRow(
    resource: TechnicalProposalResourceSnapshot,
    index: number,
    category: (typeof RESOURCE_CATEGORIES)[number],
    item: ScopeItem,
    rowCount: number,
    showObservations: boolean,
    showActions: boolean,
  ) {
    const selected = selectedResourceRowId === resource.id;
    const resourceNumber = `${index + 1}`;
    const isLabor = category.key.includes("mano_obra");
    const isFirstLaborRow = isLabor && index === 0;
    return (
      <tr key={resource.id} className={`mo-subrow ${selected ? "bg-teal-50/70" : "bg-white"}`}>
        {isLabor ? (
          isFirstLaborRow ? (
            <>
              <td rowSpan={rowCount} className="mo-group-cell border border-stone-200 px-1.5 py-1 text-center text-[8px] font-bold tabular-nums text-teal-800">
                {item.number}
              </td>
              <td rowSpan={rowCount} className="mo-group-cell mo-activity-cell border border-stone-200 p-0">
                <textarea
                  value={item.title}
                  onChange={(event) => updateScopeItem(item.id, { title: event.target.value })}
                  className={a4TextareaClassName("min-h-[30px] px-1.5 py-1 text-[8px] font-semibold leading-4")}
                  placeholder="Actividad / tarea"
                  disabled={!isEditingProposalDocument}
                />
              </td>
            </>
          ) : null
        ) : (
          <td className="border border-stone-200 px-1.5 py-1 text-center text-[8px] font-bold tabular-nums text-teal-800">{resourceNumber}</td>
        )}
        <td className="border border-stone-200 p-0">
          {isEditingProposalDocument ? (
            <ResourceAutocompleteInput
              value={resource.descripcion}
              resources={resourceCatalog}
              usedResourceLookup={usedResourceLookup}
              canViewPrices={canViewPrices}
              autoFocus={false}
              className={a4FieldClassName("h-7 bg-white")}
              placeholder={isLabor ? "Buscar tecnico, supervisor..." : "Escriba para buscar..."}
              onTextChange={(value) =>
                updateResource(resource.id, {
                  descripcion: value,
                  recurso_id: null,
                  codigo_recurso: "",
                  codigo_fabricante: "",
                  estado_origen: "nuevo_por_formalizar",
                })
              }
              onSelect={(selectedResource) => applyMasterResourceToSnapshot(resource.id, selectedResource)}
              onActiveResource={setActiveMasterResource}
            />
          ) : (
            <button
              type="button"
              onClick={() => focusResourceSnapshot(resource, "resources")}
              className="resource-cell-readonly block h-7 w-full truncate px-1.5 text-left text-[8px] text-stone-800"
              title={resource.descripcion}
            >
              {resource.descripcion || "Buscar o escribir recurso"}
            </button>
          )}
        </td>
        <td className="border border-stone-200 p-0">
          <input
            type="number"
            min={0}
            value={resource.cantidad}
            onChange={(event) => updateResource(resource.id, { cantidad: toFiniteNumber(event.target.value) })}
            className={a4FieldClassName("h-7 text-right tabular-nums")}
            disabled={!isEditingProposalDocument}
          />
        </td>
        <td className="border border-stone-200 p-0">
          <input
            value={resource.unidad}
            onChange={(event) => updateResource(resource.id, { unidad: event.target.value })}
            className={a4FieldClassName("h-7 text-center")}
            disabled={!isEditingProposalDocument}
          />
        </td>
        {category.hasTime ? (
          <td className="observation-column border border-stone-200 p-0">
            <input
              type="number"
              min={0}
              value={resource.tiempo}
              onChange={(event) => updateResource(resource.id, { tiempo: toFiniteNumber(event.target.value) })}
              className={a4FieldClassName("h-7 text-right tabular-nums")}
              disabled={!isEditingProposalDocument}
            />
          </td>
        ) : null}
        {isLabor ? <td className="border border-stone-200 px-1 py-1 text-center text-[8px] text-stone-400" title="Sin campo persistente en el modelo PT">-</td> : null}
        {!isLabor ? (
          <td className="border border-stone-200 px-1 py-1 text-center text-[8px]">
            {resource.recurso_id ? (
              <button type="button" onClick={() => focusResourceSnapshot(resource, "resources")} className="sheet-btn">
                Ver ficha
              </button>
            ) : (
              <span className="text-stone-400">Pendiente</span>
            )}
          </td>
        ) : null}
        {showObservations ? (
          <td className="border border-stone-200 p-0">
            <input
              value={resource.comentario || resource.detalle_adicional}
              onChange={(event) => updateResource(resource.id, { comentario: event.target.value, detalle_adicional: "" })}
              className={a4FieldClassName("h-7")}
              placeholder="Observacion"
              disabled={!isEditingProposalDocument}
            />
          </td>
        ) : null}
        {showActions ? (
          <td className="operational-column border border-stone-200 px-1 py-1 text-center">
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => addNewResource(item.id, category.key)}
                className="resource-row-action"
                title={isLabor ? "Agregar otro recurso a la actividad" : "Agregar otra fila"}
                disabled={!isEditingProposalDocument}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => deleteResource(resource.id)}
                className="resource-row-action delete"
                title="Eliminar fila"
                disabled={!isEditingProposalDocument}
              >
                x
              </button>
            </div>
          </td>
        ) : null}
      </tr>
    );
  }

  function renderA4ResourceTable(item: ScopeItem, category: (typeof RESOURCE_CATEGORIES)[number], blockIndex: number) {
    const rows = resourceRowsFor(item.id, draft.resources, category.key);
    if (!rows.length) return null;
    const isLabor = category.key.includes("mano_obra");
    const blockNumber = `${item.number}.${blockIndex + 1}`;
    const hasObservations = rows.some((resource) => Boolean((resource.comentario || resource.detalle_adicional).trim()));
    const showObservations = !cleanTableView && ((isEditingProposalDocument && !printingReady) || hasObservations);
    const showActions = isEditingProposalDocument && !printingReady && !cleanTableView;
    return (
      <div key={category.key} className="resource-block mt-2 break-inside-avoid">
        <div className="resource-title uppercase">
          {blockNumber} {category.label}
        </div>
        <div className="overflow-visible">
          <table className={`doc-table w-full table-fixed border-collapse text-[8px] ${category.key.includes("mano_obra") ? "mo-table" : ""}`}>
            <colgroup>
              <col className="w-[8mm]" />
              {isLabor ? <col className="w-[34mm]" /> : null}
              <col />
              <col className="w-[13mm]" />
              <col className="w-[13mm]" />
              {category.hasTime ? <col className="w-[15mm]" /> : null}
              {isLabor ? <col className="w-[17mm]" /> : null}
              {!isLabor ? <col className="w-[18mm]" /> : null}
              {showObservations ? <col className="w-[28mm]" /> : null}
              {showActions ? <col className="w-[12mm]" /> : null}
            </colgroup>
            <thead>
              <tr>
                <th className="border border-stone-200 px-1 py-1">Item</th>
                {isLabor ? <th className="border border-stone-200 px-1 py-1">Actividad</th> : null}
                <th className="border border-stone-200 px-1 py-1">{isLabor ? "Recurso" : "Descripcion / recurso"}</th>
                <th className="border border-stone-200 px-1 py-1">Cant.</th>
                <th className="border border-stone-200 px-1 py-1">UM</th>
                {category.hasTime ? <th className="border border-stone-200 px-1 py-1">Tiempo</th> : null}
                {isLabor ? <th className="border border-stone-200 px-1 py-1">Particip.</th> : null}
                {!isLabor ? <th className="border border-stone-200 px-1 py-1">Ficha</th> : null}
                {showObservations ? <th className="observation-column border border-stone-200 px-1 py-1">Observ.</th> : null}
                {showActions ? <th className="operational-column border border-stone-200 px-1 py-1">Acc.</th> : null}
              </tr>
            </thead>
            <tbody>{rows.map((resource, index) => renderA4ResourceRow(resource, index, category, item, rows.length, showObservations, showActions))}</tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderA4EditableScopeNode(node: (typeof previewScopeTree)[number], depth = 0, includeChildren = true): ReactNode {
    const item = draft.scope_items.find((scopeItem) => scopeItem.id === node.id);
    if (!item) return null;

    const activityImages = draft.activity_images.filter((image) => image.scope_item_id === item.id);
    const isSelected = selectedScopeItemId === item.id;
    const visibleResourceCategories = RESOURCE_CATEGORIES.filter((category) => resourceRowsFor(item.id, draft.resources, category.key).length > 0);
    const resourceTables = visibleResourceCategories.map((category, index) => renderA4ResourceTable(item, category, index));
    const titleClassName =
      item.kind === "group"
        ? "a4-section-title text-[11px] font-black uppercase text-stone-900"
        : item.kind === "subgroup"
          ? "a4-subheading text-[10px] font-black uppercase text-stone-800"
          : "a4-activity-title text-[9.5px] font-black text-stone-900";
    const descriptionPlaceholder =
      item.kind === "activity"
        ? "Descripcion tecnica de la actividad"
        : item.kind === "subgroup"
          ? "Descripcion breve del subtitulo"
          : "Descripcion del alcance general";
    const descriptionVisible = Boolean(item.description.trim()) || (isEditingProposalDocument && !printingReady && expandedEmptyDescriptionIds.has(item.id));
    const selectedForEditing = isSelected && isEditingProposalDocument && !printingReady;

    return (
      <section
        key={item.id}
        data-scope-id={item.id}
        onClick={() => {
          setSelectedScopeItemId(item.id);
          closeScopeContextMenu();
        }}
        onContextMenu={(event) => openScopeContextMenu(event, item.id)}
        className={`a4-scope-block group/scope relative break-inside-avoid ${selectedForEditing ? "a4-scope-selected" : ""} ${item.kind === "group" ? "mt-5" : item.kind === "subgroup" ? "mt-3" : "mt-2"}`}
        style={{ marginLeft: `${Math.min(depth, 4) * 5}mm` }}
      >
        <button
          type="button"
          onClick={(event) => openScopeContextMenu(event, item.id)}
          className="a4-block-handle"
          disabled={!isEditingProposalDocument}
          title="Acciones del bloque"
        >
          ...
        </button>

        <div className="a4-scope-heading">
          <span className="a4-scope-number">{item.number}.</span>
          <div className="a4-scope-content">
            <input
              value={item.title}
              onChange={(event) => updateScopeItem(item.id, { title: event.target.value })}
              className={a4FieldClassName(titleClassName)}
              disabled={!isEditingProposalDocument}
            />
            {descriptionVisible ? (
              <div className="a4-description-row group/description">
                <textarea
                  value={item.description}
                  onFocus={() => showScopeDescription(item.id)}
                  onChange={(event) => updateScopeItem(item.id, { description: event.target.value })}
                  className={a4TextareaClassName("a4-para min-h-[28px] text-[9px] leading-4")}
                  placeholder={descriptionPlaceholder}
                  disabled={!isEditingProposalDocument}
                />
                {isEditingProposalDocument ? (
                  <button
                    type="button"
                    onClick={() => removeScopeDescription(item.id)}
                    className="a4-description-remove"
                    title="Quitar descripcion"
                    aria-label="Quitar descripcion"
                  >
                    x
                  </button>
                ) : null}
              </div>
            ) : isEditingProposalDocument ? (
              <button type="button" onClick={() => showScopeDescription(item.id)} className="a4-description-add">
                + Agregar descripcion
              </button>
            ) : null}
          </div>
        </div>

        {!item.collapsed ? (
          <div className="mt-1 space-y-2">
            {resourceTables.length > 0 ? <div className="a4-resource-stack space-y-2">{resourceTables}</div> : null}

            {item.kind === "activity" ? (
              <div className="image-gallery border border-stone-200 bg-stone-50 p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <FieldLabelIcon icon="image" label="Imagenes tecnicas" className="text-[9px] font-black uppercase text-stone-700" />
                </div>
                {renderImageEditor(activityImages, "activity", item.id)}
              </div>
            ) : null}

            {showInternal ? (
              <label className="a4-internal-note grid gap-1 p-2 text-[8px] font-bold uppercase text-stone-600">
                Comentarios internos
                <textarea
                  value={item.internal_comments}
                  onChange={(event) => updateScopeItem(item.id, { internal_comments: event.target.value })}
                  className={a4TextareaClassName("min-h-[42px]")}
                  disabled={!isEditingProposalDocument}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {includeChildren && node.children.length > 0 ? <div className="mt-2 space-y-2">{node.children.map((child) => renderA4EditableScopeNode(child, depth + 1, true))}</div> : null}
      </section>
    );
  }

  function renderDocHeader() {
    return (
      <div className="doc-header">
        <div className="doc-brand-left">
          <div>
            <div className="doc-logo">
          {companyLogo?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${companyLogo.id}-${companyLogo.updated_at}-${previewRefreshKey}`}
              src={companyLogo.logo_url}
              alt={companyLogo.display_name || companyLogo.entity_name || "Logo EKA"}
              className="border-0 bg-transparent p-0 shadow-none outline-none ring-0"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full border border-stone-300 bg-stone-50 text-[22px] font-black text-stone-700">
              EKA
            </div>
          )}
            </div>
            <div className="doc-format-line">{draft.header.empresa_emisora}</div>
          </div>
        </div>
        <div className="doc-format">
          <div className="doc-format-kicker">FORMATO</div>
          <div className="doc-format-line">GESTION DE PROYECTOS</div>
          <div className="doc-format-title">PROPUESTA TECNICA</div>
        </div>
        <div className="doc-client-right">
          <div>
            <div className="doc-client-logo">
          {clientLogo?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${clientLogo.id}-${clientLogo.updated_at}-${previewRefreshKey}`}
              src={clientLogo.logo_url}
              alt={clientLogo.display_name || clientLogo.entity_name || "Logo cliente"}
              className="border-0 bg-transparent p-0 shadow-none outline-none ring-0"
            />
          ) : (
            draft.header.cliente_logo_label || "Cliente"
          )}
            </div>
            <div className="doc-format-line">{draft.recipient.cliente || cotizacion.cliente || "CLIENTE"}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        .pt-promanager {
          --navy: #17243a;
          --navy2: #2e405d;
          --gold: #4b5567;
          --teal: #0f766e;
          --bg: #e4e7eb;
          --paper: #ffffff;
          --line: #d7e0ea;
          --line2: #edf1f5;
          --text: #202a36;
          --muted: #69778a;
          --danger: #b42318;
          --success: #166534;
          --font: Arial, sans-serif;
        }

        .technical-proposal-a4-editor.doc-page {
          box-sizing: border-box;
          width: 210mm;
          min-width: 210mm;
          max-width: 210mm;
          height: 296.8mm;
          min-height: 296.8mm;
          max-height: 296.8mm;
          background: var(--paper);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14);
          position: relative;
          padding: 10mm 12mm 8mm;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          font-family: var(--font);
          color: var(--text);
        }

        .technical-proposal-a4-editor.cover-page-v66 {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          height: 296.8mm;
          min-height: 296.8mm;
          max-height: 296.8mm;
          padding: 14mm 17mm 12mm;
          background: #ffffff;
          overflow: hidden;
        }

        .technical-proposal-a4-editor .cover-main-v66 {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .technical-proposal-a4-editor .cover-client-mark-v66 {
          position: absolute;
          top: 14mm;
          right: 17mm;
          width: 34mm;
          height: 18mm;
          display: grid;
          place-items: center;
        }

        .technical-proposal-a4-editor .cover-client-mark-v66 img {
          max-width: 31mm;
          max-height: 15mm;
          object-fit: contain;
          object-position: center;
        }

        .technical-proposal-a4-editor .cover-eka-logo-v66 {
          width: 41mm;
          height: 41mm;
          margin-top: 14mm;
          display: grid;
          place-items: center;
        }

        .technical-proposal-a4-editor .cover-eka-logo-v66 img {
          display: block;
          width: 38mm;
          height: 38mm;
          object-fit: contain;
        }

        .technical-proposal-a4-editor .cover-company-v66 {
          width: 90mm;
          margin-top: 3mm;
          color: #314258;
          font-size: 8.2pt;
          font-weight: 700;
          letter-spacing: 0.085em;
          text-align: center;
          text-transform: uppercase;
        }

        .technical-proposal-a4-editor .cover-rule-v66 {
          width: 38mm;
          height: 1.2px;
          margin: 6mm 0 7mm;
          background: #46556a;
        }

        .technical-proposal-a4-editor .cover-doc-type-v66 {
          color: #17243a;
          font-size: 18pt;
          line-height: 1.08;
          font-weight: 700;
          letter-spacing: 0.025em;
          text-align: center;
        }

        .technical-proposal-a4-editor .cover-service-v66 {
          width: 148mm;
          max-width: 148mm;
          margin-top: 4.5mm;
          min-height: 9mm;
          color: #17243a;
          font-size: 12.5pt;
          line-height: 1.28;
          font-weight: 700;
          letter-spacing: 0.005em;
          text-transform: uppercase;
          text-align: center;
        }

        .technical-proposal-a4-editor .cover-service-detail-v66 {
          width: 148mm;
          max-width: 148mm;
          min-height: 8mm;
          margin-top: 1mm;
          color: #46556a;
          font-size: 9pt;
          line-height: 1.3;
          font-weight: 600;
          text-align: center;
          text-transform: uppercase;
        }

        .technical-proposal-a4-editor .cover-data-grid-v66 {
          width: 145mm;
          margin-top: 15mm;
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 15mm;
          row-gap: 6mm;
        }

        .technical-proposal-a4-editor .cover-data-v66 {
          min-width: 0;
          display: grid;
          gap: 1.1mm;
          padding-bottom: 1.8mm;
          border-bottom: 1px solid #d8e0e9;
        }

        .technical-proposal-a4-editor .cover-data-v66 > span {
          color: #6a7789;
          font-size: 7pt;
          font-weight: 700;
          text-transform: uppercase;
        }

        .technical-proposal-a4-editor .cover-data-v66 > strong {
          min-width: 0;
          color: #24364d;
          font-size: 9.1pt;
          line-height: 1.3;
          font-weight: 700;
        }

        .technical-proposal-a4-editor .cover-scope-v66 {
          width: 145mm;
          margin-top: 14mm;
          border: 1px solid #dce3eb;
          border-left: 3px solid #46556a;
          background: #fbfcfd;
          padding: 4.2mm 5mm 4.6mm;
        }

        .technical-proposal-a4-editor .cover-scope-title-v66 {
          margin-bottom: 2mm;
          color: #435269;
          font-size: 7.4pt;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .technical-proposal-a4-editor .cover-scope-text-v66 {
          min-height: 23mm;
          max-height: 52mm;
          color: #25364a;
          font-size: 8.9pt;
          line-height: 1.52;
          text-align: justify;
          white-space: pre-wrap;
        }

        .technical-proposal-a4-editor .cover-bottom-v66 {
          margin-top: auto;
          width: 100%;
          padding-top: 4mm;
          border-top: 1.2px solid #46556a;
          display: flex;
          justify-content: space-between;
          gap: 12mm;
          color: #69778a;
          font-size: 7.2pt;
        }

        .technical-proposal-a4-editor .doc-header {
          display: grid;
          grid-template-columns: 38mm 1fr 38mm;
          gap: 6mm;
          align-items: center;
          padding-bottom: 4.3mm;
          border-bottom: 1.7px solid var(--gold);
          margin-bottom: 4.8mm;
          min-height: 28mm;
        }

        .technical-proposal-a4-editor .doc-brand-left,
        .technical-proposal-a4-editor .doc-client-right {
          height: 24mm;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          text-align: center;
        }

        .technical-proposal-a4-editor .doc-logo {
          width: 34mm;
          height: 23mm;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          padding: 0;
        }

        .technical-proposal-a4-editor .doc-logo img,
        .technical-proposal-a4-editor .doc-client-logo img {
          display: block;
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
          object-position: center center;
          margin: auto;
        }

        .technical-proposal-a4-editor .doc-client-logo {
          width: 32mm;
          height: 22mm;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: auto;
          color: #9aa7b7;
          border: 1px dashed #d5dde8;
          border-radius: 2mm;
          font-size: 7pt;
          font-weight: 750;
          text-transform: uppercase;
          line-height: 1.2;
          padding: 2mm;
        }

        .technical-proposal-a4-editor .doc-format {
          text-align: center;
          align-self: center;
        }

        .technical-proposal-a4-editor .doc-format-kicker {
          font-size: 7.2pt;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 850;
          letter-spacing: 0.055em;
        }

        .technical-proposal-a4-editor .doc-format-line {
          font-size: 8.4pt;
          color: var(--navy);
          font-weight: 800;
          margin-top: 0.8mm;
        }

        .technical-proposal-a4-editor .doc-format-title {
          font-size: 11.2pt;
          color: #0f172a;
          font-weight: 900;
          margin-top: 1mm;
          text-transform: uppercase;
          letter-spacing: 0.015em;
        }

        .technical-proposal-a4-editor .doc-body {
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
          font-size: 9pt;
          line-height: 1.47;
        }

        .technical-proposal-a4-editor .doc-footer {
          flex: 0 0 auto;
          margin-top: 2.5mm;
          padding-top: 1.8mm;
          border-top: 1.4px solid var(--gold);
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          color: #617087;
          font-size: 7.2pt;
        }

        .technical-proposal-a4-editor .first-meta {
          display: flex;
          justify-content: space-between;
          gap: 8mm;
          margin-bottom: 4.5mm;
          font-size: 8.7pt;
        }

        .technical-proposal-a4-editor .first-meta .budget {
          text-align: right;
          min-width: 75mm;
        }

        .technical-proposal-a4-editor .meta-label {
          color: #607087;
          text-transform: uppercase;
          font-size: 7pt;
          font-weight: 850;
          letter-spacing: 0.035em;
          margin-right: 1.5mm;
        }

        .technical-proposal-a4-editor .recipient {
          margin: 0 0 5mm;
          font-size: 8.8pt;
          line-height: 1.45;
        }

        .technical-proposal-a4-editor .title-box {
          text-align: center;
          margin: 4.5mm 0 5mm;
        }

        .technical-proposal-a4-editor .title-box h1 {
          font-size: 13.1pt;
          margin: 0;
          color: #0f172a;
          font-weight: 900;
          letter-spacing: 0.025em;
          text-transform: uppercase;
        }

        .technical-proposal-a4-editor .title-box .service {
          font-size: 9.1pt;
          margin-top: 2.6mm;
          color: #1e293b;
          font-weight: 800;
          text-transform: uppercase;
          text-decoration: underline;
          text-decoration-color: var(--gold);
          text-underline-offset: 3px;
        }

        .technical-proposal-a4-editor .reference-box {
          margin: 0 0 5mm;
          padding: 3mm 3.6mm;
          border: 1px solid #e1e7f0;
          border-left: 3.5px solid var(--gold);
          background: #fbfcfe;
          font-size: 8.5pt;
        }

        .technical-proposal-a4-editor .direct-edit,
        .technical-proposal-a4-editor input,
        .technical-proposal-a4-editor textarea {
          border-radius: 0;
        }

        .technical-proposal-a4-editor .a4-section-title {
          margin: 3.6mm 0 1.8mm;
          color: var(--navy);
          font-size: 10pt;
          font-weight: 800;
          border-bottom: 1px solid #b9975b;
          padding-bottom: 1.1mm;
          text-transform: uppercase;
          line-height: 1.25;
          letter-spacing: 0;
        }

        .technical-proposal-a4-editor .a4-subheading {
          margin: 2.5mm 0 1.2mm;
          color: #274f4b;
          font-size: 8.9pt;
          font-weight: 750;
          line-height: 1.35;
          border-bottom: 0;
          letter-spacing: 0;
        }

        .technical-proposal-a4-editor .a4-activity-title {
          color: #273444;
          font-weight: 700;
          border-bottom: 0;
          letter-spacing: 0;
        }

        .technical-proposal-a4-editor .a4-para {
          margin: 0.8mm 0 1.8mm;
          width: 100%;
          color: #44403c;
          font-size: 8.7pt;
          line-height: 1.46;
          text-align: justify;
          white-space: pre-wrap;
          resize: vertical;
        }

        .technical-proposal-a4-editor .a4-description-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 18px;
          gap: 1mm;
          align-items: start;
        }

        .technical-proposal-a4-editor .a4-description-add {
          margin-top: 0.6mm;
          border: 0;
          background: transparent;
          padding: 0;
          color: #687386;
          font-size: 7pt;
          font-weight: 600;
          line-height: 1.3;
        }

        .technical-proposal-a4-editor .a4-description-add:hover {
          color: #285f58;
          text-decoration: underline;
        }

        .technical-proposal-a4-editor .a4-description-remove {
          width: 16px;
          height: 16px;
          margin-top: 1mm;
          border: 1px solid transparent;
          background: transparent;
          color: #8a94a3;
          font-size: 9px;
          line-height: 14px;
        }

        .technical-proposal-a4-editor .a4-description-remove:hover {
          border-color: #d8dde3;
          color: #9f2d25;
        }

        .technical-proposal-a4-editor .section-title {
          margin: 4mm 0 2.2mm;
          color: var(--navy);
          font-size: 10.2pt;
          font-weight: 900;
          border-bottom: 1.35px solid var(--gold);
          padding-bottom: 1.5mm;
          text-transform: uppercase;
          line-height: 1.25;
        }

        .technical-proposal-a4-editor .scope-editor-wrap {
          margin: 0 0 4.5mm;
          border: 1px solid #d7e0ea;
          border-left: 3.5px solid var(--teal);
          background: #fffdf8;
          position: relative;
          overflow: hidden;
        }

        .technical-proposal-a4-editor .scope-editor-help {
          padding: 1.7mm 3mm;
          background: #fbfcfe;
          border-bottom: 1px solid #e7ecf2;
          color: #66758a;
          font-size: 7.2pt;
        }

        .technical-proposal-a4-editor .scope-editor-help b {
          color: var(--teal);
        }

        .technical-proposal-a4-editor .scope-editor-main {
          display: grid;
          grid-template-columns: 18mm 1fr;
          min-height: 20mm;
          max-height: 91mm;
          overflow: hidden;
        }

        .technical-proposal-a4-editor .scope-gutter {
          background: #f7fafc;
          border-right: 1px solid #e4e9f0;
          padding: 2.2mm 1.5mm 2.2mm 2mm;
          color: #42526a;
          font-weight: 850;
          font-size: 8.4pt;
          line-height: 24px;
          white-space: pre;
          overflow: hidden;
        }

        .technical-proposal-a4-editor .scope-gutter-row {
          height: 24px;
          line-height: 24px;
        }

        .technical-proposal-a4-editor .scope-textarea {
          display: block;
          width: 100%;
          border: 0;
          outline: 0;
          resize: none;
          padding: 2.2mm 3mm;
          min-height: 20mm;
          max-height: 91mm;
          overflow: auto;
          background: transparent;
          color: #182536;
          font-family: var(--font);
          font-size: 8.8pt;
          font-weight: 650;
          line-height: 24px;
          white-space: pre;
          tab-size: 4;
        }

        .technical-proposal-a4-editor .scope-print-list {
          display: none;
          margin: 0 0 4mm;
          padding: 2.4mm 3.3mm;
          border: 1px solid #e1e7f0;
          border-left: 3.5px solid var(--teal);
          background: #fffdf8;
        }

        .technical-proposal-a4-editor .scope-editor-wrap.is-print-view .scope-editor-help,
        .technical-proposal-a4-editor .scope-editor-wrap.is-print-view .scope-editor-main {
          display: none;
        }

        .technical-proposal-a4-editor .scope-editor-wrap.is-print-view .scope-print-list {
          display: block;
          margin: 0;
          border: 0;
          border-left: 0;
        }

        .technical-proposal-a4-editor .scope-print-row {
          display: grid;
          grid-template-columns: 17mm 1fr;
          gap: 2mm;
          padding: 0.8mm 0;
          font-size: 8.6pt;
        }

        .technical-proposal-a4-editor .scope-print-row.depth-1 {
          margin-left: 5mm;
        }

        .technical-proposal-a4-editor .scope-print-row.depth-2 {
          margin-left: 10mm;
        }

        .technical-proposal-a4-editor .scope-print-row.depth-3 {
          margin-left: 15mm;
        }

        .technical-proposal-a4-editor .scope-print-num {
          font-weight: 900;
          color: var(--navy);
        }

        .technical-proposal-a4-editor .scope-print-title {
          font-weight: 670;
        }

        .technical-proposal-a4-editor .a4-scope-block {
          padding: 1.2mm 0;
          border: 0;
        }

        .technical-proposal-a4-editor .a4-scope-heading {
          display: flex;
          gap: 1mm;
          align-items: baseline;
        }

        .technical-proposal-a4-editor .a4-scope-number {
          flex: 0 0 10mm;
          min-height: 20px;
          padding: 2px 0;
          color: var(--navy);
          font-size: 8.8pt;
          font-weight: 800;
          line-height: 16px;
          text-align: left;
          font-variant-numeric: tabular-nums;
        }

        .technical-proposal-a4-editor .a4-scope-content {
          flex: 1 1 auto;
          min-width: 0;
        }

        .technical-proposal-a4-editor .a4-scope-content > input {
          display: block;
          min-height: 20px;
          padding-top: 2px;
          padding-bottom: 2px;
          line-height: 16px;
        }

        .technical-proposal-a4-editor .a4-scope-selected {
          background: rgba(247, 249, 249, 0.9);
          box-shadow: inset 0 0 0 1px #d9e2e1;
        }

        .technical-proposal-a4-editor .a4-block-handle {
          position: absolute;
          left: -6mm;
          top: 0;
          border: 0;
          background: transparent;
          color: #7b8491;
          font-size: 7pt;
          line-height: 1;
          opacity: 0;
          transition: 0.15s;
          user-select: none;
        }

        .technical-proposal-a4-editor .a4-scope-block:hover > .a4-block-handle {
          opacity: 1;
        }

        .technical-proposal-a4-editor .resource-block {
          width: calc(100% - 4mm);
          margin: 0 0 1mm 4mm;
        }

        .technical-proposal-a4-editor .resource-title {
          margin: 1.2mm 0 0.8mm;
          width: 100%;
          border-bottom: 1px solid #bfc9ce;
          padding: 0 0 0.7mm;
          font-size: 8.4pt;
          font-weight: 750;
          color: #2f4858;
          letter-spacing: 0;
          line-height: 1.18;
        }

        .technical-proposal-a4-editor .doc-table {
          width: 100%;
          margin: 0 0 1.5mm;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 7.75pt;
        }

        .technical-proposal-a4-editor .doc-table th {
          background: #f3f5f6;
          color: #3f4c59;
          font-weight: 750;
          text-transform: uppercase;
          padding: 0.85mm 0.68mm;
          line-height: 1.12;
        }

        .technical-proposal-a4-editor .doc-table td,
        .technical-proposal-a4-editor .doc-table th {
          border: 1px solid #cfd6dc;
          vertical-align: middle;
          overflow-wrap: break-word;
        }

        .technical-proposal-a4-editor .doc-table td {
          padding: 0.42mm 0.68mm;
          line-height: 1.14;
          min-height: 0;
          height: auto;
        }

        .technical-proposal-a4-editor .a4-internal-note {
          width: calc(100% - 4mm);
          margin-left: 4mm;
          border: 1px solid #cfd6dc;
          background: #f7f8f9;
          letter-spacing: 0;
        }

        .technical-proposal-a4-editor .doc-table input,
        .technical-proposal-a4-editor .doc-table textarea {
          width: 100%;
          border: 0;
          background: transparent;
          padding: 0;
          font: inherit;
          color: inherit;
          outline: 0;
          min-height: 17px;
        }

        .technical-proposal-a4-editor .doc-table.mo-table {
          font-size: 7.75pt;
        }

        .technical-proposal-a4-editor .doc-table.mo-table .mo-group-cell {
          vertical-align: top;
          background: #fffdf9;
        }

        .technical-proposal-a4-editor .doc-table.mo-table .mo-subrow td {
          border-top-color: #e8edf3;
        }

        .technical-proposal-a4-editor .resource-row-action {
          width: 16px;
          height: 16px;
          border: 1px solid #d8e1eb;
          border-radius: 4px;
          background: #fff;
          color: #526274;
          font-size: 10px;
          font-weight: 900;
          line-height: 14px;
        }

        .technical-proposal-a4-editor .resource-row-action:hover {
          border-color: #99d5c9;
          background: #f0fdfa;
          color: var(--teal);
        }

        .technical-proposal-a4-editor .resource-row-action.delete:hover {
          border-color: #efc7c3;
          background: #fff4f3;
          color: #b42318;
        }

        .technical-proposal-a4-editor .image-gallery {
          margin: 2mm 0 4mm 3mm;
          width: calc(100% - 3mm);
        }

        .technical-proposal-a4-editor .image-gallery-block {
          page-break-inside: avoid;
        }

        .technical-proposal-a4-editor .image-gallery {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2.4mm;
        }

        .technical-proposal-a4-editor .image-gallery.count-1 {
          grid-template-columns: 1fr;
        }

        .technical-proposal-a4-editor .image-card-v64 {
          border: 1px solid #d6dee8;
          background: #ffffff;
          padding: 1.5mm;
          page-break-inside: avoid;
        }

        .technical-proposal-a4-editor .image-media-v64 {
          height: 42mm;
          border: 1px solid #d9e1ec;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .technical-proposal-a4-editor .image-gallery.count-1 .image-media-v64 {
          height: 66mm;
        }

        .technical-proposal-a4-editor .image-media-v64 img {
          display: block;
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
        }

        .technical-proposal-a4-editor .image-caption {
          text-align: center;
          font-size: 8pt;
          color: #43526a;
          font-weight: 650;
          margin-top: 1.5mm;
        }

        .pt-promanager .editor-right {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: 34px minmax(0, 1fr);
          overflow: hidden;
          border: 1px solid #cfd5dc;
          border-radius: 6px;
          background: #ffffff;
          font-family: "Segoe UI", Arial, sans-serif;
          color: #2f343b;
          font-size: 11px;
        }

        .pt-promanager .right-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          height: 34px;
          border-bottom: 1px solid #d8dde3;
          background: #f8f9fa;
        }

        .pt-promanager .right-tabs.only-resources {
          grid-template-columns: 1fr;
        }

        .pt-promanager .right-tab {
          border: 0;
          border-right: 1px solid #d8dde3;
          background: #f8f9fa;
          color: #59616c;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .pt-promanager .right-tab:last-child {
          border-right: 0;
        }

        .pt-promanager .right-tab.active {
          background: #eef8f4;
          color: #195f50;
          box-shadow: inset 0 -2px 0 #58bfa9;
        }

        .pt-promanager .right-body {
          min-height: 0;
          position: relative;
          overflow: hidden;
        }

        .pt-promanager .right-body > .panel {
          position: absolute;
          inset: 0;
        }

        .pt-promanager .panel-margins {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          overflow: hidden;
          background: #ffffff;
        }

        .pt-promanager .margin-status {
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 7px 8px;
          border-bottom: 1px solid #d8dde3;
          background: #fafafa;
        }

        .pt-promanager .margin-status strong,
        .pt-promanager .margin-status span {
          display: block;
        }

        .pt-promanager .margin-status strong {
          font-size: 9px;
          text-transform: uppercase;
        }

        .pt-promanager .margin-status span {
          margin-top: 2px;
          color: #737b86;
          font-size: 8px;
        }

        .pt-promanager .margin-create,
        .pt-promanager .resource-card-actions button,
        .pt-promanager .resource-search-head button {
          height: 25px;
          padding: 0 8px;
          border: 1px solid #7bcfbd;
          border-radius: 4px;
          background: #eaf8f4;
          color: #165b4e;
          font-size: 9px;
          font-weight: 600;
        }

        .pt-promanager .margin-table-wrap {
          min-height: 0;
          overflow: auto;
        }

        .pt-promanager .margin-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }

        .pt-promanager .margin-table th {
          height: 25px;
          padding: 4px 5px;
          border-right: 1px solid #e9edf1;
          border-bottom: 1px solid #d8dde3;
          background: #f8f9fa;
          color: #5b636d;
          font-size: 8px;
          text-align: right;
          text-transform: uppercase;
        }

        .pt-promanager .margin-table th:first-child {
          text-align: left;
        }

        .pt-promanager .margin-table td {
          height: 22px;
          padding: 3px 5px;
          border-right: 1px solid #e9edf1;
          border-bottom: 1px solid #e9edf1;
          font-size: 9px;
        }

        .pt-promanager .margin-table td:first-child {
          font-weight: 500;
        }

        .pt-promanager .margin-table .money,
        .pt-promanager .margin-table .num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .pt-promanager .margin-table input,
        .pt-promanager .margin-percent {
          width: 58px;
          height: 18px;
          border: 1px solid transparent;
          background: transparent;
          text-align: right;
          color: #2563eb;
          font-size: 9px;
          font-weight: 600;
          padding: 0 2px;
        }

        .pt-promanager .margin-table input:focus {
          outline: 1px solid #8bb8ff;
          background: #f6f9ff;
        }

        .pt-promanager .margin-percent:disabled {
          color: #737b86;
          cursor: default;
        }

        .pt-promanager .margin-table tr.total2 td {
          font-weight: 700;
          color: #d04444;
          border-top: 1px solid #efb4b4;
        }

        .pt-promanager .margin-empty,
        .pt-promanager .resource-empty,
        .pt-promanager .related-empty {
          padding: 16px;
          color: #737b86;
          font-size: 8px;
          text-align: center;
        }

        .pt-promanager .margin-note {
          margin: 0;
          padding: 7px 8px;
          border-top: 1px solid #d8dde3;
          background: #fafafa;
          color: #737b86;
          font-size: 8px;
          line-height: 1.35;
        }

        .pt-promanager .resource-panel {
          height: 100%;
          display: grid;
          grid-template-rows: 86px 210px minmax(210px, 1fr) 108px;
          background: #ffffff;
        }

        .pt-promanager .resource-search {
          padding: 7px 8px;
          border-bottom: 1px solid #d8dde3;
          background: #fafafa;
        }

        .pt-promanager .resource-search-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .pt-promanager .resource-search label {
          display: block;
          color: #5d6570;
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .pt-promanager .resource-search input {
          width: 100%;
          height: 27px;
          margin-top: 4px;
          border: 1px solid #bcc4cd;
          border-radius: 4px;
          padding: 0 7px;
          outline: 0;
          background: #ffffff;
          font-size: 9px;
        }

        .pt-promanager .resource-search input:focus {
          border-color: #6bbca8;
          box-shadow: 0 0 0 2px #dff5ef;
        }

        .pt-promanager .resource-target {
          margin-top: 3px;
          overflow: hidden;
          color: #737b86;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pt-promanager .resource-list {
          overflow: auto;
          border-bottom: 1px solid #d8dde3;
          background: #ffffff;
        }

        .pt-promanager .resource-row {
          width: 100%;
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr) 44px;
          gap: 6px;
          align-items: center;
          min-height: 29px;
          padding: 5px 7px;
          border: 0;
          border-bottom: 1px solid #e9edf1;
          background: #ffffff;
          color: #2f343b;
          font-size: 8.5px;
          text-align: left;
        }

        .pt-promanager .resource-row:hover {
          background: #f7f9fa;
        }

        .pt-promanager .resource-row.active {
          background: #eaf8f3;
          box-shadow: inset 3px 0 0 #46a98f;
        }

        .pt-promanager .resource-row b {
          font-size: 8px;
        }

        .pt-promanager .resource-row .desc {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pt-promanager .resource-row .unit {
          color: #737b86;
          text-align: right;
        }

        .pt-promanager .resource-detail {
          overflow: auto;
          padding: 9px;
          border-bottom: 1px solid #d8dde3;
          background: #fbfbfc;
        }

        .pt-promanager .resource-card {
          overflow: hidden;
          border: 1px solid #d9dee4;
          border-radius: 5px;
          background: #ffffff;
        }

        .pt-promanager .resource-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          padding: 8px;
          border-bottom: 1px solid #e9edf1;
          background: #fafafa;
        }

        .pt-promanager .resource-card-head .title {
          font-size: 9px;
          font-weight: 700;
          line-height: 1.25;
        }

        .pt-promanager .resource-card-head .code {
          white-space: nowrap;
          border: 1px solid #cfd5dc;
          border-radius: 999px;
          padding: 2px 6px;
          background: #ffffff;
          color: #5a626c;
          font-size: 7.5px;
        }

        .pt-promanager .resource-card-body {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 9px;
          padding: 9px;
        }

        .pt-promanager .photo {
          height: 92px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px solid #d8dde3;
          border-radius: 4px;
          background: #f7f8f9;
          color: #737b86;
          font-size: 8px;
        }

        .pt-promanager .photo img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .pt-promanager .resource-meta {
          display: grid;
          grid-template-columns: 74px minmax(0, 1fr);
          gap: 3px 6px;
          font-size: 8px;
        }

        .pt-promanager .resource-meta label {
          color: #7a828d;
        }

        .pt-promanager .resource-meta .link a {
          color: #2563eb;
          text-decoration: none;
        }

        .pt-promanager .resource-card-actions {
          display: flex;
          justify-content: flex-end;
          padding: 0 9px 9px;
        }

        .pt-promanager .related {
          overflow: auto;
          padding: 8px;
          background: #ffffff;
        }

        .pt-promanager .related-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
          color: #59616c;
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .context-menu.open {
          display: block;
        }

        .context-menu {
          position: fixed;
          z-index: 300;
          min-width: 235px;
          background: #ffffff;
          border: 1px solid #d6dee8;
          border-radius: 10px;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
          padding: 5px;
          max-height: calc(100dvh - 24px);
          overflow: auto;
        }

        .context-menu .ctx-label {
          padding: 6px 9px 5px;
          color: #7a8797;
          font-size: 10px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .context-menu button {
          width: 100%;
          border: 0;
          background: #ffffff;
          text-align: left;
          padding: 8px 9px;
          border-radius: 6px;
          color: #263446;
          font-size: 12px;
        }

        .context-menu button:hover {
          background: #f3f6fa;
        }

        .context-menu button.danger {
          color: var(--danger);
        }

        .context-sep {
          height: 1px;
          background: #edf0f4;
          margin: 4px;
        }

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

          body.printing-ready .technical-proposal-document,
          body.printing-ready .technical-proposal-document * {
            visibility: visible !important;
          }

          body.printing-ready .technical-proposal-document {
            position: fixed !important;
            inset: 0 auto auto 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          body.printing-ready .technical-proposal-document .doc-page {
            width: 210mm !important;
            height: 296.8mm !important;
            min-height: 296.8mm !important;
            max-height: 296.8mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            break-after: page !important;
            page-break-after: always !important;
          }

          .a4-block-handle,
          .a4-description-add,
          .a4-description-remove,
          .resource-row-action,
          .operational-column {
            display: none !important;
          }
        }
      `}</style>
      <div className="pt-promanager fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-2">
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

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 xl:grid-cols-[minmax(820px,3fr)_minmax(360px,2fr)]">
          <main className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-stone-200 bg-stone-200">
            <div className="sticky top-0 z-20 border-b border-stone-300 bg-white px-3 py-2 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FieldLabelIcon icon="file-text" label="Editor documental A4" className="text-[12px] font-black text-stone-800" />
                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    Revision
                    <select
                      value={draft.metadata.revision}
                      onChange={(event) => handleRevisionChange(event.target.value)}
                      className="h-7 border border-stone-300 bg-white px-2 text-[11px] font-semibold normal-case text-stone-700 outline-none focus:border-teal-500"
                    >
                      {revisionOptions.map((revision) => (
                        <option key={revision} value={revision}>
                          {revision}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={handleCreateNextRevision} className={smallButtonClassName("secondary")} disabled={!isEditingProposalDocument}>
                    Nueva REV
                  </button>
                  <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    Estado PT
                    <select
                      value={draft.work_status}
                      onChange={(event) => patchDraft({ work_status: event.target.value as ProposalWorkStatus })}
                      className="h-7 border border-stone-300 bg-white px-2 text-[11px] font-semibold normal-case text-stone-700 outline-none focus:border-teal-500"
                      disabled={!isEditingProposalDocument}
                    >
                      <option value="Borrador">Borrador</option>
                      <option value="En proceso">En proceso</option>
                      <option value="Completado">Completado</option>
                    </select>
                  </label>
                  <label className="flex h-7 items-center gap-1.5 border border-stone-300 bg-stone-50 px-2 text-[10px] font-semibold text-stone-600" title="Oculta observaciones y acciones en las tablas">
                    <input
                      type="checkbox"
                      checked={cleanTableView}
                      onChange={(event) => setCleanTableView(event.target.checked)}
                      className="h-3.5 w-3.5 accent-teal-700"
                    />
                    Vista limpia
                  </label>
                  <span className="mx-1 h-5 w-px bg-stone-200" />
                  <button type="button" onClick={exportWordFromPreview} className={smallButtonClassName("secondary")}>Word</button>
                  <button type="button" onClick={exportHtmlFromPreview} className={smallButtonClassName("secondary")}>HTML</button>
                  <button type="button" onClick={exportJsonFromDraft} className={smallButtonClassName("secondary")}>JSON</button>
                  <button type="button" onClick={handlePrintPdf} disabled={printingReady} className={smallButtonClassName("primary")}>Imprimir / PDF</button>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-stone-500">
                <span><strong className="text-stone-700">Documento:</strong> {draft.metadata.documento_codigo}</span>
                <span><strong className="text-stone-700">Cotizacion:</strong> {draft.metadata.cotizacion_codigo}</span>
                <span><strong className="text-stone-700">Destino recursos:</strong> {selectedResourceTargetItem()?.number ?? "-"} {selectedResourceTargetItem()?.title ?? ""}</span>
              </div>
              {statusMessage ? <div className="mt-2 border border-teal-100 bg-teal-50 px-2 py-1 text-[11px] text-teal-700">{statusMessage}</div> : null}
            </div>

            <div className="min-h-0 overflow-auto p-4">
              <div ref={previewDocumentRef} className="technical-proposal-document mx-auto flex w-max flex-col gap-4">
                <article className="technical-proposal-a4-editor doc-page cover-page-v66">
                  <div className="cover-client-mark-v66">
                    {clientLogo?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${clientLogo.id}-${clientLogo.updated_at}-${previewRefreshKey}`}
                        src={clientLogo.logo_url}
                        alt={clientLogo.display_name || clientLogo.entity_name || "Logo cliente"}
                      />
                    ) : (
                      <input
                        value={draft.header.cliente_logo_label}
                        onChange={(event) => patchNested("header", { cliente_logo_label: event.target.value })}
                        className={a4FieldClassName("text-center text-[10px] font-black uppercase text-stone-500")}
                        disabled={!isEditingProposalDocument}
                      />
                    )}
                  </div>

                  <div className="cover-main-v66">
                    <div className="cover-eka-logo-v66">
                      {companyLogo?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={`${companyLogo.id}-${companyLogo.updated_at}-${previewRefreshKey}`}
                          src={companyLogo.logo_url}
                          alt={companyLogo.display_name || companyLogo.entity_name || "Logo EKA"}
                        />
                      ) : (
                        <div className="flex h-[38mm] w-[38mm] items-center justify-center rounded-full border border-stone-300 text-[20px] font-black">EKA</div>
                      )}
                    </div>
                    <input
                      value={draft.header.empresa_emisora}
                      onChange={(event) => patchNested("header", { empresa_emisora: event.target.value })}
                      className={a4FieldClassName("cover-company-v66")}
                      disabled={!isEditingProposalDocument}
                    />
                    <div className="cover-rule-v66" />
                    <div className="cover-doc-type-v66">PROPUESTA TECNICA</div>
                    <input
                      value={draft.header.titulo}
                      onChange={(event) => patchNested("header", { titulo: event.target.value })}
                      className={a4FieldClassName("cover-service-v66")}
                      disabled={!isEditingProposalDocument}
                    />
                    <textarea
                      value={draft.header.subtitulo}
                      onChange={(event) => patchNested("header", { subtitulo: event.target.value })}
                      className={a4TextareaClassName("cover-service-detail-v66")}
                      rows={2}
                      disabled={!isEditingProposalDocument}
                    />

                    <div className="cover-data-grid-v66">
                      {renderA4CoverData(
                        "Cliente",
                        <input value={draft.recipient.cliente} onChange={(event) => patchNested("recipient", { cliente: event.target.value })} className={a4FieldClassName("font-bold uppercase")} disabled={!isEditingProposalDocument} />,
                      )}
                      {renderA4CoverData(
                        "Documento",
                        <input value={draft.metadata.documento_codigo} readOnly className={a4FieldClassName("font-bold text-stone-600")} />,
                      )}
                      {renderA4CoverData(
                        "Unidad / sede",
                        <input value={draft.recipient.unidad_trabajo} onChange={(event) => patchNested("recipient", { unidad_trabajo: event.target.value })} className={a4FieldClassName()} disabled={!isEditingProposalDocument} />,
                      )}
                      {renderA4CoverData(
                        "Fecha",
                        <input type="date" value={draft.header.fecha} onChange={(event) => patchNested("header", { fecha: event.target.value })} className={a4FieldClassName()} disabled={!isEditingProposalDocument} />,
                      )}
                      {renderA4CoverData(
                        "Area",
                        <input value={draft.recipient.area_solicitante} onChange={(event) => patchNested("recipient", { area_solicitante: event.target.value })} className={a4FieldClassName()} disabled={!isEditingProposalDocument} />,
                      )}
                      {renderA4CoverData(
                        "Revision",
                        <input value={draft.metadata.revision} readOnly className={a4FieldClassName("font-bold text-stone-600")} />,
                      )}
                    </div>

                    <div className="cover-scope-v66">
                      <div className="cover-scope-title-v66">ALCANCE TECNICO</div>
                      <textarea
                        value={draft.presentation.texto}
                        onChange={(event) => patchNested("presentation", { texto: event.target.value })}
                        className={a4TextareaClassName("cover-scope-text-v66")}
                        disabled={!isEditingProposalDocument}
                      />
                    </div>
                  </div>

                  <footer className="cover-bottom-v66">
                    <span>{draft.header.empresa_emisora}</span>
                    <span>Ingenieria | Mantenimiento | Proyectos electromecanicos</span>
                  </footer>
                </article>

                <article
                  className="technical-proposal-a4-editor doc-page technical-page-v66"
                  onClick={closeScopeContextMenu}
                  onContextMenu={(event) => openScopeContextMenu(event, null)}
                >
                  {renderDocHeader()}

                  <div className="doc-body">
                  <div className="first-meta">
                    <label className="font-black">
                      <input
                        value={draft.header.ciudad}
                        onChange={(event) => patchNested("header", { ciudad: event.target.value })}
                        className={a4FieldClassName("inline-block max-w-[90px] font-black")}
                        disabled={!isEditingProposalDocument}
                      />
                      , {formatDateForDocument(draft.header.fecha)}
                    </label>
                    <div className="budget">
                      <span className="meta-label">Presupuesto</span> <strong>{draft.metadata.documento_codigo}</strong>
                    </div>
                  </div>

                  <section className="recipient">
                    {renderA4MetaRow(
                      "Senores:",
                      <input value={draft.recipient.cliente} onChange={(event) => patchNested("recipient", { cliente: event.target.value })} className={a4FieldClassName("font-black uppercase")} disabled={!isEditingProposalDocument} />,
                    )}
                    {renderA4MetaRow(
                      "Unidad:",
                      <input value={draft.recipient.unidad_trabajo} onChange={(event) => patchNested("recipient", { unidad_trabajo: event.target.value })} className={a4FieldClassName()} disabled={!isEditingProposalDocument} />,
                    )}
                    {renderA4MetaRow(
                      "Area:",
                      <input value={draft.recipient.area_solicitante} onChange={(event) => patchNested("recipient", { area_solicitante: event.target.value })} className={a4FieldClassName()} disabled={!isEditingProposalDocument} />,
                    )}
                    {renderA4MetaRow(
                      "Atencion:",
                      <input value={draft.recipient.atencion} onChange={(event) => patchNested("recipient", { atencion: event.target.value })} className={a4FieldClassName()} disabled={!isEditingProposalDocument} />,
                    )}
                    {renderA4MetaRow(
                      "Contacto:",
                      <input value={draft.recipient.contacto} onChange={(event) => patchNested("recipient", { contacto: event.target.value })} className={a4FieldClassName()} disabled={!isEditingProposalDocument} />,
                    )}
                  </section>

                  <div className="title-box">
                    <input
                      value={draft.header.titulo}
                      onChange={(event) => patchNested("header", { titulo: event.target.value })}
                      className={a4FieldClassName("text-center text-[17px] font-black uppercase text-stone-900")}
                      disabled={!isEditingProposalDocument}
                    />
                    <textarea
                      value={draft.header.subtitulo}
                      onChange={(event) => patchNested("header", { subtitulo: event.target.value })}
                      className={a4TextareaClassName("text-center text-[10px] font-black uppercase text-stone-800")}
                      rows={2}
                      disabled={!isEditingProposalDocument}
                    />
                  </div>

                  <label className="reference-box grid">
                    <span className="font-black uppercase text-stone-700">Referencia</span>
                    <input value={draft.presentation.referencia} onChange={(event) => patchNested("presentation", { referencia: event.target.value })} className={a4FieldClassName()} disabled={!isEditingProposalDocument} />
                  </label>

                  <h2 className="section-title scope-title">Resumen de los alcances del servicio</h2>
                  <section className={`scope-editor-wrap ${isEditingProposalDocument && !printingReady ? "is-editing" : "is-print-view"}`}>
                    <div className="scope-editor-help"><b>Enter</b> nueva linea · <b>Tab</b> aumenta nivel · <b>Shift + Tab</b> reduce nivel · <b>Ctrl + Espacio</b> actividad</div>
                    <div className="scope-editor-main">
                      <div ref={scopeGutterRef} className="scope-gutter" aria-hidden="true">
                        {scopeGutterRows.length
                          ? scopeGutterRows.map((row) => <div key={`${row.key}-gutter`} className="scope-gutter-row">{row.label}</div>)
                          : <div>-</div>}
                      </div>
                      <textarea
                        ref={scopeTextareaRef}
                        value={draft.scope_outline}
                        onChange={(event) => syncScopeOutline(event.target.value)}
                        onKeyDown={handleScopeOutlineKeyDown}
                        onScroll={(event) => {
                          if (scopeGutterRef.current) scopeGutterRef.current.scrollTop = event.currentTarget.scrollTop;
                        }}
                        className="scope-textarea"
                        placeholder={"Titulo principal\n\tSubtitulo\n\t* Actividad"}
                        disabled={!isEditingProposalDocument}
                      />
                    </div>
                    <div className="scope-print-list">
                      {draft.scope_items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedScopeItemId(item.id)}
                          className={`scope-print-row depth-${Math.min(item.level, 3)} w-full border-0 bg-transparent text-left ${selectedScopeItemId === item.id ? "text-teal-800" : "text-stone-700"}`}
                          style={{ paddingLeft: `${Math.min(item.level, 3) * 12}px` }}
                        >
                          <span className="scope-print-num">{item.number}.</span>
                          <span className={`scope-print-title ${item.kind === "activity" ? "" : "font-bold uppercase"}`}>{item.title}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="mt-4 border border-stone-200 p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <FieldLabelIcon icon="image" label="Imagenes tecnicas generales" className="text-[9px] font-black uppercase text-stone-700" />
                      <span className="text-[8px] text-stone-400">{draft.general_images.length} imagen(es)</span>
                    </div>
                    {renderImageEditor(draft.general_images, "general", null)}
                  </section>

                  </div>
                  <footer className="doc-footer">
                    <span>{draft.header.empresa_emisora} | Propuesta tecnica</span>
                    <span>Presentacion y resumen</span>
                  </footer>
                </article>

                {documentScopePages.map((scopeItemIds, pageIndex) => (
                  <article
                    key={`scope-page-${pageIndex}`}
                    className="technical-proposal-a4-editor doc-page technical-page-v66"
                    onClick={closeScopeContextMenu}
                    onContextMenu={(event) => openScopeContextMenu(event, null)}
                  >
                    {renderDocHeader()}
                    <div className="doc-body">
                      <h2 className="section-title">I. Alcances del servicio</h2>
                      <div className="mt-3 space-y-3">
                        {scopeItemIds.length ? scopeItemIds.map((itemId) => {
                          const node = scopeNodeById.get(itemId);
                          const item = draft.scope_items.find((scopeItem) => scopeItem.id === itemId);
                          return node && item ? renderA4EditableScopeNode(node, item.level, false) : null;
                        }) : (
                          <div className="border border-dashed border-stone-300 px-3 py-5 text-center text-[10px] text-stone-500">
                            Genera o agrega items para desarrollar el alcance.
                          </div>
                        )}
                      </div>
                    </div>
                    <footer className="doc-footer">
                      <span>{draft.header.empresa_emisora} | Propuesta tecnica</span>
                      <span>Alcances | pagina {pageIndex + 1} de {documentScopePages.length}</span>
                    </footer>
                  </article>
                ))}

                <article className="technical-proposal-a4-editor doc-page technical-page-v66">
                  {renderDocHeader()}
                  <div className="doc-body">
                    <h2 className="section-title">II. Notas complementarias y condiciones comerciales</h2>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-[9px] leading-4 md:grid-cols-2">
                    {Object.entries(draft.conditions).map(([key, value]) => (
                      <label key={key} className={`grid gap-1 font-black uppercase tracking-wide text-stone-600 ${key.includes("notas") || key.includes("incluye") || key.includes("cierre") ? "md:col-span-2" : ""}`}>
                        {key.replace(/_/g, " ")}
                        <textarea
                          value={String(value)}
                          onChange={(event) => patchNested("conditions", { [key]: event.target.value } as Partial<TechnicalProposalDraft["conditions"]>)}
                          className={a4TextareaClassName("min-h-[42px] font-normal normal-case tracking-normal")}
                          disabled={!isEditingProposalDocument}
                        />
                      </label>
                    ))}
                  </div>

                  </div>
                  <footer className="doc-footer">
                    <span>{draft.header.empresa_emisora} | Propuesta tecnica</span>
                    <span>{draft.metadata.subcarpeta_revision} | {draft.metadata.archivo_pdf}</span>
                  </footer>
                </article>
              </div>
            </div>
          </main>

          <aside className="editor-right">
            <div className={`right-tabs ${canViewPrices ? "" : "only-resources"}`}>
              {canViewPrices ? (
                <button type="button" className={`right-tab ${rightPanelView === "margins" ? "active" : ""}`} onClick={() => setRightPanelView("margins")}>
                  Margenes
                </button>
              ) : null}
              <button type="button" className={`right-tab ${rightPanelView === "resources" ? "active" : ""}`} onClick={() => setRightPanelView("resources")}>
                Recursos
              </button>
            </div>
            <div className="right-body">
              {rightPanelView === "margins" && canViewPrices ? (
                <TechnicalProposalUsedResourcesPanel
                  items={usedResourceItems}
                  canViewPrices={canViewPrices}
                  budgetDetail={linkedBudgetDetail}
                  busy={budgetContextLoading}
                  canCreateBudgetFromTechnicalProposal={Boolean(canEditBudgetPrices && technicalProposalId && !linkedBudgetDetail && !budgetContextLoading)}
                  canApplyMargins={Boolean(canEditBudgetPrices && linkedBudgetDetail?.presupuesto.estado === "BORRADOR" && !budgetContextLoading)}
                  onCreateBudgetFromTechnicalProposal={handleCreateBudgetFromTechnicalProposal}
                  onApplyMarginByType={handleApplyMarginByType}
                />
              ) : (
                <TechnicalProposalResourceCatalogPanel
                  resources={resourceCatalog}
                  selectedResourceId={displayedResource?.id ?? null}
                  canAddResource={isEditingProposalDocument}
                  canCreateResource={canCreateResource}
                  canViewPrices={canViewPrices}
                  targetLabel={`${selectedResourceTargetItem()?.number ?? "-"} ${selectedResourceTargetItem()?.title ?? ""}`.trim()}
                  onInspectResource={(resource) => setActiveMasterResource(resource)}
                  onAddResource={handleAddCatalogResource}
                  onCreateResource={openCreateResourceFromTechnicalProposal}
                />
              )}
            </div>
          </aside>
        </div>

        {scopeContextMenu
          ? (() => {
              const target = contextScopeItem();
              return (
                <div
                  className="context-menu open"
                  style={{ left: scopeContextMenu.x, top: scopeContextMenu.y }}
                  onClick={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <div>
                    <div className="ctx-label truncate">Bloque documental</div>
                    <div className="truncate font-semibold text-stone-800">{target ? `${target.number}. ${target.title}` : "Documento"}</div>
                  </div>
                  <div className="context-sep" />
                  <div>
                    <button type="button" onClick={() => runScopeContextAction("group")} disabled={!isEditingProposalDocument}>Insertar titulo</button>
                    <button type="button" onClick={() => runScopeContextAction("subgroup")} disabled={!isEditingProposalDocument}>Insertar subtitulo</button>
                    <button type="button" onClick={() => runScopeContextAction("activity")} disabled={!isEditingProposalDocument}>Agregar actividad</button>
                  </div>
                  <div className="context-sep" />
                  <div>
                    <button type="button" onClick={() => runScopeContextAction("outdent")} disabled={!isEditingProposalDocument || !target}>Reducir nivel</button>
                    <button type="button" onClick={() => runScopeContextAction("indent")} disabled={!isEditingProposalDocument || !target}>Aumentar nivel</button>
                    <button type="button" onClick={() => runScopeContextAction("up")} disabled={!isEditingProposalDocument || !target}>Mover arriba</button>
                    <button type="button" onClick={() => runScopeContextAction("down")} disabled={!isEditingProposalDocument || !target}>Mover abajo</button>
                    <button type="button" onClick={() => runScopeContextAction("duplicate")} disabled={!isEditingProposalDocument || !target}>Duplicar bloque</button>
                    <button type="button" onClick={() => runScopeContextAction("delete")} className="danger" disabled={!isEditingProposalDocument || !target}>Eliminar bloque</button>
                  </div>
                  <div className="context-sep" />
                  <div>
                    <div className="ctx-label">Agregar recurso</div>
                    <div>
                      {RESOURCE_CATEGORIES.map((category) => (
                        <button
                          key={category.key}
                          type="button"
                          onClick={() => runScopeResourceContextAction(category.key)}
                          disabled={!isEditingProposalDocument || !target}
                          title={category.label}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          : null}

        <TechnicalProposalQuickEntryModal
          open={quickEntryOpen}
          scopeItems={draft.scope_items}
          recursos={resourceCatalog}
          defaultScopeItemId={selectedActivity?.id ?? draft.scope_items.find((item) => item.kind === "activity")?.id ?? ""}
          canViewPrices={canViewPrices}
          onClose={() => setQuickEntryOpen(false)}
          onApply={applyQuickEntry}
        />

        <ResourceFormModal
          open={resourceModalOpen}
          initial={resourceDraft}
          usedCodes={resourceCatalog.map((item) => item.codigo_recurso)}
          catalogs={{
            tipos: resourceCatalogs.tipos,
            unidades: resourceCatalogs.unidades,
            marcas: resourceCatalogs.marcas,
            proveedores: resourceCatalogs.proveedores,
            monedas: resourceCatalogs.monedas,
            estados: resourceCatalogs.estados,
          }}
          onClose={() => {
            setResourceModalOpen(false);
            setResourceDraft(null);
            setResourceFormMessage(null);
          }}
          onSave={saveCreatedResourceFromTechnicalProposal}
          canViewPrices={canViewPrices}
          allowFilePicker={canManageResourceDocuments && canCreateResource}
          filesReadOnly={!canManageResourceDocuments}
          isSaving={savingResource}
          message={resourceFormMessage}
          zIndexClassName="z-[90]"
          onUploadFile={handleUploadResourceFile}
          onOpenFile={handleOpenResourceFile}
          onResolveFileUrl={createResourceFileSignedUrl}
        />
      </div>
      </div>
    </>
  );
}
