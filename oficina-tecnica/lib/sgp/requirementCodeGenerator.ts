export type RequirementProjectEntry = {
  anio: number;
  codigo_proyecto: string;
  cotizacion?: string | null;
  oc?: string | null;
  cliente?: string | null;
  codigo_cliente?: string | null;
  unidad_trabajo?: string | null;
  codigo_unidad?: string | null;
  estado?: string | null;
  activo?: boolean | null;
};

export type RequirementCodeMetadataInput = {
  codigo_proyecto_adjudicado?: string | null;
  project_tag?: string | null;
};

export type RequirementCodeRelatedRow = {
  codigo: string | null;
  codigo_proyecto_adjudicado?: string | null;
  anio?: number | null;
};

export type RequirementProjectTagPlan =
  | { action: "reuse"; projectTag: string; source: "metadata" | "related_requirement" | "exact_project" }
  | { action: "create"; projectTag: string; source: "new_project" };

export const CURRENT_RQ_CODE_PATTERN = /^RQ-(\d{4})-([A-Z0-9]+)-([A-Z0-9]+)-(P\d{3})-(\d{3})$/;
export const HISTORICAL_RQ_CODE_PATTERN = /^RQ-[A-Z0-9]+-(\d{1,4})_(\d{4})$/;

export function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function normalizeToken(value: unknown): string {
  return normalizeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function sameText(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizeString(left);
  const normalizedRight = normalizeString(right);
  return Boolean(normalizedLeft && normalizedRight) && normalizedLeft.localeCompare(normalizedRight, "es", { sensitivity: "base" }) === 0;
}

export function normalizeProjectTag(value: unknown): string {
  const token = normalizeToken(value);
  if (!/^P\d{3}$/.test(token)) return "";
  return token;
}

function projectTagNumber(value: string): number | null {
  const tag = normalizeProjectTag(value);
  if (!tag) return null;
  const valueNumber = Number(tag.slice(1));
  return Number.isFinite(valueNumber) ? valueNumber : null;
}

export function reservedProjectTagsForYear(input: {
  anio: number;
  projects?: RequirementProjectEntry[];
  requirements?: RequirementCodeRelatedRow[];
}): string[] {
  const reserved = new Set<string>();

  (input.projects ?? []).forEach((project) => {
    if (Number(project.anio) !== input.anio) return;
    const tag = normalizeProjectTag(project.codigo_proyecto);
    if (tag) reserved.add(tag);
  });

  (input.requirements ?? []).forEach((requirement) => {
    const explicitYear = typeof requirement.anio === "number" ? requirement.anio : null;
    if (explicitYear === input.anio) {
      const tagFromColumn = normalizeProjectTag(requirement.codigo_proyecto_adjudicado);
      if (tagFromColumn) reserved.add(tagFromColumn);
    }

    const codeMatch = CURRENT_RQ_CODE_PATTERN.exec(normalizeString(requirement.codigo));
    if (codeMatch && Number(codeMatch[1]) === input.anio) {
      const tagFromCode = normalizeProjectTag(codeMatch[4]);
      if (tagFromCode) reserved.add(tagFromCode);
    }
  });

  return Array.from(reserved).sort((left, right) => left.localeCompare(right));
}

export function nextProjectCodeForYear(
  projects: RequirementProjectEntry[],
  anio: number,
  requirements: RequirementCodeRelatedRow[] = [],
): string {
  const values = reservedProjectTagsForYear({ anio, projects, requirements })
    .map(projectTagNumber)
    .filter((item): item is number => item !== null);
  const next = (values.length > 0 ? Math.max(...values) : 0) + 1;
  return `P${String(next).padStart(3, "0")}`;
}

export function findExactProjectForQuotation(
  projects: RequirementProjectEntry[],
  cotizacionCodigo: string,
  anio: number,
): RequirementProjectEntry | null {
  const exact = projects
    .filter((item) => Number(item.anio) === anio && sameText(item.cotizacion, cotizacionCodigo))
    .sort((left, right) => normalizeProjectTag(right.codigo_proyecto).localeCompare(normalizeProjectTag(left.codigo_proyecto)));
  return exact[0] ?? null;
}

export function resolveRequirementCodePartsFromRelatedRequirements(
  relatedRequirements: RequirementCodeRelatedRow[],
  anio: number,
): { codigoCliente: string; codigoUnidad: string; projectTag: string; anio: number } | null {
  const matches = relatedRequirements
    .map((item) => CURRENT_RQ_CODE_PATTERN.exec(normalizeString(item.codigo)))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .filter((match) => Number(match[1]) === anio);
  if (matches.length === 0) return null;
  matches.sort((left, right) => Number(right[5]) - Number(left[5]));
  const latest = matches[0];
  return {
    codigoCliente: latest[2],
    codigoUnidad: latest[3],
    projectTag: latest[4],
    anio,
  };
}

export function planProjectTagForQuotation(input: {
  cotizacionCodigo: string;
  anio: number;
  metadata?: RequirementCodeMetadataInput | null;
  projects: RequirementProjectEntry[];
  relatedRequirements?: RequirementCodeRelatedRow[];
  reservedRequirements?: RequirementCodeRelatedRow[];
}): RequirementProjectTagPlan {
  const relatedParts = resolveRequirementCodePartsFromRelatedRequirements(input.relatedRequirements ?? [], input.anio);
  if (relatedParts?.projectTag) {
    return { action: "reuse", projectTag: relatedParts.projectTag, source: "related_requirement" };
  }

  const metadataTag = normalizeProjectTag(input.metadata?.codigo_proyecto_adjudicado || input.metadata?.project_tag);
  if (metadataTag) {
    return { action: "reuse", projectTag: metadataTag, source: "metadata" };
  }

  const exactProjectTag = normalizeProjectTag(
    findExactProjectForQuotation(input.projects, input.cotizacionCodigo, input.anio)?.codigo_proyecto,
  );
  if (exactProjectTag) {
    return { action: "reuse", projectTag: exactProjectTag, source: "exact_project" };
  }

  return {
    action: "create",
    projectTag: nextProjectCodeForYear(input.projects, input.anio, input.reservedRequirements ?? input.relatedRequirements ?? []),
    source: "new_project",
  };
}

export function nextRqCorrelativeForQuotation(input: {
  prefix: string;
  relatedRequirements: RequirementCodeRelatedRow[];
}): { correlativo: string; existingCodes: string[]; maxCorrelativo: number; ignoredCodes: string[] } {
  const exactNewCodePattern = new RegExp(`^${input.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d{3})$`);
  const considered = input.relatedRequirements.flatMap((row) => {
    const codigo = normalizeString(row.codigo);
    const match = exactNewCodePattern.exec(codigo);
    if (!match) return [];
    const correlativo = parseInt(match[1], 10);
    return Number.isFinite(correlativo) ? [{ codigo, correlativo }] : [];
  });
  const ignoredCodes = input.relatedRequirements
    .map((row) => normalizeString(row.codigo))
    .filter((codigo) => codigo && !exactNewCodePattern.test(codigo));
  const max = Math.max(...considered.map((item) => item.correlativo), 0);
  return {
    correlativo: String(max + 1).padStart(3, "0"),
    existingCodes: considered.map((item) => item.codigo),
    maxCorrelativo: max,
    ignoredCodes,
  };
}
