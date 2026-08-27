export type BudgetPriceReviewStatus =
  | "SIN_REVISAR"
  | "MANTENER"
  | "MAESTRO_ACTUAL"
  | "HISTORICO"
  | "PRECIO_ACTUALIZADO"
  | "SIN_PRECIO";

export type BudgetPriceReviewOrigin = "MAESTRO" | "HISTORICO" | "NUEVO_PRECIO" | "MANUAL";

export type BudgetPriceReviewLine = {
  id: string;
  presupuestoId: string;
  cotizacionId: string;
  recursoId: string;
  codigo: string;
  descripcion: string;
  tipo: string | null;
  unidad: string | null;
  cantidad: number;
  precioBaseUnitario: number;
  precioOfertadoUnitario: number;
  precioBaseOrigen: BudgetPriceReviewOrigin;
  precioHistoricoId: string | null;
  precioRevisado: boolean;
};

export type BudgetPriceReviewMaster = {
  recursoId: string;
  precioUnitarioRef: number | null;
  monedaCodigo: string;
  proveedorSnapshot?: string | null;
};

export type BudgetPriceHistoryLike = {
  id: string;
  recursoId: string;
  precioUnitario: number;
  monedaCodigo: string;
  fechaPrecio: string;
  proveedorSnapshot?: string | null;
  fuenteTipo: string;
};

export type ConsolidatedBudgetPriceReviewResource = {
  recursoId: string;
  codigo: string;
  descripcion: string;
  tipo: string | null;
  unidad: string | null;
  hasIncompatibleUnits: boolean;
  apariciones: number;
  cantidadTotal: number | null;
  precioMaestroActual: number | null;
  precioBasePresupuesto: number | null;
  variacionPorcentual: number | null;
  estado: BudgetPriceReviewStatus;
  lines: BudgetPriceReviewLine[];
  histories: BudgetPriceHistoryLike[];
};

export type ApplyReviewedPriceResult = {
  updated: BudgetPriceReviewLine[];
  affectedIds: string[];
};

export function normalizePriceReviewStatus(line: Pick<BudgetPriceReviewLine, "precioBaseOrigen" | "precioRevisado" | "precioBaseUnitario">): BudgetPriceReviewStatus {
  if (!line.precioRevisado) return line.precioBaseUnitario > 0 ? "SIN_REVISAR" : "SIN_PRECIO";
  if (line.precioBaseOrigen === "MAESTRO") return "MAESTRO_ACTUAL";
  if (line.precioBaseOrigen === "HISTORICO") return "HISTORICO";
  if (line.precioBaseOrigen === "NUEVO_PRECIO") return "PRECIO_ACTUALIZADO";
  return "MANTENER";
}

export function consolidateBudgetPriceReviewResources(params: {
  lines: BudgetPriceReviewLine[];
  masters: BudgetPriceReviewMaster[];
  histories: BudgetPriceHistoryLike[];
}): ConsolidatedBudgetPriceReviewResource[] {
  const masterByResourceId = new Map(params.masters.map((master) => [master.recursoId, master]));
  const historiesByResourceId = new Map<string, BudgetPriceHistoryLike[]>();
  for (const history of params.histories) {
    historiesByResourceId.set(history.recursoId, [...(historiesByResourceId.get(history.recursoId) ?? []), history]);
  }

  const linesByResourceId = new Map<string, BudgetPriceReviewLine[]>();
  for (const line of params.lines) {
    linesByResourceId.set(line.recursoId, [...(linesByResourceId.get(line.recursoId) ?? []), line]);
  }

  return [...linesByResourceId.entries()]
    .map(([recursoId, lines]) => {
      const first = lines[0];
      const units = new Set(lines.map((line) => line.unidad ?? "").filter(Boolean));
      const hasIncompatibleUnits = units.size > 1;
      const amount = lines.reduce((total, line) => total + line.cantidad, 0);
      const uniqueBasePrices = new Set(lines.map((line) => Number(line.precioBaseUnitario.toFixed(4))));
      const precioBasePresupuesto = uniqueBasePrices.size === 1 ? lines[0].precioBaseUnitario : null;
      const precioMaestroActual = masterByResourceId.get(recursoId)?.precioUnitarioRef ?? null;
      const variacionPorcentual =
        precioBasePresupuesto !== null && precioBasePresupuesto > 0 && precioMaestroActual !== null
          ? (precioMaestroActual - precioBasePresupuesto) / precioBasePresupuesto
          : null;
      const statuses = new Set(lines.map(normalizePriceReviewStatus));
      const estado = statuses.size === 1 ? [...statuses][0] : "SIN_REVISAR";

      return {
        recursoId,
        codigo: first.codigo,
        descripcion: first.descripcion,
        tipo: first.tipo,
        unidad: hasIncompatibleUnits ? null : first.unidad,
        hasIncompatibleUnits,
        apariciones: lines.length,
        cantidadTotal: hasIncompatibleUnits ? null : amount,
        precioMaestroActual,
        precioBasePresupuesto,
        variacionPorcentual,
        estado,
        lines,
        histories: [...(historiesByResourceId.get(recursoId) ?? [])].sort(
          (left, right) => `${right.fechaPrecio}-${right.id}`.localeCompare(`${left.fechaPrecio}-${left.id}`),
        ),
      };
    })
    .sort((left, right) => `${left.codigo} ${left.descripcion}`.localeCompare(`${right.codigo} ${right.descripcion}`, "es", { sensitivity: "base" }));
}

