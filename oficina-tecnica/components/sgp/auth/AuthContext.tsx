"use client";

// Real auth bridge for SGP modules: reads the active Supabase session and
// the matching public.user_profiles row, so per-user permissions
// (admin_module_permissions) and admin checks reflect the actual logged-in
// user instead of a fixed demo identity.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/sgp/supabaseClient";

export type AppRole = "admin" | "gerencia" | "responsable" | "consulta";
export type AppStatus = "approved" | "pending" | "rejected" | "disabled" | "blocked";
export type AccessStatus = "loading" | "unauthenticated" | "pending" | "rejected" | "blocked" | "approved" | "error";

export type UserProfile = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
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

export type AuthUser = { id: string; email: string };

const ADMIN_EMAIL = "edwin.qm@outlook.com";

const EMPTY_USER: AuthUser = { id: "", email: "" };
const EMPTY_PROFILE: UserProfile = {};

type AuthContextValue = {
  user: AuthUser;
  profile: UserProfile;
  isAdmin: boolean;
  accessStatus: AccessStatus;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

export function useAuth(): AuthContextValue {
  const [user, setUser] = useState<AuthUser>(EMPTY_USER);
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>("loading");

  const loadProfile = useCallback(async (currentUser: AuthUser) => {
    if (!currentUser.id) {
      setProfile(EMPTY_PROFILE);
      setAccessStatus("unauthenticated");
      return;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id,email,full_name,role,status,is_super_admin,approved_by,approved_at,rejected_reason,metadata,created_at,updated_at")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      setProfile({ email: currentUser.email });
      setAccessStatus("error");
      return;
    }

    if (!data) {
      setProfile({ email: currentUser.email });
      setAccessStatus("pending");
      return;
    }

    setProfile(data as UserProfile);
    setAccessStatus(((data as UserProfile).status as AccessStatus) ?? "pending");
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const sessionUser = data.session?.user;
      const nextUser: AuthUser = sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? "" } : EMPTY_USER;
      setUser(nextUser);
      void loadProfile(nextUser);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      const sessionUser = s?.user;
      const nextUser: AuthUser = sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? "" } : EMPTY_USER;
      setUser(nextUser);
      void loadProfile(nextUser);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const normalizedEmail = (profile.email ?? user.email ?? "").trim().toLowerCase();
  const isAdmin = profile.is_super_admin === true || profile.role === "admin" || normalizedEmail === ADMIN_EMAIL;

  const refreshProfile = useCallback(() => loadProfile(user), [loadProfile, user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { user, profile, isAdmin, accessStatus, refreshProfile, signOut };
}
