import { computeBudgetEconomics, type BudgetEconomicSummary, type BudgetResourceEconomicInput } from "@/lib/sgp/quotationBudgetEconomics";

export type TechnicalProposalImportItemType = "group" | "subgroup" | "activity";
export type BudgetImportNodeType = "CAPITULO" | "SUBCAPITULO" | "PARTIDA";

export type TechnicalProposalImportItem = {
  id: string;
  parentId: string | null;
  itemType: TechnicalProposalImportItemType;
  itemNumber: string;
  title: string;
  sortOrder: number;
  estimatedTimeValue?: number | null;
  estimatedTimeUnit?: string | null;
};

export type TechnicalProposalImportResource = {
  id: string;
  technicalProposalItemId: string;
  resourceId: string | null;
  codigoRecurso?: string | null;
  codigoFabricante?: string | null;
  descripcion: string;
  unidad?: string | null;
  cantidad: number;
  tiempo?: number | null;
  tipoRecurso?: string | null;
  precioUnitarioRef?: number | null;
  monedaCodigo?: string | null;
  proveedor?: string | null;
  marca?: string | null;
  sortOrder: number;
};

export type BudgetImportNode = {
  sourceItemId: string;
  parentSourceItemId: string | null;
  tipo: BudgetImportNodeType;
  codigo: string;
  descripcion: string;
  orden: number;
  cantidad: number | null;
  unidad: string | null;
};

export type BudgetImportResource = {
  sourceResourceId: string;
  sourceItemId: string;
  recursoId: string;
  cantidadPresupuestada: number;
  precioBaseUnitario: number;
  precioOfertadoUnitario: number;
  orden: number;
  observaciones: string | null;
  tipoRecurso?: string | null;
  codigoRecursoSnapshot?: string | null;
  codigoFabricanteSnapshot?: string | null;
  descripcionSnapshot?: string | null;
  tipoRecursoSnapshot?: string | null;
  unidadSnapshot?: string | null;
  precioUnitarioRefSnapshot?: number | null;
  monedaCodigoSnapshot?: string | null;
  proveedorSnapshot?: string | null;
  marcaSnapshot?: string | null;
};

export type BudgetImportPlan = {
  nodes: BudgetImportNode[];
  resources: BudgetImportResource[];
  inconsistencies: string[];
};

export type MarginOverrideInput = BudgetResourceEconomicInput & {
  manualOfferOverride?: boolean;
};

export function mapTechnicalProposalItemTypeToBudgetType(itemType: TechnicalProposalImportItemType): BudgetImportNodeType {
  if (itemType === "group") return "CAPITULO";
  if (itemType === "subgroup") return "SUBCAPITULO";
  return "PARTIDA";
}

export function splitResourceCodeAndDescription(value: string): { codigoRecurso: string; descripcion: string } {
  const normalized = value.trim();
  const match = normalized.match(/^([A-Z]{2,4}-\d{4}-\d{4})\s+-\s+(.+)$/i);
  if (!match) return { codigoRecurso: "", descripcion: normalized };
  return {
    codigoRecurso: match[1],
    descripcion: match[2].trim(),
  };
}

