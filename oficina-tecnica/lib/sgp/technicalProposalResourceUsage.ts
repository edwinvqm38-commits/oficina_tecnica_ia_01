export type TechnicalProposalUsedResourceLike = {
  rowId: string;
  scopeItemId: string;
  masterResourceId: string | null;
  codigo: string;
  descripcion: string;
  tipo: string;
  cantidad: number;
  unidad: string;
  precio: number;
  moneda: "PEN" | "USD";
  resourceCategory: string;
  activityNumber: string;
  activityTitle: string;
};

export type TechnicalProposalScopeItemLike = {
  id: string;
  level: number;
  number: string;
  kind: "group" | "subgroup" | "activity";
  title: string;
};

export type ConsolidatedTechnicalProposalResource = {
  key: string;
  masterResourceId: string | null;
  codigo: string;
  descripcion: string;
  tipo: string;
  unidad: string | null;
  apariciones: number;
  cantidadTotal: number | null;
  noSumable: boolean;
  rows: TechnicalProposalUsedResourceLike[];
};

export type TechnicalProposalResourceTreeNode<TResource extends { scopeItemId: string }> = TechnicalProposalScopeItemLike & {
  parentId: string | null;
  resources: TResource[];
  children: Array<TechnicalProposalResourceTreeNode<TResource>>;
};

export type TechnicalProposalResourceEconomics = {
  recursoId: string;
  precioMaestroActual: number | null;
  monedaMaestro: "PEN" | "USD" | string | null;
  ultimoHistorico: {
    id: string;
    precioUnitario: number;
    monedaCodigo: "PEN" | "USD" | string;
    fechaPrecio: string;
  } | null;
  costoCotizacionActual: number | null;
  costoCotizacionLabel: string;
  origenPrecio: string;
  estadoRevision: string;
  presupuestoId: string | null;
  presupuestoEstado: string | null;
};

export type TechnicalProposalResourceEconomicsInput = {
  resourceCatalog: Array<{
    id: string;
    precio_unitario_ref?: number | null;
    moneda?: "PEN" | "USD" | string | null;
  }>;
  histories: Array<{
    id: string;
    recursoId: string;
    precioUnitario: number;
    monedaCodigo: "PEN" | "USD" | string;
    fechaPrecio: string;
  }>;
  budget:
    | {
        id: string;
        estado: string;
        resources: Array<{
          recursoId: string;
          precioBaseUnitario: number;
          precioBaseOrigen: string;
          precioHistoricoId: string | null;
          precioRevisado: boolean;
        }>;
      }
    | null;
};

export function economicFieldsVisible(canViewPrices: boolean): boolean {
  return canViewPrices;
}

export function technicalProposalResourceCreationAvailable(canCreateResource: boolean): boolean {
  return canCreateResource;
}

export function displayResourceCategory(tipoRecurso: string, resourceCategory: string): string {
  const normalized = `${tipoRecurso} ${resourceCategory}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("mano de obra") || /\bmo[di]\b/.test(normalized)) return "Mano de obra";
  if (normalized.includes("material")) return "Materiales";
  if (normalized.includes("consumible")) return "Consumibles";
  if (normalized.includes("herramienta")) return "Herramientas";
  if (normalized.includes("equipo")) return "Equipos";
  if (normalized.includes("vehiculo")) return "Vehiculos";
  if (normalized.includes("transporte")) return "Transporte";
  if (normalized.includes("subcontr")) return "Subcontratos";
  return tipoRecurso || resourceCategory || "Otros";
}

export function consolidateTechnicalProposalResources(
  items: TechnicalProposalUsedResourceLike[],
): ConsolidatedTechnicalProposalResource[] {
  const groups = new Map<string, TechnicalProposalUsedResourceLike[]>();
  for (const item of items) {
    const key = item.masterResourceId || `row:${item.rowId}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.entries()]
    .map(([key, rows]) => {
      const first = rows[0];
      const units = new Set(rows.map((row) => row.unidad.trim()).filter(Boolean));
      const noSumable = units.size > 1;
      return {
        key,
        masterResourceId: first.masterResourceId,
        codigo: first.codigo,
        descripcion: first.descripcion,
        tipo: first.tipo,
        unidad: noSumable ? null : first.unidad || null,
        apariciones: rows.length,
        cantidadTotal: noSumable ? null : rows.reduce((total, row) => total + row.cantidad, 0),
        noSumable,
        rows,
      };
    })
    .sort((left, right) => `${left.codigo} ${left.descripcion}`.localeCompare(`${right.codigo} ${right.descripcion}`, "es", { sensitivity: "base" }));
}

