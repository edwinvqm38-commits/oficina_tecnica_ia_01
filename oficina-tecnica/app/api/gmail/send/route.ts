import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildMimeMessage,
  refreshGmailAccessToken,
  sendGmailMessage,
} from "@/lib/gmail/gmailClient";
import { userContextFromRequest } from "@/lib/gmail/supabaseServer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertRateLimit } from "@/lib/api/serverAuth";

export const runtime = "nodejs";

type EntityType = "quotation" | "requirement";
type RecipientKind = "to" | "cc" | "bcc";
type AttemptStatus = "pending" | "sent" | "failed" | "partial";
type SendResultStatus = "success" | "pending" | "partial";

type SendPayload = {
  accountId?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  plainBody?: string;
  htmlBody?: string;
  entityType?: EntityType;
  entityCode?: string;
  idempotencyKey?: string;
};

type GmailAccountRow = {
  id: string;
  google_email: string;
  display_name?: string | null;
  refresh_token: string;
};

type EmailThreadRow = {
  id: string;
  subject: string;
  gmail_thread_id: string | null;
  last_message_id: string | null;
  last_gmail_message_id: string | null;
  references_header?: string | null;
  last_sent_at?: string | null;
};

type EmailSendAttemptRow = {
  id: string;
  status: AttemptStatus;
  from_email?: string | null;
  gmail_thread_id?: string | null;
  gmail_message_id?: string | null;
  rfc_message_id?: string | null;
  last_error?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
};

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const EMAIL_PATTERN = /^[^\s@<>(),;]+@[^\s@<>(),;]+\.[^\s@<>(),;]+$/i;
const IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9._:-]{16,160}$/;
const MAX_SUBJECT_CHARS = 200;
const MAX_RECIPIENTS = 50;
// Body limits are character-based to cap request size before Gmail/Supabase work starts.
const MAX_PLAIN_BODY_CHARS = 100_000;
const MAX_HTML_BODY_CHARS = 200_000;
const PENDING_ATTEMPT_TIMEOUT_MS = 2 * 60 * 1000;
const EMAIL_INTEGRATION_DISABLED_MESSAGE = "La integración de correo todavía no está habilitada en este entorno.";

function errorText(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    return Object.values(error as Record<string, unknown>)
      .map((value) => (typeof value === "string" ? value : ""))
      .filter(Boolean)
      .join(" ");
  }
  return String(error);
}

function isEmailIntegrationSchemaError(error: unknown): boolean {
  const text = errorText(error).toLowerCase();
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code ?? "").toUpperCase()
    : "";
  const mentionsMissingObject = code === "42P01"
    || code === "42703"
    || code === "PGRST204"
    || /does not exist|could not find|no existe|schema cache/i.test(text);
  const mentionsEmailIntegration = /email_send_attempts|references_header|last_error/i.test(text);
  return mentionsMissingObject && mentionsEmailIntegration;
}

function toPublicError(error: unknown): unknown {
  if (!isEmailIntegrationSchemaError(error)) return error;
  console.error("[gmail/send] esquema de integración Gmail no disponible", { error });
  return new ApiError(503, EMAIL_INTEGRATION_DISABLED_MESSAGE);
}

function jsonError(error: unknown, fallbackStatus = 500) {
  const publicError = toPublicError(error);
  const message = publicError instanceof Error ? publicError.message : "No se pudo enviar el correo por Gmail.";
  const status = publicError instanceof ApiError
    ? publicError.status
    : /límite temporal/i.test(message)
      ? 429
      : /permiso/i.test(message)
        ? 403
        : /sesión|session|no hay sesión|inválida|expirada|aprobado/i.test(message)
          ? 401
          : fallbackStatus;
  return NextResponse.json({ error: message }, { status });
}

function sendResultResponse(
  status: SendResultStatus,
  input: {
    httpStatus?: number;
    message: string;
    ok?: boolean;
    idempotentReplay?: boolean;
    from?: string | null;
    gmailMessageId?: string | null;
    threadId?: string | null;
    rfcMessageId?: string | null;
    warning?: string | null;
    threadStatus?: "created" | "continued";
  },
) {
  return NextResponse.json(
    {
      ok: input.ok ?? status === "success",
      status,
      message: input.message,
      shouldRetry: false,
      idempotentReplay: input.idempotentReplay ?? false,
      from: input.from ?? null,
      gmailMessageId: input.gmailMessageId ?? null,
      threadId: input.threadId ?? null,
      rfcMessageId: input.rfcMessageId ?? null,
      gmailUrl: safeThreadUrl(input.threadId),
      threadStatus: input.threadStatus,
      warning: input.warning ?? null,
    },
    { status: input.httpStatus ?? (status === "success" ? 200 : 202) },
  );
}

