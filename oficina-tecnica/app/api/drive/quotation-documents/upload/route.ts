import { NextRequest, NextResponse } from "next/server";
import {
  driveFileUrl,
  getGoogleDriveAccessToken,
  getOrCreateDriveFolder,
  safeDriveName,
  uploadDriveFile,
} from "@/lib/googleDrive/driveClient";
import { createQuotationFolderStructure } from "@/lib/googleDrive/quotationFolders";
import { findQuotationDocumentTarget } from "@/lib/googleDrive/quotationFolderStructure";
import { apiAuthErrorResponse, assertRateLimit, requireApprovedUser } from "@/lib/api/serverAuth";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

function formText(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function documentTypeForFolder(folderKey: string): string {
  if (folderKey === "clientDocuments") return "client_document";
  if (folderKey === "requirements") return "requirement";
  if (folderKey.startsWith("proposal")) return "proposal";
  if (folderKey === "supplierQuotes") return "supplier_quote";
  if (folderKey === "costAnalysis") return "cost_analysis";
  if (folderKey === "managementReview") return "management_review";
  if (folderKey === "clientDelivery") return "client_delivery";
  if (folderKey === "archive") return "archive";
  return "attachment";
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireApprovedUser(request);
    if (!authContext.isAdmin) {
      const checks = await Promise.all([
        authContext.supabase.rpc("can_use_module", { p_module: "cotizaciones", p_action: "upload" }),
        authContext.supabase.rpc("can_use_module", { p_module: "cotizaciones", p_action: "edit" }),
        authContext.supabase.rpc("can_use_module", { p_module: "cotizaciones", p_action: "create" }),
        authContext.supabase.rpc("can_use_module", { p_module: "requerimientos", p_action: "upload" }),
        authContext.supabase.rpc("can_use_module", { p_module: "requerimientos", p_action: "edit" }),
      ]);
      const firstError = checks.find((check) => check.error)?.error;
      if (firstError) throw firstError;
      if (!checks.some((check) => check.data === true)) {
        throw new Error("No tienes permiso para subir documentos de cotización.");
      }
    }
    assertRateLimit(`drive-quotation-documents:${authContext.userId}`, {
      limit: 40,
      windowMs: 10 * 60_000,
      label: "subida de documentos de cotización",
    });

    const form = await request.formData();
    const file = form.get("file");
    const quotationCode = formText(form, "quotationCode");
    const quotationId = formText(form, "quotationId");
    const requirementCode = formText(form, "requirementCode");
    const requirementId = formText(form, "requirementId");
    const folderKey = formText(form, "folderKey");
    const target = findQuotationDocumentTarget(folderKey);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No se recibió archivo." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "El archivo supera el límite de 50 MB." }, { status: 413 });
    }
    if (!quotationCode) {
      return NextResponse.json({ error: "Falta quotationCode." }, { status: 400 });
    }
    if (!target) {
      return NextResponse.json({ error: "Carpeta documental no soportada." }, { status: 400 });
    }

    const structure = await createQuotationFolderStructure(quotationCode);
    const accessToken = await getGoogleDriveAccessToken();
    const baseFolder = structure.folders[folderKey];
    if (!baseFolder?.id) {
      return NextResponse.json({ error: "No se encontró la carpeta destino en Drive." }, { status: 500 });
    }

    let driveFolderId = baseFolder.id;
    let folderName = target.label;
    if (folderKey === "requirements" && requirementCode) {
      const rqFolder = await getOrCreateDriveFolder(accessToken, baseFolder.id, safeDriveName(requirementCode), {
        quotationCode,
        requirementCode,
        key: "requirementDocumentFolder",
      });
      driveFolderId = rqFolder.id;
      folderName = `${target.label} / ${rqFolder.name}`;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const driveName = `${timestamp}_${safeDriveName(file.name)}`;
    const uploaded = await uploadDriveFile(
      accessToken,
      driveFolderId,
      file,
      driveName,
      `Oficina Técnica IA | ${quotationCode} | ${folderName}`,
    );

    const payload = {
      quotation_id: quotationId || null,
      quotation_code: quotationCode,
      requirement_id: requirementId || null,
      requirement_code: requirementCode || null,
      folder_key: folderKey,
      folder_name: folderName,
      drive_folder_id: driveFolderId,
      drive_file_id: uploaded.id,
      drive_file_url: uploaded.webViewLink ?? driveFileUrl(uploaded.id),
      original_name: file.name,
      drive_name: uploaded.name,
      mime_type: uploaded.mimeType || file.type || "application/octet-stream",
      file_size: Number(uploaded.size ?? file.size ?? 0),
      document_type: documentTypeForFolder(folderKey),
      uploaded_by: authContext.userId,
      uploaded_by_email: authContext.userEmail,
      metadata: {
        drive_structure_version: "cotizacion_drive_v2",
        root_folder_id: structure.rootFolder.id,
        root_folder_url: structure.rootFolder.url,
        target_folder_key: folderKey,
        target_folder_label: target.label,
      },
    };

    const { data, error } = await authContext.supabase
      .from("quotation_documents")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ document: data });
  } catch (error) {
    if (error instanceof Error && /sesión|aprobado|permiso|límite/i.test(error.message)) {
      return apiAuthErrorResponse(error);
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo subir el documento de la cotización a Google Drive.",
      },
      { status: 500 },
    );
  }
}
