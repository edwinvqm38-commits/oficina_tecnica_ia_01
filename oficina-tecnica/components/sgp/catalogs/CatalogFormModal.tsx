"use client";

import { useEffect, useState } from "react";

type CatalogField = {
  key: string;
  label: string;
  type: "text" | "number" | "email";
  required?: boolean;
};

type CatalogFormModalProps<T extends Record<string, unknown>> = {
  open: boolean;
  title: string;
  fields: CatalogField[];
  initial: T | null;
  onClose: () => void;
  onSave: (value: T) => void | Promise<void>;
};

export function CatalogFormModal<T extends Record<string, unknown>>({
  open,
  title,
  fields,
  initial,
  onClose,
  onSave,
}: CatalogFormModalProps<T>) {
  const [form, setForm] = useState<T | null>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial);
    setErrors({});
  }, [initial]);

  if (!open || !form) return null;

  async function save() {
    if (!form) return;
    const current = form;
    const nextErrors: Record<string, string> = {};
    fields.forEach((field) => {
      if (field.required) {
        const value = String(current[field.key] ?? "").trim();
        if (!value) nextErrors[field.key] = "Obligatorio";
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      await onSave(current);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/20 p-4">
      <div className="mx-auto w-[95vw] max-w-[720px] rounded-xl border border-border bg-panel shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded px-2 py-1 text-xs hover:bg-stone-100">
            Cerrar
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className={field.key === "observaciones" ? "md:col-span-2" : ""}>
              <p className="mb-1 text-[11px] text-muted">
                {field.label}
                {field.required ? " *" : ""}
              </p>
              <input
                type={field.type}
                value={String(form[field.key] ?? "")}
                onChange={(event) =>
                  setForm((prev) => (prev ? { ...prev, [field.key]: event.target.value } : prev))
                }
                className="h-8 w-full rounded border border-stone-300 bg-white px-2 text-xs outline-none"
              />
              {errors[field.key] ? <p className="mt-1 text-[11px] text-red-600">{errors[field.key]}</p> : null}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2">
          <button onClick={onClose} className="rounded border border-border px-3 py-1 text-xs">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded border border-border bg-stone-900 px-3 py-1 text-xs text-white disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
