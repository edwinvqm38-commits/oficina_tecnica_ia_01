"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo } from "react";
import { numberTechnicalProposalResourceGroups } from "@/lib/sgp/technicalProposalHierarchy";
import type { TechnicalProposalOutputResource, TechnicalProposalOutputScopeItem } from "@/lib/sgp/technicalProposalOutput";

type PreviewImage = {
  id: string;
  scope_item_id: string | null;
  title: string;
  relation_label: string;
  data_url: string;
  public_url: string | null;
};

type TechnicalProposalDocumentPreviewProps = {
  documentCode: string;
  revision: string;
  date: string;
  title: string;
  subtitle: string;
  company: string;
  client: string;
  unit: string;
  attention: string;
  reference: string;
  presentation: string;
  companyLogoUrl?: string | null;
  clientLogoUrl?: string | null;
  scopeItems: Array<TechnicalProposalOutputScopeItem & { description: string }>;
  resources: TechnicalProposalOutputResource[];
  resourceCategoryOrder: string[];
  generalImages: PreviewImage[];
  activityImages: PreviewImage[];
  enabledResourceTables?: Record<string, string[]>;
  conditions: Record<string, string>;
};

const RESOURCE_LABELS: Record<string, string> = {
  mano_obra: "Mano de obra",
  mano_obra_directa: "Mano de obra",
  mano_obra_indirecta: "Mano de obra",
  materiales: "Materiales",
  herramientas: "Herramientas",
  equipos: "Equipos",
  equipos_herramientas: "Equipos y herramientas",
  consumibles: "Consumibles",
  subcontratos: "Subcontratos",
  gastos_generales: "Gastos generales",
  vehiculos: "Vehículos",
  transporte: "Transporte",
};

function imageSource(image: PreviewImage): string {
  return image.data_url || image.public_url || "";
}

