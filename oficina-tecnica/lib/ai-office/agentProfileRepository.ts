import type { Agent } from "@/lib/types";
import type { OrgPosition } from "./agentOrgRepository";

export type AgentProfileStatus = "proposed" | "configuring" | "pending_approval" | "active" | "observer" | "disabled";

export type AgentProfile = {
  id: string;
  name: string;
  initials: string;
  positionId: string;
  positionName: string;
  area: string;
  specialty: string;
  roleDescription: string;
  objective: string;
  responsibilities: string[];
  limits: string[];
  agentType: string;
  logicalPermissions: string[];
  expectedCapabilities: string[];
  status: AgentProfileStatus;
  source: "localStorage";
  createdAt: string;
  updatedAt: string;
};

export type RoleSkillTemplate = {
  id: string;
  roleKey: string;
  roleLabel: string;
  skills: string[];
};

export type AgentProfileDraft = {
  name: string;
  code: string;
  area: string;
  specialty: string;
  roleDescription: string;
  objective: string;
  responsibilitiesText: string;
  limitsText: string;
  agentType: string;
  logicalPermissionsText: string;
  expectedCapabilitiesText: string;
};

export type AgentProfileRepository = {
  source: "localStorage";
  listProfiles: () => AgentProfile[];
  saveProfiles: (profiles: AgentProfile[]) => void;
};

const PROFILES_STORAGE_KEY = "ot:agent:profiles:v1";

export const ROLE_SKILL_TEMPLATES: RoleSkillTemplate[] = [
  {
    id: "role-control-documentario",
    roleKey: "control-documentario",
    roleLabel: "Control Documentario",
    skills: [
      "Gestion documental",
      "Control de versiones",
      "Codificacion documental",
      "Trazabilidad",
      "Correspondencia",
      "Registro de entregables",
      "Seguimiento de estados",
    ],
  },
  {
    id: "role-ing-civil",
    roleKey: "ing-civil",
    roleLabel: "Ing. Civil",
    skills: [
      "Revision civil basica",
      "Metrados",
      "Especificaciones civiles",
      "Consultas tecnicas civiles",
    ],
  },
  {
    id: "role-ing-mecanico",
    roleKey: "ing-mecanico",
    roleLabel: "Ing. Mecanico",
    skills: [
      "Equipos mecanicos",
      "Especificaciones mecanicas",
      "Revision documental mecanica",
    ],
  },
  {
    id: "role-ing-electrico",
    roleKey: "ing-electrico",
    roleLabel: "Ing. Electrico",
    skills: [
      "Revision electrica basica",
      "Criterios CNE/IEC/IEEE",
      "Revision documental electrica",
    ],
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function statusLabelForAgent(status: AgentProfileStatus): string {
  if (status === "configuring") return "En configuracion";
  if (status === "pending_approval") return "Pendiente de aprobacion";
  if (status === "active") return "Activo";
  if (status === "observer") return "Observador";
  if (status === "disabled") return "Deshabilitado";
  return "Propuesto";
}

export function roleKeyForPosition(position: Pick<OrgPosition, "name" | "role" | "area">): string {
  const haystack = normalize(`${position.name} ${position.role} ${position.area}`);
  if (haystack.includes("document")) return "control-documentario";
  if (haystack.includes("civil")) return "ing-civil";
  if (haystack.includes("mecan")) return "ing-mecanico";
  if (haystack.includes("electric")) return "ing-electrico";
  return haystack || "rol-generico";
}

export function templateForPosition(position: Pick<OrgPosition, "name" | "role" | "area">): RoleSkillTemplate | null {
  const roleKey = roleKeyForPosition(position);
  return ROLE_SKILL_TEMPLATES.find((template) => template.roleKey === roleKey) ?? null;
}

export function defaultAgentCodeForPosition(position: Pick<OrgPosition, "name" | "role" | "area">): string {
  const roleKey = roleKeyForPosition(position);
  if (roleKey === "control-documentario") return "CD";
  if (roleKey === "ing-civil") return "CIV";
  if (roleKey === "ing-mecanico") return "MEC";
  if (roleKey === "ing-electrico") return "ELE";
  return position.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase() || "AG";
}

export function buildAgentProfileDraft(position: OrgPosition): AgentProfileDraft {
  const template = templateForPosition(position);
  const code = defaultAgentCodeForPosition(position);
  return {
    name: position.name.replace(/\.$/, ""),
    code,
    area: position.area,
    specialty: template?.roleLabel ?? position.role,
    roleDescription: position.description,
    objective: `Cubrir la posicion ${position.name} con un agente IA especializado, gobernado y aprobado antes de participar operativamente.`,
    responsibilitiesText: [
      `Atender consultas propias de ${position.role}.`,
      "Distinguir datos registrados de supuestos.",
      "Proponer conocimiento o skills solo cuando exista evidencia.",
    ].join("\n"),
    limitsText: [
      "No inventar acceso a datos ni permisos.",
      "No tomar decisiones de aprobacion sin GG.",
      "No sustituir criterio profesional responsable.",
    ].join("\n"),
    agentType: "Asistente IA especializado",
    logicalPermissionsText: [
      "Solo contexto autorizado por modulo.",
      "Solo conocimiento aprobado del agente.",
      "Sin acceso nuevo hasta configurar RLS/permisos.",
    ].join("\n"),
    expectedCapabilitiesText: template?.skills.join("\n") ?? "Capacidades por definir durante configuracion.",
  };
}

export function createAgentProfileFromDraft(position: OrgPosition, draft: AgentProfileDraft): AgentProfile {
  const now = new Date().toISOString();
  const id = normalize(draft.code || defaultAgentCodeForPosition(position));
  return {
    id,
    name: draft.name.trim() || position.name,
    initials: (draft.code.trim() || defaultAgentCodeForPosition(position)).toUpperCase().slice(0, 4),
    positionId: position.id,
    positionName: position.name,
    area: draft.area.trim() || position.area,
    specialty: draft.specialty.trim() || position.role,
    roleDescription: draft.roleDescription.trim() || position.description,
    objective: draft.objective.trim(),
    responsibilities: splitLines(draft.responsibilitiesText),
    limits: splitLines(draft.limitsText),
    agentType: draft.agentType.trim() || "Asistente IA especializado",
    logicalPermissions: splitLines(draft.logicalPermissionsText),
    expectedCapabilities: splitLines(draft.expectedCapabilitiesText),
    status: "configuring",
    source: "localStorage",
    createdAt: now,
    updatedAt: now,
  };
}

export function profileToAgent(profile: AgentProfile): Agent {
  return {
    id: profile.id,
    name: profile.name,
    initials: profile.initials,
    role: profile.specialty,
    type: profile.status === "active" || profile.status === "observer" ? "agent" : "agent-future",
    status: profile.status === "active" ? "active" : profile.status === "disabled" ? "future" : "needs-approval",
    skillCount: 0,
    tasks: 0,
    confidence: null,
    focus: profile.objective,
    currentTask: statusLabelForAgent(profile.status),
  };
}

function readProfiles(): AgentProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AgentProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProfiles(profiles: AgentProfile[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
}

export function createLocalAgentProfileRepository(): AgentProfileRepository {
  return {
    source: "localStorage",
    listProfiles: readProfiles,
    saveProfiles,
  };
}
