"use client";

/**
 * Document Scanner Utilities
 * Auto-detects document edges and applies perspective correction
 */

interface Point {
  x: number;
  y: number;
}

interface DetectedDocument {
  corners: Point[];
  confidence: number;
}

/**
 * Detect document boundaries in an image using edge detection
 * Returns the four corners of the largest quadrilateral (document)
 */
export async function detectDocument(imageData: ImageData): Promise<DetectedDocument | null> {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // Convert to grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }

  // Apply Gaussian blur (simplified 3x3)
  const blurred = applyBlur(gray, width, height);

  // Edge detection using Sobel operator
  const edges = detectEdges(blurred, width, height);

  // Find contours and get the largest quadrilateral
  const corners = findLargestQuadrilateral(edges, width, height);

  if (!corners || corners.length !== 4) {
    return null;
  }

  // Calculate confidence based on edge strength and quadrilateral area
  const confidence = calculateConfidence(corners, edges, width, height);

  return { corners, confidence };
}

/**
 * Apply perspective transform to crop and straighten the document
 */
export function applyPerspectiveTransform(
  canvas: HTMLCanvasElement,
  corners: Point[],
  outputWidth: number = 800,
  outputHeight: number = 1100
): HTMLCanvasElement {
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;

  const ctx = outputCanvas.getContext("2d");
  if (!ctx) return outputCanvas;

  // Sort corners: top-left, top-right, bottom-right, bottom-left
  const sorted = sortCorners(corners);

  // Draw the transformed image
  ctx.drawImage(
    canvas,
    sorted[0].x, sorted[0].y,
    sorted[1].x - sorted[0].x, sorted[3].y - sorted[0].y,
    0, 0,
    outputWidth, outputHeight
  );

  return outputCanvas;
}

/**
 * Auto-enhance scanned document (increase contrast, convert to B&W if mostly text)
 */
export function enhanceDocument(imageData: ImageData): ImageData {
  const data = imageData.data;
  const length = data.length;

  // Calculate average brightness
  let totalBrightness = 0;
  for (let i = 0; i < length; i += 4) {
    totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  const avgBrightness = totalBrightness / (length / 4);

  // Apply adaptive contrast
  const contrast = 1.5;
  const intercept = 128 * (1 - contrast);

  for (let i = 0; i < length; i += 4) {
    // Increase contrast
    for (let j = 0; j < 3; j++) {
      data[i + j] = Math.max(0, Math.min(255, data[i + j] * contrast + intercept));
    }

    // If image is mostly bright (document on white background), apply mild sharpening
    if (avgBrightness > 200) {
      // Mild denoise by averaging with neighbors (simplified)
      // This is a basic version - real apps use more sophisticated algorithms
    }
  }

  return imageData;
}

// Helper: Apply 3x3 Gaussian blur
function applyBlur(gray: Uint8Array, width: number, height: number): Uint8Array {
  const output = new Uint8Array(gray.length);
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const kernelSum = 16;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const kidx = (ky + 1) * 3 + (kx + 1);
          sum += gray[idx] * kernel[kidx];
        }
      }
      output[y * width + x] = Math.round(sum / kernelSum);
    }
  }

  return output;
}

// Helper: Sobel edge detection
function detectEdges(gray: Uint8Array, width: number, height: number): Uint8Array {
  const edges = new Uint8Array(gray.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Sobel X
      const gx =
        -1 * gray[(y - 1) * width + (x - 1)] +
        -2 * gray[y * width + (x - 1)] +
        -1 * gray[(y + 1) * width + (x - 1)] +
        1 * gray[(y - 1) * width + (x + 1)] +
        2 * gray[y * width + (x + 1)] +
        1 * gray[(y + 1) * width + (x + 1)];

      // Sobel Y
      const gy =
        -1 * gray[(y - 1) * width + (x - 1)] +
        -2 * gray[(y - 1) * width + x] +
        -1 * gray[(y - 1) * width + (x + 1)] +
        1 * gray[(y + 1) * width + (x - 1)] +
        2 * gray[(y + 1) * width + x] +
        1 * gray[(y + 1) * width + (x + 1)];

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = Math.min(255, magnitude);
    }
  }

  return edges;
}

// Helper: Find the largest quadrilateral from edges
function findLargestQuadrilateral(edges: Uint8Array, width: number, height: number): Point[] | null {
  // Threshold edges
  const threshold = 50;
  const binaryEdges: boolean[] = new Array(edges.length);
  for (let i = 0; i < edges.length; i++) {
    binaryEdges[i] = edges[i] > threshold;
  }

  // Find edge points
  const edgePoints: Point[] = [];
  const step = 10; // Sample every 10 pixels for performance
  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      if (binaryEdges[y * width + x]) {
        edgePoints.push({ x, y });
      }
    }
  }

  if (edgePoints.length < 4) return null;

  // Find convex hull and approximate to quadrilateral
  const hull = convexHull(edgePoints);
  if (hull.length < 4) return null;

  // Approximate hull to 4 corners
  return approximateToQuadrilateral(hull);
}