function parseEntityType(value: unknown): EntityType {
  if (value === "quotation" || value === "requirement") return value;
  throw new ApiError(400, "Tipo de entidad inválido.");
}

function moduleKeyForEntity(entityType: EntityType): "cotizaciones" | "requerimientos" {
  return entityType === "requirement" ? "requerimientos" : "cotizaciones";
}

function normalizeEmailList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    const email = String(item ?? "").trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, `Correo inválido: ${email}`);
    if (!result.includes(email)) result.push(email);
  }
  return result;
}

function normalizeRecipients(payload: SendPayload): Record<RecipientKind, string[]> {
  const recipients = {
    to: normalizeEmailList(payload.to),
    cc: normalizeEmailList(payload.cc),
    bcc: normalizeEmailList(payload.bcc),
  };
  if (!recipients.to.length) throw new ApiError(400, "Agrega al menos un destinatario en Para.");
  const totalRecipients = recipients.to.length + recipients.cc.length + recipients.bcc.length;
  if (totalRecipients > MAX_RECIPIENTS) {
    throw new ApiError(400, `El correo puede tener como máximo ${MAX_RECIPIENTS} destinatarios entre Para, CC y CCO.`);
  }

  const seen = new Map<string, RecipientKind>();
  (Object.entries(recipients) as Array<[RecipientKind, string[]]>).forEach(([kind, emails]) => {
    emails.forEach((email) => {
      const previousKind = seen.get(email);
      if (previousKind) {
        throw new ApiError(400, `El correo ${email} ya está en ${previousKind.toUpperCase()}.`);
      }
      seen.set(email, kind);
    });
  });

  return recipients;
}

function normalizeSubject(value: unknown): string {
  const subject = String(value ?? "").trim();
  if (!subject) throw new ApiError(400, "Falta el asunto del correo.");
  if (/[\r\n]/.test(subject)) throw new ApiError(400, "El asunto no puede contener saltos de línea.");
  if (subject.length > MAX_SUBJECT_CHARS) {
    throw new ApiError(400, `El asunto puede tener como máximo ${MAX_SUBJECT_CHARS} caracteres.`);
  }
  return subject;
}

function normalizeBody(value: unknown, label: string, maxChars: number): string {
  const body = String(value ?? "").trim();
  if (!body) throw new ApiError(400, `Falta el cuerpo ${label} del correo.`);
  if (body.length > maxChars) {
    throw new ApiError(400, `El cuerpo ${label} puede tener como máximo ${maxChars.toLocaleString("es-PE")} caracteres.`);
  }
  return body;
}

function recipientRows(recipients: Record<RecipientKind, string[]>) {
  return (Object.entries(recipients) as Array<[RecipientKind, string[]]>)
    .flatMap(([kind, emails]) => emails.map((email) => ({ email, type: kind })));
}

