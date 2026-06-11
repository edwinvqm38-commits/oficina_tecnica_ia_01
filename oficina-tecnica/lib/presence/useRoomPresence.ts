"use client";

// Tracks "who's actively connected" for a room (e.g. Mesa de trabajo) on a
// dedicated Supabase Realtime presence channel, separate from the global
// "presence:app" channel used by PresenceBar — avoids subscribing twice to
// the same channel topic.
//
// Each client periodically re-tracks its own `lastActive` timestamp (only
// while the tab is visible) so other clients can derive online/away/offline
// status without a database table or polling.

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../supabase/client";

export type RoomPresenceEntry = {
  email: string;
  name: string;
  lastActive: number; // epoch ms
};

const HEARTBEAT_MS = 30_000;
const TICK_MS = 15_000;

export const ONLINE_THRESHOLD_MS = 60_000;       // < 1 min
export const AWAY_THRESHOLD_MS = 5 * 60_000;     // < 5 min

export type PresenceStatus = "online" | "away" | "offline";

export function presenceStatus(lastActive: number | undefined, now: number): PresenceStatus {
  if (lastActive == null) return "offline";
  const diff = now - lastActive;
  if (diff < ONLINE_THRESHOLD_MS) return "online";
  if (diff < AWAY_THRESHOLD_MS) return "away";
  return "offline";
}

/**
 * Returns a map of email -> presence entry for everyone currently tracked on
 * `channelName` (including the current user), plus a `now` timestamp that
 * ticks every 15s so callers can re-derive online/away/offline status even
 * without new presence events.
 */
export function useRoomPresence(
  channelName: string,
  email: string | undefined,
  name: string | undefined
): { presence: Map<string, RoomPresenceEntry>; now: number } {
  const [presence, setPresence] = useState<Map<string, RoomPresenceEntry>>(new Map());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!email) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: email } },
    });

    function track() {
      channel.track({ email, name: name || email, lastActive: Date.now() });
    }

    channel.on("presence", { event: "sync" }, () => {
      const presenceState = channel.presenceState<RoomPresenceEntry>();
      const map = new Map<string, RoomPresenceEntry>();
      for (const entries of Object.values(presenceState)) {
        for (const p of entries) {
          const entry = p as unknown as RoomPresenceEntry;
          map.set(entry.email, entry);
        }
      }
      setPresence(map);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") track();
    });

    const heartbeat = setInterval(() => {
      if (document.visibilityState === "visible") track();
    }, HEARTBEAT_MS);

    const tick = setInterval(() => setNow(Date.now()), TICK_MS);

    return () => {
      clearInterval(heartbeat);
      clearInterval(tick);
      void supabase.removeChannel(channel);
    };
  }, [channelName, email, name]);

  return { presence, now };
}
