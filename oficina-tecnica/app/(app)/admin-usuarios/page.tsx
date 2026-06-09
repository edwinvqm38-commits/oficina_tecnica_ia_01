"use client";

import { useSession } from "@/lib/auth/useSession";
import { UserApprovalPage } from "@/components/admin/UserApprovalPage";

const ADMIN_EMAIL = "edwin.qm@outlook.com";

function AccessDenied() {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ fontSize: 14, color: "var(--t2)" }}>Acceso restringido — solo el administrador puede ver esta página.</p>
    </div>
  );
}

export default function Page() {
  const { session, loading } = useSession(true);
  if (loading) return null;
  if (!session || session.email !== ADMIN_EMAIL) return <AccessDenied />;
  return <UserApprovalPage adminEmail={ADMIN_EMAIL} />;
}
