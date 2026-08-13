"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AGENTS } from "@/lib/data";
import type { Agent } from "@/lib/types";
import {
  listAgentKnowledge,
  listAgentPerformanceSummary,
  listAgentSkillVersions,
  type AgentKnowledgeItem,
  type AgentPerformanceSummary,
  type AgentSkillVersion,
} from "@/lib/ai-office/agentIntelligenceRepository";
import {
  buildAgentProfileDraft,
  createAgentProfileFromDraft,
  createLocalAgentProfileRepository,
  defaultAgentCodeForPosition,
  profileToAgent,
  statusLabelForAgent,
  templateForPosition,
  type AgentProfile,
  type AgentProfileDraft,
  type AgentProfileStatus,
} from "@/lib/ai-office/agentProfileRepository";
import {
  createLocalAgentOrgRepository,
  DEFAULT_ORG_POSITIONS,
  type OrgPosition,
  type OrgPositionDraft,
  type OrgPositionKind,
  type OrgPositionStatus,
} from "@/lib/ai-office/agentOrgRepository";

type AgentIndicators = {
  activeSkills: number;
  approvedKnowledge: number;
  pendingProposals: number;
  negativeSignals: number;
  groundedAnswers: number;
  lastActivityAt: string | null;
};

const EMPTY_DRAFT: OrgPositionDraft = {
  name: "",
  area: "",
  role: "",
  kind: "especialista",
  parentId: "pos-gg",
  agentId: "",
  status: "vacant",
  description: "",
};

const orgRepository = createLocalAgentOrgRepository();
const profileRepository = createLocalAgentProfileRepository();

function sortPositions(rows: OrgPosition[]): OrgPosition[] {
  return [...rows].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "es"));
}

function childrenOf(parentId: string | null, positions: OrgPosition[]): OrgPosition[] {
  return sortPositions(positions.filter((position) => position.parentId === parentId));
}

function isDescendant(positionId: string, possibleParentId: string, byId: Map<string, OrgPosition>): boolean {
  let parentId = byId.get(possibleParentId)?.parentId ?? null;
  while (parentId) {
    if (parentId === positionId) return true;
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return false;
}

function labelForPositionStatus(status: OrgPositionStatus): string {
  if (status === "active") return "Ocupada";
  if (status === "observer") return "Observador";
  if (status === "disabled") return "Deshabilitada";
  if (status === "proposed") return "En configuracion";
  return "Vacante";
}

function statusClass(status: OrgPositionStatus): string {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "observer") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "disabled") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "proposed") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function agentStatusClass(status: AgentProfileStatus | null): string {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "observer") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "disabled") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "pending_approval") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "configuring") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function kindLabel(kind: OrgPositionKind): string {
  if (kind === "supervisor") return "Supervisor";
  if (kind === "coordinador") return "Coordinador";
  if (kind === "soporte") return "Soporte";
  return "Especialista";
}

function buildDraft(position?: OrgPosition, parentId = "pos-gg"): OrgPositionDraft {
  if (!position) return { ...EMPTY_DRAFT, parentId };
  return {
    id: position.id,
    name: position.name,
    area: position.area,
    role: position.role,
    kind: position.kind,
    parentId: position.parentId ?? "",
    agentId: position.agentId ?? "",
    status: position.status,
    description: position.description,
  };
}

