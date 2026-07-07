"use client";

import { useEffect, useMemo, useState } from "react";
import type { Recurso, ResourceFileMeta } from "@/lib/sgp/demoData";
import { FieldLabelIcon } from "@/components/sgp/ui/FieldLabelIcon";
import { StatusBadge } from "@/components/sgp/StatusBadge";
import { authFetch } from "@/lib/api/authFetch";

type ResourceGalleryProps = {
  rows: Recurso[];
  loading?: boolean;
  onEdit?: (resource: Recurso) => void;
  canEdit?: boolean;
};

type ResolvedDriveImage = {
  fileId: string;
  name: string;
  mimeType: string;
  webViewLink: string;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function driveFileIdFromUrl(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  const filePathMatch = normalized.match(/\/file\/d\/([^/?#]+)/i);
  if (filePathMatch?.[1]) return filePathMatch[1];
  try {
    const url = new URL(normalized);
    return url.searchParams.get("id") ?? "";
  } catch {
    return "";
  }
}

function internalDriveFileUrl(fileId: string): string {
  return `/api/drive/file/${encodeURIComponent(fileId)}`;
}

function driveThumbnailUrl(file: ResourceFileMeta | null | undefined): string {
  if (!file) return "";
  if (file.localPreviewUrl) return file.localPreviewUrl;
  const fileId = file.futureDriveFileId || driveFileIdFromUrl(file.futureDriveUrl);
  if (fileId) return internalDriveFileUrl(fileId);
  if (file.futureDriveUrl && /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(file.futureDriveUrl)) return file.futureDriveUrl;
  return "";
}

function resourceImage(resource: Recurso, resolvedImages: Record<string, ResolvedDriveImage>): string {
  const imageFile = resource.resourceFiles.imagenes?.[0] ?? resource.resourceFiles.imagen ?? null;
  const explicitImage = driveThumbnailUrl(imageFile);
  if (explicitImage) return explicitImage;
  const resolved = resolvedImages[resource.codigo_recurso];
  return resolved?.fileId ? internalDriveFileUrl(resolved.fileId) : "";
}

function SecureDriveImage({ src, alt }: { src: string; alt: string }) {
  const [blobUrl, setBlobUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src.startsWith("/api/drive/file/")) {
      setBlobUrl(src);
      setFailed(false);
      return;
    }

    let active = true;
    setFailed(false);
    authFetch(src)
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo leer imagen.");
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        const nextUrl = URL.createObjectURL(blob);
        setBlobUrl((previous) => {
          if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
          return nextUrl;
        });
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      setBlobUrl((previous) => {
        if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
        return "";
      });
    };
  }, [src]);

  if (failed || !blobUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center text-stone-400">
        <FieldLabelIcon icon="image" label={failed ? "Sin acceso" : "Cargando"} className="text-xs font-semibold" />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={blobUrl} alt={alt} className="max-h-full max-w-full object-contain" loading="lazy" />;
}

function matchesResource(resource: Recurso, query: string): boolean {
  if (!query) return true;
  const haystack = normalizeSearch(
    [
      resource.codigo_recurso,
      resource.codigo_eka,
      resource.codigo_fabricante,
      resource.descripcion,
      resource.tipo_recurso,
      resource.unidad,
      resource.proveedor,
      resource.marca,
      resource.modelo,
    ].join(" "),
  );
  return haystack.includes(query);
}

export function ResourceGallery({ rows, loading = false, onEdit, canEdit = false }: ResourceGalleryProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [resolvedImages, setResolvedImages] = useState<Record<string, ResolvedDriveImage>>({});
  const normalizedSearch = normalizeSearch(search);
  const typeOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.tipo_recurso).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" }),
      ),
    [rows],
  );
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (typeFilter && row.tipo_recurso !== typeFilter) return false;
        return matchesResource(row, normalizedSearch);
      }),
    [normalizedSearch, rows, typeFilter],
  );
  const missingImageCodes = useMemo(
    () =>
      rows
        .filter((row) => !resourceImage(row, resolvedImages))
        .map((row) => row.codigo_recurso)
        .filter(Boolean),
    [resolvedImages, rows],
  );

  useEffect(() => {
    const unresolvedCodes = missingImageCodes.filter((code) => !resolvedImages[code]);
    if (unresolvedCodes.length === 0) return;
    const controller = new AbortController();
    authFetch("/api/drive/resource-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceCodes: unresolvedCodes }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { images?: Record<string, ResolvedDriveImage> } | null) => {
        if (!payload?.images) return;
        setResolvedImages((prev) => ({ ...prev, ...payload.images }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("[ResourceGallery] No se pudieron resolver imágenes desde Drive.", error);
      });
    return () => controller.abort();
  }, [missingImageCodes, resolvedImages]);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="min-w-[240px] flex-1">
          <FieldLabelIcon icon="file-search" label="Buscar recurso" className="mb-1 text-[11px] font-semibold text-stone-600" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Código, nombre, tipo, proveedor, marca..."
            className="h-8 w-full rounded-md border border-border bg-white px-2 text-xs outline-none focus:border-teal-600"
          />
        </div>
        <div className="w-full sm:w-56">
          <FieldLabelIcon icon="tags" label="Tipo" className="mb-1 text-[11px] font-semibold text-stone-600" />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="h-8 w-full rounded-md border border-border bg-white px-2 text-xs outline-none focus:border-teal-600"
          >
            <option value="">Todos</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto self-end text-[11px] text-muted">
          {loading ? "Cargando..." : `${filteredRows.length} de ${rows.length} recurso${rows.length === 1 ? "" : "s"}`}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-stone-50/60 p-2.5">
        {filteredRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-xs text-muted">
            No se encontraron recursos para la búsqueda actual.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filteredRows.map((resource) => {
              const imageUrl = resourceImage(resource, resolvedImages);
              return (
                <article
                  key={resource.id}
                  className="group overflow-hidden rounded-lg border border-border bg-white shadow-sm transition hover:border-teal-300 hover:shadow-md"
                >
                  <div className="flex aspect-[2/1] items-center justify-center bg-stone-50 p-3">
                    {imageUrl ? (
                      <SecureDriveImage src={imageUrl} alt={resource.descripcion} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-stone-400">
                        <FieldLabelIcon icon="image" label="Sin imagen" className="text-xs font-semibold" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold text-teal-700">{resource.codigo_recurso}</p>
                        <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-stone-900" title={resource.descripcion}>
                          {resource.descripcion}
                        </h3>
                      </div>
                      <span className="shrink-0 rounded border border-border bg-stone-50 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600">
                        {resource.unidad || "-"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={resource.tipo_recurso || "Sin tipo"} />
                      <StatusBadge status={resource.estado} />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] text-stone-600">
                      <div className="min-w-0">
                        <span className="block text-stone-400">Proveedor</span>
                        <span className="block truncate">{resource.proveedor || "-"}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="block text-stone-400">Marca</span>
                        <span className="block truncate">{resource.marca || "-"}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5">
                      <span className="text-[11px] font-semibold text-stone-800">
                        {resource.moneda} {resource.precio_unitario_ref.toFixed(2)}
                      </span>
                      {canEdit && onEdit ? (
                        <button
                          type="button"
                          onClick={() => onEdit(resource)}
                          className="h-6 rounded-md border border-border px-2 text-[10px] font-semibold text-stone-700 hover:bg-stone-100"
                        >
                          Ver / Editar
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
