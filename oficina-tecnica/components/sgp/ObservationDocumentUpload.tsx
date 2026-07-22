"use client";

type ObservationDocumentUploadProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  isUploading?: boolean;
  onAttachFiles: (files: File[]) => void | Promise<void>;
};

type LocalEvidencePickerProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
};

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function LocalEvidencePicker({
  files,
  onFilesChange,
  label = "Seleccionar evidencias",
  helperText = "PDF, imágenes, Excel, Word u otros documentos de evidencia",
  disabled = false,
}: LocalEvidencePickerProps) {
  return (
    <div className="space-y-2">
      <label className="flex min-h-[96px] cursor-pointer flex-col items-center justify-center rounded border border-dashed border-stone-300 bg-white px-3 py-4 text-center hover:bg-stone-50">
        <span className="text-[11px] font-semibold text-stone-700">{label}</span>
        <span className="mt-1 text-[10.5px] text-stone-500">{helperText}</span>
        <input
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            const selectedFiles = Array.from(event.target.files ?? []);
            if (selectedFiles.length === 0) return;
            onFilesChange([...files, ...selectedFiles]);
            event.target.value = "";
          }}
        />
      </label>
      {files.length ? (
        <div className="max-h-[120px] overflow-auto rounded border border-stone-200 bg-stone-50">
          {files.map((file, index) => (
            <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-2 border-b border-stone-100 px-2 py-1.5 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-stone-700" title={file.name}>
                  {file.name}
                </p>
                <p className="text-[10px] text-stone-500">
                  {file.type || "archivo"} · {formatFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}
                className="shrink-0 rounded border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-stone-600 hover:bg-stone-100"
              >
                Retirar
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ObservationDocumentUpload({
  open,
  title,
  onClose,
  isUploading = false,
  onAttachFiles,
}: ObservationDocumentUploadProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-[520px] rounded-lg border border-border bg-panel p-3 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-semibold text-stone-800">{title}</p>
            <p className="text-[10.5px] text-stone-500">Evidencia local para preview: no se escribe en base de datos ni se sube a Drive.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-stone-200 px-2 py-1 text-[11px] text-stone-600 hover:bg-stone-100"
          >
            Cerrar
          </button>
        </div>
        <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded border border-dashed border-stone-300 bg-white px-4 py-6 text-center hover:bg-stone-50">
          <span className="text-[12px] font-semibold text-stone-700">
            {isUploading ? "Registrando archivos..." : "Seleccionar archivos"}
          </span>
          <span className="mt-1 text-[11px] text-stone-500">PDF, imágenes, Excel, Word u otros documentos de evidencia</span>
          <input
            type="file"
            multiple
            className="hidden"
            disabled={isUploading}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length === 0) return;
              void onAttachFiles(files);
              event.target.value = "";
            }}
          />
        </label>
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
          {isUploading
            ? "Registrando evidencia local en memoria..."
            : "Los archivos quedan asociados localmente a la observación o respuesta. No se integró Google Drive en esta fase."}
        </div>
      </div>
    </div>
  );
}

export { formatFileSize };
