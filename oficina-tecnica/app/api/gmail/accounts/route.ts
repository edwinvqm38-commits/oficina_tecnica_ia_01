import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.json({ accounts: data ?? [], systemError: null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron leer cuentas Gmail." },
      { status: 400 },
    );
  }
}
