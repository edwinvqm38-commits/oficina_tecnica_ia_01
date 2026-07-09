"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/sgp/auth/AuthContext";
import { ResourceFormModal } from "@/components/sgp/resources/ResourceFormModal";
import { ResourceGallery } from "@/components/sgp/resources/ResourceGallery";
import { ResourcesTable } from "@/components/sgp/resources/ResourcesTable";
import { demoData, type Recurso, type ResourceFileMeta } from "@/lib/sgp/demoData";
import { getModulePermissions, type ModulePermissions } from "@/lib/sgp/modulePermissionsRepository";
import { createProposalLogoDraft, readProposalLogos, writeProposalLogos, type ProposalLogo, type ProposalLogoEntityType } from "@/lib/sgp/proposalLogos";
import {
  createRecurso,
  deactivateRecurso,
  getNextResourceDraftCode,
  listAllRecursos,
  listRecursos,
  listRecursosFilterOptions,
  uploadResourceFile,
  createResourceFileSignedUrl,
  updateRecurso,
  RecursoWriteError,
  type ResourceStorageFileCategory,
  type RecursosColumnFilters,
  type RecursosDataSource,
  type RecursosFilterOptions,
  type RecursoSortDirection,
  type RecursoSortField,
} from "@/lib/sgp/recursosRepository";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const EMPTY_FILTERS: RecursosColumnFilters = {
  codigoRecurso: "",
  codigoEka: "",
  codigoFabricante: "",
  descripcion: "",
  proveedor: "",
  marca: "",
  modelo: "",
  tipoRecurso: "",
  estado: "",
  moneda: "",
};

type ResourcesViewGroupPermissions = {
  resources_main_table: boolean;
  resources_economic_data: boolean;
  resources_supplier_data: boolean;
  resources_documents: boolean;
  resources_actions: boolean;
};

const DEFAULT_RESOURCES_VIEW_GROUPS: ResourcesViewGroupPermissions = {
  resources_main_table: true,
  resources_economic_data: true,
  resources_supplier_data: true,
  resources_documents: true,
  resources_actions: true,
};

function readResourcesViewGroups(permissions: ModulePermissions | null): ResourcesViewGroupPermissions {
  const root = permissions?.metadata?.module_view_groups;
  if (!root || typeof root !== "object" || Array.isArray(root)) return DEFAULT_RESOURCES_VIEW_GROUPS;
  const groups = (root as Record<string, unknown>).recursos;
  if (!groups || typeof groups !== "object" || Array.isArray(groups)) return DEFAULT_RESOURCES_VIEW_GROUPS;
  const values = groups as Record<string, unknown>;
  return {
    resources_main_table: values.resources_main_table !== false,
    resources_economic_data: values.resources_economic_data !== false,
    resources_supplier_data: values.resources_supplier_data !== false,
    resources_documents: values.resources_documents !== false,
    resources_actions: values.resources_actions !== false,
  };
}

function safeUuid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Fallback for insecure contexts (HTTP over LAN) where randomUUID may throw.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyResourceDraft(code: string): Recurso {
  return {
    id: `rec-${safeUuid()}`,
    codigo_recurso: code,
    codigo_eka: "",
    codigo_fabricante: "",
    tipo_recurso: "",
    descripcion: "",
    unidad: "und",
    precio_unitario_ref: 0,
    moneda: "PEN",
    proveedor: "Suministros Lima",
    marca: "Genérico",
    modelo: "",
    tiempo_entrega_ref: "",
    ficha_tecnica: "",
    imagen: "",
    archivos: "",
    estado: "Activo",
    fecha_actualizacion: new Date().toISOString().slice(0, 10),
    observaciones: "",
    resourceFiles: {
      fichaTecnica: null,
      imagen: null,
      cotizacion: null,
      fichasTecnicas: [],
      imagenes: [],
      cotizaciones: [],
      archivos: [],
    },
  };
}

