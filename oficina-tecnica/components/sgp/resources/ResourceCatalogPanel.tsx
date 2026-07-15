"use client";

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { Recurso, ResourceFileMeta } from "@/lib/sgp/demoData";
import { authFetch } from "@/lib/api/authFetch";
import { FieldLabelIcon } from "@/components/sgp/ui/FieldLabelIcon";
import { StatusBadge } from "@/components/sgp/StatusBadge";

type ResourceCatalogPanelProps = {
  resources: Recurso[];
  onSelectResource: (resourceId: string) => void;
  onClose: () => void;
  canAddResource?: boolean;
  className?: string;
};

type ResourceSearchAliases = Recurso & {
  tipo_recurso_nombre?: string;
  unidad_codigo?: string;
};

type ResolvedDriveImage = {
  fileId: string;
  name: string;
  mimeType: string;
  webViewLink: string;
};

type PendingImageRequest = {
  controller: AbortController;
  promise: Promise<string>;
};

type SearchableResource = {
  resource: Recurso;
  searchText: string;
};

type ResourceCatalogItemProps = {
  resource: Recurso;
  isActive: boolean;
  optionRef: RefObject<HTMLButtonElement | null> | null;
  onChooseResource: (resourceId: string) => void;
  onAddResource: (resourceId: string) => void;
};

type ResourceCatalogResultsProps = {
  resources: Recurso[];
  activeResourceId: string | null;
  activeOptionRef: RefObject<HTMLButtonElement | null>;
  onChooseResource: (resourceId: string) => void;
  onAddResource: (resourceId: string) => void;
};

const CATALOG_RESULT_LIMIT = 50;

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

function directDriveImageUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

