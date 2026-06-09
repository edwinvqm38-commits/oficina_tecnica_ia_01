"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect to "/" if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
      setLoading(false);
    } else {
      router.replace("/");
    }
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
          {/* Title */}
          <div style={{ marginBottom: 32 }}>
            <h1
              style={{
                color: "var(--t1)",
                fontSize: 24,
                fontWeight: 600,
                fontFamily: "var(--font)",
                margin: 0,
                marginBottom: 6,
                letterSpacing: "-0.02em",
              }}
            >
              Iniciar sesión
            </h1>
            <p style={{ color: "var(--t3)", fontSize: 13, margin: 0 }}>
              Ingresa tus credenciales para acceder
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

            {/* Error message */}
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
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          {/* Footer */}
          <p
            style={{
              marginTop: 28,
              textAlign: "center",
              color: "var(--t4)",
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            Acceso restringido · Solicita acceso a tu administrador
          </p>
        </div>
      </div>
    </div>
  );
}
