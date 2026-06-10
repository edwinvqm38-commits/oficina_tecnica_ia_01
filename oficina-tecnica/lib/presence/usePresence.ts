"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../supabase/client";
import { colorForEmail, initialsFor } from "./avatar";

export type PresenceUser = {
  email: string;
  name: string;
  routeId: string;
  color: string;
  initials: string;
};

const PRESENCE_CHANNEL = "presence:app";

/**
 * Tracks the current user's location (routeId) on a shared Supabase Realtime
 * presence channel and returns the other users currently on the same route,
 * so the UI can show "who else is here" across any sidebar tab.
 */
export function usePresence(routeId: string, email: string | undefined, name: string | undefined): PresenceUser[] {
  const [others, setOthers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!email) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const self: PresenceUser = {
      email,
      name: name || email,
      routeId,
      color: colorForEmail(email),
      initials: initialsFor(name || email, email),
    };

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: email } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const presenceState = channel.presenceState<PresenceUser>();
      const all = Object.values(presenceState).flatMap((entries) =>
        entries.map((p) => p as unknown as PresenceUser)
      );
      setOthers(all.filter((u) => u.email !== email && u.routeId === routeId));
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.track(self);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [email, name, routeId]);

  return others;
}
