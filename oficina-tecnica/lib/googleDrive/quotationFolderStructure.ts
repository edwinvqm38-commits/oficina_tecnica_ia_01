export type QuotationFolderNode = {
  key: string;
  name: string;
  children: QuotationFolderNode[];
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

export type QuotationDocumentTarget = {
  key: string;
  label: string;
  folderName: string;
  parentKey?: string;
  parentName?: string;
};

export const QUOTATION_DOCUMENT_TARGETS: QuotationDocumentTarget[] = QUOTATION_FOLDER_STRUCTURE.flatMap((node) => {
  if (node.children.length === 0) {
    return [{ key: node.key, label: node.name, folderName: node.name }];
  }
  return node.children.map((child) => ({
    key: child.key,
    label: `${node.name} / ${child.name}`,
    folderName: child.name,
    parentKey: node.key,
    parentName: node.name,
  }));
});

export function findQuotationDocumentTarget(key: string): QuotationDocumentTarget | null {
  return QUOTATION_DOCUMENT_TARGETS.find((target) => target.key === key) ?? null;
}
