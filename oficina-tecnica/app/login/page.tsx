"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect to "/" if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);

    if (tab === "register") {
      // Sign up — un perfil "pending" se crea automáticamente (trigger en
      // user_profiles) y queda a la espera de aprobación del administrador.
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() || undefined } },
      });
      if (authError) {
        setError(authError.message);
      } else if (data.user) {
        await supabase.auth.signOut();
        setSuccess("Solicitud enviada. Tu cuenta está pendiente de aprobación del administrador; te avisaremos cuando puedas ingresar.");
        setEmail(""); setPassword(""); setFullName("");
      }
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
      setLoading(false);
    } else {
      router.replace("/");
    }
  }

  async function handleGoogleSignIn() {
    setError(""); setSuccess("");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        fontFamily: "var(--font)",
        overflow: "hidden",
      }}
    >
      {/* Left panel — dark branding */}
      <div
        style={{
          flex: "0 0 42%",
          background: "var(--sb-bg)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 56px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle background decoration */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(26,80,214,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 240,
            height: 240,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(26,80,214,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Logo / App name */}
        <div style={{ marginBottom: 48, position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "var(--blue)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              ⚙
            </div>
            <span
              style={{
                color: "#ffffff",
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              Oficina Técnica IA
            </span>
          </div>
          <p
            style={{
              color: "var(--sb-muted)",
              fontSize: 14,
              lineHeight: 1.5,
              maxWidth: 280,
            }}
          >
            Plataforma de gestión inteligente para equipos de ingeniería
          </p>
        </div>

        {/* Feature bullets */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            position: "relative",
          }}
        >
          {[
            {
              icon: "◈",
              title: "Agentes IA",
              desc: "Automatización inteligente de tareas técnicas",
            },
            {
              icon: "⬡",
              title: "SGP integrado",
              desc: "Gestión de proyectos unificada y en tiempo real",
            },
            {
              icon: "◉",
              title: "Análisis en tiempo real",
              desc: "Métricas y reportes instantáneos del portafolio",
            },
          ].map((f) => (
            <div
              key={f.title}
              style={{ display: "flex", alignItems: "flex-start", gap: 14 }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(26,80,214,0.15)",
                  border: "1px solid rgba(26,80,214,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  color: "#6b9fff",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {f.icon}
              </div>
              <div>
                <div
                  style={{
                    color: "var(--sb-text)",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 2,
                  }}
                >
                  {f.title}
                </div>
                <div style={{ color: "var(--sb-muted)", fontSize: 12 }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom version */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: 56,
            color: "var(--sb-muted)",
            fontSize: 11,
          }}
        >
          v1.0 · Oficina Técnica IA
        </div>
      </div>

      {/* Right panel — login form */}
      <div
        style={{
          flex: 1,
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            background: "var(--bg-card)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            padding: "40px 36px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}
        >
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: 28, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(""); setSuccess(""); }}
                style={{
                  flex: 1, padding: "10px 16px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                  background: tab === t ? "var(--blue)" : "var(--bg-card)",
                  color: tab === t ? "#fff" : "var(--t2)",
                  fontFamily: "var(--font)",
                }}
              >
                {t === "login" ? "Iniciar sesión" : "Solicitar acceso"}
              </button>
            ))}
          </div>

          {/* Title */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ color: "var(--t1)", fontSize: 22, fontWeight: 600, fontFamily: "var(--font)", margin: 0, marginBottom: 6, letterSpacing: "-0.02em" }}>
              {tab === "login" ? "Bienvenido" : "Solicitar acceso"}
            </h1>
            <p style={{ color: "var(--t3)", fontSize: 13, margin: 0 }}>
              {tab === "login" ? "Ingresa tus credenciales para acceder" : "El administrador validará tu solicitud"}
            </p>
            <p style={{ color: "var(--t4)", fontSize: 11.5, margin: "8px 0 0", lineHeight: 1.5 }}>
              ¿Primera vez? Puedes registrarte con tu cuenta de Gmail. Tu acceso quedará <strong>pendiente de aprobación</strong> por el administrador y te avisaremos en cuanto puedas ingresar.
            </p>
          </div>

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--t1)",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "var(--font)",
              cursor: "pointer",
              marginBottom: 18,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            Continuar con Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>o con tu correo</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Full name (register only) */}
            {tab === "register" && (
              <div>
                <label style={{ display: "block", color: "var(--t2)", fontSize: 12, fontWeight: 500, marginBottom: 6, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                  Nombre completo
                </label>
                <input
                  type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Pérez"
                  style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--t1)", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "var(--font)", outline: "none" }}
                />
              </div>
            )}
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  color: "var(--t2)",
                  fontSize: 12,
                  fontWeight: 500,
                  marginBottom: 6,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@empresa.com"
                required
                autoComplete="email"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "var(--t1)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 14,
                  fontFamily: "var(--font)",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--blue)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px rgba(26,80,214,0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  color: "var(--t2)",
                  fontSize: 12,
                  fontWeight: 500,
                  marginBottom: 6,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  required
                  autoComplete="current-password"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    color: "var(--t1)",
                    borderRadius: 8,
                    padding: "10px 40px 10px 12px",
                    fontSize: 14,
                    fontFamily: "var(--font)",
                    outline: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--blue)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px rgba(26,80,214,0.12)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--t3)",
                    fontSize: 14,
                    padding: "0 4px",
                    lineHeight: 1,
                  }}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? "⊙" : "○"}
                </button>
              </div>
            </div>

            {/* Success / Error */}
            {success && (
              <div role="alert" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px", color: "#166534", fontSize: 13, lineHeight: 1.4 }}>
                {success}
              </div>
            )}
            {error && (
              <div
                role="alert"
                style={{
                  background: "var(--red-bg)",
                  border: "1px solid var(--red-border)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: "var(--red-text)",
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
              >
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "var(--blue-hover)" : "var(--blue)",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "11px 16px",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "var(--font)",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                marginTop: 4,
                letterSpacing: "0.01em",
              }}
              onMouseEnter={(e) => {
                if (!loading)
                  e.currentTarget.style.background = "var(--blue-hover)";
              }}
              onMouseLeave={(e) => {
                if (!loading)
                  e.currentTarget.style.background = "var(--blue)";
              }}
            >
              {loading ? (tab === "register" ? "Enviando…" : "Ingresando...") : (tab === "register" ? "Enviar solicitud" : "Ingresar")}
            </button>
          </form>

          {/* Footer */}
          <p style={{ marginTop: 24, textAlign: "center", color: "var(--t4)", fontSize: 11, lineHeight: 1.5 }}>
            {tab === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            <button type="button" onClick={() => { setTab(tab === "login" ? "register" : "login"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: "var(--blue)", fontSize: 11, cursor: "pointer", padding: 0 }}>
              {tab === "login" ? "Solicitar acceso" : "Iniciar sesión"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
