"use client";

type FieldLockButtonProps = {
  locked: boolean;
  onToggle: () => void;
  lockedTitle?: string;
  unlockedTitle?: string;
  label?: string;
};

function LockIcon({ unlocked }: { unlocked: boolean }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (unlocked) {
    return (
      <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden>
        <rect {...common} x="5" y="11" width="14" height="10" rx="2" />
        <path {...common} d="M8 11V8a4 4 0 0 1 7-2.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden>
      <rect {...common} x="5" y="11" width="14" height="10" rx="2" />
      <path {...common} d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function FieldLockButton({
  locked,
  onToggle,
  lockedTitle = "Editar campo",
  unlockedTitle = "Bloquear y guardar",
  label,
}: FieldLockButtonProps) {
  return (
    <button
      onClick={onToggle}
      title={locked ? lockedTitle : unlockedTitle}
      className={`inline-flex h-6 min-h-6 items-center gap-1 rounded border px-1.5 text-[11px] leading-none whitespace-nowrap ${
        locked
          ? "border-stone-200 text-stone-500 hover:bg-stone-100"
          : "border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200"
      }`}
    >
      <LockIcon unlocked={!locked} />
      {label ? <span>{label}</span> : null}
    </button>
  );
}