function driveFileIdFromInternalUrl(value: string): string {
  const match = value.match(/\/api\/drive\/file\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

function uniqueSources(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function isImageFile(file: ResourceFileMeta | null | undefined): boolean {
  if (!file) return false;
  const mimeType = file.mime_type || file.type;
  if (mimeType?.startsWith("image/")) return true;
  const name = file.file_name || file.name || file.futureDriveUrl || file.driveWebContentLink || "";
  return /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(name);
}

function driveThumbnailSources(file: ResourceFileMeta | null | undefined): string[] {
  if (!file) return [];
  if (!isImageFile(file)) return [];
  if (file.localPreviewUrl) return [file.localPreviewUrl];
  const fileId = file.futureDriveFileId || driveFileIdFromUrl(file.futureDriveUrl);
  return uniqueSources([
    fileId ? internalDriveFileUrl(fileId) : "",
    file.driveWebContentLink ?? "",
    fileId ? directDriveImageUrl(fileId) : "",
    file.futureDriveUrl && /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(file.futureDriveUrl) ? file.futureDriveUrl : "",
  ]);
}

function firstResourceImage(resource: Recurso): ResourceFileMeta | null {
  const files = resource.resourceFiles.imagenes?.length
    ? resource.resourceFiles.imagenes
    : resource.resourceFiles.imagen
      ? [resource.resourceFiles.imagen]
      : [];
  const defaultFile = files.find((file) => {
    const metadata = file as ResourceFileMeta & { default?: boolean; isDefault?: boolean; is_default?: boolean };
    return Boolean(metadata.default || metadata.isDefault || metadata.is_default);
  });
  return defaultFile ?? files.find((file) => driveThumbnailSources(file).length > 0) ?? null;
}

function resolvedImageSources(resolvedImage: ResolvedDriveImage | null | undefined): string[] {
  if (!resolvedImage?.fileId || !resolvedImage.mimeType?.startsWith("image/")) return [];
  return uniqueSources([internalDriveFileUrl(resolvedImage.fileId), resolvedImage.webViewLink]);
}

function resourceSearchText(resource: Recurso): string {
  const aliases = resource as ResourceSearchAliases;
  return normalizeSearch(
    [
      resource.descripcion,
      aliases.tipo_recurso_nombre,
      resource.tipo_recurso,
      aliases.unidad_codigo,
      resource.unidad,
      resource.codigo_recurso,
      resource.codigo_fabricante,
    ].join(" "),
  );
}

function resourceCanAppear(resource: Recurso): boolean {
  return resource.estado === "Activo" || resource.estado === "Por revisar" || !resource.estado;
}

const ResourceCatalogItem = memo(function ResourceCatalogItem({
  resource,
  isActive,
  optionRef,
  onChooseResource,
  onAddResource,
}: ResourceCatalogItemProps) {
  const handleClick = useCallback(() => {
    onChooseResource(resource.id);
  }, [onChooseResource, resource.id]);

  const handleDoubleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onAddResource(resource.id);
  }, [onAddResource, resource.id]);

  return (
    <button
      id={`resource-catalog-option-${resource.id}`}
      ref={optionRef}
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`block w-full border-b border-stone-100 px-2.5 py-2 text-left ${
        isActive ? "bg-stone-900 text-white" : "bg-white text-stone-700 hover:bg-stone-50"
      }`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-semibold">{resource.descripcion}</span>
          <span className={`block truncate text-[10px] ${isActive ? "text-stone-200" : "text-stone-500"}`}>
            {[resource.codigo_recurso, resource.codigo_fabricante].filter(Boolean).join(" · ")}
          </span>
          <span className={`block truncate text-[10px] ${isActive ? "text-stone-200" : "text-stone-500"}`}>
            {[resource.tipo_recurso, resource.unidad].filter(Boolean).join(" · ")}
          </span>
        </span>
        {resource.estado === "Por revisar" ? (
          <span
            className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium ${
              isActive
                ? "border-amber-100 bg-amber-100 text-amber-800"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            Por regularizar
          </span>
        ) : null}
      </span>
    </button>
  );
});

const ResourceCatalogResults = memo(function ResourceCatalogResults({
  resources,
  activeResourceId,
  activeOptionRef,
  onChooseResource,
  onAddResource,
}: ResourceCatalogResultsProps) {
  if (resources.length === 0) {
    return (
      <div className="flex h-full min-h-[140px] items-center justify-center px-4 text-center text-[11px] text-stone-500">
        No hay recursos para la búsqueda actual.
      </div>
    );
  }

  return resources.map((resource) => {
    const isActive = activeResourceId === resource.id;
    return (
      <ResourceCatalogItem
        key={resource.id}
        resource={resource}
        isActive={isActive}
        optionRef={isActive ? activeOptionRef : null}
        onChooseResource={onChooseResource}
        onAddResource={onAddResource}
      />
    );
  });
});

function CatalogDriveImage({
  sources,
  alt,
  objectUrlCacheRef,
  pendingRequestRef,
}: {
  sources: string[];
  alt: string;
  objectUrlCacheRef: MutableRefObject<Map<string, string>>;
  pendingRequestRef: MutableRefObject<Map<string, PendingImageRequest>>;
}) {
  const [blobUrl, setBlobUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = sources[sourceIndex] ?? "";
  const isInternalDriveSource = src.startsWith("/api/drive/file/");
  const imageKey = isInternalDriveSource ? driveFileIdFromInternalUrl(src) || src : src;

  useEffect(() => {
    if (!src || !isInternalDriveSource) return;

    let active = true;
    const objectUrlCache = objectUrlCacheRef.current;
    const pendingRequests = pendingRequestRef.current;
    const cachedUrl = objectUrlCache.get(imageKey);
    if (cachedUrl) {
      setBlobUrl(cachedUrl);
      setFailed(false);
      return;
    }

    let pending = pendingRequests.get(imageKey);
    let createdRequest = false;
    if (!pending) {
      const controller = new AbortController();
      const promise = authFetch(src, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("No se pudo leer la imagen.");
          return response.blob();
        })
        .then((blob) => {
          const nextUrl = URL.createObjectURL(blob);
          objectUrlCache.set(imageKey, nextUrl);
          pendingRequests.delete(imageKey);
          return nextUrl;
        })
        .catch((error: unknown) => {
          pendingRequests.delete(imageKey);
          throw error;
        });
      pending = { controller, promise };
      pendingRequests.set(imageKey, pending);
      createdRequest = true;
    }

    pending.promise
      .then((nextUrl) => {
        if (!active) return;
        setBlobUrl(nextUrl);
        setFailed(false);
      })
      .catch(() => {
        if (!active) return;
        if (sourceIndex + 1 < sources.length) {
          setSourceIndex((current) => current + 1);
        } else {
          setFailed(true);
        }
      });

    return () => {
      active = false;
      if (createdRequest && pendingRequests.get(imageKey) === pending) {
        pending.controller.abort();
        pendingRequests.delete(imageKey);
      }
    };
  }, [imageKey, isInternalDriveSource, objectUrlCacheRef, pendingRequestRef, sourceIndex, sources.length, src]);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-stone-400">
        <FieldLabelIcon icon="image" label="Sin acceso" className="text-xs font-semibold" />
      </div>
    );
  }

  if (!isInternalDriveSource) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="h-auto max-h-full w-auto max-w-full object-contain object-center"
        loading="lazy"
        onError={() => {
          if (sourceIndex + 1 < sources.length) {
            setSourceIndex((current) => current + 1);
          } else {
            setFailed(true);
          }
        }}
      />
    );
  }

  if (!blobUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center text-stone-400">
        <FieldLabelIcon icon="image" label="Cargando" className="text-xs font-semibold" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={blobUrl}
      alt={alt}
      className="h-auto max-h-full w-auto max-w-full object-contain object-center"
      loading="lazy"
      onError={() => {
        if (sourceIndex + 1 < sources.length) {
          setSourceIndex((current) => current + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

export const ResourceCatalogPanel = memo(function ResourceCatalogPanel({
  resources,
  onSelectResource,
  onClose,
  canAddResource = true,
  className = "",
}: ResourceCatalogPanelProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [resolvedImages, setResolvedImages] = useState<Record<string, ResolvedDriveImage | null>>({});
  const [imageLookupErrorCode, setImageLookupErrorCode] = useState("");
  const activeOptionRef = useRef<HTMLButtonElement | null>(null);
  const imageObjectUrlCacheRef = useRef<Map<string, string>>(new Map());
  const pendingImageRequestRef = useRef<Map<string, PendingImageRequest>>(new Map());
  const lastAddRef = useRef<{ key: string; at: number } | null>(null);
  const shouldScrollSelectedIntoViewRef = useRef(false);
  const normalizedQuery = useMemo(() => normalizeSearch(deferredQuery), [deferredQuery]);

  const searchableCatalogResources = useMemo<SearchableResource[]>(
    () =>
      resources
        .filter(resourceCanAppear)
        .sort((a, b) => a.codigo_recurso.localeCompare(b.codigo_recurso))
        .map((resource) => ({
          resource,
          searchText: resourceSearchText(resource),
        })),
    [resources],
  );

  const catalogResources = useMemo(
    () => searchableCatalogResources.map((entry) => entry.resource),
    [searchableCatalogResources],
  );

  const catalogResourceById = useMemo(
    () => new Map(catalogResources.map((resource) => [resource.id, resource])),
    [catalogResources],
  );

  const filteredResources = useMemo(() => {
    const matches = normalizedQuery
      ? searchableCatalogResources
          .filter((entry) => entry.searchText.includes(normalizedQuery))
          .map((entry) => entry.resource)
      : catalogResources;
    return matches.slice(0, CATALOG_RESULT_LIMIT);
  }, [catalogResources, normalizedQuery, searchableCatalogResources]);

  const activeResource = useMemo(
    () => filteredResources.find((resource) => resource.id === selectedResourceId) ?? filteredResources[0] ?? null,
    [filteredResources, selectedResourceId],
  );

  const activeImageSourcesFromFiles = useMemo(() => {
    if (!activeResource) return [];
    return driveThumbnailSources(firstResourceImage(activeResource));
  }, [activeResource]);
  const activeResolvedImage = activeResource ? resolvedImages[activeResource.codigo_recurso] : null;
  const activeImageSources = useMemo(
    () => activeImageSourcesFromFiles.length
      ? activeImageSourcesFromFiles
      : resolvedImageSources(activeResolvedImage),
    [activeImageSourcesFromFiles, activeResolvedImage],
  );
  const shouldResolveActiveImage = Boolean(
    activeResource?.codigo_recurso &&
      activeImageSourcesFromFiles.length === 0 &&
      resolvedImages[activeResource.codigo_recurso] === undefined,
  );
  const isResolvingActiveImage = shouldResolveActiveImage;
  const hasActiveImageLookupError = Boolean(activeResource?.codigo_recurso && imageLookupErrorCode === activeResource.codigo_recurso);

  useEffect(() => {
    const objectUrlCache = imageObjectUrlCacheRef.current;
    const pendingRequests = pendingImageRequestRef.current;
    return () => {
      pendingRequests.forEach((request) => request.controller.abort());
      pendingRequests.clear();
      objectUrlCache.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      objectUrlCache.clear();
    };
  }, []);

  useEffect(() => {
    if (!activeResource?.codigo_recurso || !shouldResolveActiveImage) return;
    const resourceCode = activeResource.codigo_recurso;
    const controller = new AbortController();
    authFetch("/api/drive/resource-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceCodes: [resourceCode] }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo resolver la imagen del recurso.");
        return (await response.json()) as { images?: Record<string, ResolvedDriveImage> };
      })
      .then((payload) => {
        const resolved = payload.images?.[resourceCode] ?? null;
        setResolvedImages((previous) => ({ ...previous, [resourceCode]: resolved }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResolvedImages((previous) => ({ ...previous, [resourceCode]: null }));
        setImageLookupErrorCode(resourceCode);
      });
    return () => controller.abort();
  }, [activeResource?.codigo_recurso, shouldResolveActiveImage]);

  useEffect(() => {
    if (!shouldScrollSelectedIntoViewRef.current) return;
    shouldScrollSelectedIntoViewRef.current = false;
    activeOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedResourceId]);

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    setMessage("");
  }, []);

  const handleChooseResource = useCallback((resourceId: string) => {
    setSelectedResourceId(resourceId);
    setMessage("");
  }, []);

  const selectByIndex = useCallback((index: number) => {
    const resource = filteredResources[index];
    if (resource) {
      shouldScrollSelectedIntoViewRef.current = true;
      handleChooseResource(resource.id);
    }
  }, [filteredResources, handleChooseResource]);

  const moveSelection = useCallback((offset: number) => {
    if (filteredResources.length === 0) return;
    const currentIndex = Math.max(
      0,
      filteredResources.findIndex((resource) => resource.id === activeResource?.id),
    );
    const nextIndex = (currentIndex + offset + filteredResources.length) % filteredResources.length;
    selectByIndex(nextIndex);
  }, [activeResource?.id, filteredResources, selectByIndex]);

  const handleAddSelectedResource = useCallback((resourceId?: string) => {
    if (!canAddResource) {
      setMessage("No tienes permiso para agregar recursos al requerimiento.");
      return;
    }
    const resource = resourceId
      ? catalogResourceById.get(resourceId)
      : activeResource;
    if (!resource) return;
    const addKey = resource.id;
    const now = Date.now();
    if (lastAddRef.current?.key === addKey && now - lastAddRef.current.at < 350) return;
    lastAddRef.current = { key: addKey, at: now };
    setSelectedResourceId(resource.id);
    onSelectResource(resource.id);
    setMessage("");
  }, [activeResource, canAddResource, catalogResourceById, onSelectResource]);

  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      moveSelection(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      moveSelection(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      event.stopPropagation();
      selectByIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      selectByIndex(filteredResources.length - 1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      handleAddSelectedResource();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (query) {
        updateQuery("");
      } else {
        onClose();
      }
    }
  }, [filteredResources.length, handleAddSelectedResource, moveSelection, onClose, query, selectByIndex, updateQuery]);

  const handlePanelKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (query) {
      updateQuery("");
    } else {
      onClose();
    }
  }, [onClose, query, updateQuery]);

  return (
    <aside
      className={`flex min-h-0 w-full flex-col rounded-xl border border-border bg-white shadow-sm lg:w-[360px] xl:w-[390px] ${className}`}
      aria-label="Catálogo de recursos"
      onKeyDown={handlePanelKeyDown}
    >
      <div className="flex flex-none items-center justify-between gap-2 border-b border-border px-2.5 py-2">
        <FieldLabelIcon icon="package" label="Catálogo de recursos" className="text-xs font-semibold text-stone-700" />
        <div className="flex items-center gap-1.5">
          <span className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-stone-500">
            {filteredResources.length}/{catalogResources.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-stone-200 text-[13px] leading-none text-stone-500 hover:bg-stone-100"
            aria-label="Cerrar catálogo de recursos"
            title="Cerrar catálogo"
          >
            x
          </button>
        </div>
      </div>

      <div className="flex flex-none flex-col gap-2 border-b border-border p-2.5">
        <label className="sr-only" htmlFor="requirement-resource-catalog-search">
          Buscar recursos
        </label>
        <input
          id="requirement-resource-catalog-search"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="h-8 rounded border border-stone-300 bg-white px-2 text-[11px] text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-500"
          placeholder="Buscar por descripción, tipo, unidad o código..."
          role="combobox"
          aria-controls="requirement-resource-catalog-list"
          aria-activedescendant={activeResource ? `resource-catalog-option-${activeResource.id}` : undefined}
          aria-expanded="true"
        />

        <div className="flex h-[150px] items-center justify-center overflow-hidden rounded border border-stone-200 bg-stone-50 p-3">
          {isResolvingActiveImage ? (
            <div className="flex h-full w-full items-center justify-center text-stone-400">
              <FieldLabelIcon icon="image" label="Cargando" className="text-xs font-semibold" />
            </div>
          ) : activeResource && activeImageSources.length > 0 ? (
            <CatalogDriveImage
              key={`${activeResource.id}:${activeImageSources.join("|")}`}
              sources={activeImageSources}
              alt={`Imagen de ${activeResource.descripcion}`}
              objectUrlCacheRef={imageObjectUrlCacheRef}
              pendingRequestRef={pendingImageRequestRef}
            />
          ) : hasActiveImageLookupError ? (
            <div className="flex h-full w-full items-center justify-center text-amber-600">
              <FieldLabelIcon icon="image" label="Error al cargar" className="text-xs font-semibold" />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-stone-400">
              <FieldLabelIcon icon="image" label="Sin imagen" className="text-xs font-semibold" />
            </div>
          )}
        </div>

        {activeResource ? (
          <div className="min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-[12px] font-semibold text-stone-800">{activeResource.descripcion}</p>
              <StatusBadge status={activeResource.estado || "Activo"} />
            </div>
            <p className="truncate text-[11px] text-stone-500">
              {[activeResource.codigo_recurso, activeResource.codigo_fabricante, activeResource.tipo_recurso, activeResource.unidad]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {activeResource.estado === "Por revisar" ? (
              <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                Por regularizar
              </span>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => handleAddSelectedResource()}
          disabled={!activeResource || !canAddResource}
          className="inline-flex h-8 items-center justify-center rounded border border-stone-800 bg-stone-800 px-2 text-[11px] font-semibold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400"
        >
          Agregar
        </button>
        {message ? <p className="text-[11px] font-medium text-amber-700">{message}</p> : null}
      </div>

      <div
        id="requirement-resource-catalog-list"
        role="listbox"
        aria-label="Resultados del catálogo de recursos"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <ResourceCatalogResults
          resources={filteredResources}
          activeResourceId={activeResource?.id ?? null}
          activeOptionRef={activeOptionRef}
          onChooseResource={handleChooseResource}
          onAddResource={handleAddSelectedResource}
        />
      </div>
    </aside>
  );
});
