"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/lib/store/StoreProvider";

const ADMIN_EMAIL = "edwin.qm@outlook.com";

/**
 * Notifies the admin (in-app) in real time when a new user registers and
 * is awaiting approval (status="pending" inserted into user_profiles).
 */
export function usePendingUserNotifications(email: string | undefined) {
  const { notify } = useStore();

  useEffect(() => {
    if (email?.toLowerCase() !== ADMIN_EMAIL) return;

    const channel = supabase
      .channel("admin-pending-user-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_profiles" },
        (payload) => {
          const row = payload.new as { email?: string; full_name?: string; status?: string };
          if (row.status !== "pending") return;
          notify({
            kind: "info",
            title: "Nuevo registro pendiente de aprobación",
            body: row.full_name ? `${row.full_name} (${row.email}) solicitó acceso` : `${row.email} solicitó acceso`,
            route: "/admin-usuarios",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [email, notify]);
}
