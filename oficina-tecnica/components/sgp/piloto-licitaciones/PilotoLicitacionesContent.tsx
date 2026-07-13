"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  PILOTO_DEMO_TODAY,
  pilotoEstados,
  pilotoLicitacionesDemo,
  pilotoPrioridades,
  type PilotoEstadoLicitacion,
  type PilotoLicitacionDemo,
  type PilotoPrioridad,
} from "@/lib/demo/piloto-licitaciones";
import { Icons } from "@/lib/icons";

type EstadoFilter = "Todos" | PilotoEstadoLicitacion;
type PrioridadFilter = "Todas" | PilotoPrioridad;

const closedStates = new Set<PilotoEstadoLicitacion>(["Presentada", "Cerrada"]);

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00-05:00`));
}

function formatMoney(item: PilotoLicitacionDemo): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: item.moneda,
    maximumFractionDigits: 0,
  }).format(item.montoReferencial);
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00-05:00`).getTime();
  const endDate = new Date(`${end}T00:00:00-05:00`).getTime();
  return Math.ceil((endDate - startDate) / 86_400_000);
}

function isDueSoon(item: PilotoLicitacionDemo): boolean {
  if (closedStates.has(item.estado)) return false;
  const days = daysBetween(PILOTO_DEMO_TODAY, item.fechaLimite);
  return days >= 0 && days <= 7;
}

function estadoClassName(estado: PilotoEstadoLicitacion): string {
  const map: Record<PilotoEstadoLicitacion, string> = {
    Nueva: "bg-blue-50 text-blue-700 ring-blue-200",
    "En revisión": "bg-amber-50 text-amber-700 ring-amber-200",
    "En preparación": "bg-emerald-50 text-emerald-700 ring-emerald-200",
    "Pendiente de información": "bg-orange-50 text-orange-700 ring-orange-200",
    Presentada: "bg-sky-50 text-sky-700 ring-sky-200",
    Cerrada: "bg-stone-100 text-stone-600 ring-stone-200",
  };

  return map[estado];
}

