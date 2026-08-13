"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icons } from "../../lib/icons";
import { ROUTE_GROUPS, type RouteDef } from "../../lib/routes";
import { usePendingApprovalsCount } from "../../lib/store/StoreProvider";
import { useSession } from "../../lib/auth/useSession";
import { usePendingUsersCount } from "../../lib/auth/usePendingUsersCount";
import { useSectionAccess } from "../../lib/auth/useSectionAccess";

const ADMIN_EMAIL = "edwin.qm@outlook.com";
const ADMIN_ROUTES = new Set(["connections", "wiki-ia", "admin-users", "administrador"]);

function hasActiveChild(item: RouteDef, activeRoute: string): boolean {
  return item.children?.some((child) => child.id === activeRoute) ?? false;
}

function ParentItem({
  item,
  activeRoute,
  badges,
  canAccessRoute,
}: {
  item: RouteDef;
  activeRoute: string;
  badges: Partial<Record<string, number | null>>;
  canAccessRoute: (routeId: string) => boolean;
}) {
  const isChildActive = hasActiveChild(item, activeRoute);
  const [open, setOpen] = useState(isChildActive);

  useEffect(() => {
    if (!isChildActive) return;
    const timer = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [isChildActive]);

  const Icon = Icons[item.icon];
  const isParentActive = activeRoute === item.id;
  const cls = ["sb-item", isParentActive ? "sb-item--active" : "", open ? "sb-item--open" : ""].filter(Boolean).join(" ");
  const visibleChildren = (item.children ?? []).filter((child) => canAccessRoute(child.id));

  return (
    <div>
      <button
        type="button"
        className={cls}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="sb-item-left">
          <span className="sb-icon">
            <Icon />
          </span>
          <span className="sb-item-label">{item.label}</span>
        </span>
        <span className="sb-chevron" aria-hidden="true">
          <Icons.chevronRight />
        </span>
      </button>

      {open && visibleChildren.length > 0 ? (
        <div className="sb-subnav">
          {visibleChildren.map((child) => {
            const active = activeRoute === child.id;
            const ChildIcon = Icons[child.icon];
            const childCls = ["sb-item", active ? "sb-item--active" : ""].filter(Boolean).join(" ");
            const badge = badges[child.id] ?? null;
            return (
              <Link
                key={child.id}
                href={child.path}
                className={childCls}
              >
                <span className="sb-item-left">
                  <span className="sb-icon sb-icon--child">
                    <ChildIcon />
                  </span>
                  <span className="sb-item-label">
                    {child.label}
                  </span>
                </span>
                {badge ? <span className="sb-badge">{badge}</span> : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({ activeRoute }: { activeRoute: string }) {
  const { session } = useSession(false);
  const isAdmin = session?.email === ADMIN_EMAIL;
  const { canAccessRoute } = useSectionAccess(session?.email);
  const pendingApprovals = usePendingApprovalsCount();
  const pendingUsers = usePendingUsersCount(isAdmin);

  const badges: Partial<Record<string, number | null>> = {
    approvals: pendingApprovals || null,
    skills: null,
    memory: null,
    "admin-users": pendingUsers || null,
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
            {group.items
              .filter((item) => (!ADMIN_ROUTES.has(item.id) || isAdmin) && canAccessRoute(item.id))
              .map((item) => {
              if (item.children && item.children.length > 0) {
                return (
                  <ParentItem
                    key={item.id}
                    item={item}
                    activeRoute={activeRoute}
                    badges={badges}
                    canAccessRoute={canAccessRoute}
                  />
                );
              }

              const active = activeRoute === item.id;
              const Icon = Icons[item.icon];
              const badge = badges[item.id] ?? null;
              const cls = ["sb-item", active ? "sb-item--active" : ""].filter(Boolean).join(" ");

              if (item.disabled) {
                return (
                  <span
                    key={item.id}
                    className="sb-item sb-item--disabled"
                    title="Próximamente"
                  >
                    <span className="sb-item-left">
                      <span className="sb-icon"><Icon /></span>
                      <span className="sb-item-label">{item.label}</span>
                    </span>
                    <span className="sb-prox">pronto</span>
                  </span>
                );
              }

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
