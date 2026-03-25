export interface QualityResult {
  quality: string;
  confidence: number;
}

export interface DrResult {
  dr_class: string;
  confidence: number;
  gradcam?: string;
  etdrs_score?: number;
  etdrs_label?: string;
  etdrs_description?: string;
  file_name?: string;
  file_path?: string;
}

export interface PredictResponse {
  quality: QualityResult;
  message?: string;
  dr_result?: DrResult;
  raw?: unknown;
}

export interface ProcessedFile {
  file_name: string;
  file_path: string;
  url: string;
}

export interface ProcessedFilesResponse {
  files: ProcessedFile[];
}
