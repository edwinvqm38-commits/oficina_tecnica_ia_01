import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

type SupabaseUserContext = {
  accessToken: string;
  supabase: SupabaseClient;
  userEmail: string;
};

function readSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase no está configurado en variables de entorno.");
  return { url, anonKey };
}

export function bearerTokenFromRequest(request: NextRequest): string {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("No hay sesión activa para operar Gmail.");
  return token;
}

export function createUserSupabase(accessToken: string): SupabaseClient {
  const { url, anonKey } = readSupabaseEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function userContextFromToken(accessToken: string): Promise<SupabaseUserContext> {
  const supabase = createUserSupabase(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) throw new Error("No pude validar el usuario actual.");
  return { accessToken, supabase, userEmail: data.user.email };
}

export async function userContextFromRequest(request: NextRequest): Promise<SupabaseUserContext> {
  return userContextFromToken(bearerTokenFromRequest(request));
}
