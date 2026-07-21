"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type EmailThreadKind = "quotation" | "requirement";

type EmailThreadButtonProps = {
  kind: EmailThreadKind;
  entityCode: string;
  subject: string;
  title: string;
  linkPath: string;
  summaryRows: Array<{ label: string; value: string | number | null | undefined }>;
  buildPlainBody?: (context: EmailBodyBuilderContext) => string;
  buildHtmlBody?: (context: EmailBodyBuilderContext) => string;
  showHtmlPreview?: boolean;
  previewOnly?: boolean;
  disabled?: boolean;
  attachments?: Array<{ name: string; size?: number; type?: string; url?: string | null }>;
  className?: string;
  buttonLabel?: string;
};

type EmailBodyBuilderContext = {
  title: string;
  link: string;
  summaryRows: EmailThreadButtonProps["summaryRows"];
};

type GmailAccount = {
  id: string;
  google_email: string;
  display_name?: string | null;
  is_default?: boolean | null;
  is_system?: boolean | null;
};

type EmailContact = {
  id: string;
  email: string;
  name?: string | null;
};

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

function absoluteLink(path: string): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredBaseUrl) return new URL(path, configuredBaseUrl.replace(/\/$/, "")).toString();
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

function splitEmailList(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map((part) => part.trim())
    .filter(Boolean);
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

async function copyHtmlWithFallback(html: string, plain: string): Promise<void> {
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

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Inicia sesión en la aplicación antes de usar Gmail.");

  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la operación Gmail.");
  return payload as T;
}

export function EmailThreadButton({
  kind,
  entityCode,
  subject,
  title,
  linkPath,
  summaryRows,
  buildPlainBody: buildCustomPlainBody,
  buildHtmlBody: buildCustomHtmlBody,
  showHtmlPreview = false,
  previewOnly = false,
  disabled = false,
  attachments = [],
  className,
  buttonLabel = "Correo",
}: EmailThreadButtonProps) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [status, setStatus] = useState("");
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const link = useMemo(() => absoluteLink(linkPath), [linkPath]);
  const bodyContext = useMemo(() => ({ title, link, summaryRows }), [title, link, summaryRows]);
  const plainBody = useMemo(
    () => buildCustomPlainBody?.(bodyContext) ?? buildPlainBody(title, link, summaryRows),
    [bodyContext, buildCustomPlainBody, link, summaryRows, title],
  );
  const htmlBody = useMemo(
    () => buildCustomHtmlBody?.(bodyContext) ?? buildHtmlBody(title, link, summaryRows),
    [bodyContext, buildCustomHtmlBody, link, summaryRows, title],
  );
  const contactListId = useMemo(() => `email-contacts-${kind}-${entityCode}`, [kind, entityCode]);

  async function loadGmailData() {
    setIsLoading(true);
    try {
      const [accountsResponse, contactsResponse] = await Promise.all([
        authFetch<{ accounts: GmailAccount[]; systemError?: string | null }>("/api/gmail/accounts"),
        authFetch<{ contacts: EmailContact[] }>("/api/gmail/contacts"),
      ]);
      const nextAccounts = accountsResponse.accounts ?? [];
      setAccounts(nextAccounts);
      setContacts(contactsResponse.contacts ?? []);
      setSelectedAccountId((current) => {
        const currentStillExists = nextAccounts.some((account) => account.id === current);
        if (currentStillExists) return current;
        return nextAccounts.find((account) => account.is_default)?.id || nextAccounts[0]?.id || "";
      });
      if (accountsResponse.systemError && nextAccounts.length === 0) {
        setStatus(accountsResponse.systemError);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No pude leer la configuración Gmail.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (previewOnly) return;
    if (open) void loadGmailData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, previewOnly]);

  async function connectGmail() {
    setStatus("");
    try {
      const response = await authFetch<{ authUrl: string }>("/api/gmail/oauth/start", {
        method: "POST",
        body: JSON.stringify({ returnTo: window.location.href }),
      });
      window.location.href = response.authUrl;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No pude iniciar conexión con Gmail.");
    }
  }

  async function sendGmail() {
    setStatus("");
    const toList = splitEmailList(to);
    const ccList = splitEmailList(cc);
    if (!selectedAccountId) {
      setStatus("Conecta o selecciona una cuenta Gmail de origen.");
      return;
    }
    if (!toList.length) {
      setStatus("Agrega al menos un destinatario.");
      return;
    }

    setIsSending(true);
    try {
      const response = await authFetch<{ from: string; threadId: string }>("/api/gmail/send", {
        method: "POST",
        body: JSON.stringify({
          accountId: selectedAccountId,
          to: toList,
          cc: ccList,
          subject,
          plainBody,
          htmlBody,
          entityType: kind,
          entityCode,
        }),
      });
      setStatus(`Correo enviado desde ${response.from}. Las próximas actualizaciones usarán el mismo hilo Gmail.`);
      void loadGmailData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo enviar por Gmail.");
    } finally {
      setIsSending(false);
    }
  }

  async function copyHtml() {
    setStatus("");
    try {
      await copyHtmlWithFallback(htmlBody, plainBody);
      setStatus("HTML copiado. Puedes pegarlo en Gmail si necesitas enviarlo manualmente.");
    } catch {
      setStatus("No pude copiar el HTML. Revisa permisos del portapapeles del navegador.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={className}
        title={disabled ? "No hay recursos observados para preparar correo" : "Enviar correo en hilo"}
      >
        <span aria-hidden>✉</span>
        <span>{buttonLabel}</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[600px] rounded-lg border border-border bg-panel p-3 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[12px] font-semibold text-stone-800">
                  {previewOnly ? "Vista previa de correo HTML" : "Enviar correo por Gmail"}
                </p>
                <p className="text-[10.5px] text-stone-500">
                  {previewOnly
                    ? "Modo preview: no se consultan cuentas, contactos ni se envia Gmail real."
                    : "El asunto e hilo Gmail se mantienen por cotización o requerimiento."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setOpen(false); setStatus(""); }}
                className="rounded border border-stone-200 px-2 py-1 text-[11px] text-stone-600 hover:bg-stone-100"
              >
                Cerrar
              </button>
            </div>
            <div className="space-y-2">
              {!previewOnly ? (
                <>
                  <label className="block text-[11px] font-medium text-stone-600">
                    Correo origen
                    <div className="mt-1 flex gap-2">
                      <select
                        value={selectedAccountId}
                        onChange={(event) => setSelectedAccountId(event.target.value)}
                        className="h-8 min-w-0 flex-1 rounded border border-stone-200 bg-white px-2 text-[12px] outline-none focus:border-teal-500"
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
                        className="rounded border border-teal-700 bg-white px-3 text-[11px] font-semibold text-teal-700 hover:bg-teal-50"
                      >
                        {accounts.length ? "Cambiar" : "Conectar Gmail"}
                      </button>
                    </div>
                  </label>
                  <label className="block text-[11px] font-medium text-stone-600">
                    Destinatarios
                    <input
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                      placeholder="correo@empresa.com, otro@empresa.com"
                      list={contactListId}
                      className="mt-1 h-8 w-full rounded border border-stone-200 px-2 text-[12px] outline-none focus:border-teal-500"
                    />
                  </label>
                  <label className="block text-[11px] font-medium text-stone-600">
                    CC
                    <input
                      value={cc}
                      onChange={(event) => setCc(event.target.value)}
                      placeholder="opcional"
                      list={contactListId}
                      className="mt-1 h-8 w-full rounded border border-stone-200 px-2 text-[12px] outline-none focus:border-teal-500"
                    />
                  </label>
                  <datalist id={contactListId}>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.email}>
                        {contact.name || contact.email}
                      </option>
                    ))}
                  </datalist>
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
              {showHtmlPreview ? (
                <div className="block text-[11px] font-medium text-stone-600">
                  Vista previa HTML
                  <div className="mt-1 max-h-[240px] overflow-auto rounded border border-stone-200 bg-stone-50 p-2">
                    <div dangerouslySetInnerHTML={{ __html: htmlBody }} />
                  </div>
                </div>
              ) : null}
              {attachments.length ? (
                <div className="block text-[11px] font-medium text-stone-600">
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
            {!previewOnly && !accounts.length && !isLoading ? (
              <div className="mt-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-800">
                Conecta tu Gmail una vez. Después podrás elegirlo como origen y enviar desde la app.
              </div>
            ) : null}
            {status ? (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                {status}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void copyHtml()}
                className="rounded border border-stone-200 bg-white px-3 py-1.5 text-[11px] text-stone-700 hover:bg-stone-50"
              >
                Copiar HTML
              </button>
              {!previewOnly ? (
                <button
                  type="button"
                  onClick={() => void sendGmail()}
                  disabled={isSending || isLoading || !selectedAccountId}
                  className="rounded border border-teal-700 bg-teal-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSending ? "Enviando..." : "Enviar Gmail"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
