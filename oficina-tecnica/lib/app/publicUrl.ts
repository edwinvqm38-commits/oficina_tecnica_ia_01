const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function safeConfiguredOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return "";
  const origin = trimTrailingSlash(configured);
  if (process.env.NODE_ENV === "production" && LOCALHOST_ORIGIN_PATTERN.test(origin)) return "";
  return origin;
}

export function getPublicAppOrigin(): string {
  const configured = safeConfiguredOrigin();
  if (configured) return configured;

  if (typeof window !== "undefined") {
    const browserOrigin = trimTrailingSlash(window.location.origin);
    if (process.env.NODE_ENV === "production" && LOCALHOST_ORIGIN_PATTERN.test(browserOrigin)) return "";
    return browserOrigin;
  }

  return process.env.NODE_ENV === "production" ? "" : "http://localhost:3000";
}

export function buildPublicAppUrl(path: string): string {
  const origin = getPublicAppOrigin();
  if (!origin) return path;
  return new URL(path, `${origin}/`).toString();
}
