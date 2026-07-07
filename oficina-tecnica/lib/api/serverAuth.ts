import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ApiUserContext = {
  accessToken: string;
  supabase: SupabaseClient;
  userId: string;
  userEmail: string;
  role: string;
  isAdmin: boolean;
};

type RequireOptions = {
  moduleKey?: string;
  action?: "view" | "create" | "edit" | "upload" | "status";
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitStore = globalThis as typeof globalThis & {
  __oficinaRateLimits?: Map<string, RateLimitBucket>;
};

function readSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase no está configurado en variables de entorno.");
  return { url, anonKey };
}

export function bearerTokenFromRequest(request: NextRequest | Request): string {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("No hay sesión activa.");
  return token;
}

export function createUserSupabase(accessToken: string): SupabaseClient {
  const { url, anonKey } = readSupabaseEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function requireApprovedUser(
  request: NextRequest | Request,
  options: RequireOptions = {},
): Promise<ApiUserContext> {
  const accessToken = bearerTokenFromRequest(request);
  const supabase = createUserSupabase(accessToken);
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const user = userData.user;
  if (userError || !user?.id || !user.email) {
    throw new Error("Sesión inválida o expirada.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id,email,role,status,is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || profile.status !== "approved") {
    throw new Error("Tu usuario aún no está aprobado para usar esta función.");
  }

  const role = String(profile.role ?? "consulta");
  const isAdmin = profile.is_super_admin === true || role === "admin" || role === "gerencia";

  if (options.moduleKey && !isAdmin) {
    const { data: allowed, error: permissionError } = await supabase.rpc("can_use_module", {
      p_module: options.moduleKey,
      p_action: options.action ?? "view",
    });
    if (permissionError) throw permissionError;
    if (allowed !== true) {
      throw new Error("No tienes permiso para usar esta función.");
    }
  }

  return {
    accessToken,
    supabase,
    userId: user.id,
    userEmail: user.email,
    role,
    isAdmin,
  };
}

export function assertRateLimit(
  key: string,
  options: { limit: number; windowMs: number; label?: string },
) {
  const now = Date.now();
  const store = rateLimitStore.__oficinaRateLimits ?? new Map<string, RateLimitBucket>();
  rateLimitStore.__oficinaRateLimits = store;
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return;
  }

  if (bucket.count >= options.limit) {
    const seconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new Error(`Límite temporal alcanzado para ${options.label ?? "esta función"}. Intenta nuevamente en ${seconds}s.`);
  }

  bucket.count += 1;
}

export function apiAuthErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "No autorizado.";
  const status = /límite temporal/i.test(message)
    ? 429
    : /permiso/i.test(message)
      ? 403
      : /sesión|session|no hay sesión|inválida|expirada|aprobado/i.test(message)
        ? 401
        : 500;
  return NextResponse.json({ error: message }, { status });
}
