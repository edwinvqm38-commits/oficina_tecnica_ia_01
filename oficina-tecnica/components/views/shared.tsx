import type { ApprovalStatus, ProjectStatus, Risk, SkillStatus } from "../../lib/types";

type BadgeColor = "green" | "blue" | "amber" | "orange" | "red" | "slate";

const STATUS_BADGE: Record<string, { label: string; color: BadgeColor }> = {
  active: { label: "Activa", color: "green" },
  "on-track": { label: "En curso", color: "green" },
  proposed: { label: "Propuesta", color: "blue" },
  planning: { label: "Planificación", color: "blue" },
  observed: { label: "Observada", color: "amber" },
  "at-risk": { label: "En riesgo", color: "orange" },
  delayed: { label: "Retrasado", color: "red" },
  deprecated: { label: "Deprecada", color: "slate" },
  "needs-approval": { label: "Req. aprobac.", color: "amber" },
  future: { label: "Futuro", color: "slate" },
  "in-review": { label: "En revisión", color: "blue" },
  pending: { label: "Pendiente", color: "blue" },
  approved: { label: "Aprobada", color: "green" },
  rejected: { label: "Rechazada", color: "red" },
};

const RISK_BADGE: Record<Risk, { label: string; color: BadgeColor }> = {
  low: { label: "Riesgo bajo", color: "green" },
  medium: { label: "Riesgo medio", color: "amber" },
  high: { label: "Riesgo alto", color: "orange" },
  critical: { label: "Riesgo crítico", color: "red" },
};

export const CATEGORY_LABEL: Record<string, string> = {
  "critical-decision": "Decisión crítica",
  recommendation: "Recomendación",
  memory: "Memoria",
  skill: "Skill",
};

export function StatusBadge({ status }: { status: ProjectStatus | SkillStatus | ApprovalStatus | string }) {
  const cfg = STATUS_BADGE[status] || { label: status, color: "slate" as BadgeColor };
  return <span className={`badge badge--${cfg.color}`}>{cfg.label}</span>;
}

export function RiskBadge({ risk }: { risk: Risk }) {
  const cfg = RISK_BADGE[risk] || { label: risk, color: "slate" as BadgeColor };
  return <span className={`badge badge--${cfg.color}`}>{cfg.label}</span>;
}

export function ProgressFill({ status, progress }: { status: ProjectStatus; progress: number }) {
  const cls = status === "on-track" ? "green" : status === "at-risk" ? "orange" : status === "delayed" ? "red" : status === "planning" ? "blue" : "slate";
  return (
    <div className="progress">
      <div className={`progress-fill progress-fill--${cls}`} style={{ width: `${progress}%` }} />
    </div>
  );
}

export function agentAvatarClass(agentId: string) {
  return ["gg", "ic", "pm", "ie", "cd", "ti"].includes(agentId) ? `agent-avatar--${agentId}` : "agent-avatar--future";
}
