export type TechnicalProposalOutputScopeItem = {
  id: string;
  level: number;
  number: string;
  kind: "group" | "subgroup" | "activity";
  title: string;
};

export type TechnicalProposalOutputResource = {
  rowId: string;
  scopeItemId: string;
  masterResourceId: string | null;
  resourceCategory: string;
  tipo: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  observation?: string;
  sourceStatus?: string;
};

export type ConsolidatedTechnicalProposalResourceRow = {
  rowId: string;
  scopeItemId: string;
  scopeNumber: string;
  scopeTitle: string;
  scopeKind: TechnicalProposalOutputScopeItem["kind"];
  location: string;
  type: string;
  code: string;
  resource: string;
  unit: string;
  quantity: number;
  observation: string;
  source: "Catálogo maestro" | "Por formalizar";
};

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildTechnicalProposalScopePathMap(
  scopeItems: TechnicalProposalOutputScopeItem[],
): Map<string, string> {
  const pathById = new Map<string, string>();
  const stack: TechnicalProposalOutputScopeItem[] = [];

  scopeItems.forEach((item) => {
    stack.splice(Math.max(0, item.level));
    stack[item.level] = item;
    const path = stack
      .filter(Boolean)
      .map((entry) => `${cleanText(entry.number)} ${cleanText(entry.title)}`.trim())
      .filter(Boolean)
      .join(" / ");
    pathById.set(item.id, path);
  });

  return pathById;
}

export function buildConsolidatedTechnicalProposalResources(
  scopeItems: TechnicalProposalOutputScopeItem[],
  resources: TechnicalProposalOutputResource[],
): ConsolidatedTechnicalProposalResourceRow[] {
  const itemById = new Map(scopeItems.map((item) => [item.id, item]));
  const itemOrder = new Map(scopeItems.map((item, index) => [item.id, index]));
  const pathById = buildTechnicalProposalScopePathMap(scopeItems);

  return resources
    .map((resource) => {
      const item = itemById.get(resource.scopeItemId);
      return {
        rowId: resource.rowId,
        scopeItemId: resource.scopeItemId,
        scopeNumber: item?.number ?? "-",
        scopeTitle: item?.title ?? "Sin ubicación",
        scopeKind: item?.kind ?? "activity",
        location: pathById.get(resource.scopeItemId) ?? "Sin ubicación",
        type: cleanText(resource.tipo || resource.resourceCategory) || "Sin tipo",
        code: cleanText(resource.codigo) || "S/C",
        resource: cleanText(resource.descripcion) || "Recurso sin descripción",
        unit: cleanText(resource.unidad) || "-",
        quantity: Number.isFinite(resource.cantidad) ? resource.cantidad : 0,
        observation: cleanText(resource.observation ?? ""),
        source: resource.masterResourceId ? "Catálogo maestro" as const : "Por formalizar" as const,
        order: itemOrder.get(resource.scopeItemId) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((left, right) =>
      left.order - right.order ||
      left.type.localeCompare(right.type, "es", { sensitivity: "base" }) ||
      left.resource.localeCompare(right.resource, "es", { sensitivity: "base" })
    )
    .map((row) => {
      const { order, ...resourceRow } = row;
      void order;
      return resourceRow;
    });
}

export function normalizeEnabledResourceTables(
  value: unknown,
  validScopeIds: Iterable<string>,
): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const validIds = new Set(validScopeIds);
  const result: Record<string, string[]> = {};

  Object.entries(value as Record<string, unknown>).forEach(([scopeItemId, categories]) => {
    if (!validIds.has(scopeItemId) || !Array.isArray(categories)) return;
    const normalized = Array.from(new Set(categories.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)));
    if (normalized.length > 0) result[scopeItemId] = normalized;
  });

  return result;
}
