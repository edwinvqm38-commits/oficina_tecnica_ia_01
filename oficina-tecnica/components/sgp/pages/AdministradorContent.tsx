"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, type AppRole, type AppStatus } from "@/components/sgp/auth/AuthContext";
import {
  getModulePermissions,
  listModulePermissionEmails,
  upsertModulePermissions,
  type ModulePermissions,
} from "@/lib/sgp/modulePermissionsRepository";
import {
  MODULE_PERMISSION_CATALOG_BY_KEY,
  MODULE_PERMISSION_OPTIONS,
  type PermissionModuleKey,
  type StandardPermissionKey,
} from "@/lib/sgp/modulePermissionsCatalog";
import { supabase } from "@/lib/sgp/supabaseClient";

type AdminFilter = "all" | "pending" | "approved" | "rejected" | "inactive";
type AdminSection = "users" | "permissions";
type PermissionFormState = {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_change_status: boolean;
  can_upload_files: boolean;
  visible_columns: string[];
  sensitiveFlags: Record<string, boolean>;
  viewGroups: Record<string, boolean>;
};

type AdminUserProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: AppRole | null;
  status?: AppStatus | null;
  is_super_admin?: boolean | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_reason?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const ROLE_OPTIONS: AppRole[] = ["admin", "gerencia", "responsable", "consulta"];
const FILTERS: Array<{ label: string; value: AdminFilter }> = [
  { label: "Todos", value: "all" },
  { label: "Pendientes", value: "pending" },
  { label: "Aprobados", value: "approved" },
  { label: "Rechazados", value: "rejected" },
  { label: "Bloqueados/Inactivos", value: "inactive" },
];
const SECTIONS: Array<{ label: string; value: AdminSection }> = [
  { label: "Usuarios", value: "users" },
  { label: "Permisos", value: "permissions" },
];
const MODULE_PREPARING_MESSAGE = "Módulo preparado para fase posterior.";

const STANDARD_PERMISSION_LABELS: Record<StandardPermissionKey, string> = {
  can_view: "Puede ver módulo",
  can_create: "Puede crear",
  can_edit: "Puede editar",
  can_change_status: "Puede cambiar estado",
  can_upload_files: "Puede subir archivos",
};

function buttonClassName(disabled = false): string {
  return [
    "inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-semibold transition",
    disabled
      ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
      : "border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:text-stone-900",
  ].join(" ");
}

function filterButtonClassName(active: boolean): string {
  return [
    "inline-flex h-8 items-center rounded-md border px-3 text-xs font-semibold transition",
    active
      ? "border-stone-400 bg-stone-100 text-stone-900"
      : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900",
  ].join(" ");
}

function statusBadgeClassName(status?: string | null): string {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  if (status === "disabled" || status === "blocked") return "border-stone-300 bg-stone-100 text-stone-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString("es-PE") : "-";
}

function getProvider(profile: AdminUserProfile): string {
  const provider = profile.metadata?.provider;
  return typeof provider === "string" && provider.trim() ? provider : "-";
}

function getLastAccess(profile: AdminUserProfile): string {
  const lastAccess = profile.metadata?.last_sign_in_at ?? profile.metadata?.last_access;
  return typeof lastAccess === "string" && lastAccess.trim() ? formatDate(lastAccess) : "-";
}

function parseModuleSensitivePermissions(
  metadata: Record<string, unknown>,
  moduleKey: PermissionModuleKey,
): Record<string, boolean> {
  const root = metadata.module_sensitive_permissions;
  if (!root || typeof root !== "object" || Array.isArray(root)) return {};
  const moduleData = (root as Record<string, unknown>)[moduleKey];
  if (!moduleData || typeof moduleData !== "object" || Array.isArray(moduleData)) return {};

  return Object.entries(moduleData as Record<string, unknown>).reduce(
    (acc, [key, value]) => {
      acc[key] = Boolean(value);
      return acc;
    },
    {} as Record<string, boolean>,
  );
}

function parseModuleViewGroups(metadata: Record<string, unknown>, moduleKey: PermissionModuleKey): Record<string, boolean> {
  const root = metadata.module_view_groups;
  if (!root || typeof root !== "object" || Array.isArray(root)) return {};
  const moduleData = (root as Record<string, unknown>)[moduleKey];
  if (!moduleData || typeof moduleData !== "object" || Array.isArray(moduleData)) return {};

  return Object.entries(moduleData as Record<string, unknown>).reduce(
    (acc, [key, value]) => {
      acc[key] = value !== false;
      return acc;
    },
    {} as Record<string, boolean>,
  );
}

