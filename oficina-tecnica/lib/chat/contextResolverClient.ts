"use client";

import { authFetch } from "@/lib/api/authFetch";
import type { ContextPipelineResult } from "@/lib/chat/contextRouter";

export type ContextResolverResponse = {
  pipeline: ContextPipelineResult;
  deterministicAnswer: string | null;
};

export type ContextResolverErrorKind = "unauthorized" | "forbidden" | "bad_request" | "technical" | "timeout";

export class ContextResolverError extends Error {
  constructor(
    public readonly status: number,
    public readonly kind: ContextResolverErrorKind,
    public readonly safeMessage: string,
  ) {
    super(safeMessage);
    this.name = "ContextResolverError";
  }
}

export function contextResolverMessage(error: unknown): string {
  if (error instanceof ContextResolverError) return error.safeMessage;
  return "No pude resolver el contexto autorizado. Intenta nuevamente o acota la consulta.";
}

export function contextResolverTimeoutError(): ContextResolverError {
  return new ContextResolverError(
    0,
    "timeout",
    "La consulta de contexto tardó demasiado. No generé respuesta para evitar usar contexto incompleto.",
  );
}

function errorKindForStatus(status: number): ContextResolverErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status >= 400 && status < 500) return "bad_request";
  return "technical";
}

function safeMessageForStatus(status: number, fallback?: string): string {
  if (status === 401) return "Tu sesión no es válida o expiró. Vuelve a iniciar sesión para consultar este contexto.";
  if (status === 403) return "No tienes permiso para consultar ese contexto.";
  if (status >= 400 && status < 500) return fallback || "La consulta de contexto no es válida.";
  return "No pude resolver el contexto autorizado por un error técnico. Intenta nuevamente o acota la consulta.";
}

export async function resolveContextPipeline(query: string): Promise<ContextResolverResponse> {
  let response: Response;
  try {
    response = await authFetch("/api/context-resolver", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/sesión|session|inicia sesión|expir/i.test(message)) {
      throw new ContextResolverError(401, "unauthorized", safeMessageForStatus(401));
    }
    throw new ContextResolverError(0, "technical", safeMessageForStatus(500));
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const endpointMessage = typeof payload.error === "string" ? payload.error : undefined;
    throw new ContextResolverError(
      response.status,
      errorKindForStatus(response.status),
      safeMessageForStatus(response.status, endpointMessage),
    );
  }

  return payload as ContextResolverResponse;
}
