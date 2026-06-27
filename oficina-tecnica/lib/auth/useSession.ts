"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export type Session = { email: string; user: User } | null;

const AUTH_BYPASS_ENABLED = false;
const DEMO_EMAIL = "edwin.qm@outlook.com";
const DEMO_USER = {
  id: "local-auth-bypass-user",
  email: DEMO_EMAIL,
  user_metadata: { full_name: "Usuario Demo", name: "Usuario Demo" },
} as unknown as User;

export function useSession(requireAuth = true) {
  const demoSession: Session = { email: DEMO_EMAIL, user: DEMO_USER };
  const [session, setSession] = useState<Session>(AUTH_BYPASS_ENABLED ? demoSession : null);
  const [loading, setLoading] = useState(!AUTH_BYPASS_ENABLED);
  const router = useRouter();

  useEffect(() => {
    if (AUTH_BYPASS_ENABLED) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSession({ email: data.session.user.email ?? "", user: data.session.user });
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.user) {
        setSession({ email: s.user.email ?? "", user: s.user });
      } else {
        setSession(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (AUTH_BYPASS_ENABLED) return;

    if (!loading && requireAuth && !session) {
      router.replace("/login");
    }
  }, [loading, session, requireAuth, router]);

  async function logout() {
    if (AUTH_BYPASS_ENABLED) {
      setSession(demoSession);
      router.replace("/");
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
  }

  return { session, loading, logout };
}
