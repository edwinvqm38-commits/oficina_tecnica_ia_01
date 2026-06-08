import type { MemoryNote } from "@/lib/ai-office/memoryTypes";

const approvalStatusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "bg-slate-50 text-slate-500 border-slate-200" },
  "pending-approval": { label: "Pendiente", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Aprobada", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rechazada", className: "bg-red-50 text-red-700 border-red-200" },
};

const folderLabels: Record<string, string> = {
  "00_Inbox": "Inbox",
  "01_Fuentes": "Fuentes",
  "02_Proyectos": "Proyectos",
  "03_Decisiones": "Decisiones",
  "04_Skills_Aprobadas": "Skills Aprobadas",
  "05_Observaciones_Pendientes": "Observaciones Pendientes",
  "06_Auditoria": "Auditoría",
};

const noteTypeLabels: Record<string, string> = {
  source: "Fuente",
  project: "Proyecto",
  decision: "Decisión",
  "approved-skill": "Skill aprobada",
  "pending-observation": "Observación pendiente",
  audit: "Auditoría",
};

type Props = { notes: MemoryNote[] };

export function AIMemoryPreviewPanel({ notes }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2.5">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Memoria del sistema
        </p>
        <p className="text-sm font-semibold text-slate-800">Notas pendientes de registro</p>
      </div>

      <div className="space-y-2.5 px-3 py-3">
        {notes.map((note) => {
          const status = approvalStatusConfig[note.approvalStatus] ?? { label: note.approvalStatus, className: "bg-slate-50 text-slate-500 border-slate-200" };
          const folderLabel = folderLabels[note.folderTarget] ?? note.folderTarget;
          const noteLabel = noteTypeLabels[note.noteType] ?? note.noteType;

          return (
            <div key={note.id} className="overflow-hidden rounded-md border border-violet-100 bg-violet-50/20">
              <div className="h-1 w-full bg-violet-400" />
              <div className="px-3 py-2.5">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 flex-1">{note.title}</p>
                  <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <p className="mb-2 text-xs leading-5 text-slate-500">{note.summary}</p>

                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                    📁 {folderLabel}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {noteLabel}
                  </span>
                  {note.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                      #{tag}
                    </span>
                  ))}
                </div>

                <p className="mb-2 text-xs text-slate-400">{note.createdAtLabel}</p>

                <button
                  type="button"
                  className="w-full rounded-md bg-violet-600 px-3 py-1.5 text-center text-xs font-semibold text-white transition-colors hover:bg-violet-700"
                >
                  Aprobar registro en memoria
                </button>
                <p className="mt-1.5 text-center text-xs text-slate-400">
                  Acción solo visual · MVP mock
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
