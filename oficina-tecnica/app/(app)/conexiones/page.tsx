"use client";

import { useSession } from "../../../lib/auth/useSession";
import { ModelConnectionsPage } from "../../../components/ai-office/ModelConnectionsPage";
import { useSession } from "../../../lib/auth/useSession";

const ADMIN_EMAIL = "edwin.qm@outlook.com";

const ADMIN_EMAIL = "edwin.qm@outlook.com";

function AccessDenied() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12, textAlign: "center" }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)" }}>Acceso restringido</h2>
      <p style={{ fontSize: 13, color: "var(--t2)", maxWidth: 340, lineHeight: 1.6 }}>
        Esta sección solo está disponible para el administrador del sistema.
      </p>
    </div>
  );
}

export default function Page() {
  const { session, loading } = useSession(true);
  if (loading) return null;
  if (!session || session.email !== ADMIN_EMAIL) return <AccessDenied />;
  return <ModelConnectionsPage />;
}
