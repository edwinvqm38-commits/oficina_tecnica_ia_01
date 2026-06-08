export type SourceType =
  | "budget"
  | "schedule"
  | "meeting-note"
  | "technical-report"
  | "management-note"
  | "policy"
  | "mock-document";

export type CitationConfidence = "high" | "medium" | "low" | "insufficient";

export type SourceExcerptPolicy = {
  canQuote: boolean;
  maxExcerptLength: number;
  requiresParaphrase: boolean;
  notes: string;
};

export type SourceReference = {
  id: string;
  title: string;
  sourceType: SourceType;
  simulated: boolean;
  dateLabel: string;
  owner: string;
  projectLabel: string;
  locationHint: string;
  confidence: CitationConfidence;
  excerptPolicy: SourceExcerptPolicy;
};
