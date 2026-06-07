"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  CatalogEstadoRecurso,
  CatalogMarca,
  CatalogMoneda,
  CatalogProveedor,
  CatalogTipoRecurso,
  CatalogUnidad,
  EstadoRecurso,
  Recurso,
  ResourceFiles,
} from "@/lib/demoData";
import { ResourceFilesPanel } from "@/components/resources/ResourceFilesPanel";
import { FieldLabelIcon, type IconName } from "@/components/ui/FieldLabelIcon";
import { DateTextInput } from "@/components/ui/DateTextInput";

type ResourceFormModalProps = {
  open: boolean;
  initial: Recurso | null;
  usedCodes: string[];
  catalogs: {
    tipos: CatalogTipoRecurso[];
    unidades: CatalogUnidad[];
    marcas: CatalogMarca[];
    proveedores: CatalogProveedor[];
    monedas: CatalogMoneda[];
    estados: CatalogEstadoRecurso[];
  };
  onClose: () => void;
  onSave: (value: Recurso) => void | Promise<void>;
  detailsReadOnly?: boolean;
  filesReadOnly?: boolean;
  allowFilePicker?: boolean;
  isSaving?: boolean;
};

type FormErrors = Partial<Record<keyof Recurso, string>> & { files?: string };

function fieldClass(disabled = false): string {
  return `h-7 w-full rounded-md border border-stone-300 px-2 text-xs outline-none transition focus:border-stone-400 ${
    disabled ? "cursor-not-allowed bg-stone-50 text-stone-500" : "bg-white text-stone-700"
  }`;
}

function withCurrent(options: string[], current: string): string[] {
  if (!current) return options;
  return options.includes(current) ? options : [current, ...options];
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] text-stone-500" aria-hidden>
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] text-stone-600" aria-hidden>
      <path
        d="M5 4h12l2 2v14H5zM8 4v5h8V4M9 20v-5h6v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-white/50">
      <div className="border-b border-border px-3 py-1.5">
        <FieldLabelIcon icon={icon} label={title} className="text-xs font-medium text-stone-700" />
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </section>
  );
}

function FieldLabel({ icon, label, required }: { icon: IconName; label: string; required?: boolean }) {
  return (
    <div className="mb-1">
      <FieldLabelIcon
        icon={icon}
        label={required ? `${label}\u00A0*` : label}
        className="whitespace-nowrap text-[11px] text-stone-600"
      />
    </div>
  );
}

