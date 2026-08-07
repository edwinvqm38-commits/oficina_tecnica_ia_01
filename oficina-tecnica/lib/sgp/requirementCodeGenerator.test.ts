import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nextProjectCodeForYear,
  nextRqCorrelativeForQuotation,
  planProjectTagForQuotation,
  reservedProjectTagsForYear,
  type RequirementProjectEntry,
} from "./requirementCodeGenerator";

const firstQuotation = "COT-EKA-2026-143";
const secondQuotation = "FOR-EKA-PRO-3_2026-055_REV02";

function project(input: Partial<RequirementProjectEntry> & Pick<RequirementProjectEntry, "codigo_proyecto" | "cotizacion">): RequirementProjectEntry {
  return {
    anio: 2026,
    codigo_proyecto: input.codigo_proyecto,
    cotizacion: input.cotizacion,
    cliente: input.cliente ?? "NEXA RESOURCES",
    codigo_cliente: input.codigo_cliente ?? "NEXA",
    unidad_trabajo: input.unidad_trabajo ?? "Refineria Cajamarquilla",
    codigo_unidad: input.codigo_unidad ?? "RCJM",
    estado: input.estado ?? "Activo",
    activo: input.activo ?? true,
  };
}

describe("requirement code generation", () => {
  it("creates P001-001 for the first quotation and first RQ", () => {
    const tagPlan = planProjectTagForQuotation({
      cotizacionCodigo: firstQuotation,
      anio: 2026,
      projects: [],
    });
    const correlative = nextRqCorrelativeForQuotation({
      prefix: `RQ-2026-NEXA-RCJM-${tagPlan.projectTag}`,
      relatedRequirements: [],
    });

    assert.deepEqual(tagPlan, { action: "create", projectTag: "P001", source: "new_project" });
    assert.equal(correlative.correlativo, "001");
  });

  it("keeps P001 and generates 002 for a second RQ in the same quotation", () => {
    const tagPlan = planProjectTagForQuotation({
      cotizacionCodigo: firstQuotation,
      anio: 2026,
      projects: [project({ codigo_proyecto: "P001", cotizacion: firstQuotation })],
      relatedRequirements: [{ codigo: "RQ-2026-NEXA-RCJM-P001-001" }],
    });
    const correlative = nextRqCorrelativeForQuotation({
      prefix: "RQ-2026-NEXA-RCJM-P001",
      relatedRequirements: [{ codigo: "RQ-2026-NEXA-RCJM-P001-001" }],
    });

    assert.deepEqual(tagPlan, { action: "reuse", projectTag: "P001", source: "related_requirement" });
    assert.equal(correlative.correlativo, "002");
  });

  it("does not reuse P001 for a different quotation with the same client and unit", () => {
    const tagPlan = planProjectTagForQuotation({
      cotizacionCodigo: secondQuotation,
      anio: 2026,
      projects: [project({ codigo_proyecto: "P001", cotizacion: firstQuotation })],
    });
    const correlative = nextRqCorrelativeForQuotation({
      prefix: `RQ-2026-NEXA-RCJM-${tagPlan.projectTag}`,
      relatedRequirements: [],
    });

    assert.deepEqual(tagPlan, { action: "create", projectTag: "P002", source: "new_project" });
    assert.equal(correlative.correlativo, "001");
  });

  it("reuses P### when proyectos_adjudicados matches the quotation exactly", () => {
    const tagPlan = planProjectTagForQuotation({
      cotizacionCodigo: secondQuotation,
      anio: 2026,
      projects: [
        project({ codigo_proyecto: "P001", cotizacion: firstQuotation }),
        project({ codigo_proyecto: "P002", cotizacion: secondQuotation }),
      ],
    });

    assert.deepEqual(tagPlan, { action: "reuse", projectTag: "P002", source: "exact_project" });
  });

  it("creates the next available P### when the quotation has no exact project", () => {
    const tagPlan = planProjectTagForQuotation({
      cotizacionCodigo: "COT-NUEVA-2026-001",
      anio: 2026,
      projects: [
        project({ codigo_proyecto: "P001", cotizacion: firstQuotation }),
        project({ codigo_proyecto: "P004", cotizacion: "COT-OTHER-2026-001" }),
      ],
    });

    assert.deepEqual(tagPlan, { action: "create", projectTag: "P005", source: "new_project" });
  });

  it("does not reuse a deleted current-format RQ code", () => {
    const correlative = nextRqCorrelativeForQuotation({
      prefix: "RQ-2026-NEXA-RCJM-P001",
      relatedRequirements: [{ codigo: "RQ-2026-NEXA-RCJM-P001-001" }],
    });

    assert.equal(correlative.correlativo, "002");
  });

  it("distinguishes two projects with the same client and unit by quotation", () => {
    const tagPlan = planProjectTagForQuotation({
      cotizacionCodigo: secondQuotation,
      anio: 2026,
      projects: [
        project({ codigo_proyecto: "P001", cotizacion: firstQuotation }),
        project({ codigo_proyecto: "P002", cotizacion: secondQuotation }),
      ],
    });

    assert.equal(tagPlan.projectTag, "P002");
  });

  it("reserves P001 from requirements when proyectos_adjudicados is empty", () => {
    assert.equal(
      nextProjectCodeForYear([], 2026, [{ codigo: "RQ-2026-NEXA-RCJM-P001-001", anio: 2026 }]),
      "P002",
    );
  });

  it("reserves P001 from projects and P002 from requirements", () => {
    assert.equal(
      nextProjectCodeForYear(
        [project({ codigo_proyecto: "P001", cotizacion: firstQuotation })],
        2026,
        [{ codigo: null, codigo_proyecto_adjudicado: "P002", anio: 2026 }],
      ),
      "P003",
    );
  });

  it("deduplicates repeated P### values across projects and requirements", () => {
    const reserved = reservedProjectTagsForYear({
      anio: 2026,
      projects: [project({ codigo_proyecto: " P001 ", cotizacion: firstQuotation })],
      requirements: [
        { codigo: "RQ-2026-NEXA-RCJM-P001-001", codigo_proyecto_adjudicado: "p001", anio: 2026 },
        { codigo: null, codigo_proyecto_adjudicado: "P001", anio: 2026 },
      ],
    });

    assert.deepEqual(reserved, ["P001"]);
    assert.equal(
      nextProjectCodeForYear([project({ codigo_proyecto: "P001", cotizacion: firstQuotation })], 2026, [
        { codigo: "RQ-2026-NEXA-RCJM-P001-001", codigo_proyecto_adjudicado: "p001", anio: 2026 },
      ]),
      "P002",
    );
  });

  it("keeps a deleted requirement P003 reserved", () => {
    assert.equal(
      nextProjectCodeForYear([], 2026, [{ codigo: null, codigo_proyecto_adjudicado: "P003", anio: 2026 }]),
      "P004",
    );
  });

  it("reserves P004 from a valid RQ code when codigo_proyecto_adjudicado is empty", () => {
    assert.equal(
      nextProjectCodeForYear([], 2026, [{ codigo: "RQ-2026-NEXA-RCJM-P004-001", codigo_proyecto_adjudicado: "", anio: 2026 }]),
      "P005",
    );
  });

  it("ignores invalid project code values", () => {
    const reserved = reservedProjectTagsForYear({
      anio: 2026,
      projects: [
        project({ codigo_proyecto: "P01", cotizacion: "BAD-1" }),
        project({ codigo_proyecto: "PX01", cotizacion: "BAD-2" }),
        project({ codigo_proyecto: "P1000", cotizacion: "BAD-3" }),
      ],
      requirements: [
        { codigo: "RQ-2026-NEXA-RCJM-P01-001", codigo_proyecto_adjudicado: "P01", anio: 2026 },
        { codigo: "RQ-2026-NEXA-RCJM-P99X-001", codigo_proyecto_adjudicado: "proyecto 1", anio: 2026 },
        { codigo: "RQ-2025-NEXA-RCJM-P999-001", codigo_proyecto_adjudicado: "P999", anio: 2025 },
      ],
    });

    assert.deepEqual(reserved, []);
    assert.equal(nextProjectCodeForYear([], 2026, [{ codigo: "historico-2026-001", codigo_proyecto_adjudicado: "001", anio: 2026 }]), "P001");
  });

  it("real case reserves P001 and assigns P002-001 to the second quotation without an exact project", () => {
    const tagPlan = planProjectTagForQuotation({
      cotizacionCodigo: secondQuotation,
      anio: 2026,
      projects: [],
      reservedRequirements: [{ codigo: "RQ-2026-NEXA-RCJM-P001-001", codigo_proyecto_adjudicado: "P001", anio: 2026 }],
    });
    const correlative = nextRqCorrelativeForQuotation({
      prefix: `RQ-2026-NEXA-RCJM-${tagPlan.projectTag}`,
      relatedRequirements: [],
    });

    assert.deepEqual(tagPlan, { action: "create", projectTag: "P002", source: "new_project" });
    assert.equal(`RQ-2026-NEXA-RCJM-${tagPlan.projectTag}-${correlative.correlativo}`, "RQ-2026-NEXA-RCJM-P002-001");
  });
});
