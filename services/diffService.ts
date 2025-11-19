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

export const detectVisualDifferences = async (
  imageOldStr: string,
  imageNewStr: string
): Promise<{ regions: DiffRegion[]; diffImage: string }> => {
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

  // 1. Detect Changed Cells
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
          // We ignore Alpha for now as scanned docs usually solid
          const rDiff = Math.abs(data1[i] - data2[i]);
          const gDiff = Math.abs(data1[i+1] - data2[i+1]);
          const bDiff = Math.abs(data1[i+2] - data2[i+2]);
          
          // Threshold for pixel difference (sensitivity)
          // High threshold to ignore compression artifacts/minor antialiasing
          if (rDiff + gDiff + bDiff > 100) {
            diffPixels++;
          }
        }
      }

      // If significant portion of cell changed, mark it
      // 5 pixels is enough to catch a period change or thin line move
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
        // Add a small padding (1/2 cell) to box
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

  // 3. Create Debug Image with Labels
  // Draw the 'New' image then overlay boxes
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img2, 0, 0);
  
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

  const labeledDiffImage = canvas.toDataURL('image/jpeg', 0.8);

  return { regions, diffImage: labeledDiffImage };
};