export function TechnicalProposalDocumentPreview({
  documentCode,
  revision,
  date,
  title,
  subtitle,
  company,
  client,
  unit,
  attention,
  reference,
  presentation,
  companyLogoUrl,
  clientLogoUrl,
  scopeItems,
  resources,
  resourceCategoryOrder,
  generalImages,
  activityImages,
  conditions,
}: TechnicalProposalDocumentPreviewProps) {
  const resourcesByScope = useMemo(() => {
    const result = new Map<string, TechnicalProposalOutputResource[]>();
    resources.forEach((resource) => result.set(resource.scopeItemId, [...(result.get(resource.scopeItemId) ?? []), resource]));
    return result;
  }, [resources]);
  const contextualImages = useMemo(
    () => [...generalImages, ...activityImages].filter((image) => Boolean(image.scope_item_id)),
    [activityImages, generalImages],
  );
  const unscopedGeneralImages = useMemo(
    () => generalImages.filter((image) => !image.scope_item_id),
    [generalImages],
  );

  return (
    <section className="h-full overflow-auto bg-slate-200/70 p-3" aria-label="Vista previa imprimible de la propuesta técnica">
      <div className="mx-auto flex max-w-[760px] flex-col gap-4" data-document-preview="technical-proposal">
        <article className="aspect-[210/297] min-h-[620px] overflow-hidden bg-white p-[7%] shadow-lg ring-1 ring-slate-300">
          <div className="flex items-start justify-between gap-6">
            <div className="flex h-16 w-36 items-center justify-center rounded border border-slate-200 bg-slate-50 p-2">
              {companyLogoUrl ? <img src={companyLogoUrl} alt={company} className="max-h-full max-w-full object-contain" /> : <span className="text-center text-[10px] font-black uppercase text-slate-500">{company}</span>}
            </div>
            <div className="flex h-16 w-36 items-center justify-center rounded border border-slate-200 bg-slate-50 p-2">
              {clientLogoUrl ? <img src={clientLogoUrl} alt={client} className="max-h-full max-w-full object-contain" /> : <span className="text-center text-[10px] font-black uppercase text-slate-500">{client}</span>}
            </div>
          </div>
          <div className="mt-[18%] border-y-4 border-blue-800 py-6 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-blue-700">Propuesta técnica-económica</div>
            <h2 className="mt-4 text-2xl font-black uppercase leading-tight text-slate-900">{title}</h2>
            <p className="mt-2 text-sm font-bold uppercase text-slate-600">{subtitle}</p>
          </div>
          <dl className="mt-12 grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 text-[11px]">
            <dt className="font-black uppercase text-slate-500">Cliente</dt><dd className="font-bold text-slate-900">{client}</dd>
            <dt className="font-black uppercase text-slate-500">Unidad</dt><dd>{unit || "—"}</dd>
            <dt className="font-black uppercase text-slate-500">Atención</dt><dd>{attention || "—"}</dd>
            <dt className="font-black uppercase text-slate-500">Referencia</dt><dd>{reference || "—"}</dd>
            <dt className="font-black uppercase text-slate-500">Documento</dt><dd>{documentCode} · {revision}</dd>
            <dt className="font-black uppercase text-slate-500">Fecha</dt><dd>{date || "—"}</dd>
          </dl>
        </article>

        <article className="min-h-[880px] bg-white p-10 shadow-lg ring-1 ring-slate-300">
          <header className="flex items-center justify-between border-b-2 border-blue-800 pb-3 text-[9px] text-slate-500">
            <strong className="text-blue-900">{company}</strong><span>{documentCode} · {revision}</span>
          </header>
          <h2 className="mt-6 text-sm font-black uppercase text-blue-900">Resumen de los alcances del servicio</h2>
          <div className="mt-3 space-y-1 text-[10px]">
            {scopeItems.map((item) => (
              <div key={`preview-summary-${item.id}`} className="flex items-start gap-2" style={{ paddingLeft: `${Math.min(item.level, 4) * 12}px` }}>
                <strong className="shrink-0 tabular-nums text-blue-900">{item.number}</strong><span className={item.kind === "activity" ? "text-slate-700" : "font-bold uppercase text-slate-800"}>{item.title}</span>
              </div>
            ))}
          </div>
          <h2 className="mt-8 text-sm font-black uppercase text-blue-900">Presentación</h2>
          <p className="mt-2 whitespace-pre-wrap text-[10px] leading-5 text-slate-700">{presentation || "Sin resumen registrado."}</p>
          {unscopedGeneralImages.length ? (
            <div className="mt-6 grid grid-cols-2 gap-3">
              {unscopedGeneralImages.map((image) => imageSource(image) ? <figure key={image.id} className="rounded border border-slate-200 p-2"><img src={imageSource(image)} alt={image.title} className="h-28 w-full object-contain" /><figcaption className="mt-1 text-center text-[8px] text-slate-500">{image.title}</figcaption></figure> : null)}
            </div>
          ) : null}
        </article>

        <article className="min-h-[880px] bg-white p-10 shadow-lg ring-1 ring-slate-300">
          <header className="flex items-center justify-between border-b-2 border-blue-800 pb-3 text-[9px] text-slate-500">
            <strong className="text-blue-900">Desarrollo técnico</strong><span>{documentCode}</span>
          </header>
          <div className="mt-5 space-y-5">
            {scopeItems.map((item) => {
              const itemResources = resourcesByScope.get(item.id) ?? [];
              const usedCategories = new Set(itemResources.map((resource) => resource.resourceCategory));
              const orderedCategories = [
                ...resourceCategoryOrder.filter((category) => usedCategories.has(category)),
                ...Array.from(usedCategories).filter((category) => !resourceCategoryOrder.includes(category)),
              ];
              const categories = numberTechnicalProposalResourceGroups(
                item.number,
                orderedCategories.map((category) => ({ category })),
              );
              const images = contextualImages.filter((image) => image.scope_item_id === item.id);
              return (
                <section key={`preview-scope-${item.id}`} style={{ marginLeft: `${Math.min(item.level, 4) * 14}px` }}>
                  <h3 className={`${item.kind === "group" ? "border-b-2 border-blue-800 pb-1 text-[12px]" : item.kind === "subgroup" ? "text-[11px]" : "text-[10px]"} font-black ${item.kind === "activity" ? "normal-case text-slate-800" : "uppercase text-blue-900"}`}>
                    {item.number}. {item.title}
                  </h3>
                  {item.description ? <p className="mt-1 whitespace-pre-wrap text-[9px] leading-4 text-slate-700">{item.description}</p> : null}
                  {images.length ? <div className="mt-2 grid grid-cols-2 gap-2">{images.map((image) => imageSource(image) ? <figure key={image.id} className="rounded border border-slate-200 p-1"><img src={imageSource(image)} alt={image.title} className="h-24 w-full object-contain" /><figcaption className="text-center text-[7px] text-slate-500">{image.title}{image.relation_label ? ` · ${image.relation_label}` : ""}</figcaption></figure> : null)}</div> : null}
                  {categories.map(({ category, number }) => {
                    const categoryRows = itemResources.filter((resource) => resource.resourceCategory === category);
                    return (
                      <div key={`${item.id}:${category}`} className="mt-2 overflow-hidden rounded border border-slate-200">
                        <div className="bg-slate-100 px-2 py-1 text-[8px] font-black uppercase text-slate-600">{number} {RESOURCE_LABELS[category] ?? category}</div>
                        <table className="w-full border-collapse text-[8px]"><thead><tr className="text-slate-500"><th className="border-t border-r border-slate-200 px-2 py-1 text-left">Código</th><th className="border-t border-r border-slate-200 px-2 py-1 text-left">Recurso</th><th className="border-t border-r border-slate-200 px-2 py-1 text-right">Cantidad</th><th className="border-t border-slate-200 px-2 py-1">UM</th></tr></thead><tbody>
                          {categoryRows.map((resource) => <tr key={resource.rowId}><td className="border-t border-r border-slate-200 px-2 py-1">{resource.codigo || "S/C"}</td><td className="border-t border-r border-slate-200 px-2 py-1">{resource.descripcion}</td><td className="border-t border-r border-slate-200 px-2 py-1 text-right">{resource.cantidad}</td><td className="border-t border-slate-200 px-2 py-1 text-center">{resource.unidad || "-"}</td></tr>)}
                        </tbody></table>
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
          <h2 className="mt-8 border-t-2 border-blue-800 pt-4 text-sm font-black uppercase text-blue-900">Condiciones</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[8px] leading-4 text-slate-600">
            {Object.entries(conditions).filter(([, value]) => value.trim()).map(([key, value]) => <div key={key}><strong className="block uppercase text-slate-800">{key.replace(/_/g, " ")}</strong><span>{value}</span></div>)}
          </div>
        </article>
      </div>
    </section>
  );
}