function prioridadClassName(prioridad: PilotoPrioridad): string {
  const map: Record<PilotoPrioridad, string> = {
    Alta: "bg-red-50 text-red-700 ring-red-200",
    Media: "bg-yellow-50 text-yellow-700 ring-yellow-200",
    Baja: "bg-slate-50 text-slate-600 ring-slate-200",
  };

  return map[prioridad];
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${className}`}>
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  tone,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "amber" | "red";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneMap = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    red: "border-red-100 bg-red-50 text-red-700",
  };
  const className = [
    "rounded-lg border px-4 py-3 text-left transition",
    toneMap[tone],
    onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm" : "",
    active ? "ring-2 ring-red-300 ring-offset-2" : "",
  ].filter(Boolean).join(" ");

  const content = (
    <>
      <div className="text-[11px] font-bold uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-1 text-2xl font-black leading-none">{value}</div>
      {active ? <div className="mt-2 text-[11px] font-black uppercase tracking-wide">Filtro activo</div> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-pressed={active}>
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

function DesktopTable({ items }: { items: PilotoLicitacionDemo[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white lg:block">
      <table className="min-w-[1180px] w-full border-collapse text-left text-[12px]">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3">Código</th>
            <th className="px-3 py-3">Cliente / unidad</th>
            <th className="px-3 py-3">Descripción</th>
            <th className="px-3 py-3">Recepción</th>
            <th className="px-3 py-3">Límite</th>
            <th className="px-3 py-3">Estado</th>
            <th className="px-3 py-3">Prioridad</th>
            <th className="px-3 py-3">Responsable</th>
            <th className="px-3 py-3 text-right">Monto ref.</th>
            <th className="px-3 py-3 text-center">RQ</th>
            <th className="px-3 py-3 text-center">Docs</th>
            <th className="px-3 py-3 text-right">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="align-top hover:bg-slate-50">
              <td className="px-3 py-3 font-black text-slate-900">{item.codigo}</td>
              <td className="px-3 py-3">
                <div className="font-bold text-slate-800">{item.cliente}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{item.unidad}</div>
              </td>
              <td className="max-w-[260px] px-3 py-3 text-slate-700">{item.descripcion}</td>
              <td className="px-3 py-3 text-slate-600">{formatDate(item.fechaRecepcion)}</td>
              <td className="px-3 py-3">
                <div className="font-bold text-slate-800">{formatDate(item.fechaLimite)}</div>
                {isDueSoon(item) ? <div className="mt-1 text-[11px] font-bold text-red-600">Próxima a vencer</div> : null}
              </td>
              <td className="px-3 py-3">
                <Badge className={estadoClassName(item.estado)}>{item.estado}</Badge>
              </td>
              <td className="px-3 py-3">
                <Badge className={prioridadClassName(item.prioridad)}>{item.prioridad}</Badge>
              </td>
              <td className="px-3 py-3 text-slate-700">{item.responsable}</td>
              <td className="px-3 py-3 text-right font-bold text-slate-800">{formatMoney(item)}</td>
              <td className="px-3 py-3 text-center font-bold text-slate-700">{item.cantidadRequerimientos}</td>
              <td className="px-3 py-3 text-center font-bold text-slate-700">{item.cantidadDocumentos}</td>
              <td className="px-3 py-3 text-right">
                <Link className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50" href={`/piloto-licitaciones/${item.id}`}>
                  Ver detalle
                  <Icons.arrowRight width={12} height={12} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileCards({ items }: { items: PilotoLicitacionDemo[] }) {
  return (
    <div className="grid gap-3 lg:hidden">
      {items.map((item) => (
        <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-black text-slate-900">{item.codigo}</div>
              <div className="mt-1 text-[13px] font-bold text-slate-800">{item.cliente}</div>
              <div className="text-[11px] text-slate-500">{item.unidad}</div>
            </div>
            <Badge className={prioridadClassName(item.prioridad)}>{item.prioridad}</Badge>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-slate-700">{item.descripcion}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge className={estadoClassName(item.estado)}>{item.estado}</Badge>
            {isDueSoon(item) ? <Badge className="bg-red-50 text-red-700 ring-red-200">Próxima a vencer</Badge> : null}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
            <div>
              <dt className="font-bold uppercase">Límite</dt>
              <dd className="text-slate-800">{formatDate(item.fechaLimite)}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase">Monto</dt>
              <dd className="text-slate-800">{formatMoney(item)}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase">Responsable</dt>
              <dd className="text-slate-800">{item.responsable}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase">RQ / docs</dt>
              <dd className="text-slate-800">{item.cantidadRequerimientos} / {item.cantidadDocumentos}</dd>
            </div>
          </dl>
          <Link className="mt-4 inline-flex items-center gap-1 rounded-md border border-blue-200 px-3 py-2 text-[12px] font-bold text-blue-700 hover:bg-blue-50" href={`/piloto-licitaciones/${item.id}`}>
            Ver detalle
            <Icons.arrowRight width={12} height={12} />
          </Link>
        </article>
      ))}
    </div>
  );
}

export function PilotoLicitacionesContent() {
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState<EstadoFilter>("Todos");
  const [prioridad, setPrioridad] = useState<PrioridadFilter>("Todas");
  const [showDueSoonOnly, setShowDueSoonOnly] = useState(false);

  const metrics = useMemo(() => {
    const total = pilotoLicitacionesDemo.length;
    const nuevas = pilotoLicitacionesDemo.filter((item) => item.estado === "Nueva").length;
    const enPreparacion = pilotoLicitacionesDemo.filter((item) => item.estado === "En preparación").length;
    const proximas = pilotoLicitacionesDemo.filter(isDueSoon).length;
    return { total, nuevas, enPreparacion, proximas };
  }, []);

  const filteredItems = useMemo(() => {
    const needle = normalizeSearch(query);

    return pilotoLicitacionesDemo.filter((item) => {
      const matchesSearch = needle
        ? normalizeSearch(`${item.codigo} ${item.cliente} ${item.descripcion} ${item.responsable}`).includes(needle)
        : true;
      const matchesEstado = estado === "Todos" || item.estado === estado;
      const matchesPrioridad = prioridad === "Todas" || item.prioridad === prioridad;
      const matchesDueSoon = !showDueSoonOnly || isDueSoon(item);
      return matchesSearch && matchesEstado && matchesPrioridad && matchesDueSoon;
    });
  }, [estado, prioridad, query, showDueSoonOnly]);

  function clearFilters() {
    setQuery("");
    setEstado("Todos");
    setPrioridad("Todas");
    setShowDueSoonOnly(false);
  }

  return (
    <main className="min-h-full bg-slate-50 px-4 py-5 md:px-6">
      <section className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-blue-700">Piloto QEI</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Piloto de licitaciones</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Bandeja demo con datos ficticios para validar el flujo de licitaciones sin tocar Supabase, Drive, Gmail ni registros reales.
            </p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-800">
            Datos ficticios · uso piloto
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total"
            value={metrics.total}
            tone="blue"
            active={estado === "Todos" && !showDueSoonOnly}
            onClick={() => {
              setEstado("Todos");
              setShowDueSoonOnly(false);
            }}
          />
          <MetricCard
            label="Nuevas"
            value={metrics.nuevas}
            tone="green"
            active={estado === "Nueva"}
            onClick={() => setEstado((current) => current === "Nueva" ? "Todos" : "Nueva")}
          />
          <MetricCard
            label="En preparación"
            value={metrics.enPreparacion}
            tone="amber"
            active={estado === "En preparación"}
            onClick={() => setEstado((current) => current === "En preparación" ? "Todos" : "En preparación")}
          />
          <MetricCard
            label="Próximas a vencer"
            value={metrics.proximas}
            tone="red"
            active={showDueSoonOnly}
            onClick={() => setShowDueSoonOnly((current) => !current)}
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px_auto] lg:items-end">
            <label className="block">
              <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Buscar</span>
              <input
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Código, cliente, descripción o responsable..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Estado</span>
              <select
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={estado}
                onChange={(event) => setEstado(event.target.value as EstadoFilter)}
              >
                <option value="Todos">Todos</option>
                {pilotoEstados.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Prioridad</span>
              <select
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={prioridad}
                onChange={(event) => setPrioridad(event.target.value as PrioridadFilter)}
              >
                <option value="Todas">Todas</option>
                {pilotoPrioridades.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-3 text-[12px] font-bold text-slate-700 hover:bg-slate-50"
              onClick={clearFilters}
            >
              Limpiar filtros
            </button>
          </div>
        </section>

        <section className="flex items-center justify-between text-[12px] text-slate-500">
          <span>Mostrando {filteredItems.length} de {pilotoLicitacionesDemo.length} licitaciones demo</span>
          <span>Fecha base demo: {formatDate(PILOTO_DEMO_TODAY)}</span>
        </section>

        {filteredItems.length > 0 ? (
          <>
            <DesktopTable items={filteredItems} />
            <MobileCards items={filteredItems} />
          </>
        ) : (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Icons.inbox />
            </div>
            <h2 className="mt-3 text-sm font-black text-slate-800">No hay licitaciones para los filtros actuales</h2>
            <p className="mt-1 text-[12px] text-slate-500">Limpia filtros o prueba con otro código, cliente o responsable.</p>
            <button
              type="button"
              className="mt-4 rounded-md border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50"
              onClick={clearFilters}
            >
              Limpiar filtros
            </button>
          </section>
        )}
      </section>
    </main>
  );
}
