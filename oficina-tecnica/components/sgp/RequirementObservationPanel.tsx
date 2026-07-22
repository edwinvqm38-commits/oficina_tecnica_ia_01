"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LocalEvidencePicker, formatFileSize } from "@/components/sgp/ObservationDocumentUpload";
import type { EditableRequirementItem, RequirementObservationStatus } from "@/components/sgp/RequirementItemsGrid";
import { FieldLabelIcon } from "@/components/sgp/ui/FieldLabelIcon";

export type ObservationPriority = "low" | "medium" | "high" | "critical";
export type ObservationWorkflowStatus =
  | "pending"
  | "under_review"
  | "correction_requested"
  | "resolved"
  | "reopened"
  | "answered";
export type ObservationEvidenceAssociation = "observation" | "response";
export type ObservationAssignmentSource = "rq_requester" | "requirement_responsible" | "manual";

export type ObservationUser = {
  id: string;
  email?: string;
  displayName: string;
  role?: string | null;
  isSuperAdmin?: boolean | null;
};

export type ObservationEvidence = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  localObjectUrl: string;
  associatedTo: ObservationEvidenceAssociation;
  observationId: string;
  responseId?: string;
  uploadedByUserId: string;
  createdAt: string;
};

export type ObservationResponse = {
  id: string;
  observationId: string;
  responseText: string;
  authorUserId: string;
  createdAt: string;
  evidenceFiles: ObservationEvidence[];
};

export type ObservationStatusHistoryEntry = {
  id: string;
  previousStatus: ObservationWorkflowStatus | null;
  nextStatus: ObservationWorkflowStatus;
  actorUserId: string;
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
  observerUserId: string;
  assignedUserId: string;
  participantUserIds: string[];
  delegatedReviewerUserId?: string;
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
  currentUser: ObservationUser | null;
  userDirectory: ObservationUser[];
  defaultAssignedUserId: string;
  defaultAssignedSource: ObservationAssignmentSource;
  requesterLabel: string;
  requesterIsRegistered: boolean;
  loadingUsers: boolean;
  usersLoadError: string;
  onRetryUsers?: () => void;
  footer?: ReactNode;
  onClose: () => void;
  onSelectObservation: (observationId: string) => void;
  onCreateObservation: (input: {
    description: string;
    priority: ObservationPriority;
    requiresEvidence: boolean;
    assignedUserId: string;
    participantUserIds: string[];
    delegatedReviewerUserId?: string;
    files: File[];
  }) => void;
  onAddResponse: (observationId: string, responseText: string, files: File[]) => void;
  onApproveObservation: (observationId: string) => void;
  onRequestCorrection: (observationId: string, reason: string) => void;
  onReopenObservation: (observationId: string, reason: string) => void;
  onReassignObservation: (observationId: string, assignedUserId: string) => void;
};

