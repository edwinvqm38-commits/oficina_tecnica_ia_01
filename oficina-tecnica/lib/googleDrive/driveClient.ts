import { createSign } from "crypto";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DRIVE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

export type DriveFolderEnsureResult = {
  id: string;
  name: string;
  url: string;
  status: "created" | "reused";
};

export type DriveUploadedFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
  parents?: string[];
};

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

export function getDriveRootFolderId(): string {
  return env("GOOGLE_DRIVE_ROOT_FOLDER_ID") || "1tuD18oZzxUTP2iZnrYd9duRd03W4a4ZF";
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function safeDriveName(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "SIN-CODIGO"
  );
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function getGoogleDriveAccessToken(): Promise<string> {
  const oauthRefreshToken = env("GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN");
  if (oauthRefreshToken) {
    const clientId = env("GOOGLE_DRIVE_OAUTH_CLIENT_ID");
    const clientSecret = env("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("Faltan GOOGLE_DRIVE_OAUTH_CLIENT_ID o GOOGLE_DRIVE_OAUTH_CLIENT_SECRET para usar OAuth de Drive.");
    }

    const response = await fetch(DRIVE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: oauthRefreshToken,
        grant_type: "refresh_token",
      }),
    });
    const json = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
    if (!response.ok || !json.access_token) {
      throw new Error(json.error_description || json.error || "No se pudo autenticar con Google Drive por OAuth.");
    }
    return json.access_token;
  }

  const clientEmail = env("GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = normalizePrivateKey(env("GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY"));
  if (!clientEmail || !privateKey) {
    throw new Error("Faltan GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL o GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: DRIVE_SCOPE,
      aud: DRIVE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const response = await fetch(DRIVE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "No se pudo autenticar con Google Drive.");
  }
  return json.access_token;
}

export async function driveFetch<T>(accessToken: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  const json = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    const message = json.error?.message || "Google Drive rechazó la operacion.";
    if (message.toLowerCase().includes("service accounts do not have storage quota")) {
      throw new Error(
        "Google Drive rechazó la subida porque el service account no tiene cuota de almacenamiento. Configura OAuth de Drive con GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET y GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN, o usa un Shared Drive de Google Workspace.",
      );
    }
    throw new Error(message);
  }
  return json;
}

export async function findDriveFolder(accessToken: string, parentId: string, name: string): Promise<string | null> {
  const query = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `'${escapeDriveQuery(parentId)}' in parents`,
    `name = '${escapeDriveQuery(name)}'`,
  ].join(" and ");
  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    pageSize: "1",
  });
  const result = await driveFetch<{ files?: Array<{ id: string; name: string }> }>(accessToken, `${DRIVE_API_URL}?${params}`);
  return result.files?.[0]?.id ?? null;
}

export async function listDriveFilesInFolder(
  accessToken: string,
  parentId: string,
  mimePrefix?: string,
): Promise<DriveUploadedFile[]> {
  const query = [`'${escapeDriveQuery(parentId)}' in parents`, "trashed = false"];
  if (mimePrefix) query.push(`mimeType contains '${escapeDriveQuery(mimePrefix)}'`);
  const params = new URLSearchParams({
    q: query.join(" and "),
    fields: "files(id,name,mimeType,webViewLink,webContentLink,size,parents)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    orderBy: "createdTime desc",
    pageSize: "10",
  });
  const result = await driveFetch<{ files?: DriveUploadedFile[] }>(accessToken, `${DRIVE_API_URL}?${params}`);
  return result.files ?? [];
}

export async function createDriveFolder(accessToken: string, parentId: string, name: string): Promise<string> {
  const result = await driveFetch<{ id: string }>(accessToken, `${DRIVE_API_URL}?supportsAllDrives=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  return result.id;
}

export async function getOrCreateDriveFolder(
  accessToken: string,
  parentId: string,
  name: string,
  logContext?: Record<string, unknown>,
): Promise<DriveFolderEnsureResult> {
  const existingId = await findDriveFolder(accessToken, parentId, name);
  if (existingId) {
    console.info("[drive] carpeta reutilizada", { name, id: existingId, parentId, ...logContext });
    return { id: existingId, name, url: driveFolderUrl(existingId), status: "reused" };
  }

  const id = await createDriveFolder(accessToken, parentId, name);
  console.info("[drive] carpeta creada", { name, id, parentId, ...logContext });
  return { id, name, url: driveFolderUrl(id), status: "created" };
}

export async function uploadDriveFile(
  accessToken: string,
  folderId: string,
  file: File,
  fileName: string,
  description: string,
): Promise<DriveUploadedFile> {
  const metadata = {
    name: fileName,
    parents: [folderId],
    description,
  };
  const boundary = `oficina-tecnica-${Date.now()}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  return driveFetch<DriveUploadedFile>(
    accessToken,
    `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,parents&supportsAllDrives=true`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: body as unknown as BodyInit,
    },
  );
}

export async function moveDriveFileToFolder(
  accessToken: string,
  fileId: string,
  targetFolderId: string,
  previousParentIds: string[],
): Promise<{ id: string; parents?: string[]; webViewLink?: string }> {
  const params = new URLSearchParams({
    addParents: targetFolderId,
    removeParents: previousParentIds.join(","),
    fields: "id,parents,webViewLink",
    supportsAllDrives: "true",
  });
  return driveFetch(accessToken, `${DRIVE_API_URL}/${encodeURIComponent(fileId)}?${params}`, {
    method: "PATCH",
  });
}
