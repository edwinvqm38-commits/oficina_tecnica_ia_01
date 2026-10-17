import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

type BudgetState = "BORRADOR" | "LISTO_PARA_ADJUDICAR" | "ADJUDICADO";

type PtItem = {
  sourceKey: string;
  parentSourceKey: string | null;
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
  description: string;
  order: number;
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
};

type BudgetModel = {
  state: BudgetState;
  parts: BudgetPart[];
  resources: BudgetResource[];
};

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function reconcileModel(budget: BudgetModel, items: PtItem[], resources: PtResource[]): BudgetModel {
  if (budget.state !== "BORRADOR") {
    throw new Error(`Solo BORRADOR: ${budget.state}`);
  }

  const currentParts = new Map(budget.parts.map((part) => [part.structureKey, part]));
  const nextParts: BudgetPart[] = [];
  const partIds = new Map<string, string>();

  for (const item of items) {
    const structureKey = `item:${item.sourceKey}`;
    const current = currentParts.get(structureKey);
    const id = current?.id ?? nextId("part");
    const parentId = item.parentSourceKey ? partIds.get(item.parentSourceKey) ?? null : null;
    nextParts.push({ id, structureKey, parentId, description: item.title, order: item.order });
    partIds.set(item.sourceKey, id);
  }

  const desiredResourceKeys = new Set(resources.map((resource) => resource.sourceKey));
  const currentResources = new Map(budget.resources.map((resource) => [resource.sourceKey, resource]));
  const nextResources: BudgetResource[] = resources.map((resource) => {
    const current = currentResources.get(resource.sourceKey);
    return {
      id: current?.id ?? nextId("resource"),
      sourceKey: resource.sourceKey,
      partId: partIds.get(resource.itemSourceKey) ?? "missing-part",
      masterResourceId: resource.masterResourceId,
      quantity: resource.quantity,
      basePrice: current?.basePrice ?? 0,
      offerPrice: current?.offerPrice ?? 0,
      observations: current?.observations ?? "",
      reviewed: current?.reviewed ?? false,
      syncStatus: "SYNCED",
    };
  });

  for (const resource of budget.resources) {
    if (desiredResourceKeys.has(resource.sourceKey)) continue;
    const hasManualEconomics =
      resource.reviewed ||
      resource.basePrice !== 0 ||
      resource.offerPrice !== 0 ||
      resource.observations.trim() !== "";
    if (hasManualEconomics) {
      nextResources.push({ ...resource, syncStatus: "REQUIRES_REVIEW" });
    }
  }

  return { ...budget, parts: nextParts, resources: nextResources };
}

function baseItems(): PtItem[] {
  return [
    { sourceKey: "title-1", parentSourceKey: null, title: "Título 1", order: 0 },
    { sourceKey: "part-a", parentSourceKey: "title-1", title: "Partida A", order: 1 },
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
    const updateStart = migrationSql.indexOf("update public.cotizacion_presupuesto_recursos\n      set", migrationSql.indexOf("-- Recursos:"));
    const updateEnd = migrationSql.indexOf("where id = v_budget_item_id;", updateStart);
    const resourceUpdate = migrationSql.slice(updateStart, updateEnd);

    assert.ok(updateStart > 0 && updateEnd > updateStart);
    assert.doesNotMatch(resourceUpdate, /precio_base_unitario\s*=/i);
    assert.doesNotMatch(resourceUpdate, /precio_ofertado_unitario\s*=/i);
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
      { sourceKey: "part-b", parentSourceKey: "title-1", title: "Partida B", order: 2 },
    ], baseResources());
    assert.equal(result.parts.length, 3);
    assert.equal(result.parts.find((part) => part.structureKey === "item:part-b")?.description, "Partida B");
  });

  it("adds a Subtítulo", () => {
    const items = [
      baseItems()[0],
      { sourceKey: "subtitle-1", parentSourceKey: "title-1", title: "Subtítulo 1.1", order: 1 },
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
      { sourceKey: "subtitle-1", parentSourceKey: "title-1", title: "Subtítulo", order: 1 },
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
});
