// Centralized read/write access to `user_profiles` for admin screens
// (UserApprovalPage, AdministradorContent). Replaces ad hoc `select("*")`
// calls made directly from components — see PLAN EGRESO CERO Fase 1A.

import { supabase } from "@/lib/supabaseClient";

export type UserProfileRole = "admin" | "gerencia" | "responsable" | "consulta";
export type UserProfileStatus = "approved" | "pending" | "rejected" | "disabled" | "blocked";

export type UserProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserProfileRole | null;
  status: UserProfileStatus | null;
  is_super_admin: boolean | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

const USER_PROFILES_SELECT = [
  "id",
  "email",
  "full_name",
  "role",
  "status",
  "is_super_admin",
  "approved_by",
  "approved_at",
  "rejected_reason",
  "metadata",
  "created_at",
  "updated_at",
].join(",");

// Admin user lists are small in practice (single-digit to low hundreds of
// accounts); this caps worst-case payload size instead of always pulling
// every row.
const DEFAULT_LIMIT = 200;

export async function fetchUserProfiles(options?: { limit?: number }): Promise<UserProfileRow[]> {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const { data, error } = await supabase
    .from("user_profiles")
    .select(USER_PROFILES_SELECT)
    .order("created_at", { ascending: false })
    .range(0, limit - 1);

  if (error) throw error;
  return (data ?? []) as unknown as UserProfileRow[];
}

export async function updateUserProfile(id: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("user_profiles").update(payload).eq("id", id);
  if (error) throw error;
}
