export type OrgPositionKind = "supervisor" | "coordinador" | "especialista" | "soporte";
export type OrgPositionStatus = "active" | "observer" | "disabled" | "vacant" | "proposed";

export type OrgPosition = {
  id: string;
  name: string;
  area: string;
  role: string;
  kind: OrgPositionKind;
  parentId: string | null;
  agentId: string | null;
  status: OrgPositionStatus;
  description: string;
  order: number;
};

export type OrgPositionDraft = {
  id?: string;
  name: string;
  area: string;
  role: string;
  kind: OrgPositionKind;
  parentId: string;
  agentId: string;
  status: OrgPositionStatus;
  description: string;
};

export type AgentOrgRepository = {
  source: "localStorage";
  listPositions: () => OrgPosition[];
  savePositions: (positions: OrgPosition[]) => void;
};

const POSITIONS_STORAGE_KEY = "ot:org:positions:v2";

export const DEFAULT_ORG_POSITIONS: OrgPosition[] = [
  {
    id: "pos-gg",
    name: "Gerencia General",
    area: "Dirección",
    role: "Gobierno y aprobación",
    kind: "supervisor",
    parentId: null,
    agentId: "gg",
    status: "active",
    description: "Autoridad de gobierno para decisiones críticas y activación de capacidades.",
    order: 1,
  },
  {
    id: "pos-pm",
    name: "Project Management",
    area: "Gestión",
    role: "Coordinación de proyectos",
    kind: "coordinador",
    parentId: "pos-gg",
    agentId: "pm",
    status: "active",
    description: "Coordina cronograma, restricciones y riesgos.",
    order: 1,
  },
  {
    id: "pos-costos",
    name: "Costos",
    area: "Presupuestos",
    role: "Control económico",
    kind: "especialista",
    parentId: "pos-gg",
    agentId: "ic",
    status: "active",
    description: "Revisa costos y desviaciones cuando hay datos reales.",
    order: 2,
  },
  {
    id: "pos-cd",
    name: "Control Doc.",
    area: "Soporte",
    role: "Trazabilidad documental",
    kind: "soporte",
    parentId: "pos-gg",
    agentId: null,
    status: "vacant",
    description: "Posición preparada para soporte documental.",
    order: 3,
  },
  {
    id: "pos-ing",
    name: "Ingeniería",
    area: "Ingeniería",
    role: "Coordinación técnica",
    kind: "coordinador",
    parentId: "pos-gg",
    agentId: null,
    status: "vacant",
    description: "Agrupa especialidades técnicas.",
    order: 4,
  },
  {
    id: "pos-ie",
    name: "Ing. Eléctrico",
    area: "Ingeniería",
    role: "Especialidad eléctrica",
    kind: "especialista",
    parentId: "pos-ing",
    agentId: "ie",
    status: "active",
    description: "Especialidad eléctrica con criterios técnicos aprobables.",
    order: 1,
  },
  {
    id: "pos-civil",
    name: "Ing. Civil",
    area: "Ingeniería",
    role: "Especialidad civil",
    kind: "especialista",
    parentId: "pos-ing",
    agentId: null,
    status: "vacant",
    description: "Vacante hasta definir agente, prompt y permisos.",
    order: 2,
  },
  {
    id: "pos-mec",
    name: "Ing. Mecánico",
    area: "Ingeniería",
    role: "Especialidad mecánica",
    kind: "especialista",
    parentId: "pos-ing",
    agentId: null,
    status: "vacant",
    description: "Vacante hasta definir agente, prompt y permisos.",
    order: 3,
  },
];

function readLocalPositions(): OrgPosition[] {
  if (typeof window === "undefined") return DEFAULT_ORG_POSITIONS;
  try {
    const raw = localStorage.getItem(POSITIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_ORG_POSITIONS;
    const parsed = JSON.parse(raw) as OrgPosition[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ORG_POSITIONS;
  } catch {
    return DEFAULT_ORG_POSITIONS;
  }
}

function saveLocalPositions(positions: OrgPosition[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positions));
}

export function createLocalAgentOrgRepository(): AgentOrgRepository {
  return {
    source: "localStorage",
    listPositions: readLocalPositions,
    savePositions: saveLocalPositions,
  };
}
