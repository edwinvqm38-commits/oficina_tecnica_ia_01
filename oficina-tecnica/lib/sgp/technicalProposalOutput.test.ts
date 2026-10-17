import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConsolidatedTechnicalProposalResources,
  buildTechnicalProposalScopePathMap,
  normalizeEnabledResourceTables,
  type TechnicalProposalOutputResource,
  type TechnicalProposalOutputScopeItem,
} from "./technicalProposalOutput";

const scopeItems: TechnicalProposalOutputScopeItem[] = [
  { id: "title", level: 0, number: "1", kind: "group", title: "Montaje eléctrico" },
  { id: "subtitle", level: 1, number: "1.1", kind: "subgroup", title: "Tableros" },
  { id: "activity", level: 2, number: "1.1.1", kind: "activity", title: "Instalación" },
];

const resources: TechnicalProposalOutputResource[] = [
  {
    rowId: "use-2",
    scopeItemId: "activity",
    masterResourceId: "master-1",
    resourceCategory: "materiales",
    tipo: "Materiales",
    codigo: "MAT-01",
    descripcion: "Cable eléctrico",
    unidad: "m",
    cantidad: 12,
    observation: "Color rojo",
  },
  {
    rowId: "use-1",
    scopeItemId: "subtitle",
    masterResourceId: null,
    resourceCategory: "mano_obra",
    tipo: "Mano de obra",
    codigo: "",
    descripcion: "Técnico electricista",
    unidad: "h",
    cantidad: 8,
  },
];

describe("technical proposal output model", () => {
  it("builds a complete hierarchical location", () => {
    const paths = buildTechnicalProposalScopePathMap(scopeItems);
    assert.equal(paths.get("activity"), "1 Montaje eléctrico / 1.1 Tableros / 1.1.1 Instalación");
  });

  it("consolidates all resources in structural order", () => {
    const rows = buildConsolidatedTechnicalProposalResources(scopeItems, resources);
    assert.deepEqual(rows.map((row) => row.rowId), ["use-1", "use-2"]);
    assert.equal(rows[1].location, "1 Montaje eléctrico / 1.1 Tableros / 1.1.1 Instalación");
  });

  it("distinguishes master catalog resources from rows pending formalization", () => {
    const rows = buildConsolidatedTechnicalProposalResources(scopeItems, resources);
    assert.equal(rows[0].source, "Por formalizar");
    assert.equal(rows[1].source, "Catálogo maestro");
  });

  it("keeps repeated master resources as separate usage instances", () => {
    const repeated = buildConsolidatedTechnicalProposalResources(scopeItems, [resources[1], { ...resources[1], rowId: "use-3", cantidad: 4 }]);
    assert.equal(repeated.length, 2);
    assert.notEqual(repeated[0].rowId, repeated[1].rowId);
  });

  it("normalizes enabled tables and drops stale scope references", () => {
    assert.deepEqual(
      normalizeEnabledResourceTables({ activity: ["materiales", "materiales", "equipos"], removed: ["consumibles"] }, ["activity"]),
      { activity: ["materiales", "equipos"] },
    );
  });
});
