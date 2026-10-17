export type TechnicalProposalHierarchyItem = {
  id: string;
  level: number;
  number: string;
  parentId?: string | null;
};

export type TechnicalProposalHierarchyEntry = {
  id: string;
  level: number;
  parentId: string | null;
  number: string;
};

/**
 * Builds the proposal hierarchy from document order and depth. Each number is
 * derived from its real parent and its position among that parent's children.
 */
export function buildTechnicalProposalHierarchy(
  items: Array<Pick<TechnicalProposalHierarchyItem, "id" | "level"> & { parentId?: string | null }>,
): TechnicalProposalHierarchyEntry[] {
  const ancestors: TechnicalProposalHierarchyEntry[] = [];
  const siblingCountByParent = new Map<string, number>();
  const entryById = new Map<string, TechnicalProposalHierarchyEntry>();

  return items.map((item, index) => {
    const requestedLevel = Math.max(0, Math.floor(Number.isFinite(item.level) ? item.level : 0));
    const explicitParent = item.parentId ? entryById.get(item.parentId) ?? null : null;
    const hasExplicitParent = Object.prototype.hasOwnProperty.call(item, "parentId");
    const maxAllowedLevel = index === 0 ? 0 : ancestors.length;
    const level = hasExplicitParent ? (explicitParent ? explicitParent.level + 1 : 0) : Math.min(requestedLevel, maxAllowedLevel);
    ancestors.splice(level);

    const parent = hasExplicitParent ? explicitParent : level > 0 ? ancestors[level - 1] ?? null : null;
    const parentKey = parent?.id ?? "__root__";
    const siblingPosition = (siblingCountByParent.get(parentKey) ?? 0) + 1;
    siblingCountByParent.set(parentKey, siblingPosition);

    const entry: TechnicalProposalHierarchyEntry = {
      id: item.id,
      level,
      parentId: parent?.id ?? null,
      number: parent ? `${parent.number}.${siblingPosition}` : `${siblingPosition}`,
    };
    ancestors[level] = entry;
    entryById.set(entry.id, entry);
    return entry;
  });
}

export function numberTechnicalProposalHierarchy<T extends TechnicalProposalHierarchyItem>(items: T[]): T[] {
  const hierarchy = buildTechnicalProposalHierarchy(items);
  return items.map((item, index) => ({
    ...item,
    level: hierarchy[index].level,
    number: hierarchy[index].number,
  }));
}

export function numberTechnicalProposalResourceGroups<T>(parentNumber: string, groups: T[]): Array<T & { number: string }> {
  return groups.map((group, index) => ({ ...group, number: `${parentNumber}.${index + 1}` }));
}

export function resolveTechnicalProposalInsertionLevel(
  kind: "group" | "subgroup" | "activity",
  selected?: { level: number; kind: "group" | "subgroup" | "activity" } | null,
): number {
  if (kind === "group") return 0;
  if (kind === "subgroup") return (selected?.level ?? 0) + 1;
  if (!selected) return 1;
  return selected.kind === "activity" ? selected.level : selected.level + 1;
}
