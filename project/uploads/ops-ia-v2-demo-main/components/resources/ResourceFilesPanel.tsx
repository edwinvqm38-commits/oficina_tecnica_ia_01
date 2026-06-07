"use client";

import { useState } from "react";
import type { ResourceFileMeta, ResourceFiles } from "@/lib/demoData";
import { FieldLabelIcon } from "@/components/ui/FieldLabelIcon";

type ResourceFilesPanelProps = {
  value: ResourceFiles;
  onChange: (value: ResourceFiles) => void;
  onValidationError?: (message: string | null) => void;
  layout?: "row" | "stack";
  readOnly?: boolean;
  allowFilePicker?: boolean;
};

function toMeta(file: File): ResourceFileMeta {
  return {
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    localPreviewUrl: URL.createObjectURL(file),
    futureDriveFileId: "",
    futureDriveUrl: "",
  };
}

function referenceLabel(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? normalized);
  } catch {
    return normalized;
  }
}

function toReferenceMeta(value: string): ResourceFileMeta | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const isUrl = /^https?:\/\//i.test(normalized);
  const isImageReference = /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(normalized);
  return {
    name: referenceLabel(normalized),
    size: 0,
    type: isImageReference ? "image/*" : "",
    localPreviewUrl: "",
    futureDriveFileId: isUrl ? "" : normalized,
    futureDriveUrl: isUrl ? normalized : "",
  };
}

