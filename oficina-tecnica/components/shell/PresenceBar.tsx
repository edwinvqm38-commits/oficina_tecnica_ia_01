"use client";

import { usePresence } from "../../lib/presence/usePresence";

/**
 * Shows small avatar circles for other users currently viewing the same
 * sidebar section, so people can coordinate before editing the same data.
 */
export function PresenceBar({ routeId, email, name }: { routeId: string; email?: string; name?: string }) {
  const others = usePresence(routeId, email, name);
  if (others.length === 0) return null;

  return (
    <div className="presence-bar">
      <span className="presence-label">También aquí:</span>
      <div className="presence-stack">
        {others.map((u, i) => (
          <div
            key={u.email}
            title={`${u.name} · ${u.email}`}
            className="presence-avatar"
            style={{ background: u.color, marginLeft: i > 0 ? -8 : 0 }}
          >
            {u.initials}
          </div>
        ))}
      </div>
    </div>
  );
}
