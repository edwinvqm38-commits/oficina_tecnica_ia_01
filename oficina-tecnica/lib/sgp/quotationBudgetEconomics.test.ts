import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateBudgetByResourceType,
  buildBudgetEconomicSummaryRows,
  computeBudgetEconomics,
  computeBudgetPartidaEconomics,
  computeBudgetResourceEconomics,
  toBudgetNumber,
  // @ts-expect-error Node 24 ejecuta tests TypeScript con extension explicita.
} from "./quotationBudgetEconomics.ts";

describe("quotation budget economics", () => {
  it("computes BASE, OFERTADO and MARGEN for one resource", () => {
    const row = computeBudgetResourceEconomics({
      cantidadPresupuestada: 10,
      precioBaseUnitario: 15,
      precioOfertadoUnitario: 20,
    });

    assert.equal(row.base, 150);
    assert.equal(row.ofertado, 200);
    assert.equal(row.margen, 50);
  });

  it("aggregates several resources in one partida", () => {
    const row = computeBudgetPartidaEconomics({
      partidaId: "partida-1",
      resources: [
        { partidaId: "partida-1", cantidadPresupuestada: 2, precioBaseUnitario: 5, precioOfertadoUnitario: 8 },
        { partidaId: "partida-1", cantidadPresupuestada: 3, precioBaseUnitario: 10, precioOfertadoUnitario: 12 },
      ],
    });

    assert.equal(row.base, 40);
    assert.equal(row.ofertado, 52);
    assert.equal(row.margen, 12);
  });

  it("aggregates total budget across several partidas", () => {
    const summary = computeBudgetEconomics({
      partidaIds: ["partida-1", "partida-2"],
      resources: [
        { partidaId: "partida-1", cantidadPresupuestada: 2, precioBaseUnitario: 5, precioOfertadoUnitario: 8 },
        { partidaId: "partida-2", cantidadPresupuestada: 3, precioBaseUnitario: 10, precioOfertadoUnitario: 12 },
      ],
    });

    assert.equal(summary.total.base, 40);
    assert.equal(summary.total.ofertado, 52);
    assert.equal(summary.total.margen, 12);
    assert.deepEqual(
      summary.partidas.map((partida) => [partida.partidaId, partida.base, partida.ofertado]),
      [
        ["partida-1", 10, 16],
        ["partida-2", 30, 36],
      ],
    );
  });

  it("aggregates by catalog resource type without hardcoding types", () => {
    const rows = aggregateBudgetByResourceType([
      { tipoRecurso: "Materiales", cantidadPresupuestada: 2, precioBaseUnitario: 5, precioOfertadoUnitario: 8 },
      { tipoRecurso: "Materiales", cantidadPresupuestada: 3, precioBaseUnitario: 10, precioOfertadoUnitario: 12 },
      { tipoRecurso: "Servicios", cantidadPresupuestada: 1, precioBaseUnitario: 20, precioOfertadoUnitario: 30 },
    ]);

    assert.deepEqual(rows, [
      { tipoRecurso: "Materiales", base: 40, ofertado: 52, margen: 12, porcentajeMargen: 0.3 },
      { tipoRecurso: "Servicios", base: 20, ofertado: 30, margen: 10, porcentajeMargen: 0.5 },
    ]);
  });

  it("uses zero margin percentage when BASE is zero", () => {
    const row = computeBudgetResourceEconomics({
      cantidadPresupuestada: 10,
      precioBaseUnitario: 0,
      precioOfertadoUnitario: 20,
    });

    assert.equal(row.base, 0);
    assert.equal(row.ofertado, 200);
    assert.equal(row.margen, 200);
    assert.equal(row.porcentajeMargen, 0);
  });

  it("builds resumen_economico-compatible rows without persisting them", () => {
    const rows = buildBudgetEconomicSummaryRows([
      { tipoRecurso: "Equipos", cantidadPresupuestada: "4", precioBaseUnitario: "10", precioOfertadoUnitario: "12" },
    ]);

    assert.deepEqual(rows, [
      {
        tipo_recurso: "Equipos",
        base: 40,
        oferta: 48,
        margen_ofertado_manual: 8,
      },
    ]);
  });

  it("normalizes Postgres numeric strings before arithmetic", () => {
    const row = computeBudgetResourceEconomics({
      cantidadPresupuestada: "10",
      precioBaseUnitario: "15",
      precioOfertadoUnitario: "20",
    });

    assert.equal(row.base, 150);
    assert.equal(row.ofertado, 200);
    assert.equal(toBudgetNumber("12.50"), 12.5);
  });

  it("keeps decimal precision without presentation rounding", () => {
    const row = computeBudgetResourceEconomics({
      cantidadPresupuestada: "1.5",
      precioBaseUnitario: "10.25",
      precioOfertadoUnitario: "12.75",
    });

    assert.equal(row.base, 15.375);
    assert.equal(row.ofertado, 19.125);
    assert.equal(row.margen, 3.75);
  });

  it("does not drop resource types outside the current economic template", () => {
    const rows = buildBudgetEconomicSummaryRows([
      { tipoRecurso: "Tipo nuevo contractual", cantidadPresupuestada: 2, precioBaseUnitario: 10, precioOfertadoUnitario: 15 },
      { tipoRecurso: null, cantidadPresupuestada: 1, precioBaseUnitario: 5, precioOfertadoUnitario: 8 },
    ]);

    assert.deepEqual(rows, [
      { tipo_recurso: "Sin tipo", base: 5, oferta: 8, margen_ofertado_manual: 3 },
      { tipo_recurso: "Tipo nuevo contractual", base: 20, oferta: 30, margen_ofertado_manual: 10 },
    ]);
  });
});
