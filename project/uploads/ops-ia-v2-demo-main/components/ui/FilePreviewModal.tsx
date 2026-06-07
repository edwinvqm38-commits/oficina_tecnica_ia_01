"use client";

import type { ResourceFileMeta } from "@/lib/demoData";
import { FieldLabelIcon } from "@/components/ui/FieldLabelIcon";

type FilePreviewModalProps = {
  open: boolean;
  title: string;
  files: ResourceFileMeta[];
  onClose: () => void;
};

function sizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function isImage(file: ResourceFileMeta): boolean {
  return file.type.startsWith("image/");
}

function isPdf(file: ResourceFileMeta): boolean {
  return file.type.includes("pdf");
}

function isPreviewSupported(file: ResourceFileMeta): boolean {
  const ext = fileExtension(file.name);
  if (["zip", "rar", "7z", "tar", "gz", "html", "htm"].includes(ext)) return false;
  if (isImage(file) || isPdf(file)) return true;
  if (["doc", "docx", "txt", "rtf", "csv", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return true;
  return Boolean(file.type && !file.type.includes("zip") && !file.type.includes("html"));
}

function fileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function fileIcon(extension: string) {
  if (["jpg", "jpeg", "png", "webp"].includes(extension)) return "image" as const;
  if (extension === "pdf") return "file-text" as const;
  if (["xls", "xlsx"].includes(extension)) return "table" as const;
  if (["zip", "rar"].includes(extension)) return "archive" as const;
  if (["dwg", "dxf", "cad"].includes(extension)) return "file-cog" as const;
  if (["doc", "docx", "txt"].includes(extension)) return "file-type" as const;
  return "paperclip" as const;
}

export function FilePreviewModal({ open, title, files, onClose }: FilePreviewModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/30 p-4">
      <div className="mx-auto flex h-[70vh] max-h-[70vh] w-[min(860px,95vw)] flex-col overflow-hidden rounded-lg border border-border bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="inline-flex items-center gap-1.5">
            <FieldLabelIcon icon="paperclip" label={title} />
          </div>
          <button onClick={onClose} className="rounded border border-border px-2 py-0.5 text-xs">
            Cerrar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {files.length === 0 ? (
            <p className="text-xs text-muted">Sin archivo para vista previa.</p>
          ) : (
            <div className="space-y-3">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabelIcon icon={fileIcon(fileExtension(file.name))} label={file.name} className="min-w-0 truncate" />
                    {isPreviewSupported(file) && (file.localPreviewUrl || file.futureDriveUrl) ? (
                      <a
                        href={file.localPreviewUrl || file.futureDriveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-stone-100"
                      >
                        Vista previa
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="rounded border border-border px-2 py-0.5 text-[11px] text-muted opacity-60"
                      >
                        No compatible
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {file.type || "tipo no definido"} · {sizeLabel(file.size)}
                  </p>
                  {isImage(file) && file.localPreviewUrl ? (
                    <img src={file.localPreviewUrl} alt={file.name} className="mt-2 max-h-56 rounded border border-border object-contain" />
                  ) : null}
                  {isPdf(file) && file.localPreviewUrl ? (
                    <iframe title={file.name} src={file.localPreviewUrl} className="mt-2 h-56 w-full rounded border border-border" />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
