export type PersistenceOperation =
  | "workspace-read"
  | "workspace-write"
  | "workspace-realtime"
  | "conversation-read"
  | "conversation-write"
  | "memory-write";

export type PersistenceErrorCategory = "permission" | "network" | "unavailable" | "unknown";

export type PersistenceIssue = {
  operation: PersistenceOperation;
  category: PersistenceErrorCategory;
  userMessage: string;
};

export type PersistenceResult<T> =
  | { ok: true; data: T }
  | { ok: false; issue: PersistenceIssue };

const USER_MESSAGES: Record<PersistenceOperation, string> = {
  "workspace-read": "No se pudo recuperar la información compartida. Puedes continuar con la copia guardada en este dispositivo.",
  "workspace-write": "No se pudo sincronizar el espacio compartido. Tus cambios siguen guardados en este dispositivo.",
  "workspace-realtime": "La actualización en tiempo real está temporalmente interrumpida. La aplicación seguirá intentando recuperar los cambios.",
  "conversation-read": "No se pudo recuperar el historial guardado. Puedes continuar con la conversación actual.",
  "conversation-write": "La conversación sigue visible en este dispositivo, pero no pudo guardarse en el historial compartido.",
  "memory-write": "No se pudo guardar la memoria compartida. El contenido no se marcó como persistido.",
};

const recentLogs = new Map<string, number>();
const LOG_DEDUP_MS = 30_000;

function errorFingerprint(error: unknown): string {
  if (typeof error === "string") return error.toLowerCase();
  if (!error || typeof error !== "object") return "";

  const record = error as Record<string, unknown>;
  return [record.code, record.name, record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

function categorizePersistenceError(error: unknown): PersistenceErrorCategory {
  const fingerprint = errorFingerprint(error);

  if (
    fingerprint.includes("42501")
    || fingerprint.includes("permission")
    || fingerprint.includes("row-level security")
    || fingerprint.includes("row level security")
    || fingerprint.includes("not authorized")
    || fingerprint.includes("jwt")
  ) {
    return "permission";
  }

  if (
    fingerprint.includes("fetch")
    || fingerprint.includes("network")
    || fingerprint.includes("timeout")
    || fingerprint.includes("timed out")
    || fingerprint.includes("websocket")
  ) {
    return "network";
  }

  if (
    fingerprint.includes("not configured")
    || fingerprint.includes("unavailable")
    || fingerprint.includes("service unavailable")
  ) {
    return "unavailable";
  }

  return "unknown";
}

function logPersistenceIssue(issue: PersistenceIssue) {
  const key = `${issue.operation}:${issue.category}`;
  const now = Date.now();
  const lastLogged = recentLogs.get(key) ?? 0;
  if (now - lastLogged < LOG_DEDUP_MS) return;

  recentLogs.set(key, now);
  console.warn("[persistence]", {
    operation: issue.operation,
    category: issue.category,
  });
}

export function persistenceSuccess<T>(data: T): PersistenceResult<T> {
  return { ok: true, data };
}

export function persistenceFailure<T>(
  operation: PersistenceOperation,
  error: unknown
): PersistenceResult<T> {
  const issue: PersistenceIssue = {
    operation,
    category: categorizePersistenceError(error),
    userMessage: USER_MESSAGES[operation],
  };
  logPersistenceIssue(issue);
  return { ok: false, issue };
}
