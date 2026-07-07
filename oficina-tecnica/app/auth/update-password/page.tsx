"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function waitForRecoverySession() {
      const current = (await supabase.auth.getSession()).data.session;
      if (cancelled) return;
      if (current?.user) {
        setReady(true);
        return;
      }

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setReady(true);
          listener.subscription.unsubscribe();
        }
      });

      window.setTimeout(() => {
        listener.subscription.unsubscribe();
        if (!cancelled) setReady(true);
      }, 5000);
    }

    void waitForRecoverySession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess("Contraseña actualizada. Ya puedes iniciar sesión.");
    await supabase.auth.signOut();
    window.setTimeout(() => router.replace("/login"), 1200);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg)", fontFamily: "var(--font)" }}>
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid var(--border)", borderRadius: 16, background: "var(--bg-card)", padding: "32px 30px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <h1 style={{ margin: "0 0 6px", color: "var(--t1)", fontSize: 21, fontWeight: 700 }}>Nueva contraseña</h1>
        <p style={{ margin: "0 0 22px", color: "var(--t3)", fontSize: 13, lineHeight: 1.5 }}>
          Ingresa una contraseña nueva para tu cuenta.
        </p>

        {!ready ? (
          <p style={{ color: "var(--t2)", fontSize: 13 }}>Validando enlace de recuperación...</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label htmlFor="password" style={{ display: "block", marginBottom: 6, color: "var(--t2)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
                Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-card)", color: "var(--t1)", padding: "10px 40px 10px 12px", fontSize: 14, outline: "none" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--t3)", fontSize: 14 }}
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" style={{ display: "block", marginBottom: 6, color: "var(--t2)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
                style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-card)", color: "var(--t1)", padding: "10px 12px", fontSize: 14, outline: "none" }}
              />
            </div>

            {error ? <p style={{ border: "1px solid var(--red-border)", borderRadius: 8, background: "var(--red-bg)", color: "var(--red-text)", padding: "10px 12px", fontSize: 13 }}>{error}</p> : null}
            {success ? <p style={{ border: "1px solid var(--green-border)", borderRadius: 8, background: "var(--green-bg)", color: "var(--green-text)", padding: "10px 12px", fontSize: 13 }}>{success}</p> : null}

            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", borderRadius: 8, background: loading ? "var(--blue-hover)" : "var(--blue)", color: "#fff", padding: "11px 16px", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>

            <button type="button" onClick={() => router.replace("/login")} style={{ alignSelf: "center", color: "var(--blue)", fontSize: 12 }}>
              Volver al login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
