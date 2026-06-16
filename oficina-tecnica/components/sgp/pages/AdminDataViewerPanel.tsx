"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_TABLE_PAGE_SIZE,
  fetchCotizacionesAdmin,
  fetchRecursosAdmin,
  fetchRequerimientosAdmin,
  type AdminTableResult,
} from "@/lib/admin/adminDataViewer";

type DataTab = "cotizaciones" | "requerimientos" | "recursos";

const TABS: Array<{ label: string; value: DataTab }> = [
  { label: "Cotizaciones", value: "cotizaciones" },
  { label: "Requerimientos", value: "requerimientos" },
  { label: "Recursos", value: "recursos" },
];

const LOAD_ERROR = "No se pudo cargar esta tabla. Verifica RLS/permisos o conexión.";

function tabButtonClassName(active: boolean): string {
  return [
    "inline-flex h-8 items-center rounded-md border px-3 text-xs font-semibold transition",
    active
      ? "border-stone-400 bg-stone-100 text-stone-900"
      : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900",
  ].join(" ");
}

// Read-only viewer: no edit/delete actions on purpose, this is only meant to
// let an admin confirm what's actually visible under current RLS/grants.
export function AdminDataViewerPanel() {
  const [tab, setTab] = useState<DataTab>("cotizaciones");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<AdminTableResult<any> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const fetcher = tab === "cotizaciones" ? fetchCotizacionesAdmin
      : tab === "requerimientos" ? fetchRequerimientosAdmin
      : fetchRecursosAdmin;
    try {
      const r = await fetcher(page);
      setResult(r);
    } catch (err) {
      setResult({ rows: [], total: 0, error: err instanceof Error ? err.message : "unknown" });
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => { void load(); }, [load]);

  function changeTab(next: DataTab) {
    setTab(next);
    setPage(1);
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / ADMIN_TABLE_PAGE_SIZE)) : 1;

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-stone-700">Datos (solo lectura)</p>
          <p className="text-xs text-stone-500">Vista de diagnóstico: confirma qué filas son visibles bajo las políticas RLS actuales. Sin acciones de edición/borrado.</p>
        </div>
        <button onClick={() => void load()} className="inline-flex h-8 items-center justify-center rounded-md border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-700 hover:border-stone-400 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.value} type="button" onClick={() => changeTab(t.value)} className={tabButtonClassName(tab === t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {result?.error ? (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{LOAD_ERROR}<br /><span className="text-[10px] text-red-500">{result.error}</span></p>
      ) : null}

      {!loading && result && !result.error && result.rows.length === 0 ? (
        <p className="mb-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">Sin filas visibles para este usuario en {tab}.</p>
      ) : null}

      {result && !result.error && result.rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-600">
                {Object.keys(result.rows[0]).map((col) => (
                  <th key={col} className="px-2 py-2 font-semibold">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={row.id ?? i} className="border-b border-stone-100">
                  {Object.keys(result.rows[0]).map((col) => (
                    <td key={col} className="px-2 py-2 text-stone-700">{String(row[col] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result && result.total > ADMIN_TABLE_PAGE_SIZE ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-stone-600">
          <button className="inline-flex h-7 items-center rounded-md border border-stone-300 bg-white px-2 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>←</button>
          <span>Página {page} de {totalPages}</span>
          <button className="inline-flex h-7 items-center rounded-md border border-stone-300 bg-white px-2 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>→</button>
        </div>
      ) : null}
    </div>
  );
}
