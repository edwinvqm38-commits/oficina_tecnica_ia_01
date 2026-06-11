"use client";

// Lightweight directory of approved users (id, email, full_name, role) for
// the "Usuarios en la mesa" sidebar and @mention autocomplete in Mesa de
// trabajo. Requires the "user_profiles_select_approved_directory" RLS policy
// (see supabase/sql/036_user_profiles_directory_select.sql) — without it the
// query returns an empty list and the directory/sidebar simply stay empty
// (no error shown to the user).

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../supabase/client";

export type ApprovedUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

const MAX_USERS = 100;

let cache: ApprovedUser[] | null = null;
let inFlight: Promise<ApprovedUser[]> | null = null;

async function fetchApprovedUsers(): Promise<ApprovedUser[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, role")
    .eq("status", "approved")
    .limit(MAX_USERS);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    email: (r.email as string) ?? "",
    fullName: (r.full_name as string) || (r.email as string) || "",
    role: (r.role as string) || "",
  }));
}

/** Approved users (status='approved'), fetched once and cached for the session. */
export function useApprovedUsers(): ApprovedUser[] {
  const [users, setUsers] = useState<ApprovedUser[]>(() => cache ?? []);

  useEffect(() => {
    if (cache) return;
    if (!inFlight) inFlight = fetchApprovedUsers().then((u) => { cache = u; return u; });
    let cancelled = false;
    inFlight.then((u) => { if (!cancelled) setUsers(u); });
    return () => { cancelled = true; };
  }, []);

  return users;
}
