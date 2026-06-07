"use client";

type TechnicalProposalTopbarProps = {
  documentCode: string;
  revisionFolder: string;
  mode: "cliente" | "interno";
  editingLocked: boolean;
  onModeChange: (mode: "cliente" | "interno") => void;
  onEditToggle: () => void;
  onClose: () => void;
};

function topbarButtonClassName(variant: "primary" | "secondary" | "soft" | "ghost" = "secondary"): string {
  const base = "inline-flex h-7 items-center justify-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold leading-none";
  if (variant === "primary") return `${base} border-teal-700 bg-teal-700 text-white hover:bg-teal-800`;
  if (variant === "soft") return `${base} border-stone-200 bg-stone-100 text-stone-700 hover:bg-stone-200`;
  if (variant === "ghost") return `${base} border-transparent bg-transparent text-stone-500 hover:bg-stone-100`;
  return `${base} border-stone-200 bg-white text-stone-700 hover:bg-stone-100`;
}

export function TechnicalProposalTopbar({
  documentCode,
  revisionFolder,
  mode,
  editingLocked,
  onModeChange,
  onEditToggle,
  onClose,
}: TechnicalProposalTopbarProps) {
  return (
    <header className="flex min-h-[50px] flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-800 text-[13px] font-black text-white">
          PT
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-black text-stone-800">SGP-LITE Propuesta Tecnica</div>
          <div className="truncate text-[11px] text-stone-500">
            {documentCode} / {revisionFolder}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          Listo
        </span>
        <label className="inline-flex h-7 items-center gap-1 rounded-full border border-stone-200 bg-white px-2 text-[11px] font-bold text-stone-700">
          Modo
          <select
            value={mode}
            onChange={(event) => onModeChange(event.target.value as "cliente" | "interno")}
            className="h-6 rounded-full border border-stone-200 bg-stone-100 px-2 text-[11px] disabled:cursor-not-allowed disabled:text-stone-400"
            disabled={editingLocked}
          >
            <option value="cliente">Cliente</option>
            <option value="interno">Interno</option>
          </select>
        </label>
        <button type="button" onClick={onEditToggle} className={editingLocked ? topbarButtonClassName("soft") : topbarButtonClassName("primary")}>
          {editingLocked ? "🔒 Editar" : "🔓 Guardar"}
        </button>
        <button type="button" onClick={onClose} className={topbarButtonClassName("ghost")}>
          ✕ Cerrar
        </button>
      </div>
    </header>
  );
}
