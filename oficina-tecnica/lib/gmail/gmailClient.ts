const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

export const SYSTEM_GMAIL_ACCOUNT_ID = "__system_gmail__";

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function googleOAuthErrorMessage(data: { error?: string; error_description?: string }): string {
  if (data.error === "unauthorized_client") {
    return "Google rechazó el refresh token de Gmail porque no corresponde al Client ID/Secret configurado. Genera nuevamente GOOGLE_GMAIL_OAUTH_REFRESH_TOKEN usando el mismo OAuth Client de GOOGLE_GMAIL_OAUTH_CLIENT_ID/SECRET, o configura esas dos variables con el cliente exacto que usaste para generar el token.";
  }
  return data.error_description || data.error || "No se pudo conectar con Google.";
}

export function gmailOAuthClientId(): string {
  return process.env.GOOGLE_GMAIL_OAUTH_CLIENT_ID?.trim()
    || process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim()
    || env("GOOGLE_DRIVE_OAUTH_CLIENT_ID");
}

export function gmailOAuthClientSecret(): string {
  return process.env.GOOGLE_GMAIL_OAUTH_CLIENT_SECRET?.trim()
    || process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim()
    || env("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET");
}

export function gmailSystemRefreshToken(): string | null {
  return process.env.GOOGLE_GMAIL_OAUTH_REFRESH_TOKEN?.trim() || null;
}

export function gmailSystemSenderEmail(): string | null {
  return process.env.GOOGLE_GMAIL_SENDER_EMAIL?.trim()
    || process.env.GOOGLE_WORKSPACE_SENDER_EMAIL?.trim()
    || null;
}

export function gmailRedirectUri(origin: string): string {
  const explicitRedirect = process.env.GOOGLE_GMAIL_OAUTH_REDIRECT_URI?.trim();
  if (explicitRedirect) return explicitRedirect;
  return `${origin.replace(/\/$/, "")}/api/gmail/oauth/callback`;
}

export function buildGmailAuthUrl(origin: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", gmailOAuthClientId());
  url.searchParams.set("redirect_uri", gmailRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGmailCode(origin: string, code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: gmailOAuthClientId(),
      client_secret: gmailOAuthClientSecret(),
      redirect_uri: gmailRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(googleOAuthErrorMessage(data));
  return data;
}

export async function refreshGmailAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in?: number;
  scope?: string;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: gmailOAuthClientId(),
      client_secret: gmailOAuthClientSecret(),
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(googleOAuthErrorMessage(data));
  return data;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<{ email: string; name?: string }> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok || !data.email) throw new Error("No se pudo leer el correo de Google autorizado.");
  return { email: String(data.email), name: data.name ? String(data.name) : undefined };
}

export async function fetchGmailProfile(accessToken: string): Promise<{ emailAddress: string }> {
  const response = await fetch(GMAIL_PROFILE_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok || !data.emailAddress) {
    throw new Error(data.error?.message || "No se pudo leer el perfil Gmail de la cuenta origen.");
  }
  return { emailAddress: String(data.emailAddress) };
}

function base64Url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encodeHeader(value: string): string {
  return /[^\x20-\x7E]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`
    : value;
}

function normalizeEmails(value: string[] = []): string[] {
  return value.map((item) => item.trim()).filter(Boolean);
}

export function buildMimeMessage(input: {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html: string;
  messageId: string;
  inReplyTo?: string | null;
  references?: string | null;
}): string {
  const boundary = `oficina-tecnica-${Date.now().toString(36)}`;
  const headers = [
    `From: ${input.from}`,
    `To: ${normalizeEmails(input.to).join(", ")}`,
    normalizeEmails(input.cc).length ? `Cc: ${normalizeEmails(input.cc).join(", ")}` : "",
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Message-ID: ${input.messageId}`,
    input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : "",
    input.references ? `References: ${input.references}` : "",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);

  return [
    ...headers,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export async function sendGmailMessage(accessToken: string, input: {
  rawMime: string;
  threadId?: string | null;
}): Promise<{ id: string; threadId: string }> {
  const response = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      raw: base64Url(input.rawMime),
      ...(input.threadId ? { threadId: input.threadId } : {}),
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = String(data.error?.message || "");
    if (/gmail api has not been used|it is disabled/i.test(message)) {
      throw new Error(
        "La Gmail API no está habilitada en Google Cloud para este proyecto. Entra a https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=560615076744, presiona Enable/Habilitar y vuelve a intentar en unos minutos.",
      );
    }
    if (/insufficient authentication scopes/i.test(message)) {
      throw new Error(
        "La cuenta Gmail conectada no tiene permiso para enviar correos. Vuelve a conectar Gmail aceptando el permiso de envio, o genera un GOOGLE_GMAIL_OAUTH_REFRESH_TOKEN con el scope https://www.googleapis.com/auth/gmail.send.",
      );
    }
    throw new Error(message || "No se pudo enviar el correo por Gmail.");
  }
  return { id: data.id, threadId: data.threadId };
}
