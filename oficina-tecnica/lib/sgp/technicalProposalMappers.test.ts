import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Cotizacion } from "@/lib/sgp/demoData";
import {
  buildTechnicalProposalRpcPayload,
  type TechnicalProposalDraftLike,
  // @ts-expect-error Node 24 ejecuta tests TypeScript con extension explicita.
} from "./technicalProposalMappers.ts";

const cotizacion = {
  id: "99999999-9999-4999-8999-999999999999",
  codigo: "COT-2026-0001",
  cliente: "Cliente",
  proyecto: "Proyecto",
  unidad_trabajo: "OT",
} as Cotizacion;

function buildDraft(propuestaTecnicaId?: string | null): TechnicalProposalDraftLike {
  return {
    metadata: {
      cotizacion_codigo: cotizacion.codigo,
      documento_codigo: `${cotizacion.codigo}-PT-REV01`,
      documento_tipo: "PT",
      revision: "REV01",
      subcarpeta_revision: "02_PROPUESTA_REV01",
      archivo_docx: `${cotizacion.codigo}-PT-REV01.docx`,
      archivo_pdf: `${cotizacion.codigo}-PT-REV01.pdf`,
      estructura_documental_version: "cotizacion_drive_v2",
      propuesta_tecnica_id: propuestaTecnicaId,
    },
    mode: "cliente",
    work_status: "Borrador",
    header: { fecha: "2026-08-27" },
    recipient: {},
    presentation: {},
    conditions: {},
    scope_items: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        level: 0,
        number: "1",
        kind: "activity",
        title: "Instalacion",
        description: "",
        time_value: 1,
        time_unit: "dias",
        complete: false,
        internal_comments: "",
      },
    ],
    resources: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        scope_item_id: "11111111-1111-4111-8111-111111111111",
        recurso_id: "33333333-3333-4333-8333-333333333333",
        codigo_recurso: "MAT-2026-0001",
        codigo_fabricante: "FAB-1",
        tipo_recurso: "Materiales",
        resource_category: "materiales",
        descripcion: "Cable",
        unidad: "m",
        precio_unitario_ref: 10,
        moneda: "PEN",
        proveedor: "Proveedor",
        marca: "Marca",
        cantidad: 1,
        tiempo: 0,
        comentario: "",
        detalle_adicional: "",
        estado_origen: "catalogo_copiado",
      },
    ],
    general_images: [],
    activity_images: [],
    updated_at: "2026-08-27T00:00:00.000Z",
  };
}

describe("technical proposal RPC payload", () => {
  it("sends proposal id only for persisted revision updates", () => {
    const proposalId = "44444444-4444-4444-8444-444444444444";
    const persistedPayload = buildTechnicalProposalRpcPayload(buildDraft(proposalId), cotizacion);
    const newRevisionPayload = buildTechnicalProposalRpcPayload(buildDraft(null), cotizacion);

    assert.equal(persistedPayload.proposal.id, proposalId);
    assert.equal(newRevisionPayload.proposal.id, null);
  });

  it("does not send item/resource UUIDs as database primary keys", () => {
    const payload = buildTechnicalProposalRpcPayload(buildDraft("44444444-4444-4444-8444-444444444444"), cotizacion);

    assert.equal(Object.hasOwn(payload.items[0], "id"), false);
    assert.equal(Object.hasOwn(payload.resources[0], "id"), false);
    assert.equal(payload.items[0].client_key, "11111111-1111-4111-8111-111111111111");
    assert.equal(payload.resources[0].client_item_key, "11111111-1111-4111-8111-111111111111");
  });

  it("preserves complex structural order in sort_order and parent keys", () => {
    const draft = buildDraft(null);
    draft.scope_items = [
      { id: "group-a", level: 0, number: "1", kind: "group", title: "GROUP A", description: "", time_value: 0, time_unit: "", complete: true, internal_comments: "" },
      { id: "subgroup-a", level: 1, number: "1.1", kind: "subgroup", title: "SUBGROUP A", description: "", time_value: 0, time_unit: "", complete: true, internal_comments: "" },
      { id: "activity-a", level: 2, number: "1.1.1", kind: "activity", title: "ACTIVITY A", description: "", time_value: 1, time_unit: "dias", complete: true, internal_comments: "" },
      { id: "activity-b", level: 2, number: "1.1.2", kind: "activity", title: "ACTIVITY B", description: "", time_value: 1, time_unit: "dias", complete: true, internal_comments: "" },
      { id: "subgroup-b", level: 1, number: "1.2", kind: "subgroup", title: "SUBGROUP B", description: "", time_value: 0, time_unit: "", complete: true, internal_comments: "" },
      { id: "activity-c", level: 2, number: "1.2.1", kind: "activity", title: "ACTIVITY C", description: "", time_value: 1, time_unit: "dias", complete: true, internal_comments: "" },
      { id: "group-b", level: 0, number: "2", kind: "group", title: "GROUP B", description: "", time_value: 0, time_unit: "", complete: true, internal_comments: "" },
      { id: "activity-d", level: 1, number: "2.1", kind: "activity", title: "ACTIVITY D", description: "", time_value: 1, time_unit: "dias", complete: true, internal_comments: "" },
    ];
    draft.resources = [];

    const payload = buildTechnicalProposalRpcPayload(draft, cotizacion);

    assert.deepEqual(
      payload.items.map((item) => [item.client_key, item.item_type, item.parent_client_key, item.sort_order]),
      [
        ["group-a", "group", null, 0],
        ["subgroup-a", "subgroup", "group-a", 1],
        ["activity-a", "activity", "subgroup-a", 2],
        ["activity-b", "activity", "subgroup-a", 3],
        ["subgroup-b", "subgroup", "group-a", 4],
        ["activity-c", "activity", "subgroup-b", 5],
        ["group-b", "group", null, 6],
        ["activity-d", "activity", "group-b", 7],
      ],
    );
  });

  it("preserves mixed group activity and subgroup activity structure", () => {
    const draft = buildDraft(null);
    draft.scope_items = [
      { id: "group-a", level: 0, number: "1", kind: "group", title: "GROUP A", description: "", time_value: 0, time_unit: "", complete: true, internal_comments: "" },
      { id: "activity-a", level: 1, number: "1.1", kind: "activity", title: "ACTIVITY A", description: "", time_value: 1, time_unit: "dias", complete: true, internal_comments: "" },
      { id: "group-b", level: 0, number: "2", kind: "group", title: "GROUP B", description: "", time_value: 0, time_unit: "", complete: true, internal_comments: "" },
      { id: "subgroup-b", level: 1, number: "2.1", kind: "subgroup", title: "SUBGROUP B", description: "", time_value: 0, time_unit: "", complete: true, internal_comments: "" },
      { id: "activity-b", level: 2, number: "2.1.1", kind: "activity", title: "ACTIVITY B", description: "", time_value: 1, time_unit: "dias", complete: true, internal_comments: "" },
    ];
    draft.resources = [];

    const payload = buildTechnicalProposalRpcPayload(draft, cotizacion);

    assert.deepEqual(
      payload.items.map((item) => [item.client_key, item.item_type, item.parent_client_key, item.level, item.sort_order]),
      [
        ["group-a", "group", null, 0, 0],
        ["activity-a", "activity", "group-a", 1, 1],
        ["group-b", "group", null, 0, 2],
        ["subgroup-b", "subgroup", "group-b", 1, 3],
        ["activity-b", "activity", "subgroup-b", 2, 4],
      ],
    );
  });
});
