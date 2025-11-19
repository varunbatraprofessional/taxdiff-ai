export interface PdfFile {
  file: File;
  name: string;
  url: string;
  numPages: number;
}

export interface ChangeRecord {
  id: string;
  type: 'addition' | 'deletion' | 'modification' | 'layout';
  severity: 'low' | 'medium' | 'high';
  description: string;
  section: string; // e.g., "Line 12", "Header"
  // Deprecated single box, keeping for backward compat but preferring boundingBoxes
  boundingBox?: number[]; 
  // New: Support multiple precise rects for a single logical change
  boundingBoxes?: number[][]; // Array of [ymin, xmin, ymax, xmax]
}

export interface ComparisonResult {
  summary: string;
  changes: ChangeRecord[];
  pageNumber: number;
}

export enum ViewMode {
  SIDE_BY_SIDE = 'SIDE_BY_SIDE',
  OVERLAY = 'OVERLAY',
  DIFF_MASK = 'DIFF_MASK'
}

export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
  results: Record<number, ComparisonResult>; // Key is page number
}

export interface DiffRegion {
  id: string;
  boundingBox: number[]; // [ymin, xmin, ymax, xmax] 0-100 scale
}