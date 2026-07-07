import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildGmailAuthUrl, gmailRedirectUri } from "@/lib/gmail/gmailClient";
import { bearerTokenFromRequest, userContextFromToken } from "@/lib/gmail/supabaseServer";

export const runtime = "nodejs";

const COOKIE_MAX_AGE = 10 * 60;

function secureCookie() {
  return process.env.NODE_ENV === "production";
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = bearerTokenFromRequest(request);
    await userContextFromToken(accessToken);

    const body = await request.json().catch(() => ({})) as { returnTo?: string };
    const origin = new URL(request.url).origin;
    const state = randomUUID();
    const returnTo = body.returnTo && body.returnTo.startsWith("http") ? body.returnTo : origin;
    const response = NextResponse.json({
      authUrl: buildGmailAuthUrl(origin, state),
      redirectUri: gmailRedirectUri(origin),
    });

    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: secureCookie(),
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    };
    response.cookies.set("gmail_oauth_state", state, cookieOptions);
    response.cookies.set("gmail_oauth_supabase_token", accessToken, cookieOptions);
    response.cookies.set("gmail_oauth_return_to", returnTo, cookieOptions);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar conexión Gmail." },
      { status: 400 },
    );
  }
}
