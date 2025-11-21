export interface PdfFile {
  file: File;
  name: string;
  url: string;
  numPages: number;
}

export interface ChangeRecord {
  id: string;
  type: 'addition' | 'deletion' | 'modification';
  severity: 'low' | 'medium' | 'high';
  description: string;
  section: string; // e.g., "Line 12", "Header"
  // Deprecated single box, keeping for backward compat but preferring boundingBoxes
  boundingBox?: number[]; 
  // New: Support multiple precise rects for a single logical change
  boundingBoxes?: number[][]; // Array of [ymin, xmin, ymax, xmax]
  
  // New: Textual proof
  originalText?: string;
  revisedText?: string;
}

export interface ComparisonResult {
  summary: string;
  changes: ChangeRecord[];
  pageNumber: number;
  oldPageMarkdown?: string;
  newPageMarkdown?: string;
}

export enum ViewMode {
  SIDE_BY_SIDE = 'SIDE_BY_SIDE',
  OVERLAY = 'OVERLAY',
  MARKDOWN = 'MARKDOWN'
}

export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
  results: Record<number, ComparisonResult>; // Key is page number
  // Partial results for streaming
  partialResults?: Record<number, {
    oldMarkdown?: string;
    newMarkdown?: string;
    isTranscribing?: boolean;
    isAnalyzing?: boolean;
  }>;
}

export interface DiffRegion {
  id: string;
  boundingBox: number[]; // [ymin, xmin, ymax, xmax] 0-100 scale
}