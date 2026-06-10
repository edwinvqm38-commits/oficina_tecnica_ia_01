"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { AppStatus } from "@/components/sgp/auth/AuthContext";

const COPY: Record<string, { title: string; body: string; color: string }> = {
  pending: {
    title: "Tu cuenta está pendiente de aprobación",
    body: "Registramos tu solicitud de acceso. El administrador revisará tu cuenta y te notificaremos por este medio en cuanto sea aprobada. Mientras tanto no podrás ingresar a la plataforma.",
    color: "var(--amber-text)",
  },
  rejected: {
    title: "Tu solicitud de acceso fue rechazada",
    body: "El administrador no aprobó tu acceso a la plataforma. Si crees que es un error, contacta al administrador.",
    color: "var(--red-text)",
  },
  disabled: {
    title: "Tu cuenta está desactivada",
    body: "Tu acceso a la plataforma fue desactivado por el administrador. Contacta al administrador si crees que es un error.",
    color: "var(--t3)",
  },
  blocked: {
    title: "Tu cuenta está bloqueada",
    body: "Tu acceso a la plataforma está bloqueado. Contacta al administrador.",
    color: "var(--red-text)",
  },
};

export default function PendientePage() {
  const router = useRouter();
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      if (!cancelled) setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("status")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profile?.status === "approved") {
        router.replace("/");
        return;
      }
      setStatus((profile?.status as AppStatus) ?? "pending");
      setLoading(false);
    }

    load();

    // Si el admin aprueba en tiempo real, deja entrar automáticamente.
    const channel = supabase
      .channel("own-profile-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_profiles" },
        (payload) => {
          const row = payload.new as { id: string; status: AppStatus };
          supabase.auth.getUser().then(({ data }) => {
            if (data.user && row.id === data.user.id) {
              if (row.status === "approved") router.replace("/");
              else setStatus(row.status);
            }
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return <div style={{ height: "100vh", background: "var(--bg)" }} />;
  }

  const copy = COPY[status ?? "pending"] ?? COPY.pending;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", padding: 24, fontFamily: "var(--font)" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "32px 28px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>
          ⏳
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", margin: "0 0 8px" }}>{copy.title}</h1>
        <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, margin: "0 0 4px" }}>{copy.body}</p>
        {email && (
          <p style={{ fontSize: 12, color: "var(--t3)", fontFamily: "var(--mono)", margin: "12px 0 0" }}>{email}</p>
        )}
        <button className="btn btn--ghost btn--sm" onClick={handleSignOut} style={{ marginTop: 20 }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
