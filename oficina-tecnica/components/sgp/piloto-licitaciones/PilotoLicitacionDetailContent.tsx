import Link from "next/link";
import type { ReactNode } from "react";
import {
  PILOTO_DEMO_TODAY,
  type PilotoEstadoLicitacion,
  type PilotoLicitacionDemo,
  type PilotoPrioridad,
} from "@/lib/demo/piloto-licitaciones";
import { Icons } from "@/lib/icons";

const closedStates = new Set<PilotoEstadoLicitacion>(["Presentada", "Cerrada"]);

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00-05:00`));
}

function formatMoney(value: number, currency: PilotoLicitacionDemo["moneda"]): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00-05:00`).getTime();
  const endDate = new Date(`${end}T00:00:00-05:00`).getTime();
  return Math.ceil((endDate - startDate) / 86_400_000);
}

function dueStatus(item: PilotoLicitacionDemo): { label: string; className: string } {
  const days = daysBetween(PILOTO_DEMO_TODAY, item.fechaLimite);

  if (closedStates.has(item.estado)) {
    return { label: days < 0 ? `Cerrada hace ${Math.abs(days)} días` : "Cerrada", className: "bg-stone-100 text-stone-700 ring-stone-200" };
  }

  if (days < 0) {
    return { label: `Vencida hace ${Math.abs(days)} días`, className: "bg-red-50 text-red-700 ring-red-200" };
  }

  if (days === 0) {
    return { label: "Vence hoy", className: "bg-red-50 text-red-700 ring-red-200" };
  }

  if (days <= 7) {
    return { label: `Vence en ${days} días`, className: "bg-amber-50 text-amber-700 ring-amber-200" };
  }

  return { label: `${days} días restantes`, className: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
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

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-slate-100 py-3 first:border-t-0">
      <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-slate-900">{value}</dd>
    </div>
  );
}

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 break-words text-xl font-black text-slate-950">{value}</div>
      {detail ? <div className="mt-1 text-[12px] font-bold text-slate-500">{detail}</div> : null}
    </div>
  );
}

export function PilotoLicitacionDetailContent({ item }: { item: PilotoLicitacionDemo }) {
  const due = dueStatus(item);

  return (
    <main className="min-h-full bg-slate-50 px-4 py-5 md:px-6">
      <section className="mx-auto flex max-w-[1280px] flex-col gap-4">
        <Link
          className="inline-flex w-fit items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-[12px] font-bold text-blue-700 hover:bg-blue-50"
          href="/piloto-licitaciones"
        >
          <Icons.chevronRight className="rotate-180" width={13} height={13} />
          Volver a la bandeja
        </Link>

        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <nav className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <Link className="text-blue-700 hover:underline" href="/piloto-licitaciones">Piloto licitaciones</Link>
            <span>/</span>
            <span>Detalle ejecutivo</span>
          </nav>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase tracking-[0.22em] text-blue-700">{item.codigo}</p>
              <h1 className="mt-2 max-w-5xl text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                {item.descripcion}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Vista ejecutiva demo para revisar alcance, condición de proceso y resumen económico sin integraciones reales.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:max-w-[360px] lg:justify-end">
              <Badge className={estadoClassName(item.estado)}>{item.estado}</Badge>
              <Badge className={prioridadClassName(item.prioridad)}>Prioridad {item.prioridad}</Badge>
              <Badge className={due.className}>{due.label}</Badge>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900">
              <Icons.projects width={16} height={16} />
              <h2 className="text-sm font-black uppercase tracking-wide">Datos generales</h2>
            </div>
            <dl className="mt-4 grid gap-x-6 md:grid-cols-2">
              <Field label="Cliente" value={item.cliente} />
              <Field label="Unidad o área solicitante" value={item.unidad} />
              <Field label="Tipo de proceso" value={item.tipoProceso} />
              <Field label="Responsable" value={item.responsable} />
              <Field label="Fecha de invitación" value={formatDate(item.fechaRecepcion)} />
              <Field label="Fecha límite" value={formatDate(item.fechaLimite)} />
              <Field label="Moneda" value={item.moneda} />
              <Field label="Monto referencial" value={formatMoney(item.montoReferencial, item.moneda)} />
              <Field label="Unidad de trabajo / ubicación demo" value={item.ubicacionTrabajo} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900">
              <Icons.clock width={16} height={16} />
              <h2 className="text-sm font-black uppercase tracking-wide">Estado del proceso</h2>
            </div>
            <dl className="mt-4">
              <Field label="Estado actual" value={<Badge className={estadoClassName(item.estado)}>{item.estado}</Badge>} />
              <Field label="Responsable" value={item.responsable} />
              <Field label="Prioridad" value={<Badge className={prioridadClassName(item.prioridad)}>{item.prioridad}</Badge>} />
              <Field label="Condición de plazo" value={<Badge className={due.className}>{due.label}</Badge>} />
              <Field label="Siguiente acción demo" value={item.siguienteAccionDemo} />
            </dl>
          </section>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-900">
                <Icons.costs width={16} height={16} />
                <h2 className="text-sm font-black uppercase tracking-wide">Resumen económico demo</h2>
              </div>
              <p className="mt-2 text-[12px] text-slate-500">
                Valores ficticios para lectura ejecutiva; no representan reglas financieras reales.
              </p>
            </div>
            <span className="text-[12px] font-black uppercase tracking-wide text-slate-500">Moneda: {item.moneda}</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryMetric label="Monto referencial" value={formatMoney(item.montoReferencial, item.moneda)} />
            <SummaryMetric label="Costo estimado" value={formatMoney(item.resumenEconomico.costoEstimado, item.moneda)} />
            <SummaryMetric label="Utilidad estimada" value={formatMoney(item.resumenEconomico.utilidadEstimada, item.moneda)} />
            <SummaryMetric label="Margen estimado" value={`${item.resumenEconomico.margenEstimado.toFixed(1)}%`} />
            <SummaryMetric label="Monto de oferta" value={formatMoney(item.resumenEconomico.montoOferta, item.moneda)} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <Icons.layers width={16} height={16} />
            <h2 className="text-sm font-black uppercase tracking-wide">Requerimientos asociados</h2>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SummaryMetric label="Requerimientos" value={String(item.cantidadRequerimientos)} />
            <SummaryMetric label="Recursos" value={String(item.cantidadRecursos)} />
            <SummaryMetric label="Documentos" value={String(item.cantidadDocumentos)} />
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            El detalle completo de requerimientos asociados se implementará en QEI-2B2. Esta microfase solo presenta el resumen demo.
          </div>
        </section>
      </section>
    </main>
  );
}
