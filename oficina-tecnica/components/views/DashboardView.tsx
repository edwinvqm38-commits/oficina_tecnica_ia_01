"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listAllRecursos } from "@/lib/sgp/recursosRepository";
import { loadCoreAppData } from "@/lib/sgp/clientDataCache";
import type { Cotizacion, Requerimiento, Recurso } from "@/lib/sgp/demoData";
import { PageHeader } from "../shell/PageHeader";
import { Badge, Card } from "../ui";

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
  return <div className="dashboard-empty">{children}</div>;
}

function StatusList({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (rows.length === 0) return <EmptyState>Sin datos registrados.</EmptyState>;

  return (
    <div className="dashboard-status-list">
      {rows.map((row) => (
        <div key={row.label} className="dashboard-status-row">
          <div className="dashboard-status-main">
            <div className="dashboard-status-meta">
              <span className="dashboard-status-label">{row.label}</span>
              <span className="dashboard-status-value">{row.value}</span>
            </div>
            <div className="dashboard-progress" aria-hidden="true">
              <div className="dashboard-progress-fill" style={{ width: `${total > 0 ? Math.round((row.value / total) * 100) : 0}%` }} />
            </div>
          </div>
          <span className="dashboard-status-percent">{total > 0 ? Math.round((row.value / total) * 100) : 0}%</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({
  label,
  value,
  context,
  tone = "info",
}: {
  label: string;
  value: string | number;
  context: string;
  tone?: "info" | "success" | "warning" | "neutral";
}) {
  return (
    <Card className={`dashboard-kpi-card dashboard-kpi-card--${tone}`}>
      <div className="dashboard-kpi-label">{label}</div>
      <div className="dashboard-kpi-row">
        <div className="dashboard-kpi-value">{value}</div>
        <span className="dashboard-kpi-signal" aria-hidden="true" />
      </div>
      <div className="dashboard-kpi-sub">{context}</div>
    </Card>
  );
}

function DashboardSection({
  eyebrow,
  title,
  badge,
  children,
}: {
  eyebrow?: string;
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <Card className="dashboard-section">
      <div className="dashboard-section-header">
        <div className="min-w-0">
          {eyebrow ? <div className="dashboard-section-eyebrow">{eyebrow}</div> : null}
          <h2 className="dashboard-section-title">{title}</h2>
        </div>
        {badge ? <Badge tone="info">{badge}</Badge> : null}
      </div>
      {children}
    </Card>
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
    <div className="dashboard-page">
      <PageHeader
        eyebrow="Dashboard"
        title="Centro ejecutivo de control"
        description="Vista general con datos reales disponibles de cotizaciones, requerimientos y recursos."
      />

      {data.warnings.length > 0 && (
        <Card className="dashboard-warning">
          <Badge tone="warning">Fuente parcial</Badge>
          <div className="dashboard-warning-text">
            {data.warnings[0]} Las secciones sin fuente real se muestran vacías.
          </div>
        </Card>
      )}

      <div className="dashboard-kpi-grid">
        <KpiCard label="Cotizaciones" value={loading ? "..." : data.cotizaciones.length} context={`${wonQuotations} ganadas/adjudicadas`} tone="success" />
        <KpiCard label="Requerimientos" value={loading ? "..." : data.requerimientos.length} context={`${pendingRequirements} pendientes`} tone={pendingRequirements > 0 ? "warning" : "success"} />
        <KpiCard label="Recursos" value={loading ? "..." : activeResources} context={`${data.recursos.length} registrados`} />
        <KpiCard label="Alertas operativas" value="0" context="sin fuente persistente" tone="neutral" />
      </div>

      <div className="dashboard-content-grid">
        <div className="dashboard-main-stack">
          <DashboardSection eyebrow="Actividad real" title="Proyectos y servicios" badge={`${projectSummaries.length} visibles`}>
            {projectSummaries.length === 0 ? (
              <EmptyState>Sin proyectos o servicios con actividad registrada.</EmptyState>
            ) : (
              <div className="dashboard-table-scroll">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      {["Proyecto/servicio", "Cliente", "Cot.", "RQ", "Pend. RQ"].map((header) => (
                        <th key={header} className={header === "Proyecto/servicio" || header === "Cliente" ? undefined : "dashboard-table-number"}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projectSummaries.map((row) => (
                      <tr key={row.name}>
                        <td>
                          <div className="dashboard-entity-name">{row.name}</div>
                        </td>
                        <td className="dashboard-table-muted">{row.client}</td>
                        <td className="dashboard-table-number">{row.quotationCount}</td>
                        <td className="dashboard-table-number">{row.requirementCount}</td>
                        <td className={`dashboard-table-number ${row.pendingRequirements > 0 ? "dashboard-table-warning" : "dashboard-table-muted"}`}>{row.pendingRequirements}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardSection>

          <DashboardSection title="Actividad reciente">
            <EmptyState>Sin registro persistente de actividad ejecutiva reciente.</EmptyState>
          </DashboardSection>
        </div>

        <div className="dashboard-side-stack">
          <DashboardSection title="Cotizaciones por estado">
            <StatusList rows={quotationStatuses} />
          </DashboardSection>

          <DashboardSection title="Requerimientos por estado">
            <StatusList rows={requirementStatuses} />
          </DashboardSection>

          <DashboardSection title="Próximos hitos">
            <EmptyState>No hay hitos registrados en una fuente persistente.</EmptyState>
          </DashboardSection>
        </div>
      </div>
    </div>
  );
}
