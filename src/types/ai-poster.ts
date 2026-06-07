export interface AiPosterSourceImage {
  bucket: string;
  path: string;
  url: string;
  fileName: string;
}

export interface AiPosterOptions {
  style: string;
  personFocus: string;
  tone: string;
  ratio: string;
  useRecommendedGeneration: boolean;
}

export interface AiPosterExtractedFields {
  summary: string;
  recruitDeadline: string | null;
  location: string | null;
  fee: string | null;
  contact: string | null;
}

export interface AiPosterPromptInput {
  title: string;
  content: string;
  sourceImageCount: number;
  options: AiPosterOptions;
}

export interface AiPosterPromptPayload {
  title: string;
  rawContent: string;
  promptText: string;
  sourceImageCount: number;
  options: AiPosterOptions;
  extractedFields: AiPosterExtractedFields;
}

export interface AiPosterRequestRecord extends AiPosterPromptPayload {
  id: string;
  user_id: string;
  status: "reviewed" | "submitted" | "generated" | "failed";
  source_images: AiPosterSourceImage[];
  generated_image_url: string | null;
  generated_storage_bucket: string | null;
  generated_storage_path: string | null;
  generated_at: string | null;
  error_code: string | null;
  error_message: string | null;
  error_detail: string | null;
  error_request_id: string | null;
  error_provider: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
}