export function buildBudgetImportPlanFromTechnicalProposal(params: {
  items: TechnicalProposalImportItem[];
  resources: TechnicalProposalImportResource[];
}): BudgetImportPlan {
  const sortedItems = [...params.items].sort((left, right) => left.sortOrder - right.sortOrder || left.itemNumber.localeCompare(right.itemNumber));
  const itemById = new Map(sortedItems.map((item) => [item.id, item]));
  const activityIds = new Set(sortedItems.filter((item) => item.itemType === "activity").map((item) => item.id));
  const inconsistencies: string[] = [];

  const nodes = sortedItems.map((item) => ({
    sourceItemId: item.id,
    parentSourceItemId: item.parentId,
    tipo: mapTechnicalProposalItemTypeToBudgetType(item.itemType),
    codigo: item.itemNumber,
    descripcion: item.title,
    orden: item.sortOrder,
    cantidad: item.itemType === "activity" && Number.isFinite(item.estimatedTimeValue ?? Number.NaN) ? Number(item.estimatedTimeValue) : null,
    unidad: item.itemType === "activity" ? item.estimatedTimeUnit ?? null : null,
  }));

  const resources: BudgetImportResource[] = [];
  for (const resource of [...params.resources].sort((left, right) => left.sortOrder - right.sortOrder)) {
    const item = itemById.get(resource.technicalProposalItemId);
    if (!item) {
      inconsistencies.push(`El recurso "${resource.descripcion}" referencia una partida PT inexistente.`);
      continue;
    }
    if (!activityIds.has(resource.technicalProposalItemId)) {
      inconsistencies.push(`El recurso "${resource.descripcion}" está asociado a ${item.itemNumber} ${item.title}, que no es una PARTIDA/ACTIVIDAD.`);
      continue;
    }
    if (!resource.resourceId) {
      inconsistencies.push(`El recurso "${resource.descripcion}" no conserva recurso_id del catálogo maestro.`);
      continue;
    }
    resources.push({
      sourceResourceId: resource.id,
      sourceItemId: resource.technicalProposalItemId,
      recursoId: resource.resourceId,
      cantidadPresupuestada: resource.cantidad,
      precioBaseUnitario: 0,
      precioOfertadoUnitario: 0,
      orden: resource.sortOrder,
      observaciones: resource.tiempo ? `Tiempo PT: ${resource.tiempo}` : null,
      tipoRecurso: resource.tipoRecurso,
      codigoRecursoSnapshot: resource.codigoRecurso ?? null,
      codigoFabricanteSnapshot: resource.codigoFabricante ?? null,
      descripcionSnapshot: resource.descripcion,
      tipoRecursoSnapshot: resource.tipoRecurso ?? null,
      unidadSnapshot: resource.unidad ?? null,
      precioUnitarioRefSnapshot: resource.precioUnitarioRef ?? null,
      monedaCodigoSnapshot: resource.monedaCodigo ?? null,
      proveedorSnapshot: resource.proveedor ?? null,
      marcaSnapshot: resource.marca ?? null,
    });
  }

  return { nodes, resources, inconsistencies };
}

export function applyMarginByResourceType(
  resources: MarginOverrideInput[],
  tipoRecurso: string,
  marginPercent: number,
): MarginOverrideInput[] {
  const factor = 1 + marginPercent / 100;
  return resources.map((resource) => {
    if ((resource.tipoRecurso ?? "Sin tipo") !== tipoRecurso || resource.manualOfferOverride) return resource;
    return {
      ...resource,
      precioOfertadoUnitario: Number(resource.precioBaseUnitario ?? 0) * factor,
    };
  });
}

export function computeImportPlanEconomics(plan: Pick<BudgetImportPlan, "resources">): BudgetEconomicSummary {
  return computeBudgetEconomics({
    partidaIds: Array.from(new Set(plan.resources.map((resource) => resource.sourceItemId))),
    resources: plan.resources.map((resource) => ({
      id: resource.sourceResourceId,
      partidaId: resource.sourceItemId,
      recursoId: resource.recursoId,
      cantidadPresupuestada: resource.cantidadPresupuestada,
      precioBaseUnitario: resource.precioBaseUnitario,
      precioOfertadoUnitario: resource.precioOfertadoUnitario,
      tipoRecurso: resource.tipoRecurso,
    })),
  });
}

export function nextTechnicalProposalRevision(existingRevisions: string[]): string {
  const highest = existingRevisions.reduce((max, revision) => {
    const match = revision.trim().toUpperCase().match(/^REV(\d{2})$/);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, -1);
  return `REV${String(highest + 1).padStart(2, "0")}`;
}
