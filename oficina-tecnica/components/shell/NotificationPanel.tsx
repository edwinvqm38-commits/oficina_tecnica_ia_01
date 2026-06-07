"use client";

import { useEffect } from "react";
import { Icons } from "../../lib/icons";
import { useStore } from "../../lib/store/StoreProvider";
import type { NotificationKind } from "../../lib/store/types";

const NOTIF_COLOR: Record<NotificationKind, string> = {
  success: "var(--green)",
  danger: "var(--red)",
  warning: "var(--amber)",
  info: "var(--blue)",
};

export function NotificationPanel({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (route: string) => void;
}) {
  const { state, markAllNotificationsRead } = useStore();
  const notifs = state.notifications;

  useEffect(() => {
    const t = setTimeout(() => markAllNotificationsRead(), 1200);
    return () => clearTimeout(t);
  }, [markAllNotificationsRead]);

  return (
    <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--t1)" }}>Notificaciones</span>
        <button className="btn btn--ghost btn--sm" onClick={() => markAllNotificationsRead()}>
          Marcar leídas
        </button>
      </div>
      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {notifs.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
            <Icons.bell width={24} height={24} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
            Sin notificaciones
          </div>
        ) : (
          notifs.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${!n.read ? "notif-item--unread" : ""}`}
              onClick={() => {
                if (n.route) onNavigate(n.route);
                onClose();
              }}
            >
              <div className="notif-dot" style={{ background: NOTIF_COLOR[n.kind] || "var(--blue)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{n.title}</div>
                <div style={{ fontSize: 11, color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</div>
                <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2, fontFamily: "var(--mono)" }}>
                  {new Date(n.ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
