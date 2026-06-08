"use client";

import { Fragment } from "react";
import { ResourceAutocompleteInput } from "@/components/sgp/technical-proposal/ResourceAutocompleteInput";
import type { Recurso } from "@/lib/sgp/demoData";

type ResourceCategoryKey = "mano_obra" | "materiales" | "equipos" | "herramientas" | "consumibles";

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

type ResourceCategory = {
  key: ResourceCategoryKey;
  label: string;
  shortLabel: string;
  hasTime: boolean;
};

type TechnicalProposalResourceGridProps = {
  activityNumber: string;
  categories: ResourceCategory[];
  rows: TechnicalProposalResourceSnapshot[];
  resources: Recurso[];
  usedResourceLookup: Map<string, { count: number; activityNumbers: string[] }>;
  selectedResourceRowId: string | null;
  editingResourceCellId: string | null;
  editingEnabled: boolean;
  onAddResource: (category: ResourceCategoryKey) => void;
  onDeleteResource: (resourceId: string) => void;
  onUpdateResource: (resourceId: string, patch: Partial<TechnicalProposalResourceSnapshot>) => void;
  onSelectResourceRow: (resource: TechnicalProposalResourceSnapshot) => void;
  onEditResourceDescription: (resourceId: string | null) => void;
  onSelectMasterResource: (resourceId: string, selectedResource: Recurso) => void;
  onActiveMasterResource: (resource: Recurso | null) => void;
};