export function ResourceFormModal({
  open,
  initial,
  usedCodes,
  catalogs,
  onClose,
  onSave,
  detailsReadOnly = false,
  filesReadOnly = false,
  allowFilePicker = true,
  isSaving = false,
}: ResourceFormModalProps) {
  const [form, setForm] = useState<Recurso | null>(initial);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    setForm(initial);
    setErrors({});
  }, [initial]);

  const isEditing = useMemo(() => Boolean(initial?.id), [initial?.id]);

  const activeTipos = useMemo(() => catalogs.tipos.filter((item) => item.activo).map((item) => item.nombre), [catalogs.tipos]);
  const activeUnidades = useMemo(
    () => catalogs.unidades.filter((item) => item.activo).map((item) => item.codigo),
    [catalogs.unidades],
  );
  const activeMarcas = useMemo(() => catalogs.marcas.filter((item) => item.activo).map((item) => item.nombre), [catalogs.marcas]);
  const activeProveedores = useMemo(
    () => catalogs.proveedores.filter((item) => item.activo).map((item) => item.nombre),
    [catalogs.proveedores],
  );
  const activeMonedas = useMemo(
    () => catalogs.monedas.filter((item) => item.activo).map((item) => item.codigo as "PEN" | "USD"),
    [catalogs.monedas],
  );
  const activeEstados = useMemo(
    () => catalogs.estados.filter((item) => item.activo).map((item) => item.nombre as EstadoRecurso),
    [catalogs.estados],
  );

  function updateField<K extends keyof Recurso>(key: K, value: Recurso[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function validate(current: Recurso): FormErrors {
    const next: FormErrors = {};
    if (!current.codigo_recurso.trim()) next.codigo_recurso = "Campo obligatorio";
    if (!current.tipo_recurso.trim()) next.tipo_recurso = "Campo obligatorio";
    if (!current.descripcion.trim()) next.descripcion = "Campo obligatorio";
    if (!current.unidad.trim()) next.unidad = "Campo obligatorio";
    if (!Number.isFinite(current.precio_unitario_ref) || current.precio_unitario_ref < 0) {
      next.precio_unitario_ref = "Debe ser mayor o igual a 0";
    }
    if (!current.moneda.trim()) next.moneda = "Campo obligatorio";
    if (!current.proveedor.trim()) next.proveedor = "Campo obligatorio";
    if (!current.estado.trim()) next.estado = "Campo obligatorio";

    const repeated = usedCodes.some(
      (code) =>
        code.toLowerCase() === current.codigo_recurso.toLowerCase() &&
        (!isEditing || initial?.codigo_recurso.toLowerCase() !== current.codigo_recurso.toLowerCase()),
    );
    if (repeated) next.codigo_recurso = "Código ya existe";

    return next;
  }

  function submit() {
    if (!form) return;
    const normalized: Recurso = {
      ...form,
      moneda: (form.moneda || "PEN") as "PEN" | "USD",
      estado: (form.estado || "Activo") as EstadoRecurso,
      precio_unitario_ref: Number(form.precio_unitario_ref),
      ficha_tecnica:
        form.resourceFiles.fichasTecnicas?.[0]?.name ??
        form.resourceFiles.fichaTecnica?.name ??
        "",
      imagen:
        form.resourceFiles.imagenes?.[0]?.name ??
        form.resourceFiles.imagen?.name ??
        "",
      archivos: form.resourceFiles.archivos.map((item) => item.name).join(", "),
    };
    const validation = validate(normalized);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    void onSave(normalized);
  }

  if (!open || !form) return null;

  const tipoOptions = withCurrent(activeTipos, form.tipo_recurso);
  const unidadOptions = withCurrent(activeUnidades, form.unidad);
  const marcaOptions = withCurrent(activeMarcas, form.marca);
  const proveedorOptions = withCurrent(activeProveedores, form.proveedor);
  const monedaOptions = withCurrent(activeMonedas as string[], form.moneda);
  const estadoOptions = withCurrent(activeEstados as string[], form.estado);

  return (
    <div className="fixed inset-0 z-50 bg-black/20 p-3 md:p-4">
      <div className="mx-auto flex h-[90vh] w-[96vw] max-w-[1120px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-panel px-4 py-2">
          <FieldLabelIcon
            icon="package"
            label={isEditing ? "Editar recurso" : "Nuevo recurso"}
            className="text-sm font-semibold text-stone-800"
          />
          <button
            onClick={onClose}
            className="inline-flex h-7 min-h-7 items-center gap-1 rounded-md border border-border px-2.5 text-xs text-stone-700 transition hover:bg-stone-100"
          >
            <CloseIcon />
            <span>Cerrar</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_310px]">
            <div className="min-w-0 space-y-2">
              <SectionCard title="Identificación" icon="barcode">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-8 xl:grid-cols-12">
                  <div className="md:col-span-2 xl:col-span-3">
                    <FieldLabel icon="barcode" label="Código recurso" required />
                    <input
                      value={form.codigo_recurso}
                      onChange={(event) => updateField("codigo_recurso", event.target.value)}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    />
                    {errors.codigo_recurso ? <p className="mt-1 text-[11px] text-red-600">{errors.codigo_recurso}</p> : null}
                  </div>
                  <div className="md:col-span-2 xl:col-span-3">
                    <FieldLabel icon="hash" label="Código EKA" />
                    <input
                      value={form.codigo_eka}
                      onChange={(event) => updateField("codigo_eka", event.target.value)}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    />
                  </div>
                  <div className="md:col-span-2 xl:col-span-3">
                    <FieldLabel icon="package-open" label="Código fabricante" />
                    <input
                      value={form.codigo_fabricante}
                      onChange={(event) => updateField("codigo_fabricante", event.target.value)}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    />
                  </div>
                  <div className="md:col-span-2 xl:col-span-3">
                    <FieldLabel icon="circle-dot" label="Estado" required />
                    <select
                      value={form.estado}
                      onChange={(event) => updateField("estado", event.target.value as EstadoRecurso)}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    >
                      {estadoOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Datos del recurso" icon="package-open">
                <div className="grid grid-cols-1 items-end gap-2 md:grid-cols-6 xl:grid-cols-10">
                  <div className="md:col-span-2 xl:col-span-2">
                    <FieldLabel icon="tags" label="Tipo recurso" required />
                    <select
                      value={form.tipo_recurso}
                      onChange={(event) => updateField("tipo_recurso", event.target.value)}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    >
                      <option value="">Seleccionar</option>
                      {tipoOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    {errors.tipo_recurso ? <p className="mt-1 text-[11px] text-red-600">{errors.tipo_recurso}</p> : null}
                  </div>
                  <div className="md:col-span-3 xl:col-span-4">
                    <FieldLabel icon="align-left" label="Descripción" required />
                    <input
                      value={form.descripcion}
                      onChange={(event) => updateField("descripcion", event.target.value)}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    />
                    {errors.descripcion ? <p className="mt-1 text-[11px] text-red-600">{errors.descripcion}</p> : null}
                  </div>
                  <div className="md:col-span-1 xl:col-span-1">
                    <FieldLabel icon="ruler" label="UND" required />
                    <select
                      value={form.unidad}
                      onChange={(event) => updateField("unidad", event.target.value)}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    >
                      {unidadOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 xl:col-span-2">
                    <FieldLabel icon="tags" label="Marca" />
                    <select
                      value={form.marca}
                      onChange={(event) => updateField("marca", event.target.value)}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    >
                      {marcaOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 xl:col-span-1">
                    <FieldLabel icon="package" label="Modelo" />
                    <input
                      value={form.modelo}
                      onChange={(event) => updateField("modelo", event.target.value)}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Precio referencial" icon="calculator">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-6 xl:grid-cols-10">
                  <div className="md:col-span-1 xl:col-span-1">
                    <FieldLabel icon="calculator" label="P.U. Ref." required />
                    <input
                      type="number"
                      value={form.precio_unitario_ref}
                      onChange={(event) => updateField("precio_unitario_ref", Number(event.target.value))}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    />
                    {errors.precio_unitario_ref ? (
                      <p className="mt-1 text-[11px] text-red-600">{errors.precio_unitario_ref}</p>
                    ) : null}
                  </div>
                  <div className="md:col-span-1 xl:col-span-2">
                    <FieldLabel icon="coins" label="Moneda" required />
                    <select
                      value={form.moneda}
                      onChange={(event) => updateField("moneda", event.target.value as "PEN" | "USD")}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    >
                      {monedaOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 xl:col-span-3">
                    <FieldLabel icon="store" label="Proveedor" required />
                    <select
                      value={form.proveedor}
                      onChange={(event) => updateField("proveedor", event.target.value)}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    >
                      {proveedorOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-1 xl:col-span-2">
                    <FieldLabel icon="clock" label="Tiempo entrega ref." />
                    <input
                      value={form.tiempo_entrega_ref}
                      onChange={(event) => updateField("tiempo_entrega_ref", event.target.value)}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    />
                  </div>
                  <div className="md:col-span-1 xl:col-span-2">
                    <FieldLabel icon="calendar" label="Fecha actualización" />
                    <DateTextInput
                      value={form.fecha_actualizacion}
                      onChange={(value) => updateField("fecha_actualizacion", value)}
                      disabled={detailsReadOnly}
                      className={fieldClass(detailsReadOnly)}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Observaciones" icon="align-left">
                <textarea
                  value={form.observaciones}
                  onChange={(event) => updateField("observaciones", event.target.value)}
                  disabled={detailsReadOnly}
                  rows={2}
                  className={`w-full rounded-md border border-stone-300 px-2 py-1.5 text-xs outline-none transition focus:border-stone-400 ${
                    detailsReadOnly ? "cursor-not-allowed bg-stone-50 text-stone-500" : "bg-white text-stone-700"
                  }`}
                />
              </SectionCard>
            </div>

            <div className="min-w-0">
              <SectionCard title="Documentos" icon="files">
                {!allowFilePicker && !filesReadOnly ? (
                  <p className="mb-2 text-[11px] leading-relaxed text-stone-500">
                    Registra URL o ID de archivo. La subida real a storage/Drive todavía no está conectada para recursos.
                  </p>
                ) : null}
                <ResourceFilesPanel
                  layout="stack"
                  value={form.resourceFiles}
                  onChange={(files: ResourceFiles) => updateField("resourceFiles", files)}
                  onValidationError={(message) => setErrors((prev) => ({ ...prev, files: message ?? undefined }))}
                  readOnly={filesReadOnly}
                  allowFilePicker={allowFilePicker}
                />
                {errors.files ? <p className="mt-1 text-[11px] text-red-600">{errors.files}</p> : null}
              </SectionCard>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border bg-panel px-4 py-2">
          <button
            onClick={onClose}
            className="inline-flex h-7 min-h-7 items-center gap-1 rounded-md border border-border px-3 text-xs text-stone-700 transition hover:bg-stone-100"
          >
            <CloseIcon />
            <span>Cancelar</span>
          </button>
          <button
            onClick={submit}
            disabled={isSaving}
            className="inline-flex h-7 min-h-7 items-center gap-1 rounded-md border border-border bg-stone-100 px-3 text-xs font-medium text-stone-800 transition hover:bg-stone-200"
          >
            <SaveIcon />
            <span>{isSaving ? "Guardando..." : "Guardar recurso"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
