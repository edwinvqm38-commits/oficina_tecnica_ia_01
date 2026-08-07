"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { authFetch } from "@/lib/api/authFetch";
import { buildPublicAppUrl } from "@/lib/app/publicUrl";
import { FieldLabelIcon } from "@/components/sgp/ui/FieldLabelIcon";

export type EmailThreadKind = "quotation" | "requirement";
export type EmailPurpose = "operational_request" | "management_report" | "observation_trace";

type EmailThreadButtonProps = {
  kind: EmailThreadKind;
  emailPurpose?: EmailPurpose;
  entityCode: string;
  subject: string;
  title: string;
  linkPath: string;
  summaryRows: Array<{ label: string; value: string | number | null | undefined }>;
  buildPlainBody?: (context: EmailBodyBuilderContext) => string;
  buildHtmlBody?: (context: EmailBodyBuilderContext) => string;
  showHtmlPreview?: boolean;
  previewOnly?: boolean;
  sendEnabled?: boolean;
  disabled?: boolean;
  attachments?: Array<{ name: string; size?: number; type?: string; url?: string | null }>;
  className?: string;
  buttonLabel?: string;
  disabledTitle?: string;
  modalTitle?: string;
  modalDescription?: string;
  sendButtonLabel?: string;
};

type EmailBodyBuilderContext = {
  title: string;
  link: string;
  summaryRows: EmailThreadButtonProps["summaryRows"];
  emailPurpose: EmailPurpose;
};

type GmailAccount = {
  id: string;
  google_email: string;
  display_name?: string | null;
  is_default?: boolean | null;
};

type EmailContact = {
  id: string;
  email: string;
  name?: string | null;
};

type ApprovedEmailUser = {
  id: string;
  email: string;
  full_name?: string | null;
};

type DirectoryOption = {
  id: string;
  email: string;
  label: string;
  source: "contact" | "user";
};

type RecipientField = "to" | "cc" | "bcc";

type ThreadState = {
  exists: boolean;
  threadId: string | null;
  gmailUrl: string | null;
  lastSentAt: string | null;
};

type StatusMessage = {
  kind: "info" | "success" | "error" | "warning" | "pending" | "partial";
  text: string;
};

type SendResponse = {
  ok: boolean;
  status?: "success" | "pending" | "partial";
  message?: string;
  from?: string | null;
  gmailMessageId?: string | null;
  threadId?: string | null;
  rfcMessageId?: string | null;
  gmailUrl?: string | null;
  threadStatus?: "created" | "continued";
  warning?: string | null;
  idempotentReplay?: boolean;
  shouldRetry?: boolean;
};

type ApiErrorPayload = {
  error?: string;
};

class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const EMAIL_PATTERN = /^[^\s@<>(),;]+@[^\s@<>(),;]+\.[^\s@<>(),;]+$/i;

