import { NextRequest, NextResponse } from "next/server";
import { getGoogleDriveAccessToken } from "@/lib/googleDrive/driveClient";
import { type ApiUserContext, requireApprovedUser } from "@/lib/api/serverAuth";

export const runtime = "nodejs";

const DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

function isSafeDriveFileId(value: string): boolean {
  return /^[A-Za-z0-9_-]{10,}$/.test(value);
}

type InternalDriveFileMatch =
  | { source: "quotation_documents"; moduleKeys: Array<"cotizaciones" | "requerimientos"> }
  | { source: "recursos"; moduleKeys: ["recursos"] };

type QuotationDocumentRecord = {
  id: string;
  quotation_code: string;
  requirement_code: string | null;
};

type ResourceRecord = {
  id: string;
  codigo_recurso: string;
  metadata: unknown;
};

function authErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "No autorizado.";
  const status = /no hay sesión|sesión inválida|expirada/i.test(message) ? 401 : 403;
  return NextResponse.json({ error: message }, { status });
}

async function canViewModule(authContext: ApiUserContext, moduleKey: "cotizaciones" | "requerimientos" | "recursos"): Promise<boolean> {
  if (authContext.isAdmin) return true;
  const { data, error } = await authContext.supabase.rpc("can_use_module", {
    p_module: moduleKey,
    p_action: "view",
  });
  if (error) throw error;
  return data === true;
}

function driveFileIdFromUrl(value: string): string {
  const direct = value.match(/\/file\/d\/([^/?#]+)/i)?.[1];
  if (direct) return direct;
  try {
    const url = new URL(value);
    return url.searchParams.get("id") ?? "";
  } catch {
    return "";
  }
}

function metadataContainsDriveFileId(value: unknown, fileId: string): boolean {
  if (!value) return false;
  if (typeof value === "string") {
    return value === fileId || driveFileIdFromUrl(value) === fileId;
  }
  if (Array.isArray(value)) {
    return value.some((item) => metadataContainsDriveFileId(item, fileId));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const directId = record.drive_file_id ?? record.futureDriveFileId;
    const directUrl = record.drive_url ?? record.futureDriveUrl ?? record.drive_web_content_link;
    if (typeof directId === "string" && directId === fileId) return true;
    if (typeof directUrl === "string" && driveFileIdFromUrl(directUrl) === fileId) return true;
    return Object.values(record).some((item) => metadataContainsDriveFileId(item, fileId));
  }
  return false;
}

async function findQuotationDocument(authContext: ApiUserContext, fileId: string): Promise<InternalDriveFileMatch | null> {
  const canViewCotizaciones = await canViewModule(authContext, "cotizaciones");
  const canViewRequerimientos = await canViewModule(authContext, "requerimientos");
  if (!canViewCotizaciones && !canViewRequerimientos) return null;

  const { data, error } = await authContext.supabase
    .from("quotation_documents")
    .select("id, quotation_code, requirement_code")
    .eq("drive_file_id", fileId)
    .maybeSingle<QuotationDocumentRecord>();
  if (error) throw error;
  if (!data) return null;

  const moduleKeys: Array<"cotizaciones" | "requerimientos"> = data.requirement_code
    ? ["cotizaciones", "requerimientos"]
    : ["cotizaciones"];
  const isAuthorized = moduleKeys.some((moduleKey) =>
    moduleKey === "cotizaciones" ? canViewCotizaciones : canViewRequerimientos,
  );
  if (!isAuthorized) return null;
  return { source: "quotation_documents", moduleKeys };
}

async function findResourceFile(authContext: ApiUserContext, fileId: string): Promise<InternalDriveFileMatch | null> {
  const canViewRecursos = await canViewModule(authContext, "recursos");
  if (!canViewRecursos) return null;

  const pageSize = 500;
  for (let from = 0; from < 5_000; from += pageSize) {
    const { data, error } = await authContext.supabase
      .from("recursos")
      .select("id, codigo_recurso, metadata")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as ResourceRecord[];
    if (rows.some((row) => metadataContainsDriveFileId(row.metadata, fileId))) {
      return { source: "recursos", moduleKeys: ["recursos"] };
    }
    if (rows.length < pageSize) break;
  }
  return null;
}

async function findAuthorizedInternalFile(authContext: ApiUserContext, fileId: string): Promise<InternalDriveFileMatch | null> {
  return (await findQuotationDocument(authContext, fileId)) ?? (await findResourceFile(authContext, fileId));
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { fileId } = await context.params;
  const normalizedFileId = fileId.trim();

  if (!isSafeDriveFileId(normalizedFileId)) {
    return NextResponse.json({ error: "ID de archivo de Drive inválido." }, { status: 400 });
  }

  try {
    const authContext = await requireApprovedUser(request);
    const internalFile = await findAuthorizedInternalFile(authContext, normalizedFileId);
    if (!internalFile) {
      return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    }

    const accessToken = await getGoogleDriveAccessToken();
    const response = await fetch(`${DRIVE_API_URL}/${encodeURIComponent(normalizedFileId)}?alt=media&supportsAllDrives=true`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "No se pudo leer el archivo desde Google Drive." }, { status: response.status });
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof Error && /sesión|aprobado|permiso|límite/i.test(error.message)) {
      return authErrorResponse(error);
    }
    console.error("[drive-file-proxy] unexpected download failure", error);
    return NextResponse.json(
      { error: "No se pudo leer el archivo desde Google Drive." },
      { status: 500 },
    );
  }
}
