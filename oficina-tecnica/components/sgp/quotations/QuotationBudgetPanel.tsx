"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FieldLabelIcon } from "@/components/sgp/ui/FieldLabelIcon";
import type { Recurso } from "@/lib/sgp/demoData";
import { computeBudgetResourceEconomics } from "@/lib/sgp/quotationBudgetEconomics";
import {
  addBudgetResource,
  createBudgetNode,
  createQuotationBudget,
  deleteBudgetNode,
  getQuotationBudgetDetail,
  listQuotationBudgets,
  markBudgetReady,
  QuotationBudgetRepositoryError,
  removeBudgetResource,
  returnBudgetToDraft,
  updateBudgetNode,
  updateBudgetResource,
  type EstadoPresupuestoCotizacion,
  type MonedaPresupuestoCotizacion,
  type QuotationBudget,
  type QuotationBudgetDetail,
  type QuotationBudgetNode,
  type QuotationBudgetResource,
  type TipoNodoPresupuestoCotizacion,
} from "@/lib/sgp/quotationBudgetsRepository";
import { formatCurrencyNumber } from "@/lib/sgp/utils";

type QuotationBudgetPanelProps = {
  cotizacionId: string;
  monedaCodigo: MonedaPresupuestoCotizacion;
  recursos: Recurso[];
  canEdit: boolean;
  canViewPrices: boolean;
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

type TreeNode = QuotationBudgetNode & { depth: number };

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

const NODE_TYPE_LABELS: Record<TipoNodoPresupuestoCotizacion, string> = {
  CAPITULO: "Capitulo",
  SUBCAPITULO: "Subcapitulo",
  PARTIDA: "Partida",
};

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

function formatMoney(value: number, currency: MonedaPresupuestoCotizacion): string {
  return `${currency} ${formatCurrencyNumber(value)}`;
}

function percentLabel(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
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

export function QuotationBudgetPanel({
  cotizacionId,
  monedaCodigo,
  recursos,
  canEdit,
  canViewPrices,
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
  const nodesById = useMemo(() => new Map((detail?.partidas ?? []).map((node) => [node.id, node])), [detail?.partidas]);
  const activeResources = useMemo(
    () =>
      [...recursos]
        .filter((resource) => resource.estado !== "Inactivo")
        .sort((a, b) => resourceLabel(a).localeCompare(resourceLabel(b), "es", { sensitivity: "base" })),
    [recursos],
  );
  const catalogById = useMemo(() => new Map(recursos.map((resource) => [resource.id, resource])), [recursos]);
  const selectedCatalogResource = resourceForm.recursoId ? catalogById.get(resourceForm.recursoId) ?? null : null;

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
        await updateBudgetResource(resourceForm.editingId, payload);
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
    const label = resource.recurso?.descripcion ?? resource.recursoId;
    if (!window.confirm(`Eliminar recurso "${label}" del presupuesto?`)) return;
    void runAction(async () => {
      await removeBudgetResource(resource.id);
      if (selectedBudget) await reload(selectedBudget.id);
    }, "Recurso eliminado.");
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
              <table className="w-full min-w-[980px] table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
                <colgroup>
                  <col style={{ width: "150px" }} />
                  <col />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "70px" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "105px" }} />
                  <col style={{ width: "105px" }} />
                  <col style={{ width: "115px" }} />
                  <col style={{ width: "115px" }} />
                  <col style={{ width: "105px" }} />
                  <col style={{ width: "95px" }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-stone-50 text-muted">
                  <tr>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Partida</th>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Recurso</th>
                    <th className="h-[26px] px-2 py-0 text-left font-semibold">Tipo</th>
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
                  {detail.recursos.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="h-[44px] px-2 text-center text-stone-500">
                        Sin recursos presupuestados.
                      </td>
                    </tr>
                  ) : (
                    detail.recursos.map((resource) => {
                      const partida = nodesById.get(resource.partidaId);
                      const economics = computeBudgetResourceEconomics({
                        id: resource.id,
                        partidaId: resource.partidaId,
                        recursoId: resource.recursoId,
                        cantidadPresupuestada: resource.cantidadPresupuestada,
                        precioBaseUnitario: resource.precioBaseUnitario,
                        precioOfertadoUnitario: resource.precioOfertadoUnitario,
                        tipoRecurso: resource.recurso?.tipoRecurso,
                      });
                      return (
                        <tr key={resource.id} className="h-[28px] border-t border-border">
                          <td className="px-2 py-0">
                            <span className="block truncate" title={partida?.descripcion ?? ""}>
                              {partida?.codigo ? `${partida.codigo} - ` : ""}
                              {partida?.descripcion ?? "-"}
                            </span>
                          </td>
                          <td className="px-2 py-0">
                            <span className="block truncate" title={resource.recurso?.descripcion ?? resource.recursoId}>
                              {resource.recurso?.codigoRecurso ? `${resource.recurso.codigoRecurso} - ` : ""}
                              {resource.recurso?.descripcion ?? resource.recursoId}
                            </span>
                          </td>
                          <td className="px-2 py-0">
                            <span className="block truncate">{resource.recurso?.tipoRecurso ?? "Sin tipo"}</span>
                          </td>
                          <td className="px-2 py-0">{resource.recurso?.unidad ?? "-"}</td>
                          <td className="px-2 py-0 text-right">{resource.cantidadPresupuestada}</td>
                          <td className="px-2 py-0 text-right">
                            {canViewPrices ? formatMoney(resource.precioBaseUnitario, detail.presupuesto.monedaCodigo) : ""}
                          </td>
                          <td className="px-2 py-0 text-right">
                            {canViewPrices ? formatMoney(resource.precioOfertadoUnitario, detail.presupuesto.monedaCodigo) : ""}
                          </td>
                          <td className="px-2 py-0 text-right">
                            {canViewPrices ? formatMoney(economics.base, detail.presupuesto.monedaCodigo) : ""}
                          </td>
                          <td className="px-2 py-0 text-right">
                            {canViewPrices ? formatMoney(economics.ofertado, detail.presupuesto.monedaCodigo) : ""}
                          </td>
                          <td className="px-2 py-0 text-right">
                            {canViewPrices ? formatMoney(economics.margen, detail.presupuesto.monedaCodigo) : ""}
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
              </table>
            </div>
            {canEditDraftResources ? (
              <div className="grid grid-cols-1 gap-2 border-t border-stone-200 bg-stone-50 p-2 lg:grid-cols-[180px_1fr_88px_105px_105px_1fr_116px]">
                <select
                  value={resourceForm.partidaId}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, partidaId: event.target.value }))}
                  disabled={Boolean(resourceForm.editingId)}
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-[11px] disabled:bg-stone-100 disabled:text-stone-400"
                >
                  <option value="">Seleccionar partida</option>
                  {partidas.map((partida) => (
                    <option key={partida.id} value={partida.id}>
                      {partida.codigo ? `${partida.codigo} - ` : ""}
                      {partida.descripcion}
                    </option>
                  ))}
                </select>
                <select
                  value={resourceForm.recursoId}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, recursoId: event.target.value }))}
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-[11px]"
                >
                  <option value="">Recurso catalogo</option>
                  {activeResources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resourceLabel(resource)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={resourceForm.cantidad}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, cantidad: event.target.value }))}
                  placeholder="Cantidad"
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-right text-[11px]"
                />
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={resourceForm.precioBase}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, precioBase: event.target.value }))}
                  placeholder="Base unit."
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-right text-[11px]"
                />
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={resourceForm.precioOfertado}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, precioOfertado: event.target.value }))}
                  placeholder="Oferta unit."
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-right text-[11px]"
                />
                <input
                  value={resourceForm.observaciones}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                  placeholder={
                    selectedCatalogResource
                      ? `Ref. ${selectedCatalogResource.moneda} ${formatCurrencyNumber(selectedCatalogResource.precio_unitario_ref)}`
                      : "Observaciones"
                  }
                  className="h-7 rounded border border-stone-200 bg-white px-2 text-[11px]"
                />
                <div className="flex gap-1">
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
            ) : null}
          </section>

          {canViewPrices ? (
            <section className="rounded border border-stone-200 bg-white">
              <div className="flex h-8 items-center border-b border-stone-200 px-2">
                <FieldLabelIcon icon="pie-chart" label="Resumen por tipo de recurso" className="text-[11px] font-medium" />
              </div>
              <div className="app-table-scroll max-h-[190px] overflow-auto">
                <table className="w-full table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
                  <thead className="sticky top-0 z-10 bg-stone-50 text-muted">
                    <tr>
                      <th className="h-[26px] px-2 py-0 text-left font-semibold">Tipo recurso</th>
                      <th className="h-[26px] px-2 py-0 text-right font-semibold">Base</th>
                      <th className="h-[26px] px-2 py-0 text-right font-semibold">Ofertado</th>
                      <th className="h-[26px] px-2 py-0 text-right font-semibold">Margen</th>
                      <th className="h-[26px] px-2 py-0 text-right font-semibold">% margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.economia.tiposRecurso.map((row) => (
                      <tr key={row.tipoRecurso} className="h-[26px] border-t border-border">
                        <td className="px-2 py-0">{row.tipoRecurso}</td>
                        <td className="px-2 py-0 text-right">{formatMoney(row.base, detail.presupuesto.monedaCodigo)}</td>
                        <td className="px-2 py-0 text-right">{formatMoney(row.ofertado, detail.presupuesto.monedaCodigo)}</td>
                        <td className="px-2 py-0 text-right">{formatMoney(row.margen, detail.presupuesto.monedaCodigo)}</td>
                        <td className="px-2 py-0 text-right">{percentLabel(row.porcentajeMargen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
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
