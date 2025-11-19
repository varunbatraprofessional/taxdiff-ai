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
  boundingBox?: number[]; // [ymin, xmin, ymax, xmax] in percentages (0-100)
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