"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LocalEvidencePicker, formatFileSize } from "@/components/sgp/ObservationDocumentUpload";
import type { EditableRequirementItem, RequirementObservationStatus } from "@/components/sgp/RequirementItemsGrid";
import { FieldLabelIcon } from "@/components/sgp/ui/FieldLabelIcon";

export type ObservationPriority = "low" | "medium" | "high" | "critical";
export type ObservationWorkflowStatus = "pending" | "answered" | "under_review" | "resolved" | "reopened";
export type ObservationEvidenceAssociation = "observation" | "response";

export type ObservationEvidence = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  localObjectUrl: string;
  associatedTo: ObservationEvidenceAssociation;
  observationId: string;
  responseId?: string;
  createdAt: string;
};

export type ObservationResponse = {
  id: string;
  observationId: string;
  responseText: string;
  author: string;
  createdAt: string;
  evidenceFiles: ObservationEvidence[];
};

export type ObservationStatusHistoryEntry = {
  id: string;
  status: ObservationWorkflowStatus;
  author: string;
  createdAt: string;
  note?: string;
};

export type RequirementObservation = {
  id: string;
  code: string;
  requirementId: string;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  description: string;
  priority: ObservationPriority;
  requiresEvidence: boolean;
  status: ObservationWorkflowStatus;
  author: string;
  createdAt: string;
  initialEvidence: ObservationEvidence[];
  responses: ObservationResponse[];
  statusHistory: ObservationStatusHistoryEntry[];
};

type RequirementObservationPanelProps = {
  selectedItem: EditableRequirementItem | null;
  observations: RequirementObservation[];
  selectedObservationId: string | null;
  selectedObservation: RequirementObservation | null;
  requirementCode: string;
  footer?: ReactNode;
  onClose: () => void;
  onSelectObservation: (observationId: string) => void;
  onCreateObservation: (input: {
    description: string;
    priority: ObservationPriority;
    requiresEvidence: boolean;
    files: File[];
  }) => void;
  onAddResponse: (observationId: string, responseText: string, files: File[]) => void;
  onSendToReview: (observationId: string) => void;
  onResolveObservation: (observationId: string) => void;
  onReopenObservation: (observationId: string, reason: string) => void;
};

const PRIORITY_OPTIONS: Array<{ value: ObservationPriority; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

export function observationStatusLabel(status: ObservationWorkflowStatus): string {
  if (status === "pending") return "Pendiente";
  if (status === "answered") return "Respondida";
  if (status === "under_review") return "En revisión";
  if (status === "resolved") return "Levantada";
  return "Reabierta";
}

export function observationStatusForItem(observations: RequirementObservation[]): RequirementObservationStatus {
  if (observations.length === 0) return "Sin observación";
  if (observations.some((observation) => observation.status === "pending" || observation.status === "reopened")) return "Observado";
  if (observations.some((observation) => observation.status === "answered" || observation.status === "under_review")) return "En seguimiento";
  return "Levantado";
}

export function observationEvidenceCount(observation: RequirementObservation): number {
  return observation.initialEvidence.length + observation.responses.reduce((total, response) => total + response.evidenceFiles.length, 0);
}

export function observationCanResolveReason(observation: RequirementObservation): string | null {
  if (observation.responses.length === 0) return "Registre una respuesta";
  if (observation.requiresEvidence && !observation.responses.some((response) => response.evidenceFiles.length > 0)) {
    return "Adjunte evidencia en una respuesta";
  }
  if (observation.status !== "under_review") return "Envíe primero la observación a revisión";
  return null;
}

function priorityLabel(priority: ObservationPriority): string {
  return PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? priority;
}

function priorityClassName(priority: ObservationPriority): string {
  if (priority === "critical") return "border-rose-300 bg-rose-100 text-rose-800";
  if (priority === "high") return "border-orange-200 bg-orange-50 text-orange-700";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function statusClassName(status: ObservationWorkflowStatus): string {
  if (status === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "under_review") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "answered") return "border-teal-200 bg-teal-50 text-teal-700";
  if (status === "reopened") return "border-purple-200 bg-purple-50 text-purple-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function panelButtonClassName(kind: "secondary" | "primary" | "success" = "secondary"): string {
  if (kind === "primary") {
    return "inline-flex h-7 items-center justify-center rounded border border-teal-700 bg-teal-700 px-2.5 text-[11px] font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50";
  }
  if (kind === "success") {
    return "inline-flex h-7 items-center justify-center rounded border border-emerald-700 bg-emerald-700 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50";
  }
  return "inline-flex h-7 items-center justify-center rounded border border-stone-200 bg-white px-2.5 text-[11px] font-semibold text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50";
}

function EvidenceRows({ files }: { files: ObservationEvidence[] }) {
  if (!files.length) return <p className="text-[11px] text-stone-400">Sin evidencias asociadas.</p>;
  return (
    <div className="space-y-1">
      {files.map((file) => (
        <a
          key={file.id}
          href={file.localObjectUrl || "#"}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            if (!file.localObjectUrl) event.preventDefault();
          }}
          className="block rounded border border-stone-200 bg-stone-50 px-2 py-1.5 hover:bg-white"
        >
          <span className="block truncate text-[11px] font-semibold text-stone-700" title={file.name}>
            {file.name}
          </span>
          <span className="mt-0.5 block text-[10px] text-stone-500">
            {file.mimeType || "archivo"} · {formatFileSize(file.size)}
          </span>
        </a>
      ))}
    </div>
  );
}

