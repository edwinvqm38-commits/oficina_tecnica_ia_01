import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  SYSTEM_GMAIL_ACCOUNT_ID,
  buildMimeMessage,
  fetchGmailProfile,
  gmailSystemRefreshToken,
  gmailSystemSenderEmail,
  refreshGmailAccessToken,
  sendGmailMessage,
} from "@/lib/gmail/gmailClient";
import { userContextFromRequest } from "@/lib/gmail/supabaseServer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiAuthErrorResponse, assertRateLimit } from "@/lib/api/serverAuth";

export const runtime = "nodejs";

type SendPayload = {
  accountId?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  plainBody?: string;
  htmlBody?: string;
  entityType?: "quotation" | "requirement";
  entityCode?: string;
};

function normalizeEmailList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim().toLowerCase()).filter(Boolean);
}

async function rememberContacts(
  supabase: SupabaseClient,
  userEmail: string,
  emails: string[],
) {
  for (const email of emails) {
    const { data: existing } = await supabase
      .from("email_contacts")
      .select("id, use_count")
      .eq("user_email", userEmail)
      .eq("email", email)
      .maybeSingle();

    await supabase.from("email_contacts").upsert(
      {
        user_email: userEmail,
        email,
        use_count: Number(existing?.use_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "user_email,email" },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as SendPayload;
    const to = normalizeEmailList(payload.to);
    const cc = normalizeEmailList(payload.cc);
    const subject = String(payload.subject ?? "").trim();
    const plainBody = String(payload.plainBody ?? "").trim();
    const htmlBody = String(payload.htmlBody ?? "").trim();
    const entityType = payload.entityType;
    const entityCode = String(payload.entityCode ?? "").trim();

    if (!payload.accountId) throw new Error("Selecciona una cuenta Gmail de origen.");
    if (!to.length) throw new Error("Agrega al menos un destinatario.");
    if (!subject || !plainBody || !htmlBody) throw new Error("Faltan asunto o cuerpo del correo.");
    if (!entityType || !entityCode) throw new Error("Falta vincular el correo a una cotización o requerimiento.");

    const { supabase, userEmail } = await userContextFromRequest(request);
    assertRateLimit(`gmail-send:${userEmail.toLowerCase()}`, { limit: 20, windowMs: 60 * 60_000, label: "envío de correos" });
    const moduleKey = entityType === "requirement" ? "requerimientos" : "cotizaciones";
    const { data: canSend, error: permissionError } = await supabase.rpc("can_use_module", {
      p_module: moduleKey,
      p_action: "view",
    });
    if (permissionError) throw permissionError;
    if (canSend !== true) throw new Error("No tienes permiso para enviar correos de este módulo.");

    let accountIdForThread: string | null = null;
    let fromEmail = "";
    let accessToken = "";

    if (payload.accountId === SYSTEM_GMAIL_ACCOUNT_ID) {
      const refreshToken = gmailSystemRefreshToken();
      if (!refreshToken) throw new Error("No hay Gmail del sistema configurado.");
      const tokenData = await refreshGmailAccessToken(refreshToken);
      accessToken = tokenData.access_token;
      fromEmail = gmailSystemSenderEmail() ?? (await fetchGmailProfile(accessToken)).emailAddress;
    } else {
      const { data: account, error: accountError } = await supabase
        .from("gmail_accounts")
        .select("id, google_email, display_name, refresh_token")
        .eq("id", payload.accountId)
        .eq("user_email", userEmail)
        .single();
      if (accountError || !account) throw new Error("No encontré la cuenta Gmail seleccionada.");

      const tokenData = await refreshGmailAccessToken(account.refresh_token);
      accessToken = tokenData.access_token;
      accountIdForThread = account.id;
      fromEmail = account.google_email;
      const tokenExpiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;
      await supabase
        .from("gmail_accounts")
        .update({
          access_token: tokenData.access_token,
          token_expires_at: tokenExpiresAt,
          scope: tokenData.scope ?? null,
        })
        .eq("id", account.id)
        .eq("user_email", userEmail);
    }

    const { data: existingThread } = await supabase
      .from("email_threads")
      .select("id, gmail_thread_id, last_message_id")
      .eq("user_email", userEmail)
      .eq("entity_type", entityType)
      .eq("entity_code", entityCode)
      .eq("subject", subject)
      .maybeSingle();

    const messageId = `<${randomUUID()}@oficina-tecnica.local>`;
    const rawMime = buildMimeMessage({
      from: fromEmail,
      to,
      cc,
      subject,
      text: plainBody,
      html: htmlBody,
      messageId,
      inReplyTo: existingThread?.last_message_id ?? null,
      references: existingThread?.last_message_id ?? null,
    });
    const sent = await sendGmailMessage(accessToken, {
      rawMime,
      threadId: existingThread?.gmail_thread_id ?? null,
    });

    const now = new Date().toISOString();
    const { error: threadError } = await supabase.from("email_threads").upsert(
      {
        user_email: userEmail,
        gmail_account_id: accountIdForThread,
        entity_type: entityType,
        entity_code: entityCode,
        subject,
        gmail_thread_id: sent.threadId,
        last_message_id: messageId,
        last_gmail_message_id: sent.id,
        last_sent_at: now,
        recipients: [...to, ...cc].map((email) => ({ email })),
      },
      { onConflict: "user_email,entity_type,entity_code,subject" },
    );
    if (threadError) throw threadError;

    await rememberContacts(supabase, userEmail, [...to, ...cc]);
    return NextResponse.json({
      ok: true,
      from: fromEmail,
      gmailMessageId: sent.id,
      threadId: sent.threadId,
    });
  } catch (error) {
    if (error instanceof Error && /sesión|aprobado|permiso|límite/i.test(error.message)) {
      return apiAuthErrorResponse(error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo enviar el correo por Gmail." },
      { status: 400 },
    );
  }
}