function safeThreadUrl(threadId: string | null | undefined): string | null {
  if (!threadId || !/^[a-zA-Z0-9_-]+$/.test(threadId)) return null;
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(threadId)}`;
}

async function findThread(
  supabase: SupabaseClient,
  input: {
    userEmail: string;
    accountId: string;
    entityType: EntityType;
    entityCode: string;
  },
): Promise<EmailThreadRow | null> {
  const { data, error } = await supabase
    .from("email_threads")
    .select("id, subject, gmail_thread_id, last_message_id, last_gmail_message_id, references_header, last_sent_at")
    .eq("user_email", input.userEmail)
    .eq("gmail_account_id", input.accountId)
    .eq("entity_type", input.entityType)
    .eq("entity_code", input.entityCode)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as EmailThreadRow | null;
}

async function findOwnedAccount(
  supabase: SupabaseClient,
  userEmail: string,
  accountId: string,
): Promise<GmailAccountRow> {
  const { data: account, error } = await supabase
    .from("gmail_accounts")
    .select("id, google_email, display_name, refresh_token")
    .eq("id", accountId)
    .eq("user_email", userEmail)
    .maybeSingle();
  if (error) throw error;
  if (!account) throw new ApiError(403, "La cuenta Gmail seleccionada no pertenece al usuario autenticado.");
  return account as GmailAccountRow;
}

async function createPendingAttempt(
  supabase: SupabaseClient,
  input: {
    userEmail: string;
    accountId: string;
    entityType: EntityType;
    entityCode: string;
    subject: string;
    idempotencyKey: string;
    recipients: Array<{ email: string; type: RecipientKind }>;
  },
): Promise<{ attempt: EmailSendAttemptRow; replay: boolean }> {
  const { data, error } = await supabase
    .from("email_send_attempts")
    .insert({
      user_email: input.userEmail,
      gmail_account_id: input.accountId,
      entity_type: input.entityType,
      entity_code: input.entityCode,
      subject: input.subject,
      idempotency_key: input.idempotencyKey,
      status: "pending",
      recipients: input.recipients,
    })
    .select("id, status, from_email, gmail_thread_id, gmail_message_id, rfc_message_id, last_error, sent_at, created_at")
    .single();

  if (!error) return { attempt: data as EmailSendAttemptRow, replay: false };
  if (isEmailIntegrationSchemaError(error)) throw error;

  const { data: existing, error: existingError } = await supabase
    .from("email_send_attempts")
    .select("id, status, from_email, gmail_thread_id, gmail_message_id, rfc_message_id, last_error, sent_at, created_at")
    .eq("user_email", input.userEmail)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw error;

  return { attempt: existing as EmailSendAttemptRow, replay: true };
}

function isRecentPendingAttempt(attempt: EmailSendAttemptRow): boolean {
  if (attempt.status !== "pending" || !attempt.created_at) return false;
  const createdAtMs = Date.parse(attempt.created_at);
  if (Number.isNaN(createdAtMs)) return false;
  return Date.now() - createdAtMs < PENDING_ATTEMPT_TIMEOUT_MS;
}

function replayAttemptResponse(attempt: EmailSendAttemptRow) {
  if (attempt.status === "sent") {
    return sendResultResponse("success", {
      message: "Este envío ya estaba registrado; no se volvió a enviar por Gmail.",
      idempotentReplay: true,
      from: attempt.from_email,
      gmailMessageId: attempt.gmail_message_id,
      threadId: attempt.gmail_thread_id,
      rfcMessageId: attempt.rfc_message_id,
    });
  }

  if (attempt.status === "pending" && isRecentPendingAttempt(attempt)) {
    return sendResultResponse("pending", {
      message: "El envío continúa en proceso. No reintentes automáticamente; espera la confirmación o revisa Gmail.",
    });
  }

  if (attempt.status === "pending") {
    return sendResultResponse("partial", {
      message: "El resultado del envío es incierto porque el intento quedó pendiente más de 2 minutos. No reintentes automáticamente; revisa Gmail antes de cualquier acción.",
    });
  }

  if (attempt.status === "partial") {
    return sendResultResponse("partial", {
      message: "Gmail aceptó el correo, pero falta reconciliar la persistencia del hilo. No se reenviará automáticamente.",
      from: attempt.from_email,
      gmailMessageId: attempt.gmail_message_id,
      threadId: attempt.gmail_thread_id,
      rfcMessageId: attempt.rfc_message_id,
    });
  }

  throw new ApiError(409, "El intento anterior falló. Corrige el problema y vuelve a intentar.");
}

async function updateAttempt(
  supabase: SupabaseClient,
  attemptId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase
    .from("email_send_attempts")
    .update(patch)
    .eq("id", attemptId);
  if (error) {
    console.error("[gmail/send] no se pudo actualizar intento", { attemptId, error });
    return false;
  }
  return true;
}

async function rememberContacts(
  supabase: SupabaseClient,
  userEmail: string,
  emails: string[],
): Promise<string | null> {
  try {
    for (const email of emails) {
      const { data: existing, error: existingError } = await supabase
        .from("email_contacts")
        .select("id, use_count")
        .eq("user_email", userEmail)
        .eq("email", email)
        .maybeSingle();
      if (existingError) throw existingError;

      const { error } = await supabase.from("email_contacts").upsert(
        {
          user_email: userEmail,
          email,
          use_count: Number(existing?.use_count ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "user_email,email" },
      );
      if (error) throw error;
    }
    return null;
  } catch (error) {
    console.warn("[gmail/send] correo enviado, pero no se pudieron actualizar contactos", {
      message: error instanceof Error ? error.message : "error desconocido",
    });
    return "El correo se envió, pero no se pudieron actualizar los contactos frecuentes.";
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const entityType = parseEntityType(url.searchParams.get("entityType"));
    const entityCode = String(url.searchParams.get("entityCode") ?? "").trim();
    const accountId = String(url.searchParams.get("accountId") ?? "").trim();
    if (!entityCode) throw new ApiError(400, "Falta el código de la entidad.");
    if (!accountId) throw new ApiError(400, "Selecciona una cuenta Gmail de origen.");

    const { supabase, userEmail } = await userContextFromRequest(request);
    const canonicalUserEmail = userEmail.toLowerCase();
    const { data: canUse, error: permissionError } = await supabase.rpc("can_use_module", {
      p_module: moduleKeyForEntity(entityType),
      p_action: "view",
    });
    if (permissionError) throw permissionError;
    if (canUse !== true) throw new ApiError(403, "No tienes permiso para consultar hilos de este módulo.");

    const account = await findOwnedAccount(supabase, userEmail, accountId);
    const thread = await findThread(supabase, { userEmail: canonicalUserEmail, accountId: account.id, entityType, entityCode });
    return NextResponse.json({
      exists: Boolean(thread?.gmail_thread_id),
      threadId: thread?.gmail_thread_id ?? null,
      lastGmailMessageId: thread?.last_gmail_message_id ?? null,
      lastRfcMessageId: thread?.last_message_id ?? null,
      lastSentAt: thread?.last_sent_at ?? null,
      gmailUrl: safeThreadUrl(thread?.gmail_thread_id),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  let supabaseForAttempt: SupabaseClient | null = null;
  let pendingAttemptId: string | null = null;
  let attemptAlreadyFinalized = false;
  try {
    const payload = await request.json() as SendPayload;
    const recipients = normalizeRecipients(payload);
    const subject = normalizeSubject(payload.subject);
    const plainBody = normalizeBody(payload.plainBody, "texto plano", MAX_PLAIN_BODY_CHARS);
    const htmlBody = normalizeBody(payload.htmlBody, "HTML", MAX_HTML_BODY_CHARS);
    const entityType = parseEntityType(payload.entityType);
    const entityCode = String(payload.entityCode ?? "").trim();
    const accountId = String(payload.accountId ?? "").trim();
    const idempotencyKey = String(payload.idempotencyKey ?? "").trim();

    if (!accountId) throw new ApiError(400, "Selecciona una cuenta Gmail de origen.");
    if (!entityCode) throw new ApiError(400, "Falta vincular el correo a una cotización o requerimiento.");
    if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) throw new ApiError(400, "La clave de idempotencia es inválida.");

    const { supabase, userEmail } = await userContextFromRequest(request);
    const canonicalUserEmail = userEmail.toLowerCase();
    supabaseForAttempt = supabase;
    assertRateLimit(`gmail-send:${canonicalUserEmail}`, { limit: 20, windowMs: 60 * 60_000, label: "envío de correos" });

    const { data: canSend, error: permissionError } = await supabase.rpc("can_use_module", {
      p_module: moduleKeyForEntity(entityType),
      p_action: "edit",
    });
    if (permissionError) throw permissionError;
    if (canSend !== true) throw new ApiError(403, "No tienes permiso para enviar correos de este módulo.");

    const account = await findOwnedAccount(supabase, userEmail, accountId);
    const recipientsForStorage = recipientRows(recipients);
    const { attempt, replay } = await createPendingAttempt(supabase, {
      userEmail: canonicalUserEmail,
      accountId: account.id,
      entityType,
      entityCode,
      subject,
      idempotencyKey,
      recipients: recipientsForStorage,
    });

    if (replay) return replayAttemptResponse(attempt);

    pendingAttemptId = attempt.id;
    const existingThread = await findThread(supabase, { userEmail: canonicalUserEmail, accountId: account.id, entityType, entityCode });
    const tokenData = await refreshGmailAccessToken(account.refresh_token);
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;
    const { error: accountUpdateError } = await supabase
      .from("gmail_accounts")
      .update({
        access_token: tokenData.access_token,
        token_expires_at: tokenExpiresAt,
        scope: tokenData.scope ?? null,
      })
      .eq("id", account.id)
      .eq("user_email", userEmail);
    if (accountUpdateError) throw accountUpdateError;

    const messageId = `<${randomUUID()}@oficina-tecnica.local>`;
    const previousReferences = existingThread?.references_header || existingThread?.last_message_id || null;
    const subjectForSend = existingThread?.subject || subject;
    const rawMime = buildMimeMessage({
      from: account.google_email,
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      subject: subjectForSend,
      text: plainBody,
      html: htmlBody,
      messageId,
      inReplyTo: existingThread?.last_message_id ?? null,
      references: previousReferences,
    });

    let sent: Awaited<ReturnType<typeof sendGmailMessage>>;
    try {
      sent = await sendGmailMessage(tokenData.access_token, {
        rawMime,
        threadId: existingThread?.gmail_thread_id ?? null,
      });
    } catch (error) {
      const finalized = await updateAttempt(supabase, attempt.id, {
        status: "failed",
        last_error: error instanceof Error ? error.message : "Fallo del proveedor Gmail.",
      });
      if (finalized) attemptAlreadyFinalized = true;
      throw new ApiError(502, error instanceof Error ? error.message : "Fallo del proveedor Gmail.");
    }

    const now = new Date().toISOString();
    const nextReferences = [previousReferences, messageId].filter(Boolean).join(" ");
    const { error: threadError } = await supabase.from("email_threads").upsert(
      {
        user_email: canonicalUserEmail,
        gmail_account_id: account.id,
        entity_type: entityType,
        entity_code: entityCode,
        subject: subjectForSend,
        gmail_thread_id: sent.threadId,
        last_message_id: messageId,
        last_gmail_message_id: sent.id,
        references_header: nextReferences,
        last_sent_at: now,
        recipients: recipientsForStorage,
      },
      { onConflict: "user_email,gmail_account_id,entity_type,entity_code" },
    );

    if (threadError) {
      console.error("[gmail/send] Gmail aceptó el correo pero falló la persistencia del hilo", {
        attemptId: attempt.id,
        gmailMessageId: sent.id,
        threadId: sent.threadId,
        error: threadError,
      });
      const finalized = await updateAttempt(supabase, attempt.id, {
        status: "partial",
        from_email: account.google_email,
        gmail_thread_id: sent.threadId,
        gmail_message_id: sent.id,
        rfc_message_id: messageId,
        sent_at: now,
        last_error: "Gmail aceptó el correo, pero no se pudo guardar el hilo.",
      });
      if (finalized) attemptAlreadyFinalized = true;
      return sendResultResponse("partial", {
        message: "Gmail aceptó el correo, pero no se pudo guardar el hilo. No reintentes automáticamente; revisa Gmail antes de cualquier acción.",
        from: account.google_email,
        gmailMessageId: sent.id,
        threadId: sent.threadId,
        rfcMessageId: messageId,
      });
    }

    const attemptSaved = await updateAttempt(supabase, attempt.id, {
      status: "sent",
      from_email: account.google_email,
      gmail_thread_id: sent.threadId,
      gmail_message_id: sent.id,
      rfc_message_id: messageId,
      sent_at: now,
      last_error: null,
    });

    if (!attemptSaved) {
      return sendResultResponse("partial", {
        message: "Gmail aceptó el correo y el hilo se guardó, pero no se pudo confirmar el estado idempotente. No reintentes automáticamente; revisa Gmail antes de cualquier acción.",
        from: account.google_email,
        gmailMessageId: sent.id,
        threadId: sent.threadId,
        rfcMessageId: messageId,
        threadStatus: existingThread?.gmail_thread_id ? "continued" : "created",
      });
    }

    attemptAlreadyFinalized = true;

    const contactWarning = await rememberContacts(supabase, userEmail, [
      ...recipients.to,
      ...recipients.cc,
      ...recipients.bcc,
    ]);

    return sendResultResponse("success", {
      message: contactWarning || `Correo enviado desde ${account.google_email}. Las próximas actualizaciones continuarán el mismo hilo Gmail.`,
      from: account.google_email,
      gmailMessageId: sent.id,
      threadId: sent.threadId,
      rfcMessageId: messageId,
      threadStatus: existingThread?.gmail_thread_id ? "continued" : "created",
      warning: contactWarning,
    });
  } catch (error) {
    const publicError = toPublicError(error);
    if (pendingAttemptId && supabaseForAttempt && attemptAlreadyFinalized === false) {
      await updateAttempt(supabaseForAttempt, pendingAttemptId, {
        status: "failed",
        last_error: publicError instanceof Error ? publicError.message : "Fallo interno.",
      });
    }
    console.error("[gmail/send] fallo controlado", {
      status: publicError instanceof ApiError ? publicError.status : 500,
      message: publicError instanceof Error ? publicError.message : "error desconocido",
      error,
    });
    return jsonError(publicError);
  }
}
