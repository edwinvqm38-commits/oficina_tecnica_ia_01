"use client";

import { useEffect, useMemo, useState } from "react";
import { listAllRecursos } from "@/lib/sgp/recursosRepository";
import { loadCoreAppData } from "@/lib/sgp/clientDataCache";
import type { Cotizacion, Requerimiento, Recurso } from "@/lib/sgp/demoData";
import { PageHeader } from "../shell/PageHeader";

type DashboardData = {
  cotizaciones: Cotizacion[];
  requerimientos: Requerimiento[];
  recursos: Recurso[];
  warnings: string[];
};

type ProjectSummary = {
  name: string;
  client: string;
  quotationCount: number;
  requirementCount: number;
  pendingRequirements: number;
};

const INITIAL_DATA: DashboardData = {
  cotizaciones: [],
  requerimientos: [],
  recursos: [],
  warnings: [],
};

function formatStatus(value: string): string {
  return value.trim() || "Sin estado";
}

function countByStatus<T>(rows: T[], getStatus: (row: T) => string): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const status = formatStatus(getStatus(row));
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"));
}

function buildProjectSummaries(cotizaciones: Cotizacion[], requerimientos: Requerimiento[]): ProjectSummary[] {
  const byProject = new Map<string, ProjectSummary>();

  cotizaciones.forEach((cotizacion) => {
    const name = cotizacion.proyecto.trim() || cotizacion.codigo;
    const current = byProject.get(name) ?? {
      name,
      client: cotizacion.cliente.trim() || "Sin cliente registrado",
      quotationCount: 0,
      requirementCount: 0,
      pendingRequirements: 0,
    };
    current.quotationCount += 1;
    if (cotizacion.cliente.trim()) current.client = cotizacion.cliente.trim();
    byProject.set(name, current);
  });

  requerimientos.forEach((requerimiento) => {
    const name = (requerimiento.proyecto_servicio ?? "").trim() || requerimiento.cotizacion_codigo || requerimiento.codigo;
    const current = byProject.get(name) ?? {
      name,
      client: "Sin cliente registrado",
      quotationCount: 0,
      requirementCount: 0,
      pendingRequirements: 0,
    };
    current.requirementCount += 1;
    if (requerimiento.estado === "Pendiente") current.pendingRequirements += 1;
    byProject.set(name, current);
  });

  return Array.from(byProject.values())
    .sort((a, b) => b.pendingRequirements - a.pendingRequirements || b.requirementCount - a.requirementCount || a.name.localeCompare(b.name, "es"))
    .slice(0, 8);
}

