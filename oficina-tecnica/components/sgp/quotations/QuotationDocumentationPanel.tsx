"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { FieldLabelIcon } from "@/components/sgp/ui/FieldLabelIcon";
import { authFetch } from "@/lib/api/authFetch";
import {
  QUOTATION_DOCUMENT_TARGETS,
  type QuotationDocumentTarget,
} from "@/lib/googleDrive/quotationFolderStructure";
import type { Cotizacion, Requerimiento } from "@/lib/sgp/demoData";

export type QuotationDocumentRecord = {
  id: string;
  quotation_id: string | null;
  quotation_code: string;
  requirement_id: string | null;
  requirement_code: string | null;
  folder_key: string;
  folder_name: string;
  drive_folder_id: string;
  drive_file_id: string;
  drive_file_url: string;
  original_name: string;
  drive_name: string;
  mime_type: string | null;
  file_size: number;
  document_type: string;
  uploaded_by_email: string | null;
  uploaded_at: string;
};

type PendingQuotationDocument = {
  localId: string;
  file: File;
  folderKey: string;
  folderLabel: string;
  requirementId: string;
  requirementCode: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  error?: string;
};

export type QuotationDocumentationPanelHandle = {
  uploadPending: (quotation: Cotizacion) => Promise<boolean>;
  hasPending: () => boolean;
};

type QuotationDocumentationPanelProps = {
  quotation: Cotizacion;
  requerimientos: Requerimiento[];
  enabled: boolean;
  onPendingCountChange?: (count: number) => void;
};

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function targetSortWeight(target: QuotationDocumentTarget): number {
  const order = QUOTATION_DOCUMENT_TARGETS.findIndex((item) => item.key === target.key);
  return order < 0 ? 999 : order;
}

function buildLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const QuotationDocumentationPanel = forwardRef<QuotationDocumentationPanelHandle, QuotationDocumentationPanelProps>(
  function QuotationDocumentationPanel({ quotation, requerimientos, enabled, onPendingCountChange }, ref) {
    const [documents, setDocuments] = useState<QuotationDocumentRecord[]>([]);
    const [pending, setPending] = useState<PendingQuotationDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [requirementTarget, setRequirementTarget] = useState("");
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const quotationCode = quotation.codigo.trim();
    const relatedRequirements = useMemo(
      () =>
        requerimientos
          .filter((rq) => rq.cotizacion_id === quotation.id || rq.cotizacion_codigo === quotation.codigo)
          .sort((a, b) => a.codigo.localeCompare(b.codigo)),
      [quotation.codigo, quotation.id, requerimientos],
    );

    const groupedDocuments = useMemo(() => {
      const groups: Record<string, QuotationDocumentRecord[]> = {};
      for (const doc of documents) {
        groups[doc.folder_key] = groups[doc.folder_key] ?? [];
        groups[doc.folder_key].push(doc);
      }
      return groups;
    }, [documents]);

    const pendingCount = pending.filter((item) => item.status !== "uploaded").length;

    useEffect(() => {
      onPendingCountChange?.(pendingCount);
    }, [onPendingCountChange, pendingCount]);

    useEffect(() => {
      if (!quotationCode) return;
      let cancelled = false;
      setLoading(true);
      setMessage(null);
      authFetch(`/api/drive/quotation-documents?quotationCode=${encodeURIComponent(quotationCode)}`)
        .then(async (response) => {
          const json = await response.json();
          if (!response.ok) throw new Error(json.error || "No se pudieron cargar documentos.");
          if (!cancelled) setDocuments((json.documents ?? []) as QuotationDocumentRecord[]);
        })
        .catch((error) => {
          if (!cancelled) setMessage(error instanceof Error ? error.message : "No se pudieron cargar documentos.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [quotationCode]);

    function addFiles(target: QuotationDocumentTarget, files: FileList | File[]) {
      if (!enabled) {
        setMessage("No tienes permiso para subir documentos en esta cotización.");
        return;
      }
      const fileList = Array.from(files);
      if (fileList.length === 0) return;
      const selectedRq = relatedRequirements.find((rq) => rq.codigo === requirementTarget);
      setPending((prev) => [
        ...prev,
        ...fileList.map((file) => ({
          localId: buildLocalId(),
          file,
          folderKey: target.key,
          folderLabel: target.label,
          requirementId: target.key === "requirements" ? selectedRq?.id ?? "" : "",
          requirementCode: target.key === "requirements" ? selectedRq?.codigo ?? "" : "",
          status: "pending" as const,
        })),
      ]);
      setMessage(null);
    }

    function handleInput(target: QuotationDocumentTarget, event: ChangeEvent<HTMLInputElement>) {
      if (event.target.files) addFiles(target, event.target.files);
      event.target.value = "";
    }

    function handleDrop(target: QuotationDocumentTarget, event: DragEvent<HTMLDivElement>) {
      event.preventDefault();
      addFiles(target, event.dataTransfer.files);
    }

    function removePending(localId: string) {
      setPending((prev) => prev.filter((item) => item.localId !== localId));
    }

    async function uploadOne(item: PendingQuotationDocument, savedQuotation: Cotizacion): Promise<QuotationDocumentRecord> {
      const form = new FormData();
      form.append("file", item.file);
      form.append("quotationCode", savedQuotation.codigo);
      form.append("quotationId", savedQuotation.id);
      form.append("folderKey", item.folderKey);
      if (item.requirementId) form.append("requirementId", item.requirementId);
      if (item.requirementCode) form.append("requirementCode", item.requirementCode);

      const response = await authFetch("/api/drive/quotation-documents/upload", {
        method: "POST",
        body: form,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo subir el archivo.");
      return json.document as QuotationDocumentRecord;
    }

    useImperativeHandle(ref, () => ({
      hasPending: () => pending.some((item) => item.status === "pending" || item.status === "error"),
      uploadPending: async (savedQuotation: Cotizacion) => {
        const uploadables = pending.filter((item) => item.status === "pending" || item.status === "error");
        if (uploadables.length === 0) return true;
        let allOk = true;
        const uploadedDocs: QuotationDocumentRecord[] = [];

        for (const item of uploadables) {
          setPending((prev) => prev.map((row) => (row.localId === item.localId ? { ...row, status: "uploading", error: undefined } : row)));
          try {
            const uploaded = await uploadOne(item, savedQuotation);
            uploadedDocs.push(uploaded);
            setPending((prev) => prev.map((row) => (row.localId === item.localId ? { ...row, status: "uploaded" } : row)));
          } catch (error) {
            allOk = false;
            const errorMessage = error instanceof Error ? error.message : "No se pudo subir el archivo.";
            setPending((prev) =>
              prev.map((row) => (row.localId === item.localId ? { ...row, status: "error", error: errorMessage } : row)),
            );
          }
        }

        if (uploadedDocs.length > 0) {
          setDocuments((prev) => [...uploadedDocs, ...prev]);
          setPending((prev) => prev.filter((item) => item.status !== "uploaded"));
        }
        setMessage(allOk ? "Documentos subidos y auditados correctamente." : "Algunos documentos no se pudieron subir. Revisa los pendientes.");
        return allOk;
      },
    }), [pending, quotationCode]);

    return (
      <div className="mt-1 flex min-h-0 flex-1 flex-col rounded border border-border bg-white">
        <div className="flex items-center justify-between border-b border-border px-2 py-1">
          <div className="text-[11px] font-semibold text-stone-700">Documentación Drive</div>
          <div className="text-[10px] text-stone-500">
            {loading ? "Cargando..." : `${documents.length} archivo(s) registrados`}
          </div>
        </div>
        {message ? (
          <div className="mx-2 mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
            {message}
          </div>
        ) : null}
        <div className="app-table-scroll min-h-0 flex-1 space-y-2 overflow-auto p-2">
          {QUOTATION_DOCUMENT_TARGETS.slice().sort((a, b) => targetSortWeight(a) - targetSortWeight(b)).map((target) => {
            const targetDocs = groupedDocuments[target.key] ?? [];
            const targetPending = pending.filter((item) => item.folderKey === target.key);
            return (
              <section key={target.key} className="rounded border border-stone-200 bg-stone-50/50">
                <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-2 py-1">
                  <FieldLabelIcon icon="files" label={target.label} className="min-w-0 truncate text-[11px] font-medium text-stone-700" />
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] text-stone-500">
                    {targetDocs.length + targetPending.length}
                  </span>
                </div>
                {target.key === "requirements" && relatedRequirements.length > 0 ? (
                  <div className="border-b border-stone-200 px-2 py-1">
                    <select
                      value={requirementTarget}
                      onChange={(event) => setRequirementTarget(event.target.value)}
                      className="h-6 w-full rounded border border-stone-300 bg-white px-2 text-[11px] text-stone-700"
                    >
                      <option value="">General: 03_REQUERIMIENTOS</option>
                      {relatedRequirements.map((rq) => (
                        <option key={rq.id} value={rq.codigo}>
                          {rq.codigo}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(target, event)}
                  className={`m-2 rounded border border-dashed px-2 py-2 text-[11px] ${
                    enabled ? "border-stone-300 bg-white text-stone-600" : "border-stone-200 bg-stone-100 text-stone-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>Arrastra archivos aquí o selecciónalos desde tu PC.</span>
                    <button
                      type="button"
                      disabled={!enabled}
                      onClick={() => inputRefs.current[target.key]?.click()}
                      className="rounded border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Agregar
                    </button>
                  </div>
                  <input
                    ref={(node) => {
                      inputRefs.current[target.key] = node;
                    }}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => handleInput(target, event)}
                    disabled={!enabled}
                  />
                </div>
                <div className="space-y-1 px-2 pb-2">
                  {targetPending.map((item) => (
                    <div key={item.localId} className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium" title={item.file.name}>
                          {item.file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePending(item.localId)}
                          disabled={item.status === "uploading"}
                          className="text-stone-500 hover:text-rose-700 disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      </div>
                      <div className="mt-0.5 text-amber-700">
                        {item.status === "uploading" ? "Subiendo..." : item.status === "error" ? item.error : `Pendiente · ${formatFileSize(item.file.size)}`}
                      </div>
                    </div>
                  ))}
                  {targetDocs.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.drive_file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded border border-stone-200 bg-white px-2 py-1 text-[10px] text-stone-600 hover:border-sky-200 hover:text-sky-700"
                    >
                      <div className="truncate font-medium" title={doc.original_name}>
                        {doc.original_name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-stone-400">
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>{formatUploadedAt(doc.uploaded_at)}</span>
                        {doc.requirement_code ? <span>RQ: {doc.requirement_code}</span> : null}
                      </div>
                    </a>
                  ))}
                  {targetDocs.length === 0 && targetPending.length === 0 ? (
                    <div className="rounded bg-white px-2 py-1 text-[10px] text-stone-400">Sin archivos registrados.</div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  },
);
