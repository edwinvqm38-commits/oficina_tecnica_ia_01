import type { ModulePermissions } from "@/lib/sgp/modulePermissionsRepository";

function readNestedBoolean(
  metadata: Record<string, unknown> | undefined,
  rootKey: string,
  moduleKey: string,
  permissionKey: string,
): boolean | null {
  const root = metadata?.[rootKey];
  if (!root || typeof root !== "object" || Array.isArray(root)) return null;
  const moduleData = (root as Record<string, unknown>)[moduleKey];
  if (!moduleData || typeof moduleData !== "object" || Array.isArray(moduleData)) return null;
  const value = (moduleData as Record<string, unknown>)[permissionKey];
  return typeof value === "boolean" ? value : null;
}

export function resolveSensitivePermission(
  permissions: ModulePermissions | null | undefined,
  moduleKey: string,
  permissionKey: string,
  fallback: boolean,
): boolean {
  return readNestedBoolean(permissions?.metadata, "module_sensitive_permissions", moduleKey, permissionKey) ?? fallback;
}

export function resolveViewGroupPermission(
  permissions: ModulePermissions | null | undefined,
  moduleKey: string,
  groupKey: string,
  fallback: boolean,
): boolean {
  return readNestedBoolean(permissions?.metadata, "module_view_groups", moduleKey, groupKey) ?? fallback;
}