function toGridNumber(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function spreadsheetInputClassName(extra = ""): string {
  return [
    "h-6 w-full min-w-0 border-0 bg-transparent px-1.5 text-[11px] leading-none text-stone-800 outline-none",
    "focus:bg-white focus:shadow-[inset_0_0_0_1px_#0f766e]",
    "disabled:text-stone-400",
    extra,
  ].join(" ");
}

function gridButtonClassName(variant: "primary" | "secondary" | "danger" = "secondary"): string {
  const base = "inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[10px] font-semibold leading-none disabled:cursor-not-allowed disabled:opacity-45";
  if (variant === "primary") return `${base} border-teal-700 bg-teal-700 text-white hover:bg-teal-800`;
  if (variant === "danger") return `${base} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`;
  return `${base} border-stone-300 bg-white text-stone-700 hover:bg-stone-50`;
}

function statusBadge(resource: TechnicalProposalResourceSnapshot) {
  if (resource.estado_origen === "catalogo_copiado" && resource.recurso_id) {
    return {
      label: "Existente",
      className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
  }

  if (!resource.recurso_id && (resource.codigo_recurso.trim() || resource.codigo_fabricante.trim())) {
    return {
      label: "Manual",
      className: "border-sky-300 bg-sky-50 text-sky-700",
    };
  }

  return {
    label: "Nuevo",
    className: "border-amber-300 bg-amber-50 text-amber-700",
  };
}

function compactCommentValue(resource: TechnicalProposalResourceSnapshot): string {
  return [resource.comentario, resource.detalle_adicional]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" | ");
}

export function TechnicalProposalResourceGrid({
  activityNumber,
  categories,
  rows,
  resources,
  usedResourceLookup,
  selectedResourceRowId,
  editingResourceCellId,
  editingEnabled,
  onAddResource,
  onDeleteResource,
  onUpdateResource,
  onSelectResourceRow,
  onEditResourceDescription,
  onSelectMasterResource,
  onActiveMasterResource,
}: TechnicalProposalResourceGridProps) {
  const totalRows = rows.length;

  function renderResourceRow(resource: TechnicalProposalResourceSnapshot, index: number) {
    const status = statusBadge(resource);
    const resourceNumber = `${activityNumber}.${index + 1}`;
    const usage = resource.recurso_id ? usedResourceLookup.get(resource.recurso_id) : undefined;
    const isRepeated = Boolean(usage && usage.count > 1);
    const isSelected = selectedResourceRowId === resource.id;
    const isEditingDescription = editingResourceCellId === resource.id;
    return (
      <tr
        key={resource.id}
        tabIndex={0}
        onClick={() => onSelectResourceRow(resource)}
        onKeyDown={(event) => {
          if (editingEnabled && (event.key === "Enter" || event.key === "F2") && isSelected && !isEditingDescription) {
            event.preventDefault();
            onEditResourceDescription(resource.id);
          }
        }}
        className={`${isSelected ? "bg-teal-50/80 ring-1 ring-inset ring-teal-300" : isRepeated ? "bg-amber-50/50" : "bg-white"} align-middle outline-none hover:bg-teal-50/25`}
      >
        <td className="border border-stone-200 bg-stone-50 px-1.5 text-center text-[10px] font-semibold text-teal-700 tabular-nums">
          {resourceNumber}
        </td>
        <td className="border border-stone-200 p-0">
          <input
            value={resource.codigo_recurso}
            onChange={(event) =>
              onUpdateResource(resource.id, {
                codigo_recurso: event.target.value,
                recurso_id: null,
                estado_origen: "nuevo_por_formalizar",
              })
            }
            className={spreadsheetInputClassName("font-semibold tabular-nums")}
            placeholder="Codigo"
            disabled={!editingEnabled}
          />
        </td>
        <td
          className={`border border-stone-200 p-0 ${editingEnabled && isEditingDescription ? "bg-white shadow-[inset_0_0_0_1px_#0f766e]" : ""}`}
          onDoubleClick={(event) => {
            event.stopPropagation();
            if (!editingEnabled) return;
            onSelectResourceRow(resource);
            onEditResourceDescription(resource.id);
          }}
        >
          {editingEnabled && isEditingDescription ? (
            <ResourceAutocompleteInput
              value={resource.descripcion}
              resources={resources}
              usedResourceLookup={usedResourceLookup}
              className={spreadsheetInputClassName("bg-white")}
              placeholder="Buscar o escribir recurso"
              onTextChange={(value) =>
                onUpdateResource(resource.id, {
                  descripcion: value,
                  recurso_id: null,
                  estado_origen: "nuevo_por_formalizar",
                })
              }
              onSelect={(selectedResource) => onSelectMasterResource(resource.id, selectedResource)}
              onActiveResource={onActiveMasterResource}
              onCancel={() => onEditResourceDescription(null)}
            />
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectResourceRow(resource);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (!editingEnabled) return;
                onEditResourceDescription(resource.id);
              }}
              className="block h-6 w-full truncate px-1.5 text-left text-[11px] text-stone-800"
              title={editingEnabled ? "Doble click para buscar o editar recurso" : "Activa Editar para modificar el recurso"}
            >
              {resource.descripcion || "Doble click para buscar recurso"}
            </button>
          )}
        </td>
        <td className="border border-stone-200 p-0">
          <input
            type="number"
            min={0}
            value={resource.cantidad}
            onChange={(event) => onUpdateResource(resource.id, { cantidad: toGridNumber(event.target.value) })}
            className={spreadsheetInputClassName("text-right tabular-nums")}
            disabled={!editingEnabled}
          />
        </td>
        <td className="border border-stone-200 p-0">
          <input
            value={resource.unidad}
            onChange={(event) => onUpdateResource(resource.id, { unidad: event.target.value })}
            className={spreadsheetInputClassName()}
            disabled={!editingEnabled}
          />
        </td>
        <td className="border border-stone-200 p-0">
          <input
            type="number"
            min={0}
            value={resource.tiempo}
            onChange={(event) => onUpdateResource(resource.id, { tiempo: toGridNumber(event.target.value) })}
            className={spreadsheetInputClassName("text-right tabular-nums")}
            disabled={!editingEnabled}
          />
        </td>
        <td className="border border-stone-200 p-0">
          <input
            type="number"
            min={0}
            value={resource.precio_unitario_ref}
            onChange={(event) => onUpdateResource(resource.id, { precio_unitario_ref: toGridNumber(event.target.value) })}
            className={spreadsheetInputClassName("text-right tabular-nums")}
            disabled={!editingEnabled}
          />
        </td>
        <td className="border border-stone-200 px-1 py-0.5">
          <span className={`inline-flex h-5 items-center border px-1.5 text-[10px] font-bold leading-none ${status.className}`}>
            {status.label}
          </span>
          {isRepeated ? (
            <span className="ml-1 inline-flex h-5 items-center border border-amber-300 bg-amber-50 px-1.5 text-[10px] font-bold leading-none text-amber-700">
              Repetido
            </span>
          ) : null}
        </td>
        <td className="border border-stone-200 p-0">
          <input
            value={compactCommentValue(resource)}
            onChange={(event) => onUpdateResource(resource.id, { comentario: event.target.value, detalle_adicional: "" })}
            className={spreadsheetInputClassName()}
            placeholder="Comentario o detalle adicional"
            disabled={!editingEnabled}
          />
        </td>
        <td className="border border-stone-200 px-1 py-0.5 text-center">
          <button
            type="button"
            onClick={() => onDeleteResource(resource.id)}
            className={gridButtonClassName("danger")}
            disabled={!editingEnabled}
          >
            Elim.
          </button>
        </td>
      </tr>
    );
  }

  return (
    <section className="overflow-hidden border border-stone-300 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-stone-300 bg-stone-100 px-2 py-1">
        <div className="min-w-0">
          <h5 className="truncate text-[11px] font-bold uppercase tracking-wide text-stone-700">
            Recursos de la actividad {activityNumber}
          </h5>
          <p className="text-[10px] text-stone-500">{totalRows} registro(s) en {categories.length} tipo(s)</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={gridButtonClassName("secondary")}
            title="Preparado para agrupacion futura"
          >
            Agrupar
          </button>
          <button
            type="button"
            onClick={() => onAddResource(categories[0]?.key ?? "consumibles")}
            className={gridButtonClassName("primary")}
            disabled={!editingEnabled}
          >
            + Recurso
          </button>
        </div>
      </div>

      <div className="max-h-[360px] overflow-auto">
        <table className="w-full min-w-[1120px] border-collapse text-[11px]">
          <thead className="sticky top-0 z-10 bg-stone-200 text-left text-[10px] uppercase tracking-wide text-stone-600">
            <tr>
              <th className="w-16 border border-stone-300 px-1.5 py-1 font-bold">Item</th>
              <th className="w-32 border border-stone-300 px-1.5 py-1 font-bold">Codigo</th>
              <th className="min-w-80 border border-stone-300 px-1.5 py-1 font-bold">Descripcion</th>
              <th className="w-20 border border-stone-300 px-1.5 py-1 text-right font-bold">Cant.</th>
              <th className="w-20 border border-stone-300 px-1.5 py-1 font-bold">Unidad</th>
              <th className="w-24 border border-stone-300 px-1.5 py-1 text-right font-bold">Dia / tiempo</th>
              <th className="w-24 border border-stone-300 px-1.5 py-1 text-right font-bold">Precio</th>
              <th className="w-24 border border-stone-300 px-1.5 py-1 font-bold">Estado</th>
              <th className="min-w-72 border border-stone-300 px-1.5 py-1 font-bold">Comentario / detalle adicional</th>
              <th className="w-20 border border-stone-300 px-1.5 py-1 font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const categoryRows = rows.filter((resource) => resource.resource_category === category.key);
              return (
                <Fragment key={category.key}>
                  <tr className="bg-teal-50/70">
                    <td colSpan={10} className="border border-stone-300 px-2 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="inline-flex h-5 min-w-9 items-center justify-center border border-teal-200 bg-white px-1.5 text-[10px] font-black text-teal-800">
                            {activityNumber}.{category.shortLabel}
                          </span>
                          <span className="truncate text-[11px] font-bold text-stone-700">{category.label}</span>
                          <span className="text-[10px] text-stone-500">{categoryRows.length} registro(s)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onAddResource(category.key)}
                          className={gridButtonClassName("secondary")}
                          disabled={!editingEnabled}
                        >
                          + Recurso
                        </button>
                      </div>
                    </td>
                  </tr>
                  {categoryRows.length > 0 ? (
                    categoryRows.map((resource, index) => renderResourceRow(resource, index))
                  ) : (
                    <tr>
                      <td colSpan={10} className="border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-400">
                        Sin recursos registrados en {category.label.toLowerCase()}.
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
