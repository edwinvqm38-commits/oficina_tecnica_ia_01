"use client";

// Stub AuthContext for SGP modules running in demo mode.
// In demo mode, there is no real Supabase auth — we return a fixed
// demo user profile so cotizaciones/recursos pages can render without error.

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

const DEMO_PROFILE: UserProfile = {
  id: "demo-user",
  full_name: "Demo User",
  email: "",
  role: "admin",
  status: "approved",
  is_super_admin: false,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DEMO_USER: any = {
  id: "demo-user",
  email: "",
  aud: "authenticated",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DEMO_SESSION: any = {
  user: DEMO_USER,
  access_token: "",
  refresh_token: "",
  expires_in: 0,
  token_type: "bearer",
};

type AuthContextValue = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  profile: UserProfile;
  isAdmin: boolean;
  accessStatus: AccessStatus;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const DEMO_AUTH: AuthContextValue = {
  session: DEMO_SESSION,
  user: DEMO_USER,
  profile: DEMO_PROFILE,
  isAdmin: true,
  accessStatus: "approved",
  refreshProfile: async () => {},
  signOut: async () => {},
};

export function useAuth(): AuthContextValue {
  return DEMO_AUTH;
}
