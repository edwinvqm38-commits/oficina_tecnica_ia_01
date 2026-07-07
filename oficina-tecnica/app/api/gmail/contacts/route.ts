import { NextRequest, NextResponse } from "next/server";
import { userContextFromRequest } from "@/lib/gmail/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { supabase, userEmail } = await userContextFromRequest(request);
    const { data, error } = await supabase
      .from("email_contacts")
      .select("id, email, name, last_used_at, use_count")
      .eq("user_email", userEmail)
      .order("last_used_at", { ascending: false })
      .limit(80);
    if (error) throw error;
    return NextResponse.json({ contacts: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron leer contactos." },
      { status: 400 },
    );
  }
}
