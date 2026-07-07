"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import type { ResourceFileMeta, ResourceFiles } from "@/lib/sgp/demoData";
import { FieldLabelIcon } from "@/components/sgp/ui/FieldLabelIcon";

type ResourceFileCategory = "image" | "datasheet" | "attachment" | "quotation";

type ResourceFilesPanelProps = {
  value: ResourceFiles;
  onChange: (value: ResourceFiles) => void;
  onValidationError?: (message: string | null) => void;
  layout?: "row" | "stack";
  readOnly?: boolean;
  allowFilePicker?: boolean;
  onUploadFile?: (category: ResourceFileCategory, file: File) => Promise<ResourceFileMeta>;
  onOpenFile?: (file: ResourceFileMeta) => Promise<void> | void;
  onResolveFileUrl?: (file: ResourceFileMeta) => Promise<string | null>;
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
  onUploadFile,
  onOpenFile,
  onResolveFileUrl,
}: ResourceFilesPanelProps) {
  const fichasTecnicas = useMemo(
    () => value.fichasTecnicas ?? (value.fichaTecnica ? [value.fichaTecnica] : []),
    [value.fichaTecnica, value.fichasTecnicas],
  );
  const imagenes = useMemo(
    () => value.imagenes ?? (value.imagen ? [value.imagen] : []),
    [value.imagen, value.imagenes],
  );
  const cotizaciones = useMemo(
    () => value.cotizaciones ?? (value.cotizacion ? [value.cotizacion] : []),
    [value.cotizacion, value.cotizaciones],
  );
  const [fichaReference, setFichaReference] = useState("");
  const [imagenReference, setImagenReference] = useState("");
  const [cotizacionReference, setCotizacionReference] = useState("");
  const [archivoReference, setArchivoReference] = useState("");
  const [uploading, setUploading] = useState<ResourceFileCategory | null>(null);
  const [dragOver, setDragOver] = useState<ResourceFileCategory | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  function mergedSummary(list: ResourceFileMeta[], emptyText: string, singularText: string, pluralText: string): string {
    if (list.length === 0) return emptyText;
    if (list.length === 1) return `1 ${singularText}`;
    return `${list.length} ${pluralText}`;
  }

  function compactList(list: ResourceFileMeta[]): ResourceFileMeta[] {
    return list.slice(0, 3);
  }

  async function filesToMeta(category: ResourceFileCategory, files: FileList | null): Promise<ResourceFileMeta[]> {
    if (!files || readOnly || !allowFilePicker) return [];
    const selected = Array.from(files);
    if (!selected.length) return [];
    if (!onUploadFile) return selected.map(toMeta);

    setUploading(category);
    try {
      const uploaded: ResourceFileMeta[] = [];
      for (const file of selected) {
        uploaded.push(await onUploadFile(category, file));
      }
      return uploaded;
    } catch (error) {
      onValidationError?.(error instanceof Error ? error.message : "No se pudo subir el archivo.");
      return [];
    } finally {
      setUploading(null);
    }
  }

  async function updateFichas(files: FileList | null) {
    const mapped = await filesToMeta("datasheet", files);
    if (!mapped.length) return;
    const next = [...fichasTecnicas, ...mapped];
    onValidationError?.(null);
    onChange({
      ...value,
      fichaTecnica: next[0] ?? null,
      fichasTecnicas: next,
    });
  }

  async function updateImagenes(files: FileList | null) {
    const mapped = await filesToMeta("image", files);
    if (!mapped.length) return;
    const next = [...imagenes, ...mapped];
    onValidationError?.(null);
    onChange({
      ...value,
      imagen: next[0] ?? null,
      imagenes: next,
    });
  }

  async function addFiles(files: FileList | null) {
    const mapped = await filesToMeta("attachment", files);
    if (!mapped.length) return;
    onValidationError?.(null);
    onChange({ ...value, archivos: [...value.archivos, ...mapped] });
  }

  async function updateCotizaciones(files: FileList | null) {
    const mapped = await filesToMeta("quotation", files);
    if (!mapped.length) return;
    const next = [...cotizaciones, ...mapped];
    onValidationError?.(null);
    onChange({
      ...value,
      cotizacion: next[0] ?? null,
      cotizaciones: next,
    });
  }

  async function handleDrop(category: ResourceFileCategory, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(null);
    if (readOnly || !allowFilePicker) return;
    const files = event.dataTransfer.files;
    if (!files?.length) return;
    if (category === "datasheet") {
      await updateFichas(files);
    } else if (category === "image") {
      await updateImagenes(files);
    } else if (category === "quotation") {
      await updateCotizaciones(files);
    } else {
      await addFiles(files);
    }
  }

  function dropZoneClass(category: ResourceFileCategory): string {
    return `flex min-h-[126px] flex-col rounded-md border p-2 transition ${
      dragOver === category
        ? "border-teal-500 bg-teal-50"
        : "border-border bg-stone-50/50"
    }`;
  }

  function dropZoneHandlers(category: ResourceFileCategory) {
    return {
      onDragOver: (event: DragEvent<HTMLDivElement>) => {
        if (readOnly || !allowFilePicker) return;
        event.preventDefault();
        setDragOver(category);
      },
      onDragLeave: () => setDragOver((current) => (current === category ? null : current)),
      onDrop: (event: DragEvent<HTMLDivElement>) => void handleDrop(category, event),
    };
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

  function removeCotizacionAt(index: number) {
    if (readOnly) return;
    const next = cotizaciones.filter((_, idx) => idx !== index);
    onChange({
      ...value,
      cotizacion: next[0] ?? null,
      cotizaciones: next,
    });
  }

  function firstPreviewImage(list: ResourceFileMeta[]): ResourceFileMeta | null {
    return list.find((item) => item.type.startsWith("image/") && Boolean(item.localPreviewUrl || item.futureDriveUrl)) ?? null;
  }

  async function openFile(file: ResourceFileMeta) {
    try {
      if (onOpenFile) {
        await onOpenFile(file);
        return;
      }
      const url = file.localPreviewUrl || file.futureDriveUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      onValidationError?.(error instanceof Error ? error.message : "No se pudo abrir el archivo.");
    }
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

  function addCotizacionReference() {
    const meta = toReferenceMeta(cotizacionReference);
    if (!meta || readOnly) return;
    const next = [...cotizaciones, meta];
    onValidationError?.(null);
    onChange({ ...value, cotizacion: next[0] ?? null, cotizaciones: next });
    setCotizacionReference("");
  }

  useEffect(() => {
    let active = true;
    const first = imagenes.find((item) => item.type.startsWith("image/") || item.file_type === "image") ?? null;
    setPreviewImageUrl(first?.localPreviewUrl || first?.futureDriveUrl || null);
    if (!first || first.localPreviewUrl || first.futureDriveUrl || !onResolveFileUrl) return;
    void onResolveFileUrl(first)
      .then((url) => {
        if (active) setPreviewImageUrl(url);
      })
      .catch(() => {
        if (active) setPreviewImageUrl(null);
      });
    return () => {
      active = false;
    };
  }, [imagenes, onResolveFileUrl]);

  return (
    <div className={layout === "stack" ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 gap-2 xl:grid-cols-4"}>
      <div className={dropZoneClass("datasheet")} {...dropZoneHandlers("datasheet")}>
        <FieldLabelIcon icon="file-text" label="Ficha técnica" className="mb-2 text-[11px] font-medium text-stone-700" />
        {allowFilePicker && !readOnly ? <p className="mb-1 text-[10px] text-stone-500">Arrastra PDFs/fichas aqui o selecciona desde tu PC.</p> : null}
        {allowFilePicker && !readOnly ? (
        <label className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border bg-white px-2 text-[11px] text-stone-700 hover:bg-stone-100">
          {uploading === "datasheet" ? "Subiendo..." : "Agregar fichas"}
          <input
            type="file"
            multiple
            accept="*/*"
            className="hidden"
            onChange={(event) => {
              void updateFichas(event.target.files);
              event.currentTarget.value = "";
            }}
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
                    onClick={() => void openFile(file)}
                    disabled={!file.localPreviewUrl && !file.futureDriveUrl && !file.futureDriveFileId}
                  >
                    Abrir
                  </button>
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

      <div className={dropZoneClass("image")} {...dropZoneHandlers("image")}>
        <FieldLabelIcon icon="image" label="Imagen" className="mb-2 text-[11px] font-medium text-stone-700" />
        {allowFilePicker && !readOnly ? <p className="mb-1 text-[10px] text-stone-500">Arrastra imagenes aqui o selecciona desde tu PC.</p> : null}
        {allowFilePicker && !readOnly ? (
        <label className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border bg-white px-2 text-[11px] text-stone-700 hover:bg-stone-100">
          {uploading === "image" ? "Subiendo..." : "Agregar imágenes"}
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void updateImagenes(event.target.files);
              event.currentTarget.value = "";
            }}
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
            {previewImageUrl || firstPreviewImage(imagenes) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImageUrl || firstPreviewImage(imagenes)?.localPreviewUrl || firstPreviewImage(imagenes)?.futureDriveUrl}
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
                      onClick={() => void openFile(file)}
                      disabled={!file.localPreviewUrl && !file.futureDriveUrl && !file.futureDriveFileId}
                  >
                    Abrir
                  </button>
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

      <div className={dropZoneClass("quotation")} {...dropZoneHandlers("quotation")}>
        <FieldLabelIcon icon="file-text" label="Cotización" className="mb-2 text-[11px] font-medium text-stone-700" />
        {allowFilePicker && !readOnly ? <p className="mb-1 text-[10px] text-stone-500">Arrastra cotizaciones aqui o selecciona desde tu PC.</p> : null}
        {allowFilePicker && !readOnly ? (
        <label className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border bg-white px-2 text-[11px] text-stone-700 hover:bg-stone-100">
          {uploading === "quotation" ? "Subiendo..." : "Agregar cotización"}
          <input
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.doc,.docx,.eml,.msg,image/*,*/*"
            className="hidden"
            onChange={(event) => {
              void updateCotizaciones(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
        ) : null}
        {!readOnly ? (
          <div className="flex gap-1">
            <input
              value={cotizacionReference}
              onChange={(event) => setCotizacionReference(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCotizacionReference();
                }
              }}
              className="h-7 min-w-0 flex-1 rounded-md border border-border bg-white px-2 text-[11px] outline-none"
              placeholder="URL o ID de cotización"
            />
            <button type="button" onClick={addCotizacionReference} className="h-7 rounded border border-border px-2 text-[11px] hover:bg-stone-100">
              Agregar
            </button>
          </div>
        ) : null}
        <div className="mt-2 text-[11px] text-stone-500">
          {mergedSummary(cotizaciones, "Sin cotizaciones seleccionadas", "cotización seleccionada", "cotizaciones seleccionadas")}
        </div>
        {cotizaciones.length > 0 ? (
          <div className="mt-2 rounded border border-border bg-white p-2 text-[11px]">
            {compactList(cotizaciones).map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="mb-1 last:mb-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 flex-1 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <button
                    className="inline-flex h-5 shrink-0 items-center rounded border border-border px-1.5 text-[10px] text-stone-600 hover:bg-stone-100"
                    type="button"
                    onClick={() => void openFile(file)}
                    disabled={!file.localPreviewUrl && !file.futureDriveUrl && !file.futureDriveFileId}
                  >
                    Abrir
                  </button>
                  <button
                    className="inline-flex h-5 shrink-0 items-center rounded border border-border px-1.5 text-[10px] text-stone-600 hover:bg-stone-100"
                    type="button"
                    onClick={() => removeCotizacionAt(idx)}
                    disabled={readOnly}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
            {cotizaciones.length > 3 ? <p className="text-[10px] text-stone-500">+{cotizaciones.length - 3} más</p> : null}
          </div>
        ) : null}
      </div>

      <div className={dropZoneClass("attachment")} {...dropZoneHandlers("attachment")}>
        <FieldLabelIcon icon="files" label="Archivos" className="mb-2 text-[11px] font-medium text-stone-700" />
        {allowFilePicker && !readOnly ? <p className="mb-1 text-[10px] text-stone-500">Arrastra documentos aqui o selecciona desde tu PC.</p> : null}
        {allowFilePicker && !readOnly ? (
        <label className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border bg-white px-2 text-[11px] text-stone-700 hover:bg-stone-100">
          {uploading === "attachment" ? "Subiendo..." : "Agregar archivos"}
          <input
            type="file"
            multiple
            accept="*/*"
            className="hidden"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
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
                onClick={() => void openFile(file)}
                disabled={!file.localPreviewUrl && !file.futureDriveUrl && !file.futureDriveFileId}
                >
                  Abrir
                </button>
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
