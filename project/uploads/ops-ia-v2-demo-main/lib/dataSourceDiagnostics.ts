export type AppDataSource = "supabase" | "demo";

export type DataSourceSnapshot = {
  module: string;
  source: AppDataSource;
  count: number;
  warning?: string;
  userEmail?: string;
  updatedAt: string;
};

const STORAGE_KEY = "opsia:data-source-snapshot";
const EVENT_NAME = "opsia:data-source-updated";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function publishDataSourceSnapshot(snapshot: Omit<DataSourceSnapshot, "updatedAt">): void {
  if (!isBrowser()) return;
  const nextSnapshot: DataSourceSnapshot = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSnapshot));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextSnapshot }));
}

export function readDataSourceSnapshot(): DataSourceSnapshot | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as DataSourceSnapshot;
  } catch {
    return null;
  }
}

export function subscribeToDataSourceSnapshot(listener: (snapshot: DataSourceSnapshot | null) => void): () => void {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handleStorage = () => listener(readDataSourceSnapshot());
  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent<DataSourceSnapshot>;
    listener(customEvent.detail ?? readDataSourceSnapshot());
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(EVENT_NAME, handleCustomEvent);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(EVENT_NAME, handleCustomEvent);
  };
}

export function debugDataSourceLoad(payload: {
  module: string;
  source: AppDataSource;
  count: number;
  warning?: string;
  userEmail?: string;
  errorMessage?: string;
}): void {
  if (process.env.NODE_ENV === "production") return;

  console.debug(`[${payload.module}]`, {
    source: payload.source,
    count: payload.count,
    warning: payload.warning ?? "",
    userEmail: payload.userEmail ?? "",
    errorMessage: payload.errorMessage ?? "",
  });
}
