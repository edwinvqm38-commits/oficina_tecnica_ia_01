import { NextRequest, NextResponse } from "next/server";
import {
  driveFileUrl,
  findDriveFolder,
  getDriveRootFolderId,
  getGoogleDriveAccessToken,
  listDriveFilesInFolder,
  safeDriveName,
} from "@/lib/googleDrive/driveClient";
import { apiAuthErrorResponse, requireApprovedUser } from "@/lib/api/serverAuth";

export const runtime = "nodejs";

type ResourceImageResult = {
  fileId: string;
  name: string;
  mimeType: string;
  webViewLink: string;
};

type ResourceImagesResponse = {
  images: Record<string, ResourceImageResult>;
};

function normalizeCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 80),
    ),
  );
}

export async function POST(request: NextRequest) {
  try {
    await requireApprovedUser(request, { moduleKey: "recursos", action: "view" });
    const body = (await request.json().catch(() => ({}))) as { resourceCodes?: unknown };
    const resourceCodes = normalizeCodes(body.resourceCodes);
    if (resourceCodes.length === 0) {
      return NextResponse.json<ResourceImagesResponse>({ images: {} });
    }

    const accessToken = await getGoogleDriveAccessToken();
    const rootFolderId = getDriveRootFolderId();
    const resourcesFolderId = await findDriveFolder(accessToken, rootFolderId, "01_RECURSOS");
    if (!resourcesFolderId) {
      return NextResponse.json<ResourceImagesResponse>({ images: {} });
    }

    const images: ResourceImagesResponse["images"] = {};
    await Promise.all(
      resourceCodes.map(async (resourceCode) => {
        const resourceFolderId = await findDriveFolder(accessToken, resourcesFolderId, safeDriveName(resourceCode));
        if (!resourceFolderId) return;
        const imageFolderId = await findDriveFolder(accessToken, resourceFolderId, "02_IMAGENES");
        if (!imageFolderId) return;
        const files = await listDriveFilesInFolder(accessToken, imageFolderId, "image/");
        const firstImage = files[0];
        if (!firstImage?.id) return;
        images[resourceCode] = {
          fileId: firstImage.id,
          name: firstImage.name,
          mimeType: firstImage.mimeType,
          webViewLink: firstImage.webViewLink ?? driveFileUrl(firstImage.id),
        };
      }),
    );

    return NextResponse.json<ResourceImagesResponse>({ images });
  } catch (error) {
    if (error instanceof Error && /sesión|aprobado|permiso|límite/i.test(error.message)) {
      return apiAuthErrorResponse(error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron resolver imágenes de recursos en Drive." },
      { status: 500 },
    );
  }
}