function buildDefaultPermissionForm(moduleKey: PermissionModuleKey): PermissionFormState {
  const moduleCatalog = MODULE_PERMISSION_CATALOG_BY_KEY[moduleKey];
  const sensitiveFlags = moduleCatalog.sensitivePermissions.reduce(
    (acc, item) => {
      acc[item.key] = false;
      return acc;
    },
    {} as Record<string, boolean>,
  );
  const viewGroups = (moduleCatalog.viewGroups ?? []).reduce(
    (acc, item) => {
      acc[item.key] = true;
      return acc;
    },
    {} as Record<string, boolean>,
  );

  return {
    can_view: true,
    can_create: false,
    can_edit: false,
    can_change_status: false,
    can_upload_files: false,
    visible_columns: moduleCatalog.columns.map((column) => column.key),
    sensitiveFlags,
    viewGroups,
  };
}

function mapPermissionToForm(permissions: ModulePermissions, moduleKey: PermissionModuleKey): PermissionFormState {
  const defaults = buildDefaultPermissionForm(moduleKey);
  const moduleCatalog = MODULE_PERMISSION_CATALOG_BY_KEY[moduleKey];
  const metadataSensitive = parseModuleSensitivePermissions(permissions.metadata ?? {}, moduleKey);
  const metadataViewGroups = parseModuleViewGroups(permissions.metadata ?? {}, moduleKey);
  const sensitiveFlags = { ...defaults.sensitiveFlags, ...metadataSensitive };
  const viewGroups = { ...defaults.viewGroups, ...metadataViewGroups };

  moduleCatalog.sensitivePermissions.forEach((permission) => {
    if (permission.persistedColumn === "can_view_prices") {
      sensitiveFlags[permission.key] = permissions.can_view_prices ?? false;
    } else if (permission.persistedColumn === "can_view_supplier") {
      sensitiveFlags[permission.key] = permissions.can_view_supplier ?? false;
    }
  });

  return {
    can_view: permissions.can_view ?? defaults.can_view,
    can_create: permissions.can_create ?? defaults.can_create,
    can_edit: permissions.can_edit ?? defaults.can_edit,
    can_change_status: permissions.can_change_status ?? defaults.can_change_status,
    can_upload_files: permissions.can_upload_files ?? defaults.can_upload_files,
    visible_columns:
      permissions.visible_columns.length > 0 ? permissions.visible_columns : defaults.visible_columns,
    sensitiveFlags,
    viewGroups,
  };
}

function shouldShowForFilter(profile: AdminUserProfile, filter: AdminFilter): boolean {
  if (filter === "all") return true;
  if (filter === "inactive") return profile.status === "disabled" || profile.status === "blocked";
  return profile.status === filter;
}

