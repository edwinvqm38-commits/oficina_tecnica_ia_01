import {
  type DriveFolderEnsureResult,
  getDriveRootFolderId,
  getGoogleDriveAccessToken,
  getOrCreateDriveFolder,
  safeDriveName,
} from "@/lib/googleDrive/driveClient";

export type QuotationFolderNode = {
  key: string;
  name: string;
  children: QuotationFolderNode[];
};

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

export const QUOTATION_FOLDER_STRUCTURE: QuotationFolderNode[] = [
  { key: "control", name: "00_CONTROL", children: [] },
  { key: "clientDocuments", name: "01_DOCUMENTOS_CLIENTE", children: [] },
  {
    key: "proposal",
    name: "02_PROPUESTA",
    children: [
      { key: "proposalTechnicalScope", name: "01_Alcance técnico", children: [] },
      { key: "proposalEconomicScope", name: "02_Alcance económico", children: [] },
      { key: "proposalSchedule", name: "03_Cronograma", children: [] },
      { key: "proposalOrganizationChart", name: "04_Organigrama", children: [] },
      { key: "proposalWorkPlan", name: "05_Plan de trabajo", children: [] },
      { key: "proposalExperienceCv", name: "06_Experiencia CV Sustentos", children: [] },
      { key: "proposalAnnexes", name: "07_Anexos", children: [] },
    ],
  },
  { key: "requirements", name: "03_REQUERIMIENTOS", children: [] },
  { key: "supplierQuotes", name: "04_COTIZACIONES_PROVEEDORES", children: [] },
  { key: "costAnalysis", name: "05_ANALISIS_Y_COSTOS", children: [] },
  { key: "managementReview", name: "06_REVISION_GERENCIA", children: [] },
  { key: "clientDelivery", name: "07_ENVIO_CLIENTE", children: [] },
  { key: "archive", name: "99_ARCHIVO", children: [] },
];

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
