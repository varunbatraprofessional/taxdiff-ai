import { DiffRegion } from "../types";

// Helper to load an image from a data URL
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const drawDebugLabels = (
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number, 
  regions: DiffRegion[]
) => {
  ctx.lineWidth = 3;
  ctx.font = "bold 24px Arial";
  
  regions.forEach(reg => {
    const [ymin, xmin, ymax, xmax] = reg.boundingBox;
    const x = (xmin / 100) * width;
    const y = (ymin / 100) * height;
    const w = ((xmax - xmin) / 100) * width;
    const h = ((ymax - ymin) / 100) * height;

    // Draw Box
    ctx.strokeStyle = "red";
    ctx.strokeRect(x, y, w, h);

    // Draw Label Background
    ctx.fillStyle = "red";
    ctx.fillRect(x, y - 24, 40, 24);

    // Draw Label Text
    ctx.fillStyle = "white";
    ctx.fillText(reg.id, x + 5, y - 4);
  });
};

export const detectVisualDifferences = async (
  imageOldStr: string,
  imageNewStr: string
): Promise<{ regions: DiffRegion[]; diffImageOld: string; diffImageNew: string; maskImage: string }> => {
  const [img1, img2] = await Promise.all([loadImage(imageOldStr), loadImage(imageNewStr)]);

  const width = img1.width;
  const height = img1.height;

  // Create canvas for pixel manipulation
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas context creation failed");

  // Draw images and get data
  ctx.drawImage(img1, 0, 0);
  const data1 = ctx.getImageData(0, 0, width, height).data;

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img2, 0, 0);
  const data2 = ctx.getImageData(0, 0, width, height).data;

  // Grid configuration for clustering
  // We process the image in 'cells' to act as a low-pass filter and avoid pixel noise
  const CELL_SIZE = 20; 
  const cols = Math.ceil(width / CELL_SIZE);
  const rows = Math.ceil(height / CELL_SIZE);
  const grid = new Uint8Array(cols * rows); // 1 = changed, 0 = same

  // Prepare Mask Data (Transparent background, Magenta pixels for diffs)
  const maskImageData = ctx.createImageData(width, height);
  const maskData = maskImageData.data;

  // 1. Detect Changed Cells AND Build Pixel Mask
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let diffPixels = 0;
      const startY = r * CELL_SIZE;
      const startX = c * CELL_SIZE;
      const endY = Math.min(startY + CELL_SIZE, height);
      const endX = Math.min(startX + CELL_SIZE, width);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const i = (y * width + x) * 4;
          // Simple Euclidean distance in RGB space
          const rDiff = Math.abs(data1[i] - data2[i]);
          const gDiff = Math.abs(data1[i+1] - data2[i+1]);
          const bDiff = Math.abs(data1[i+2] - data2[i+2]);
          
          // Threshold for pixel difference
          if (rDiff + gDiff + bDiff > 100) {
            diffPixels++;
            // Set Mask Pixel to Bright Magenta (#FF00FF) full alpha
            maskData[i] = 255;     // R
            maskData[i+1] = 0;     // G
            maskData[i+2] = 255;   // B
            maskData[i+3] = 255;   // A
          } else {
            // Transparent
            maskData[i+3] = 0;
          }
        }
      }

      // If significant portion of cell changed, mark it for bounding box generation
      if (diffPixels > 5) {
        grid[r * cols + c] = 1;
      }
    }
  }

  // 2. Cluster Cells into Regions (Simple Connected Components)
  const regions: DiffRegion[] = [];
  const visited = new Uint8Array(cols * rows);

  const getIndex = (r: number, c: number) => r * cols + c;

  let regionCount = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = getIndex(r, c);
      if (grid[idx] === 1 && visited[idx] === 0) {
        // Start a new region
        regionCount++;
        const regionId = regionCount.toString();
        
        // Flood fill
        const queue = [[r, c]];
        visited[idx] = 1;

        let minR = r, maxR = r;
        let minC = c, maxC = c;

        while (queue.length > 0) {
          const [curR, curC] = queue.shift()!;
          
          minR = Math.min(minR, curR);
          maxR = Math.max(maxR, curR);
          minC = Math.min(minC, curC);
          maxC = Math.max(maxC, curC);

          // Check neighbors (8-connectivity for smoother boxes)
          const neighbors = [
            [curR-1, curC], [curR+1, curC], [curR, curC-1], [curR, curC+1],
            [curR-1, curC-1], [curR-1, curC+1], [curR+1, curC-1], [curR+1, curC+1]
          ];

          for (const [nR, nC] of neighbors) {
            if (nR >= 0 && nR < rows && nC >= 0 && nC < cols) {
              const nIdx = getIndex(nR, nC);
              if (grid[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queue.push([nR, nC]);
              }
            }
          }
        }

        // Convert Grid coords back to 0-100 percentages
        const boxY1 = Math.max(0, (minR * CELL_SIZE) / height * 100);
        const boxX1 = Math.max(0, (minC * CELL_SIZE) / width * 100);
        const boxY2 = Math.min(100, ((maxR + 1) * CELL_SIZE) / height * 100);
        const boxX2 = Math.min(100, ((maxC + 1) * CELL_SIZE) / width * 100);

        regions.push({
          id: regionId,
          boundingBox: [boxY1, boxX1, boxY2, boxX2]
        });
      }
    }
  }

  // 3. Create Debug Images with Labels
  
  // Image 1 (Old) with labels
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img1, 0, 0);
  drawDebugLabels(ctx, width, height, regions);
  const labeledOldImage = canvas.toDataURL('image/jpeg', 0.8);

  // Image 2 (New) with labels
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img2, 0, 0);
  drawDebugLabels(ctx, width, height, regions);
  const labeledNewImage = canvas.toDataURL('image/jpeg', 0.8);

  // 4. Create Mask Image
  ctx.clearRect(0, 0, width, height);
  ctx.putImageData(maskImageData, 0, 0);
  const maskImage = canvas.toDataURL('image/png');

  return { regions, diffImageOld: labeledOldImage, diffImageNew: labeledNewImage, maskImage };
};