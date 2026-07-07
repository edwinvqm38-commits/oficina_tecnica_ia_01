import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import {
  bearerTokenFromRequest,
  createUserSupabase,
  requireApprovedUser,
} from "@/lib/api/serverAuth";

type SupabaseUserContext = {
  accessToken: string;
  supabase: SupabaseClient;
  userEmail: string;
};

export async function userContextFromToken(accessToken: string): Promise<SupabaseUserContext> {
  const supabase = createUserSupabase(accessToken);
  const context = await requireApprovedUser(
    new Request("https://oficina-tecnica.local", {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  );
  return { accessToken, supabase, userEmail: context.userEmail };
}

export async function userContextFromRequest(request: NextRequest): Promise<SupabaseUserContext> {
  const context = await requireApprovedUser(request);
  return { accessToken: context.accessToken, supabase: context.supabase, userEmail: context.userEmail };
}

export { bearerTokenFromRequest };
