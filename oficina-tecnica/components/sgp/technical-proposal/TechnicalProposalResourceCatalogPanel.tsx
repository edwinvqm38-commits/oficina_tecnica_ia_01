"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Recurso, ResourceFileMeta } from "@/lib/sgp/demoData";

type TechnicalProposalResourceCatalogPanelProps = {
  resources: Recurso[];
  selectedResourceId: string | null;
  canAddResource: boolean;
  canCreateResource: boolean;
  canViewPrices: boolean;
  targetLabel: string;
  onInspectResource: (resource: Recurso) => void;
  onAddResource: (resourceId: string) => void;
  onCreateResource: () => void | Promise<void>;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function searchableText(resource: Recurso): string {
  return normalizeSearch([
    resource.codigo_recurso,
    resource.descripcion,
    resource.tipo_recurso,
    resource.marca,
    resource.proveedor,
    resource.codigo_fabricante,
    resource.modelo,
  ].join(" "));
}

function fileUrl(file: ResourceFileMeta | null | undefined): string {
  return file?.localPreviewUrl || file?.driveWebContentLink || file?.futureDriveUrl || "";
}

function usableUrl(value: string): string {
  return /^(https?:|data:|blob:|\/)/i.test(value.trim()) ? value.trim() : "";
}

function imageUrl(resource: Recurso): string {
  const images = resource.resourceFiles?.imagenes ?? [];
  return usableUrl(fileUrl(resource.resourceFiles?.imagen)) || usableUrl(fileUrl(images[0])) || usableUrl(resource.imagen || "");
}

function datasheetUrl(resource: Recurso): string {
  const sheets = resource.resourceFiles?.fichasTecnicas ?? [];
  return usableUrl(fileUrl(resource.resourceFiles?.fichaTecnica)) || usableUrl(fileUrl(sheets[0])) || usableUrl(resource.ficha_tecnica || "");
}

export function TechnicalProposalResourceCatalogPanel({
  resources,
  selectedResourceId,
  canAddResource,
  canCreateResource,
  canViewPrices,
  targetLabel,
  onInspectResource,
  onAddResource,
  onCreateResource,
}: TechnicalProposalResourceCatalogPanelProps) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = normalizeSearch(query);
  const filteredResources = useMemo(
    () => resources
      .filter((resource) => resource.estado !== "Inactivo")
      .filter((resource) => !normalizedQuery || searchableText(resource).includes(normalizedQuery))
      .slice(0, 100),
    [normalizedQuery, resources],
  );
  const selectedResource = resources.find((resource) => resource.id === selectedResourceId) ?? filteredResources[0] ?? null;

  useEffect(() => {
    function handleWorkspaceKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "F3") return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    document.addEventListener("keydown", handleWorkspaceKeyDown);
    return () => document.removeEventListener("keydown", handleWorkspaceKeyDown);
  }, []);

  function moveSelection(direction: -1 | 1) {
    if (!filteredResources.length) return;
    const currentIndex = Math.max(0, filteredResources.findIndex((resource) => resource.id === selectedResource?.id));
    const nextIndex = Math.min(filteredResources.length - 1, Math.max(0, currentIndex + direction));
    onInspectResource(filteredResources[nextIndex]);
  }

  function addSelectedResource() {
    if (!canAddResource || !selectedResource) return;
    onAddResource(selectedResource.id);
  }

  return (
    <section className="panel active resource-panel" aria-label="Catalogo maestro de recursos">
      <div className="resource-search">
        <div className="resource-search-head">
          <label htmlFor="technical-proposal-resource-search">Buscar recurso</label>
          <button type="button" onClick={() => void onCreateResource()} disabled={!canCreateResource || !canAddResource}>
            Crear recurso
          </button>
        </div>
        <input
          ref={searchRef}
          id="technical-proposal-resource-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveSelection(1);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              moveSelection(-1);
            }
            if (event.key === "Enter") {
              event.preventDefault();
              addSelectedResource();
            }
          }}
          placeholder="Codigo, descripcion, tipo, marca, proveedor..."
          autoComplete="off"
        />
        <div className="resource-target" title={targetLabel}>Destino: <strong>{targetLabel || "Sin seleccion"}</strong></div>
      </div>

      <div className="resource-list" role="listbox" aria-label="Resultados del catalogo">
        {filteredResources.map((resource) => (
          <button
            key={resource.id}
            type="button"
            className={`resource-row ${selectedResource?.id === resource.id ? "active" : ""}`}
            onClick={() => onInspectResource(resource)}
            onDoubleClick={() => canAddResource && onAddResource(resource.id)}
            role="option"
            aria-selected={selectedResource?.id === resource.id}
          >
            <b>{resource.codigo_recurso || "S/C"}</b>
            <span className="desc" title={resource.descripcion}>{resource.descripcion}</span>
            <span className="unit">{resource.unidad || "-"}</span>
          </button>
        ))}
        {!filteredResources.length ? <div className="resource-empty">Sin resultados.</div> : null}
      </div>

      <div className="resource-detail">
        {selectedResource ? (
          <article className="resource-card">
            <header className="resource-card-head">
              <div className="title">{selectedResource.descripcion}</div>
              <span className="code">{selectedResource.codigo_recurso || "S/C"}</span>
            </header>
            <div className="resource-card-body">
              <div className="photo">
                {imageUrl(selectedResource) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl(selectedResource)} alt={selectedResource.descripcion} />
                ) : (
                  <span>Sin imagen</span>
                )}
              </div>
              <div className="resource-meta">
                <label>Fabricante</label><div>{selectedResource.codigo_fabricante || "-"}</div>
                <label>Tipo</label><div>{selectedResource.tipo_recurso || "-"}</div>
                <label>Unidad</label><div>{selectedResource.unidad || "-"}</div>
                <label>Marca</label><div>{selectedResource.marca || "-"}</div>
                <label>Proveedor</label><div>{selectedResource.proveedor || "-"}</div>
                {canViewPrices ? <><label>Precio ref.</label><div>{selectedResource.moneda} {selectedResource.precio_unitario_ref.toFixed(2)}</div></> : null}
                <label>Ficha tecnica</label>
                <div className="link">
                  {datasheetUrl(selectedResource) ? <a href={datasheetUrl(selectedResource)} target="_blank" rel="noreferrer">Abrir documento</a> : "-"}
                </div>
              </div>
            </div>
            <div className="resource-card-actions">
              <button type="button" onClick={addSelectedResource} disabled={!canAddResource}>Agregar al documento</button>
            </div>
          </article>
        ) : (
          <div className="resource-empty">Selecciona un recurso para ver su ficha.</div>
        )}
      </div>

      <div className="related">
        <div className="related-title"><span>Recursos relacionados</span><span>{selectedResource ? 0 : "-"}</span></div>
        <div className="related-empty">Sin sugerencias.</div>
      </div>
    </section>
  );
}