function formatDate(value: string | null): string {
  if (!value) return "Sin actividad";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin actividad";
  return parsed.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function indicatorsFor(
  agentId: string | null,
  skills: AgentSkillVersion[],
  knowledge: AgentKnowledgeItem[],
  performance: AgentPerformanceSummary[],
): AgentIndicators | null {
  if (!agentId) return null;
  const perf = performance.find((row) => row.agentId === agentId);
  return {
    activeSkills: skills.filter((skill) => skill.agentId === agentId && skill.effectiveStatus === "active").length,
    approvedKnowledge: knowledge.filter((row) => row.agentId === agentId && row.status === "approved").length,
    pendingProposals:
      skills.filter((skill) => skill.agentId === agentId && (skill.effectiveStatus === "proposed" || skill.effectiveStatus === "draft" || skill.effectiveStatus === "review")).length +
      knowledge.filter((row) => row.agentId === agentId && row.status === "proposed").length,
    negativeSignals: perf?.negativeSignals ?? 0,
    groundedAnswers: perf?.groundedAnswers ?? 0,
    lastActivityAt: perf?.lastEventAt ?? null,
  };
}

function coverageLabel(position: OrgPosition, indicators: AgentIndicators | null): { label: string; className: string } {
  if (!position.agentId) return { label: "Vacante", className: "border-slate-200 bg-slate-50 text-slate-600" };
  if (position.status === "disabled") return { label: "Deshabilitada", className: "border-rose-200 bg-rose-50 text-rose-700" };
  if (!indicators || (indicators.activeSkills === 0 && indicators.approvedKnowledge === 0 && indicators.groundedAnswers === 0)) {
    return { label: "Sin evidencia", className: "border-slate-200 bg-slate-50 text-slate-600" };
  }
  if (indicators.negativeSignals > 0 || (indicators.groundedAnswers > 0 && indicators.approvedKnowledge === 0)) {
    return { label: "Necesita revision", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  return { label: "Correcta", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}

function combinedAgentMap(profiles: AgentProfile[]): Map<string, Agent> {
  const map = new Map(AGENTS.map((agent) => [agent.id, agent]));
  profiles.forEach((profile) => map.set(profile.id, profileToAgent(profile)));
  return map;
}

function profileStatusForPosition(position: OrgPosition, profiles: AgentProfile[]): AgentProfileStatus | null {
  if (!position.agentId) return null;
  return profiles.find((profile) => profile.id === position.agentId || profile.positionId === position.id)?.status ?? null;
}

function OrgNode({
  position,
  positions,
  profiles,
  editMode,
  selectedId,
  dropTargetId,
  menuId,
  agentMap,
  profileStatus,
  indicators,
  indicatorsByAgent,
  onSelect,
  onMenu,
  onAddChild,
  onCreateAgent,
  onEdit,
  onMove,
  onDropTarget,
  onStatus,
  onUnassign,
  onNeeds,
}: {
  position: OrgPosition;
  positions: OrgPosition[];
  profiles: AgentProfile[];
  editMode: boolean;
  selectedId: string | null;
  dropTargetId: string | null;
  menuId: string | null;
  agentMap: Map<string, Agent>;
  profileStatus: AgentProfileStatus | null;
  indicators: AgentIndicators | null;
  indicatorsByAgent: Map<string, AgentIndicators>;
  onSelect: (id: string) => void;
  onMenu: (id: string | null) => void;
  onAddChild: (parentId: string) => void;
  onCreateAgent: (position: OrgPosition) => void;
  onEdit: (position: OrgPosition) => void;
  onMove: (draggedId: string, targetId: string) => void;
  onDropTarget: (id: string | null) => void;
  onStatus: (id: string, status: OrgPositionStatus) => void;
  onUnassign: (id: string) => void;
  onNeeds: (agentId: string | null) => void;
}) {
  const agent = position.agentId ? agentMap.get(position.agentId) : null;
  const children = childrenOf(position.id, positions);
  const coverage = coverageLabel(position, indicators);
  const selected = selectedId === position.id;
  const dropTarget = dropTargetId === position.id;
  const isVacant = !position.agentId;

  return (
    <div className="flex flex-col items-center">
      <div
        draggable={editMode && position.id !== "pos-gg"}
        onDragStart={(event) => event.dataTransfer.setData("text/plain", position.id)}
        onDragEnter={() => editMode && onDropTarget(position.id)}
        onDragLeave={() => editMode && onDropTarget(null)}
        onDragOver={(event) => editMode && event.preventDefault()}
        onDrop={(event) => {
          if (!editMode) return;
          event.preventDefault();
          const draggedId = event.dataTransfer.getData("text/plain");
          if (draggedId) onMove(draggedId, position.id);
          onDropTarget(null);
        }}
        onClick={() => onSelect(position.id)}
        className={[
          "relative w-[178px] rounded-md border bg-white px-2.5 py-2 text-left shadow-sm transition",
          selected ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200",
          dropTarget ? "border-emerald-500 ring-2 ring-emerald-100" : "",
          position.status === "disabled" ? "opacity-70" : "",
          editMode ? "cursor-move" : "cursor-pointer",
        ].join(" ")}
      >
        <div className="mb-1 flex items-start justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-700">
              {agent?.initials ?? defaultAgentCodeForPosition(position).slice(0, 2)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-950">{position.name}</p>
              <p className="truncate text-[10px] text-slate-500">{agent?.name ?? "Sin agente IA"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              title={isVacant ? "Opciones de vacante" : "Agregar subordinada"}
              className="rounded px-1 text-xs font-bold text-blue-700 hover:bg-blue-50"
              onClick={(event) => {
                event.stopPropagation();
                if (isVacant) onMenu(menuId === position.id ? null : position.id);
                else onAddChild(position.id);
              }}
            >
              +
            </button>
            <button type="button" className="rounded px-1 text-xs font-bold text-slate-500 hover:bg-slate-100" onClick={(event) => { event.stopPropagation(); onMenu(menuId === position.id ? null : position.id); }}>...</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${statusClass(position.status)}`}>{labelForPositionStatus(position.status)}</span>
          {profileStatus ? <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${agentStatusClass(profileStatus)}`}>{statusLabelForAgent(profileStatus)}</span> : null}
          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${coverage.className}`}>{coverage.label}</span>
        </div>

        {indicators ? (
          <div className="mt-1.5 grid grid-cols-3 gap-1 text-[9px] text-slate-500">
            <span>S:{indicators.activeSkills}</span>
            <span>K:{indicators.approvedKnowledge}</span>
            <span>C:{indicators.negativeSignals}</span>
          </div>
        ) : (
          <p className="mt-1.5 text-[9px] text-slate-400">{isVacant ? "Vacante: puede crear agente" : "Sin senales"}</p>
        )}

        {menuId === position.id ? (
          <div className="absolute right-1 top-8 z-20 w-52 rounded-md border border-slate-200 bg-white p-1 text-xs shadow-xl">
            {isVacant ? (
              <button className="block w-full rounded px-2 py-1.5 text-left font-semibold text-blue-700 hover:bg-blue-50" onClick={() => onCreateAgent(position)}>+ Crear agente IA</button>
            ) : null}
            {position.agentId ? <Link className="block rounded px-2 py-1.5 hover:bg-slate-50" href={`/agentes?agent=${position.agentId}`}>Ver agente</Link> : null}
            <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50" onClick={() => onEdit(position)}>Editar posicion</button>
            <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50" onClick={() => onEdit(position)}>{position.agentId ? "Cambiar agente" : "Asignar agente existente"}</button>
            {position.agentId ? <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50" onClick={() => onUnassign(position.id)}>Desasignar agente</button> : null}
            <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50" onClick={() => onAddChild(position.id)}>Agregar posicion subordinada</button>
            {position.status === "disabled" ? (
              <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50" onClick={() => onStatus(position.id, "active")}>Habilitar posicion</button>
            ) : position.agentId ? (
              <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50" onClick={() => onStatus(position.id, "disabled")}>Deshabilitar posicion</button>
            ) : null}
            {position.agentId ? <Link className="block rounded px-2 py-1.5 hover:bg-slate-50" href={`/skills?agent=${position.agentId}`}>Skills</Link> : null}
            {position.agentId ? <Link className="block rounded px-2 py-1.5 hover:bg-slate-50" href={`/conocimiento?agent=${position.agentId}`}>Conocimiento</Link> : null}
            {position.agentId ? <Link className="block rounded px-2 py-1.5 hover:bg-slate-50" href={`/linea-tiempo?agent=${position.agentId}`}>Actividad</Link> : null}
            {position.agentId ? <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50" onClick={() => onNeeds(position.agentId)}>Consultar necesidades</button> : null}
          </div>
        ) : null}
      </div>

      {children.length > 0 ? (
        <>
          <div className="h-4 w-px bg-slate-300" />
          <div className="flex justify-center border-t border-slate-300 pt-4">
            <div className="flex items-start justify-center gap-3">
              {children.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  <div className="absolute -top-4 h-4 w-px bg-slate-300" />
                  <OrgNode
                    position={child}
                    positions={positions}
                    profiles={profiles}
                    editMode={editMode}
                    selectedId={selectedId}
                    dropTargetId={dropTargetId}
                    menuId={menuId}
                    agentMap={agentMap}
                    profileStatus={profileStatusForPosition(child, profiles)}
                    indicators={child.agentId ? indicatorsByAgent.get(child.agentId) ?? null : null}
                    indicatorsByAgent={indicatorsByAgent}
                    onSelect={onSelect}
                    onMenu={onMenu}
                    onAddChild={onAddChild}
                    onCreateAgent={onCreateAgent}
                    onEdit={onEdit}
                    onMove={onMove}
                    onDropTarget={onDropTarget}
                    onStatus={onStatus}
                    onUnassign={onUnassign}
                    onNeeds={onNeeds}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function OrgTree({
  positions,
  profiles,
  editMode,
  selectedId,
  dropTargetId,
  menuId,
  agentMap,
  indicatorsByAgent,
  onSelect,
  onMenu,
  onAddChild,
  onCreateAgent,
  onEdit,
  onMove,
  onDropTarget,
  onStatus,
  onUnassign,
  onNeeds,
}: {
  positions: OrgPosition[];
  profiles: AgentProfile[];
  editMode: boolean;
  selectedId: string | null;
  dropTargetId: string | null;
  menuId: string | null;
  agentMap: Map<string, Agent>;
  indicatorsByAgent: Map<string, AgentIndicators>;
  onSelect: (id: string) => void;
  onMenu: (id: string | null) => void;
  onAddChild: (parentId: string) => void;
  onCreateAgent: (position: OrgPosition) => void;
  onEdit: (position: OrgPosition) => void;
  onMove: (draggedId: string, targetId: string) => void;
  onDropTarget: (id: string | null) => void;
  onStatus: (id: string, status: OrgPositionStatus) => void;
  onUnassign: (id: string) => void;
  onNeeds: (agentId: string | null) => void;
}) {
  return (
    <div className="min-w-max px-4 py-2">
      <div className="flex items-start justify-center gap-6">
        {childrenOf(null, positions).map((root) => (
          <OrgNode
            key={root.id}
            position={root}
            positions={positions}
            profiles={profiles}
            editMode={editMode}
            selectedId={selectedId}
            dropTargetId={dropTargetId}
            menuId={menuId}
            agentMap={agentMap}
            profileStatus={profileStatusForPosition(root, profiles)}
            indicators={root.agentId ? indicatorsByAgent.get(root.agentId) ?? null : null}
            indicatorsByAgent={indicatorsByAgent}
            onSelect={onSelect}
            onMenu={onMenu}
            onAddChild={onAddChild}
            onCreateAgent={onCreateAgent}
            onEdit={onEdit}
            onMove={onMove}
            onDropTarget={onDropTarget}
            onStatus={onStatus}
            onUnassign={onUnassign}
            onNeeds={onNeeds}
          />
        ))}
      </div>
    </div>
  );
}

function AgentWizard({
  position,
  parent,
  draft,
  step,
  onStep,
  onDraft,
  onClose,
  onCreate,
}: {
  position: OrgPosition;
  parent: OrgPosition | null;
  draft: AgentProfileDraft;
  step: number;
  onStep: (step: number) => void;
  onDraft: (draft: AgentProfileDraft) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  const template = templateForPosition(position);
  const steps = ["Identidad", "Jerarquia", "Perfil", "Skills base"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-950">Crear agente IA para {position.name}</h3>
            <p className="mt-1 text-sm text-slate-500">Se crea un perfil nuevo local. No reutiliza agentes existentes ni activa routing automaticamente.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">Cerrar</button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {steps.map((label, index) => (
            <button key={label} type="button" onClick={() => onStep(index + 1)} className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${step === index + 1 ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}>
              {index + 1}. {label}
            </button>
          ))}
        </div>

        {step === 1 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">Nombre del agente<input value={draft.name} onChange={(event) => onDraft({ ...draft, name: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">Codigo corto<input value={draft.code} onChange={(event) => onDraft({ ...draft, code: event.target.value.toUpperCase() })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">Posicion<input value={position.name} disabled className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" /></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">Area<input value={draft.area} onChange={(event) => onDraft({ ...draft, area: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">Especialidad<input value={draft.specialty} onChange={(event) => onDraft({ ...draft, specialty: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">Descripcion del rol<textarea value={draft.roleDescription} onChange={(event) => onDraft({ ...draft, roleDescription: event.target.value })} className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"><b>Reporta a</b><br />{parent?.name ?? "Sin supervisor"}</div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"><b>Posicion</b><br />{position.name}</div>
            <div className="rounded-md border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600 md:col-span-2">La jerarquia se toma del organigrama local. Cambiar supervisor se hace moviendo la posicion o editandola.</div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">Objetivo<textarea value={draft.objective} onChange={(event) => onDraft({ ...draft, objective: event.target.value })} className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">Responsabilidades<textarea value={draft.responsibilitiesText} onChange={(event) => onDraft({ ...draft, responsibilitiesText: event.target.value })} className="min-h-32 rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">Limites<textarea value={draft.limitsText} onChange={(event) => onDraft({ ...draft, limitsText: event.target.value })} className="min-h-32 rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">Tipo de agente<input value={draft.agentType} onChange={(event) => onDraft({ ...draft, agentType: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">Permisos logicos<textarea value={draft.logicalPermissionsText} onChange={(event) => onDraft({ ...draft, logicalPermissionsText: event.target.value })} className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              Plantilla detectada: <b>{template?.roleLabel ?? "Sin plantilla conocida"}</b>. Estas son capacidades iniciales gobernadas; no significan entrenamiento del modelo.
            </div>
            <label className="grid gap-1 text-sm font-medium text-slate-700">Skills base sugeridas<textarea value={draft.expectedCapabilitiesText} onChange={(event) => onDraft({ ...draft, expectedCapabilitiesText: event.target.value })} className="min-h-40 rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">Estado inicial: En configuracion. La activacion se realiza luego de revision/aprobacion.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => onStep(Math.max(1, step - 1))} className="btn btn--ghost" disabled={step === 1}>Anterior</button>
            {step < 4 ? <button type="button" onClick={() => onStep(step + 1)} className="btn btn--primary">Siguiente</button> : <button type="button" onClick={onCreate} className="btn btn--primary">Crear agente IA</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIAgentOrgChart() {
  const [positions, setPositions] = useState<OrgPosition[]>(DEFAULT_ORG_POSITIONS);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [skills, setSkills] = useState<AgentSkillVersion[]>([]);
  const [knowledge, setKnowledge] = useState<AgentKnowledgeItem[]>([]);
  const [performance, setPerformance] = useState<AgentPerformanceSummary[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>("pos-gg");
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OrgPositionDraft>(EMPTY_DRAFT);
  const [modalOpen, setModalOpen] = useState(false);
  const [needsAgentId, setNeedsAgentId] = useState<string | null>(null);
  const [wizard, setWizard] = useState<{ positionId: string; step: number; draft: AgentProfileDraft } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPositions(orgRepository.listPositions());
      setProfiles(profileRepository.listProfiles());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAgentSkillVersions(), listAgentKnowledge(), listAgentPerformanceSummary()])
      .then(([skillResult, knowledgeResult, performanceResult]) => {
        if (cancelled) return;
        setSkills(skillResult.source === "supabase" ? skillResult.rows : []);
        setKnowledge(knowledgeResult.source === "supabase" ? knowledgeResult.rows : []);
        setPerformance(performanceResult.source === "supabase" ? performanceResult.rows : []);
      })
      .catch(() => {
        if (!cancelled) {
          setSkills([]);
          setKnowledge([]);
          setPerformance([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const agentMap = useMemo(() => combinedAgentMap(profiles), [profiles]);
  const selectedProfile = selected?.agentId ? profiles.find((profile) => profile.id === selected.agentId || profile.positionId === selected.id) ?? null : null;
  const selectedTemplate = selected ? templateForPosition(selected) : null;
  const wizardPosition = wizard ? byId.get(wizard.positionId) ?? null : null;
  const wizardParent = wizardPosition?.parentId ? byId.get(wizardPosition.parentId) ?? null : null;

  const indicatorsByAgent = useMemo(() => {
    const map = new Map<string, AgentIndicators>();
    agentMap.forEach((agent) => {
      map.set(agent.id, indicatorsFor(agent.id, skills, knowledge, performance) ?? {
        activeSkills: 0,
        approvedKnowledge: 0,
        pendingProposals: 0,
        negativeSignals: 0,
        groundedAnswers: 0,
        lastActivityAt: null,
      });
    });
    return map;
  }, [agentMap, knowledge, performance, skills]);

  const activeCount = positions.filter((position) => position.agentId && position.status === "active").length;
  const disabledCount = positions.filter((position) => position.status === "disabled").length;
  const vacantCount = positions.filter((position) => !position.agentId || position.status === "vacant").length;
  const configuredCount = profiles.filter((profile) => profile.status === "configuring" || profile.status === "pending_approval").length;

  function persistPositions(next: OrgPosition[]) {
    setPositions(next);
    orgRepository.savePositions(next);
  }

  function persistProfiles(next: AgentProfile[]) {
    setProfiles(next);
    profileRepository.saveProfiles(next);
  }

  function openNewPosition(parentId = selectedId ?? "pos-gg") {
    setDraft(buildDraft(undefined, parentId));
    setModalOpen(true);
    setMenuId(null);
  }

  function openEditPosition(position: OrgPosition) {
    setDraft(buildDraft(position));
    setModalOpen(true);
    setMenuId(null);
  }

  function savePosition() {
    const name = draft.name.trim();
    if (!name) return;
    const parentId = draft.parentId || null;
    const nextPosition: OrgPosition = {
      id: draft.id ?? `pos-${Date.now().toString(36)}`,
      name,
      area: draft.area.trim() || "Sin area",
      role: draft.role.trim() || "Rol pendiente",
      kind: draft.kind,
      parentId,
      agentId: draft.agentId || null,
      status: draft.agentId ? draft.status === "vacant" ? "active" : draft.status : "vacant",
      description: draft.description.trim() || "Sin descripcion registrada.",
      order: draft.id ? byId.get(draft.id)?.order ?? 1 : childrenOf(parentId, positions).length + 1,
    };
    const next = draft.id ? positions.map((position) => (position.id === draft.id ? nextPosition : position)) : [...positions, nextPosition];
    persistPositions(next);
    setSelectedId(nextPosition.id);
    setModalOpen(false);
  }

  function movePosition(draggedId: string, targetId: string) {
    if (draggedId === "pos-gg" || draggedId === targetId) return;
    const dragged = byId.get(draggedId);
    const target = byId.get(targetId);
    if (!dragged || !target || isDescendant(draggedId, targetId, byId)) return;
    const sameParent = dragged.parentId === target.parentId;
    const next = positions.map((position) => {
      if (position.id === draggedId) {
        return sameParent
          ? { ...position, order: target.order - 0.5 }
          : { ...position, parentId: targetId, order: childrenOf(targetId, positions).length + 1 };
      }
      return position;
    });
    const normalized = sortPositions(next).map((position, index) => ({ ...position, order: position.parentId === dragged.parentId ? index + 1 : position.order }));
    persistPositions(normalized);
    setSelectedId(draggedId);
  }

  function openAgentWizard(position: OrgPosition) {
    setWizard({ positionId: position.id, step: 1, draft: buildAgentProfileDraft(position) });
    setSelectedId(position.id);
    setMenuId(null);
  }

  function createAgentFromWizard() {
    if (!wizardPosition || !wizard) return;
    const profile = createAgentProfileFromDraft(wizardPosition, wizard.draft);
    const nextProfiles = [...profiles.filter((item) => item.id !== profile.id && item.positionId !== wizardPosition.id), profile];
    persistProfiles(nextProfiles);
    persistPositions(positions.map((position) => (position.id === wizardPosition.id ? { ...position, agentId: profile.id, status: "proposed" } : position)));
    setSelectedId(wizardPosition.id);
    setWizard(null);
  }

  function updatePositionStatus(id: string, status: OrgPositionStatus) {
    persistPositions(positions.map((position) => (position.id === id ? { ...position, status } : position)));
    setMenuId(null);
  }

  function updateAgentStatus(agentId: string, status: AgentProfileStatus) {
    const now = new Date().toISOString();
    const nextProfiles = profiles.map((profile) => (profile.id === agentId ? { ...profile, status, updatedAt: now } : profile));
    persistProfiles(nextProfiles);
    persistPositions(positions.map((position) => {
      if (position.agentId !== agentId) return position;
      if (status === "active") return { ...position, status: "active" };
      if (status === "observer") return { ...position, status: "observer" };
      if (status === "disabled") return { ...position, status: "disabled" };
      return { ...position, status: "proposed" };
    }));
  }

  function unassign(id: string) {
    persistPositions(positions.map((position) => (position.id === id ? { ...position, agentId: null, status: "vacant" } : position)));
    setMenuId(null);
  }

  function deleteSelected() {
    if (!selected || selected.id === "pos-gg") return;
    if (positions.some((position) => position.parentId === selected.id) || selected.agentId) return;
    persistPositions(positions.filter((position) => position.id !== selected.id));
    setSelectedId("pos-gg");
  }

  const selectedIndicators = selected?.agentId ? indicatorsByAgent.get(selected.agentId) ?? null : null;
  const selectedAgent = selected?.agentId ? agentMap.get(selected.agentId) ?? null : null;
  const needsPrompt =
    "Analiza tus interacciones recientes y senala unicamente areas donde hayas tenido falta de contexto, correcciones, preguntas repetidas o necesidad de apoyo. No inventes necesidades.";

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Organigrama IA</p>
            <h1 className="mt-1 text-lg font-semibold text-slate-950">Posiciones y agentes IA</h1>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
              POSITION es el lugar en la organizacion. AGENT es la identidad IA que ocupa esa posicion. Las posiciones/perfiles nuevos usan localStorage temporal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{activeCount} ocupadas</span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{vacantCount} vacantes</span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{configuredCount} en config.</span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{disabledCount} deshab.</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditMode((value) => !value)}>{editMode ? "Salir edicion" : "Modo edicion"}</button>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => openNewPosition()}>+ Nueva posicion</button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
        <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
          <OrgTree
            positions={positions}
            profiles={profiles}
            editMode={editMode}
            selectedId={selectedId}
            dropTargetId={dropTargetId}
            menuId={menuId}
            agentMap={agentMap}
            indicatorsByAgent={indicatorsByAgent}
            onSelect={setSelectedId}
            onMenu={setMenuId}
            onAddChild={openNewPosition}
            onCreateAgent={openAgentWizard}
            onEdit={openEditPosition}
            onMove={movePosition}
            onDropTarget={setDropTargetId}
            onStatus={updatePositionStatus}
            onUnassign={unassign}
            onNeeds={setNeedsAgentId}
          />
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-400">Nodo seleccionado</p>
            {selected ? (
              <>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">{selectedAgent?.name ?? selected.name}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">{selectedProfile?.roleDescription ?? selected.description}</p>
                <div className="mt-2 grid gap-1 text-xs text-slate-600">
                  <span>Posicion: <b>{selected.name}</b></span>
                  <span>Reporta a: <b>{selected.parentId ? byId.get(selected.parentId)?.name ?? "No encontrado" : "Nadie"}</b></span>
                  <span>Estado posicion: <b>{labelForPositionStatus(selected.status)}</b></span>
                  <span>Estado agente: <b>{selectedProfile ? statusLabelForAgent(selectedProfile.status) : selectedAgent ? "Registro estatico" : "Vacante"}</b></span>
                  <span>Tipo: <b>{kindLabel(selected.kind)}</b></span>
                </div>

                {selectedIndicators ? (
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Cobertura operativa</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <span>Skills activas: <b>{selectedIndicators.activeSkills}</b></span>
                      <span>Conoc. aprobado: <b>{selectedIndicators.approvedKnowledge}</b></span>
                      <span>Correcciones: <b>{selectedIndicators.negativeSignals}</b></span>
                      <span>Falta contexto: <b>{selectedIndicators.groundedAnswers > 0 && selectedIndicators.approvedKnowledge === 0 ? selectedIndicators.groundedAnswers : 0}</b></span>
                      <span className="col-span-2">Ultima actividad: <b>{formatDate(selectedIndicators.lastActivityAt)}</b></span>
                    </div>
                  </div>
                ) : null}

                {selectedTemplate && !selected.agentId ? (
                  <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2">
                    <p className="text-[10px] font-semibold uppercase text-blue-700">Plantilla de rol</p>
                    <p className="mt-1 text-xs text-blue-900">{selectedTemplate.skills.length} skills base sugeridas para {selectedTemplate.roleLabel}.</p>
                  </div>
                ) : null}

                {selectedProfile ? (
                  <div className="mt-3 grid gap-2">
                    {selectedProfile.status === "configuring" ? <button className="btn btn--warning btn--sm" onClick={() => updateAgentStatus(selectedProfile.id, "pending_approval")}>Enviar a aprobacion</button> : null}
                    {selectedProfile.status === "pending_approval" ? <button className="btn btn--success btn--sm" onClick={() => updateAgentStatus(selectedProfile.id, "active")}>Aprobar y activar</button> : null}
                    {selectedProfile.status === "active" ? <button className="btn btn--ghost btn--sm" onClick={() => updateAgentStatus(selectedProfile.id, "disabled")}>Deshabilitar agente</button> : null}
                    {selectedProfile.status === "disabled" ? <button className="btn btn--success btn--sm" onClick={() => updateAgentStatus(selectedProfile.id, "active")}>Reactivar agente</button> : null}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {!selected.agentId ? <button className="btn btn--primary btn--sm" onClick={() => openAgentWizard(selected)}>+ Crear agente IA</button> : null}
                  {selected.agentId ? <button className="btn btn--ghost btn--sm" onClick={() => setNeedsAgentId(selected.agentId)}>Consultar necesidades</button> : null}
                  {selected.agentId ? <Link href={`/skills?agent=${selected.agentId}`} className="btn btn--ghost btn--sm">Skills</Link> : null}
                  {selected.agentId ? <Link href={`/conocimiento?agent=${selected.agentId}`} className="btn btn--ghost btn--sm">Conocimiento</Link> : null}
                  {selected.agentId ? <Link href={`/linea-tiempo?agent=${selected.agentId}`} className="btn btn--ghost btn--sm">Actividad</Link> : null}
                  {selected.agentId ? <Link href={`/agentes?agent=${selected.agentId}`} className="btn btn--ghost btn--sm">Editar agente</Link> : null}
                </div>
              </>
            ) : <p className="mt-2 text-xs text-slate-500">Selecciona una posicion.</p>}
          </div>

          {editMode ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase text-blue-700">Edicion</p>
              <div className="mt-2 grid gap-2">
                <button type="button" className="btn btn--primary btn--sm" onClick={() => selected && openEditPosition(selected)} disabled={!selected}>Editar posicion</button>
                <button type="button" className="btn btn--danger btn--sm" onClick={deleteSelected} disabled={!selected || selected.id === "pos-gg" || Boolean(selected.agentId) || positions.some((position) => position.parentId === selected.id)}>Eliminar vacante segura</button>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-blue-800">Arrastra una caja sobre otra: si son hermanas se reordena; si no, cambia el supervisor.</p>
            </div>
          ) : null}
        </aside>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-950">{draft.id ? "Editar posicion" : "Crear posicion"}</h3>
                <p className="mt-1 text-sm text-slate-500">Asignar agente existente es secundario. Para una vacante, usa Crear agente IA.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="text-sm text-slate-500 hover:text-slate-900">Cerrar</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">Nombre de posicion<input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">Area<input value={draft.area} onChange={(event) => setDraft((prev) => ({ ...prev, area: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">Rol<input value={draft.role} onChange={(event) => setDraft((prev) => ({ ...prev, role: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">Tipo<select value={draft.kind} onChange={(event) => setDraft((prev) => ({ ...prev, kind: event.target.value as OrgPositionKind }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="supervisor">Supervisor</option><option value="coordinador">Coordinador</option><option value="especialista">Especialista</option><option value="soporte">Soporte</option></select></label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">Reporta a<select value={draft.parentId} onChange={(event) => setDraft((prev) => ({ ...prev, parentId: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">Sin supervisor</option>{positions.filter((position) => position.id !== draft.id).map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}</select></label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">Asignar agente existente<select value={draft.agentId} onChange={(event) => setDraft((prev) => ({ ...prev, agentId: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">Vacante</option>{Array.from(agentMap.values()).map((agent) => <option key={agent.id} value={agent.id}>{agent.initials} - {agent.name}</option>)}</select></label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">Estado posicion<select value={draft.status} onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value as OrgPositionStatus }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="active">Ocupada</option><option value="observer">Observador</option><option value="disabled">Deshabilitada</option><option value="vacant">Vacante</option><option value="proposed">En configuracion</option></select></label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">Descripcion<textarea value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn btn--ghost">Cancelar</button>
              <button type="button" onClick={savePosition} className="btn btn--primary">Guardar posicion</button>
            </div>
          </div>
        </div>
      ) : null}

      {wizard && wizardPosition ? (
        <AgentWizard
          position={wizardPosition}
          parent={wizardParent}
          draft={wizard.draft}
          step={wizard.step}
          onStep={(step) => setWizard((current) => current ? { ...current, step } : current)}
          onDraft={(nextDraft) => setWizard((current) => current ? { ...current, draft: nextDraft } : current)}
          onClose={() => setWizard(null)}
          onCreate={createAgentFromWizard}
        />
      ) : null}

      {needsAgentId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-950">Consultar necesidades</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">La respuesta debe quedar como propuesta revisable. No se convierte automaticamente en skill ni conocimiento.</p>
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">{needsPrompt}</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <button type="button" className="btn btn--ghost btn--sm" disabled>Propuesta de conocimiento</button>
              <button type="button" className="btn btn--ghost btn--sm" disabled>Propuesta de skill</button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn--ghost" onClick={() => setNeedsAgentId(null)}>Cerrar</button>
              {needsAgentId ? <Link className="btn btn--primary" href={`/chat?agent=${needsAgentId}`}>Abrir Chat</Link> : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
