export type HistoricalImportQuality = {
  import_batch_id: string;
  data_quality_status: string;
  data_quality_label: string;
  data_quality_color: string;
  data_quality_notes: string;
};

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function readHistoricalImportQuality(metadata: unknown): HistoricalImportQuality | null {
  const metadataObject = toObject(metadata);
  const historicalImport = toObject(metadataObject.historical_import);
  const status = normalizeString(historicalImport.data_quality_status);
  const label = normalizeString(historicalImport.data_quality_label);
  const color = normalizeString(historicalImport.data_quality_color);
  const batchId = normalizeString(historicalImport.import_batch_id);
  const notes = normalizeString(historicalImport.data_quality_notes);

  if (!status && !label && !color && !batchId && !notes) {
    return null;
  }

  return {
    import_batch_id: batchId,
    data_quality_status: status,
    data_quality_label: label,
    data_quality_color: color,
    data_quality_notes: notes,
  };
}
