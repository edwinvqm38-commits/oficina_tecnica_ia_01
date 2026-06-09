"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export type Session = { email: string; user: User } | null;

export function useSession(requireAuth = true) {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
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
    if (!loading && requireAuth && !session) {
      router.replace("/login");
    }
  }, [loading, session, requireAuth, router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return { session, loading, logout };
}
