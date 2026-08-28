import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTechnicalProposalResourceEconomics,
  buildTechnicalProposalResourceTree,
  consolidateTechnicalProposalResources,
  displayResourceCategory,
  economicFieldsVisible,
  technicalProposalResourceCreationAvailable,
  // @ts-expect-error Node 24 ejecuta tests TypeScript con extension explicita.
} from "./technicalProposalResourceUsage.ts";

const baseRow = {
  rowId: "row-1",
  scopeItemId: "a1",
  masterResourceId: "resource-1",
  codigo: "MOD-2026-0001",
  descripcion: "Tecnico electricista",
  tipo: "Mano de obra directa",
  cantidad: 1,
  unidad: "jor",
  precio: 10,
  moneda: "PEN" as const,
  resourceCategory: "mano_obra",
  activityNumber: "1.1",
  activityTitle: "Instalacion",
};

describe("technical proposal resource usage", () => {
  it("shows direct labor as Mano de obra while preserving master type", () => {
    assert.equal(displayResourceCategory("Mano de obra directa", "mano_obra"), "Mano de obra");
    assert.equal(baseRow.tipo, "Mano de obra directa");
  });

  it("shows indirect labor as Mano de obra while preserving master type", () => {
    assert.equal(displayResourceCategory("Mano de obra indirecta", "mano_obra"), "Mano de obra");
  });

  it("consolidates repeated resources by recurso_id", () => {
    const rows = consolidateTechnicalProposalResources([
      baseRow,
      { ...baseRow, rowId: "row-2", activityNumber: "1.2", cantidad: 2 },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].apariciones, 2);
  });

  it("sums quantities when units are compatible", () => {
    const rows = consolidateTechnicalProposalResources([
      baseRow,
      { ...baseRow, rowId: "row-2", cantidad: 2 },
    ]);

    assert.equal(rows[0].cantidadTotal, 3);
    assert.equal(rows[0].noSumable, false);
  });

  it("marks incompatible units as not sumable", () => {
    const rows = consolidateTechnicalProposalResources([
      baseRow,
      { ...baseRow, rowId: "row-2", unidad: "h", cantidad: 2 },
    ]);

    assert.equal(rows[0].cantidadTotal, null);
    assert.equal(rows[0].noSumable, true);
  });

  it("hides economic fields for users without price permission", () => {
    assert.equal(economicFieldsVisible(false), false);
  });

  it("keeps resource creation permission independent from price permission", () => {
    assert.equal(economicFieldsVisible(false), false);
    assert.equal(technicalProposalResourceCreationAvailable(true), true);
    assert.equal(technicalProposalResourceCreationAvailable(false), false);
  });

  it("builds a complete hierarchy with direct title, subgroup and activity resources", () => {
    const tree = buildTechnicalProposalResourceTree(
      [
        { id: "g1", level: 1, number: "1", kind: "group", title: "Titulo A" },
        { id: "s1", level: 2, number: "1.1", kind: "subgroup", title: "Subtitulo A" },
        { id: "a1", level: 3, number: "1.1.1", kind: "activity", title: "Actividad A" },
      ],
      [
        { ...baseRow, rowId: "title-consumable", scopeItemId: "g1", masterResourceId: "resource-c", descripcion: "Consumible X", resourceCategory: "consumibles" },
        { ...baseRow, rowId: "sub-material", scopeItemId: "s1", masterResourceId: "resource-m", descripcion: "Material A", resourceCategory: "materiales" },
        { ...baseRow, rowId: "act-labor", scopeItemId: "a1", masterResourceId: "resource-mo", descripcion: "Tecnico A", resourceCategory: "mano_obra" },
      ],
    );

    assert.equal(tree.length, 1);
    assert.equal(tree[0].resources[0].descripcion, "Consumible X");
    assert.equal(tree[0].children[0].resources[0].descripcion, "Material A");
    assert.equal(tree[0].children[0].children[0].resources[0].descripcion, "Tecnico A");
    assert.equal(tree[0].children[0].parentId, "g1");
    assert.equal(tree[0].children[0].children[0].parentId, "s1");
  });

  it("models unique resource economics from master, history and current budget without storing it in PT", () => {
    const consolidated = consolidateTechnicalProposalResources([
      baseRow,
      { ...baseRow, rowId: "row-2", scopeItemId: "a2", cantidad: 2 },
      { ...baseRow, rowId: "row-3", scopeItemId: "s1", cantidad: 3 },
    ]);
    const economics = buildTechnicalProposalResourceEconomics(consolidated, {
      resourceCatalog: [{ id: "resource-1", precio_unitario_ref: 10, moneda: "PEN" }],
      histories: [
        {
          id: "hist-1",
          recursoId: "resource-1",
          precioUnitario: 11,
          monedaCodigo: "PEN",
          fechaPrecio: "2026-08-26",
        },
      ],
      budget: {
        id: "budget-1",
        estado: "BORRADOR",
        resources: [
          {
            recursoId: "resource-1",
            precioBaseUnitario: 12,
            precioBaseOrigen: "MANUAL",
            precioHistoricoId: null,
            precioRevisado: true,
          },
        ],
      },
    });

    const row = economics.get("resource-1");
    assert.equal(row?.precioMaestroActual, 10);
    assert.equal(row?.ultimoHistorico?.precioUnitario, 11);
    assert.equal(row?.costoCotizacionActual, 12);
    assert.equal(row?.presupuestoId, "budget-1");
  });
});
