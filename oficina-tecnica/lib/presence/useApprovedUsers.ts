"use client";

// Lightweight directory of approved users (id, email, full_name, role) for
// the "Usuarios en la mesa" sidebar and @mention autocomplete in Mesa de
// trabajo. Requires the "user_profiles_select_approved_directory" RLS policy
// (see supabase/sql/036_user_profiles_directory_select.sql) — without it the
// query returns an empty list and the directory/sidebar simply stay empty
// (no error shown to the user).

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "../supabase/client";

export type ApprovedUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  isSuperAdmin: boolean;
};

export type ApprovedUsersState = {
  users: ApprovedUser[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
};

const MAX_USERS = 100;

let cache: ApprovedUser[] | null = null;
let inFlight: Promise<ApprovedUser[]> | null = null;

export async function listApprovedObservationUsers(): Promise<ApprovedUser[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Cliente Supabase no disponible.");
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, role, status, is_super_admin")
    .eq("status", "approved")
    .limit(MAX_USERS);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => ({
      id: (r.id as string) ?? "",
      email: (r.email as string) ?? "",
      fullName: (r.full_name as string) || (r.email as string) || (r.id as string) || "",
      role: (r.role as string) || "",
      status: (r.status as string) || "",
      isSuperAdmin: r.is_super_admin === true,
    }))
    .filter((user) => user.id && user.status === "approved")
    .sort((a, b) => {
      const byName = a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" });
      if (byName !== 0) return byName;
      return a.email.localeCompare(b.email, "es", { sensitivity: "base" });
    });
}

/** Approved users (status='approved'), fetched once and cached for the session. */
export function useApprovedUsers(): ApprovedUser[] {
  return useApprovedUsersState().users;
}

/** Approved users with explicit loading/error/retry states for workflows that need blocking validation. */
export function useApprovedUsersState(): ApprovedUsersState {
  const [users, setUsers] = useState<ApprovedUser[]>(() => cache ?? []);
  const [loading, setLoading] = useState(() => cache === null);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!inFlight) {
        inFlight = listApprovedObservationUsers().then((nextUsers) => {
          cache = nextUsers;
          return nextUsers;
        });
      }
      const nextUsers = await inFlight;
      setUsers(nextUsers);
    } catch (loadError) {
      inFlight = null;
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el directorio de usuarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cache) return;
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  return { users, loading, error, reload: loadUsers };
}
