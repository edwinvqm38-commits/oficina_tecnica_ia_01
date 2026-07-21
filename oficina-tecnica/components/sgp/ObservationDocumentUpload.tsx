"use client";

type ObservationDocumentUploadProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  isUploading?: boolean;
  onAttachFiles: (files: File[]) => void | Promise<void>;
};

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
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
            <p className="text-[10.5px] text-stone-500">Evidencia Drive para preview: no se escribe en base de datos.</p>
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
            {isUploading ? "Subiendo archivos..." : "Seleccionar archivos"}
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
            ? "Subiendo evidencia a Google Drive..."
            : "Los archivos se subirán a Google Drive dentro de la carpeta del requerimiento. El historial queda en memoria hasta tener persistencia real."}
        </div>
      </div>
    </div>
  );
}

export { formatFileSize };