const PRIORITY_OPTIONS: Array<{ value: ObservationPriority; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

export function observationStatusLabel(status: ObservationWorkflowStatus): string {
  if (status === "pending") return "Pendiente";
  if (status === "under_review" || status === "answered") return "Por revisar";
  if (status === "correction_requested") return "Requiere corrección";
  if (status === "resolved") return "Levantada";
  return "Reabierta";
}

export function observationStatusForItem(observations: RequirementObservation[]): RequirementObservationStatus {
  if (observations.length === 0) return "Sin observación";
  if (observations.some((observation) => observation.status === "pending" || observation.status === "reopened" || observation.status === "correction_requested")) {
    return "Observado";
  }
  if (observations.some((observation) => observation.status === "under_review" || observation.status === "answered")) {
    return "En seguimiento";
  }
  return "Levantado";
}

export function observationEvidenceCount(observation: RequirementObservation): number {
  return observation.initialEvidence.length + observation.responses.reduce((total, response) => total + response.evidenceFiles.length, 0);
}

export function observationHasResponseEvidence(observation: RequirementObservation): boolean {
  return observation.responses.some((response) => response.evidenceFiles.length > 0);
}

export function observationCanResolveReason(observation: RequirementObservation): string | null {
  if (observation.responses.length === 0) return "Registre una respuesta";
  if (observation.requiresEvidence && !observationHasResponseEvidence(observation)) {
    return "Adjunte evidencia en una respuesta";
  }
  if (observation.status !== "under_review" && observation.status !== "answered") return "La observación debe estar por revisar";
  return null;
}

export function canRespondToObservation(observation: RequirementObservation, currentUser: ObservationUser | null): boolean {
  if (!currentUser?.id) return false;
  if (observation.status === "resolved") return false;
  return observation.assignedUserId === currentUser.id || observation.participantUserIds.includes(currentUser.id);
}

export function canReviewObservation(observation: RequirementObservation, currentUser: ObservationUser | null): boolean {
  if (!currentUser?.id) return false;
  if (observation.status !== "under_review" && observation.status !== "answered") return false;
  return observation.observerUserId === currentUser.id || observation.delegatedReviewerUserId === currentUser.id;
}

export function canReassignObservation(currentUser: ObservationUser | null): boolean {
  if (!currentUser?.id) return false;
  const role = (currentUser.role ?? "").trim().toLowerCase();
  return currentUser.isSuperAdmin === true || role === "admin" || role === "gerencia" || role === "coordinador";
}

export function canReopenObservation(observation: RequirementObservation, currentUser: ObservationUser | null): boolean {
  if (!currentUser?.id) return false;
  return observation.status === "resolved" && observation.observerUserId === currentUser.id;
}

export function resolveObservationUser(userDirectory: ObservationUser[], userId: string | null | undefined): ObservationUser | null {
  if (!userId) return null;
  return userDirectory.find((user) => user.id === userId) ?? null;
}

export function resolveObservationUserId(userDirectory: ObservationUser[], value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const found = userDirectory.find((user) => {
    const byId = user.id.trim().toLowerCase() === normalized;
    const byEmail = (user.email ?? "").trim().toLowerCase() === normalized;
    const byName = user.displayName.trim().toLowerCase() === normalized;
    return byId || byEmail || byName;
  });
  return found?.id ?? null;
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
  if (status === "under_review" || status === "answered") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "correction_requested") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "reopened") return "border-purple-200 bg-purple-50 text-purple-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function panelButtonClassName(kind: "secondary" | "primary" | "success" | "danger" = "secondary"): string {
  if (kind === "primary") {
    return "inline-flex h-7 items-center justify-center rounded border border-teal-700 bg-teal-700 px-2.5 text-[11px] font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50";
  }
  if (kind === "success") {
    return "inline-flex h-7 items-center justify-center rounded border border-emerald-700 bg-emerald-700 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50";
  }
  if (kind === "danger") {
    return "inline-flex h-7 items-center justify-center rounded border border-amber-700 bg-amber-700 px-2.5 text-[11px] font-semibold text-white hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50";
  }
  return "inline-flex h-7 items-center justify-center rounded border border-stone-200 bg-white px-2.5 text-[11px] font-semibold text-stone-600 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:cursor-not-allowed disabled:opacity-50";
}

function userLabel(userDirectory: ObservationUser[], userId: string | null | undefined): string {
  const user = resolveObservationUser(userDirectory, userId);
  return user?.displayName || user?.email || "Usuario no disponible";
}

function userRoleLabel(observation: RequirementObservation, userId: string): string {
  if (observation.assignedUserId === userId) return "Responsable";
  if (observation.observerUserId === userId) return "Observador";
  if (observation.delegatedReviewerUserId === userId) return "Revisor";
  if (observation.participantUserIds.includes(userId)) return "Participante";
  return "Participante";
}

function assignmentSourceLabel(source: ObservationAssignmentSource): string {
  if (source === "rq_requester") return "Asignado automáticamente porque emitió el RQ.";
  if (source === "requirement_responsible") return "Asignado desde el responsable del requerimiento.";
  return "Asignado manualmente.";
}

function userOptionText(user: ObservationUser, currentUserId?: string): string {
  const currentMark = currentUserId && user.id === currentUserId ? " · Tú" : "";
  return `${user.displayName || user.email || user.id}${user.email ? ` · ${user.email}` : ""}${user.role ? ` · ${user.role}` : ""}${currentMark}`;
}

