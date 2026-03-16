
export type ToolId = 
  | 'jpg-to-pdf' 
  | 'word-to-pdf' 
  | 'pdf-to-jpg' 
  | 'compress-pdf' 
  | 'excel-to-pdf' 
  | 'clean-excel' 
  | 'duplicate-remover' 
  | 'pdf-img-to-excel' 
  | 'ai-menu-fixer'
  | 'ai-data-translator'
  | 'ai-document-summary'
  | 'menu-qa-lab'
  | 'pdf-to-excel'
  | 'pdf-menu-architect';

export type ErrorCategory = 'Network' | 'Rate Limit (429)' | 'Schema' | 'Content Safety' | 'Internal' | 'N/A';

export interface Tool {
  id: ToolId;
  title: string;
  description: string;
  icon: string;
  category: 'PDF' | 'Data' | 'AI';
  accept: string;
  multiple?: boolean;
  color: string;
}

export interface ProcessingState {
  status: 'idle' | 'processing' | 'success' | 'error';
  message: string;
  details?: string;
  resultBlob?: Blob;
  resultFilename?: string;
}

export interface DuplicateOptions {
  criteria: 'row' | 'col1';
  mode: 'highlight' | 'remove';
}

export type CompressionLevel = 'Standard' | 'High' | 'Maximum';

export interface OCRConfig {
  language: string;
}

export interface ApiLog {
  id: string;
  timestamp: number;
  tool: string;
  model: string;
  status: 'success' | 'error';
  errorCategory: ErrorCategory;
  latency: number;
  fileCount: number;
  fileFormats: string[];
  errorMessage?: string;
  isAlert?: boolean;
  // Dynamic Ops Metrics
  inputTokens?: number;
  outputTokens?: number;
  accuracyScore?: number;
  languageAlert?: string;
}

export interface AdminSettings {
  alertEmail: string;
  threshold: number;
  lastAlertSent?: number;
}
