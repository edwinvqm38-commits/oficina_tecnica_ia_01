import { NextRequest, NextResponse } from "next/server";
import { buildQuotationDriveMetadata, createQuotationFolderStructure } from "@/lib/googleDrive/quotationFolders";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { quotationCode?: unknown };
    const quotationCode = typeof body.quotationCode === "string" ? body.quotationCode : "";
    const structure = await createQuotationFolderStructure(quotationCode);
    const metadata = buildQuotationDriveMetadata(structure);

    return NextResponse.json({
      quotation_code: structure.quotationCode,
      drive: metadata,
      logs: structure.logs,
    });
  } catch (error) {
    console.error("[drive] error creando estructura de cotizacion", {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo crear la estructura Drive de la cotización.",
      },
      { status: 500 },
    );
  }
}