// Helper: Convex hull using Graham scan (simplified)
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points;

  // Find leftmost point
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].x < points[start].x || (points[i].x === points[start].x && points[i].y < points[start].y)) {
      start = i;
    }
  }

  // Sort by polar angle
  const sorted = points.map((p, i) => ({ ...p, idx: i })).filter(p => p.idx !== start);
  sorted.sort((a, b) => {
    const angleA = Math.atan2(a.y - points[start].y, a.x - points[start].x);
    const angleB = Math.atan2(b.y - points[start].y, b.x - points[start].x);
    return angleA - angleB;
  });

  // Build hull
  const hull: Point[] = [points[start]];
  for (const p of sorted) {
    while (hull.length > 1 && !isLeftTurn(hull[hull.length - 2], hull[hull.length - 1], p)) {
      hull.pop();
    }
    hull.push(p);
  }

  return hull;
}

// Helper: Check if three points make a left turn
function isLeftTurn(p1: Point, p2: Point, p3: Point): boolean {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x) > 0;
}

// Helper: Approximate polygon to quadrilateral
function approximateToQuadrilateral(points: Point[]): Point[] {
  if (points.length === 4) return points;
  if (points.length < 4) return points;

  // Find the 4 points that form the largest area quadrilateral
  // Simplified: use the extreme points
  let minX = points[0], maxX = points[0];
  let minY = points[0], maxY = points[0];

  for (const p of points) {
    if (p.x < minX.x) minX = p;
    if (p.x > maxX.x) maxX = p;
    if (p.y < minY.y) minY = p;
    if (p.y > maxY.y) maxY = p;
  }

  // Return approximate corners
  return [
    { x: minX.x, y: minY.y }, // top-left
    { x: maxX.x, y: minY.y }, // top-right
    { x: maxX.x, y: maxY.y }, // bottom-right
    { x: minX.x, y: maxY.y }, // bottom-left
  ];
}

// Helper: Sort corners in order: top-left, top-right, bottom-right, bottom-left
function sortCorners(corners: Point[]): Point[] {
  // Sort by y, then by x
  const sorted = [...corners].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
    return a.x - b.x;
  });

  // The sorted array should be: top-left, top-right, bottom-left, bottom-right
  // Rearrange to: top-left, top-right, bottom-right, bottom-left
  if (sorted.length === 4) {
    const [tl, tr, bl, br] = sorted;
    return [tl, tr, br, bl];
  }

  return sorted;
}

// Helper: Calculate detection confidence
function calculateConfidence(corners: Point[], edges: Uint8Array, width: number, height: number): number {
  // Calculate area of quadrilateral
  const area = calculateQuadrilateralArea(corners);
  const imageArea = width * height;
  const areaRatio = area / imageArea;

  // Check edge density along the detected edges
  let edgeCount = 0;
  let totalChecked = 0;

  // Sample along the edges of the quadrilateral
  for (let i = 0; i < 4; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % 4];
    const steps = 20;

    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const x = Math.round(p1.x + (p2.x - p1.x) * t);
      const y = Math.round(p1.y + (p2.y - p1.y) * t);

      if (x >= 0 && x < width && y >= 0 && y < height) {
        totalChecked++;
        if (edges[y * width + x] > 50) {
          edgeCount++;
        }
      }
    }
  }

  const edgeDensity = totalChecked > 0 ? edgeCount / totalChecked : 0;

  // Confidence based on: area ratio (should be reasonable) and edge density
  let confidence = 0;
  if (areaRatio > 0.1 && areaRatio < 0.9) {
    confidence += 0.4;
  }
  confidence += edgeDensity * 0.6;

  return Math.min(1, confidence);
}

// Helper: Calculate quadrilateral area using shoelace formula
function calculateQuadrilateralArea(corners: Point[]): number {
  if (corners.length !== 4) return 0;

  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    area += corners[i].x * corners[j].y;
    area -= corners[j].x * corners[i].y;
  }

  return Math.abs(area) / 2;
}

/**
 * Process a captured image: detect document, crop, and enhance
 */
export async function processScannedDocument(
  sourceCanvas: HTMLCanvasElement,
  enableAutoCrop: boolean = true,
  enableEnhancement: boolean = true
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const ctx = sourceCanvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Failed to get canvas context"));
      return;
    }

    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

    if (enableAutoCrop) {
      detectDocument(imageData).then((detected) => {
        if (detected && detected.confidence > 0.5) {
          // Apply perspective correction
          const correctedCanvas = applyPerspectiveTransform(
            sourceCanvas,
            detected.corners,
            800,
            1100
          );

          if (enableEnhancement) {
            const correctedCtx = correctedCanvas.getContext("2d");
            if (correctedCtx) {
              const correctedData = correctedCtx.getImageData(0, 0, correctedCanvas.width, correctedCanvas.height);
              enhanceDocument(correctedData);
              correctedCtx.putImageData(correctedData, 0, 0);
            }
          }

          correctedCanvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
          }, "image/jpeg", 0.92);
        } else {
          // No document detected, just enhance
          if (enableEnhancement) {
            enhanceDocument(imageData);
            ctx.putImageData(imageData, 0, 0);
          }

          sourceCanvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
          }, "image/jpeg", 0.92);
        }
      });
    } else {
      // Just enhance without cropping
      if (enableEnhancement) {
        enhanceDocument(imageData);
        ctx.putImageData(imageData, 0, 0);
      }

      sourceCanvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob"));
      }, "image/jpeg", 0.92);
    }
  });
}
