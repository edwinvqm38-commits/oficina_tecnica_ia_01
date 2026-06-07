export type ProposalLogoEntityType = "company" | "client";

export type ProposalLogo = {
  id: string;
  entity_type: ProposalLogoEntityType;
  entity_name: string;
  display_name: string;
  logo_url: string;
  is_active: boolean;
  is_default: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

export const PROPOSAL_LOGOS_STORAGE_KEY = "opsia:proposal-logos:v1";

export function normalizeLogoKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function createProposalLogoDraft(entityType: ProposalLogoEntityType = "client"): ProposalLogo {
  const now = new Date().toISOString();
  return {
    id: `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    entity_type: entityType,
    entity_name: entityType === "company" ? "EKA MINING SAC" : "",
    display_name: entityType === "company" ? "EKA MINING SAC" : "",
    logo_url: "",
    is_active: true,
    is_default: entityType === "company",
    notes: "",
    created_at: now,
    updated_at: now,
  };
}

export function readProposalLogos(): ProposalLogo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROPOSAL_LOGOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProposalLogo[]) : [];
  } catch {
    return [];
  }
}

export function writeProposalLogos(logos: ProposalLogo[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROPOSAL_LOGOS_STORAGE_KEY, JSON.stringify(logos));
}

export function findDefaultCompanyLogo(logos: ProposalLogo[]): ProposalLogo | null {
  return (
    logos.find((logo) => logo.entity_type === "company" && logo.is_active && logo.is_default && logo.logo_url.trim()) ??
    logos.find((logo) => logo.entity_type === "company" && logo.is_active && logo.logo_url.trim()) ??
    null
  );
}

export function findClientLogo(logos: ProposalLogo[], clientName: string): ProposalLogo | null {
  const target = normalizeLogoKey(clientName);
  if (!target) return null;
  return (
    logos.find(
      (logo) =>
        logo.entity_type === "client" &&
        logo.is_active &&
        logo.logo_url.trim() &&
        (normalizeLogoKey(logo.entity_name) === target || normalizeLogoKey(logo.display_name) === target),
    ) ?? null
  );
}
