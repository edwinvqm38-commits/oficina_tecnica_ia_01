import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

type BudgetState = "BORRADOR" | "LISTO_PARA_ADJUDICAR" | "ADJUDICADO";

type PtItem = {
  sourceKey: string;
  parentSourceKey: string | null;
  kind: "group" | "subgroup" | "activity";
  title: string;
  order: number;
};

type PtResource = {
  sourceKey: string;
  itemSourceKey: string;
  masterResourceId: string;
  quantity: number;
};

type BudgetPart = {
  id: string;
  structureKey: string;
  parentId: string | null;
  kind: "group" | "subgroup" | "activity";
  description: string;
  order: number;
  observations: string;
  syncStatus: "SYNCED" | "REQUIRES_REVIEW";
};

type BudgetResource = {
  id: string;
  sourceKey: string;
  partId: string;
  masterResourceId: string;
  quantity: number;
  basePrice: number;
  offerPrice: number;
  observations: string;
  reviewed: boolean;
  syncStatus: "SYNCED" | "REQUIRES_REVIEW";
  syncReason: string | null;
};

type BudgetModel = {
  state: BudgetState;
  parts: BudgetPart[];
  resources: BudgetResource[];
};

let sequence = 0;
let lastOperations = { inserted: 0, updated: 0, deleted: 0, reviewed: 0 };

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function reconcileModel(budget: BudgetModel, items: PtItem[], resources: PtResource[]): BudgetModel {
  if (budget.state !== "BORRADOR") {
    throw new Error(`Solo BORRADOR: ${budget.state}`);
  }

  lastOperations = { inserted: 0, updated: 0, deleted: 0, reviewed: 0 };

  const currentParts = new Map(budget.parts.map((part) => [part.structureKey, part]));
  const nextParts: BudgetPart[] = [];
  const partIds = new Map<string, string>();

  for (const item of items) {
    const structureKey = `item:${item.sourceKey}`;
    const current = currentParts.get(structureKey);
    const id = current?.id ?? nextId("part");
    const parentId = item.parentSourceKey ? partIds.get(item.parentSourceKey) ?? null : null;
    const nextPart: BudgetPart = {
      id,
      structureKey,
      parentId,
      kind: item.kind,
      description: item.title,
      order: item.order,
      observations: current?.observations ?? "",
      syncStatus: "SYNCED",
    };
    if (!current) lastOperations.inserted += 1;
    else if (JSON.stringify(current) !== JSON.stringify(nextPart)) lastOperations.updated += 1;
    nextParts.push(nextPart);
    partIds.set(item.sourceKey, id);
  }

  const desiredResourceKeys = new Set(resources.map((resource) => resource.sourceKey));
  const currentResources = new Map(budget.resources.map((resource) => [resource.sourceKey, resource]));
  const nextResources: BudgetResource[] = resources.map((resource) => {
    const current = currentResources.get(resource.sourceKey);
    const hasManualEconomics = Boolean(
      current && (
        current.reviewed ||
        current.basePrice !== 0 ||
        current.offerPrice !== 0 ||
        current.observations.trim() !== ""
      )
    );
    const masterChanged = Boolean(current && current.masterResourceId !== resource.masterResourceId);
    const requiresMasterReview = Boolean(
      current && ((masterChanged && hasManualEconomics) || current.syncReason === "RESOURCE_MASTER_CHANGED_WITH_ECONOMICS")
    );
    const nextResource: BudgetResource = {
      id: current?.id ?? nextId("resource"),
      sourceKey: resource.sourceKey,
      partId: partIds.get(resource.itemSourceKey) ?? "missing-part",
      masterResourceId: resource.masterResourceId,
      quantity: resource.quantity,
      basePrice: current?.basePrice ?? 0,
      offerPrice: current?.offerPrice ?? 0,
      observations: current?.observations ?? "",
      reviewed: current?.reviewed ?? false,
      syncStatus: requiresMasterReview ? "REQUIRES_REVIEW" : "SYNCED",
      syncReason: requiresMasterReview ? "RESOURCE_MASTER_CHANGED_WITH_ECONOMICS" : null,
    };
    if (!current) lastOperations.inserted += 1;
    else if (JSON.stringify(current) !== JSON.stringify(nextResource)) lastOperations.updated += 1;
    return nextResource;
  });

  for (const resource of budget.resources) {
    if (desiredResourceKeys.has(resource.sourceKey)) continue;
    const hasManualEconomics =
      resource.reviewed ||
      resource.basePrice !== 0 ||
      resource.offerPrice !== 0 ||
      resource.observations.trim() !== "";
    if (hasManualEconomics) {
      const retained = {
        ...resource,
        syncStatus: "REQUIRES_REVIEW" as const,
        syncReason: "REMOVED_FROM_PT_WITH_MANUAL_ECONOMICS",
      };
      if (JSON.stringify(resource) !== JSON.stringify(retained)) lastOperations.reviewed += 1;
      nextResources.push(retained);
    } else {
      lastOperations.deleted += 1;
    }
  }

  const desiredPartKeys = new Set(items.map((item) => `item:${item.sourceKey}`));
  for (const part of [...budget.parts].reverse()) {
    if (desiredPartKeys.has(part.structureKey)) continue;
    const hasRetainedResource = nextResources.some((resource) => resource.partId === part.id);
    const hasRetainedChild = nextParts.some((child) => child.parentId === part.id);
    if (part.observations.trim() || hasRetainedResource || hasRetainedChild) {
      const retained = { ...part, syncStatus: "REQUIRES_REVIEW" as const };
      if (JSON.stringify(part) !== JSON.stringify(retained)) lastOperations.reviewed += 1;
      nextParts.push(retained);
    } else {
      lastOperations.deleted += 1;
    }
  }

  return { ...budget, parts: nextParts, resources: nextResources };
}

