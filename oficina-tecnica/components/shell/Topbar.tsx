"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "../../lib/icons";
import { useStore } from "../../lib/store/StoreProvider";
import { NotificationPanel } from "./NotificationPanel";
import { routeIdToPath } from "./GlobalSearch";
import { Button } from "../ui";

export function Topbar({
  onOpenSearch,
  userEmail,
  onLogout,
}: {
  onOpenSearch: () => void;
  userEmail?: string;
  onLogout?: () => void;
}) {
  const router = useRouter();
  const { state, remoteConfigured } = useStore();
  const [showNotif, setShowNotif] = useState(false);
  const unread = state.notifications.filter((n) => !n.read).length;
  const systemChips = [remoteConfigured ? "Supabase" : "Memoria local"];

  function navigate(routeId: string) {
    router.push(routeIdToPath(routeId));
  }

  return (
    <header className="ig-topbar">
      <div className="ig-topbar-left">
        <button type="button" className="tb-project" onClick={() => navigate("dashboard")}>
          <div className="tb-project-icon">
            <Icons.folder width={12} height={12} />
          </div>
          <div>
            <div className="tb-project-name">Oficina Técnica</div>
            <div className="tb-project-sub">Portafolio de ingeniería</div>
          </div>
        </button>

        <div className="tb-system-chips">
          {systemChips.map((c) => (
            <span key={c} className="tb-chip">
              {c}
            </span>
          ))}
          <span className="tb-chip tb-chip--ai">IA real al publicar</span>
        </div>
      </div>

      <div className="ig-topbar-right">
        <button
          type="button"
          className="tb-chip tb-search-trigger"
          onClick={onOpenSearch}
          aria-label="Abrir búsqueda global"
        >
          <Icons.eye width={13} height={13} />
          <span>Buscar</span>
          <span className="tb-kbd">⌘K</span>
        </button>

        <div className="tb-popover-anchor">
          <button
            type="button"
            className={`tb-alert ${unread === 0 ? "tb-alert--idle" : ""}`}
            onClick={() => setShowNotif((s) => !s)}
            aria-label={unread > 0 ? `Abrir alertas: ${unread} nuevas` : "Abrir alertas"}
            aria-expanded={showNotif}
          >
            <Icons.bell width={13} height={13} />
            <span>{unread > 0 ? `${unread} nueva${unread > 1 ? "s" : ""}` : "Alertas"}</span>
          </button>
          {showNotif && (
            <>
              <div className="tb-overlay-capture" onClick={() => setShowNotif(false)} />
              <NotificationPanel onClose={() => setShowNotif(false)} onNavigate={navigate} />
            </>
          )}
        </div>

        <div className="tb-user">
          <div className="tb-avatar">
            {userEmail ? userEmail[0].toUpperCase() : "G"}
          </div>
          <div className="tb-user-meta">
            <div className="tb-user-name" title={userEmail}>
              {userEmail || "Gerente General"}
            </div>
            <div className="tb-user-role">Administrador</div>
          </div>
          {onLogout && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              leftIcon={<Icons.arrowRight width={13} height={13} />}
              onClick={onLogout}
              title="Cerrar sesión"
              className="tb-logout"
              aria-label="Cerrar sesión"
            >
              Cerrar sesión
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
