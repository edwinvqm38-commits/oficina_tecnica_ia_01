"use client";
// Client-side text extraction for chat attachments: plain/code text (incl.
// HTML), PDF (with OCR fallback for scanned pages), Word (.docx), and Excel
// (.xlsx/.xls).
// Heavy libraries are dynamically imported so they're only downloaded when a
// matching file type is actually attached.

const MAX_CHARS = 8000;
const MAX_CODE_CHARS = 80000;
const MAX_PDF_PAGES = 20;
const MAX_OCR_PAGES = 3;
const MAX_PDF_PREVIEW_PAGES = 3;

export type PdfPagePreview = { label: string; dataUrl: string };

export type ExtractProgress = (message: string) => void;

function truncate(text: string, maxChars = MAX_CHARS): string {
  return text.length > maxChars ? text.slice(0, maxChars) + "\n…(contenido truncado)" : text;
}

function textFileLabel(file: File): string {
  const name = file.name.toLowerCase();
  if (/\.html?$/.test(name) || file.type === "text/html") return "HTML";
  if (/\.css$/.test(name)) return "CSS";
  if (/\.(js|jsx|ts|tsx)$/.test(name)) return "Código";
  if (/\.sql$/.test(name)) return "SQL";
  if (/\.json$/.test(name)) return "JSON";
  if (/\.xml$/.test(name)) return "XML";
  if (/\.(md|markdown)$/.test(name)) return "Markdown";
  if (/\.csv$/.test(name)) return "CSV";
  return "Texto";
}

export async function extractFileContent(file: File, onProgress?: ExtractProgress): Promise<string> {
  const name = file.name.toLowerCase();
  const isText = file.type.startsWith("text/") ||
    /\.(txt|csv|md|json|xml|html?|log|py|ts|js|tsx|jsx|css|yaml|yml|toml|ini|conf|sql)$/.test(name);

  if (isText) {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const raw = String(e.target?.result ?? "");
        const label = textFileLabel(file);
        const maxChars = label === "HTML" || label === "Código" || label === "CSS" || label === "SQL" ? MAX_CODE_CHARS : MAX_CHARS;
        resolve(`[${label}: ${file.name}]\n${truncate(raw, maxChars)}`);
      };
      reader.readAsText(file, "utf-8");
    });
  }

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return extractPdf(file, onProgress);
  }

  if (name.endsWith(".docx")) {
    return extractDocx(file);
  }

  if (/\.(xlsx|xls)$/.test(name)) {
    return extractSpreadsheet(file);
  }

  if (file.type.startsWith("image/")) {
    return extractImageOcr(file, onProgress);
  }

  return `[Archivo: ${file.name} — ${file.type || "binario"}, ${Math.round(file.size / 1024)} KB — adjunto para referencia]`;
}

export async function renderPdfPagePreviews(file: File, onProgress?: ExtractProgress): Promise<PdfPagePreview[]> {
  const name = file.name.toLowerCase();
  if (!(file.type === "application/pdf" || name.endsWith(".pdf"))) return [];
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";

    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PREVIEW_PAGES);
    const previews: PdfPagePreview[] = [];

    for (let i = 1; i <= pageCount; i++) {
      onProgress?.(`Renderizando plano ${file.name}: página ${i}/${pageCount}…`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(Math.round(viewport.width), 1800);
      canvas.height = Math.min(Math.round(viewport.height), 1800);
      const scaleX = canvas.width / viewport.width;
      const scaleY = canvas.height / viewport.height;
      const safeViewport = page.getViewport({ scale: 1.2 * Math.min(scaleX, scaleY) });
      canvas.width = Math.round(safeViewport.width);
      canvas.height = Math.round(safeViewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvas, canvasContext: ctx, viewport: safeViewport }).promise;
      previews.push({
        label: `${file.name} página ${i}`,
        dataUrl: canvas.toDataURL("image/jpeg", 0.72),
      });
    }

    return previews;
  } catch {
    return [];
  }
}

async function extractPdf(file: File, onProgress?: ExtractProgress): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";

    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

    let text = "";
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
      text += pageText + "\n";
      if (text.length > MAX_CHARS) break;
    }
    text = text.replace(/[ \t]+/g, " ").trim();

    if (text.length > 60) {
      const suffix = pdf.numPages > pageCount ? ` (primeras ${pageCount} de ${pdf.numPages} pág.)` : ` — ${pdf.numPages} pág.`;
      return `[PDF: ${file.name}${suffix}]\n${truncate(text)}`;
    }

    // No extractable text → likely a scanned PDF, try OCR on the first pages.
    return await ocrPdf(pdf, file.name, onProgress);
  } catch (err) {
    return `[PDF: ${file.name} — error al leer: ${err instanceof Error ? err.message : "desconocido"}]`;
  }
}

async function ocrPdf(pdf: import("pdfjs-dist").PDFDocumentProxy, fileName: string, onProgress?: ExtractProgress): Promise<string> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("spa+eng");
    let text = "";
    const pageCount = Math.min(pdf.numPages, MAX_OCR_PAGES);
    for (let i = 1; i <= pageCount; i++) {
      onProgress?.(`OCR ${fileName}: página ${i}/${pageCount}…`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const { data } = await worker.recognize(canvas);
      text += data.text + "\n";
    }
    await worker.terminate();
    text = text.replace(/[ \t]+/g, " ").trim();
    return text.length > 30
      ? `[PDF (OCR): ${fileName} — primeras ${pageCount} de ${pdf.numPages} pág.]\n${truncate(text)}`
      : `[PDF: ${fileName} — ${pdf.numPages} pág. — sin texto extraíble (ni con OCR)]`;
  } catch (err) {
    return `[PDF: ${fileName} — ${pdf.numPages} pág. — sin texto extraíble; OCR falló: ${err instanceof Error ? err.message : "desconocido"}]`;
  }
}

async function extractDocx(file: File): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    const text = value.replace(/\n{3,}/g, "\n\n").trim();
    return text.length > 0
      ? `[Word: ${file.name}]\n${truncate(text)}`
      : `[Word: ${file.name} — vacío o sin texto extraíble]`;
  } catch (err) {
    return `[Word: ${file.name} — error al leer: ${err instanceof Error ? err.message : "desconocido"}]`;
  }
}

async function extractSpreadsheet(file: File): Promise<string> {
  try {
    const XLSX = await import("xlsx");
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    let out = "";
    for (const sheetName of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]).trim();
      if (!csv) continue;
      out += `--- Hoja: ${sheetName} ---\n${csv}\n\n`;
      if (out.length > MAX_CHARS) break;
    }
    out = out.trim();
    return out.length > 0
      ? `[Excel: ${file.name}]\n${truncate(out)}`
      : `[Excel: ${file.name} — sin datos legibles]`;
  } catch (err) {
    return `[Excel: ${file.name} — error al leer: ${err instanceof Error ? err.message : "desconocido"}]`;
  }
}

async function extractImageOcr(file: File, onProgress?: ExtractProgress): Promise<string> {
  try {
    onProgress?.(`OCR ${file.name}…`);
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("spa+eng");
    const { data } = await worker.recognize(file);
    await worker.terminate();
    const text = data.text.replace(/[ \t]+/g, " ").trim();
    return text.length > 0
      ? `[Imagen (OCR): ${file.name}]\n${truncate(text)}`
      : `[Imagen: ${file.name} — ${file.type || "imagen"}, ${Math.round(file.size / 1024)} KB — sin texto detectado]`;
  } catch (err) {
    return `[Imagen: ${file.name} — OCR falló: ${err instanceof Error ? err.message : "desconocido"}]`;
  }
}