function baseItems(): PtItem[] {
  return [
    { sourceKey: "title-1", parentSourceKey: null, kind: "group", title: "Título 1", order: 0 },
    { sourceKey: "part-a", parentSourceKey: "title-1", kind: "activity", title: "Partida A", order: 1 },
  ];
}

function baseResources(): PtResource[] {
  return [
    { sourceKey: "resource-use-1", itemSourceKey: "part-a", masterResourceId: "master-1", quantity: 1 },
  ];
}

function emptyBudget(state: BudgetState = "BORRADOR"): BudgetModel {
  return { state, parts: [], resources: [] };
}

function backfillLegacySourceKey(kind: "item" | "resource", id: string): string {
  return `legacy-${kind}:${id}`;
}

function assertImmutableSourceKey(previous: string, next: string): void {
  if (previous !== next) throw new Error("source_key es inmutable");
}

const migrationSql = readFileSync(
  new URL("../../supabase/migrations/20261010141957_mig_pte_1_idempotent_pt_budget_sync.sql", import.meta.url),
  "utf8",
);

describe("MIG-PTE-1 migration contract", () => {
  it("declares stable identities and the reconciliation RPC", () => {
    assert.match(migrationSql, /technical_proposal_items[\s\S]*source_key/i);
    assert.match(migrationSql, /technical_proposal_resources[\s\S]*source_key/i);
    assert.match(migrationSql, /pt_structure_key/i);
    assert.match(migrationSql, /pt_resource_source_key/i);
    assert.match(migrationSql, /create or replace function public\.reconcile_budget_from_technical_proposal/i);
  });

  it("replaces unconditional child replacement with identity-aware deletion", () => {
    assert.doesNotMatch(
      migrationSql,
      /delete from public\.technical_proposal_resources\s+where technical_proposal_id = v_proposal_id\s*;/i,
    );
    assert.doesNotMatch(
      migrationSql,
      /delete from public\.technical_proposal_items\s+where technical_proposal_id = v_proposal_id\s*;/i,
    );
    assert.match(migrationSql, /on conflict \(id\) do update/i);
  });

  it("protects manual economic fields during resource updates", () => {
    const updateStart = migrationSql.indexOf("v_master_changed :=", migrationSql.indexOf("-- Recursos:"));
    const updateEnd = migrationSql.indexOf("get diagnostics v_rows_changed = row_count;", updateStart);
    const resourceUpdate = migrationSql.slice(updateStart, updateEnd);

    assert.ok(updateStart > 0 && updateEnd > updateStart);
    assert.match(resourceUpdate, /precio_base_unitario\s*=\s*v_target_base_price/i);
    assert.match(resourceUpdate, /precio_ofertado_unitario\s*=\s*v_target_offer_price/i);
    assert.doesNotMatch(resourceUpdate, /precio_base_unitario\s*=\s*v_resource/i);
    assert.doesNotMatch(resourceUpdate, /precio_ofertado_unitario\s*=\s*v_resource/i);
    assert.doesNotMatch(resourceUpdate, /observaciones\s*=/i);
    assert.match(resourceUpdate, /cantidad_presupuestada\s*=/i);
    assert.match(resourceUpdate, /partida_id\s*=/i);
  });

  it("hard-blocks automatic reconciliation outside BORRADOR", () => {
    assert.match(migrationSql, /if v_budget\.estado <> 'BORRADOR' then/i);
    assert.match(migrationSql, /v_linked_budget_state <> 'BORRADOR'/i);
    assert.match(migrationSql, /REMOVED_FROM_PT_WITH_MANUAL_ECONOMICS/i);
  });

  it("creates an initial budget representation", () => {
    const result = reconcileModel(emptyBudget(), baseItems(), baseResources());
    assert.equal(result.parts.length, 2);
    assert.equal(result.resources.length, 1);
  });

  it("adds a new Partida", () => {
    const initial = reconcileModel(emptyBudget(), baseItems(), baseResources());
    const result = reconcileModel(initial, [
      ...baseItems(),
      { sourceKey: "part-b", parentSourceKey: "title-1", kind: "activity", title: "Partida B", order: 2 },
    ], baseResources());
    assert.equal(result.parts.length, 3);
    assert.equal(result.parts.find((part) => part.structureKey === "item:part-b")?.description, "Partida B");
  });

  it("adds a Subtítulo", () => {
    const items = [
      baseItems()[0],
      { sourceKey: "subtitle-1", parentSourceKey: "title-1", kind: "subgroup" as const, title: "Subtítulo 1.1", order: 1 },
      { ...baseItems()[1], parentSourceKey: "subtitle-1", order: 2 },
    ];
    const result = reconcileModel(emptyBudget(), items, baseResources());
    assert.equal(result.parts.length, 3);
    assert.equal(
      result.parts.find((part) => part.structureKey === "item:part-a")?.parentId,
      result.parts.find((part) => part.structureKey === "item:subtitle-1")?.id,
    );
  });

  it("moves a Partida without changing its economic identity", () => {
    const initial = reconcileModel(emptyBudget(), baseItems(), baseResources());
    const originalId = initial.parts.find((part) => part.structureKey === "item:part-a")?.id;
    const movedItems = [
      baseItems()[0],
      { sourceKey: "subtitle-1", parentSourceKey: "title-1", kind: "subgroup" as const, title: "Subtítulo", order: 1 },
      { ...baseItems()[1], parentSourceKey: "subtitle-1", order: 2 },
    ];
    const result = reconcileModel(initial, movedItems, baseResources());
    assert.equal(result.parts.find((part) => part.structureKey === "item:part-a")?.id, originalId);
  });

  it("renames a Partida without changing its identity", () => {
    const initial = reconcileModel(emptyBudget(), baseItems(), baseResources());
    const original = initial.parts.find((part) => part.structureKey === "item:part-a");
    const renamed = baseItems().map((item) => item.sourceKey === "part-a" ? { ...item, title: "Partida renombrada" } : item);
    const result = reconcileModel(initial, renamed, baseResources());
    const updated = result.parts.find((part) => part.structureKey === "item:part-a");
    assert.equal(updated?.id, original?.id);
    assert.equal(updated?.description, "Partida renombrada");
  });

  it("adds a resource", () => {
    const initial = reconcileModel(emptyBudget(), baseItems(), []);
    const result = reconcileModel(initial, baseItems(), baseResources());
    assert.equal(result.resources[0].sourceKey, "resource-use-1");
  });

  it("supports the same master resource more than once", () => {
    const resources = [
      ...baseResources(),
      { sourceKey: "resource-use-2", itemSourceKey: "part-a", masterResourceId: "master-1", quantity: 2 },
    ];
    const result = reconcileModel(emptyBudget(), baseItems(), resources);
    assert.equal(result.resources.length, 2);
    assert.notEqual(result.resources[0].id, result.resources[1].id);
  });

  it("updates quantity and preserves prices and observations", () => {
    const initial = reconcileModel(emptyBudget(), baseItems(), baseResources());
    initial.resources[0] = {
      ...initial.resources[0],
      basePrice: 15,
      offerPrice: 20,
      observations: "Override manual",
      reviewed: true,
    };
    const result = reconcileModel(initial, baseItems(), [{ ...baseResources()[0], quantity: 5 }]);
    assert.equal(result.resources[0].quantity, 5);
    assert.equal(result.resources[0].basePrice, 15);
    assert.equal(result.resources[0].offerPrice, 20);
    assert.equal(result.resources[0].observations, "Override manual");
  });

  it("deletes a removed resource without manual economics", () => {
    const initial = reconcileModel(emptyBudget(), baseItems(), baseResources());
    const result = reconcileModel(initial, baseItems(), []);
    assert.equal(result.resources.length, 0);
  });

  it("marks a removed resource with manual economics for review", () => {
    const initial = reconcileModel(emptyBudget(), baseItems(), baseResources());
    initial.resources[0] = { ...initial.resources[0], basePrice: 10, offerPrice: 12 };
    const result = reconcileModel(initial, baseItems(), []);
    assert.equal(result.resources.length, 1);
    assert.equal(result.resources[0].syncStatus, "REQUIRES_REVIEW");
  });

  it("allows BORRADOR", () => {
    assert.doesNotThrow(() => reconcileModel(emptyBudget("BORRADOR"), baseItems(), baseResources()));
  });

  it("rejects LISTO_PARA_ADJUDICAR", () => {
    assert.throws(
      () => reconcileModel(emptyBudget("LISTO_PARA_ADJUDICAR"), baseItems(), baseResources()),
      /Solo BORRADOR/,
    );
  });

  it("rejects ADJUDICADO", () => {
    assert.throws(() => reconcileModel(emptyBudget("ADJUDICADO"), baseItems(), baseResources()), /Solo BORRADOR/);
  });

  it("is idempotent on a second reconciliation", () => {
    const first = reconcileModel(emptyBudget(), baseItems(), baseResources());
    const second = reconcileModel(first, baseItems(), baseResources());
    assert.deepEqual(second, first);
  });

  it("preserves item and resource identities across repeated saves", () => {
    const first = reconcileModel(emptyBudget(), baseItems(), baseResources());
    const second = reconcileModel(first, baseItems(), [{ ...baseResources()[0], quantity: 3 }]);
    assert.equal(second.parts[1].id, first.parts[1].id);
    assert.equal(second.resources[0].id, first.resources[0].id);
  });

  it("deletes a removed Partida without manual or dependent data", () => {
    const initial = reconcileModel(emptyBudget(), baseItems(), []);
    const result = reconcileModel(initial, [baseItems()[0]], []);
    assert.equal(result.parts.some((part) => part.structureKey === "item:part-a"), false);
  });

  it("keeps a removed Partida when a retained resource contains manual economics", () => {
    const initial = reconcileModel(emptyBudget(), baseItems(), baseResources());
    initial.resources[0] = { ...initial.resources[0], basePrice: 25, offerPrice: 30 };
    const result = reconcileModel(initial, [baseItems()[0]], []);
    assert.equal(result.resources[0].syncStatus, "REQUIRES_REVIEW");
    assert.equal(result.parts.find((part) => part.structureKey === "item:part-a")?.syncStatus, "REQUIRES_REVIEW");
  });

  it("changes recurso_id automatically when the stable instance has no manual economics", () => {
    const initial = reconcileModel(emptyBudget(), baseItems(), baseResources());
    const result = reconcileModel(initial, baseItems(), [
      { ...baseResources()[0], masterResourceId: "master-2" },
    ]);
    assert.equal(result.resources[0].masterResourceId, "master-2");
    assert.equal(result.resources[0].syncStatus, "SYNCED");
    assert.equal(result.resources[0].syncReason, null);
  });

  it("preserves economics and requires review when recurso_id changes", () => {
    const initial = reconcileModel(emptyBudget(), baseItems(), baseResources());
    initial.resources[0] = { ...initial.resources[0], basePrice: 25, offerPrice: 30, observations: "Precio negociado" };
    const result = reconcileModel(initial, baseItems(), [
      { ...baseResources()[0], masterResourceId: "master-2" },
    ]);
    assert.equal(result.resources[0].masterResourceId, "master-2");
    assert.equal(result.resources[0].basePrice, 25);
    assert.equal(result.resources[0].offerPrice, 30);
    assert.equal(result.resources[0].syncStatus, "REQUIRES_REVIEW");
    assert.equal(result.resources[0].syncReason, "RESOURCE_MASTER_CHANGED_WITH_ECONOMICS");
  });

  it("supports an activity-to-title type change without changing source identity", () => {
    const initial = reconcileModel(emptyBudget(), baseItems(), baseResources());
    const originalPartId = initial.parts.find((part) => part.structureKey === "item:part-a")?.id;
    const changedItems = baseItems().map((item) =>
      item.sourceKey === "part-a" ? { ...item, kind: "subgroup" as const } : item,
    );
    const result = reconcileModel(initial, changedItems, baseResources());
    assert.equal(result.parts.find((part) => part.structureKey === "item:part-a")?.id, originalPartId);
    assert.match(migrationSql, /transition-resource-group:/i);
  });

  it("backfills deterministic legacy identities", () => {
    assert.equal(backfillLegacySourceKey("item", "item-uuid"), "legacy-item:item-uuid");
    assert.equal(backfillLegacySourceKey("resource", "resource-uuid"), "legacy-resource:resource-uuid");
    assert.match(migrationSql, /BACKFILL_DUPLICATE_RESOURCE_TRACE/i);
  });

  it("rejects changing source_key after persistence", () => {
    assert.doesNotThrow(() => assertImmutableSourceKey("stable-key", "stable-key"));
    assert.throws(() => assertImmutableSourceKey("stable-key", "other-key"), /inmutable/);
    assert.match(migrationSql, /old\.source_key is distinct from new\.source_key/i);
  });

  it("performs zero real writes on a second unchanged reconciliation", () => {
    const first = reconcileModel(emptyBudget(), baseItems(), baseResources());
    const second = reconcileModel(first, baseItems(), baseResources());
    assert.deepEqual(second, first);
    assert.deepEqual(lastOperations, { inserted: 0, updated: 0, deleted: 0, reviewed: 0 });
    assert.match(migrationSql, /get diagnostics v_rows_changed = row_count/i);
    assert.match(migrationSql, /is distinct from row/i);
  });

  it("hardens only the migration-owned SECURITY DEFINER RPCs with an empty search_path", () => {
    const definerFunctions = migrationSql.match(/security definer\s+set search_path = ''/gi) ?? [];
    assert.equal(definerFunctions.length, 3);
    const reconcileBody = migrationSql.slice(
      migrationSql.indexOf("create or replace function public.reconcile_budget_from_technical_proposal"),
      migrationSql.indexOf("revoke all on function public.reconcile_budget_from_technical_proposal"),
    );
    assert.doesNotMatch(reconcileBody, /insert into public\.technical_proposal_events/i);
  });
});
