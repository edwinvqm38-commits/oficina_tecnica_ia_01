"use client";

import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

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

type AuthContextValue = {
  session: Session;
  user: User;
  profile: UserProfile;
  isAdmin: boolean;
  accessStatus: AccessStatus;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  value,
  children,
}: {
  value: AuthContextValue;
  children: React.ReactNode;
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
