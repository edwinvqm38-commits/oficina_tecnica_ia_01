"use client";

import { useEffect, useMemo, useState } from "react";
import { FieldLabelIcon } from "@/components/ui/FieldLabelIcon";
import { DateTextInput } from "@/components/ui/DateTextInput";
import type { Cotizacion, EstadoRequerimiento, Requerimiento } from "@/lib/demoData";

type NewRequirementModalProps = {
  open: boolean;
  cotizaciones: Cotizacion[];
  solicitanteOptions: string[];
  tipoServicioOptions: string[];
  areaOptions: string[];
  estadoOptions: EstadoRequerimiento[];
  errorMessage?: string | null;
  onClose: () => void;
  onSave: (payload: Omit<Requerimiento, "id" | "codigo">) => void;
};

type DraftPayload = Omit<Requerimiento, "id" | "codigo">;

function inputClassName(): string {
  return "h-7 w-full rounded border border-stone-300 bg-white px-2 text-xs outline-none focus:border-stone-400";
}

export function NewRequirementModal({
  open,
  cotizaciones,
  solicitanteOptions,
  tipoServicioOptions,
  areaOptions,
  estadoOptions,
  errorMessage,
  onClose,
  onSave,
}: NewRequirementModalProps) {
  const eligibleCotizaciones = useMemo(
    () =>
      cotizaciones.filter((cot) => {
        const estado = cot.estado.toLowerCase();
        return estado.includes("adjudic") || estado.includes("ganad") || estado.includes("proyecto activo");
      }),
    [cotizaciones],
  );

  const initial = useMemo<DraftPayload>(() => {
    const firstCot = eligibleCotizaciones[0];
    const now = new Date();
    return {
      cotizacion_id: firstCot?.id ?? "",
      solicitante_rq: solicitanteOptions[0] ?? "",
      tipo_servicio: tipoServicioOptions[0] ?? "",
      area: areaOptions[0] ?? "",
      estado: estadoOptions[0] ?? "Pendiente",
      fecha_solicitud: now.toISOString().slice(0, 10),
      fecha_requerida: new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10),
      responsable: firstCot?.responsable_tecnico ?? firstCot?.responsable_economico ?? "",
      observaciones: "",
    };
  }, [eligibleCotizaciones, solicitanteOptions, tipoServicioOptions, areaOptions, estadoOptions]);

  const [draft, setDraft] = useState<DraftPayload>(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/20 p-3 md:p-4">
      <div className="mx-auto flex w-[96vw] max-w-[680px] flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <FieldLabelIcon icon="clipboard-list" label="Nuevo requerimiento" className="text-sm font-semibold text-stone-800" />
          <button
            onClick={onClose}
            className="inline-flex h-7 items-center rounded-md border border-border px-2.5 text-xs text-stone-700 hover:bg-stone-100"
          >
            Cerrar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-2">
          {eligibleCotizaciones.length === 0 ? (
            <p className="md:col-span-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              Solo se puede crear un RQ desde una cotización adjudicada o ganada.
            </p>
          ) : null}
          {errorMessage ? (
            <p className="md:col-span-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              {errorMessage}
            </p>
          ) : null}
          <div>
            <FieldLabelIcon icon="file-text" label="Cotización" className="mb-1 text-[11px] text-stone-600" />
            <select
              value={draft.cotizacion_id}
              onChange={(event) => setDraft((prev) => ({ ...prev, cotizacion_id: event.target.value }))}
              className={inputClassName()}
              disabled={eligibleCotizaciones.length === 0}
            >
              {eligibleCotizaciones.map((cot) => (
                <option key={cot.id} value={cot.id}>
                  {cot.codigo} · {cot.cliente}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabelIcon icon="user" label="Solicitante de RQ" className="mb-1 text-[11px] text-stone-600" />
            <select
              value={draft.solicitante_rq}
              onChange={(event) => setDraft((prev) => ({ ...prev, solicitante_rq: event.target.value }))}
              className={inputClassName()}
            >
              {solicitanteOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabelIcon icon="tags" label="Tipo de servicio" className="mb-1 text-[11px] text-stone-600" />
            <select
              value={draft.tipo_servicio}
              onChange={(event) => setDraft((prev) => ({ ...prev, tipo_servicio: event.target.value }))}
              className={inputClassName()}
            >
              {tipoServicioOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabelIcon icon="layout-grid" label="Área" className="mb-1 text-[11px] text-stone-600" />
            <select
              value={draft.area}
              onChange={(event) => setDraft((prev) => ({ ...prev, area: event.target.value }))}
              className={inputClassName()}
            >
              {areaOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabelIcon icon="circle-dot" label="Estado" className="mb-1 text-[11px] text-stone-600" />
            <select
              value={draft.estado}
              onChange={(event) => setDraft((prev) => ({ ...prev, estado: event.target.value as EstadoRequerimiento }))}
              className={inputClassName()}
            >
              {estadoOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabelIcon icon="user" label="Responsable" className="mb-1 text-[11px] text-stone-600" />
            <input
              value={draft.responsable}
              onChange={(event) => setDraft((prev) => ({ ...prev, responsable: event.target.value }))}
              className={inputClassName()}
            />
          </div>
          <div>
            <FieldLabelIcon icon="calendar" label="Fecha solicitud" className="mb-1 text-[11px] text-stone-600" />
            <DateTextInput
              value={draft.fecha_solicitud}
              onChange={(value) => setDraft((prev) => ({ ...prev, fecha_solicitud: value }))}
              className={inputClassName()}
            />
          </div>
          <div>
            <FieldLabelIcon icon="calendar-days" label="Fecha requerida" className="mb-1 text-[11px] text-stone-600" />
            <DateTextInput
              value={draft.fecha_requerida}
              onChange={(value) => setDraft((prev) => ({ ...prev, fecha_requerida: value }))}
              className={inputClassName()}
            />
          </div>
          <div className="md:col-span-2">
            <FieldLabelIcon icon="align-left" label="Observaciones" className="mb-1 text-[11px] text-stone-600" />
            <input
              value={draft.observaciones}
              onChange={(event) => setDraft((prev) => ({ ...prev, observaciones: event.target.value }))}
              className={inputClassName()}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1 text-xs text-stone-700 hover:bg-stone-100">
            Cancelar
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={eligibleCotizaciones.length === 0 || !draft.cotizacion_id}
            className="rounded-md border border-border bg-stone-100 px-3 py-1 text-xs font-medium text-stone-800 hover:bg-stone-200"
          >
            Guardar requerimiento
          </button>
        </div>
      </div>
    </div>
  );
}
