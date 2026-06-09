"use client";

import { ModelConnectionsPage } from "../../../components/ai-office/ModelConnectionsPage";
import { useSession } from "../../../lib/auth/useSession";

const ADMIN_EMAIL = "edwin.qm@outlook.com";

export default function Page() {
  const { session, loading } = useSession(false);

  if (loading) return null;

  if (!session || session.email !== ADMIN_EMAIL) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 12,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Acceso restringido</div>
        <p style={{ fontSize: 13, color: "var(--t3)", maxWidth: 320, lineHeight: 1.6 }}>
          Esta sección es solo para administradores. Contacta al administrador del sistema si necesitas acceso.
        </p>
      </div>
    );
  }

  return <ModelConnectionsPage />;
}
