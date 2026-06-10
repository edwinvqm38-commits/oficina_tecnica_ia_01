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
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 11, color: "var(--t3)" }}>También aquí:</span>
      <div style={{ display: "flex" }}>
        {others.map((u, i) => (
          <div
            key={u.email}
            title={`${u.name} · ${u.email}`}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: u.color,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              border: "2px solid var(--bg)",
              marginLeft: i > 0 ? -8 : 0,
              flexShrink: 0,
            }}
          >
            {u.initials}
          </div>
        ))}
      </div>
    </div>
  );
}