export function ResourceFilesPanel({
  value,
  onChange,
  onValidationError,
  layout = "row",
  readOnly = false,
  allowFilePicker = true,
}: ResourceFilesPanelProps) {
  const fichasTecnicas = value.fichasTecnicas ?? (value.fichaTecnica ? [value.fichaTecnica] : []);
  const imagenes = value.imagenes ?? (value.imagen ? [value.imagen] : []);
  const [fichaReference, setFichaReference] = useState("");
  const [imagenReference, setImagenReference] = useState("");
  const [archivoReference, setArchivoReference] = useState("");

  function mergedSummary(list: ResourceFileMeta[], emptyText: string, singularText: string, pluralText: string): string {
    if (list.length === 0) return emptyText;
    if (list.length === 1) return `1 ${singularText}`;
    return `${list.length} ${pluralText}`;
  }

  function compactList(list: ResourceFileMeta[]): ResourceFileMeta[] {
    return list.slice(0, 3);
  }

  function updateFichas(files: FileList | null) {
    if (!files || readOnly || !allowFilePicker) return;
    const mapped = Array.from(files).map(toMeta);
    const next = [...fichasTecnicas, ...mapped];
    onValidationError?.(null);
    onChange({
      ...value,
      fichaTecnica: next[0] ?? null,
      fichasTecnicas: next,
    });
  }

  function updateImagenes(files: FileList | null) {
    if (!files || readOnly || !allowFilePicker) return;
    const mapped = Array.from(files).map(toMeta);
    const next = [...imagenes, ...mapped];
    onValidationError?.(null);
    onChange({
      ...value,
      imagen: next[0] ?? null,
      imagenes: next,
    });
  }

  function addFiles(files: FileList | null) {
    if (!files || readOnly || !allowFilePicker) return;
    const mapped = Array.from(files).map(toMeta);
    onValidationError?.(null);
    onChange({ ...value, archivos: [...value.archivos, ...mapped] });
  }

  function removeFichaAt(index: number) {
    if (readOnly) return;
    const next = fichasTecnicas.filter((_, idx) => idx !== index);
    onChange({
      ...value,
      fichaTecnica: next[0] ?? null,
      fichasTecnicas: next,
    });
  }

  function removeImagenAt(index: number) {
    if (readOnly) return;
    const next = imagenes.filter((_, idx) => idx !== index);
    onChange({
      ...value,
      imagen: next[0] ?? null,
      imagenes: next,
    });
  }

  function firstPreviewImage(list: ResourceFileMeta[]): ResourceFileMeta | null {
    return list.find((item) => item.type.startsWith("image/") && Boolean(item.localPreviewUrl || item.futureDriveUrl)) ?? null;
  }

  function addFichaReference() {
    const meta = toReferenceMeta(fichaReference);
    if (!meta || readOnly) return;
    const next = [...fichasTecnicas, meta];
    onValidationError?.(null);
    onChange({ ...value, fichaTecnica: next[0] ?? null, fichasTecnicas: next });
    setFichaReference("");
  }

  function addImagenReference() {
    const meta = toReferenceMeta(imagenReference);
    if (!meta || readOnly) return;
    const next = [...imagenes, meta];
    onValidationError?.(null);
    onChange({ ...value, imagen: next[0] ?? null, imagenes: next });
    setImagenReference("");
  }

  function addArchivoReference() {
    const meta = toReferenceMeta(archivoReference);
    if (!meta || readOnly) return;
    onValidationError?.(null);
    onChange({ ...value, archivos: [...value.archivos, meta] });
    setArchivoReference("");
  }

  return (
    <div className={layout === "stack" ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 gap-2 xl:grid-cols-3"}>
      <div className="flex min-h-[126px] flex-col rounded-md border border-border bg-stone-50/50 p-2">
        <FieldLabelIcon icon="file-text" label="Ficha técnica" className="mb-2 text-[11px] font-medium text-stone-700" />
        {allowFilePicker && !readOnly ? (
        <label className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border bg-white px-2 text-[11px] text-stone-700 hover:bg-stone-100">
          Agregar fichas
          <input
            type="file"
            multiple
            accept="*/*"
            className="hidden"
            onChange={(event) => updateFichas(event.target.files)}
          />
        </label>
        ) : null}
        {!readOnly ? (
          <div className="flex gap-1">
            <input
              value={fichaReference}
              onChange={(event) => setFichaReference(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addFichaReference();
                }
              }}
              className="h-7 min-w-0 flex-1 rounded-md border border-border bg-white px-2 text-[11px] outline-none"
              placeholder="URL o ID de ficha"
            />
            <button type="button" onClick={addFichaReference} className="h-7 rounded border border-border px-2 text-[11px] hover:bg-stone-100">
              Agregar
            </button>
          </div>
        ) : null}
        <div className="mt-2 text-[11px] text-stone-500">
          {mergedSummary(fichasTecnicas, "Sin fichas seleccionadas", "ficha seleccionada", "fichas seleccionadas")}
        </div>
        {fichasTecnicas.length > 0 ? (
          <div className="mt-2 rounded border border-border bg-white p-2 text-[11px]">
            {compactList(fichasTecnicas).map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="mb-1 last:mb-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 flex-1 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <button
                    className="inline-flex h-5 shrink-0 items-center rounded border border-border px-1.5 text-[10px] text-stone-600 hover:bg-stone-100"
                    type="button"
                    onClick={() => removeFichaAt(idx)}
                    disabled={readOnly}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
            {fichasTecnicas.length > 3 ? <p className="text-[10px] text-stone-500">+{fichasTecnicas.length - 3} más</p> : null}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-[126px] flex-col rounded-md border border-border bg-stone-50/50 p-2">
        <FieldLabelIcon icon="image" label="Imagen" className="mb-2 text-[11px] font-medium text-stone-700" />
        {allowFilePicker && !readOnly ? (
        <label className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border bg-white px-2 text-[11px] text-stone-700 hover:bg-stone-100">
          Agregar imágenes
          <input
            type="file"
            multiple
            accept="*/*"
            className="hidden"
            onChange={(event) => updateImagenes(event.target.files)}
          />
        </label>
        ) : null}
        {!readOnly ? (
          <div className="flex gap-1">
            <input
              value={imagenReference}
              onChange={(event) => setImagenReference(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addImagenReference();
                }
              }}
              className="h-7 min-w-0 flex-1 rounded-md border border-border bg-white px-2 text-[11px] outline-none"
              placeholder="URL o ID de imagen"
            />
            <button type="button" onClick={addImagenReference} className="h-7 rounded border border-border px-2 text-[11px] hover:bg-stone-100">
              Agregar
            </button>
          </div>
        ) : null}
        <div className="mt-2 text-[11px] text-stone-500">
          {mergedSummary(imagenes, "Sin imágenes seleccionadas", "imagen seleccionada", "imágenes seleccionadas")}
        </div>
        {imagenes.length > 0 ? (
          <div className="mt-2 rounded border border-border bg-white p-2 text-[11px]">
            {firstPreviewImage(imagenes) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={firstPreviewImage(imagenes)?.localPreviewUrl || firstPreviewImage(imagenes)?.futureDriveUrl}
                alt="Vista previa"
                className="mb-1 h-14 w-14 rounded border border-border object-cover"
              />
            ) : null}
            {compactList(imagenes).map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="mb-1 last:mb-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 flex-1 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <button
                    className="inline-flex h-5 shrink-0 items-center rounded border border-border px-1.5 text-[10px] text-stone-600 hover:bg-stone-100"
                    type="button"
                    onClick={() => removeImagenAt(idx)}
                    disabled={readOnly}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
            {imagenes.length > 3 ? <p className="text-[10px] text-stone-500">+{imagenes.length - 3} más</p> : null}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-[126px] flex-col rounded-md border border-border bg-stone-50/50 p-2">
        <FieldLabelIcon icon="files" label="Archivos" className="mb-2 text-[11px] font-medium text-stone-700" />
        {allowFilePicker && !readOnly ? (
        <label className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border bg-white px-2 text-[11px] text-stone-700 hover:bg-stone-100">
          Agregar archivos
          <input type="file" multiple accept="*/*" className="hidden" onChange={(event) => addFiles(event.target.files)} />
        </label>
        ) : null}
        {!readOnly ? (
          <div className="flex gap-1">
            <input
              value={archivoReference}
              onChange={(event) => setArchivoReference(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addArchivoReference();
                }
              }}
              className="h-7 min-w-0 flex-1 rounded-md border border-border bg-white px-2 text-[11px] outline-none"
              placeholder="URL o ID de archivo"
            />
            <button type="button" onClick={addArchivoReference} className="h-7 rounded border border-border px-2 text-[11px] hover:bg-stone-100">
              Agregar
            </button>
          </div>
        ) : null}
        <div className="mt-2 text-[11px] text-stone-500">
          {mergedSummary(value.archivos, "Sin archivos adjuntos", "archivo adjunto", "archivos adjuntos")}
        </div>
        <div className="mt-2 max-h-[100px] space-y-1 overflow-auto pr-1">
          {compactList(value.archivos).map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="rounded border border-border bg-white p-1.5 text-[11px]">
              <div className="flex min-w-0 items-center gap-2">
                <p className="min-w-0 flex-1 truncate" title={file.name}>
                  {file.name}
                </p>
                <button
                  className="inline-flex h-5 shrink-0 items-center rounded border border-border px-1.5 text-[10px] text-stone-600 hover:bg-stone-100"
                  type="button"
                  disabled={readOnly}
                  onClick={() =>
                    onChange({
                      ...value,
                      archivos: value.archivos.filter((_, itemIdx) => itemIdx !== idx),
                    })
                  }
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
          {value.archivos.length > 3 ? <p className="text-[10px] text-stone-500">+{value.archivos.length - 3} más</p> : null}
        </div>
      </div>
    </div>
  );
}
