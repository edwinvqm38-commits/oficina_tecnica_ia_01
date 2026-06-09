"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "../../lib/icons";
import { useStore } from "../../lib/store/StoreProvider";
import { NotificationPanel } from "./NotificationPanel";
import { routeIdToPath } from "./GlobalSearch";

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
        <div className="tb-project" onClick={() => navigate("projects")}>
          <div className="tb-project-icon">
            <Icons.folder width={12} height={12} />
          </div>
          <div>
            <div className="tb-project-name">Oficina Técnica</div>
            <div className="tb-project-sub">Portafolio de ingeniería</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
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
          className="tb-chip"
          onClick={onOpenSearch}
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "5px 10px" }}
        >
          <Icons.eye width={13} height={13} />
          <span>Buscar</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--t3)", border: "1px solid var(--border)", borderRadius: 3, padding: "0 4px" }}>⌘K</span>
        </button>

        <div style={{ position: "relative" }}>
          <button
            className="tb-alert"
            onClick={() => setShowNotif((s) => !s)}
            style={unread === 0 ? { background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--t2)" } : {}}
          >
            <Icons.bell width={13} height={13} />
            <span>{unread > 0 ? `${unread} nueva${unread > 1 ? "s" : ""}` : "Alertas"}</span>
          </button>
          {showNotif && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 80 }} onClick={() => setShowNotif(false)} />
              <NotificationPanel onClose={() => setShowNotif(false)} onNavigate={navigate} />
            </>
          )}
        </div>

        <div className="tb-user" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="tb-avatar">
            {userEmail ? userEmail[0].toUpperCase() : "G"}
          </div>
          <div>
            <div className="tb-user-name" title={userEmail}>
              {userEmail
                ? userEmail.length > 20
                  ? userEmail.slice(0, 18) + "…"
                  : userEmail
                : "Gerente General"}
            </div>
            <div className="tb-user-role">Administrador</div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Cerrar sesión"
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 6,
                cursor: "pointer",
                color: "var(--t3)",
                fontSize: 13,
                padding: "3px 7px",
                lineHeight: 1,
                marginLeft: 4,
                transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--red)";
                e.currentTarget.style.borderColor = "var(--red-border)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--t3)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              aria-label="Cerrar sesión"
            >
              →
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
