"use client";

import type { Recurso } from "@/lib/demoData";
import { formatCurrencyNumber } from "@/lib/utils";

type ResourceInspectorPermissions = {
  canViewPrices: boolean;
  canViewSupplier: boolean;
  canViewImages: boolean;
  canViewDocuments: boolean;
  canViewMetadata: boolean;
};

type ResourceUsageSummary = {
  count: number;
  activityNumbers: string[];
};

type TechnicalProposalResourceInspectorProps = {
  resource: Recurso | null;
  snapshot?: {
    codigo_recurso: string;
    codigo_fabricante: string;
    tipo_recurso: string;
    descripcion: string;
    unidad: string;
    precio_unitario_ref: number;
    moneda: "PEN" | "USD";
    proveedor: string;
    marca: string;
    detalle_adicional: string;
    estado_origen: "catalogo_copiado" | "nuevo_por_formalizar";
    comentario: string;
  } | null;
  usage?: ResourceUsageSummary;
  permissions: ResourceInspectorPermissions;
};

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="grid grid-cols-[104px_1fr] gap-2 border-b border-stone-100 py-1 text-[11px]">
      <span className="font-bold uppercase tracking-wide text-stone-400">{label}</span>
      <span className="min-w-0 text-stone-700">{value || "-"}</span>
    </div>
  );
}

function resourceImageUrl(resource: Recurso): string {
  return (
    resource.resourceFiles?.imagen?.localPreviewUrl ||
    resource.resourceFiles?.imagen?.futureDriveUrl ||
    resource.resourceFiles?.imagenes?.[0]?.localPreviewUrl ||
    resource.resourceFiles?.imagenes?.[0]?.futureDriveUrl ||
    ""
  );
}

function CompactSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-stone-200 pt-2">
      <h4 className="mb-1 text-[10px] font-black uppercase tracking-wide text-stone-500">{title}</h4>
      {children}
    </section>
  );
}

export function TechnicalProposalResourceInspector({ resource, snapshot = null, usage, permissions }: TechnicalProposalResourceInspectorProps) {
  if (!resource && !snapshot) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-[12px] text-stone-500">
        Selecciona o busca un recurso para ver su informacion.
      </div>
    );
  }

  const code = resource?.codigo_recurso ?? snapshot?.codigo_recurso ?? "";
  const description = resource?.descripcion ?? snapshot?.descripcion ?? "";
  const type = resource?.tipo_recurso ?? snapshot?.tipo_recurso ?? "";
  const state = resource?.estado ?? (snapshot?.estado_origen === "catalogo_copiado" ? "Activo" : "Nuevo");
  const imageUrl = permissions.canViewImages && resource ? resourceImageUrl(resource) : "";
  const documentNames = [
    permissions.canViewDocuments ? resource?.resourceFiles?.fichaTecnica?.name || resource?.ficha_tecnica : "",
    ...(permissions.canViewDocuments ? resource?.resourceFiles?.archivos?.map((file) => file.name) ?? [] : []),
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <h3 className="mb-2 text-[12px] font-black text-stone-800">Detalle del recurso</h3>
      <div className="grid grid-cols-[82px_1fr] gap-3">
        <div>
          {imageUrl ? (
            <div
              className="h-20 w-20 rounded-lg border border-stone-200 bg-stone-100 bg-cover bg-center"
              style={{ backgroundImage: `url(${imageUrl})` }}
              title={resource?.imagen || resource?.resourceFiles?.imagen?.name || "Imagen del recurso"}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 px-2 text-center text-[10px] font-semibold text-stone-400">
              Sin imagen
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[11px] font-black uppercase tracking-wide text-teal-700">{code || "Sin codigo"}</div>
              <h3 className="mt-0.5 text-[13px] font-black leading-5 text-stone-900">{description || "-"}</h3>
              <p className="mt-0.5 text-[11px] text-stone-500">{type || "Sin tipo"}</p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              {state}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <CompactSection title="Datos generales">
          <InfoRow label="Fabricante" value={resource?.codigo_fabricante ?? snapshot?.codigo_fabricante} />
          <InfoRow label="Unidad" value={resource?.unidad ?? snapshot?.unidad} />
          <InfoRow label="Marca" value={permissions.canViewSupplier ? resource?.marca ?? snapshot?.marca : "Oculto por permisos"} />
          <InfoRow label="Modelo" value={resource?.modelo ?? snapshot?.detalle_adicional} />
          <InfoRow label="Entrega ref." value={resource?.tiempo_entrega_ref} />
        </CompactSection>

        <CompactSection title="Datos comerciales">
          <InfoRow
            label="Precio ref."
            value={permissions.canViewPrices ? `${resource?.moneda ?? snapshot?.moneda ?? "PEN"} ${formatCurrencyNumber(resource?.precio_unitario_ref ?? snapshot?.precio_unitario_ref ?? 0)}` : "Oculto por permisos"}
          />
          <InfoRow label="Proveedor" value={permissions.canViewSupplier ? resource?.proveedor ?? snapshot?.proveedor : "Oculto por permisos"} />
        </CompactSection>

        <CompactSection title="Documentos">
          {permissions.canViewDocuments && documentNames.length ? (
            <div className="flex flex-wrap gap-1">
              {documentNames.map((name) => (
                <span key={name} className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <InfoRow label="Archivos" value={permissions.canViewDocuments ? "Sin documentos" : "Oculto por permisos"} />
          )}
        </CompactSection>

        <CompactSection title="Uso en esta propuesta">
          <InfoRow label="Veces usado" value={usage?.count ?? 0} />
          <InfoRow label="Actividades" value={usage?.activityNumbers.join(", ") || "-"} />
        </CompactSection>

        {permissions.canViewMetadata ? (
          <CompactSection title="Observaciones">
            <p className="text-[11px] leading-5 text-stone-600">{resource?.observaciones || snapshot?.comentario || snapshot?.detalle_adicional || "-"}</p>
          </CompactSection>
        ) : null}
      </div>
    </div>
  );
}
