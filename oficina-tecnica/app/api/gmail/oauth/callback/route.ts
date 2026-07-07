import { NextRequest, NextResponse } from "next/server";
import { exchangeGmailCode, fetchGoogleUserInfo } from "@/lib/gmail/gmailClient";
import { userContextFromToken } from "@/lib/gmail/supabaseServer";

export const runtime = "nodejs";

function redirectBack(request: NextRequest, returnTo: string | undefined, params: Record<string, string>) {
  const target = new URL(returnTo || new URL(request.url).origin);
  Object.entries(params).forEach(([key, value]) => target.searchParams.set(key, value));
  const response = NextResponse.redirect(target);
  response.cookies.delete("gmail_oauth_state");
  response.cookies.delete("gmail_oauth_supabase_token");
  response.cookies.delete("gmail_oauth_return_to");
  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const returnTo = request.cookies.get("gmail_oauth_return_to")?.value;
  try {
    const expectedState = request.cookies.get("gmail_oauth_state")?.value;
    const accessToken = request.cookies.get("gmail_oauth_supabase_token")?.value;
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");

    if (oauthError) throw new Error(`Google canceló la autorización: ${oauthError}`);
    if (!expectedState || expectedState !== state) throw new Error("La sesión OAuth de Gmail expiró o no coincide.");
    if (!accessToken) throw new Error("No se encontró la sesión Supabase para guardar Gmail.");
    if (!code) throw new Error("Google no devolvió código de autorización.");

    const origin = url.origin;
    const tokenData = await exchangeGmailCode(origin, code);
    const userInfo = await fetchGoogleUserInfo(tokenData.access_token);
    const { supabase, userEmail } = await userContextFromToken(accessToken);

    const { data: existing } = await supabase
      .from("gmail_accounts")
      .select("id, refresh_token")
      .eq("user_email", userEmail)
      .eq("google_email", userInfo.email)
      .maybeSingle();

    const refreshToken = tokenData.refresh_token || existing?.refresh_token;
    if (!refreshToken) {
      throw new Error("Google no devolvió refresh token. Vuelve a conectar usando consentimiento completo.");
    }

    await supabase
      .from("gmail_accounts")
      .update({ is_default: false })
      .eq("user_email", userEmail);

    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;
    const { error: upsertError } = await supabase.from("gmail_accounts").upsert(
      {
        user_email: userEmail,
        google_email: userInfo.email,
        display_name: userInfo.name ?? userInfo.email,
        refresh_token: refreshToken,
        access_token: tokenData.access_token,
        token_expires_at: tokenExpiresAt,
        scope: tokenData.scope ?? null,
        is_default: true,
      },
      { onConflict: "user_email,google_email" },
    );
    if (upsertError) throw upsertError;

    return redirectBack(request, returnTo, { gmail: "connected" });
  } catch (error) {
    return redirectBack(request, returnTo, {
      gmail_error: error instanceof Error ? error.message : "No se pudo conectar Gmail.",
    });
  }
}
