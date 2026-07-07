import { NextRequest, NextResponse } from "next/server";
import { getGoogleDriveAccessToken } from "@/lib/googleDrive/driveClient";
import { apiAuthErrorResponse, requireApprovedUser } from "@/lib/api/serverAuth";

export const runtime = "nodejs";

const DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

function isSafeDriveFileId(value: string): boolean {
  return /^[A-Za-z0-9_-]{10,}$/.test(value);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { fileId } = await context.params;
  const normalizedFileId = fileId.trim();

  if (!isSafeDriveFileId(normalizedFileId)) {
    return NextResponse.json({ error: "ID de archivo de Drive inválido." }, { status: 400 });
  }

  try {
    await requireApprovedUser(request);
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
      return apiAuthErrorResponse(error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer el archivo desde Google Drive." },
      { status: 500 },
    );
  }
}
