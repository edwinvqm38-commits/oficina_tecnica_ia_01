import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  applyReviewedPriceToBudgetLines,
  assertBudgetPriceReviewAllowed,
  canApplyHistoryToResource,
  consolidateBudgetPriceReviewResources,
  createHistoricalPriceFromReview,
  markBudgetResourcePriceMaintained,
  type BudgetPriceReviewLine,
  // @ts-expect-error Node 24 ejecuta tests TypeScript con extension explicita.
} from "./quotationBudgetPriceReview.ts";

const masterCable = { recursoId: "resource-cable", precioUnitarioRef: 10, monedaCodigo: "PEN" };
const laterMasterCable = { recursoId: "resource-cable", precioUnitarioRef: 15, monedaCodigo: "PEN" };
const priceHistoryMigrationPath = join(process.cwd(), "supabase", "migrations", "20260827162524_ag2c2e_p1_resource_price_history.sql");

function line(overrides: Partial<BudgetPriceReviewLine> = {}): BudgetPriceReviewLine {
  return {
    id: "line-1",
    presupuestoId: "budget-a",
    cotizacionId: "quote-a",
    recursoId: "resource-cable",
    codigo: "MAT-2026-0001",
    descripcion: "Cable X",
    tipo: "Materiales",
    unidad: "m",
    cantidad: 100,
    precioBaseUnitario: 10,
    precioOfertadoUnitario: 12,
    precioBaseOrigen: "MAESTRO",
    precioHistoricoId: null,
    precioRevisado: false,
    ...overrides,
  };
}

