"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      // El cliente de Supabase intercambia el código de la URL por una
      // sesión automáticamente (detectSessionInUrl). Esperamos a que
      // esa sesión esté disponible.
      let session = (await supabase.auth.getSession()).data.session;

      if (!session) {
        session = await new Promise((resolve) => {
          const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
            if (s) {
              listener.subscription.unsubscribe();
              resolve(s);
            }
          });
          setTimeout(() => {
            listener.subscription.unsubscribe();
            resolve(null);
          }, 6000);
        });
      }

      if (cancelled) return;

      if (!session?.user) {
        setError("No se pudo iniciar sesión con Google. Intenta nuevamente.");
        setTimeout(() => router.replace("/login"), 2000);
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("status")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profile?.status === "approved") {
        router.replace("/");
      } else {
        router.replace("/pendiente");
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 12, fontFamily: "var(--font)" }}>
      {error ? (
        <p style={{ color: "var(--red-text)", fontSize: 14 }}>{error}</p>
      ) : (
        <>
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <p style={{ color: "var(--t2)", fontSize: 13 }}>Iniciando sesión…</p>
        </>
      )}
    </div>
  );
}
