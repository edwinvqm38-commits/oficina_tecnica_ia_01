"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Live count of user_profiles with status="pending", for the admin
 * sidebar badge. Refreshes via Supabase Realtime when registrations
 * change (new request, approved, rejected, etc.).
 */
export function usePendingUsersCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    let cancelled = false;

    async function refresh() {
      const { count: c } = await supabase
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!cancelled) setCount(c ?? 0);
    }

    refresh();

    const channel = supabase
      .channel("sidebar-pending-users")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_profiles" }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return count;
}
