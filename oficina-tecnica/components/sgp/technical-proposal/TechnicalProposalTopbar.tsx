"use client";

type ProposalMode = "cliente" | "interno";
type ProposalWorkStatus = "Borrador" | "En proceso" | "Completado";

type TechnicalProposalTopbarProps = {
  documentCode: string;
  revision: string;
  revisionOptions: string[];
  workStatus: ProposalWorkStatus;
  mode: ProposalMode;
  editingLocked: boolean;
  saving: boolean;
  statusMessage?: string | null;
  cleanTableView: boolean;
  onModeChange: (mode: ProposalMode) => void;
  onWorkStatusChange: (status: ProposalWorkStatus) => void;
  onRevisionChange: (revision: string) => void;
  onCreateRevision: () => void;
  onToggleEditing: () => void;
  onToggleCleanTableView: (value: boolean) => void;
  onSave: () => void;
  onExportPdf: () => void;
  onExportWord: () => void;
  onExportHtml: () => void;
  onExportJson: () => void;
  onClose: () => void;
};

function buttonClassName(variant: "primary" | "secondary" | "ghost" = "secondary"): string {
  const base = "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-[11px] font-bold leading-none transition-colors";
  if (variant === "primary") return `${base} border-blue-700 bg-blue-700 text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60`;
  if (variant === "ghost") return `${base} border-transparent bg-transparent px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800`;
  return `${base} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
}

export function TechnicalProposalTopbar({
  documentCode,
  revision,
  revisionOptions,
  workStatus,
  mode,
  editingLocked,
  saving,
  statusMessage,
  cleanTableView,
  onModeChange,
  onWorkStatusChange,
  onRevisionChange,
  onCreateRevision,
  onToggleEditing,
  onToggleCleanTableView,
  onSave,
  onExportPdf,
  onExportWord,
  onExportHtml,
  onExportJson,
  onClose,
}: TechnicalProposalTopbarProps) {
  return (
    <header className="flex min-h-[54px] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[12px] font-black text-white">PT</div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-black text-slate-900">Propuesta técnica-económica</div>
          <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500">
            <span className="truncate">{documentCode}</span>
            <span aria-hidden="true">·</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-bold text-slate-700">{revision}</span>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">{workStatus}</span>
            {statusMessage ? <span className="max-w-[280px] truncate text-slate-400" title={statusMessage}>{statusMessage}</span> : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <div className="flex h-8 items-center rounded-md border border-slate-200 bg-slate-100 p-0.5" aria-label="Modo del workspace">
          <button
            type="button"
            onClick={() => editingLocked && onToggleEditing()}
            className={`h-7 rounded px-2.5 text-[10px] font-black transition ${!editingLocked ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            aria-pressed={!editingLocked}
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => !editingLocked && onToggleEditing()}
            className={`h-7 rounded px-2.5 text-[10px] font-black transition ${editingLocked ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            aria-pressed={editingLocked}
          >
            Vista previa
          </button>
        </div>

        <button type="button" onClick={onSave} disabled={saving} className={buttonClassName("primary")}>
          {saving ? "Guardando…" : "Guardar"}
        </button>

        <details className="group relative">
          <summary className={`${buttonClassName()} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            Exportar <span aria-hidden="true">▾</span>
          </summary>
          <div className="absolute right-0 top-[calc(100%+5px)] z-[85] grid w-48 gap-0.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
            <button type="button" onClick={onExportPdf} className="rounded-md px-2.5 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50">PDF / imprimir</button>
            <button type="button" onClick={onExportWord} className="rounded-md px-2.5 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50">Word compatible (.doc)</button>
            <button type="button" onClick={onExportHtml} className="rounded-md px-2.5 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50">HTML</button>
            <button type="button" onClick={onExportJson} className="rounded-md px-2.5 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50">JSON estructurado</button>
            <button type="button" disabled className="cursor-not-allowed rounded-md px-2.5 py-2 text-left text-[11px] text-slate-400" title="Pendiente: requiere exportador XLSX sin agregar dependencias">Excel económico / recursos · pendiente</button>
          </div>
        </details>

        <details className="group relative">
          <summary className={`${buttonClassName()} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            Más <span aria-hidden="true">▾</span>
          </summary>
          <div className="absolute right-0 top-[calc(100%+5px)] z-[85] grid w-64 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Revisión
              <select value={revision} onChange={(event) => onRevisionChange(event.target.value)} className="h-8 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold normal-case text-slate-700">
                {revisionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <button type="button" onClick={onCreateRevision} disabled={editingLocked} className="rounded-md border border-slate-200 px-2.5 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Nueva revisión</button>
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Estado PT
              <select value={workStatus} onChange={(event) => onWorkStatusChange(event.target.value as ProposalWorkStatus)} disabled={editingLocked} className="h-8 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold normal-case text-slate-700 disabled:opacity-50">
                <option value="Borrador">Borrador</option>
                <option value="En proceso">En proceso</option>
                <option value="Completado">Completado</option>
              </select>
            </label>
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Modo
              <select value={mode} onChange={(event) => onModeChange(event.target.value as ProposalMode)} disabled={editingLocked} className="h-8 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold normal-case text-slate-700 disabled:opacity-50">
                <option value="cliente">Cliente</option>
                <option value="interno">Interno</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
              <input type="checkbox" checked={cleanTableView} onChange={(event) => onToggleCleanTableView(event.target.checked)} /> Vista limpia
            </label>
            <div className={`rounded-md px-2.5 py-2 text-[10px] font-bold ${editingLocked ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700"}`}>
              {editingLocked ? "Modo vista previa · campos protegidos" : "Modo edición · registro habilitado"}
            </div>
          </div>
        </details>

        <button type="button" onClick={onClose} className={buttonClassName("ghost")} title="Cerrar" aria-label="Cerrar propuesta técnica-económica">✕</button>
      </div>
    </header>
  );
}
