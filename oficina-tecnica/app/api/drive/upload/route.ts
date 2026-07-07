import { NextRequest, NextResponse } from "next/server";
import {
  driveFileUrl,
  getDriveRootFolderId,
  getGoogleDriveAccessToken,
  getOrCreateDriveFolder,
  safeDriveName,
  uploadDriveFile,
} from "@/lib/googleDrive/driveClient";
import { apiAuthErrorResponse, assertRateLimit, requireApprovedUser } from "@/lib/api/serverAuth";

export const runtime = "nodejs";

type DriveEntityType = "resource" | "quotation" | "requirement" | "technical_proposal";
type DriveFileCategory = "image" | "datasheet" | "attachment" | "quotation" | "requirement" | "technical";

const DRIVE_ENTITY_TYPES: DriveEntityType[] = ["resource", "quotation", "requirement", "technical_proposal"];
const DRIVE_FILE_CATEGORIES: DriveFileCategory[] = ["image", "datasheet", "attachment", "quotation", "requirement", "technical"];

function isDriveEntityType(value: string): value is DriveEntityType {
  return DRIVE_ENTITY_TYPES.includes(value as DriveEntityType);
}

function isDriveFileCategory(value: string): value is DriveFileCategory {
  return DRIVE_FILE_CATEGORIES.includes(value as DriveFileCategory);
}

function folderForEntity(entityType: DriveEntityType): string {
  if (entityType === "resource") return "01_RECURSOS";
  if (entityType === "quotation") return "02_COTIZACIONES";
  if (entityType === "requirement") return "03_REQUERIMIENTOS";
  return "04_PROPUESTAS_TECNICAS";
}

function folderForCategory(category: DriveFileCategory): string {
  if (category === "image") return "02_IMAGENES";
  if (category === "datasheet") return "01_FICHAS_TECNICAS";
  if (category === "quotation") return "04_COTIZACION";
  if (category === "requirement") return "02_REQUERIMIENTO";
  if (category === "technical") return "03_PROPUESTA_TECNICA";
  return "03_ARCHIVOS";
}

async function ensureEntityFolder(accessToken: string, entityType: DriveEntityType, entityCode: string, category: DriveFileCategory): Promise<string> {
  const rootFolderId = getDriveRootFolderId();
  const moduleFolder = await getOrCreateDriveFolder(accessToken, rootFolderId, folderForEntity(entityType), { entityType, entityCode });
  const entityFolder = await getOrCreateDriveFolder(accessToken, moduleFolder.id, safeDriveName(entityCode), { entityType, entityCode });
  const categoryFolder = await getOrCreateDriveFolder(accessToken, entityFolder.id, folderForCategory(category), {
    entityType,
    entityCode,
    category,
  });
  return categoryFolder.id;
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireApprovedUser(request, { moduleKey: "recursos", action: "upload" });
    assertRateLimit(`drive-upload:${authContext.userId}`, { limit: 30, windowMs: 10 * 60_000, label: "subida de archivos" });
    const form = await request.formData();
    const file = form.get("file");
    const entityTypeRaw = String(form.get("entityType") ?? "resource");
    const entityCodeRaw = String(form.get("entityCode") ?? "").trim();
    const categoryRaw = String(form.get("category") ?? "attachment");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No se recibió archivo." }, { status: 400 });
    }
    if (!entityCodeRaw) {
      return NextResponse.json({ error: "Falta código de entidad para crear carpeta en Drive." }, { status: 400 });
    }
    if (!isDriveEntityType(entityTypeRaw)) {
      return NextResponse.json({ error: "Tipo de entidad Drive no soportado." }, { status: 400 });
    }
    if (!isDriveFileCategory(categoryRaw)) {
      return NextResponse.json({ error: "Categoría de archivo Drive no soportada." }, { status: 400 });
    }

    const accessToken = await getGoogleDriveAccessToken();
    const entityCode = safeDriveName(entityCodeRaw);
    const entityType = entityTypeRaw;
    const category = categoryRaw;
    const folderId = await ensureEntityFolder(accessToken, entityType, entityCode, category);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const driveName = `${timestamp}_${safeDriveName(file.name)}`;
    const uploaded = await uploadDriveFile(accessToken, folderId, file, driveName, `Oficina Técnica IA | ${entityCode} | ${category}`);

    return NextResponse.json({
      file_id: uploaded.id,
      name: file.name,
      drive_name: uploaded.name,
      mime_type: uploaded.mimeType || file.type || "application/octet-stream",
      size: Number(uploaded.size ?? file.size ?? 0),
      folder_id: folderId,
      web_view_link: uploaded.webViewLink ?? driveFileUrl(uploaded.id),
      web_content_link: uploaded.webContentLink ?? null,
    });
  } catch (error) {
    if (error instanceof Error && /sesión|aprobado|permiso|límite/i.test(error.message)) {
      return apiAuthErrorResponse(error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir el archivo a Google Drive." },
      { status: 500 },
    );
  }
}
