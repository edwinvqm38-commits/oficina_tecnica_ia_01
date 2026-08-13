"use client";

import { useEffect } from "react";
import { Icons } from "../../lib/icons";
import { useStore } from "../../lib/store/StoreProvider";
import type { NotificationKind } from "../../lib/store/types";
import { Button } from "../ui";

const NOTIF_DOT_CLASS: Record<NotificationKind, string> = {
  success: "notif-dot--success",
  danger: "notif-dot--danger",
  warning: "notif-dot--warning",
  info: "notif-dot--info",
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
      <div className="notif-header">
        <span className="notif-title">Notificaciones</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => markAllNotificationsRead()}>
          Marcar leídas
        </Button>
      </div>
      <div className="notif-list">
        {notifs.length === 0 ? (
          <div className="notif-empty">
            <Icons.bell width={24} height={24} />
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
              <div className={`notif-dot ${NOTIF_DOT_CLASS[n.kind] || "notif-dot--info"}`} />
              <div className="notif-content">
                <div className="notif-item-title">{n.title}</div>
                <div className="notif-item-body">{n.body}</div>
                <div className="notif-time">
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
