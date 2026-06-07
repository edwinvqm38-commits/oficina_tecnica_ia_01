import type { DataTableViewState } from "@/components/DataTable";

export type PersistedTableUiState = {
  page?: number;
  pageSize?: number;
  tableView?: DataTableViewState;
  quotationCode?: string | null;
  rqCode?: string | null;
};

export function readSessionUiState<T extends object>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    return { ...fallback, ...(parsed as Partial<T>) };
  } catch {
    return fallback;
  }
}

export function writeSessionUiState<T extends object>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures. The URL still carries the important deep-link ids.
  }
}

export function updateUrlState(params: Record<string, string | number | null | undefined>): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    const text = value === null || value === undefined ? "" : String(value).trim();
    if (text) {
      url.searchParams.set(key, text);
    } else {
      url.searchParams.delete(key);
    }
  });
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export function readUrlStringParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(key);
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readUrlNumberParam(key: string): number | null {
  const value = readUrlStringParam(key);
  if (!value) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

export function debugUiState(module: string, action: string, payload: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  console.debug(`[${module}] ui-state ${action}`, payload);
}

export function attachLifecycleDiagnostics(module: string): () => void {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return () => undefined;

  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  debugUiState(module, "navigation", {
    type: navigation?.type ?? "unknown",
    visibilityState: document.visibilityState,
  });

  const onVisibilityChange = () => {
    debugUiState(module, "document-visibilitychange", { visibilityState: document.visibilityState });
  };
  const onFocus = () => {
    debugUiState(module, "window-focus", { visibilityState: document.visibilityState });
  };
  const onPageHide = (event: PageTransitionEvent) => {
    debugUiState(module, "pagehide", { persisted: event.persisted });
  };
  const onPageShow = (event: PageTransitionEvent) => {
    debugUiState(module, "pageshow", { persisted: event.persisted });
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("focus", onFocus);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
  };
}