export function RequirementObservationPanel({
  selectedItem,
  observations,
  selectedObservationId,
  selectedObservation,
  requirementCode,
  footer,
  onClose,
  onSelectObservation,
  onCreateObservation,
  onAddResponse,
  onSendToReview,
  onResolveObservation,
  onReopenObservation,
}: RequirementObservationPanelProps) {
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ObservationPriority>("medium");
  const [requiresEvidence, setRequiresEvidence] = useState(true);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const [responseText, setResponseText] = useState("");
  const [responseFiles, setResponseFiles] = useState<File[]>([]);
  const [reopenReason, setReopenReason] = useState("");
  const [showReopenReason, setShowReopenReason] = useState(false);

  const pendingCount = useMemo(
    () => observations.filter((observation) => observation.status !== "resolved").length,
    [observations],
  );
  const resolvedCount = useMemo(
    () => observations.filter((observation) => observation.status === "resolved").length,
    [observations],
  );
  const generalStatus = observationStatusForItem(observations);
  const resolveDisabledReason = selectedObservation ? observationCanResolveReason(selectedObservation) : "Seleccione una observación";
  const canSendToReview = Boolean(
    selectedObservation &&
      selectedObservation.responses.length > 0 &&
      selectedObservation.status !== "under_review" &&
      selectedObservation.status !== "resolved",
  );

  function submitObservation() {
    const trimmed = description.trim();
    if (!selectedItem || !trimmed) return;
    onCreateObservation({ description: trimmed, priority, requiresEvidence, files: initialFiles });
    setDescription("");
    setPriority("medium");
    setRequiresEvidence(true);
    setInitialFiles([]);
  }

  function submitResponse() {
    const trimmed = responseText.trim();
    if (!selectedObservation || !trimmed) return;
    onAddResponse(selectedObservation.id, trimmed, responseFiles);
    setResponseText("");
    setResponseFiles([]);
    setShowReopenReason(false);
    setReopenReason("");
  }

  function submitReopen() {
    const trimmed = reopenReason.trim();
    if (!selectedObservation || !trimmed) return;
    onReopenObservation(selectedObservation.id, trimmed);
    setShowReopenReason(false);
    setReopenReason("");
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-border bg-white lg:rounded-r-xl">
      <div className="flex flex-none items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <FieldLabelIcon icon="clipboard-list" label="Observaciones del recurso" className="text-xs font-medium" />
            <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${statusClassName(generalStatus === "Levantado" ? "resolved" : generalStatus === "En seguimiento" ? "under_review" : "pending")}`}>
              {generalStatus}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-stone-500" title={selectedItem?.descripcion || ""}>
            {selectedItem ? selectedItem.descripcion || selectedItem.recurso_a_suministrar || "Recurso sin descripción" : "Selecciona un recurso"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Cerrar panel"
          aria-label="Cerrar panel de observaciones"
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-stone-200 text-[11px] text-stone-500 hover:bg-stone-100"
        >
          x
        </button>
      </div>

      {selectedItem ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="rounded border border-stone-200 bg-stone-50 p-2">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <span className="font-semibold text-stone-500">Código</span>
              <span className="truncate text-right font-semibold text-stone-800" title={selectedItem.codigo_fabricante || selectedItem.codigo_recurso}>
                {selectedItem.codigo_fabricante || selectedItem.codigo_recurso || "-"}
              </span>
              <span className="font-semibold text-stone-500">Tipo</span>
              <span className="truncate text-right text-stone-700" title={selectedItem.tipo_recurso}>
                {selectedItem.tipo_recurso || "-"}
              </span>
              <span className="font-semibold text-stone-500">Cantidad</span>
              <span className="text-right text-stone-700">
                {selectedItem.cantidad} {selectedItem.unidad || ""}
              </span>
              <span className="font-semibold text-stone-500">Pendientes</span>
              <span className="text-right text-stone-700">{pendingCount}</span>
              <span className="font-semibold text-stone-500">Levantadas</span>
              <span className="text-right text-stone-700">{resolvedCount}</span>
            </div>
            <div className="mt-2 flex flex-wrap justify-end gap-1.5">
              <a
                href={`/requerimientos?rqCode=${encodeURIComponent(requirementCode)}&item=${encodeURIComponent(selectedItem.id)}`}
                onClick={(event) => event.preventDefault()}
                className={panelButtonClassName()}
                title="Link simulado al recurso"
              >
                Abrir recurso
              </a>
              <a
                href={`/requerimientos?rqCode=${encodeURIComponent(requirementCode)}`}
                onClick={(event) => event.preventDefault()}
                className={panelButtonClassName()}
                title="Link simulado al RQ"
              >
                Abrir RQ
              </a>
            </div>
          </div>

          <div className="mt-2 rounded border border-stone-200 bg-white p-2">
            <p className="mb-2 text-[11px] font-semibold text-stone-700">Nueva observación</p>
            <label className="block text-[10.5px] font-semibold text-stone-500">
              Descripción del hallazgo
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="mt-1 w-full resize-none rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 outline-none focus:border-teal-500"
                placeholder="Describe la observación técnica"
              />
            </label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-[10.5px] font-semibold text-stone-500">
                Prioridad
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as ObservationPriority)}
                  className="mt-1 h-7 w-full rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 outline-none focus:border-teal-500"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 rounded border border-stone-200 bg-stone-50 px-2 py-1 text-[10.5px] font-semibold text-stone-600">
                <input
                  type="checkbox"
                  checked={requiresEvidence}
                  onChange={(event) => setRequiresEvidence(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-stone-300 text-teal-700"
                />
                Requiere evidencia para levantar
              </label>
            </div>
            <div className="mt-2">
              <LocalEvidencePicker
                files={initialFiles}
                onFilesChange={setInitialFiles}
                label="Adjuntar evidencia inicial"
                helperText="Opcional. Queda asociada a la observación inicial."
              />
            </div>
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={submitObservation} disabled={!description.trim()} className={panelButtonClassName("primary")}>
                Registrar observación
              </button>
            </div>
          </div>

          <div className="mt-2 rounded border border-stone-200 bg-white">
            <div className="flex items-center justify-between border-b border-stone-200 px-2 py-1.5">
              <p className="text-[11px] font-semibold text-stone-700">Listado de observaciones</p>
              <span className="text-[10px] font-semibold text-stone-400">{observations.length}</span>
            </div>
            <div className="max-h-[220px] overflow-auto p-1.5">
              {observations.length ? (
                observations.map((observation) => (
                  <button
                    key={observation.id}
                    type="button"
                    onClick={() => onSelectObservation(observation.id)}
                    className={`mb-1.5 block w-full rounded border px-2 py-1.5 text-left hover:bg-stone-50 ${
                      selectedObservationId === observation.id ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-[11px] font-semibold text-stone-800" title={observation.description}>
                        {observation.code} · {observation.description}
                      </span>
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9.5px] font-semibold ${priorityClassName(observation.priority)}`}>
                        {priorityLabel(observation.priority)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
                      <span className={`rounded border px-1.5 py-0.5 font-semibold ${statusClassName(observation.status)}`}>
                        {observationStatusLabel(observation.status)}
                      </span>
                      <span>{observation.author}</span>
                      <span>{observation.createdAt}</span>
                      <span>{observation.responses.length} respuestas</span>
                      <span>{observationEvidenceCount(observation)} evidencias</span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="px-2 py-4 text-center text-[11px] text-stone-400">Sin observaciones para este recurso.</p>
              )}
            </div>
          </div>

          <div className="mt-2 rounded border border-stone-200 bg-white p-2">
            <p className="mb-2 text-[11px] font-semibold text-stone-700">Respuestas y evidencias</p>
            {selectedObservation ? (
              <div className="space-y-2">
                <div className="rounded border border-stone-200 bg-stone-50 p-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded border border-stone-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-stone-700">
                      {selectedObservation.code}
                    </span>
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${statusClassName(selectedObservation.status)}`}>
                      {observationStatusLabel(selectedObservation.status)}
                    </span>
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${priorityClassName(selectedObservation.priority)}`}>
                      {priorityLabel(selectedObservation.priority)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[11px] text-stone-700">{selectedObservation.description}</p>
                  <div className="mt-2">
                    <p className="mb-1 text-[10px] font-semibold text-stone-500">Evidencia inicial</p>
                    <EvidenceRows files={selectedObservation.initialEvidence} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  {selectedObservation.responses.length ? (
                    selectedObservation.responses.map((response) => (
                      <div key={response.id} className="rounded border border-stone-200 bg-white p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-stone-500">
                          <span className="font-semibold text-stone-700">{response.author}</span>
                          <span>{response.createdAt}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-[11px] text-stone-700">{response.responseText}</p>
                        <div className="mt-2">
                          <p className="mb-1 text-[10px] font-semibold text-stone-500">Evidencia de la respuesta</p>
                          <EvidenceRows files={response.evidenceFiles} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded border border-stone-200 bg-stone-50 px-2 py-3 text-center text-[11px] text-stone-400">
                      Sin respuestas registradas.
                    </p>
                  )}
                </div>

                <div className="rounded border border-stone-200 bg-stone-50 p-2">
                  <label className="block text-[10.5px] font-semibold text-stone-500">
                    Responder observación
                    <textarea
                      value={responseText}
                      onChange={(event) => setResponseText(event.target.value)}
                      rows={3}
                      className="mt-1 w-full resize-none rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 outline-none focus:border-teal-500"
                      placeholder="Describe la respuesta o acción correctiva"
                    />
                  </label>
                  <div className="mt-2">
                    <LocalEvidencePicker
                      files={responseFiles}
                      onFilesChange={setResponseFiles}
                      label="Adjuntar evidencia a la respuesta"
                      helperText="Cada archivo queda asociado a esta respuesta."
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button type="button" onClick={submitResponse} disabled={!responseText.trim()} className={panelButtonClassName("primary")}>
                      Registrar respuesta
                    </button>
                  </div>
                </div>

                <div className="rounded border border-stone-200 bg-white p-2">
                  <p className="mb-2 text-[11px] font-semibold text-stone-700">Revisión y levantamiento</p>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSendToReview(selectedObservation.id)}
                      disabled={!canSendToReview}
                      title={!canSendToReview ? "Registre una respuesta" : "Enviar a revisión"}
                      className={panelButtonClassName()}
                    >
                      Enviar a revisión
                    </button>
                    <button
                      type="button"
                      onClick={() => onResolveObservation(selectedObservation.id)}
                      disabled={Boolean(resolveDisabledReason)}
                      title={resolveDisabledReason ?? "Levantar observación"}
                      className={panelButtonClassName("success")}
                    >
                      Levantar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReopenReason((current) => !current)}
                      disabled={selectedObservation.status !== "resolved"}
                      title={selectedObservation.status !== "resolved" ? "Solo se puede reabrir una observación levantada" : "Reabrir observación"}
                      className={panelButtonClassName()}
                    >
                      Reabrir
                    </button>
                  </div>
                  {resolveDisabledReason ? (
                    <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800">
                      {resolveDisabledReason}
                    </p>
                  ) : null}
                  {showReopenReason ? (
                    <div className="mt-2 rounded border border-stone-200 bg-stone-50 p-2">
                      <label className="block text-[10.5px] font-semibold text-stone-500">
                        Motivo de reapertura
                        <textarea
                          value={reopenReason}
                          onChange={(event) => setReopenReason(event.target.value)}
                          rows={2}
                          className="mt-1 w-full resize-none rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 outline-none focus:border-teal-500"
                          placeholder="Indica por qué se reabre"
                        />
                      </label>
                      <div className="mt-2 flex justify-end">
                        <button type="button" onClick={submitReopen} disabled={!reopenReason.trim()} className={panelButtonClassName("primary")}>
                          Confirmar reapertura
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-2 max-h-[110px] overflow-auto rounded border border-stone-200 bg-stone-50">
                    {selectedObservation.statusHistory.map((entry) => (
                      <div key={entry.id} className="border-b border-stone-100 px-2 py-1.5 last:border-b-0">
                        <p className="text-[10.5px] font-semibold text-stone-700">
                          {observationStatusLabel(entry.status)} · {entry.author}
                        </p>
                        <p className="text-[10px] text-stone-500">{entry.createdAt}</p>
                        {entry.note ? <p className="mt-0.5 text-[10px] text-stone-600">{entry.note}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-stone-400">Selecciona una observación para revisar respuestas y evidencias.</p>
            )}
          </div>
          {footer ? <div className="mt-2">{footer}</div> : null}
        </div>
      ) : null}
    </aside>
  );
}