export default function RecursosPage() {
  const searchParams = useSearchParams();
  const { profile, user } = useAuth();
  const [resources, setResources] = useState<Recurso[]>([]);
  const [totalResources, setTotalResources] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [filters, setFilters] = useState<RecursosColumnFilters>(EMPTY_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<RecursosColumnFilters>(EMPTY_FILTERS);
  const [sortBy, setSortBy] = useState<RecursoSortField>("codigo_recurso");
  const [sortDirection, setSortDirection] = useState<RecursoSortDirection>("asc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Recurso | null>(null);
  const [savingResource, setSavingResource] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<RecursosDataSource>("demo");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [modulePermissions, setModulePermissions] = useState<ModulePermissions | null>(null);
  const [activeResourceView, setActiveResourceView] = useState<"resources" | "gallery" | "logos">("resources");
  const [logos, setLogos] = useState<ProposalLogo[]>([]);
  const [galleryResources, setGalleryResources] = useState<Recurso[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const restoredResourceCodeRef = useRef<string | null>(null);
  const openedResourceCodeRef = useRef<string | null>(null);

  const catalogs = useMemo(() => demoData.listCatalogSummary(), []);
  const currentUserEmail = (profile.email ?? user.email ?? "").trim().toLowerCase();
  const defaultFilterOptions = useMemo<RecursosFilterOptions>(
    () => ({
      tipos: catalogs.tipoRecurso.map((item) => item.nombre),
      estados: catalogs.estadosRecurso.map((item) => item.nombre),
      monedas: catalogs.monedas.map((item) => item.codigo),
      proveedores: catalogs.proveedores.map((item) => item.nombre),
      marcas: catalogs.marcas.map((item) => item.nombre),
      source: "demo",
    }),
    [catalogs.estadosRecurso, catalogs.marcas, catalogs.monedas, catalogs.proveedores, catalogs.tipoRecurso],
  );
  const [filterOptions, setFilterOptions] = useState<RecursosFilterOptions>(defaultFilterOptions);
  const resourcesViewGroups = useMemo(() => readResourcesViewGroups(modulePermissions), [modulePermissions]);
  const isElevatedResourceUser =
    profile.is_super_admin === true || profile.role === "admin" || currentUserEmail === "edwin.qm@outlook.com";
  const canCreateResource =
    dataSource === "supabase" && !permissionsLoading && !loading && (modulePermissions?.can_create === true || isElevatedResourceUser);
  const canEditResource =
    dataSource === "supabase" && !permissionsLoading && !loading && (modulePermissions?.can_edit === true || isElevatedResourceUser);
  const canManageResourceDocuments =
    dataSource === "supabase" &&
    !permissionsLoading &&
    !loading &&
    (modulePermissions?.can_edit === true || modulePermissions?.can_upload_files === true || isElevatedResourceUser);
  const canOpenResourceModal = canEditResource || canManageResourceDocuments;
  const isEditingExistingResource = editing ? resources.some((item) => item.id === editing.id) : false;
  const total = totalResources;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);
  const pagedResources = resources;

  useEffect(() => {
    let active = true;
    setPermissionsLoading(true);
    if (!currentUserEmail) {
      setModulePermissions(null);
      setPermissionsLoading(false);
      return () => {
        active = false;
      };
    }

    getModulePermissions("recursos", currentUserEmail)
      .then((permissions) => {
        if (!active) return;
        if (process.env.NODE_ENV === "development") {
          console.log("[recursos] email autenticado:", currentUserEmail);
          console.log("[recursos] permisos recibidos:", permissions);
        }
        setModulePermissions(permissions);
      })
      .finally(() => {
        if (active) setPermissionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUserEmail]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!currentUserEmail) return;
    if (modulePermissions) return;
    console.log("[recursos] sin permisos de modulo para email:", currentUserEmail);
  }, [currentUserEmail, modulePermissions]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFilters(filters), 350);
    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    const resourceCode = searchParams.get("resourceCode")?.trim();
    if (!resourceCode || restoredResourceCodeRef.current === resourceCode) return;
    restoredResourceCodeRef.current = resourceCode;
    setActiveResourceView("resources");
    setPage(1);
    setFilters((prev) => ({ ...prev, codigoRecurso: resourceCode }));
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    listRecursosFilterOptions().then((result) => {
      if (!active) return;
      setFilterOptions(result);
      if (result.warning) setWarning(result.warning);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    listRecursos({
      ...debouncedFilters,
      sortBy,
      sortDirection,
      page,
      pageSize,
    })
      .then((result) => {
        if (!active) return;
        setResources(result.rows);
        setTotalResources(result.total);
        setDataSource(result.source);
        setWarning(result.warning ?? null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const fallbackRows = demoData.listRecursos();
        setResources(fallbackRows);
        setTotalResources(fallbackRows.length);
        setDataSource("demo");
        setWarning(
          error instanceof Error
            ? `No se pudo cargar recursos desde Supabase: ${error.message}. Se usa data demo local.`
            : "No se pudo cargar recursos desde Supabase. Se usa data demo local.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedFilters, page, pageSize, refreshKey, sortBy, sortDirection]);

  useEffect(() => {
    const resourceCode = searchParams.get("resourceCode")?.trim();
    if (!resourceCode || loading || !resources.length || modalOpen || openedResourceCodeRef.current === resourceCode) return;
    const target = resources.find((item) => item.codigo_recurso.toLowerCase() === resourceCode.toLowerCase());
    if (target && canOpenResourceModal) {
      openedResourceCodeRef.current = resourceCode;
      openEdit(target);
    }
  }, [canOpenResourceModal, loading, modalOpen, resources, searchParams]);

  useEffect(() => {
    setLogos(readProposalLogos());
  }, []);

  useEffect(() => {
    if (activeResourceView !== "gallery" || galleryLoaded) return;
    let active = true;
    setGalleryLoading(true);
    listAllRecursos()
      .then((result) => {
        if (!active) return;
        setGalleryResources(result.rows);
        setGalleryLoaded(true);
        if (result.warning) setWarning(result.warning);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const fallbackRows = demoData.listRecursos();
        setGalleryResources(fallbackRows);
        setGalleryLoaded(true);
        setWarning(
          error instanceof Error
            ? `No se pudo cargar galería de recursos desde Supabase: ${error.message}. Se usa data demo local.`
            : "No se pudo cargar galería de recursos desde Supabase. Se usa data demo local.",
        );
      })
      .finally(() => {
        if (active) setGalleryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeResourceView, galleryLoaded]);

  function persistLogos(nextLogos: ProposalLogo[]) {
    setLogos(nextLogos);
    writeProposalLogos(nextLogos);
  }

  function addLogo(entityType: ProposalLogoEntityType) {
    persistLogos([createProposalLogoDraft(entityType), ...logos]);
  }

  function updateLogo(logoId: string, patch: Partial<ProposalLogo>) {
    const now = new Date().toISOString();
    persistLogos(logos.map((logo) => (logo.id === logoId ? { ...logo, ...patch, updated_at: now } : logo)));
  }

  function deleteLogo(logoId: string) {
    persistLogos(logos.filter((logo) => logo.id !== logoId));
  }

  function handleFilterChange(key: keyof RecursosColumnFilters, value: string) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setSortBy("codigo_recurso");
    setSortDirection("asc");
    setPage(1);
  }

  function handleSortChange(nextSortBy: RecursoSortField, nextDirection: RecursoSortDirection) {
    setSortBy(nextSortBy);
    setSortDirection(nextDirection);
    setPage(1);
  }

  async function openNew() {
    if (!canCreateResource) {
      setWarning("Crear recursos requiere Supabase y permiso can_create en el módulo Recursos.");
      return;
    }
    setWarning("Calculando siguiente código de recurso...");
    const code = await getNextResourceDraftCode();
    setEditing(emptyResourceDraft(code));
    setModalOpen(true);
    setWarning(null);
  }

  function openEdit(resource: Recurso) {
    if (!canOpenResourceModal) {
      setWarning("Editar recursos o documentos requiere permiso can_edit o can_upload_files en el módulo Recursos.");
      return;
    }
    setEditing(resource);
    setModalOpen(true);
    setWarning(null);
  }

  async function saveResource(value: Recurso) {
    if (dataSource !== "supabase") {
      setWarning("La creación y edición real de recursos está habilitada solo contra Supabase.");
      return;
    }

    const exists = editing ? resources.some((item) => item.id === editing.id) : false;
    if (exists && !canEditResource && !canManageResourceDocuments) {
      setWarning("Editar recursos o documentos requiere permiso can_edit o can_upload_files en el módulo Recursos.");
      return;
    }
    if (!exists && !canCreateResource) {
      setWarning("Crear recursos requiere permiso can_create en el módulo Recursos.");
      return;
    }

    setSavingResource(true);
    try {
      const saved = exists ? await updateRecurso(value.id, value) : await createRecurso(value);
      setWarning(exists ? `Recurso ${saved.codigo_recurso} actualizado.` : `Recurso ${saved.codigo_recurso} creado.`);
      setModalOpen(false);
      setEditing(null);
      setRefreshKey((prev) => prev + 1);
      setGalleryLoaded(false);
      void listRecursosFilterOptions().then((result) => setFilterOptions(result));
    } catch (error) {
      if (error instanceof RecursoWriteError) {
        setWarning(error.code === "duplicate_code" ? "Código de recurso duplicado." : error.message);
      } else {
        setWarning(error instanceof Error ? error.message : "No se pudo guardar el recurso.");
      }
    } finally {
      setSavingResource(false);
    }
  }

  async function handleDeactivate(resource: Recurso) {
    if (dataSource !== "supabase") {
      setWarning("Modo demo local: no se pueden desactivar recursos reales.");
      return;
    }
    if (!canEditResource) {
      setWarning("Desactivar recursos requiere permiso can_edit en el módulo Recursos.");
      return;
    }
    if (resource.estado === "Inactivo") {
      setWarning(`El recurso ${resource.codigo_recurso} ya está inactivo.`);
      return;
    }

    const confirmed = window.confirm(
      `¿Desactivar el recurso ${resource.codigo_recurso}? El registro no se borrará; solo cambiará su estado a Inactivo.`,
    );
    if (!confirmed) return;

    setSavingResource(true);
    try {
      await deactivateRecurso(resource.id);
      setWarning(`Recurso ${resource.codigo_recurso} desactivado. No se eliminó el registro.`);
      setRefreshKey((prev) => prev + 1);
      setGalleryLoaded(false);
      void listRecursosFilterOptions().then((result) => setFilterOptions(result));
    } catch (error) {
      if (error instanceof RecursoWriteError) {
        setWarning(error.message);
      } else {
        setWarning(error instanceof Error ? error.message : "No se pudo desactivar el recurso.");
      }
    } finally {
      setSavingResource(false);
    }
  }

  async function handleUploadResourceFile(resourceId: string, category: ResourceStorageFileCategory, file: File): Promise<ResourceFileMeta> {
    if (!canManageResourceDocuments) {
      throw new Error("Subir archivos requiere permiso can_upload_files o can_edit en Recursos.");
    }
    if (!isEditingExistingResource && !canCreateResource) {
      throw new Error("Crear recursos con archivos requiere permiso can_create en Recursos.");
    }
    if (!resourceId.trim()) throw new Error("Completa el código del recurso antes de subir archivos.");
    return uploadResourceFile(resourceId, category, file);
  }

  async function handleOpenResourceFile(file: ResourceFileMeta) {
    const url = await createResourceFileSignedUrl(file);
    if (!url) {
      throw new Error("El archivo no tiene una URL o ruta de Storage disponible.");
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="sgp-page app-table-section flex min-h-[calc(100vh-64px)] min-w-0 flex-col">
      {warning ? <p className="mb-2 text-xs text-amber-700">{warning}</p> : null}
      <p className="mb-2 text-xs text-muted">
        Origen de datos: {dataSource === "supabase" ? "Supabase public.recursos" : "demo local"}
      </p>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-border bg-white p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveResourceView("resources")}
            className={`h-7 rounded-md px-3 ${activeResourceView === "resources" ? "bg-teal-700 text-white" : "text-stone-600 hover:bg-stone-100"}`}
          >
            Recursos
          </button>
          <button
            type="button"
            onClick={() => setActiveResourceView("gallery")}
            className={`h-7 rounded-md px-3 ${activeResourceView === "gallery" ? "bg-teal-700 text-white" : "text-stone-600 hover:bg-stone-100"}`}
          >
            Galería
          </button>
          <button
            type="button"
            onClick={() => setActiveResourceView("logos")}
            className={`h-7 rounded-md px-3 ${activeResourceView === "logos" ? "bg-teal-700 text-white" : "text-stone-600 hover:bg-stone-100"}`}
          >
            Logos
          </button>
        </div>
        {activeResourceView === "logos" ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => addLogo("company")} className="h-7 rounded-md border border-border bg-white px-3 text-xs font-semibold text-stone-700 hover:bg-stone-100">
              + Logo empresa
            </button>
            <button type="button" onClick={() => addLogo("client")} className="h-7 rounded-md border border-teal-700 bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800">
              + Logo cliente
            </button>
          </div>
        ) : null}
      </div>

      {activeResourceView === "logos" ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[980px] border-collapse text-xs">
            <thead className="bg-stone-100 text-left text-[11px] uppercase tracking-wide text-stone-500">
              <tr>
                <th className="border-b border-border px-2 py-2">Tipo</th>
                <th className="border-b border-border px-2 py-2">Entidad</th>
                <th className="border-b border-border px-2 py-2">Nombre visible</th>
                <th className="border-b border-border px-2 py-2">Logo URL</th>
                <th className="border-b border-border px-2 py-2">Activo</th>
                <th className="border-b border-border px-2 py-2">Default</th>
                <th className="border-b border-border px-2 py-2">Notas</th>
                <th className="border-b border-border px-2 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {logos.length ? (
                logos.map((logo) => (
                  <tr key={logo.id} className="border-b border-border">
                    <td className="px-2 py-1">
                      <select value={logo.entity_type} onChange={(event) => updateLogo(logo.id, { entity_type: event.target.value as ProposalLogoEntityType })} className="h-7 w-full rounded border border-border bg-white px-2">
                        <option value="company">Empresa</option>
                        <option value="client">Cliente</option>
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input value={logo.entity_name} onChange={(event) => updateLogo(logo.id, { entity_name: event.target.value })} className="h-7 w-full rounded border border-border px-2" />
                    </td>
                    <td className="px-2 py-1">
                      <input value={logo.display_name} onChange={(event) => updateLogo(logo.id, { display_name: event.target.value })} className="h-7 w-full rounded border border-border px-2" />
                    </td>
                    <td className="px-2 py-1">
                      <input value={logo.logo_url} onChange={(event) => updateLogo(logo.id, { logo_url: event.target.value })} placeholder="https://..." className="h-7 w-full rounded border border-border px-2" />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input type="checkbox" checked={logo.is_active} onChange={(event) => updateLogo(logo.id, { is_active: event.target.checked })} />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input type="checkbox" checked={logo.is_default} onChange={(event) => updateLogo(logo.id, { is_default: event.target.checked })} />
                    </td>
                    <td className="px-2 py-1">
                      <input value={logo.notes} onChange={(event) => updateLogo(logo.id, { notes: event.target.value })} className="h-7 w-full rounded border border-border px-2" />
                    </td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => deleteLogo(logo.id)} className="h-7 rounded border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-700 hover:bg-red-100">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-muted">
                    Aun no hay logos registrados. Agrega el logo principal de EKA o logos de clientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : activeResourceView === "gallery" ? (
        <ResourceGallery rows={galleryResources} loading={galleryLoading} onEdit={openEdit} canEdit={canOpenResourceModal} />
      ) : loading || permissionsLoading ? (
        <div className="rounded-xl border border-border bg-panel p-8 text-center text-xs text-muted">
          {permissionsLoading ? "Cargando permisos..." : "Cargando recursos..."}
        </div>
      ) : !resourcesViewGroups.resources_main_table ? (
        <div className="rounded-xl border border-dashed border-border bg-panel p-8 text-center text-xs text-muted">
          Tabla principal de recursos oculta por permisos.
        </div>
      ) : (
        <div className="min-h-0 min-w-0 flex-1">
          <ResourcesTable
            rows={pagedResources}
            emptyMessage="No se encontraron recursos con los filtros aplicados."
            filters={filters}
            filterOptions={filterOptions}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
            onCreate={openNew}
            onEdit={openEdit}
            onDeactivate={handleDeactivate}
            canCreate={canCreateResource}
            canEdit={canOpenResourceModal}
            canDeactivate={canEditResource}
            modulePermissions={modulePermissions}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
          />
        </div>
      )}

      {activeResourceView === "resources" ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted">
          {loading || permissionsLoading
            ? "Consultando recursos..."
            : resourcesViewGroups.resources_main_table
              ? `Mostrando ${rangeStart} - ${rangeEnd} de ${total} recurso${total === 1 ? "" : "s"}. Página ${page} de ${totalPages}`
              : "Paginación oculta por permisos."}
        </span>
        {resourcesViewGroups.resources_main_table ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-muted">
            Filas
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                setPage(1);
              }}
              className="h-7 rounded border border-border bg-white px-1 text-xs text-stone-700"
            >
              {PAGE_SIZE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={page === 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded border border-border px-2 py-1 disabled:opacity-50"
          >
            Anterior
          </button>
          <span>
            {page}/{totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="rounded border border-border px-2 py-1 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
        ) : null}
      </div> : null}

      <ResourceFormModal
        open={modalOpen}
        initial={editing}
        usedCodes={resources.map((item) => item.codigo_recurso)}
        catalogs={{
          tipos: catalogs.tipoRecurso,
          unidades: catalogs.unidades,
          marcas: catalogs.marcas,
          proveedores: catalogs.proveedores,
          monedas: catalogs.monedas,
          estados: catalogs.estadosRecurso,
        }}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={saveResource}
        detailsReadOnly={isEditingExistingResource && !canEditResource}
        filesReadOnly={!canManageResourceDocuments}
        allowFilePicker={dataSource === "supabase" && canManageResourceDocuments && (isEditingExistingResource || canCreateResource)}
        isSaving={savingResource}
        onUploadFile={handleUploadResourceFile}
        onOpenFile={handleOpenResourceFile}
        onResolveFileUrl={createResourceFileSignedUrl}
      />
    </section>
  );
}