function SearchableUserSelect({
  label,
  value,
  users,
  currentUserId,
  onChange,
  disabled = false,
  placeholder = "Seleccione usuario",
}: {
  label: string;
  value: string;
  users: ObservationUser[];
  currentUserId?: string;
  onChange: (userId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (!normalizedSearch) return true;
        return `${user.displayName} ${user.email ?? ""} ${user.role ?? ""}`.toLowerCase().includes(normalizedSearch);
      }),
    [normalizedSearch, users],
  );
  const selectedUser = resolveObservationUser(users, value);

  return (
    <label className="block text-[10.5px] font-semibold text-stone-500">
      {label}
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        disabled={disabled}
        className="mt-1 h-7 w-full rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-stone-50"
        placeholder="Buscar por nombre o correo"
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="mt-1 h-8 w-full rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-stone-50"
      >
        <option value="">{placeholder}</option>
        {filteredUsers.map((user) => (
          <option key={user.id} value={user.id}>
            {userOptionText(user, currentUserId)}
          </option>
        ))}
      </select>
      {selectedUser ? (
        <span className="mt-1 block rounded border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-medium text-stone-600">
          {selectedUser.displayName}
          {selectedUser.email ? <span className="block font-normal text-stone-500">{selectedUser.email} · {selectedUser.role || "sin rol"}</span> : null}
        </span>
      ) : null}
    </label>
  );
}

