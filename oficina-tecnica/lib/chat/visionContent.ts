"use client";

import type { ChatContent } from "@/lib/llm/providers";
import type { FileAttachment } from "@/lib/chat/contextQuery";

const MAX_VISION_IMAGES = 4;
const MAX_DATA_URL_LENGTH = 2_800_000;

export function buildUserContentWithVision(text: string, attachments: FileAttachment[] = []): ChatContent {
  const directImages = attachments
    .filter((file) => file.type.startsWith("image/") && file.dataUrl && file.dataUrl.length <= MAX_DATA_URL_LENGTH)
    .map((file) => ({ label: file.name, dataUrl: file.dataUrl as string }));
  const pdfPageImages = attachments.flatMap((file) =>
    (file.previewImages ?? [])
      .filter((img) => img.dataUrl.length <= MAX_DATA_URL_LENGTH)
      .map((img) => ({ label: img.label, dataUrl: img.dataUrl }))
  );
  const images = [...directImages, ...pdfPageImages].slice(0, MAX_VISION_IMAGES);

  if (images.length === 0) return text;

  return [
    {
      type: "text",
      text: `${text}

El usuario adjunto imagen(es) o páginas PDF renderizadas en este turno: ${images.map((img) => img.label).join(", ")}.
Analiza visualmente solo estas imagenes actuales si el proveedor/modelo soporta vision. Si no puedes verlas o el OCR no alcanza para interpretar un plano, di exactamente qué falta y pide una versión más nítida, vectorial o con leyenda visible.`,
    },
    ...images.map((file) => ({
      type: "image_url" as const,
      image_url: { url: file.dataUrl },
    })),
  ];
}

export function buildVisionAttachmentNote(attachments: FileAttachment[] = []): string {
  const imageCount = attachments.filter((file) => file.type.startsWith("image/")).length;
  const pdfPreviewCount = attachments.reduce((sum, file) => sum + (file.previewImages?.length ?? 0), 0);
  const totalVisuals = imageCount + pdfPreviewCount;
  if (!totalVisuals) return "";
  return `\n\nVision: este turno incluye ${imageCount} imagen(es) y ${pdfPreviewCount} página(s) PDF renderizadas. Si el modelo/proveedor soporta vision, analízalas visualmente antes de responder. Para planos, cuadros de carga, diagramas unifilares o arquitectura:
- Trabaja con evidencia visible: primero lee la leyenda y arma un mapa "símbolo -> descripción"; luego cuenta solo símbolos, etiquetas o textos que realmente se vean en el plano actual.
- No inventes equipos típicos ni etiquetas genéricas como I1, C1, R1, M1, T1, etc. Solo úsalas si aparecen legibles en el plano o leyenda.
- Entrega "Leyenda identificada" y "Metrado observado" en tablas. La tabla de metrado debe incluir Item, Elemento/equipo/material, Símbolo/etiqueta visible, Cantidad, Ubicación/plano/zona, Confianza y Observación.
- Agrega "Elementos inferidos/no verificables" para lo que parezca probable pero no pueda confirmarse. Usa "No verificable" antes que adivinar.
- Si la imagen es borrosa, recortada, parcial o no muestra toda la hoja, declara "Alcance de lectura: página/recorte visible" y pide PDF vectorial, más resolución o recorte de la zona crítica.
- Si el usuario pide recrear el unifilar, usa Mermaid como esquema preliminar y marca supuestos.`;
}
