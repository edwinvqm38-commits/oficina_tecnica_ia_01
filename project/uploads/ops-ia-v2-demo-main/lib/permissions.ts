export type AppRole = "viewer" | "editor" | "admin";

export const permissions = {
  canEditRecords(role: AppRole): boolean {
    return role === "editor" || role === "admin";
  },
  canManageAdmin(role: AppRole): boolean {
    return role === "admin";
  },
};
