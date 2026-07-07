import { NextRequest, NextResponse } from "next/server";
import {
  SYSTEM_GMAIL_ACCOUNT_ID,
  gmailSystemRefreshToken,
  gmailSystemSenderEmail,
  refreshGmailAccessToken,
} from "@/lib/gmail/gmailClient";
import { userContextFromRequest } from "@/lib/gmail/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { supabase, userEmail } = await userContextFromRequest(request);
    const { data, error } = await supabase
      .from("gmail_accounts")
      .select("id, google_email, display_name, is_default, created_at, updated_at")
      .eq("user_email", userEmail)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const systemAccount = [];
    let systemError: string | null = null;
    const systemRefreshToken = gmailSystemRefreshToken();
    if (systemRefreshToken) {
      try {
        await refreshGmailAccessToken(systemRefreshToken);
        systemAccount.push({
          id: SYSTEM_GMAIL_ACCOUNT_ID,
          google_email: gmailSystemSenderEmail() ?? "gmail-sistema@oficina-tecnica",
          display_name: "Gmail del sistema",
          is_default: true,
          is_system: true,
        });
      } catch {
        systemError = "El Gmail del sistema está configurado, pero Google rechazó su refresh token. Conecta Gmail con el botón Cambiar o regenera el token de sistema.";
      }
    }
    return NextResponse.json({ accounts: [...systemAccount, ...(data ?? [])], systemError });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron leer cuentas Gmail." },
      { status: 400 },
    );
  }
}