function EmptyState({ children }: { children: string }) {
  return <div style={{ padding: "18px 14px", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>{children}</div>;
}

function StatusList({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (rows.length === 0) return <EmptyState>Sin datos registrados.</EmptyState>;

  return (
    <div style={{ padding: "9px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
      {rows.map((row) => (
        <div key={row.label} style={{ display: "grid", gridTemplateColumns: "1fr 42px", gap: 10, alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)" }}>{row.value}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "var(--bg-subtle)", overflow: "hidden" }}>
              <div style={{ width: `${total > 0 ? Math.round((row.value / total) * 100) : 0}%`, height: "100%", background: "var(--blue)" }} />
            </div>
          </div>
          <span style={{ fontSize: 10, color: "var(--t3)", textAlign: "right" }}>{total > 0 ? Math.round((row.value / total) * 100) : 0}%</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadCoreAppData({ module: "dashboard", reason: "initial-load" }),
      listAllRecursos(),
    ])
      .then(([core, recursosResult]) => {
        if (cancelled) return;
        const warnings: string[] = [];
        if (core.cotizaciones.source !== "supabase" && core.cotizaciones.warning) warnings.push(core.cotizaciones.warning);
        if (core.requerimientos.source !== "supabase" && core.requerimientos.warning) warnings.push(core.requerimientos.warning);
        if (recursosResult.source !== "supabase" && recursosResult.warning) warnings.push(recursosResult.warning);

        setData({
          cotizaciones: core.cotizaciones.source === "supabase" ? core.cotizaciones.rows : [],
          requerimientos: core.requerimientos.source === "supabase" ? core.requerimientos.rows : [],
          recursos: recursosResult.source === "supabase" ? recursosResult.rows : [],
          warnings,
        });
      })
      .catch(() => {
        if (!cancelled) setData({ ...INITIAL_DATA, warnings: ["No se pudieron cargar los datos reales del dashboard."] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const projectSummaries = useMemo(
    () => buildProjectSummaries(data.cotizaciones, data.requerimientos),
    [data.cotizaciones, data.requerimientos],
  );
  const quotationStatuses = useMemo(() => countByStatus(data.cotizaciones, (row) => row.estado), [data.cotizaciones]);
  const requirementStatuses = useMemo(() => countByStatus(data.requerimientos, (row) => row.estado), [data.requerimientos]);

  const pendingRequirements = data.requerimientos.filter((row) => row.estado === "Pendiente").length;
  const activeResources = data.recursos.filter((row) => row.estado !== "Inactivo").length;
  const wonQuotations = data.cotizaciones.filter((row) => row.estado === "Ganada" || row.estado === "Adjudicado").length;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Centro ejecutivo de control"
        description="Vista general con datos reales disponibles de cotizaciones, requerimientos y recursos."
      />

      {data.warnings.length > 0 && (
        <div className="card" style={{ marginBottom: 12, padding: "10px 14px", borderColor: "var(--amber-border)", background: "var(--amber-bg)" }}>
          <div style={{ fontSize: 12, color: "var(--amber-text)", lineHeight: 1.5 }}>
            {data.warnings[0]} Las secciones sin fuente real se muestran vacias.
          </div>
        </div>
      )}

      <div className="grid-4" style={{ marginBottom: 14 }}>
        <div className="kpi">
          <div className="kpi-label">Cotizaciones</div>
          <div className="kpi-value">{loading ? "..." : data.cotizaciones.length}</div>
          <div className="kpi-sub">{wonQuotations} ganadas/adjudicadas</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Requerimientos</div>
          <div className="kpi-value">{loading ? "..." : data.requerimientos.length}</div>
          <div className="kpi-sub">{pendingRequirements} pendientes</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Recursos</div>
          <div className="kpi-value">{loading ? "..." : activeResources}</div>
          <div className="kpi-sub">{data.recursos.length} registrados</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Alertas operativas</div>
          <div className="kpi-value">0</div>
          <div className="kpi-sub">sin fuente persistente</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 330px", gap: 10, alignItems: "start" }}>
        <div className="space-y-3">
          <div className="card">
            <div className="card-header">
              <div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600, color: "var(--t3)", marginBottom: 1 }}>
                  Actividad real
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Proyectos y servicios</div>
              </div>
              <span className="badge badge--blue">{projectSummaries.length} visibles</span>
            </div>
            {projectSummaries.length === 0 ? (
              <EmptyState>Sin proyectos o servicios con actividad registrada.</EmptyState>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Proyecto/servicio", "Cliente", "Cot.", "RQ", "Pend. RQ"].map((header) => (
                        <th key={header} style={{ padding: "8px 12px", textAlign: header === "Proyecto/servicio" || header === "Cliente" ? "left" : "right", fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".08em" }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projectSummaries.map((row) => (
                      <tr key={row.name} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{row.name}</td>
                        <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--t2)" }}>{row.client}</td>
                        <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--t1)", textAlign: "right" }}>{row.quotationCount}</td>
                        <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--t1)", textAlign: "right" }}>{row.requirementCount}</td>
                        <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 700, color: row.pendingRequirements > 0 ? "var(--orange)" : "var(--t3)", textAlign: "right" }}>{row.pendingRequirements}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Actividad reciente</div>
            </div>
            <EmptyState>Sin registro persistente de actividad ejecutiva reciente.</EmptyState>
          </div>
        </div>

        <div className="space-y-3">
          <div className="card">
            <div className="card-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Cotizaciones por estado</div>
            </div>
            <StatusList rows={quotationStatuses} />
          </div>

          <div className="card">
            <div className="card-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Requerimientos por estado</div>
            </div>
            <StatusList rows={requirementStatuses} />
          </div>

          <div className="card">
            <div className="card-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Próximos hitos</div>
            </div>
            <EmptyState>No hay hitos registrados en una fuente persistente.</EmptyState>
          </div>
        </div>
      </div>
    </>
  );
}
