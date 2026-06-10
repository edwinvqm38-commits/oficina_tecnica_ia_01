"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "./useSession";

const ADMIN_EMAIL = "edwin.qm@outlook.com";

/**
 * Gate for the authenticated app: redirects to /pendiente unless the
 * user's user_profiles.status is "approved" (the hardcoded admin email
 * always passes, even if the profile row doesn't exist yet).
 */
export function useAccessGate(session: Session) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!session) {
      setChecking(false);
      return;
    }

    if (session.email?.toLowerCase() === ADMIN_EMAIL) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("status")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (data?.status !== "approved") {
        router.replace("/pendiente");
        return;
      }
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [session, router]);

  return { checking };
}
