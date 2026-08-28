import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyMarginByResourceType,
  buildBudgetImportPlanFromTechnicalProposal,
  computeImportPlanEconomics,
  nextTechnicalProposalRevision,
  splitResourceCodeAndDescription,
  // @ts-expect-error Node 24 ejecuta tests TypeScript con extension explicita.
} from "./quotationBudgetImport.ts";

const items = [
  { id: "g1", parentId: null, itemType: "group" as const, itemNumber: "1", title: "Trabajos electricos", sortOrder: 0 },
  { id: "s1", parentId: "g1", itemType: "subgroup" as const, itemNumber: "1.1", title: "Instalacion", sortOrder: 1 },
  { id: "a1", parentId: "s1", itemType: "activity" as const, itemNumber: "1.1.1", title: "Instalacion tablero", sortOrder: 2 },
];

describe("technical proposal to quotation budget import", () => {
  it("maps PT hierarchy to budget hierarchy preserving order", () => {
    const plan = buildBudgetImportPlanFromTechnicalProposal({ items, resources: [] });

    assert.deepEqual(
      plan.nodes.map((node) => [node.codigo, node.tipo, node.parentSourceItemId]),
      [
        ["1", "CAPITULO", null],
        ["1.1", "SUBCAPITULO", "g1"],
        ["1.1.1", "PARTIDA", "s1"],
      ],
    );
  });

  it("preserves catalog recurso_id on importable PT resources", () => {
    const plan = buildBudgetImportPlanFromTechnicalProposal({
      items,
      resources: [
        {
          id: "r1",
          technicalProposalItemId: "a1",
          resourceId: "11111111-1111-4111-8111-111111111111",
          codigoRecurso: "MAT-2026-0001",
          codigoFabricante: "FAB-CABLE-01",
          descripcion: "Cable",
          unidad: "m",
          cantidad: 3,
          tipoRecurso: "Materiales",
          precioUnitarioRef: 10,
          monedaCodigo: "PEN",
          proveedor: "Proveedor A",
          marca: "Marca A",
          sortOrder: 4,
        },
      ],
    });

    assert.equal(plan.resources[0].recursoId, "11111111-1111-4111-8111-111111111111");
    assert.equal(plan.resources[0].cantidadPresupuestada, 3);
    assert.equal(plan.resources[0].codigoRecursoSnapshot, "MAT-2026-0001");
    assert.equal(plan.resources[0].descripcionSnapshot, "Cable");
    assert.equal(plan.resources[0].precioUnitarioRefSnapshot, 10);
  });

  it("separates resource code from description", () => {
    assert.deepEqual(splitResourceCodeAndDescription("REC-2026-0031 - CONECTOR TUBULAR 240MM2"), {
      codigoRecurso: "REC-2026-0031",
      descripcion: "CONECTOR TUBULAR 240MM2",
    });
  });

  it("keeps material attached to subgroup through an explicit resource group", () => {
    const plan = buildBudgetImportPlanFromTechnicalProposal({
      items,
      resources: [
        {
          id: "r1",
          technicalProposalItemId: "s1",
          resourceId: "11111111-1111-4111-8111-111111111111",
          descripcion: "Cable",
          cantidad: 1,
          tipoRecurso: "Materiales",
          sortOrder: 0,
        },
      ],
    });

    assert.equal(plan.inconsistencies.length, 0);
    assert.equal(plan.resources.length, 1);
    assert.equal(plan.resources[0].sourceResourceGroupKey, "s1:Materiales");
    assert.deepEqual(
      plan.nodes.find((node) => node.sourceResourceGroupKey === "s1:Materiales"),
      {
        sourceItemId: "s1",
        parentSourceItemId: "s1",
        sourceResourceGroupKey: "s1:Materiales",
        tipo: "GRUPO_RECURSOS",
        codigo: "1.1.R",
        descripcion: "MATERIALES",
        orden: 1000,
        cantidad: null,
        unidad: null,
      },
    );
  });

  it("keeps consumable attached to title through an explicit resource group", () => {
    const plan = buildBudgetImportPlanFromTechnicalProposal({
      items,
      resources: [
        {
          id: "r1",
          technicalProposalItemId: "g1",
          resourceId: "11111111-1111-4111-8111-111111111111",
          descripcion: "Trapo industrial",
          cantidad: 2,
          tipoRecurso: "Consumibles",
          sortOrder: 0,
        },
      ],
    });

    assert.equal(plan.inconsistencies.length, 0);
    assert.equal(plan.resources[0].sourceResourceGroupKey, "g1:Consumibles");
    assert.equal(plan.nodes.find((node) => node.sourceResourceGroupKey === "g1:Consumibles")?.tipo, "GRUPO_RECURSOS");
  });

  it("imports activity and sibling material, consumable and equipment groups without double counting", () => {
    const plan = buildBudgetImportPlanFromTechnicalProposal({
      items,
      resources: [
        {
          id: "mo1",
          technicalProposalItemId: "a1",
          resourceId: "11111111-1111-4111-8111-111111111111",
          descripcion: "Tecnico electricista",
          cantidad: 2,
          tipoRecurso: "Mano de obra",
          sortOrder: 0,
        },
        {
          id: "mo2",
          technicalProposalItemId: "a1",
          resourceId: "22222222-2222-4222-8222-222222222222",
          descripcion: "Supervisor",
          cantidad: 1,
          tipoRecurso: "Mano de obra",
          sortOrder: 1,
        },
        {
          id: "mat1",
          technicalProposalItemId: "s1",
          resourceId: "33333333-3333-4333-8333-333333333333",
          descripcion: "Cable",
          cantidad: 10,
          tipoRecurso: "Materiales",
          precioUnitarioRef: 5,
          sortOrder: 2,
        },
        {
          id: "mat2",
          technicalProposalItemId: "s1",
          resourceId: "44444444-4444-4444-8444-444444444444",
          descripcion: "Terminal",
          cantidad: 4,
          tipoRecurso: "Materiales",
          precioUnitarioRef: 3,
          sortOrder: 3,
        },
        {
          id: "con1",
          technicalProposalItemId: "s1",
          resourceId: "55555555-5555-4555-8555-555555555555",
          descripcion: "Cinta",
          cantidad: 2,
          tipoRecurso: "Consumibles",
          precioUnitarioRef: 9,
          sortOrder: 4,
        },
        {
          id: "eq1",
          technicalProposalItemId: "s1",
          resourceId: "66666666-6666-4666-8666-666666666666",
          descripcion: "Camion grua",
          cantidad: 1,
          tipoRecurso: "Equipos",
          precioUnitarioRef: 100,
          sortOrder: 5,
        },
      ],
    });

    const resourceGroups = plan.nodes.filter((node) => node.tipo === "GRUPO_RECURSOS");
    assert.equal(plan.inconsistencies.length, 0);
    assert.deepEqual(
      resourceGroups.map((node) => [node.parentSourceItemId, node.descripcion]),
      [
        ["s1", "MATERIALES"],
        ["s1", "CONSUMIBLES"],
        ["s1", "EQUIPOS"],
      ],
    );
    assert.equal(plan.resources.find((resource) => resource.sourceResourceId === "mat1")?.sourceResourceGroupKey, "s1:Materiales");
    assert.equal(plan.resources.find((resource) => resource.sourceResourceId === "con1")?.sourceResourceGroupKey, "s1:Consumibles");
    assert.equal(plan.resources.find((resource) => resource.sourceResourceId === "eq1")?.sourceResourceGroupKey, "s1:Equipos");
    assert.equal(plan.resources.find((resource) => resource.sourceResourceId === "mo1")?.sourceResourceGroupKey, undefined);

    const economics = computeImportPlanEconomics({
      resources: plan.resources.map((resource) => ({
        ...resource,
        precioBaseUnitario: resource.sourceResourceId === "mo1" ? 10 : resource.sourceResourceId === "mo2" ? 20 : resource.precioUnitarioRefSnapshot ?? 0,
        precioOfertadoUnitario: resource.sourceResourceId === "mo1" ? 12 : resource.sourceResourceId === "mo2" ? 24 : (resource.precioUnitarioRefSnapshot ?? 0) * 1.2,
      })),
    });

    assert.equal(economics.total.base, 220);
    assert.equal(economics.partidas.length, 4);
    assert.equal(economics.partidas.reduce((sum, row) => sum + row.base, 0), economics.total.base);
  });

  it("computes imported budget BASE and OFERTADO", () => {
    const economics = computeImportPlanEconomics({
      resources: [
        {
          sourceResourceId: "r1",
          sourceItemId: "a1",
          recursoId: "11111111-1111-4111-8111-111111111111",
          cantidadPresupuestada: 2,
          precioBaseUnitario: 10,
          precioOfertadoUnitario: 13,
          orden: 0,
          observaciones: null,
          tipoRecurso: "Materiales",
        },
      ],
    });

    assert.equal(economics.total.base, 20);
    assert.equal(economics.total.ofertado, 26);
  });

  it("keeps historical budget base when the master reference price changes later", () => {
    const masterResource = {
      id: "11111111-1111-4111-8111-111111111111",
      precioUnitarioRef: 10,
    };
    const budgetResource = {
      sourceResourceId: "r1",
      sourceItemId: "a1",
      recursoId: masterResource.id,
      cantidadPresupuestada: 1,
      precioBaseUnitario: masterResource.precioUnitarioRef,
      precioOfertadoUnitario: 12,
      orden: 0,
      observaciones: null,
      tipoRecurso: "Materiales",
      precioUnitarioRefSnapshot: masterResource.precioUnitarioRef,
    };

    masterResource.precioUnitarioRef = 15;
    const economics = computeImportPlanEconomics({ resources: [budgetResource] });

    assert.equal(masterResource.precioUnitarioRef, 15);
    assert.equal(budgetResource.precioBaseUnitario, 10);
    assert.equal(budgetResource.precioUnitarioRefSnapshot, 10);
    assert.equal(economics.total.base, 10);
  });

  it("applies margin by type without overwriting manual overrides", () => {
    const rows = applyMarginByResourceType(
      [
        { id: "a", tipoRecurso: "Materiales", cantidadPresupuestada: 1, precioBaseUnitario: 100, precioOfertadoUnitario: 100 },
        {
          id: "b",
          tipoRecurso: "Materiales",
          cantidadPresupuestada: 1,
          precioBaseUnitario: 100,
          precioOfertadoUnitario: 150,
          manualOfferOverride: true,
        },
      ],
      "Materiales",
      35,
    );

    assert.equal(rows[0].precioOfertadoUnitario, 135);
    assert.equal(rows[1].precioOfertadoUnitario, 150);
  });

  it("computes manual budget economics without PT traceability", () => {
    const economics = computeImportPlanEconomics({
      resources: [
        {
          sourceResourceId: "manual-r1",
          sourceItemId: "manual-partida",
          recursoId: "22222222-2222-4222-8222-222222222222",
          cantidadPresupuestada: 4,
          precioBaseUnitario: 25,
          precioOfertadoUnitario: 30,
          orden: 0,
          observaciones: null,
          tipoRecurso: "Sub contratos",
        },
      ],
    });

    assert.equal(economics.total.base, 100);
    assert.equal(economics.total.ofertado, 120);
  });

  it("creates the next PT revision without reusing an existing revision code", () => {
    assert.equal(nextTechnicalProposalRevision(["REV00", "REV01"]), "REV02");
    assert.equal(nextTechnicalProposalRevision([]), "REV00");
  });
});
