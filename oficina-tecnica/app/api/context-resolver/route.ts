import { NextRequest, NextResponse } from "next/server";
import { apiAuthErrorResponse, assertRateLimit, requireApprovedUser } from "@/lib/api/serverAuth";
import { buildDeterministicAnswerFromResults, runContextPipeline } from "@/lib/chat/contextRouter";
import type { ContextPermissions, ContextSensitivePermissions } from "@/lib/chat/contextTools";
import type { SupabaseClient } from "@supabase/supabase-js";

type ContextResolverBody = {
  query?: unknown;
};

type PermissionRow = {
  module_key: keyof ContextPermissions;
  can_view: boolean | null;
  can_view_prices: boolean | null;
  can_view_supplier: boolean | null;
  metadata: Record<string, unknown> | null;
};

const MAX_CONTEXT_QUERY_LENGTH = 4_000;

const CONTEXT_MODULE_KEYS: Array<keyof ContextPermissions> = [
  "cotizaciones",
  "requerimientos",
  "detalle_rq",
  "recursos",
  "technical_proposals",
];

const ALLOW_SENSITIVE: ContextSensitivePermissions = {
  can_view: true,
  can_view_prices: true,
  can_view_supplier: true,
  can_view_margin: true,
};

function readCanViewMargin(moduleKey: keyof ContextPermissions, metadata: Record<string, unknown> | null): boolean {
  if (moduleKey !== "cotizaciones") return false;
  const moduleSensitive = metadata?.module_sensitive_permissions;
  if (!moduleSensitive || typeof moduleSensitive !== "object" || Array.isArray(moduleSensitive)) return false;
  const cotizaciones = (moduleSensitive as Record<string, unknown>).cotizaciones;
  if (!cotizaciones || typeof cotizaciones !== "object" || Array.isArray(cotizaciones)) return false;
  return (cotizaciones as Record<string, unknown>).can_view_margin === true;
}

function contextResolverErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (/límite temporal|permiso|sesión|session|no hay sesión|inválida|expirada|aprobado/i.test(message)) {
    return apiAuthErrorResponse(error);
  }
  return NextResponse.json({ error: "No se pudo resolver el contexto." }, { status: 500 });
}

async function readContextPermissions(
  supabase: SupabaseClient,
  userEmail: string,
  isAdmin: boolean,
): Promise<ContextPermissions> {
  if (isAdmin) {
    return Object.fromEntries(CONTEXT_MODULE_KEYS.map((key) => [key, ALLOW_SENSITIVE])) as ContextPermissions;
  }

  const { data, error } = await supabase
    .from("admin_module_permissions")
    .select("module_key,can_view,can_view_prices,can_view_supplier,metadata")
    .ilike("user_email", userEmail)
    .in("module_key", CONTEXT_MODULE_KEYS);

  if (error) throw new Error("No se pudieron validar permisos de contexto.");

  const permissions: ContextPermissions = {};
  for (const row of (data ?? []) as PermissionRow[]) {
    permissions[row.module_key] = {
      can_view: row.can_view === true,
      can_view_prices: row.can_view_prices === true,
      can_view_supplier: row.can_view_supplier === true,
      can_view_margin: readCanViewMargin(row.module_key, row.metadata),
    };
  }
  return permissions;
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireApprovedUser(request, { moduleKey: "chat", action: "view" });
    assertRateLimit(`context-resolver:${authContext.userId}`, { limit: 80, windowMs: 60_000, label: "contexto IA" });

    const body = (await request.json().catch(() => ({}))) as ContextResolverBody;
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ error: "Consulta vacía." }, { status: 400 });
    }
    if (query.length > MAX_CONTEXT_QUERY_LENGTH) {
      return NextResponse.json({ error: `Consulta demasiado larga. Máximo ${MAX_CONTEXT_QUERY_LENGTH} caracteres.` }, { status: 400 });
    }

    const permissions = await readContextPermissions(authContext.supabase, authContext.userEmail, authContext.isAdmin);
    const pipeline = await runContextPipeline(query, { supabase: authContext.supabase, permissions });
    const deterministicAnswer = buildDeterministicAnswerFromResults(query, pipeline.results);

    return NextResponse.json({ pipeline, deterministicAnswer });
  } catch (error) {
    return contextResolverErrorResponse(error);
  }
}
