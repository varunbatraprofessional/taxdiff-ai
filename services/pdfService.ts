import * as pdfjsLib from 'pdfjs-dist';

// Explicitly set the worker source to the specific version matching the import map.
// We use the module worker (.mjs) for better compatibility with the ESM build.
// Note: We use unpkg here as it reliably exposes the build directory structure.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.394/build/pdf.worker.min.mjs`;

export const loadPdf = async (file: File): Promise<number> => {
  // Convert File/Blob to ArrayBuffer, then to Uint8Array for PDF.js
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  // Load the document
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  
  return pdf.numPages;
};

export const renderPageToImage = async (
  file: File,
  pageNumber: number,
  scale: number = 2.0 // Increased default scale for better AI legibility
): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Could not create canvas context');

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  // Cast params to any to bypass type definition mismatch (expecting 'canvas' vs 'canvasContext')
  await page.render({
    canvasContext: context,
    viewport: viewport,
  } as any).promise;

  // Return PNG for lossless quality (better for diffing)
  return canvas.toDataURL('image/png');
};