export default function AdministradorContent() {
  const { isAdmin, user, profile } = useAuth();
  const [profiles, setProfiles] = useState<AdminUserProfile[]>([]);
  const [selectedRole, setSelectedRole] = useState<Record<string, AppRole>>({});
  const [filter, setFilter] = useState<AdminFilter>("all");
  const [section, setSection] = useState<AdminSection>("users");
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  const [permissionError, setPermissionError] = useState("");
  const [permissionUsersFallback, setPermissionUsersFallback] = useState<string[]>([]);
  const [selectedPermissionUser, setSelectedPermissionUser] = useState("");
  const [selectedPermissionModule, setSelectedPermissionModule] = useState<PermissionModuleKey>("recursos");
  const [permissionForm, setPermissionForm] = useState<PermissionFormState>(buildDefaultPermissionForm("recursos"));
  const [loadedPermissions, setLoadedPermissions] = useState<ModulePermissions | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");

    const { data, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id,email,full_name,role,status,is_super_admin,approved_by,approved_at,rejected_reason,metadata,created_at,updated_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (profilesError) {
      setError("No se pudieron cargar usuarios. Revisa las politicas RLS de user_profiles para administradores.");
      return;
    }

    const rows = (data ?? []) as AdminUserProfile[];
    setProfiles(rows);
    setSelectedRole((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (!next[row.id]) next[row.id] = row.role ?? "consulta";
      }
      return next;
    });
  }, [isAdmin]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const canManagePermissions = useMemo(() => {
    const normalizedEmail = (profile?.email ?? user.email ?? "").trim().toLowerCase();
    return profile?.is_super_admin === true || profile?.role === "admin" || normalizedEmail === "edwin.qm@outlook.com";
  }, [profile?.email, profile?.is_super_admin, profile?.role, user.email]);

  useEffect(() => {
    if (!isAdmin) return;
    listModulePermissionEmails().then((emails) => {
      setPermissionUsersFallback(emails);
    });
  }, [isAdmin]);

  const modulePermissionGroups = useMemo(() => {
    const groups = new Map<string, typeof MODULE_PERMISSION_OPTIONS>();
    for (const option of MODULE_PERMISSION_OPTIONS) {
      const list = groups.get(option.group) ?? [];
      list.push(option);
      groups.set(option.group, list);
    }
    return Array.from(groups.entries());
  }, []);

  const permissionUserOptions = useMemo(() => {
    const fromProfiles = profiles
      .map((item) => item.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email));
    const allEmails = Array.from(new Set([...fromProfiles, ...permissionUsersFallback]));
    return allEmails;
  }, [profiles, permissionUsersFallback]);

  useEffect(() => {
    if (selectedPermissionUser) return;
    if (!permissionUserOptions.length) return;
    setSelectedPermissionUser(permissionUserOptions[0]);
  }, [permissionUserOptions, selectedPermissionUser]);

  useEffect(() => {
    if (!isAdmin || !selectedPermissionUser) return;

    let active = true;
    setPermissionLoading(true);
    setPermissionMessage("");
    setPermissionError("");

    getModulePermissions(selectedPermissionModule, selectedPermissionUser)
      .then((permissions) => {
        if (!active) return;
        setLoadedPermissions(permissions);
        if (permissions) {
          setPermissionForm(mapPermissionToForm(permissions, selectedPermissionModule));
          setPermissionMessage("");
        } else {
          setPermissionForm(buildDefaultPermissionForm(selectedPermissionModule));
          setPermissionMessage("No existe configuracion previa. Se muestra plantilla inicial segura.");
        }
      })
      .catch(() => {
        if (!active) return;
        setLoadedPermissions(null);
        setPermissionForm(buildDefaultPermissionForm(selectedPermissionModule));
        setPermissionError("No se pudieron cargar permisos del modulo para este usuario.");
      })
      .finally(() => {
        if (active) setPermissionLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAdmin, selectedPermissionModule, selectedPermissionUser]);

  const toggleVisibleColumn = useCallback((columnKey: string) => {
    setPermissionForm((current) => {
      const exists = current.visible_columns.includes(columnKey);
      return {
        ...current,
        visible_columns: exists
          ? current.visible_columns.filter((item) => item !== columnKey)
          : [...current.visible_columns, columnKey],
      };
    });
  }, []);

  const toggleViewGroup = useCallback((groupKey: string) => {
    setPermissionForm((current) => ({
      ...current,
      viewGroups: {
        ...current.viewGroups,
        [groupKey]: !current.viewGroups[groupKey],
      },
    }));
  }, []);

  const resetPermissionConfig = useCallback(() => {
    setPermissionError("");
    setPermissionMessage("");
    setPermissionForm(
      loadedPermissions
        ? mapPermissionToForm(loadedPermissions, selectedPermissionModule)
        : buildDefaultPermissionForm(selectedPermissionModule),
    );
  }, [loadedPermissions, selectedPermissionModule]);

  const savePermissionConfig = useCallback(async () => {
    if (!selectedPermissionUser) {
      setPermissionError("Selecciona un usuario para guardar permisos.");
      return;
    }
    if (!canManagePermissions) {
      setPermissionError("No tienes permisos para administrar accesos.");
      return;
    }

    const mergedModuleSensitivePermissions = {
      ...(loadedPermissions?.metadata?.module_sensitive_permissions &&
      typeof loadedPermissions.metadata.module_sensitive_permissions === "object" &&
      !Array.isArray(loadedPermissions.metadata.module_sensitive_permissions)
        ? (loadedPermissions.metadata.module_sensitive_permissions as Record<string, unknown>)
        : {}),
      [selectedPermissionModule]: permissionForm.sensitiveFlags,
    };

    const mergedModuleViewGroups = {
      ...(loadedPermissions?.metadata?.module_view_groups &&
      typeof loadedPermissions.metadata.module_view_groups === "object" &&
      !Array.isArray(loadedPermissions.metadata.module_view_groups)
        ? (loadedPermissions.metadata.module_view_groups as Record<string, unknown>)
        : {}),
      [selectedPermissionModule]: permissionForm.viewGroups,
    };

    setPermissionSaving(true);
    setPermissionError("");
    setPermissionMessage("");

    const saved = await upsertModulePermissions({
      userEmail: selectedPermissionUser,
      moduleKey: selectedPermissionModule,
      can_view: permissionForm.can_view,
      can_create: permissionForm.can_create,
      can_edit: permissionForm.can_edit,
      can_change_status: permissionForm.can_change_status,
      can_upload_files: permissionForm.can_upload_files,
      can_view_prices: Boolean(permissionForm.sensitiveFlags.can_view_prices),
      can_view_supplier: Boolean(permissionForm.sensitiveFlags.can_view_supplier),
      visible_columns: permissionForm.visible_columns,
      editable_fields: loadedPermissions?.editable_fields ?? [],
      required_fields: loadedPermissions?.required_fields ?? [],
      enabled_buttons: loadedPermissions?.enabled_buttons ?? [],
      metadata: {
        ...(loadedPermissions?.metadata ?? {}),
        module_sensitive_permissions: mergedModuleSensitivePermissions,
        module_view_groups: mergedModuleViewGroups,
        updated_from_admin_ui: true,
        updated_by_email: (profile?.email ?? user.email ?? "").trim().toLowerCase(),
        updated_at: new Date().toISOString(),
      },
    });

    if (!saved) {
      setPermissionSaving(false);
      setPermissionError("No se pudieron guardar permisos. Revisa politicas RLS para INSERT/UPDATE.");
      return;
    }

    setLoadedPermissions(saved);
    setPermissionForm(mapPermissionToForm(saved, selectedPermissionModule));
    setPermissionSaving(false);
    setPermissionMessage("Permisos guardados correctamente.");
  }, [
    canManagePermissions,
    loadedPermissions?.editable_fields,
    loadedPermissions?.enabled_buttons,
    loadedPermissions?.metadata,
    loadedPermissions?.required_fields,
    permissionForm.can_change_status,
    permissionForm.can_create,
    permissionForm.can_edit,
    permissionForm.can_upload_files,
    permissionForm.can_view,
    permissionForm.sensitiveFlags,
    permissionForm.visible_columns,
    permissionForm.viewGroups,
    profile?.email,
    selectedPermissionModule,
    selectedPermissionUser,
    user.email,
  ]);

  const updateAccessRequestsByProfile = useCallback(async (profileItem: AdminUserProfile, payload: Record<string, unknown>) => {
    if (profileItem.id) {
      await supabase.from("user_access_requests").update(payload).eq("user_id", profileItem.id);
    }

    if (profileItem.email) {
      await supabase.from("user_access_requests").update(payload).eq("email", profileItem.email);
    }
  }, []);

  const updateProfileStatus = useCallback(
    async (profileItem: AdminUserProfile, payload: Record<string, unknown>, successMessage: string) => {
      setActionLoadingId(profileItem.id);
      setError("");
      setMessage("");

      const { error: updateError } = await supabase.from("user_profiles").update(payload).eq("id", profileItem.id);

      if (updateError) {
        setActionLoadingId(null);
        setError(`No se pudo actualizar ${profileItem.email ?? "usuario"}. Revisa RLS o permisos de administrador.`);
        return;
      }

      await loadProfiles();
      setActionLoadingId(null);
      setMessage(successMessage);
    },
    [loadProfiles],
  );

  const approveProfile = useCallback(
    async (profileItem: AdminUserProfile) => {
      const now = new Date().toISOString();
      const roleToApply = selectedRole[profileItem.id] ?? profileItem.role ?? "consulta";
      await updateProfileStatus(
        profileItem,
        {
          status: "approved",
          role: roleToApply,
          approved_by: user.id,
          approved_at: profileItem.approved_at ?? now,
          updated_at: now,
        },
        `Usuario ${profileItem.email ?? ""} aprobado como ${roleToApply}.`,
      );
      await updateAccessRequestsByProfile(profileItem, {
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: now,
        updated_at: now,
      });
    },
    [selectedRole, updateAccessRequestsByProfile, updateProfileStatus, user.id],
  );

  const rejectProfile = useCallback(
    async (profileItem: AdminUserProfile) => {
      const now = new Date().toISOString();
      const rejectedReason = "Rechazado por administrador";
      await updateProfileStatus(
        profileItem,
        {
          status: "rejected",
          rejected_reason: rejectedReason,
          updated_at: now,
        },
        `Usuario ${profileItem.email ?? ""} rechazado.`,
      );
      await updateAccessRequestsByProfile(profileItem, {
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: now,
        rejected_reason: rejectedReason,
        updated_at: now,
      });
    },
    [updateAccessRequestsByProfile, updateProfileStatus, user.id],
  );

  const suspendProfile = useCallback(
    async (profileItem: AdminUserProfile) => {
      const now = new Date().toISOString();
      await updateProfileStatus(
        profileItem,
        {
          status: "disabled",
          rejected_reason: "Suspendido por administrador",
          updated_at: now,
        },
        `Usuario ${profileItem.email ?? ""} suspendido.`,
      );
    },
    [updateProfileStatus],
  );

  const changeRole = useCallback(
    async (profileItem: AdminUserProfile) => {
      const roleToApply = selectedRole[profileItem.id] ?? profileItem.role ?? "consulta";
      const now = new Date().toISOString();
      await updateProfileStatus(
        profileItem,
        {
          role: roleToApply,
          updated_at: now,
        },
        `Rol de ${profileItem.email ?? "usuario"} actualizado a ${roleToApply}.`,
      );
    },
    [selectedRole, updateProfileStatus],
  );

  const visibleProfiles = useMemo(() => profiles.filter((profileItem) => shouldShowForFilter(profileItem, filter)), [filter, profiles]);

  const content = useMemo(() => {
    if (!isAdmin) {
      return (
        <div className="rounded-xl border border-border bg-panel p-6 text-sm text-muted">
          Solo los usuarios con rol administrador pueden gestionar usuarios.
        </div>
      );
    }

    if (section === "users") {
      return (
        <div className="rounded-xl border border-border bg-panel p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-stone-700">Usuarios registrados</p>
              <p className="text-xs text-stone-500">Fuente principal: user_profiles.</p>
            </div>
            <button onClick={() => void loadProfiles()} className={buttonClassName(loading)} disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={filterButtonClassName(filter === item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error ? <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
          {message ? (
            <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-600">
                  <th className="px-2 py-2 font-semibold">Nombre completo</th>
                  <th className="px-2 py-2 font-semibold">Email</th>
                  <th className="px-2 py-2 font-semibold">Provider</th>
                  <th className="px-2 py-2 font-semibold">Rol actual</th>
                  <th className="px-2 py-2 font-semibold">Estado actual</th>
                  <th className="px-2 py-2 font-semibold">Fecha creacion</th>
                  <th className="px-2 py-2 font-semibold">Fecha aprobacion</th>
                  <th className="px-2 py-2 font-semibold">Ultimo acceso</th>
                  <th className="px-2 py-2 font-semibold">Rol</th>
                  <th className="px-2 py-2 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-2 py-4 text-center text-stone-500">
                      No hay usuarios para este filtro.
                    </td>
                  </tr>
                ) : (
                  visibleProfiles.map((profileItem) => (
                    <tr key={profileItem.id} className="border-b border-stone-100 text-stone-700">
                      <td className="px-2 py-2">{profileItem.full_name ?? "-"}</td>
                      <td className="px-2 py-2">{profileItem.email ?? "-"}</td>
                      <td className="px-2 py-2">{getProvider(profileItem)}</td>
                      <td className="px-2 py-2">{profileItem.role ?? "consulta"}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClassName(
                            profileItem.status,
                          )}`}
                        >
                          {profileItem.status ?? "pending"}
                        </span>
                      </td>
                      <td className="px-2 py-2">{formatDate(profileItem.created_at)}</td>
                      <td className="px-2 py-2">{formatDate(profileItem.approved_at)}</td>
                      <td className="px-2 py-2">{getLastAccess(profileItem)}</td>
                      <td className="px-2 py-2">
                        <select
                          value={selectedRole[profileItem.id] ?? profileItem.role ?? "consulta"}
                          onChange={(event) =>
                            setSelectedRole((current) => ({
                              ...current,
                              [profileItem.id]: event.target.value as AppRole,
                            }))
                          }
                          className="h-8 rounded-md border border-stone-300 bg-white px-2 text-xs outline-none"
                        >
                          {ROLE_OPTIONS.map((roleOption) => (
                            <option key={roleOption} value={roleOption}>
                              {roleOption}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => void approveProfile(profileItem)}
                            className={buttonClassName(actionLoadingId === profileItem.id)}
                            disabled={actionLoadingId === profileItem.id}
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => void changeRole(profileItem)}
                            className={buttonClassName(actionLoadingId === profileItem.id)}
                            disabled={actionLoadingId === profileItem.id}
                          >
                            Cambiar rol
                          </button>
                          <button
                            onClick={() => void rejectProfile(profileItem)}
                            className={buttonClassName(actionLoadingId === profileItem.id)}
                            disabled={actionLoadingId === profileItem.id}
                          >
                            Rechazar
                          </button>
                          <button
                            onClick={() => void suspendProfile(profileItem)}
                            className={buttonClassName(actionLoadingId === profileItem.id)}
                            disabled={actionLoadingId === profileItem.id}
                          >
                            Suspender
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    const selectedModuleMeta = MODULE_PERMISSION_OPTIONS.find((item) => item.key === selectedPermissionModule);
    const selectedModuleCatalog = MODULE_PERMISSION_CATALOG_BY_KEY[selectedPermissionModule];
    const moduleNotReady = !selectedModuleMeta?.enabled;
    const selectedColumnsCount = permissionForm.visible_columns.length;
    const totalColumnsCount = selectedModuleCatalog.columns.length;
    const hasColumnsConfig = totalColumnsCount > 0;
    const hasSensitivePermissionsConfig = selectedModuleCatalog.sensitivePermissions.length > 0;
    const viewGroups = selectedModuleCatalog.viewGroups ?? [];
    const selectedViewGroupsCount = viewGroups.filter((item) => permissionForm.viewGroups[item.key] !== false).length;
    const baselinePermissionForm = loadedPermissions
      ? mapPermissionToForm(loadedPermissions, selectedPermissionModule)
      : buildDefaultPermissionForm(selectedPermissionModule);
    const hasPermissionChanges = JSON.stringify(permissionForm) !== JSON.stringify(baselinePermissionForm);

    return (
      <div className="rounded-xl border border-border bg-panel">
        <div className="border-b border-border p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-stone-700">Permisos</p>
            <p className="text-xs text-stone-500">{selectedModuleCatalog.description}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!canManagePermissions ? (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                No tienes permisos para administrar accesos
              </span>
            ) : null}
            <button
              type="button"
              onClick={resetPermissionConfig}
              className={buttonClassName(permissionSaving || permissionLoading || !hasPermissionChanges)}
              disabled={permissionSaving || permissionLoading || !hasPermissionChanges}
            >
              Cancelar cambios
            </button>
            <button
              onClick={() => void savePermissionConfig()}
              className={buttonClassName(permissionSaving || permissionLoading || !canManagePermissions)}
              disabled={permissionSaving || permissionLoading || !canManagePermissions}
            >
              {permissionSaving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-stone-600">
            Usuario
            <select
              value={selectedPermissionUser}
              onChange={(event) => setSelectedPermissionUser(event.target.value)}
              className="h-9 rounded-md border border-stone-300 bg-white px-2 text-xs outline-none"
            >
              {permissionUserOptions.length === 0 ? <option value="">Sin usuarios disponibles</option> : null}
              {permissionUserOptions.map((emailOption) => (
                <option key={emailOption} value={emailOption}>
                  {emailOption}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-stone-600">
            Modulo
            <select
              value={selectedPermissionModule}
              onChange={(event) => setSelectedPermissionModule(event.target.value as PermissionModuleKey)}
              className="h-9 rounded-md border border-stone-300 bg-white px-2 text-xs outline-none"
            >
              {modulePermissionGroups.map(([groupLabel, options]) => (
                <optgroup key={groupLabel} label={groupLabel}>
                  {options.map((moduleOption) => (
                    <option key={moduleOption.key} value={moduleOption.key}>
                      {moduleOption.label}
                      {moduleOption.enabled ? "" : " (Proximamente)"}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[11px] text-stone-500">
            {hasPermissionChanges ? "Hay cambios pendientes por guardar." : "Sin cambios pendientes."}
          </p>
        </div>

        {permissionError ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{permissionError}</p>
        ) : null}
        {permissionMessage ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{permissionMessage}</p>
        ) : null}
        {moduleNotReady ? (
          <p className="mt-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
            {MODULE_PREPARING_MESSAGE}
          </p>
        ) : null}
        </div>

        {!moduleNotReady ? (
          <div className="grid gap-3 p-3">
            <p className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] text-sky-700">
              Primero controla secciones completas. Luego ajusta columnas específicas si necesitas más detalle.
            </p>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-semibold text-stone-700">Permisos basicos</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {selectedModuleCatalog.standardPermissions.map((permissionKey) => (
                  <label
                    key={permissionKey}
                    className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-3 py-2 text-xs"
                  >
                    <span className="text-stone-700">{STANDARD_PERMISSION_LABELS[permissionKey]}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(permissionForm[permissionKey])}
                      onChange={(event) =>
                        setPermissionForm((current) => ({
                          ...current,
                          [permissionKey]: event.target.checked,
                        }))
                      }
                      disabled={permissionLoading || permissionSaving || !canManagePermissions}
                    />
                  </label>
                ))}
              </div>
            </div>

            {hasSensitivePermissionsConfig ? (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="text-xs font-semibold text-stone-700">Permisos sensibles</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {selectedModuleCatalog.sensitivePermissions.map((permission) => (
                    <label
                      key={permission.key}
                      className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-3 py-2 text-xs"
                    >
                      <span className="text-stone-700">{permission.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(permissionForm.sensitiveFlags[permission.key])}
                        onChange={(event) =>
                          setPermissionForm((current) => ({
                            ...current,
                            sensitiveFlags: {
                              ...current.sensitiveFlags,
                              [permission.key]: event.target.checked,
                            },
                          }))
                        }
                        disabled={permissionLoading || permissionSaving || !canManagePermissions}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {viewGroups.length > 0 ? (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-stone-700">Grupos de vista</p>
                    <p className="text-[11px] text-stone-500">Activa u oculta secciones completas de la vista.</p>
                  </div>
                  <span className="text-[11px] text-stone-500">
                    Secciones visibles: {selectedViewGroupsCount} de {viewGroups.length}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {viewGroups.map((groupOption) => (
                    <label
                      key={groupOption.key}
                      className="flex items-start justify-between gap-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs"
                    >
                      <span>
                        <span className="block font-medium text-stone-700">{groupOption.label}</span>
                        {groupOption.description ? (
                          <span className="mt-0.5 block text-[11px] leading-snug text-stone-500">{groupOption.description}</span>
                        ) : null}
                      </span>
                      <input
                        type="checkbox"
                        checked={permissionForm.viewGroups[groupOption.key] !== false}
                        onChange={() => toggleViewGroup(groupOption.key)}
                        disabled={permissionLoading || permissionSaving || !canManagePermissions}
                        className="mt-0.5"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {hasColumnsConfig ? (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-stone-700">Columnas visibles ({selectedModuleMeta?.label})</p>
                  <span className="text-[11px] text-stone-500">
                    Columnas visibles seleccionadas: {selectedColumnsCount} de {totalColumnsCount}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {selectedModuleCatalog.columns.map((columnOption) => (
                    <label key={columnOption.key} className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs">
                      <input
                        type="checkbox"
                        checked={permissionForm.visible_columns.includes(columnOption.key)}
                        onChange={() => toggleVisibleColumn(columnOption.key)}
                        disabled={permissionLoading || permissionSaving || !canManagePermissions}
                      />
                      <span className="text-stone-700">{columnOption.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

          </div>
        ) : null}
      </div>
    );
  }, [
    actionLoadingId,
    approveProfile,
    canManagePermissions,
    changeRole,
    error,
    filter,
    isAdmin,
    loadProfiles,
    loadedPermissions,
    loading,
    message,
    permissionError,
    permissionForm,
    permissionLoading,
    permissionMessage,
    permissionSaving,
    permissionUserOptions,
    rejectProfile,
    resetPermissionConfig,
    savePermissionConfig,
    section,
    selectedPermissionModule,
    selectedPermissionUser,
    selectedRole,
    suspendProfile,
    toggleVisibleColumn,
    toggleViewGroup,
    visibleProfiles,
  ]);

  return (
    <section className="sgp-page">
      <div className="mb-3 flex flex-wrap gap-2">
        {SECTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setSection(item.value)}
            className={filterButtonClassName(section === item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {content}
    </section>
  );
}
