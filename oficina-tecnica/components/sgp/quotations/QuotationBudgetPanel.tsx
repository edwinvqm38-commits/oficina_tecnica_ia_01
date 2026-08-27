"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FieldLabelIcon } from "@/components/sgp/ui/FieldLabelIcon";
import type { CotizacionEconomicRow, Recurso } from "@/lib/sgp/demoData";
import { computeBudgetResourceEconomics } from "@/lib/sgp/quotationBudgetEconomics";
import {
  addBudgetResource,
  applyBudgetResourcePriceReview,
  createBudgetNode,
  createQuotationBudget,
  createQuotationBudgetFromTechnicalProposal,
  deleteBudgetNode,
  getQuotationBudgetDetail,
  listResourcePriceHistories,
  listQuotationBudgets,
  markBudgetReady,
  QuotationBudgetRepositoryError,
  removeBudgetResource,
  returnBudgetToDraft,
  syncQuotationBudgetEconomicsToQuotation,
  updateBudgetNode,
  updateBudgetResource,
  type EstadoPresupuestoCotizacion,
  type MonedaPresupuestoCotizacion,
  type QuotationBudget,
  type QuotationBudgetDetail,
  type QuotationBudgetNode,
  type QuotationBudgetResource,
  type ResourcePriceHistory,
  type ResourcePriceHistorySource,
  type TipoNodoPresupuestoCotizacion,
} from "@/lib/sgp/quotationBudgetsRepository";
import {
  assertBudgetPriceReviewAllowed,
  consolidateBudgetPriceReviewResources,
  type ConsolidatedBudgetPriceReviewResource,
} from "@/lib/sgp/quotationBudgetPriceReview";
import type { AdjudicatedTechnicalProposalOption } from "@/lib/sgp/adjudicatedProjectsRepository";
import { formatCurrencyNumber } from "@/lib/sgp/utils";

type QuotationBudgetPanelProps = {
  cotizacionId: string;
  monedaCodigo: MonedaPresupuestoCotizacion;
  recursos: Recurso[];
  canEdit: boolean;
  canViewPrices: boolean;
  technicalProposalOptions?: AdjudicatedTechnicalProposalOption[];
  onBudgetEconomicsSynced?: (payload: {
    presupuestoId: string;
    presupuestoRevision: number;
    propuestaTecnicaId: string | null;
    montoOfertado: number;
    resumenEconomico: CotizacionEconomicRow[];
  }) => void | Promise<void>;
};

type NodeFormState = {
  editingId: string | null;
  tipo: TipoNodoPresupuestoCotizacion;
  parentId: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  observaciones: string;
};

type ResourceFormState = {
  editingId: string | null;
  partidaId: string;
  recursoId: string;
  cantidad: string;
  precioBase: string;
  precioOfertado: string;
  observaciones: string;
};

type NewPriceFormState = {
  precio: string;
  monedaCodigo: MonedaPresupuestoCotizacion;
  fechaPrecio: string;
  proveedorSnapshot: string;
  fuenteTipo: ResourcePriceHistorySource;
  fuenteReferencia: string;
  documentoSoporteUrl: string;
  observaciones: string;
};

type TreeNode = QuotationBudgetNode & { depth: number };
type RightPanelTab = "margins" | "resources";
type BudgetTableRow =
  | { kind: "node"; node: TreeNode; base: number; ofertado: number }
  | { kind: "resource"; resource: QuotationBudgetResource; partida: TreeNode | undefined; base: number; ofertado: number };

const EMPTY_NODE_FORM: NodeFormState = {
  editingId: null,
  tipo: "CAPITULO",
  parentId: "",
  codigo: "",
  descripcion: "",
  unidad: "",
  cantidad: "",
  observaciones: "",
};

const EMPTY_RESOURCE_FORM: ResourceFormState = {
  editingId: null,
  partidaId: "",
  recursoId: "",
  cantidad: "",
  precioBase: "",
  precioOfertado: "",
  observaciones: "",
};

const STATUS_LABELS: Record<EstadoPresupuestoCotizacion, string> = {
  BORRADOR: "Borrador",
  LISTO_PARA_ADJUDICAR: "Listo para adjudicar",
  ADJUDICADO: "Adjudicado",
};

const STATUS_CLASS_NAMES: Record<EstadoPresupuestoCotizacion, string> = {
  BORRADOR: "border-stone-200 bg-stone-50 text-stone-600",
  LISTO_PARA_ADJUDICAR: "border-amber-200 bg-amber-50 text-amber-700",
  ADJUDICADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const PRICE_REVIEW_STATUS_LABELS: Record<string, string> = {
  SIN_REVISAR: "Sin revisar",
  MANTENER: "Mantener",
  MAESTRO_ACTUAL: "Maestro actual",
  HISTORICO: "Historico",
  PRECIO_ACTUALIZADO: "Precio actualizado",
  SIN_PRECIO: "Sin precio",
};

const PRICE_SOURCE_OPTIONS: Array<{ value: ResourcePriceHistorySource; label: string }> = [
  { value: "COTIZACION_PROVEEDOR", label: "Cotizacion proveedor" },
  { value: "WEB", label: "Web" },
  { value: "OC_HISTORICA", label: "OC historica" },
  { value: "COMPRA_HISTORICA", label: "Compra historica" },
  { value: "MANUAL", label: "Manual" },
  { value: "OTRO", label: "Otro" },
];

const NODE_TYPE_LABELS: Record<TipoNodoPresupuestoCotizacion, string> = {
  CAPITULO: "Capitulo",
  SUBCAPITULO: "Subcapitulo",
  PARTIDA: "Partida",
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyNewPriceForm(monedaCodigo: MonedaPresupuestoCotizacion): NewPriceFormState {
  return {
    precio: "",
    monedaCodigo,
    fechaPrecio: todayIsoDate(),
    proveedorSnapshot: "",
    fuenteTipo: "COTIZACION_PROVEEDOR",
    fuenteReferencia: "",
    documentoSoporteUrl: "",
    observaciones: "",
  };
}

function normalizeText(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function optionalPositiveNumber(value: string, label: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${label} debe ser mayor a cero.`);
  }
  return numeric;
}

function requiredBudgetNumber(value: string, label: string, options: { positive: boolean }): number {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} es obligatorio.`);
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) throw new Error(`${label} debe ser numerico.`);
  if (options.positive && numeric <= 0) throw new Error(`${label} debe ser mayor a cero.`);
  if (!options.positive && numeric < 0) throw new Error(`${label} no puede ser negativo.`);
  return numeric;
}

function formatBudgetNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return Number.isFinite(value) ? String(value) : "";
}

