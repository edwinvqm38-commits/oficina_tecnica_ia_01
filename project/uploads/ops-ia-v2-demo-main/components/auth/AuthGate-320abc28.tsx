"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/lib/supabaseClient";
import { AuthProvider, type AccessStatus, type UserProfile } from "@/components/auth/AuthContext";

const MAIN_ADMIN_EMAIL = "edwin.qm@outlook.com";
const PENDING_ACCESS_MESSAGE = "Tu cuenta aún está pendiente de aprobación.";
const NEW_PENDING_ACCESS_MESSAGE = "Tu cuenta fue registrada correctamente y está pendiente de aprobación por un administrador.";
const INACTIVE_ACCESS_MESSAGE = "Tu acceso no está activo. Comunícate con el administrador.";
const PROFILE_VALIDATION_ERROR = "No se pudo validar tu perfil de acceso. Comunícate con el administrador.";

type AuthProviderName = "email" | "google";

function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

function isMainAdminEmail(email?: string | null): boolean {
  return normalizeEmail(email) === MAIN_ADMIN_EMAIL;
}

function actionButtonClass(disabled = false): string {
  return [
    "inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-semibold transition",
    disabled
      ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
      : "border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:text-stone-900",
  ].join(" ");
}

function AuthCard({
  onAdminLogin,
  onGoogleLogin,
  adminLoading,
  googleLoading,
  error,
}: {
  onAdminLogin: (email: string, password: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  adminLoading: boolean;
  googleLoading: boolean;
  error: string;
}) {
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const handleAdminSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onAdminLogin(adminEmail, adminPassword);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-stone-100 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">SGP-LITE</p>
          <h1 className="mt-1 text-xl font-bold text-stone-800">Iniciar sesión en OPS-IA V2</h1>
          <p className="mt-1 text-sm text-stone-500">Accede como administrador o con tu cuenta Google autorizada.</p>
        </div>

        <form onSubmit={handleAdminSubmit} className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
          <p className="text-sm font-bold text-stone-800">Acceso administrador</p>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-xs font-semibold text-stone-600">
              Email
              <input
                type="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 outline-none transition focus:border-stone-500"
                autoComplete="email"
                placeholder="edwin.qm@outlook.com"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-stone-600">
              Contraseña
              <input
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 outline-none transition focus:border-stone-500"
                autoComplete="current-password"
                placeholder="Contraseña de administrador"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:text-stone-900 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
              disabled={adminLoading || googleLoading}
            >
              {adminLoading ? "Validando..." : "Ingresar como administrador"}
            </button>
          </div>
        </form>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-stone-200" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">o</span>
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-sm font-bold text-stone-800">Acceso usuarios</p>
          <p className="mt-1 text-xs text-stone-500">El acceso queda sujeto a aprobación del administrador.</p>
          <button
            type="button"
            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:text-stone-900 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
            onClick={() => void onGoogleLogin()}
            disabled={adminLoading || googleLoading}
          >
            {googleLoading ? "Conectando..." : "Continuar con Google"}
          </button>
        </div>

        {error && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}

function InfoGate({
  title,
  message,
  email,
  onSignOut,
}: {
  title: string;
  message: string;
  email?: string | null;
  onSignOut: () => Promise<void>;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-stone-100 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-stone-800">{title}</h1>
        <p className="mt-2 text-sm text-stone-600">{message}</p>
        {email ? <p className="mt-2 text-xs text-stone-500">Usuario: {email}</p> : null}
        <div className="mt-5">
          <button onClick={onSignOut} className={actionButtonClass(false)}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

function getUserDisplayName(user: User): string {
  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (typeof name === "string" && name.trim()) return name.trim();
  return user.email ?? "Usuario pendiente";
}

function getAvatarUrl(user: User): string | null {
  const avatarUrl = user.user_metadata?.avatar_url;
  const picture = user.user_metadata?.picture;
  if (typeof avatarUrl === "string" && avatarUrl.trim()) return avatarUrl.trim();
  if (typeof picture === "string" && picture.trim()) return picture.trim();
  return null;
}

function getAuthProvider(user: User): AuthProviderName {
  return user.app_metadata?.provider === "google" ? "google" : "email";
}

function buildProfileMetadata(user: User, extra?: Record<string, unknown>): Record<string, unknown> {
  const avatarUrl = getAvatarUrl(user);
  return {
    provider: getAuthProvider(user),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    ...extra,
  };
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>("loading");
  const [accessError, setAccessError] = useState("");
  const [bootLoading, setBootLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const accessStatusRef = useRef<AccessStatus>("loading");
  const profileRef = useRef<UserProfile | null>(null);
  const hasApprovedAccessRef = useRef(false);
  const lastKnownApprovedProfileRef = useRef<UserProfile | null>(null);

  function debugAuth(event: string, payload: Record<string, unknown>) {
    if (process.env.NODE_ENV === "production") return;
    console.debug(`[auth] ${event}`, payload);
  }

  useEffect(() => {
    accessStatusRef.current = accessStatus;
  }, [accessStatus]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const fetchProfile = useCallback(async (user: User): Promise<{ profile: UserProfile; isNewPending: boolean }> => {
    const baseSelect =
      "id,email,full_name,role,status,is_super_admin,approved_by,approved_at,rejected_reason,metadata,created_at,updated_at";
    let foundProfile: UserProfile | null = null;
    let profileReadFailed = false;
    const userEmail = normalizeEmail(user.email);
    const now = new Date().toISOString();

    const mainAdminProfile: UserProfile = {
      id: user.id,
      email: user.email ?? MAIN_ADMIN_EMAIL,
      full_name: getUserDisplayName(user),
      role: "admin",
      status: "approved",
      is_super_admin: true,
      approved_at: now,
      metadata: buildProfileMetadata(user, { enforced_admin: true }),
      updated_at: now,
    };

    const syncMainAdminProfile = async (currentProfile?: UserProfile | null): Promise<UserProfile> => {
      const payload = {
        id: currentProfile?.id ?? user.id,
        email: currentProfile?.email ?? user.email ?? MAIN_ADMIN_EMAIL,
        full_name: currentProfile?.full_name ?? getUserDisplayName(user),
        role: "admin",
        status: "approved",
        is_super_admin: true,
        approved_at: currentProfile?.approved_at ?? now,
        updated_at: now,
        metadata: { ...(currentProfile?.metadata ?? {}), ...buildProfileMetadata(user, { enforced_admin: true }) },
      };

      const upsertResult = await supabase
        .from("user_profiles")
        .upsert(payload, { onConflict: "id" })
        .select(baseSelect)
        .maybeSingle();

      if (upsertResult.error) {
        console.info("No se pudo sincronizar el administrador principal desde frontend. Revisa RLS en user_profiles.", upsertResult.error.message);
        return {
          ...mainAdminProfile,
          ...currentProfile,
          ...payload,
          role: "admin",
          status: "approved",
          is_super_admin: true,
        } as UserProfile;
      }

      return (upsertResult.data ?? payload) as UserProfile;
    };

    const byId = await supabase.from("user_profiles").select(baseSelect).eq("id", user.id).maybeSingle();
    if (!byId.error && byId.data) {
      foundProfile = byId.data as UserProfile;
    } else if (byId.error) {
      profileReadFailed = true;
      console.info("No se pudo leer user_profiles por id. Revisa RLS o permisos de lectura.", byId.error.message);
    }

    if (!foundProfile && user.email) {
      const byEmail = await supabase.from("user_profiles").select(baseSelect).eq("email", user.email).maybeSingle();
      if (!byEmail.error && byEmail.data) {
        foundProfile = byEmail.data as UserProfile;
      } else if (byEmail.error) {
        profileReadFailed = true;
        console.info("No se pudo leer user_profiles por email. Revisa RLS o permisos de lectura.", byEmail.error.message);
      }
    }

    if (foundProfile) {
      if (isMainAdminEmail(foundProfile.email ?? userEmail)) {
        const needsAdminSync =
          foundProfile.role !== "admin" || foundProfile.status !== "approved" || foundProfile.is_super_admin !== true;
        return { profile: needsAdminSync ? await syncMainAdminProfile(foundProfile) : foundProfile, isNewPending: false };
      }

      const provider = getAuthProvider(user);
      const existingMetadata = foundProfile.metadata ?? {};
      const hasProvider = existingMetadata.provider === provider;
      const avatarUrl = getAvatarUrl(user);
      const hasAvatar = !avatarUrl || existingMetadata.avatar_url === avatarUrl;

      if (!hasProvider || !hasAvatar) {
        const { data: updatedProfile, error: updateError } = await supabase
          .from("user_profiles")
          .update({
            metadata: { ...existingMetadata, ...buildProfileMetadata(user) },
            updated_at: now,
          })
          .eq("id", foundProfile.id ?? user.id)
          .select(baseSelect)
          .maybeSingle();

        if (!updateError && updatedProfile) return { profile: updatedProfile as UserProfile, isNewPending: false };
      }

      return { profile: foundProfile, isNewPending: false };
    }

    if (isMainAdminEmail(userEmail)) {
      return { profile: await syncMainAdminProfile(null), isNewPending: false };
    }

    if (profileReadFailed) {
      return {
        profile: {
          id: user.id,
          email: user.email ?? null,
          full_name: getUserDisplayName(user),
          role: "consulta",
          status: "blocked",
          is_super_admin: false,
          rejected_reason: PROFILE_VALIDATION_ERROR,
          metadata: buildProfileMetadata(user, { blocked_reason: "profile_read_failed" }),
        },
        isNewPending: false,
      };
    }

    if (getAuthProvider(user) !== "google") {
      return {
        profile: {
          id: user.id,
          email: user.email ?? null,
          full_name: getUserDisplayName(user),
          role: "consulta",
          status: "rejected",
          is_super_admin: false,
          rejected_reason: "El acceso debe realizarse con Google OAuth.",
          metadata: buildProfileMetadata(user, { blocked_reason: "non_google_without_profile" }),
        },
        isNewPending: false,
      };
    }

    const pendingProfile = {
      id: user.id,
      email: user.email ?? null,
      full_name: getUserDisplayName(user),
      role: "consulta",
      status: "pending",
      is_super_admin: false,
      metadata: buildProfileMetadata(user, { created_by_auth_gate: true }),
    };

    const { error: profileInsertError } = await supabase.from("user_profiles").insert(pendingProfile);
    if (profileInsertError) {
      console.info("No se pudo crear perfil pending desde frontend. Revisa RLS o trigger en Supabase.", profileInsertError.message);
    }

    const existingRequest = user.email
      ? await supabase
          .from("user_access_requests")
          .select("id")
          .or(`user_id.eq.${user.id},email.eq.${user.email}`)
          .maybeSingle()
      : await supabase.from("user_access_requests").select("id").eq("user_id", user.id).maybeSingle();

    if (existingRequest.error) {
      console.info("No se pudo verificar solicitud pending. Revisa RLS en user_access_requests.", existingRequest.error.message);
    }

    if (!existingRequest.data) {
      const { error: requestInsertError } = await supabase.from("user_access_requests").insert({
        user_id: user.id,
        email: user.email ?? null,
        full_name: getUserDisplayName(user),
        requested_role: "consulta",
        status: "pending",
        metadata: buildProfileMetadata(user),
      });

      if (requestInsertError) {
        console.info("No se pudo crear solicitud pending desde frontend. Revisa RLS o trigger en Supabase.", requestInsertError.message);
      }
    }

    return {
      profile: {
        id: user.id,
        email: user.email ?? null,
        full_name: getUserDisplayName(user),
        role: "consulta",
        status: "pending",
        is_super_admin: false,
        metadata: buildProfileMetadata(user, { created_by_auth_gate: true }),
      },
      isNewPending: true,
    };
  }, []);

  const resolveAccessStatus = useCallback((nextProfile: UserProfile | null): AccessStatus => {
    if (!nextProfile) return "pending";
    if (nextProfile.metadata?.blocked_reason === "profile_read_failed") return "error";
    if (nextProfile.status === "approved") return "approved";
    if (nextProfile.status === "pending") return "pending";
    if (nextProfile.status === "rejected") return "rejected";
    if (nextProfile.status === "disabled" || nextProfile.status === "blocked") return "blocked";
    return "error";
  }, []);

  const syncProfile = useCallback(
    async (nextSession: Session | null, options: { isRevalidation?: boolean } = {}) => {
      if (!nextSession?.user) {
        setProfile(null);
        setAccessStatus("unauthenticated");
        setAccessError("");
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      // Don't flash "loading" if we are silently revalidating an already-approved session.
      if (!options.isRevalidation) {
        setAccessStatus("loading");
      }
      setAccessError("");
      debugAuth("sync-profile-start", { userId: nextSession.user.id, isRevalidation: options.isRevalidation ?? false });
      try {
        const loaded = await fetchProfile(nextSession.user);
        const nextAccessStatus = resolveAccessStatus(loaded.profile);
        debugAuth("sync-profile-success", { nextAccessStatus, isRevalidation: options.isRevalidation ?? false });
        if (nextAccessStatus === "approved") {
          hasApprovedAccessRef.current = true;
          lastKnownApprovedProfileRef.current = loaded.profile;
        }
        setProfile(loaded.profile);
        setAccessStatus(nextAccessStatus);
        setAccessError(nextAccessStatus === "error" ? PROFILE_VALIDATION_ERROR : "");
      } catch (syncError) {
        debugAuth("sync-profile-error-transient", {
          isRevalidation: options.isRevalidation ?? false,
          hasApproved: hasApprovedAccessRef.current,
          error: syncError instanceof Error ? syncError.message : "unknown",
        });
        if (options.isRevalidation && hasApprovedAccessRef.current) {
          // Transient error while revalidating an approved session — keep existing state visible.
          debugAuth("keep-approved-session-visible", { reason: "revalidation-error-transient" });
        } else {
          console.info("No se pudo validar el perfil de acceso.", syncError);
          setProfile(null);
          setAccessStatus("error");
          setAccessError(PROFILE_VALIDATION_ERROR);
        }
      } finally {
        setProfileLoading(false);
      }
    },
    [fetchProfile, resolveAccessStatus],
  );

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      debugAuth("boot-start", {});
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!mounted) return;
        if (sessionError) {
          console.info("No se pudo obtener la sesión de Supabase.", sessionError.message);
          setSession(null);
          setProfile(null);
          setAccessStatus("error");
          setAccessError(PROFILE_VALIDATION_ERROR);
          return;
        }

        const nextSession = data.session ?? null;
        setSession(nextSession);
        await syncProfile(nextSession);
      } catch (bootError) {
        if (!mounted) return;
        console.info("No se pudo inicializar la sesión.", bootError);
        setSession(null);
        setProfile(null);
        setAccessStatus("error");
        setAccessError(PROFILE_VALIDATION_ERROR);
      } finally {
        if (mounted) {
          setBootLoading(false);
          debugAuth("loading-false", { reason: "boot-finished" });
        }
      }
    };

    void boot();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const currentAccessStatus = accessStatusRef.current;
      const currentProfile = profileRef.current;
      const profileApproved = currentProfile?.status === "approved";
      const isAlreadyApproved = currentAccessStatus === "approved" && profileApproved;
      debugAuth("auth-event", {
        event,
        hasSession: Boolean(nextSession),
        currentAccessStatus,
        profileApproved,
        isAlreadyApproved,
      });
      setSession(nextSession);
      if (event === "SIGNED_OUT") {
        void syncProfile(nextSession);
        return;
      }
      if (isAlreadyApproved) {
        if (event === "TOKEN_REFRESHED") {
          // Token-only refresh — session is still valid, skip profile re-fetch.
          debugAuth("auth-event", { event, action: "skip-sync-token-refresh-already-approved" });
          return;
        }
        // SIGNED_IN on tab-return or other events while already approved — revalidate silently.
        debugAuth("keep-approved-session-visible", { reason: "auth-event-revalidation", event });
        void syncProfile(nextSession, { isRevalidation: true });
        return;
      }
      void syncProfile(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [syncProfile]);

  const signOut = useCallback(async () => {
    setSession(null);
    setProfile(null);
    setAccessStatus("unauthenticated");
    setAccessError("");
    setError("");
    setAdminLoading(false);
    setGoogleLoading(false);
    await supabase.auth.signOut();
    router.replace("/");
  }, [router]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    setProfileLoading(true);
    setAccessStatus("loading");
    setAccessError("");
    try {
      const loaded = await fetchProfile(session.user);
      const nextAccessStatus = resolveAccessStatus(loaded.profile);
      setProfile(loaded.profile);
      setAccessStatus(nextAccessStatus);
      setAccessError(nextAccessStatus === "error" ? PROFILE_VALIDATION_ERROR : "");
    } catch (refreshError) {
      console.info("No se pudo refrescar el perfil de acceso.", refreshError);
      setProfile(null);
      setAccessStatus("error");
      setAccessError(PROFILE_VALIDATION_ERROR);
    } finally {
      setProfileLoading(false);
    }
  }, [fetchProfile, resolveAccessStatus, session]);

  const handleAdminLogin = useCallback(async (email: string, password: string) => {
    const normalizedEmail = normalizeEmail(email);
    setError("");

    if (!normalizedEmail || !password) {
      setError("Ingresa el correo y la contraseña del administrador.");
      return;
    }

    if (!isMainAdminEmail(normalizedEmail)) {
      setError("El acceso con correo y contraseña está reservado solo para el administrador.");
      return;
    }

    setAdminLoading(true);
    const { error: adminError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setAdminLoading(false);

    if (adminError) {
      setError(adminError.message);
    }
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    setError("");
    setGoogleLoading(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: origin || undefined,
      },
    });
    setGoogleLoading(false);
    if (googleError) {
      setError(googleError.message);
    }
  }, []);

  const isAdmin = useMemo(() => {
    if (!session?.user) return false;
    const email = (profile?.email ?? session.user.email ?? "").toLowerCase();
    return profile?.role === "admin" || profile?.is_super_admin === true || email === MAIN_ADMIN_EMAIL;
  }, [profile, session]);

  const wasCreatedByAuthGate = profile?.metadata?.created_by_auth_gate === true;

  // Block with loading screen only on first boot or when there is no approved session yet.
  // isRevalidationApproved: defense-in-depth for cases where accessStatus momentarily transitions.
  const isRevalidatingApproved = (profileLoading || accessStatus === "loading") && profile?.status === "approved";
  if (bootLoading || (!isRevalidatingApproved && (profileLoading || accessStatus === "loading"))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">Cargando sesión...</div>
      </div>
    );
  }

  if (!session || accessStatus === "unauthenticated") {
    return (
      <AuthCard
        onAdminLogin={handleAdminLogin}
        onGoogleLogin={handleGoogleLogin}
        adminLoading={adminLoading}
        googleLoading={googleLoading}
        error={error}
      />
    );
  }

  if (accessStatus === "pending") {
    return (
      <InfoGate
        title="Acceso pendiente"
        message={wasCreatedByAuthGate ? NEW_PENDING_ACCESS_MESSAGE : PENDING_ACCESS_MESSAGE}
        email={profile?.email ?? session.user.email}
        onSignOut={signOut}
      />
    );
  }

  if (accessStatus === "rejected" || accessStatus === "blocked") {
    return (
      <InfoGate
        title="Acceso denegado"
        message={INACTIVE_ACCESS_MESSAGE}
        email={profile?.email ?? session.user.email}
        onSignOut={signOut}
      />
    );
  }

  if (accessStatus === "error" || accessStatus !== "approved" || profile?.status !== "approved") {
    // Safety net: if we have a previously approved session and are actively revalidating,
    // don't block with the error screen — keep children visible with the last known profile.
    const canKeepVisible = hasApprovedAccessRef.current && profileLoading;
    if (!canKeepVisible) {
      debugAuth("blocking-access-reason", { accessStatus, profileStatus: profile?.status, profileLoading });
      return (
        <InfoGate
          title="No se pudo validar el acceso"
          message={accessError || PROFILE_VALIDATION_ERROR}
          email={profile?.email ?? session.user.email}
          onSignOut={signOut}
        />
      );
    }
    debugAuth("keep-approved-session-visible", { reason: "error-gate-bypass-revalidating", accessStatus });
  }

  // Use the last known approved profile as fallback during the brief revalidation window.
  const safeProfile = (profile?.status === "approved" ? profile : lastKnownApprovedProfileRef.current) as UserProfile;
  const providerValue = {
    session,
    user: session.user,
    profile: safeProfile,
    isAdmin,
    accessStatus,
    refreshProfile,
    signOut,
  };

  return (
    <AuthProvider value={providerValue}>
      <div className="flex min-h-screen min-w-0">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </AuthProvider>
  );
}
