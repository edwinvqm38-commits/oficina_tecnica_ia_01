"use client";

import { useMemo, useState } from "react";
import {
  buildConsolidatedTechnicalProposalResources,
  type TechnicalProposalOutputResource,
  type TechnicalProposalOutputScopeItem,
} from "@/lib/sgp/technicalProposalOutput";

type TechnicalProposalConsolidatedResourcesPanelProps = {
  items: TechnicalProposalOutputResource[];
  scopeItems: TechnicalProposalOutputScopeItem[];
};

export function TechnicalProposalConsolidatedResourcesPanel({
  items,
  scopeItems,
}: TechnicalProposalConsolidatedResourcesPanelProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const rows = useMemo(() => buildConsolidatedTechnicalProposalResources(scopeItems, items), [items, scopeItems]);
  const types = useMemo(() => Array.from(new Set(rows.map((row) => row.type))).sort((a, b) => a.localeCompare(b, "es")), [rows]);
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const visibleRows = rows.filter((row) =>
    (!typeFilter || row.type === typeFilter) &&
    (!normalizedQuery || [row.location, row.code, row.resource, row.observation, row.source].join(" ").toLocaleLowerCase("es").includes(normalizedQuery))
  );
  const totalQuantity = visibleRows.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <section className="flex h-full min-h-0 flex-col bg-white" aria-label="Recursos consolidados de la propuesta técnica">
      <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-wide text-slate-800">Recursos consolidados</h3>
            <p className="mt-0.5 text-[9px] text-slate-500">Una fila por uso, ordenada por título, subtítulo, partida y tipo.</p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-right">
            <div className="text-[8px] font-bold uppercase text-blue-500">Usos</div>
            <div className="text-[13px] font-black tabular-nums text-blue-800">{rows.length}</div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_140px] gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar ubicación, código o recurso…"
            className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-[10px] text-slate-700 outline-none focus:border-blue-400"
          />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-700">
            <option value="">Todos los tipos</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto" data-export-ready="technical-proposal-resources">
        <table className="w-full min-w-[920px] border-collapse text-[9px]">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
            <tr>
              {[
                "Tipo",
                "Ubicación / jerarquía",
                "Código",
                "Recurso",
                "Unidad",
                "Cantidad",
                "Observación",
                "Estado / fuente",
              ].map((label) => <th key={label} className="border-b border-r border-slate-200 px-2 py-2 text-left font-black last:border-r-0">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.rowId} className="border-b border-slate-100 align-top hover:bg-blue-50/40">
                <td className="border-r border-slate-100 px-2 py-2"><span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-700">{row.type}</span></td>
                <td className="max-w-[300px] border-r border-slate-100 px-2 py-2 text-slate-600" title={row.location}>{row.location}</td>
                <td className="border-r border-slate-100 px-2 py-2 font-bold text-slate-700">{row.code}</td>
                <td className="max-w-[240px] border-r border-slate-100 px-2 py-2 font-semibold text-slate-800">{row.resource}</td>
                <td className="border-r border-slate-100 px-2 py-2">{row.unit}</td>
                <td className="border-r border-slate-100 px-2 py-2 text-right font-bold tabular-nums">{row.quantity}</td>
                <td className="max-w-[220px] border-r border-slate-100 px-2 py-2 text-slate-500">{row.observation || "—"}</td>
                <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 font-bold ${row.source === "Catálogo maestro" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.source}</span></td>
              </tr>
            ))}
            {visibleRows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-[10px] text-slate-400">{rows.length ? "No hay coincidencias con los filtros." : "Agrega recursos desde una tabla del editor para construir el consolidado."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-[9px] text-slate-500">
        <span>{visibleRows.length} de {rows.length} uso(s)</span>
        <span>Cantidad acumulada visible: <strong className="text-slate-700">{totalQuantity.toLocaleString("es-PE")}</strong></span>
      </footer>
    </section>
  );
}