function formNumber(value: string): number {
  const numeric = Number(value.trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(value: number, currency: MonedaPresupuestoCotizacion): string {
  return `${currency} ${formatCurrencyNumber(value)}`;
}

function percentLabel(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function signedPercentLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function formatBudgetError(error: unknown, fallback: string): string {
  if (error instanceof QuotationBudgetRepositoryError) return error.message;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function sortBudgetNodes(nodes: QuotationBudgetNode[]): QuotationBudgetNode[] {
  return [...nodes].sort((a, b) => {
    const orderDiff = a.orden - b.orden;
    if (orderDiff !== 0) return orderDiff;
    return `${a.codigo ?? ""} ${a.descripcion}`.localeCompare(`${b.codigo ?? ""} ${b.descripcion}`, "es", {
      sensitivity: "base",
    });
  });
}

function flattenBudgetTree(nodes: QuotationBudgetNode[]): TreeNode[] {
  const byParent = new Map<string | null, QuotationBudgetNode[]>();
  for (const node of nodes) {
    const current = byParent.get(node.parentId) ?? [];
    current.push(node);
    byParent.set(node.parentId, current);
  }
  for (const [parentId, children] of byParent) {
    byParent.set(parentId, sortBudgetNodes(children));
  }

  const result: TreeNode[] = [];
  const visited = new Set<string>();
  const visit = (parentId: string | null, depth: number) => {
    for (const node of byParent.get(parentId) ?? []) {
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      result.push({ ...node, depth });
      visit(node.id, depth + 1);
    }
  };

  visit(null, 0);
  for (const node of sortBudgetNodes(nodes)) {
    if (!visited.has(node.id)) {
      result.push({ ...node, depth: 0 });
    }
  }
  return result;
}

function resourceLabel(resource: Recurso): string {
  const code = resource.codigo_recurso || resource.codigo_eka || resource.codigo_fabricante || resource.id;
  return `${code} - ${resource.descripcion}`;
}

function budgetResourceType(resource: QuotationBudgetResource): string {
  return resource.tipoRecursoSnapshot ?? resource.recurso?.tipoRecurso ?? "Sin tipo";
}

function budgetResourceDescription(resource: QuotationBudgetResource): string {
  return resource.descripcionSnapshot ?? resource.recurso?.descripcion ?? resource.recursoId;
}

function budgetResourceCode(resource: QuotationBudgetResource): string {
  return resource.codigoRecursoSnapshot ?? resource.recurso?.codigoRecurso ?? "";
}

function budgetResourceUnit(resource: QuotationBudgetResource): string {
  return resource.unidadSnapshot ?? resource.recurso?.unidad ?? "-";
}

export function QuotationBudgetPanel({
  cotizacionId,
  monedaCodigo,
  recursos,
  canEdit,
  canViewPrices,
  technicalProposalOptions = [],
  onBudgetEconomicsSynced,
}: QuotationBudgetPanelProps) {
  const [budgets, setBudgets] = useState<QuotationBudget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [detail, setDetail] = useState<QuotationBudgetDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [nodeForm, setNodeForm] = useState<NodeFormState>(EMPTY_NODE_FORM);
  const [resourceForm, setResourceForm] = useState<ResourceFormState>(EMPTY_RESOURCE_FORM);
  const [technicalProposalIdToImport, setTechnicalProposalIdToImport] = useState("");
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("margins");
  const [marginDrafts, setMarginDrafts] = useState<Record<string, string>>({});
  const [resourceSearch, setResourceSearch] = useState("");
  const [selectedBrowserResourceId, setSelectedBrowserResourceId] = useState<string>("");
  const [priceReviewOpen, setPriceReviewOpen] = useState(false);
  const [priceReviewLoading, setPriceReviewLoading] = useState(false);
  const [priceHistories, setPriceHistories] = useState<ResourcePriceHistory[]>([]);
  const [selectedPriceReviewResourceId, setSelectedPriceReviewResourceId] = useState<string>("");
  const [selectedPriceHistoryId, setSelectedPriceHistoryId] = useState<string>("");
  const [newPriceForm, setNewPriceForm] = useState<NewPriceFormState>(() => emptyNewPriceForm(monedaCodigo));
  const [manualOfferOverrideResourceIds, setManualOfferOverrideResourceIds] = useState<Set<string>>(() => new Set());
  const mountedRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const mutationInFlightRef = useRef(false);

  const reload = useCallback(
    async (preferredBudgetId?: string) => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      setLoading(true);
      setError(null);
      try {
        const nextBudgets = await listQuotationBudgets(cotizacionId);
        const targetId = preferredBudgetId || nextBudgets.at(-1)?.id || "";
        const nextDetail = targetId ? await getQuotationBudgetDetail(targetId) : null;
        if (!mountedRef.current || loadRequestIdRef.current !== requestId) return;
        setBudgets(nextBudgets);
        setSelectedBudgetId(targetId);
        setDetail(nextDetail);
      } catch (nextError) {
        if (!mountedRef.current || loadRequestIdRef.current !== requestId) return;
        setDetail(null);
        setError(formatBudgetError(nextError, "No se pudo cargar el presupuesto detallado."));
      } finally {
        if (mountedRef.current && loadRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [cotizacionId],
  );

  const loadPriceHistories = useCallback(async (resourceIds: string[]) => {
    const uniqueIds = Array.from(new Set(resourceIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      setPriceHistories([]);
      return;
    }
    setPriceReviewLoading(true);
    try {
      const histories = await listResourcePriceHistories(uniqueIds);
      if (!mountedRef.current) return;
      setPriceHistories(histories);
    } catch (nextError) {
      if (!mountedRef.current) return;
      setError(formatBudgetError(nextError, "No se pudieron cargar los historicos de precios."));
    } finally {
      if (mountedRef.current) setPriceReviewLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadRequestIdRef.current += 1;
      mutationInFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => reload());
  }, [reload]);

  const selectedBudget = detail?.presupuesto ?? null;
  const isDraft = selectedBudget?.estado === "BORRADOR";
  const isAwarded = selectedBudget?.estado === "ADJUDICADO";
  const hasAwardedBudget = budgets.some((budget) => budget.estado === "ADJUDICADO");
  const canEditDraftStructure = Boolean(canEdit && isDraft);
  const canEditDraftResources = canEditDraftStructure && canViewPrices;

  const treeNodes = useMemo(() => flattenBudgetTree(detail?.partidas ?? []), [detail?.partidas]);
  const parentOptions = useMemo(() => {
    if (!detail) return [];
    if (nodeForm.tipo === "SUBCAPITULO") {
      return detail.partidas.filter((node) => node.tipo === "CAPITULO" && node.id !== nodeForm.editingId);
    }
    if (nodeForm.tipo === "PARTIDA") {
      return detail.partidas.filter(
        (node) => (node.tipo === "CAPITULO" || node.tipo === "SUBCAPITULO") && node.id !== nodeForm.editingId,
      );
    }
    return [];
  }, [detail, nodeForm.editingId, nodeForm.tipo]);
  const partidas = useMemo(() => (detail?.partidas ?? []).filter((node) => node.tipo === "PARTIDA"), [detail?.partidas]);
  const activeResources = useMemo(
    () =>
      [...recursos]
        .filter((resource) => resource.estado !== "Inactivo")
        .sort((a, b) => resourceLabel(a).localeCompare(resourceLabel(b), "es", { sensitivity: "base" })),
    [recursos],
  );
  const completedTechnicalProposalOptions = useMemo(
    () =>
      technicalProposalOptions.filter((option) => {
        const workStatus = option.work_status?.trim().toLowerCase();
        return workStatus === "completado" || workStatus === "completed";
      }),
    [technicalProposalOptions],
  );
  const importedTechnicalProposalIds = useMemo(
    () => new Set(budgets.map((budget) => budget.propuestaTecnicaId).filter(Boolean) as string[]),
    [budgets],
  );
  const filteredBrowserResources = useMemo(() => {
    const normalized = resourceSearch.trim().toLowerCase();
    if (!normalized) return activeResources.slice(0, 40);
    return activeResources
      .filter((resource) =>
        [
          resource.codigo_recurso,
          resource.codigo_eka,
          resource.codigo_fabricante,
          resource.descripcion,
          resource.tipo_recurso,
          resource.unidad,
          resource.marca,
          resource.proveedor,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 40);
  }, [activeResources, resourceSearch]);
  const catalogById = useMemo(() => new Map(recursos.map((resource) => [resource.id, resource])), [recursos]);
  const selectedCatalogResource = resourceForm.recursoId ? catalogById.get(resourceForm.recursoId) ?? null : null;
  const selectedBrowserResource = selectedBrowserResourceId ? catalogById.get(selectedBrowserResourceId) ?? null : null;
  const resourceFormPreview = useMemo(() => {
    const cantidad = formNumber(resourceForm.cantidad);
    const precioBase = formNumber(resourceForm.precioBase);
    const precioOfertado = formNumber(resourceForm.precioOfertado);
    const base = cantidad * precioBase;
    const ofertado = cantidad * precioOfertado;
    const margen = ofertado - base;
    return {
      base,
      ofertado,
      margen,
      porcentajeMargen: base > 0 ? margen / base : 0,
    };
  }, [resourceForm.cantidad, resourceForm.precioBase, resourceForm.precioOfertado]);
  const priceReviewResources = useMemo<ConsolidatedBudgetPriceReviewResource[]>(() => {
    if (!detail) return [];
    return consolidateBudgetPriceReviewResources({
      lines: detail.recursos.map((resource) => ({
        id: resource.id,
        presupuestoId: detail.presupuesto.id,
        cotizacionId,
        recursoId: resource.recursoId,
        codigo: budgetResourceCode(resource) || resource.recursoId,
        descripcion: budgetResourceDescription(resource),
        tipo: budgetResourceType(resource),
        unidad: budgetResourceUnit(resource),
        cantidad: resource.cantidadPresupuestada,
        precioBaseUnitario: resource.precioBaseUnitario,
        precioOfertadoUnitario: resource.precioOfertadoUnitario,
        precioBaseOrigen: resource.precioBaseOrigen,
        precioHistoricoId: resource.precioHistoricoId,
        precioRevisado: resource.precioRevisado,
      })),
      masters: recursos.map((resource) => ({
        recursoId: resource.id,
        precioUnitarioRef: Number.isFinite(resource.precio_unitario_ref) ? resource.precio_unitario_ref : null,
        monedaCodigo: resource.moneda,
        proveedorSnapshot: resource.proveedor,
      })),
      histories: priceHistories.map((history) => ({
        id: history.id,
        recursoId: history.recursoId,
        precioUnitario: history.precioUnitario,
        monedaCodigo: history.monedaCodigo,
        fechaPrecio: history.fechaPrecio,
        proveedorSnapshot: history.proveedorSnapshot,
        fuenteTipo: history.fuenteTipo,
      })),
    });
  }, [cotizacionId, detail, priceHistories, recursos]);
  const selectedPriceReviewResource = useMemo(
    () =>
      priceReviewResources.find((resource) => resource.recursoId === selectedPriceReviewResourceId) ??
      priceReviewResources[0] ??
      null,
    [priceReviewResources, selectedPriceReviewResourceId],
  );
  const selectedPriceHistory = useMemo(
    () => selectedPriceReviewResource?.histories.find((history) => history.id === selectedPriceHistoryId) ?? null,
    [selectedPriceHistoryId, selectedPriceReviewResource],
  );
  const budgetTableRows = useMemo<BudgetTableRow[]>(() => {
    if (!detail) return [];
    const childrenByParent = new Map<string | null, QuotationBudgetNode[]>();
    for (const node of detail.partidas) {
      childrenByParent.set(node.parentId, [...(childrenByParent.get(node.parentId) ?? []), node]);
    }
    for (const [parentId, children] of childrenByParent) {
      childrenByParent.set(parentId, sortBudgetNodes(children));
    }

    const resourcesByPartida = new Map<string, QuotationBudgetResource[]>();
    for (const resource of detail.recursos) {
      resourcesByPartida.set(resource.partidaId, [...(resourcesByPartida.get(resource.partidaId) ?? []), resource]);
    }
    for (const [partidaId, rows] of resourcesByPartida) {
      resourcesByPartida.set(partidaId, [...rows].sort((left, right) => left.orden - right.orden));
    }

    const totalsByNodeId = new Map<string, { base: number; ofertado: number }>();
    const computeNodeTotal = (node: QuotationBudgetNode): { base: number; ofertado: number } => {
      const ownResources = resourcesByPartida.get(node.id) ?? [];
      const ownTotal = ownResources.reduce(
        (total, resource) => {
          const economics = computeBudgetResourceEconomics({
            id: resource.id,
            partidaId: resource.partidaId,
            recursoId: resource.recursoId,
            cantidadPresupuestada: resource.cantidadPresupuestada,
            precioBaseUnitario: resource.precioBaseUnitario,
            precioOfertadoUnitario: resource.precioOfertadoUnitario,
            tipoRecurso: budgetResourceType(resource),
          });
          return { base: total.base + economics.base, ofertado: total.ofertado + economics.ofertado };
        },
        { base: 0, ofertado: 0 },
      );
      const childTotal = (childrenByParent.get(node.id) ?? []).reduce(
        (total, child) => {
          const childEconomics = computeNodeTotal(child);
          return { base: total.base + childEconomics.base, ofertado: total.ofertado + childEconomics.ofertado };
        },
        { base: 0, ofertado: 0 },
      );
      const total = { base: ownTotal.base + childTotal.base, ofertado: ownTotal.ofertado + childTotal.ofertado };
      totalsByNodeId.set(node.id, total);
      return total;
    };

    for (const root of childrenByParent.get(null) ?? []) {
      computeNodeTotal(root);
    }
    for (const node of detail.partidas) {
      if (!totalsByNodeId.has(node.id)) computeNodeTotal(node);
    }

    const rows: BudgetTableRow[] = [];
    for (const node of treeNodes) {
      const total = totalsByNodeId.get(node.id) ?? { base: 0, ofertado: 0 };
      rows.push({ kind: "node", node, base: total.base, ofertado: total.ofertado });
      if (node.tipo === "PARTIDA") {
        for (const resource of resourcesByPartida.get(node.id) ?? []) {
          const economics = computeBudgetResourceEconomics({
            id: resource.id,
            partidaId: resource.partidaId,
            recursoId: resource.recursoId,
            cantidadPresupuestada: resource.cantidadPresupuestada,
            precioBaseUnitario: resource.precioBaseUnitario,
            precioOfertadoUnitario: resource.precioOfertadoUnitario,
            tipoRecurso: budgetResourceType(resource),
          });
          rows.push({ kind: "resource", resource, partida: node, base: economics.base, ofertado: economics.ofertado });
        }
      }
    }
    return rows;
  }, [detail, treeNodes]);

  const runAction = async (action: () => Promise<void>, successMessage?: string) => {
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      if (mountedRef.current && successMessage) setMessage(successMessage);
    } catch (nextError) {
      if (mountedRef.current) {
        setError(formatBudgetError(nextError, "No se pudo completar la accion."));
      }
    } finally {
      mutationInFlightRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  const handleCreateBudget = () =>
    runAction(async () => {
      const budget = await createQuotationBudget({ cotizacionId, monedaCodigo });
      await reload(budget.id);
    }, "Presupuesto creado.");

  const handleCreateBudgetFromTechnicalProposal = () =>
    runAction(async () => {
      if (!technicalProposalIdToImport) throw new Error("Selecciona una propuesta tecnica completada.");
      const budget = await createQuotationBudgetFromTechnicalProposal(technicalProposalIdToImport);
      setTechnicalProposalIdToImport("");
      await reload(budget.id);
    }, "Presupuesto creado desde propuesta tecnica.");

  const handleSyncEconomicsToQuotation = () =>
    runAction(async () => {
      if (!selectedBudget) return;
      const result = await syncQuotationBudgetEconomicsToQuotation(selectedBudget.id);
      await onBudgetEconomicsSynced?.({
        presupuestoId: result.presupuestoId,
        presupuestoRevision: result.presupuestoRevision,
        propuestaTecnicaId: result.propuestaTecnicaId,
        montoOfertado: result.montoOfertado,
        resumenEconomico: result.resumenEconomico,
      });
      await reload(selectedBudget.id);
    }, "Monto ofertado sincronizado con la cotizacion.");

  const handleSelectBudget = (budgetId: string) => {
    setSelectedBudgetId(budgetId);
    setNodeForm(EMPTY_NODE_FORM);
    setResourceForm(EMPTY_RESOURCE_FORM);
    void reload(budgetId);
  };

  const handleNodeSubmit = () =>
    runAction(async () => {
      const descripcion = nodeForm.descripcion.trim();
      if (!descripcion) throw new Error("La descripcion es obligatoria.");
      const parentId = nodeForm.tipo === "CAPITULO" ? null : normalizeText(nodeForm.parentId);
      if (nodeForm.tipo !== "CAPITULO" && !parentId) throw new Error("Selecciona un padre para la partida.");
      const payload = {
        parentId,
        tipo: nodeForm.tipo,
        codigo: normalizeText(nodeForm.codigo),
        descripcion,
        unidad: normalizeText(nodeForm.unidad),
        cantidad: optionalPositiveNumber(nodeForm.cantidad, "La cantidad"),
        observaciones: normalizeText(nodeForm.observaciones),
      };

      if (nodeForm.editingId) {
        await updateBudgetNode(nodeForm.editingId, payload);
      } else if (selectedBudget) {
        await createBudgetNode({ presupuestoId: selectedBudget.id, ...payload });
      }
      setNodeForm(EMPTY_NODE_FORM);
      if (selectedBudget) await reload(selectedBudget.id);
    }, nodeForm.editingId ? "Partida actualizada." : "Partida creada.");

  const handleEditNode = (node: QuotationBudgetNode) => {
    setNodeForm({
      editingId: node.id,
      tipo: node.tipo,
      parentId: node.parentId ?? "",
      codigo: node.codigo ?? "",
      descripcion: node.descripcion,
      unidad: node.unidad ?? "",
      cantidad: formatBudgetNumber(node.cantidad),
      observaciones: node.observaciones ?? "",
    });
  };

  const handleDeleteNode = (node: QuotationBudgetNode) => {
    if (!window.confirm(`Eliminar ${NODE_TYPE_LABELS[node.tipo].toLowerCase()} "${node.descripcion}"?`)) return;
    void runAction(async () => {
      await deleteBudgetNode(node.id);
      if (selectedBudget) await reload(selectedBudget.id);
    }, "Partida eliminada.");
  };

  const handleResourceSubmit = () =>
    runAction(async () => {
      if (!resourceForm.partidaId) throw new Error("Selecciona una partida.");
      if (!resourceForm.recursoId) throw new Error("Selecciona un recurso del catalogo maestro.");
      const payload = {
        recursoId: resourceForm.recursoId,
        cantidadPresupuestada: requiredBudgetNumber(resourceForm.cantidad, "La cantidad", { positive: true }),
        precioBaseUnitario: requiredBudgetNumber(resourceForm.precioBase, "El precio base unitario", { positive: false }),
        precioOfertadoUnitario: requiredBudgetNumber(resourceForm.precioOfertado, "El precio ofertado unitario", { positive: false }),
        observaciones: normalizeText(resourceForm.observaciones),
      };

      if (resourceForm.editingId) {
        const previousResource = detail?.recursos.find((resource) => resource.id === resourceForm.editingId);
        await updateBudgetResource(resourceForm.editingId, payload);
        if (previousResource && payload.precioOfertadoUnitario !== previousResource.precioOfertadoUnitario) {
          setManualOfferOverrideResourceIds((prev) => new Set(prev).add(resourceForm.editingId as string));
        }
      } else {
        await addBudgetResource({ partidaId: resourceForm.partidaId, ...payload });
      }
      setResourceForm((prev) => ({ ...EMPTY_RESOURCE_FORM, partidaId: prev.partidaId }));
      if (selectedBudget) await reload(selectedBudget.id);
    }, resourceForm.editingId ? "Recurso actualizado." : "Recurso agregado.");

  const handleEditResource = (resource: QuotationBudgetResource) => {
    setResourceForm({
      editingId: resource.id,
      partidaId: resource.partidaId,
      recursoId: resource.recursoId,
      cantidad: formatBudgetNumber(resource.cantidadPresupuestada),
      precioBase: formatBudgetNumber(resource.precioBaseUnitario),
      precioOfertado: formatBudgetNumber(resource.precioOfertadoUnitario),
      observaciones: resource.observaciones ?? "",
    });
  };

  const handleRemoveResource = (resource: QuotationBudgetResource) => {
    const label = budgetResourceDescription(resource);
    if (!window.confirm(`Eliminar recurso "${label}" del presupuesto?`)) return;
    void runAction(async () => {
      await removeBudgetResource(resource.id);
      if (selectedBudget) await reload(selectedBudget.id);
    }, "Recurso eliminado.");
  };

  const handleApplyMarginToType = (tipoRecurso: string) =>
    runAction(async () => {
      if (!selectedBudget) return;
      const currentMargin = detail?.economia.tiposRecurso.find((row) => row.tipoRecurso === tipoRecurso)?.porcentajeMargen ?? 0;
      const marginPercent = Number(marginDrafts[tipoRecurso] ?? (currentMargin * 100).toFixed(2));
      if (!Number.isFinite(marginPercent) || marginPercent < -100) throw new Error("El margen debe ser numerico y mayor o igual a -100%.");
      const multiplier = 1 + marginPercent / 100;
      const resourcesToUpdate = detail?.recursos.filter((resource) => budgetResourceType(resource) === tipoRecurso) ?? [];
      await Promise.all(
        resourcesToUpdate
          .filter((resource) => !manualOfferOverrideResourceIds.has(resource.id))
          .map((resource) =>
            updateBudgetResource(resource.id, {
              precioOfertadoUnitario: Number((resource.precioBaseUnitario * multiplier).toFixed(4)),
            }),
          ),
      );
      await reload(selectedBudget.id);
    }, `Margen aplicado a ${tipoRecurso}.`);

  const handleResetOfferToTypeMargin = (resource: QuotationBudgetResource) =>
    runAction(async () => {
      if (!selectedBudget) return;
      const tipoRecurso = budgetResourceType(resource);
      const currentMargin = detail?.economia.tiposRecurso.find((row) => row.tipoRecurso === tipoRecurso)?.porcentajeMargen ?? 0;
      const marginPercent = Number(marginDrafts[tipoRecurso] ?? (currentMargin * 100).toFixed(2));
      if (!Number.isFinite(marginPercent) || marginPercent < -100) throw new Error("El margen debe ser numerico y mayor o igual a -100%.");
      await updateBudgetResource(resource.id, {
        precioOfertadoUnitario: Number((resource.precioBaseUnitario * (1 + marginPercent / 100)).toFixed(4)),
      });
      setManualOfferOverrideResourceIds((prev) => {
        const next = new Set(prev);
        next.delete(resource.id);
        return next;
      });
      await reload(selectedBudget.id);
    }, "Precio ofertado restablecido al margen del tipo.");

  const handleOpenPriceReview = () => {
    if (!selectedBudget || !detail) return;
    try {
      assertBudgetPriceReviewAllowed({
        estado: selectedBudget.estado,
        canEdit,
        canViewPrices,
      });
    } catch (nextError) {
      setMessage(null);
      setError(formatBudgetError(nextError, "No se puede revisar precios."));
      if (canViewPrices) setPriceReviewOpen(true);
      void loadPriceHistories(detail.recursos.map((resource) => resource.recursoId));
      return;
    }

    setPriceReviewOpen(true);
    setSelectedPriceReviewResourceId((prev) => prev || detail.recursos[0]?.recursoId || "");
    setSelectedPriceHistoryId("");
    setNewPriceForm(emptyNewPriceForm(detail.presupuesto.monedaCodigo));
    void loadPriceHistories(detail.recursos.map((resource) => resource.recursoId));
  };

  const reloadPriceReviewAfterMutation = async () => {
    if (!selectedBudget || !detail) return;
    const resourceIds = detail.recursos.map((resource) => resource.recursoId);
    await reload(selectedBudget.id);
    await loadPriceHistories(resourceIds);
  };

  const handleApplyPriceReviewAction = (
    accion: "MANTENER" | "MAESTRO" | "HISTORICO",
    options: { precioHistoricoId?: string | null; observaciones?: string | null } = {},
  ) =>
    runAction(async () => {
      if (!selectedBudget || !selectedPriceReviewResource) return;
      await applyBudgetResourcePriceReview({
        presupuestoId: selectedBudget.id,
        recursoId: selectedPriceReviewResource.recursoId,
        accion,
        precioHistoricoId: options.precioHistoricoId ?? null,
        observaciones: options.observaciones ?? null,
        manualOfferOverrideResourceIds: Array.from(manualOfferOverrideResourceIds),
      });
      await reloadPriceReviewAfterMutation();
      setSelectedPriceHistoryId("");
    }, accion === "MANTENER" ? "Precio marcado como revisado." : "Precio aplicado al presupuesto.");

  const handleRegisterAndApplyNewPrice = () =>
    runAction(async () => {
      if (!selectedBudget || !selectedPriceReviewResource) return;
      const price = requiredBudgetNumber(newPriceForm.precio, "El precio nuevo", { positive: false });
      await applyBudgetResourcePriceReview({
        presupuestoId: selectedBudget.id,
        recursoId: selectedPriceReviewResource.recursoId,
        accion: "NUEVO_PRECIO",
        precioUnitario: price,
        monedaCodigo: newPriceForm.monedaCodigo,
        fechaPrecio: newPriceForm.fechaPrecio || todayIsoDate(),
        proveedorSnapshot: newPriceForm.proveedorSnapshot,
        fuenteTipo: newPriceForm.fuenteTipo,
        fuenteReferencia: newPriceForm.fuenteReferencia,
        documentoSoporteUrl: newPriceForm.documentoSoporteUrl,
        observaciones: newPriceForm.observaciones,
        manualOfferOverrideResourceIds: Array.from(manualOfferOverrideResourceIds),
      });
      setNewPriceForm(emptyNewPriceForm(selectedBudget.monedaCodigo));
      await reloadPriceReviewAfterMutation();
    }, "Nuevo precio registrado y aplicado.");

  const selectBrowserResource = (resource: Recurso) => {
    setSelectedBrowserResourceId(resource.id);
    const targetPartidaId = resourceForm.partidaId || partidas[0]?.id || "";
    setResourceForm((prev) => ({
      ...prev,
      partidaId: targetPartidaId,
      recursoId: resource.id,
      precioBase: prev.precioBase || formatBudgetNumber(resource.precio_unitario_ref),
      precioOfertado: prev.precioOfertado || formatBudgetNumber(resource.precio_unitario_ref),
    }));
  };

  const handleMarkReady = () =>
    runAction(async () => {
      if (!selectedBudget) return;
      await markBudgetReady(selectedBudget.id);
      await reload(selectedBudget.id);
    }, "Presupuesto listo para adjudicar.");

  const handleReturnDraft = () =>
    runAction(async () => {
      if (!selectedBudget) return;
      await returnBudgetToDraft(selectedBudget.id);
      await reload(selectedBudget.id);
    }, "Presupuesto devuelto a borrador.");

  return (
    <div className="flex min-h-[360px] flex-col gap-2 border-t border-stone-200 pt-2 text-[11px] text-stone-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <select
            value={selectedBudgetId}
            onChange={(event) => handleSelectBudget(event.target.value)}
            disabled={loading || saving || budgets.length === 0}
            className="h-7 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400"
          >
            {budgets.length === 0 ? (
              <option value="">Sin presupuesto detallado</option>
            ) : (
              budgets.map((budget) => (
                <option key={budget.id} value={budget.id}>
                  Revision {budget.revision} - {STATUS_LABELS[budget.estado]}
                </option>
              ))
            )}
          </select>
          {selectedBudget ? (
            <span className={`rounded-full border px-2 py-1 text-[10px] ${STATUS_CLASS_NAMES[selectedBudget.estado]}`}>
              {STATUS_LABELS[selectedBudget.estado]}
            </span>
          ) : null}
          {loading ? <span className="text-[10px] text-stone-400">Cargando...</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {canEdit ? (
            <button
              type="button"
              onClick={handleCreateBudget}
              disabled={saving || hasAwardedBudget}
              className="inline-flex h-7 items-center gap-1 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
              title={hasAwardedBudget ? "La cotizacion ya tiene presupuesto adjudicado" : "Crear nueva revision"}
            >
              <span className="text-sm leading-none">+</span>
              Nueva revision
            </button>
          ) : null}
          {canEdit && completedTechnicalProposalOptions.length > 0 ? (
            <div className="flex min-w-[260px] items-center gap-1">
              <select
                value={technicalProposalIdToImport}
                onChange={(event) => setTechnicalProposalIdToImport(event.target.value)}
                disabled={saving || hasAwardedBudget}
                className="h-7 min-w-0 flex-1 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-600 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400"
              >
                <option value="">Importar PT completada</option>
                {completedTechnicalProposalOptions.map((option) => (
                  <option key={option.id} value={option.id} disabled={importedTechnicalProposalIds.has(option.id)}>
                    {option.revision || "REV"} - {option.code || option.cotizacion_codigo}
                    {importedTechnicalProposalIds.has(option.id) ? " (ya importada)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreateBudgetFromTechnicalProposal}
                disabled={saving || hasAwardedBudget || !technicalProposalIdToImport || importedTechnicalProposalIds.has(technicalProposalIdToImport)}
                className="h-7 rounded border border-teal-200 bg-teal-50 px-2 text-[10px] font-medium text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Crear
              </button>
            </div>
          ) : null}
          {selectedBudget && canViewPrices ? (
            <button
              type="button"
              onClick={handleOpenPriceReview}
              disabled={saving || (detail?.recursos.length ?? 0) === 0}
              className="h-7 rounded border border-sky-200 bg-sky-50 px-2 text-[10px] font-medium text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Revisar precios base del presupuesto abierto"
            >
              Revisar precios
            </button>
          ) : null}
          {selectedBudget && canViewPrices ? (
            <button
              type="button"
              onClick={handleSyncEconomicsToQuotation}
              disabled={saving}
              className="h-7 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Actualiza monto ofertado y resumen economico de la cotizacion"
            >
              Guardar presupuesto
            </button>
          ) : null}
          {selectedBudget?.estado === "BORRADOR" && canEdit ? (
            <button
              type="button"
              onClick={handleMarkReady}
              disabled={saving}
              className="h-7 rounded border border-amber-200 bg-amber-50 px-2 text-[10px] text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Listo para adjudicar
            </button>
          ) : null}
          {selectedBudget?.estado === "LISTO_PARA_ADJUDICAR" && canEdit ? (
            <button
              type="button"
              onClick={handleReturnDraft}
              disabled={saving}
              className="h-7 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Volver a borrador
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{error}</div> : null}
      {message ? <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">{message}</div> : null}
      {!canViewPrices ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
          Valores economicos ocultos por permisos. La edicion de recursos presupuestados queda deshabilitada.
        </div>
      ) : null}

      {!detail ? (
        <div className="flex min-h-[260px] items-center justify-center rounded border border-stone-200 bg-stone-50 px-3 text-center text-[11px] text-stone-500">
          No existe presupuesto detallado para esta cotizacion.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <BudgetMetric label="Base" value={canViewPrices ? formatMoney(detail.economia.total.base, detail.presupuesto.monedaCodigo) : "-"} />
            <BudgetMetric label="Ofertado" value={canViewPrices ? formatMoney(detail.economia.total.ofertado, detail.presupuesto.monedaCodigo) : "-"} />
            <BudgetMetric label="Margen" value={canViewPrices ? formatMoney(detail.economia.total.margen, detail.presupuesto.monedaCodigo) : "-"} />
            <BudgetMetric label="% margen" value={canViewPrices ? percentLabel(detail.economia.total.porcentajeMargen) : "-"} />
          </div>

          <div className="grid min-h-0 grid-cols-1 gap-2 xl:grid-cols-[minmax(0,65fr)_minmax(280px,35fr)]">
          <div className="min-w-0 space-y-2">
          <section className="min-h-0 rounded border border-stone-200 bg-white">
            <div className="flex h-8 items-center justify-between gap-2 border-b border-stone-200 px-2">
              <FieldLabelIcon icon="clipboard-list" label="Estructura presupuestal" className="text-[11px] font-medium" />
              {isAwarded ? <span className="text-[10px] text-stone-500">Solo lectura</span> : null}
            </div>
            <div className="app-table-scroll max-h-[250px] overflow-auto">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
                <colgroup>
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "120px" }} />
                  <col />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "150px" }} />
                  <col style={{ width: "95px" }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-stone-50 text-muted">
                  <tr>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Codigo</th>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Tipo</th>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Descripcion</th>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Unidad</th>
                    <th className="h-[26px] px-2 py-0 text-right font-semibold">Cant.</th>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Obs.</th>
                    <th className="h-[26px] px-2 py-0 text-center font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {treeNodes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="h-[44px] px-2 text-center text-stone-500">
                        Sin capitulos ni partidas.
                      </td>
                    </tr>
                  ) : (
                    treeNodes.map((node) => (
                      <tr key={node.id} className="h-[28px] border-t border-border">
                        <td className="px-2 py-0 align-middle">
                          <span className="block truncate" title={node.codigo ?? ""}>
                            {node.codigo || "-"}
                          </span>
                        </td>
                        <td className="px-2 py-0 align-middle">
                          <span className="block truncate">{NODE_TYPE_LABELS[node.tipo]}</span>
                        </td>
                        <td className="px-2 py-0 align-middle">
                          <span
                            className={`block truncate ${node.tipo === "PARTIDA" ? "text-stone-700" : "font-semibold text-stone-800"}`}
                            style={{ paddingLeft: `${Math.min(node.depth, 3) * 16}px` }}
                            title={node.descripcion}
                          >
                            {node.descripcion}
                          </span>
                        </td>
                        <td className="px-2 py-0 align-middle">{node.unidad || "-"}</td>
                        <td className="px-2 py-0 text-right align-middle">{node.cantidad ?? ""}</td>
                        <td className="px-2 py-0 align-middle">
                          <span className="block truncate" title={node.observaciones ?? ""}>
                            {node.observaciones || ""}
                          </span>
                        </td>
                        <td className="px-1 py-0 text-center align-middle">
                          {canEditDraftStructure ? (
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditNode(node)}
                                disabled={saving}
                                className="h-6 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNode(node)}
                                disabled={saving}
                                className="h-6 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-stone-200 disabled:hover:bg-white disabled:hover:text-stone-600"
                              >
                                X
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {canEditDraftStructure ? (
              <div className="grid grid-cols-1 gap-2 border-t border-stone-200 bg-stone-50 p-2 lg:grid-cols-[105px_160px_100px_1fr_82px_82px_1fr_116px]">
                <select
                  value={nodeForm.tipo}
                  onChange={(event) =>
                    setNodeForm((prev) => ({ ...prev, tipo: event.target.value as TipoNodoPresupuestoCotizacion, parentId: "" }))
                  }
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-[11px]"
                >
                  <option value="CAPITULO">Capitulo</option>
                  <option value="SUBCAPITULO">Subcapitulo</option>
                  <option value="PARTIDA">Partida</option>
                </select>
                <select
                  value={nodeForm.parentId}
                  onChange={(event) => setNodeForm((prev) => ({ ...prev, parentId: event.target.value }))}
                  disabled={nodeForm.tipo === "CAPITULO"}
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-[11px] disabled:bg-stone-100 disabled:text-stone-400"
                >
                  <option value="">{nodeForm.tipo === "CAPITULO" ? "Sin padre" : "Seleccionar padre"}</option>
                  {parentOptions.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.codigo ? `${parent.codigo} - ` : ""}
                      {parent.descripcion}
                    </option>
                  ))}
                </select>
                <input
                  value={nodeForm.codigo}
                  onChange={(event) => setNodeForm((prev) => ({ ...prev, codigo: event.target.value }))}
                  placeholder="Codigo"
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-[11px]"
                />
                <input
                  value={nodeForm.descripcion}
                  onChange={(event) => setNodeForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                  placeholder="Descripcion"
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-[11px]"
                />
                <input
                  value={nodeForm.unidad}
                  onChange={(event) => setNodeForm((prev) => ({ ...prev, unidad: event.target.value }))}
                  placeholder="Und."
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-[11px]"
                />
                <input
                  type="number"
                  value={nodeForm.cantidad}
                  onChange={(event) => setNodeForm((prev) => ({ ...prev, cantidad: event.target.value }))}
                  placeholder="Cant."
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-right text-[11px]"
                />
                <input
                  value={nodeForm.observaciones}
                  onChange={(event) => setNodeForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                  placeholder="Observaciones"
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-[11px]"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={handleNodeSubmit}
                    disabled={saving}
                    className="h-7 flex-1 rounded border border-stone-300 bg-white px-2 text-[10px] font-medium text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {nodeForm.editingId ? "Guardar" : "Agregar"}
                  </button>
                  {nodeForm.editingId ? (
                    <button
                      type="button"
                      onClick={() => setNodeForm(EMPTY_NODE_FORM)}
                      disabled={saving}
                      className="h-7 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-500 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <section className="min-h-0 rounded border border-stone-200 bg-white">
            <div className="flex h-8 items-center justify-between gap-2 border-b border-stone-200 px-2">
              <FieldLabelIcon icon="coins" label="Recursos presupuestados" className="text-[11px] font-medium" />
              <span className="text-[10px] text-stone-500">{partidas.length} partida(s)</span>
            </div>
            <div className="app-table-scroll max-h-[270px] overflow-auto">
              <table className="w-full min-w-[1180px] table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
                <colgroup>
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "110px" }} />
                  <col />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "78px" }} />
                  <col style={{ width: "105px" }} />
                  <col style={{ width: "105px" }} />
                  <col style={{ width: "115px" }} />
                  <col style={{ width: "115px" }} />
                  <col style={{ width: "105px" }} />
                  <col style={{ width: "95px" }} />
                  <col style={{ width: "95px" }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-stone-50 text-muted">
                  <tr>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Item</th>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Tipo</th>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Descripcion</th>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Codigo recurso</th>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Ficha</th>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Und.</th>
                    <th className="h-[26px] px-2 py-0 text-right font-semibold">Cant.</th>
                    <th className="h-[26px] px-2 py-0 text-right font-semibold">Base unit.</th>
                    <th className="h-[26px] px-2 py-0 text-right font-semibold">Oferta unit.</th>
                    <th className="h-[26px] px-2 py-0 text-right font-semibold">Base</th>
                    <th className="h-[26px] px-2 py-0 text-right font-semibold">Ofertado</th>
                    <th className="h-[26px] px-2 py-0 text-right font-semibold">Margen</th>
                    <th className="h-[26px] px-2 py-0 text-center font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetTableRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="h-[44px] px-2 text-center text-stone-500">
                        Sin estructura ni recursos presupuestados.
                      </td>
                    </tr>
                  ) : (
                    budgetTableRows.map((row) => {
                      if (row.kind === "node") {
                        const isGroup = row.node.tipo === "CAPITULO";
                        const isSubgroup = row.node.tipo === "SUBCAPITULO";
                        return (
                          <tr
                            key={`node-${row.node.id}`}
                            className={`h-[28px] border-t border-border ${
                              isGroup ? "bg-stone-100 font-bold text-stone-800" : isSubgroup ? "bg-stone-50 font-semibold text-stone-800" : "bg-white text-stone-700"
                            }`}
                          >
                            <td className="px-2 py-0">
                              <span className="block truncate tabular-nums" style={{ paddingLeft: `${Math.min(row.node.depth, 3) * 16}px` }} title={row.node.codigo ?? ""}>
                                {row.node.codigo || "-"}
                              </span>
                            </td>
                            <td className="px-2 py-0">{NODE_TYPE_LABELS[row.node.tipo]}</td>
                            <td className={`px-2 py-0 ${isGroup ? "text-center" : ""}`}>
                              <span className="block truncate" title={row.node.descripcion}>
                                {row.node.descripcion}
                              </span>
                            </td>
                            <td className="px-2 py-0"></td>
                            <td className="px-2 py-0">
                              {row.node.propuestaTecnicaItemId ? (
                                <span className="rounded-full border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-700">
                                  Detalle PT
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-2 py-0">{row.node.unidad ?? ""}</td>
                            <td className="px-2 py-0 text-right">{row.node.cantidad ?? ""}</td>
                            <td className="px-2 py-0 text-right"></td>
                            <td className="px-2 py-0 text-right"></td>
                            <td className="px-2 py-0 text-right">{canViewPrices ? formatMoney(row.base, detail.presupuesto.monedaCodigo) : ""}</td>
                            <td className="px-2 py-0 text-right">{canViewPrices ? formatMoney(row.ofertado, detail.presupuesto.monedaCodigo) : ""}</td>
                            <td className="px-2 py-0 text-right">{canViewPrices ? formatMoney(row.ofertado - row.base, detail.presupuesto.monedaCodigo) : ""}</td>
                            <td className="px-1 py-0 text-center">
                              {canEditDraftStructure ? (
                                <button
                                  type="button"
                                  onClick={() => handleEditNode(row.node)}
                                  disabled={saving}
                                  className="h-6 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Editar
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      }
                      const resource = row.resource;
                      const catalogResource = catalogById.get(resource.recursoId);
                      return (
                        <tr key={`resource-${resource.id}`} className="h-[28px] border-t border-border bg-white">
                          <td className="px-2 py-0">
                            <span className="block truncate text-stone-400" style={{ paddingLeft: `${Math.min((row.partida?.depth ?? 0) + 1, 4) * 16}px` }}>
                              Recurso
                            </span>
                          </td>
                          <td className="px-2 py-0">
                            <span className="block truncate">{budgetResourceType(resource)}</span>
                          </td>
                          <td className="px-2 py-0">
                            <span className="block truncate" title={budgetResourceDescription(resource)}>
                              {budgetResourceDescription(resource)}
                            </span>
                          </td>
                          <td className="px-2 py-0">
                            <span className="block truncate font-semibold tabular-nums text-stone-700" title={budgetResourceCode(resource)}>
                              {budgetResourceCode(resource) || "-"}
                            </span>
                          </td>
                          <td className="px-2 py-0">
                            <span className="inline-flex max-w-full items-center gap-1 truncate">
                              <span className="truncate">{catalogResource?.ficha_tecnica ? "Si" : "-"}</span>
                              {resource.propuestaTecnicaRecursoId ? (
                                <span className="rounded-full border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-700">
                                  PT
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-2 py-0">{budgetResourceUnit(resource)}</td>
                          <td className="px-2 py-0 text-right">{resource.cantidadPresupuestada}</td>
                          <td className="px-2 py-0 text-right">
                            {canViewPrices ? formatMoney(resource.precioBaseUnitario, detail.presupuesto.monedaCodigo) : ""}
                          </td>
                          <td className="px-2 py-0 text-right">
                            {canViewPrices ? formatMoney(resource.precioOfertadoUnitario, detail.presupuesto.monedaCodigo) : ""}
                          </td>
                          <td className="px-2 py-0 text-right">
                            {canViewPrices ? formatMoney(row.base, detail.presupuesto.monedaCodigo) : ""}
                          </td>
                          <td className="px-2 py-0 text-right">
                            {canViewPrices ? formatMoney(row.ofertado, detail.presupuesto.monedaCodigo) : ""}
                          </td>
                          <td className="px-2 py-0 text-right">
                            {canViewPrices ? formatMoney(row.ofertado - row.base, detail.presupuesto.monedaCodigo) : ""}
                          </td>
                          <td className="px-1 py-0 text-center">
                            {canEditDraftResources ? (
                              <div className="inline-flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditResource(resource)}
                                  disabled={saving}
                                  className="h-6 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Editar
                                </button>
                                {manualOfferOverrideResourceIds.has(resource.id) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleResetOfferToTypeMargin(resource)}
                                    disabled={saving}
                                    className="h-6 rounded border border-teal-200 bg-teal-50 px-2 text-[10px] text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Reset %
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveResource(resource)}
                                  disabled={saving}
                                  className="h-6 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-stone-200 disabled:hover:bg-white disabled:hover:text-stone-600"
                                >
                                  X
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {canViewPrices ? (
                  <tfoot className="sticky bottom-0 bg-stone-100 text-[11px] font-bold text-stone-800">
                    <tr className="h-[30px] border-t border-stone-300">
                      <td colSpan={9} className="px-2 py-0 text-right">
                        TOTAL GENERAL
                      </td>
                      <td className="px-2 py-0 text-right">{formatMoney(detail.economia.total.base, detail.presupuesto.monedaCodigo)}</td>
                      <td className="px-2 py-0 text-right">{formatMoney(detail.economia.total.ofertado, detail.presupuesto.monedaCodigo)}</td>
                      <td className="px-2 py-0 text-right">{formatMoney(detail.economia.total.margen, detail.presupuesto.monedaCodigo)}</td>
                      <td className="px-2 py-0"></td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
            {canEditDraftResources ? (
              <div className="border-t border-stone-200 bg-stone-50 p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                    {resourceForm.editingId ? "Editar recurso presupuestado" : "Agregar recurso presupuestado"}
                  </span>
                  <span className="text-[10px] text-stone-400">Campos blancos: ingreso · Banda inferior: calculado / referencial</span>
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-[180px_minmax(220px,360px)_88px_105px_105px_minmax(140px,1fr)_116px]">
                  <label className="min-w-0">
                    <span className="mb-0.5 block text-[10px] font-semibold text-stone-500">Partida</span>
                    <select
                      value={resourceForm.partidaId}
                      onChange={(event) => setResourceForm((prev) => ({ ...prev, partidaId: event.target.value }))}
                      disabled={Boolean(resourceForm.editingId)}
                      className="h-7 w-full min-w-0 rounded border border-stone-200 bg-white px-2 text-[11px] disabled:bg-stone-100 disabled:text-stone-400"
                    >
                      <option value="">Seleccionar partida</option>
                      {partidas.map((partida) => (
                        <option key={partida.id} value={partida.id}>
                          {partida.codigo ? `${partida.codigo} - ` : ""}
                          {partida.descripcion}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="mb-0.5 block text-[10px] font-semibold text-stone-500">Recurso catalogo</span>
                    <select
                      value={resourceForm.recursoId}
                      onChange={(event) => setResourceForm((prev) => ({ ...prev, recursoId: event.target.value }))}
                      className="h-7 w-full min-w-0 truncate rounded border border-stone-200 bg-white px-2 text-[11px]"
                    >
                      <option value="">Recurso catalogo</option>
                      {activeResources.map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resourceLabel(resource)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="mb-0.5 block text-[10px] font-semibold text-stone-500">Cantidad</span>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={resourceForm.cantidad}
                      onChange={(event) => setResourceForm((prev) => ({ ...prev, cantidad: event.target.value }))}
                      placeholder="Cant."
                      className="h-7 w-full min-w-0 rounded border border-stone-200 bg-white px-2 text-right text-[11px]"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-0.5 block text-[10px] font-semibold text-stone-500">Base unit.</span>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={resourceForm.precioBase}
                      onChange={(event) => setResourceForm((prev) => ({ ...prev, precioBase: event.target.value }))}
                      placeholder="Base"
                      className="h-7 w-full min-w-0 rounded border border-stone-200 bg-white px-2 text-right text-[11px]"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-0.5 block text-[10px] font-semibold text-stone-500">Oferta unit.</span>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={resourceForm.precioOfertado}
                      onChange={(event) => setResourceForm((prev) => ({ ...prev, precioOfertado: event.target.value }))}
                      placeholder="Oferta"
                      className="h-7 w-full min-w-0 rounded border border-stone-200 bg-white px-2 text-right text-[11px]"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-0.5 block text-[10px] font-semibold text-stone-500">Observaciones</span>
                    <input
                      value={resourceForm.observaciones}
                      onChange={(event) => setResourceForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                      placeholder="Observaciones"
                      className="h-7 w-full min-w-0 rounded border border-stone-200 bg-white px-2 text-[11px]"
                    />
                  </label>
                  <div className="flex min-w-0 items-end gap-1">
                    <button
                      type="button"
                      onClick={handleResourceSubmit}
                      disabled={saving || partidas.length === 0}
                      className="h-7 flex-1 rounded border border-stone-300 bg-white px-2 text-[10px] font-medium text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resourceForm.editingId ? "Guardar" : "Agregar"}
                    </button>
                    {resourceForm.editingId ? (
                    <button
                      type="button"
                      onClick={() => setResourceForm(EMPTY_RESOURCE_FORM)}
                      disabled={saving}
                      className="h-7 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-500 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 rounded border border-stone-200 bg-white px-2 py-1.5 text-[10px] text-stone-600 md:grid-cols-6">
                  <ReadOnlyPreview label="Tipo" value={selectedCatalogResource?.tipo_recurso || "-"} />
                  <ReadOnlyPreview label="Und." value={selectedCatalogResource?.unidad || "-"} />
                  <ReadOnlyPreview
                    label="Referencial"
                    value={
                      selectedCatalogResource
                        ? `${selectedCatalogResource.moneda} ${formatCurrencyNumber(selectedCatalogResource.precio_unitario_ref)}`
                        : "-"
                    }
                    align="right"
                  />
                  <ReadOnlyPreview label="Base calc." value={formatMoney(resourceFormPreview.base, monedaCodigo)} align="right" />
                  <ReadOnlyPreview label="Ofertado calc." value={formatMoney(resourceFormPreview.ofertado, monedaCodigo)} align="right" />
                  <ReadOnlyPreview
                    label="Margen calc."
                    value={`${formatMoney(resourceFormPreview.margen, monedaCodigo)} · ${percentLabel(resourceFormPreview.porcentajeMargen)}`}
                    align="right"
                  />
                </div>
              </div>
            ) : null}
          </section>

          </div>

          <aside className="min-w-0 rounded border border-stone-200 bg-white">
            <div className="flex h-8 items-center justify-between gap-1 border-b border-stone-200 px-2">
              <FieldLabelIcon icon={rightPanelTab === "margins" ? "pie-chart" : "clipboard-list"} label="Panel economico" className="text-[11px] font-medium" />
              <div className="inline-flex rounded border border-stone-200 bg-stone-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setRightPanelTab("margins")}
                  className={`h-6 px-2 text-[10px] font-semibold ${rightPanelTab === "margins" ? "rounded bg-white text-teal-700 shadow-sm" : "text-stone-500"}`}
                >
                  Margenes
                </button>
                <button
                  type="button"
                  onClick={() => setRightPanelTab("resources")}
                  className={`h-6 px-2 text-[10px] font-semibold ${rightPanelTab === "resources" ? "rounded bg-white text-teal-700 shadow-sm" : "text-stone-500"}`}
                >
                  Recursos
                </button>
              </div>
            </div>

            {rightPanelTab === "margins" ? (
              canViewPrices ? (
                <div className="max-h-[430px] overflow-y-auto p-2">
                  <div className="space-y-1.5">
                    {detail.economia.tiposRecurso.length === 0 ? (
                      <div className="rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-center text-[11px] text-stone-500">
                        Sin tipos de recurso para calcular margenes.
                      </div>
                    ) : (
                      detail.economia.tiposRecurso.map((row) => (
                        <div key={row.tipoRecurso} className="rounded border border-stone-200 bg-stone-50 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] font-bold text-stone-700" title={row.tipoRecurso}>
                              {row.tipoRecurso}
                            </span>
                            <span className="shrink-0 text-[10px] font-semibold text-stone-500">{percentLabel(row.porcentajeMargen)}</span>
                          </div>
                          <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-stone-500">
                            <ReadOnlyPreview label="Base" value={formatMoney(row.base, detail.presupuesto.monedaCodigo)} align="right" />
                            <ReadOnlyPreview label="Oferta" value={formatMoney(row.ofertado, detail.presupuesto.monedaCodigo)} align="right" />
                            <ReadOnlyPreview label="Margen" value={formatMoney(row.margen, detail.presupuesto.monedaCodigo)} align="right" />
                          </div>
                          {canEditDraftResources ? (
                            <div className="mt-2 grid grid-cols-[1fr_auto] gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={marginDrafts[row.tipoRecurso] ?? (row.porcentajeMargen * 100).toFixed(2)}
                                onChange={(event) => setMarginDrafts((prev) => ({ ...prev, [row.tipoRecurso]: event.target.value }))}
                                className="h-7 rounded border border-stone-200 bg-white px-2 text-right text-[11px]"
                                aria-label={`Margen ${row.tipoRecurso}`}
                              />
                              <button
                                type="button"
                                onClick={() => handleApplyMarginToType(row.tipoRecurso)}
                                disabled={saving}
                                className="h-7 rounded border border-stone-300 bg-white px-2 text-[10px] font-medium text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Aplicar %
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[160px] items-center justify-center px-3 text-center text-[11px] text-stone-500">
                  Informacion economica oculta por permisos.
                </div>
              )
            ) : (
              <div className="p-2">
                <input
                  value={resourceSearch}
                  onChange={(event) => setResourceSearch(event.target.value)}
                  placeholder="Buscar recurso, codigo, unidad o proveedor"
                  className="mb-2 h-7 w-full rounded border border-stone-200 bg-white px-2 text-[11px]"
                />
                <div className="max-h-[250px] space-y-1 overflow-y-auto pr-1">
                  {filteredBrowserResources.map((resource) => (
                    <button
                      key={resource.id}
                      type="button"
                      onClick={() => setSelectedBrowserResourceId(resource.id)}
                      onDoubleClick={() => {
                        if (canEditDraftResources && partidas.length > 0) selectBrowserResource(resource);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          if (canEditDraftResources && partidas.length > 0) selectBrowserResource(resource);
                        }
                      }}
                      className={`block w-full rounded border px-2 py-1.5 text-left hover:bg-teal-50 ${
                        selectedBrowserResourceId === resource.id ? "border-teal-300 bg-teal-50" : "border-stone-200 bg-stone-50"
                      }`}
                    >
                      <span className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-bold text-stone-700">{resource.codigo_recurso || resource.id}</span>
                        <span className="shrink-0 rounded-full border border-stone-200 bg-white px-1.5 py-0.5 text-[9px] text-stone-500">
                          {resource.unidad || "-"}
                        </span>
                      </span>
                      <span className="block truncate text-[10px] text-stone-600">{resource.descripcion}</span>
                      <span className="block truncate text-[10px] text-stone-400">
                        {resource.tipo_recurso || "Sin tipo"}
                        {canViewPrices ? ` · ${resource.moneda} ${formatCurrencyNumber(resource.precio_unitario_ref)}` : ""}
                      </span>
                    </button>
                  ))}
                  {filteredBrowserResources.length === 0 ? (
                    <div className="rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-center text-[11px] text-stone-500">
                      Sin recursos encontrados.
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 rounded border border-stone-200 bg-stone-50 p-2">
                  {selectedBrowserResource ? (
                    <div className="space-y-1 text-[10px] text-stone-600">
                      <div className="text-[11px] font-bold text-stone-800">{selectedBrowserResource.descripcion}</div>
                      <div className="grid grid-cols-2 gap-1">
                        <ReadOnlyPreview label="Codigo" value={selectedBrowserResource.codigo_recurso || "-"} />
                        <ReadOnlyPreview label="Tipo" value={selectedBrowserResource.tipo_recurso || "-"} />
                        <ReadOnlyPreview label="Unidad" value={selectedBrowserResource.unidad || "-"} />
                        <ReadOnlyPreview label="Marca" value={selectedBrowserResource.marca || "-"} />
                        <ReadOnlyPreview label="Cod. fab." value={selectedBrowserResource.codigo_fabricante || "-"} />
                        <ReadOnlyPreview label="Proveedor" value={selectedBrowserResource.proveedor || "-"} />
                        <ReadOnlyPreview label="Ficha" value={selectedBrowserResource.ficha_tecnica ? "Disponible" : "-"} />
                        <ReadOnlyPreview
                          label="Referencial"
                          value={canViewPrices ? `${selectedBrowserResource.moneda} ${formatCurrencyNumber(selectedBrowserResource.precio_unitario_ref)}` : "Oculto"}
                          align="right"
                        />
                      </div>
                      <div className="rounded border border-dashed border-stone-300 bg-white px-2 py-1 text-[10px] text-stone-400">
                        Recursos que suelen usarse juntos: pendiente de evidencia historica suficiente.
                      </div>
                    </div>
                  ) : (
                    <div className="py-3 text-center text-[11px] text-stone-500">Selecciona un recurso para ver detalle.</div>
                  )}
                </div>
              </div>
            )}
          </aside>
          </div>
        </>
      )}
      {priceReviewOpen && detail && canViewPrices ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-3">
          <div className="flex max-h-[92vh] w-full max-w-[1180px] flex-col overflow-hidden rounded border border-stone-300 bg-white shadow-xl">
            <header className="flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-3 py-2">
              <div className="min-w-0">
                <h3 className="truncate text-[13px] font-bold text-stone-800">Revision de precios</h3>
                <p className="truncate text-[10px] text-stone-500">
                  Presupuesto REV {detail.presupuesto.revision} · {STATUS_LABELS[detail.presupuesto.estado]}
                  {priceReviewLoading ? " · cargando historicos" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPriceReviewOpen(false)}
                className="h-7 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-600 hover:bg-stone-100"
              >
                Cerrar
              </button>
            </header>
            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
              <section className="min-h-0 overflow-auto border-r border-stone-200">
                <table className="w-full min-w-[820px] text-[10px]">
                  <thead className="sticky top-0 z-10 bg-stone-100 text-left text-stone-500">
                    <tr>
                      <th className="px-2 py-2 font-bold">Codigo</th>
                      <th className="px-2 py-2 font-bold">Recurso</th>
                      <th className="px-2 py-2 font-bold">Tipo</th>
                      <th className="px-2 py-2 font-bold">Und.</th>
                      <th className="px-2 py-2 text-right font-bold">Apar.</th>
                      <th className="px-2 py-2 text-right font-bold">Cant.</th>
                      <th className="px-2 py-2 text-right font-bold">Maestro</th>
                      <th className="px-2 py-2 text-right font-bold">Base pres.</th>
                      <th className="px-2 py-2 text-right font-bold">Var.</th>
                      <th className="px-2 py-2 font-bold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceReviewResources.map((resource) => {
                      const selected = selectedPriceReviewResource?.recursoId === resource.recursoId;
                      return (
                        <tr
                          key={resource.recursoId}
                          tabIndex={0}
                          onClick={() => {
                            setSelectedPriceReviewResourceId(resource.recursoId);
                            setSelectedPriceHistoryId("");
                            setNewPriceForm((prev) => ({
                              ...prev,
                              precio: "",
                              proveedorSnapshot: resource.lines[0]?.precioBaseOrigen === "MAESTRO" ? "" : prev.proveedorSnapshot,
                            }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              setSelectedPriceReviewResourceId(resource.recursoId);
                              setSelectedPriceHistoryId("");
                            }
                          }}
                          className={`cursor-pointer border-t border-stone-100 ${selected ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : "bg-white hover:bg-stone-50"}`}
                        >
                          <td className="px-2 py-1.5 font-semibold tabular-nums text-stone-700">{resource.codigo || "-"}</td>
                          <td className="max-w-[260px] px-2 py-1.5">
                            <span className="block truncate" title={resource.descripcion}>
                              {resource.descripcion}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">{resource.tipo || "Sin tipo"}</td>
                          <td className="px-2 py-1.5">{resource.hasIncompatibleUnits ? "Mixta" : resource.unidad || "-"}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{resource.apariciones}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {resource.hasIncompatibleUnits ? "No sumable" : formatCurrencyNumber(resource.cantidadTotal ?? 0)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {resource.precioMaestroActual === null ? "-" : formatMoney(resource.precioMaestroActual, detail.presupuesto.monedaCodigo)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {resource.precioBasePresupuesto === null ? "Mixto" : formatMoney(resource.precioBasePresupuesto, detail.presupuesto.monedaCodigo)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{signedPercentLabel(resource.variacionPorcentual)}</td>
                          <td className="px-2 py-1.5">
                            <span className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-stone-600">
                              {PRICE_REVIEW_STATUS_LABELS[resource.estado] ?? resource.estado}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {priceReviewResources.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-[11px] text-stone-500">
                          No hay recursos presupuestados para revisar.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>
              <aside className="min-h-0 overflow-auto bg-white p-3">
                {selectedPriceReviewResource ? (
                  <div className="space-y-3">
                    <div className="rounded border border-stone-200 bg-stone-50 p-2">
                      <div className="text-[12px] font-bold text-stone-800">{selectedPriceReviewResource.descripcion}</div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                        <ReadOnlyPreview label="Codigo" value={selectedPriceReviewResource.codigo || "-"} />
                        <ReadOnlyPreview label="Tipo" value={selectedPriceReviewResource.tipo || "Sin tipo"} />
                        <ReadOnlyPreview label="Unidad" value={selectedPriceReviewResource.hasIncompatibleUnits ? "Unidades mixtas" : selectedPriceReviewResource.unidad || "-"} />
                        <ReadOnlyPreview label="Apariciones" value={String(selectedPriceReviewResource.apariciones)} align="right" />
                        <ReadOnlyPreview
                          label="Cantidad"
                          value={
                            selectedPriceReviewResource.hasIncompatibleUnits
                              ? "No sumable"
                              : formatCurrencyNumber(selectedPriceReviewResource.cantidadTotal ?? 0)
                          }
                          align="right"
                        />
                        <ReadOnlyPreview
                          label="Base actual"
                          value={
                            selectedPriceReviewResource.precioBasePresupuesto === null
                              ? "Mixto"
                              : formatMoney(selectedPriceReviewResource.precioBasePresupuesto, detail.presupuesto.monedaCodigo)
                          }
                          align="right"
                        />
                        <ReadOnlyPreview
                          label="Maestro"
                          value={
                            selectedPriceReviewResource.precioMaestroActual === null
                              ? "-"
                              : formatMoney(selectedPriceReviewResource.precioMaestroActual, detail.presupuesto.monedaCodigo)
                          }
                          align="right"
                        />
                        <ReadOnlyPreview label="Variacion" value={signedPercentLabel(selectedPriceReviewResource.variacionPorcentual)} align="right" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => handleApplyPriceReviewAction("MANTENER")}
                        disabled={!canEditDraftResources || saving}
                        className="h-8 rounded border border-stone-200 bg-white px-2 text-[10px] font-medium text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Mantener precio
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPriceReviewAction("MAESTRO")}
                        disabled={!canEditDraftResources || saving || selectedPriceReviewResource.precioMaestroActual === null}
                        className="h-8 rounded border border-sky-200 bg-sky-50 px-2 text-[10px] font-medium text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Usar maestro actual
                      </button>
                    </div>

                    <div className="rounded border border-stone-200">
                      <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-2 py-1">
                        <h4 className="text-[11px] font-bold text-stone-700">Historicos del recurso</h4>
                        <span className="text-[10px] text-stone-400">{selectedPriceReviewResource.histories.length}</span>
                      </div>
                      <div className="max-h-[190px] overflow-auto">
                        {selectedPriceReviewResource.histories.map((history) => (
                          <button
                            key={history.id}
                            type="button"
                            onClick={() => setSelectedPriceHistoryId(history.id)}
                            className={`block w-full border-b border-stone-100 px-2 py-1.5 text-left text-[10px] hover:bg-sky-50 ${
                              selectedPriceHistoryId === history.id ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : "bg-white"
                            }`}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-stone-700">{history.fechaPrecio}</span>
                              <span className="font-bold tabular-nums text-stone-800">{formatMoney(history.precioUnitario, history.monedaCodigo as MonedaPresupuestoCotizacion)}</span>
                            </span>
                            <span className="mt-0.5 block truncate text-stone-500">
                              {history.proveedorSnapshot || "-"} · {history.fuenteTipo}
                            </span>
                          </button>
                        ))}
                        {selectedPriceReviewResource.histories.length === 0 ? (
                          <div className="px-3 py-5 text-center text-[11px] text-stone-500">Sin historicos registrados.</div>
                        ) : null}
                      </div>
                      <div className="border-t border-stone-200 bg-stone-50 p-2">
                        <button
                          type="button"
                          onClick={() => handleApplyPriceReviewAction("HISTORICO", { precioHistoricoId: selectedPriceHistory?.id ?? null })}
                          disabled={!canEditDraftResources || saving || !selectedPriceHistory}
                          className="h-8 w-full rounded border border-teal-200 bg-teal-50 px-2 text-[10px] font-medium text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Usar historico seleccionado
                        </button>
                      </div>
                    </div>

                    <div className="rounded border border-stone-200 bg-stone-50 p-2">
                      <h4 className="text-[11px] font-bold text-stone-700">Registrar y usar nuevo precio</h4>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <input
                          type="number"
                          min={0}
                          value={newPriceForm.precio}
                          onChange={(event) => setNewPriceForm((prev) => ({ ...prev, precio: event.target.value }))}
                          placeholder="Precio"
                          disabled={!canEditDraftResources || saving}
                          className="h-8 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 disabled:bg-stone-100"
                        />
                        <select
                          value={newPriceForm.monedaCodigo}
                          onChange={(event) => setNewPriceForm((prev) => ({ ...prev, monedaCodigo: event.target.value === "USD" ? "USD" : "PEN" }))}
                          disabled={!canEditDraftResources || saving}
                          className="h-8 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 disabled:bg-stone-100"
                        >
                          <option value="PEN">PEN</option>
                          <option value="USD">USD</option>
                        </select>
                        <input
                          type="date"
                          value={newPriceForm.fechaPrecio}
                          onChange={(event) => setNewPriceForm((prev) => ({ ...prev, fechaPrecio: event.target.value }))}
                          disabled={!canEditDraftResources || saving}
                          className="h-8 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 disabled:bg-stone-100"
                        />
                        <select
                          value={newPriceForm.fuenteTipo}
                          onChange={(event) => setNewPriceForm((prev) => ({ ...prev, fuenteTipo: event.target.value as ResourcePriceHistorySource }))}
                          disabled={!canEditDraftResources || saving}
                          className="h-8 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 disabled:bg-stone-100"
                        >
                          {PRICE_SOURCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          value={newPriceForm.proveedorSnapshot}
                          onChange={(event) => setNewPriceForm((prev) => ({ ...prev, proveedorSnapshot: event.target.value }))}
                          placeholder="Proveedor"
                          disabled={!canEditDraftResources || saving}
                          className="col-span-2 h-8 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 disabled:bg-stone-100"
                        />
                        <input
                          value={newPriceForm.fuenteReferencia}
                          onChange={(event) => setNewPriceForm((prev) => ({ ...prev, fuenteReferencia: event.target.value }))}
                          placeholder="Referencia"
                          disabled={!canEditDraftResources || saving}
                          className="col-span-2 h-8 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 disabled:bg-stone-100"
                        />
                        <input
                          value={newPriceForm.documentoSoporteUrl}
                          onChange={(event) => setNewPriceForm((prev) => ({ ...prev, documentoSoporteUrl: event.target.value }))}
                          placeholder="URL/documento soporte"
                          disabled={!canEditDraftResources || saving}
                          className="col-span-2 h-8 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 disabled:bg-stone-100"
                        />
                        <textarea
                          value={newPriceForm.observaciones}
                          onChange={(event) => setNewPriceForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                          placeholder="Observaciones"
                          disabled={!canEditDraftResources || saving}
                          rows={2}
                          className="col-span-2 rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 disabled:bg-stone-100"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleRegisterAndApplyNewPrice}
                        disabled={!canEditDraftResources || saving || !newPriceForm.precio.trim()}
                        className="mt-2 h-8 w-full rounded border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Registrar y aplicar
                      </button>
                    </div>
                    {!canEditDraftResources ? (
                      <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
                        Revision de precios en modo lectura. Solo un presupuesto BORRADOR con permisos economicos permite modificar precios.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded border border-stone-200 bg-stone-50 px-3 py-8 text-center text-[11px] text-stone-500">
                    Selecciona un recurso presupuestado.
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BudgetMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-stone-200 bg-stone-50 px-2 py-1.5">
      <div className="text-[10px] font-medium uppercase text-stone-500">{label}</div>
      <div className="mt-0.5 truncate text-right text-[12px] font-semibold text-stone-700" title={value}>
        {value}
      </div>
    </div>
  );
}

function ReadOnlyPreview({ label, value, align = "left" }: { label: string; value: string; align?: "left" | "right" }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`mt-0.5 truncate font-medium tabular-nums text-stone-700 ${align === "right" ? "text-right" : "text-left"}`} title={value}>
        {value}
      </div>
    </div>
  );
}
