"use client";

import Link from "next/link";
import { Icons } from "../../lib/icons";
import { ROUTE_GROUPS } from "../../lib/routes";
import { useStore, useSkillsWithOverrides, usePendingApprovalsCount } from "../../lib/store/StoreProvider";
import { KNOWLEDGE, PROJECTS } from "../../lib/data";

export function Sidebar({ activeRoute }: { activeRoute: string }) {
  const { state } = useStore();
  const pendingApprovals = usePendingApprovalsCount();
  const skills = useSkillsWithOverrides();
  const proposedKB = [...KNOWLEDGE, ...state.knowledge].filter((k) => k.status === "proposed").length;
  const totalProjects = PROJECTS.length + state.customProjects.length;

  const badges: Partial<Record<string, number | null>> = {
    approvals: pendingApprovals || null,
    projects: totalProjects || null,
    skills: skills.length || null,
    memory: proposedKB || null,
  };

  return (
    <aside className="ig-sidebar">
      <div className="sb-logo">
        <div className="sb-logo-mark">IG</div>
        <div>
          <div className="sb-logo-name">IA Gerencial</div>
          <div className="sb-logo-sub">Plataforma técnica</div>
        </div>
      </div>

      <nav className="sb-nav">
        {ROUTE_GROUPS.map((group) => (
          <div key={group.label} className="sb-group">
            <span className="sb-group-label">{group.label}</span>
            {group.items.map((item) => {
              const active = activeRoute === item.id;
              const Icon = Icons[item.icon];
              const badge = badges[item.id] ?? null;
              const cls = ["sb-item", active ? "sb-item--active" : ""].filter(Boolean).join(" ");
              return (
                <Link key={item.id} href={item.path} className={cls}>
                  <span className="sb-item-left">
                    <span className="sb-icon">
                      <Icon />
                    </span>
                    <span className="sb-item-label">{item.label}</span>
                  </span>
                  {badge ? <span className="sb-badge">{badge}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sb-footer">
        <div className="sb-status">
          <div className="sb-status-row">
            <span className="sb-status-dot"></span>
            <span className="sb-status-label">Control GG activo</span>
          </div>
          <div className="sb-status-desc">
            Toda acción crítica requiere aprobación explícita del GG.
          </div>
        </div>
      </div>
    </aside>
  );
}
