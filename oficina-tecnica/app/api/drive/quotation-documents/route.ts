import { NextRequest, NextResponse } from "next/server";
import { apiAuthErrorResponse, requireApprovedUser } from "@/lib/api/serverAuth";

export const runtime = "nodejs";

const DOCUMENT_SELECT = [
  "id",
  "quotation_id",
  "quotation_code",
  "requirement_id",
  "requirement_code",
  "folder_key",
  "folder_name",
  "drive_folder_id",
  "drive_file_id",
  "drive_file_url",
  "original_name",
  "drive_name",
  "mime_type",
  "file_size",
  "document_type",
  "uploaded_by",
  "uploaded_by_email",
  "uploaded_at",
  "metadata",
].join(", ");

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireApprovedUser(request, { moduleKey: "cotizaciones", action: "view" });
    const quotationCode = request.nextUrl.searchParams.get("quotationCode")?.trim() ?? "";
    const requirementCode = request.nextUrl.searchParams.get("requirementCode")?.trim() ?? "";

    if (!quotationCode) {
      return NextResponse.json({ error: "Falta quotationCode." }, { status: 400 });
    }

    let query = authContext.supabase
      .from("quotation_documents")
      .select(DOCUMENT_SELECT)
      .eq("quotation_code", quotationCode)
      .order("uploaded_at", { ascending: false })
      .limit(200);

    if (requirementCode) query = query.eq("requirement_code", requirementCode);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ documents: data ?? [] });
  } catch (error) {
    if (error instanceof Error && /sesión|aprobado|permiso|límite/i.test(error.message)) {
      return apiAuthErrorResponse(error);
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los documentos de la cotización.",
      },
      { status: 500 },
    );
  }
}
