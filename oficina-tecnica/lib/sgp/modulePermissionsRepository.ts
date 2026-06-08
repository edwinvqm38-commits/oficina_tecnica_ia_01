import { supabase } from "@/lib/sgp/supabaseClient";

export type ModulePermissions = {
  id: string;
  user_email: string;
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_change_status: boolean;
  can_upload_files: boolean;
  can_view_prices: boolean;
  can_view_supplier: boolean;
  visible_columns: string[];
  editable_fields: string[];
  required_fields: string[];
  enabled_buttons: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ModulePermissionsUpsertPayload = {
  userEmail: string;
  moduleKey: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_change_status: boolean;
  can_upload_files: boolean;
  can_view_prices: boolean;
  can_view_supplier: boolean;
  visible_columns: string[];
  editable_fields?: string[];
  required_fields?: string[];
  enabled_buttons?: string[];
  metadata?: Record<string, unknown>;
};

type ModulePermissionsRow = Omit<
  ModulePermissions,
  "visible_columns" | "editable_fields" | "required_fields" | "enabled_buttons" | "metadata"
> & {
  visible_columns: unknown;
  editable_fields: unknown;
  required_fields: unknown;
  enabled_buttons: unknown;
  metadata: unknown;
};

const MODULE_PERMISSIONS_SELECT = [
  "id",
  "user_email",
  "module_key",
  "can_view",
  "can_create",
  "can_edit",
  "can_change_status",
  "can_upload_files",
  "can_view_prices",
  "can_view_supplier",
  "visible_columns",
  "editable_fields",
  "required_fields",
  "enabled_buttons",
  "metadata",
  "created_at",
  "updated_at",
].join(",");

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const toMetadata = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const mapModulePermissions = (row: ModulePermissionsRow): ModulePermissions => ({
  ...row,
  visible_columns: toStringArray(row.visible_columns),
  editable_fields: toStringArray(row.editable_fields),
  required_fields: toStringArray(row.required_fields),
  enabled_buttons: toStringArray(row.enabled_buttons),
  metadata: toMetadata(row.metadata),
});

export async function getModulePermissions(
  moduleKey: string,
  userEmail: string,
): Promise<ModulePermissions | null> {
  const normalizedModuleKey = moduleKey.trim();
  const normalizedEmail = userEmail.trim();

  if (!normalizedModuleKey || !normalizedEmail) {
    return null;
  }

  const { data, error } = await supabase
    .from("admin_module_permissions")
    .select(MODULE_PERMISSIONS_SELECT)
    .ilike("module_key", normalizedModuleKey)
    .ilike("user_email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.warn("No se pudieron leer los permisos del modulo.", error.message);
    return null;
  }

  return data ? mapModulePermissions(data as unknown as ModulePermissionsRow) : null;
}

export async function upsertModulePermissions(payload: ModulePermissionsUpsertPayload): Promise<ModulePermissions | null> {
  const normalizedModuleKey = payload.moduleKey.trim();
  const normalizedEmail = payload.userEmail.trim().toLowerCase();

  if (!normalizedModuleKey || !normalizedEmail) {
    return null;
  }

  const upsertPayload = {
    user_email: normalizedEmail,
    module_key: normalizedModuleKey,
    can_view: payload.can_view,
    can_create: payload.can_create,
    can_edit: payload.can_edit,
    can_change_status: payload.can_change_status,
    can_upload_files: payload.can_upload_files,
    can_view_prices: payload.can_view_prices,
    can_view_supplier: payload.can_view_supplier,
    visible_columns: payload.visible_columns,
    editable_fields: payload.editable_fields ?? [],
    required_fields: payload.required_fields ?? [],
    enabled_buttons: payload.enabled_buttons ?? [],
    metadata: payload.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("admin_module_permissions")
    .upsert(upsertPayload, { onConflict: "user_email,module_key" })
    .select(MODULE_PERMISSIONS_SELECT)
    .maybeSingle();

  if (error) {
    console.warn("No se pudieron guardar los permisos del modulo.", error.message);
    return null;
  }

  return data ? mapModulePermissions(data as unknown as ModulePermissionsRow) : null;
}

export async function listModulePermissionEmails(): Promise<string[]> {
  const { data, error } = await supabase.from("admin_module_permissions").select("user_email").order("user_email");
  if (error) {
    console.warn("No se pudieron listar correos desde admin_module_permissions.", error.message);
    return [];
  }

  const emails = (data ?? [])
    .map((row) => row.user_email)
    .filter((email): email is string => typeof email === "string" && email.trim().length > 0)
    .map((email) => email.trim().toLowerCase());

  return Array.from(new Set(emails));
}
