import Link from "next/link";
import { notFound } from "next/navigation";
import { getPilotoLicitacionById } from "@/lib/demo/piloto-licitaciones";

type PilotoDetallePageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00-05:00`));
}

export default async function PilotoLicitacionDetallePage({ params }: PilotoDetallePageProps) {
  const { id } = await params;
  const item = getPilotoLicitacionById(id);

  if (!item) notFound();

  return (
    <main className="min-h-full bg-slate-50 px-4 py-5 md:px-6">
      <section className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <Link className="text-[12px] font-bold text-blue-700 hover:underline" href="/piloto-licitaciones">
          ← Volver al piloto
        </Link>

        <header className="mt-4 border-b border-slate-200 pb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-blue-700">Detalle temporal QEI-2A</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">{item.codigo}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Esta vista usa datos ficticios. El detalle completo de licitación se implementará en QEI-2B.
          </p>
        </header>

        <section className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Cliente</div>
            <div className="mt-1 text-sm font-bold text-slate-900">{item.cliente}</div>
            <div className="mt-1 text-[12px] text-slate-500">{item.unidad}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Estado / prioridad</div>
            <div className="mt-1 text-sm font-bold text-slate-900">{item.estado} · {item.prioridad}</div>
            <div className="mt-1 text-[12px] text-slate-500">Responsable: {item.responsable}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Fechas</div>
            <div className="mt-1 text-sm font-bold text-slate-900">
              Recibida {formatDate(item.fechaRecepcion)} · límite {formatDate(item.fechaLimite)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Carga documental</div>
            <div className="mt-1 text-sm font-bold text-slate-900">
              {item.cantidadRequerimientos} requerimientos · {item.cantidadDocumentos} documentos
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Descripción</div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{item.descripcion}</p>
        </section>
      </section>
    </main>
  );
}