export function applyReviewedPriceToBudgetLines(params: {
  lines: BudgetPriceReviewLine[];
  presupuestoId: string;
  recursoId: string;
  precioUnitario: number;
  origen: BudgetPriceReviewOrigin;
  precioHistoricoId?: string | null;
  manualOfferOverrideIds?: Set<string>;
}): ApplyReviewedPriceResult {
  const affectedIds: string[] = [];
  const manualOfferOverrideIds = params.manualOfferOverrideIds ?? new Set<string>();
  const updated = params.lines.map((line) => {
    if (line.presupuestoId !== params.presupuestoId || line.recursoId !== params.recursoId) return line;
    affectedIds.push(line.id);
    const marginFactor = line.precioBaseUnitario > 0 ? line.precioOfertadoUnitario / line.precioBaseUnitario : 1;
    return {
      ...line,
      precioBaseUnitario: params.precioUnitario,
      precioOfertadoUnitario: manualOfferOverrideIds.has(line.id) ? line.precioOfertadoUnitario : Number((params.precioUnitario * marginFactor).toFixed(4)),
      precioBaseOrigen: params.origen,
      precioHistoricoId: params.precioHistoricoId ?? null,
      precioRevisado: true,
    };
  });

  return { updated, affectedIds };
}

export function markBudgetResourcePriceMaintained(params: {
  lines: BudgetPriceReviewLine[];
  presupuestoId: string;
  recursoId: string;
}): ApplyReviewedPriceResult {
  const affectedIds: string[] = [];
  const updated = params.lines.map((line) => {
    if (line.presupuestoId !== params.presupuestoId || line.recursoId !== params.recursoId) return line;
    affectedIds.push(line.id);
    return { ...line, precioRevisado: true };
  });
  return { updated, affectedIds };
}

export function canApplyHistoryToResource(resourceId: string, history: Pick<BudgetPriceHistoryLike, "recursoId">): boolean {
  return history.recursoId === resourceId;
}

export function assertBudgetPriceReviewAllowed(input: {
  estado: "BORRADOR" | "LISTO_PARA_ADJUDICAR" | "ADJUDICADO";
  canEdit: boolean;
  canViewPrices: boolean;
}): void {
  if (!input.canEdit) throw new Error("No tienes permiso para editar cotizaciones.");
  if (!input.canViewPrices) throw new Error("No tienes permiso economico para revisar precios.");
  if (input.estado !== "BORRADOR") throw new Error("La revision de precios solo esta permitida en BORRADOR.");
}

export function createHistoricalPriceFromReview(input: {
  id: string;
  recursoId: string;
  precioUnitario: number;
  monedaCodigo: string;
  fechaPrecio: string;
  proveedorSnapshot?: string | null;
  fuenteTipo: string;
}): BudgetPriceHistoryLike {
  if (input.precioUnitario < 0) throw new Error("El precio debe ser mayor o igual que cero.");
  return {
    id: input.id,
    recursoId: input.recursoId,
    precioUnitario: input.precioUnitario,
    monedaCodigo: input.monedaCodigo === "USD" ? "USD" : "PEN",
    fechaPrecio: input.fechaPrecio,
    proveedorSnapshot: input.proveedorSnapshot ?? null,
    fuenteTipo: input.fuenteTipo,
  };
}
