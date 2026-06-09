"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AppStatus, AppRole, UserProfile } from "../sgp/auth/AuthContext";

const STATUS_LABEL: Record<AppStatus, string> = {
  pending:  "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  disabled: "Desactivado",
  blocked:  "Bloqueado",
};

const STATUS_COLOR: Record<AppStatus, string> = {
  pending:  "var(--amber-text)",
  approved: "var(--green-text)",
  rejected: "var(--red-text)",
  disabled: "var(--t3)",
  blocked:  "var(--red-text)",
};

const ROLE_OPTIONS: AppRole[] = ["consulta", "responsable", "gerencia", "admin"];

export function UserApprovalPage({ adminEmail }: { adminEmail: string }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<AppStatus | "all">("pending");
  const [working, setWorking] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) { setError(err.message); } else { setUsers((data ?? []) as UserProfile[]); }
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function setStatus(userId: string, status: AppStatus, role?: AppRole) {
    setWorking(userId);
    const update: Partial<UserProfile> = {
      status,
      approved_by: status === "approved" ? adminEmail : undefined,
      approved_at: status === "approved" ? new Date().toISOString() : undefined,
    };
    if (role) update.role = role;
    const { error: err } = await supabase.from("user_profiles").update(update).eq("id", userId);
    if (err) alert(`Error: ${err.message}`);
    else await loadUsers();
    setWorking(null);
  }

  async function setRole(userId: string, role: AppRole) {
    setWorking(userId);
    const { error: err } = await supabase.from("user_profiles").update({ role }).eq("id", userId);
    if (err) alert(`Error: ${err.message}`);
    else await loadUsers();
    setWorking(null);
  }

  const filtered = filter === "all" ? users : users.filter((u) => u.status === filter);
  const pendingCount = users.filter((u) => u.status === "pending").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="page-header">
        <div className="page-header-left">
          <p className="page-eyebrow">Admin · Acceso</p>
          <h1 className="page-title">Gestión de usuarios</h1>
          <p className="page-desc">Aprueba, rechaza y asigna roles a usuarios que solicitaron acceso.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {pendingCount > 0 && (
            <span className="badge badge--orange">{pendingCount} pendiente{pendingCount > 1 ? "s" : ""}</span>
          )}
          <button className="btn btn--ghost btn--sm" onClick={loadUsers} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: "var(--r)", padding: "10px 14px", fontSize: 13, color: "var(--red-text)" }}>
          {error} — Verifica que la tabla user_profiles existe y que tienes permisos RLS de admin.
        </div>
      )}

      {/* Filter tabs */}
      <div className="card" style={{ padding: "8px 14px", display: "flex", gap: 6 }}>
        {(["all", "pending", "approved", "rejected", "disabled"] as const).map((f) => (
          <button
            key={f}
            className={`btn btn--ghost btn--sm ${filter === f ? "btn--active" : ""}`}
            style={{ fontSize: 12, fontWeight: filter === f ? 700 : 400, background: filter === f ? "var(--blue-bg)" : "transparent", color: filter === f ? "var(--blue)" : "var(--t2)" }}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? `Todos (${users.length})` : `${STATUS_LABEL[f as AppStatus]} (${users.filter((u) => u.status === f).length})`}
          </button>
        ))}
      </div>

      <div className="card">
        {loading && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 13 }}>Cargando usuarios…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 13 }}>
            {filter === "pending" ? "No hay solicitudes pendientes." : "No hay usuarios en este estado."}
          </div>
        )}
        {filtered.map((user, idx) => (
          <div
            key={user.id}
            style={{
              padding: "14px 16px",
              borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none",
              display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
              background: user.status === "pending" ? "var(--amber-bg)" : "transparent",
            }}
          >
            {/* Avatar */}
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--blue-bg)", border: "1px solid var(--blue-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--blue)", flexShrink: 0 }}>
              {(user.full_name ?? user.email ?? "?")[0].toUpperCase()}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{user.full_name ?? "Sin nombre"}</div>
              <div style={{ fontSize: 11.5, color: "var(--t3)", fontFamily: "var(--mono)" }}>{user.email}</div>
              {user.created_at && (
                <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 2 }}>
                  Solicitó: {new Date(user.created_at).toLocaleDateString("es-PE", { dateStyle: "medium" })}
                </div>
              )}
            </div>

            {/* Status */}
            <div style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[user.status as AppStatus ?? "pending"], minWidth: 80 }}>
              {STATUS_LABEL[user.status as AppStatus ?? "pending"]}
            </div>

            {/* Role selector */}
            <select
              className="select"
              value={user.role ?? "consulta"}
              onChange={(e) => setRole(user.id!, e.target.value as AppRole)}
              disabled={working === user.id}
              style={{ fontSize: 12, padding: "4px 8px", minWidth: 110 }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r === "consulta" ? "Solo lectura" : r === "responsable" ? "Responsable" : r === "gerencia" ? "Gerencia" : "Admin"}
                </option>
              ))}
            </select>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {user.status !== "approved" && (
                <button
                  className="btn btn--success btn--sm"
                  onClick={() => setStatus(user.id!, "approved", user.role ?? "consulta")}
                  disabled={working === user.id}
                >
                  {working === user.id ? "…" : "Aprobar"}
                </button>
              )}
              {user.status !== "rejected" && user.status !== "approved" && (
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => setStatus(user.id!, "rejected")}
                  disabled={working === user.id}
                >
                  Rechazar
                </button>
              )}
              {user.status === "approved" && (
                <button
                  className="btn btn--warning btn--sm"
                  onClick={() => setStatus(user.id!, "disabled")}
                  disabled={working === user.id}
                >
                  Desactivar
                </button>
              )}
              {(user.status === "disabled" || user.status === "rejected") && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setStatus(user.id!, "approved")}
                  disabled={working === user.id}
                >
                  Reactivar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: "12px 16px" }}>
        <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.7 }}>
          <strong>Roles:</strong> Solo lectura — puede ver datos · Responsable — puede operar proyectos · Gerencia — acceso completo sin admin · Admin — acceso total<br />
          <strong>Nota:</strong> Para que el control de acceso funcione, la tabla <code style={{ fontFamily: "var(--mono)", background: "var(--bg-subtle)", padding: "1px 4px", borderRadius: 3 }}>user_profiles</code> debe tener RLS habilitado con políticas que verifiquen <code style={{ fontFamily: "var(--mono)", background: "var(--bg-subtle)", padding: "1px 4px", borderRadius: 3 }}>status = 'approved'</code>.
        </p>
      </div>
    </div>
  );
}