function cleanPart(value: string | number | null | undefined, fallback = "-"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function escapeHtml(value: string | number | null | undefined): string {
  return cleanPart(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPlainBody(title: string, link: string, rows: EmailThreadButtonProps["summaryRows"]): string {
  const details = rows.map((row) => `${row.label}: ${cleanPart(row.value)}`).join("\n");
  return [
    "Hola,",
    "",
    `Se comparte ${title.toLowerCase()} para revisión/seguimiento.`,
    "",
    details,
    "",
    `Ingresar al registro: ${link}`,
    "",
    "Para mantener el historial, responder este mismo hilo conservando el asunto.",
  ].join("\n");
}

function buildHtmlBody(title: string, link: string, rows: EmailThreadButtonProps["summaryRows"]): string {
  const rowsHtml = rows
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 10px;border:1px solid #e5e7eb;background:#f8fafc;font-weight:600;">${escapeHtml(row.label)}</td>
          <td style="padding:8px 10px;border:1px solid #e5e7eb;">${escapeHtml(row.value)}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="padding:16px 20px;background:#0f766e;color:#ffffff;">
        <h2 style="margin:0;font-size:18px;">${escapeHtml(title)}</h2>
      </div>
      <div style="padding:18px 20px;">
        <p style="margin:0 0 14px;">Se comparte el registro para revisión y seguimiento.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">${rowsHtml}</table>
        <p style="margin:18px 0 0;">
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:6px;font-weight:600;">Ingresar al registro</a>
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Para mantener el historial, responder este mismo hilo conservando el asunto.</p>
      </div>
    </div>
  </body>
</html>`;
}

function splitEmailList(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function statusClassName(kind: StatusMessage["kind"]): string {
  if (kind === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (kind === "error") return "border-rose-200 bg-rose-50 text-rose-800";
  if (kind === "warning" || kind === "partial") return "border-amber-200 bg-amber-50 text-amber-800";
  if (kind === "pending") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await authFetch(path, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
  if (!response.ok) throw new ApiRequestError(response.status, payload.error || "No se pudo completar la operación Gmail.");
  return payload as T;
}

async function copyTextWithFallback(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export async function copyEmailHtmlWithFallback(html: string, plain: string): Promise<void> {
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await copyTextWithFallback(html);
}

function buildDirectoryOptions(contacts: EmailContact[], users: ApprovedEmailUser[]): DirectoryOption[] {
  const byEmail = new Map<string, DirectoryOption>();
  contacts.forEach((contact) => {
    const email = normalizeEmail(contact.email);
    if (!email || byEmail.has(email)) return;
    byEmail.set(email, {
      id: `contact-${contact.id}`,
      email,
      label: contact.name ? `${contact.name} · ${email}` : email,
      source: "contact",
    });
  });
  users.forEach((user) => {
    const email = normalizeEmail(user.email);
    if (!email || byEmail.has(email)) return;
    byEmail.set(email, {
      id: `user-${user.id}`,
      email,
      label: user.full_name ? `${user.full_name} · ${email}` : email,
      source: "user",
    });
  });
  return Array.from(byEmail.values()).sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
}

function RecipientInput({
  field,
  label,
  optional,
  values,
  draft,
  disabled,
  listId,
  onDraftChange,
  onCommit,
  onRemove,
}: {
  field: RecipientField;
  label: string;
  optional?: boolean;
  values: string[];
  draft: string;
  disabled: boolean;
  listId: string;
  onDraftChange: (field: RecipientField, value: string) => void;
  onCommit: (field: RecipientField) => void;
  onRemove: (field: RecipientField, email: string) => void;
}) {
  return (
    <label className="block text-[11px] font-medium text-stone-600">
      {label}
      {optional ? <span className="ml-1 font-normal text-stone-400">opcional</span> : null}
      <div className="mt-1 flex min-h-8 w-full flex-wrap items-center gap-1 rounded border border-stone-200 bg-white px-1.5 py-1 focus-within:border-teal-500">
        {values.map((email) => (
          <span
            key={`${field}-${email}`}
            className="inline-flex max-w-full items-center gap-1 rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[11px] font-semibold text-stone-700"
          >
            <span className="max-w-[220px] truncate">{email}</span>
            <button
              type="button"
              onClick={() => onRemove(field, email)}
              disabled={disabled}
              className="rounded px-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed"
              aria-label={`Retirar ${email}`}
              title={`Retirar ${email}`}
            >
              x
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => onDraftChange(field, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              onCommit(field);
            }
          }}
          onBlur={() => onCommit(field)}
          placeholder={values.length ? "" : "correo@empresa.com"}
          list={listId}
          disabled={disabled}
          className="h-6 min-w-[190px] flex-1 border-0 bg-transparent px-1 text-[12px] outline-none disabled:cursor-not-allowed"
        />
      </div>
    </label>
  );
}

export function EmailThreadButton({
  kind,
  emailPurpose = "operational_request",
  entityCode,
  subject,
  title,
  linkPath,
  summaryRows,
  buildPlainBody: buildCustomPlainBody,
  buildHtmlBody: buildCustomHtmlBody,
  showHtmlPreview = false,
  previewOnly = false,
  sendEnabled,
  disabled = false,
  attachments = [],
  className,
  buttonLabel = "Correo",
  disabledTitle,
  modalTitle,
  modalDescription,
  sendButtonLabel = "Enviar correo",
}: EmailThreadButtonProps) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<Record<RecipientField, string[]>>({ to: [], cc: [], bcc: [] });
  const [recipientDrafts, setRecipientDrafts] = useState<Record<RecipientField, string>>({ to: "", cc: "", bcc: "" });
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedEmailUser[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [threadState, setThreadState] = useState<ThreadState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null);
  const canSend = sendEnabled ?? !previewOnly;
  const link = useMemo(() => buildPublicAppUrl(linkPath), [linkPath]);
  const bodyContext = useMemo(() => ({ title, link, summaryRows, emailPurpose }), [emailPurpose, title, link, summaryRows]);
  const plainBody = useMemo(
    () => buildCustomPlainBody?.(bodyContext) ?? buildPlainBody(title, link, summaryRows),
    [bodyContext, buildCustomPlainBody, link, summaryRows, title],
  );
  const htmlBody = useMemo(
    () => buildCustomHtmlBody?.(bodyContext) ?? buildHtmlBody(title, link, summaryRows),
    [bodyContext, buildCustomHtmlBody, link, summaryRows, title],
  );
  const contactListId = useMemo(() => `email-contacts-${kind}-${entityCode}`, [kind, entityCode]);
  const modalTitleId = `email-modal-title-${kind}-${entityCode}`;
  const directoryOptions = useMemo(() => buildDirectoryOptions(contacts, approvedUsers), [approvedUsers, contacts]);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;
  const threadLabel = threadState?.exists
    ? "Continuará el hilo existente de este requerimiento"
    : isLoadingThread
      ? "Consultando hilo Gmail..."
      : "Se creará un nuevo hilo";

  const loadThreadState = useCallback(async (accountId: string, options?: { preserveStatus?: boolean }) => {
    setIsLoadingThread(true);
    try {
      const params = new URLSearchParams({
        accountId,
        entityType: kind,
        entityCode,
        emailPurpose,
      });
      const response = await authJson<ThreadState>(`/api/gmail/send?${params.toString()}`);
      setThreadState(response);
    } catch (error) {
      setThreadState(null);
      if (!options?.preserveStatus) {
        setStatus({
          kind: "warning",
          text: error instanceof Error ? error.message : "No se pudo consultar el hilo Gmail.",
        });
      }
    } finally {
      setIsLoadingThread(false);
    }
  }, [emailPurpose, entityCode, kind]);

  async function loadGmailData(options?: { preserveStatus?: boolean }) {
    setIsLoading(true);
    if (!options?.preserveStatus) setStatus(null);
    try {
      const [accountsResponse, contactsResponse] = await Promise.all([
        authJson<{ accounts: GmailAccount[]; systemError?: string | null }>("/api/gmail/accounts"),
        authJson<{ contacts: EmailContact[]; users?: ApprovedEmailUser[] }>("/api/gmail/contacts"),
      ]);
      const nextAccounts = accountsResponse.accounts ?? [];
      setAccounts(nextAccounts);
      setContacts(contactsResponse.contacts ?? []);
      setApprovedUsers(contactsResponse.users ?? []);
      setSelectedAccountId((current) => {
        const currentStillExists = nextAccounts.some((account) => account.id === current);
        if (currentStillExists) return current;
        return nextAccounts.find((account) => account.is_default)?.id || nextAccounts[0]?.id || "";
      });
      if (nextAccounts.length === 0 && !options?.preserveStatus) {
        setStatus({ kind: "info", text: "Conecta tu Gmail para poder enviar desde la app." });
      }
    } catch (error) {
      if (!options?.preserveStatus) {
        setStatus({ kind: "error", text: error instanceof Error ? error.message : "No pude leer la configuración Gmail." });
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!canSend) return;
    if (!open) return;
    const timer = window.setTimeout(() => {
      void loadGmailData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, canSend]);

  useEffect(() => {
    if (!open || !canSend || !selectedAccountId) return;
    const timer = window.setTimeout(() => {
      void loadThreadState(selectedAccountId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, canSend, selectedAccountId, loadThreadState]);

  async function connectGmail() {
    setStatus(null);
    try {
      const response = await authJson<{ authUrl: string }>("/api/gmail/oauth/start", {
        method: "POST",
        body: JSON.stringify({ returnTo: window.location.href }),
      });
      window.location.href = response.authUrl;
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "No pude iniciar conexión con Gmail." });
    }
  }

  function removeRecipient(field: RecipientField, email: string) {
    setRecipients((current) => ({
      ...current,
      [field]: current[field].filter((item) => item !== email),
    }));
    idempotencyRef.current = null;
  }

  function allRecipientEmails(current = recipients): string[] {
    return [...current.to, ...current.cc, ...current.bcc];
  }

  function addRecipient(field: RecipientField, rawEmail: string): boolean {
    const email = normalizeEmail(rawEmail);
    if (!email) return true;
    if (!EMAIL_PATTERN.test(email)) {
      setStatus({ kind: "error", text: `Correo inválido: ${email}` });
      return false;
    }
    if (allRecipientEmails().includes(email)) {
      setStatus({ kind: "warning", text: `El correo ${email} ya está agregado en otro campo.` });
      return false;
    }
    setRecipients((current) => ({ ...current, [field]: [...current[field], email] }));
    setStatus(null);
    idempotencyRef.current = null;
    return true;
  }

  function changeRecipientDraft(field: RecipientField, value: string) {
    if (value.includes(",") || value.includes(";") || value.includes("\n")) {
      const parts = splitEmailList(value);
      const tail = /[,;\n]\s*$/.test(value) ? "" : parts.pop() ?? "";
      parts.forEach((part) => addRecipient(field, part));
      setRecipientDrafts((current) => ({ ...current, [field]: tail }));
      return;
    }
    setRecipientDrafts((current) => ({ ...current, [field]: value }));
  }

  function commitRecipientDraft(field: RecipientField) {
    const parts = splitEmailList(recipientDrafts[field]);
    if (!parts.length) return;
    const accepted = parts.every((part) => addRecipient(field, part));
    if (accepted) setRecipientDrafts((current) => ({ ...current, [field]: "" }));
  }

  function currentSendSignature(nextRecipients = recipients): string {
    return JSON.stringify({
      accountId: selectedAccountId,
      to: nextRecipients.to,
      cc: nextRecipients.cc,
      bcc: nextRecipients.bcc,
      subject,
      plainBody,
      htmlBody,
      kind,
      emailPurpose,
      entityCode,
    });
  }

  function prepareRecipientsForSend(): Record<RecipientField, string[]> | null {
    const next: Record<RecipientField, string[]> = {
      to: [...recipients.to],
      cc: [...recipients.cc],
      bcc: [...recipients.bcc],
    };
    const seen = new Map<string, RecipientField>();

    (Object.entries(next) as Array<[RecipientField, string[]]>).forEach(([field, emails]) => {
      emails.forEach((email) => seen.set(email, field));
    });

    for (const field of ["to", "cc", "bcc"] as RecipientField[]) {
      for (const rawPart of splitEmailList(recipientDrafts[field])) {
        const email = normalizeEmail(rawPart);
        if (!email) continue;
        if (!EMAIL_PATTERN.test(email)) {
          setStatus({ kind: "error", text: `Correo inválido: ${email}` });
          return null;
        }
        const duplicateField = seen.get(email);
        if (duplicateField) {
          setStatus({ kind: "warning", text: `El correo ${email} ya está en ${duplicateField.toUpperCase()}.` });
          return null;
        }
        next[field].push(email);
        seen.set(email, field);
      }
    }

    setRecipients(next);
    setRecipientDrafts({ to: "", cc: "", bcc: "" });
    return next;
  }

  function getIdempotencyKey(nextRecipients = recipients): string {
    const signature = currentSendSignature(nextRecipients);
    if (idempotencyRef.current?.signature === signature) return idempotencyRef.current.key;
    const key = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    idempotencyRef.current = { signature, key };
    return key;
  }

  async function sendGmail() {
    setStatus(null);
    const recipientsForSend = prepareRecipientsForSend();
    if (!recipientsForSend) return;
    const toList = recipientsForSend.to;
    if (!canSend) {
      setStatus({ kind: "warning", text: "Este modo es solo de vista previa; no envía correos reales." });
      return;
    }
    if (!selectedAccountId) {
      setStatus({ kind: "error", text: "Conecta o selecciona una cuenta Gmail de origen." });
      return;
    }
    if (!toList.length) {
      setStatus({ kind: "error", text: "Agrega al menos un destinatario en Para." });
      return;
    }
    if (isSending) return;

    setIsSending(true);
    try {
      const response = await authJson<SendResponse>("/api/gmail/send", {
        method: "POST",
        body: JSON.stringify({
          accountId: selectedAccountId,
          to: recipientsForSend.to,
          cc: recipientsForSend.cc,
          bcc: recipientsForSend.bcc,
          subject,
          plainBody,
          htmlBody,
          entityType: kind,
          entityCode,
          emailPurpose,
          idempotencyKey: getIdempotencyKey(recipientsForSend),
        }),
      });
      if (response.threadId) {
        setThreadState({
          exists: true,
          threadId: response.threadId,
          gmailUrl: response.gmailUrl ?? null,
          lastSentAt: new Date().toISOString(),
        });
      }

      if (response.status === "pending") {
        setStatus({
          kind: "pending",
          text: response.message || "El envío continúa en proceso. No reintentes automáticamente.",
        });
        return;
      }

      if (response.status === "partial") {
        setStatus({
          kind: "partial",
          text: response.message || "El resultado del envío es incierto. No reintentes automáticamente; revisa Gmail.",
        });
        return;
      }

      setStatus({
        kind: response.warning ? "warning" : "success",
        text: response.message
          || (response.idempotentReplay
            ? "Este envío ya estaba registrado; no se volvió a enviar por Gmail."
            : `Correo enviado desde ${response.from ?? "Gmail"}. Las próximas actualizaciones continuarán el mismo hilo Gmail.`),
      });
      void Promise.all([
        loadGmailData({ preserveStatus: true }),
        loadThreadState(selectedAccountId, { preserveStatus: true }),
      ]);
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "No se pudo enviar por Gmail." });
    } finally {
      setIsSending(false);
    }
  }

  async function copyHtml() {
    setStatus(null);
    try {
      await copyEmailHtmlWithFallback(htmlBody, plainBody);
      setStatus({ kind: "success", text: "HTML copiado. Puedes pegarlo en Gmail si necesitas enviarlo manualmente." });
    } catch {
      setStatus({ kind: "error", text: "No pude copiar el HTML. Revisa permisos del portapapeles del navegador." });
    }
  }

  function closeModal() {
    setOpen(false);
    setStatus(null);
    setIsPreviewFullscreen(false);
  }

  const modal = open ? (
    <div className="fixed inset-0 z-[120] isolate flex items-center justify-center overflow-hidden bg-black/30 p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        className={`relative z-10 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-xl ${
          isPreviewFullscreen
            ? "h-[96vh] max-h-[96vh] w-[98vw] max-w-[98vw]"
            : "h-[90vh] max-h-[90vh] w-[calc(100vw-1rem)] max-w-[1180px] md:min-w-[760px] sm:w-[92vw]"
        }`}
      >
        <div className="flex flex-none items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0">
            <p id={modalTitleId} className="truncate text-[12px] font-semibold text-stone-800">
              {modalTitle || "Vista previa de correo HTML"}
            </p>
            <p className="truncate text-[10.5px] text-stone-500">
              {modalDescription ||
                (canSend
                  ? "El remitente es una cuenta Gmail conectada del usuario autenticado."
                  : "Modo preview: no se consultan cuentas, contactos ni se envia Gmail real.")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {showHtmlPreview ? (
              <button
                type="button"
                onClick={() => setIsPreviewFullscreen((current) => !current)}
                className="inline-flex h-7 items-center gap-1.5 rounded border border-stone-200 bg-white px-2 text-[11px] font-medium text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                aria-label={isPreviewFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                title={isPreviewFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              >
                <FieldLabelIcon icon="layout-grid" label={isPreviewFullscreen ? "Salir de pantalla completa" : "Pantalla completa"} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeModal}
              disabled={isSending}
              className="h-7 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Cerrar"
              title="Cerrar"
            >
              Cerrar
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
          <div className="flex-none space-y-2">
            {canSend ? (
              <>
                <label className="block text-[11px] font-medium text-stone-600">
                  De
                  <div className="mt-1 flex gap-2">
                    <select
                      value={selectedAccountId}
                      onChange={(event) => setSelectedAccountId(event.target.value)}
                      disabled={isLoading || isSending}
                      className="h-8 min-w-0 flex-1 rounded border border-stone-200 bg-white px-2 text-[12px] outline-none focus:border-teal-500 disabled:cursor-not-allowed disabled:bg-stone-50"
                    >
                      {accounts.length ? (
                        accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.display_name || account.google_email} · {account.google_email}
                          </option>
                        ))
                      ) : (
                        <option value="">Sin Gmail conectado</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => void connectGmail()}
                      disabled={isSending}
                      className="rounded border border-teal-700 bg-white px-3 text-[11px] font-semibold text-teal-700 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {accounts.length ? "Cambiar" : "Conectar Gmail"}
                    </button>
                  </div>
                </label>
                <RecipientInput
                  field="to"
                  label="Para"
                  values={recipients.to}
                  draft={recipientDrafts.to}
                  disabled={isSending}
                  listId={contactListId}
                  onDraftChange={changeRecipientDraft}
                  onCommit={commitRecipientDraft}
                  onRemove={removeRecipient}
                />
                <button
                  type="button"
                  onClick={() => setShowCcBcc((current) => !current)}
                  disabled={isSending}
                  className="text-[11px] font-semibold text-teal-700 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showCcBcc ? "Ocultar CC/CCO" : "Mostrar CC/CCO"}
                </button>
                {showCcBcc ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <RecipientInput
                      field="cc"
                      label="CC"
                      optional
                      values={recipients.cc}
                      draft={recipientDrafts.cc}
                      disabled={isSending}
                      listId={contactListId}
                      onDraftChange={changeRecipientDraft}
                      onCommit={commitRecipientDraft}
                      onRemove={removeRecipient}
                    />
                    <RecipientInput
                      field="bcc"
                      label="CCO"
                      optional
                      values={recipients.bcc}
                      draft={recipientDrafts.bcc}
                      disabled={isSending}
                      listId={contactListId}
                      onDraftChange={changeRecipientDraft}
                      onCommit={commitRecipientDraft}
                      onRemove={removeRecipient}
                    />
                  </div>
                ) : null}
                <datalist id={contactListId}>
                  {directoryOptions.map((option) => (
                    <option key={option.id} value={option.email}>
                      {option.label} · {option.source === "user" ? "usuario" : "contacto"}
                    </option>
                  ))}
                </datalist>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-stone-200 bg-stone-50 px-2 py-1.5 text-[11px]">
                  <span className="font-semibold text-stone-700">{threadLabel}</span>
                  {selectedAccount ? <span className="text-stone-500">Desde {selectedAccount.google_email}</span> : null}
                </div>
              </>
            ) : null}
            <label className="block text-[11px] font-medium text-stone-600">
              Asunto
              <input value={subject} readOnly className="mt-1 h-8 w-full rounded border border-stone-200 bg-stone-50 px-2 text-[12px]" />
            </label>
            <label className="block text-[11px] font-medium text-stone-600">
              Link
              <input value={link} readOnly className="mt-1 h-8 w-full rounded border border-stone-200 bg-stone-50 px-2 text-[12px]" />
            </label>
          </div>
          {showHtmlPreview ? (
            <div className="flex min-h-0 flex-1 flex-col text-[11px] font-medium text-stone-600">
              <div className="flex-none">Vista previa HTML</div>
              <div className="relative z-0 mt-1 flex min-h-[280px] flex-1 overflow-hidden rounded border border-stone-200 bg-white md:min-h-[500px]">
                <iframe
                  title={`Vista previa HTML - ${title}`}
                  srcDoc={htmlBody}
                  sandbox=""
                  className="relative z-0 h-full w-full border-0 bg-white"
                />
              </div>
            </div>
          ) : null}
          {attachments.length ? (
            <div className="flex-none text-[11px] font-medium text-stone-600">
              Adjuntos preparados
              <div className="mt-1 max-h-[110px] overflow-auto rounded border border-stone-200 bg-white">
                {attachments.map((attachment, index) => (
                  <div key={`${attachment.name}-${index}`} className="border-b border-stone-100 px-2 py-1.5 last:border-b-0">
                    <p className="truncate text-[11px] font-semibold text-stone-700" title={attachment.name}>
                      {attachment.name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-stone-500">
                      {attachment.type || "archivo"}
                      {attachment.size ? ` · ${Math.ceil(attachment.size / 1024)} KB` : ""}
                      {attachment.url ? " · Drive" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {status ? (
          <div
            className={`mx-3 mb-3 flex-none rounded border px-3 py-2 text-[11px] leading-relaxed ${statusClassName(status.kind)}`}
            aria-live="polite"
          >
            {status.text}
          </div>
        ) : null}
        <div className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-2">
          {threadState?.gmailUrl ? (
            <a
              href={threadState.gmailUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-stone-200 bg-white px-3 py-1.5 text-[11px] text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              Abrir en Gmail
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void copyHtml()}
            disabled={isSending}
            className="rounded border border-stone-200 bg-white px-3 py-1.5 text-[11px] text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Copiar HTML
          </button>
          {canSend ? (
            <button
              type="button"
              onClick={() => void sendGmail()}
              disabled={isSending || isLoading || !selectedAccountId}
              className="inline-flex items-center gap-2 rounded border border-teal-700 bg-teal-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> : null}
              {isSending ? "Enviando..." : sendButtonLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;
  const portalRoot = typeof document === "undefined" ? null : document.body;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={className}
        title={disabled ? disabledTitle || "No hay recursos observados para preparar correo" : "Enviar correo en hilo"}
      >
        <span aria-hidden>✉</span>
        <span>{buttonLabel}</span>
      </button>
      {portalRoot && modal ? createPortal(modal, portalRoot) : null}
    </>
  );
}