describe("quotation budget price review", () => {
  it("starts a new budget line from the current master price snapshot", () => {
    const budgetLine = line({ precioBaseUnitario: masterCable.precioUnitarioRef, precioBaseOrigen: "MAESTRO" });

    assert.equal(budgetLine.precioBaseUnitario, 10);
    assert.equal(budgetLine.precioBaseOrigen, "MAESTRO");
  });

  it("keeps budget snapshot when the master price changes later", () => {
    const budgetLine = line({ precioBaseUnitario: masterCable.precioUnitarioRef });
    const consolidated = consolidateBudgetPriceReviewResources({
      lines: [budgetLine],
      masters: [laterMasterCable],
      histories: [],
    });

    assert.equal(consolidated[0].precioBasePresupuesto, 10);
    assert.equal(consolidated[0].precioMaestroActual, 15);
  });

  it("updates all repeated resource lines only within the selected budget", () => {
    const lines = [
      line({ id: "a", cantidad: 100 }),
      line({ id: "b", cantidad: 80 }),
      line({ id: "c", cantidad: 50 }),
      line({ id: "other-budget", presupuestoId: "budget-b", cotizacionId: "quote-b", cantidad: 20 }),
    ];

    const result = applyReviewedPriceToBudgetLines({
      lines,
      presupuestoId: "budget-a",
      recursoId: "resource-cable",
      precioUnitario: 15,
      origen: "MAESTRO",
    });

    assert.deepEqual(result.affectedIds, ["a", "b", "c"]);
    assert.equal(result.updated.find((row) => row.id === "other-budget")?.precioBaseUnitario, 10);
  });

  it("leaves another quotation with the same resource intact", () => {
    const result = applyReviewedPriceToBudgetLines({
      lines: [line({ id: "quote-a-line" }), line({ id: "quote-b-line", presupuestoId: "budget-b", cotizacionId: "quote-b" })],
      presupuestoId: "budget-a",
      recursoId: "resource-cable",
      precioUnitario: 18,
      origen: "HISTORICO",
      precioHistoricoId: "history-1",
    });

    assert.equal(result.updated.find((row) => row.id === "quote-a-line")?.precioBaseUnitario, 18);
    assert.equal(result.updated.find((row) => row.id === "quote-b-line")?.precioBaseUnitario, 10);
  });

  it("reuses a resource history in a later budget for the same resource_id", () => {
    const history = createHistoricalPriceFromReview({
      id: "history-1",
      recursoId: "resource-cable",
      precioUnitario: 14,
      monedaCodigo: "PEN",
      fechaPrecio: "2026-08-27",
      proveedorSnapshot: "Proveedor A",
      fuenteTipo: "COTIZACION_PROVEEDOR",
    });

    const consolidated = consolidateBudgetPriceReviewResources({
      lines: [line({ presupuestoId: "budget-later", cotizacionId: "quote-later" })],
      masters: [laterMasterCable],
      histories: [history],
    });

    assert.equal(consolidated[0].histories[0].id, "history-1");
  });

  it("does not allow applying resource A history to resource B", () => {
    assert.equal(canApplyHistoryToResource("resource-b", { recursoId: "resource-cable" }), false);
  });

  it("registers a new historical price and snapshots it into the budget", () => {
    const history = createHistoricalPriceFromReview({
      id: "history-new",
      recursoId: "resource-cable",
      precioUnitario: 16,
      monedaCodigo: "PEN",
      fechaPrecio: "2026-08-27",
      fuenteTipo: "MANUAL",
    });
    const result = applyReviewedPriceToBudgetLines({
      lines: [line()],
      presupuestoId: "budget-a",
      recursoId: history.recursoId,
      precioUnitario: history.precioUnitario,
      origen: "NUEVO_PRECIO",
      precioHistoricoId: history.id,
    });

    assert.equal(result.updated[0].precioBaseUnitario, 16);
    assert.equal(result.updated[0].precioHistoricoId, "history-new");
    assert.equal(result.updated[0].precioBaseOrigen, "NUEVO_PRECIO");
  });

  it("marking maintain does not create a duplicate history", () => {
    const histories = [createHistoricalPriceFromReview({ id: "history-1", recursoId: "resource-cable", precioUnitario: 11, monedaCodigo: "PEN", fechaPrecio: "2026-08-01", fuenteTipo: "MANUAL" })];
    const result = markBudgetResourcePriceMaintained({ lines: [line()], presupuestoId: "budget-a", recursoId: "resource-cable" });

    assert.equal(result.updated[0].precioRevisado, true);
    assert.equal(histories.length, 1);
  });

  it("blocks LISTO and ADJUDICADO budget states", () => {
    assert.throws(() => assertBudgetPriceReviewAllowed({ estado: "LISTO_PARA_ADJUDICAR", canEdit: true, canViewPrices: true }), /BORRADOR/);
    assert.throws(() => assertBudgetPriceReviewAllowed({ estado: "ADJUDICADO", canEdit: true, canViewPrices: true }), /BORRADOR/);
  });

  it("blocks users without economic permission", () => {
    assert.throws(() => assertBudgetPriceReviewAllowed({ estado: "BORRADOR", canEdit: true, canViewPrices: false }), /permiso economico/);
  });

  it("keeps resource price history RLS scoped to quotation economic permission", () => {
    const sql = readFileSync(priceHistoryMigrationPath, "utf8");
    const selectPolicyMatch = sql.match(/create policy recurso_precios_historicos_select_by_price_permission[\s\S]*?;\r?\n\r?\ndrop policy/i);

    assert.ok(selectPolicyMatch);
    assert.match(selectPolicyMatch[0], /public\.can_use_module\('cotizaciones', 'view'\)/);
    assert.match(selectPolicyMatch[0], /public\.can_view_module_prices\('cotizaciones'\)/);
    assert.doesNotMatch(selectPolicyMatch[0], /can_view_module_prices\('recursos'\)/);
    assert.doesNotMatch(sql, /grant\s+(?:select,\s*)?insert\s+on\s+public\.recurso_precios_historicos\s+to\s+authenticated/i);
    assert.doesNotMatch(sql, /for\s+(?:insert|update|delete)\s+to\s+authenticated/i);
  });

  it("consolidates repeated quantities with compatible units", () => {
    const consolidated = consolidateBudgetPriceReviewResources({
      lines: [line({ id: "a", cantidad: 100 }), line({ id: "b", cantidad: 80 }), line({ id: "c", cantidad: 50 })],
      masters: [masterCable],
      histories: [],
    });

    assert.equal(consolidated[0].apariciones, 3);
    assert.equal(consolidated[0].cantidadTotal, 230);
  });

  it("marks incompatible units as not safely sumable", () => {
    const consolidated = consolidateBudgetPriceReviewResources({
      lines: [line({ id: "a", unidad: "m", cantidad: 100 }), line({ id: "b", unidad: "und", cantidad: 2 })],
      masters: [masterCable],
      histories: [],
    });

    assert.equal(consolidated[0].hasIncompatibleUnits, true);
    assert.equal(consolidated[0].cantidadTotal, null);
  });
});
