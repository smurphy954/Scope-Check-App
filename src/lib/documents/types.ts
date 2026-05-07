export const DOCUMENT_TYPES = ["drawing", "contract", "submittal"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  drawing: "Drawings",
  contract: "Contracts / Scopes",
  submittal: "Submittals",
};

export const DOCUMENT_TYPE_LABEL_SINGULAR: Record<DocumentType, string> = {
  drawing: "Drawing",
  contract: "Contract / Scope",
  submittal: "Submittal",
};

export type ExtractionStatus = "queued" | "processing" | "ready" | "failed";

export type Document = {
  id: string;
  project_id: string;
  type: DocumentType;
  filename: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  page_count: number | null;
  extraction_status: ExtractionStatus;
  extraction_error: string | null;
  extraction_started_at: string | null;
  extraction_completed_at: string | null;
  created_at: string;
};

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
