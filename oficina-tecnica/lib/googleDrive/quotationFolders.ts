import {
  type DriveFolderEnsureResult,
  getDriveRootFolderId,
  getGoogleDriveAccessToken,
  getOrCreateDriveFolder,
  safeDriveName,
} from "@/lib/googleDrive/driveClient";
import { QUOTATION_FOLDER_STRUCTURE, type QuotationFolderNode } from "@/lib/googleDrive/quotationFolderStructure";

export type QuotationFolderStructureResult = {
  quotationCode: string;
  moduleFolder: DriveFolderEnsureResult;
  rootFolder: DriveFolderEnsureResult;
  folders: Record<string, DriveFolderEnsureResult>;
  logs: Array<{
    key: string;
    name: string;
    id: string;
    parentId: string;
    status: "created" | "reused";
  }>;
};

export const QUOTATION_DRIVE_STRUCTURE_VERSION = "cotizacion_drive_v2";

export function validateQuotationCodeForDrive(quotationCode: string): string {
  const normalized = quotationCode.trim();
  if (!normalized) throw new Error("El código de cotización está vacío.");
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new Error("El código de cotización solo puede contener letras, números, punto, guion y guion bajo.");
  }
  if (safeDriveName(normalized) !== normalized) {
    throw new Error("El código de cotización contiene caracteres no válidos para nombre de carpeta Drive.");
  }
  return normalized;
}

async function createNodeTree(
  accessToken: string,
  parentId: string,
  nodes: QuotationFolderNode[],
  folders: Record<string, DriveFolderEnsureResult>,
  logs: QuotationFolderStructureResult["logs"],
  quotationCode: string,
) {
  for (const node of nodes) {
    const folder = await getOrCreateDriveFolder(accessToken, parentId, node.name, {
      quotationCode,
      key: node.key,
    });
    folders[node.key] = folder;
    logs.push({
      key: node.key,
      name: folder.name,
      id: folder.id,
      parentId,
      status: folder.status,
    });

    if (node.children.length > 0) {
      await createNodeTree(accessToken, folder.id, node.children, folders, logs, quotationCode);
    }
  }
}

export async function createQuotationFolderStructure(quotationCodeInput: string): Promise<QuotationFolderStructureResult> {
  const quotationCode = validateQuotationCodeForDrive(quotationCodeInput);
  const accessToken = await getGoogleDriveAccessToken();
  const driveRootFolderId = getDriveRootFolderId();
  const folders: Record<string, DriveFolderEnsureResult> = {};
  const logs: QuotationFolderStructureResult["logs"] = [];

  const moduleFolder = await getOrCreateDriveFolder(accessToken, driveRootFolderId, "02_COTIZACIONES", { quotationCode });
  const rootFolder = await getOrCreateDriveFolder(accessToken, moduleFolder.id, quotationCode, {
    quotationCode,
    key: "quotationRoot",
  });

  logs.push({
    key: "quotationRoot",
    name: rootFolder.name,
    id: rootFolder.id,
    parentId: moduleFolder.id,
    status: rootFolder.status,
  });

  await createNodeTree(accessToken, rootFolder.id, QUOTATION_FOLDER_STRUCTURE, folders, logs, quotationCode);

  return {
    quotationCode,
    moduleFolder,
    rootFolder,
    folders,
    logs,
  };
}

export function buildQuotationDriveMetadata(result: QuotationFolderStructureResult) {
  return {
    version: QUOTATION_DRIVE_STRUCTURE_VERSION,
    root_folder_id: result.rootFolder.id,
    root_folder_url: result.rootFolder.url,
    root_folder_name: result.rootFolder.name,
    module_folder_id: result.moduleFolder.id,
    module_folder_url: result.moduleFolder.url,
    folders: Object.fromEntries(
      Object.entries(result.folders).map(([key, folder]) => [
        key,
        {
          id: folder.id,
          name: folder.name,
          url: folder.url,
        },
      ]),
    ),
    created_at: new Date().toISOString(),
  };
}