function EvidenceChips({ files, userDirectory }: { files: ObservationEvidence[]; userDirectory: ObservationUser[] }) {
  if (!files.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {files.map((file) => (
        <a
          key={file.id}
          href={file.localObjectUrl || "#"}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            if (!file.localObjectUrl) event.preventDefault();
          }}
          className="min-w-0 max-w-full rounded border border-stone-200 bg-white px-2 py-1 text-[10px] leading-tight text-stone-600 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-300"
          title={`${file.name} · ${file.mimeType || "archivo"} · ${formatFileSize(file.size)} · ${userLabel(userDirectory, file.uploadedByUserId)}`}
        >
          <span className="block max-w-[240px] truncate font-semibold text-stone-700">{file.name}</span>
          <span className="block text-stone-500">
            {file.mimeType || "archivo"} · {formatFileSize(file.size)}
          </span>
          <span className="block truncate text-stone-400">Subió {userLabel(userDirectory, file.uploadedByUserId)}</span>
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
  currentUser,
  userDirectory,
  defaultAssignedUserId,
  defaultAssignedSource,
  requesterLabel,
  requesterIsRegistered,
  loadingUsers,
  usersLoadError,
  onRetryUsers,
  footer,
  onClose,
  onSelectObservation,
  onCreateObservation,
  onAddResponse,
  onApproveObservation,
  onRequestCorrection,
  onReopenObservation,
  onReassignObservation,
}: RequirementObservationPanelProps) {
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ObservationPriority>("medium");
  const [requiresEvidence, setRequiresEvidence] = useState(true);
  const [manualAssignedUserId, setManualAssignedUserId] = useState("");
  const [participantUserIds, setParticipantUserIds] = useState<string[]>([]);
  const [delegatedReviewerUserId, setDelegatedReviewerUserId] = useState("");
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const [responseText, setResponseText] = useState("");
  const [responseFiles, setResponseFiles] = useState<File[]>([]);
  const [correctionReason, setCorrectionReason] = useState("");
  const [showCorrectionReason, setShowCorrectionReason] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [showReopenReason, setShowReopenReason] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [reassignUserId, setReassignUserId] = useState("");

  const assignableUsers = useMemo(() => userDirectory.filter((user) => user.id), [userDirectory]);
  const effectiveAssignedUserId = manualAssignedUserId || defaultAssignedUserId || "";
  const effectiveAssignmentSource: ObservationAssignmentSource = manualAssignedUserId ? "manual" : defaultAssignedSource;
  const filteredParticipantUserIds = useMemo(
    () => participantUserIds.filter((userId, index, all) => userId !== effectiveAssignedUserId && all.indexOf(userId) === index),
    [effectiveAssignedUserId, participantUserIds],
  );
  const pendingCount = useMemo(
    () => observations.filter((observation) => observation.status !== "resolved").length,
    [observations],
  );
  const resolvedCount = useMemo(
    () => observations.filter((observation) => observation.status === "resolved").length,
    [observations],
  );
  const generalStatus = observationStatusForItem(observations);
  const selectedCanRespond = selectedObservation ? canRespondToObservation(selectedObservation, currentUser) : false;
  const selectedCanReview = selectedObservation ? canReviewObservation(selectedObservation, currentUser) : false;
  const selectedCanReopen = selectedObservation ? canReopenObservation(selectedObservation, currentUser) : false;
  const selectedCanReassign = canReassignObservation(currentUser);
  const resolveDisabledReason = selectedObservation ? observationCanResolveReason(selectedObservation) : "Seleccione una observación";
  const responseRequiresEvidence = selectedObservation?.requiresEvidence === true && responseFiles.length === 0;
  const canSubmitResponse = Boolean(selectedObservation && selectedCanRespond && responseText.trim() && !responseRequiresEvidence);
  const createDisabledReason =
    !currentUser?.id
      ? "No se detectó una sesión activa."
      : !description.trim()
        ? "Escriba la observación."
        : loadingUsers
          ? "Espere mientras se cargan los usuarios."
          : usersLoadError
            ? "No se pudo cargar el directorio de usuarios."
            : !effectiveAssignedUserId
              ? "Seleccione un responsable principal."
              : "";
  const canCreateObservation = Boolean(selectedItem && currentUser?.id && description.trim() && effectiveAssignedUserId && !loadingUsers && !usersLoadError);
  const shouldShowListHeader = observations.length !== 1;

  function submitObservation() {
    const trimmed = description.trim();
    if (!selectedItem || !currentUser?.id || !trimmed || !effectiveAssignedUserId) return;
    onCreateObservation({
      description: trimmed,
      priority,
      requiresEvidence,
      assignedUserId: effectiveAssignedUserId,
      participantUserIds: filteredParticipantUserIds,
      delegatedReviewerUserId: delegatedReviewerUserId || undefined,
      files: initialFiles,
    });
    setDescription("");
    setPriority("medium");
    setRequiresEvidence(true);
    setManualAssignedUserId("");
    setParticipantUserIds([]);
    setDelegatedReviewerUserId("");
    setInitialFiles([]);
  }

  function submitResponse() {
    const trimmed = responseText.trim();
    if (!selectedObservation || !canSubmitResponse) return;
    onAddResponse(selectedObservation.id, trimmed, responseFiles);
    setResponseText("");
    setResponseFiles([]);
    setShowReopenReason(false);
    setReopenReason("");
  }

  function submitCorrectionRequest() {
    const trimmed = correctionReason.trim();
    if (!selectedObservation || !selectedCanReview || !trimmed) return;
    onRequestCorrection(selectedObservation.id, trimmed);
    setShowCorrectionReason(false);
    setCorrectionReason("");
  }

  function submitReopen() {
    const trimmed = reopenReason.trim();
    if (!selectedObservation || !selectedCanReopen || !trimmed) return;
    onReopenObservation(selectedObservation.id, trimmed);
    setShowReopenReason(false);
    setReopenReason("");
    setShowMoreOptions(false);
  }

  function submitReassign() {
    if (!selectedObservation || !selectedCanReassign || !reassignUserId) return;
    onReassignObservation(selectedObservation.id, reassignUserId);
    setReassignUserId("");
    setShowMoreOptions(false);
  }

  function selectAssignedUser(userId: string) {
    setManualAssignedUserId(userId === defaultAssignedUserId ? "" : userId);
    setParticipantUserIds((current) => current.filter((participantUserId) => participantUserId !== userId));
  }

  function addParticipant(userId: string) {
    if (!userId || userId === effectiveAssignedUserId) return;
    setParticipantUserIds((current) => (current.includes(userId) ? current : [...current, userId]));
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
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-stone-200 text-[11px] text-stone-500 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-300"
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
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full resize-none rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="Describe la observación técnica"
              aria-label="Descripción de la observación"
            />
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-[10.5px] font-semibold text-stone-500">
                Prioridad
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as ObservationPriority)}
                  className="mt-1 h-7 w-full rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
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
                  className="h-3.5 w-3.5 rounded border-stone-300 text-teal-700 focus:ring-2 focus:ring-teal-100"
                />
                Requiere evidencia para responder
              </label>
            </div>
            <div className="mt-2 rounded border border-stone-200 bg-stone-50 px-2 py-1.5 text-[10.5px] text-stone-600">
              <span className="block font-semibold text-stone-500">Solicitante del RQ</span>
              <span className="block truncate font-medium text-stone-800" title={requesterLabel || "Sin solicitante"}>
                {requesterLabel || "Sin solicitante"}
              </span>
              {!requesterIsRegistered && requesterLabel ? (
                <span className="mt-1 block text-amber-700">Solicitante del RQ no registrado. Seleccione un responsable interno.</span>
              ) : null}
            </div>
            <div className="mt-2">
              <SearchableUserSelect
                label="Responsable principal"
                value={effectiveAssignedUserId}
                users={assignableUsers}
                currentUserId={currentUser?.id}
                onChange={selectAssignedUser}
                disabled={loadingUsers || Boolean(usersLoadError)}
                placeholder="Seleccione responsable principal"
              />
              <p className="mt-1 text-[10px] text-stone-500">{assignmentSourceLabel(effectiveAssignmentSource)}</p>
            </div>
            <details className="mt-2 rounded border border-stone-200 bg-white">
              <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-300">
                Opciones adicionales
              </summary>
              <div className="space-y-2 border-t border-stone-200 p-2">
                <SearchableUserSelect
                  label="Participantes opcionales"
                  value=""
                  users={assignableUsers.filter((user) => user.id !== effectiveAssignedUserId && !filteredParticipantUserIds.includes(user.id))}
                  currentUserId={currentUser?.id}
                  onChange={addParticipant}
                  disabled={loadingUsers || Boolean(usersLoadError)}
                  placeholder="Agregar participante"
                />
                {filteredParticipantUserIds.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {filteredParticipantUserIds.map((userId) => (
                      <span key={userId} className="inline-flex max-w-full items-center gap-1 rounded border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] text-stone-600">
                        <span className="truncate">{userLabel(userDirectory, userId)}</span>
                        <button
                          type="button"
                          onClick={() => setParticipantUserIds((current) => current.filter((participantUserId) => participantUserId !== userId))}
                          className="rounded px-1 font-semibold text-stone-500 hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-300"
                          aria-label={`Retirar participante ${userLabel(userDirectory, userId)}`}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <SearchableUserSelect
                  label="Revisor delegado"
                  value={delegatedReviewerUserId}
                  users={assignableUsers}
                  currentUserId={currentUser?.id}
                  onChange={setDelegatedReviewerUserId}
                  disabled={loadingUsers || Boolean(usersLoadError)}
                  placeholder="Sin delegado"
                />
              </div>
            </details>
            {loadingUsers ? (
              <p className="mt-2 rounded border border-stone-200 bg-stone-50 px-2 py-1 text-[10.5px] text-stone-600">
                Cargando usuarios disponibles...
              </p>
            ) : null}
            {usersLoadError ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800">
                <span>No se pudo cargar el directorio de usuarios.</span>
                {onRetryUsers ? (
                  <button type="button" onClick={onRetryUsers} className={panelButtonClassName()}>
                    Reintentar
                  </button>
                ) : null}
              </div>
            ) : null}
            {!loadingUsers && !usersLoadError && assignableUsers.length === 0 ? (
              <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800">
                No hay usuarios aprobados disponibles.
              </p>
            ) : null}
            <div className="mt-2">
              <LocalEvidencePicker
                files={initialFiles}
                onFilesChange={setInitialFiles}
                label="Adjuntar evidencia inicial"
                helperText="Opcional. Queda asociada a la observación inicial."
                compact
              />
            </div>
            {!currentUser?.id ? (
              <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800">
                No se detectó usuario activo para registrar trazabilidad.
              </p>
            ) : null}
            {createDisabledReason ? (
              <p className="mt-2 text-[10.5px] font-medium text-amber-700">{createDisabledReason}</p>
            ) : null}
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={submitObservation} disabled={!canCreateObservation} className={panelButtonClassName("primary")}>
                Registrar observación
              </button>
            </div>
          </div>

          {observations.length ? (
            <div className="mt-2 rounded border border-stone-200 bg-white">
              {shouldShowListHeader ? (
                <div className="flex items-center justify-between border-b border-stone-200 px-2 py-1.5">
                  <p className="text-[11px] font-semibold text-stone-700">Observaciones</p>
                  <span className="text-[10px] font-semibold text-stone-400">{observations.length}</span>
                </div>
              ) : null}
              <div className="max-h-[190px] overflow-auto p-1.5">
                {observations.map((observation) => (
                  <button
                    key={observation.id}
                    type="button"
                    onClick={() => onSelectObservation(observation.id)}
                    className={`mb-1.5 block w-full rounded border px-2 py-1.5 text-left hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-200 ${
                      selectedObservationId === observation.id ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-[11px] font-semibold text-stone-800" title={observation.description}>
                        {observation.code} · {observation.description}
                      </span>
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9.5px] font-semibold ${statusClassName(observation.status)}`}>
                        {observationStatusLabel(observation.status)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
                      <span className={`rounded border px-1.5 py-0.5 font-semibold ${priorityClassName(observation.priority)}`}>
                        {priorityLabel(observation.priority)}
                      </span>
                      <span>Resp. {userLabel(userDirectory, observation.assignedUserId)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-2 rounded border border-stone-200 bg-white p-2">
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
                  <div className="mt-2 grid grid-cols-1 gap-1 text-[10.5px] text-stone-500">
                    <span>Observó: <strong className="text-stone-700">{userLabel(userDirectory, selectedObservation.observerUserId)}</strong></span>
                    <span>Responsable: <strong className="text-stone-700">{userLabel(userDirectory, selectedObservation.assignedUserId)}</strong></span>
                    {selectedObservation.participantUserIds.length ? (
                      <span>Participantes: <strong className="text-stone-700">{selectedObservation.participantUserIds.map((userId) => userLabel(userDirectory, userId)).join(", ")}</strong></span>
                    ) : null}
                    {selectedObservation.delegatedReviewerUserId ? (
                      <span>Revisor: <strong className="text-stone-700">{userLabel(userDirectory, selectedObservation.delegatedReviewerUserId)}</strong></span>
                    ) : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[11px] text-stone-700">{selectedObservation.description}</p>
                  <EvidenceChips files={selectedObservation.initialEvidence} userDirectory={userDirectory} />
                </div>

                <div className="space-y-1.5">
                  {selectedObservation.responses.map((response) => (
                    <div key={response.id} className="rounded border border-stone-200 bg-white p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-stone-500">
                        <span className="font-semibold text-stone-700">
                          {userLabel(userDirectory, response.authorUserId)}
                          <span className="ml-1 font-medium text-stone-400">{userRoleLabel(selectedObservation, response.authorUserId)}</span>
                        </span>
                        <span>{response.createdAt}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[11px] text-stone-700">{response.responseText}</p>
                      <EvidenceChips files={response.evidenceFiles} userDirectory={userDirectory} />
                    </div>
                  ))}
                  {selectedObservation.responses.length === 0 ? (
                    <p className="rounded border border-stone-200 bg-stone-50 px-2 py-3 text-center text-[11px] text-stone-400">
                      Aún no hay respuestas.
                    </p>
                  ) : null}
                </div>

                {selectedCanRespond ? (
                  <div className="rounded border border-stone-200 bg-stone-50 p-2">
                    <textarea
                      value={responseText}
                      onChange={(event) => setResponseText(event.target.value)}
                      rows={3}
                      className="w-full resize-none rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      placeholder="Escribe una respuesta o acción correctiva"
                      aria-label="Escribe una respuesta o acción correctiva"
                    />
                    <div className="mt-2">
                      <LocalEvidencePicker
                        files={responseFiles}
                        onFilesChange={setResponseFiles}
                        label="Adjuntar"
                        helperText="Cada archivo queda asociado a esta respuesta."
                        compact
                      />
                    </div>
                    {responseRequiresEvidence ? (
                      <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800">
                        Esta observación requiere evidencia en la respuesta.
                      </p>
                    ) : null}
                    <div className="mt-2 flex justify-end">
                      <button type="button" onClick={submitResponse} disabled={!canSubmitResponse} className={panelButtonClassName("primary")}>
                        Enviar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="rounded border border-stone-200 bg-stone-50 px-2 py-2 text-[10.5px] text-stone-500">
                    Solo el responsable asignado o un participante puede responder esta observación.
                  </p>
                )}

                {selectedCanReview ? (
                  <div className="rounded border border-stone-200 bg-white p-2">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowCorrectionReason((current) => !current)}
                        className={panelButtonClassName("danger")}
                      >
                        Solicitar corrección
                      </button>
                      <button
                        type="button"
                        onClick={() => onApproveObservation(selectedObservation.id)}
                        disabled={Boolean(resolveDisabledReason)}
                        className={panelButtonClassName("success")}
                      >
                        Aprobar levantamiento
                      </button>
                    </div>
                    {resolveDisabledReason ? (
                      <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800">
                        {resolveDisabledReason}
                      </p>
                    ) : null}
                    {showCorrectionReason ? (
                      <div className="mt-2 rounded border border-stone-200 bg-stone-50 p-2">
                        <textarea
                          value={correctionReason}
                          onChange={(event) => setCorrectionReason(event.target.value)}
                          rows={2}
                          className="w-full resize-none rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                          placeholder="Motivo de la corrección"
                          aria-label="Motivo de la corrección"
                        />
                        <div className="mt-2 flex justify-end">
                          <button type="button" onClick={submitCorrectionRequest} disabled={!correctionReason.trim()} className={panelButtonClassName("primary")}>
                            Registrar motivo
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {(selectedCanReopen || selectedCanReassign) ? (
                  <div className="rounded border border-stone-200 bg-white p-2">
                    <button
                      type="button"
                      onClick={() => setShowMoreOptions((current) => !current)}
                      className={panelButtonClassName()}
                    >
                      Más opciones
                    </button>
                    {showMoreOptions ? (
                      <div className="mt-2 space-y-2 rounded border border-stone-200 bg-stone-50 p-2">
                        {selectedCanReassign ? (
                          <div className="flex flex-wrap items-end gap-2">
                            <label className="min-w-[190px] flex-1 text-[10.5px] font-semibold text-stone-500">
                              Reasignar responsable
                              <select
                                value={reassignUserId}
                                onChange={(event) => setReassignUserId(event.target.value)}
                                className="mt-1 h-7 w-full rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                              >
                                <option value="">Seleccione responsable</option>
                                {assignableUsers.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.displayName || user.email || user.id}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button type="button" onClick={submitReassign} disabled={!reassignUserId} className={panelButtonClassName("primary")}>
                              Reasignar
                            </button>
                          </div>
                        ) : null}
                        {selectedCanReopen ? (
                          <div>
                            <button type="button" onClick={() => setShowReopenReason((current) => !current)} className={panelButtonClassName()}>
                              Reabrir
                            </button>
                            {showReopenReason ? (
                              <div className="mt-2">
                                <textarea
                                  value={reopenReason}
                                  onChange={(event) => setReopenReason(event.target.value)}
                                  rows={2}
                                  className="w-full resize-none rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                                  placeholder="Motivo de reapertura"
                                  aria-label="Motivo de reapertura"
                                />
                                <div className="mt-2 flex justify-end">
                                  <button type="button" onClick={submitReopen} disabled={!reopenReason.trim()} className={panelButtonClassName("primary")}>
                                    Confirmar reapertura
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <details className="rounded border border-stone-200 bg-stone-50">
                  <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-300">
                    Ver actividad
                  </summary>
                  <div className="max-h-[150px] overflow-auto border-t border-stone-200 bg-white">
                    {selectedObservation.statusHistory.map((entry) => (
                      <div key={entry.id} className="border-b border-stone-100 px-2 py-1.5 last:border-b-0">
                        <p className="text-[10.5px] font-semibold text-stone-700">
                          {entry.previousStatus ? `${observationStatusLabel(entry.previousStatus)} → ` : ""}
                          {observationStatusLabel(entry.nextStatus)}
                        </p>
                        <p className="text-[10px] text-stone-500">
                          {userLabel(userDirectory, entry.actorUserId)} · {entry.createdAt}
                        </p>
                        {entry.note ? <p className="mt-0.5 text-[10px] text-stone-600">{entry.note}</p> : null}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ) : (
              <p className="text-[11px] text-stone-400">Registra o selecciona una observación para ver el hilo.</p>
            )}
          </div>
          {footer ? <div className="mt-2">{footer}</div> : null}
        </div>
      ) : null}
    </aside>
  );
}