export function buildTechnicalProposalResourceTree<TResource extends { scopeItemId: string }>(
  scopeItems: TechnicalProposalScopeItemLike[],
  resources: TResource[],
): Array<TechnicalProposalResourceTreeNode<TResource>> {
  const resourcesByScopeId = new Map<string, TResource[]>();
  for (const resource of resources) {
    resourcesByScopeId.set(resource.scopeItemId, [...(resourcesByScopeId.get(resource.scopeItemId) ?? []), resource]);
  }

  const roots: Array<TechnicalProposalResourceTreeNode<TResource>> = [];
  const stack: Array<TechnicalProposalResourceTreeNode<TResource>> = [];

  for (const item of scopeItems) {
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1] ?? null;
    const node: TechnicalProposalResourceTreeNode<TResource> = {
      ...item,
      parentId: parent?.id ?? null,
      resources: resourcesByScopeId.get(item.id) ?? [],
      children: [],
    };

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack.push(node);
  }

  return roots;
}

function latestHistory(
  histories: TechnicalProposalResourceEconomicsInput["histories"],
): TechnicalProposalResourceEconomics["ultimoHistorico"] {
  const sorted = [...histories].sort((left, right) => `${right.fechaPrecio}-${right.id}`.localeCompare(`${left.fechaPrecio}-${left.id}`));
  const first = sorted[0];
  return first
    ? {
        id: first.id,
        precioUnitario: first.precioUnitario,
        monedaCodigo: first.monedaCodigo,
        fechaPrecio: first.fechaPrecio,
      }
    : null;
}

function reviewStateFor(lines: NonNullable<TechnicalProposalResourceEconomicsInput["budget"]>["resources"]): string {
  if (lines.length === 0) return "Sin presupuesto";
  const states = new Set(
    lines.map((line) => {
      if (!line.precioRevisado) return line.precioBaseUnitario > 0 ? "SIN_REVISAR" : "SIN_PRECIO";
      if (line.precioBaseOrigen === "MAESTRO") return "MAESTRO_ACTUAL";
      if (line.precioBaseOrigen === "HISTORICO") return "HISTORICO";
      if (line.precioBaseOrigen === "NUEVO_PRECIO") return "PRECIO_ACTUALIZADO";
      return "MANTENER";
    }),
  );
  return states.size === 1 ? [...states][0] : "MIXTO";
}

export function buildTechnicalProposalResourceEconomics(
  consolidated: ConsolidatedTechnicalProposalResource[],
  input: TechnicalProposalResourceEconomicsInput,
): Map<string, TechnicalProposalResourceEconomics> {
  const catalogById = new Map(input.resourceCatalog.map((resource) => [resource.id, resource]));
  const historiesById = new Map<string, TechnicalProposalResourceEconomicsInput["histories"]>();
  for (const history of input.histories) {
    historiesById.set(history.recursoId, [...(historiesById.get(history.recursoId) ?? []), history]);
  }
  const budgetLinesById = new Map<string, NonNullable<TechnicalProposalResourceEconomicsInput["budget"]>["resources"]>();
  for (const resource of input.budget?.resources ?? []) {
    budgetLinesById.set(resource.recursoId, [...(budgetLinesById.get(resource.recursoId) ?? []), resource]);
  }

  const result = new Map<string, TechnicalProposalResourceEconomics>();
  for (const row of consolidated) {
    if (!row.masterResourceId) continue;
    const master = catalogById.get(row.masterResourceId);
    const lines = budgetLinesById.get(row.masterResourceId) ?? [];
    const basePrices = new Set(lines.map((line) => Number(line.precioBaseUnitario.toFixed(4))));
    const origins = new Set(lines.map((line) => line.precioBaseOrigen || "MANUAL"));
    const costoCotizacionActual = lines.length === 0 ? null : basePrices.size === 1 ? lines[0].precioBaseUnitario : null;
    result.set(row.masterResourceId, {
      recursoId: row.masterResourceId,
      precioMaestroActual: master?.precio_unitario_ref ?? null,
      monedaMaestro: master?.moneda ?? null,
      ultimoHistorico: latestHistory(historiesById.get(row.masterResourceId) ?? []),
      costoCotizacionActual,
      costoCotizacionLabel: input.budget ? (lines.length === 0 ? "-" : costoCotizacionActual === null ? "Mixto" : String(costoCotizacionActual)) : "Sin presupuesto",
      origenPrecio: input.budget ? (origins.size === 1 ? [...origins][0] : origins.size > 1 ? "MIXTO" : "-") : "Sin presupuesto",
      estadoRevision: reviewStateFor(lines),
      presupuestoId: input.budget?.id ?? null,
      presupuestoEstado: input.budget?.estado ?? null,
    });
  }
  return result;
}
