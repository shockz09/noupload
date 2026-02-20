"use client";

/**
 * Advanced Document Scanner Utilities
 * Implements Canny edge detection, connected component analysis,
 * and quadrilateral detection for accurate document boundaries
 */

interface Point {
  x: number;
  y: number;
}

interface DetectedDocument {
  corners: Point[];
  confidence: number;
}

interface Contour {
  points: Point[];
  perimeter: number;
  area: number;
}

/**
 * Detect document boundaries using Canny edge detection and connected components
 */
export async function detectDocument(imageData: ImageData): Promise<DetectedDocument | null> {
  const width = imageData.width;
  const height = imageData.height;
  
  // Step 1: Convert to grayscale
  const gray = rgbToGrayscale(imageData);
  
  // Step 2: Apply CLAHE for contrast enhancement
  const enhanced = applyCLAHE(gray, width, height);
  
  // Step 3: Apply Gaussian blur to reduce noise
  const blurred = applyGaussianBlur(enhanced, width, height, 1.4, 5);
  
  // Step 4: Canny edge detection
  const edges = cannyEdgeDetection(blurred, width, height, 30, 100);
  
  // Step 5: Find connected components (contours)
  const contours = findContours(edges, width, height);
  
  // Step 6: Filter and approximate quadrilaterals
  const quadrilaterals = findQuadrilaterals(contours, width, height);
  
  if (quadrilaterals.length === 0) {
    return null;
  }
  
  // Step 7: Score and select best quadrilateral
  const bestQuad = selectBestQuadrilateral(quadrilaterals, edges, width, height);
  
  if (!bestQuad || bestQuad.score < 0.3) {
    return null;
  }
  
  return {
    corners: sortCorners(bestQuad.corners),
    confidence: bestQuad.score,
  };
}

/**
 * Convert RGBA to grayscale using luminance formula
 */
function rgbToGrayscale(imageData: ImageData): Uint8Array {
  const { width, height, data } = imageData;
  const gray = new Uint8Array(width * height);
  
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    // Luminance formula: 0.299*R + 0.587*G + 0.114*B
    gray[i] = Math.round(
      0.299 * data[idx] + 
      0.587 * data[idx + 1] + 
      0.114 * data[idx + 2]
    );
  }
  
  return gray;
}

/**
 * Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * Improves contrast in local regions
 */
function applyCLAHE(gray: Uint8Array, width: number, height: number): Uint8Array {
  const output = new Uint8Array(gray.length);
  const tileSize = 32;
  const clipLimit = 40;
  
  for (let ty = 0; ty < height; ty += tileSize) {
    for (let tx = 0; tx < width; tx += tileSize) {
      const tileWidth = Math.min(tileSize, width - tx);
      const tileHeight = Math.min(tileSize, height - ty);
      
      // Calculate histogram for this tile
      const histogram = new Array(256).fill(0);
      for (let y = ty; y < ty + tileHeight; y++) {
        for (let x = tx; x < tx + tileWidth; x++) {
          histogram[gray[y * width + x]]++;
        }
      }
      
      // Clip histogram
      const totalPixels = tileWidth * tileHeight;
      const clipPixels = Math.round(clipLimit * totalPixels / 256);
      let clipped = 0;
      
      for (let i = 0; i < 256; i++) {
        if (histogram[i] > clipPixels) {
          clipped += histogram[i] - clipPixels;
          histogram[i] = clipPixels;
        }
      }
      
      // Redistribute clipped pixels
      const redist = Math.floor(clipped / 256);
      for (let i = 0; i < 256; i++) {
        histogram[i] += redist;
      }
      
      // Calculate CDF
      const cdf = new Array(256).fill(0);
      cdf[0] = histogram[0];
      for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i];
      }
      
      // Apply to tile
      for (let y = ty; y < ty + tileHeight; y++) {
        for (let x = tx; x < tx + tileWidth; x++) {
          const pixel = gray[y * width + x];
          output[y * width + x] = Math.round((cdf[pixel] / totalPixels) * 255);
        }
      }
    }
  }
  
  return output;
}

/**
 * Apply Gaussian blur with configurable sigma and kernel size
 */
function applyGaussianBlur(
  gray: Uint8Array, 
  width: number, 
  height: number, 
  sigma: number, 
  kernelSize: number
): Uint8Array {
  const output = new Uint8Array(gray.length);
  const kernel = generateGaussianKernel(sigma, kernelSize);
  const half = Math.floor(kernelSize / 2);
  
  // Horizontal pass
  const temp = new Uint8Array(gray.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -half; k <= half; k++) {
        const px = Math.max(0, Math.min(width - 1, x + k));
        sum += gray[y * width + px] * kernel[k + half];
      }
      temp[y * width + x] = sum;
    }
  }
  
  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -half; k <= half; k++) {
        const py = Math.max(0, Math.min(height - 1, y + k));
        sum += temp[py * width + x] * kernel[k + half];
      }
      output[y * width + x] = sum;
    }
  }
  
  return output;
}

/**
 * Generate Gaussian kernel
 */
function generateGaussianKernel(sigma: number, size: number): number[] {
  const kernel: number[] = [];
  const half = Math.floor(size / 2);
  let sum = 0;
  
  for (let i = -half; i <= half; i++) {
    const value = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(value);
    sum += value;
  }
  
  // Normalize
  return kernel.map(v => v / sum);
}

/**
 * Canny edge detection algorithm
 * 1. Calculate gradients (Sobel)
 * 2. Non-maximum suppression
 * 3. Hysteresis thresholding
 */
function cannyEdgeDetection(
  gray: Uint8Array, 
  width: number, 
  height: number, 
  lowThreshold: number, 
  highThreshold: number
): Uint8Array {
  const edges = new Uint8Array(width * height);
  const gradientX = new Float32Array(width * height);
  const gradientY = new Float32Array(width * height);
  const magnitude = new Float32Array(width * height);
  const direction = new Float32Array(width * height);
  
  // Sobel operators
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  // Calculate gradients
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          gx += gray[idx] * sobelX[kernelIdx];
          gy += gray[idx] * sobelY[kernelIdx];
        }
      }
      
      const idx = y * width + x;
      gradientX[idx] = gx;
      gradientY[idx] = gy;
      magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
      direction[idx] = Math.atan2(gy, gx);
    }
  }
  
  // Non-maximum suppression
  const suppressed = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const mag = magnitude[idx];
      const angle = direction[idx];
      
      // Quantize angle to 4 directions: 0°, 45°, 90°, 135°
      let angleDeg = (angle * 180 / Math.PI + 180) % 180;
      let neighbors: [number, number];
      
      if ((angleDeg >= 0 && angleDeg < 22.5) || (angleDeg >= 157.5 && angleDeg < 180)) {
        neighbors = [magnitude[idx - 1], magnitude[idx + 1]]; // 0° - left, right
      } else if (angleDeg >= 22.5 && angleDeg < 67.5) {
        neighbors = [magnitude[(y - 1) * width + (x + 1)], magnitude[(y + 1) * width + (x - 1)]]; // 45°
      } else if (angleDeg >= 67.5 && angleDeg < 112.5) {
        neighbors = [magnitude[(y - 1) * width + x], magnitude[(y + 1) * width + x]]; // 90° - up, down
      } else {
        neighbors = [magnitude[(y - 1) * width + (x - 1)], magnitude[(y + 1) * width + (x + 1)]]; // 135°
      }
      
      suppressed[idx] = (mag >= neighbors[0] && mag >= neighbors[1]) ? mag : 0;
    }
  }
  
  // Hysteresis thresholding
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const mag = suppressed[idx];
      
      if (mag >= highThreshold) {
        edges[idx] = 255; // Strong edge
      } else if (mag >= lowThreshold) {
        // Weak edge - check if connected to strong edge
        let connectedToStrong = false;
        for (let dy = -1; dy <= 1 && !connectedToStrong; dy++) {
          for (let dx = -1; dx <= 1 && !connectedToStrong; dx++) {
            if (dy === 0 && dx === 0) continue;
            const nIdx = (y + dy) * width + (x + dx);
            if (suppressed[nIdx] >= highThreshold) {
              connectedToStrong = true;
            }
          }
        }
        edges[idx] = connectedToStrong ? 255 : 0;
      } else {
        edges[idx] = 0;
      }
    }
  }
  
  return edges;
}

/**
 * Find connected components (contours) using flood fill
 */
function findContours(edges: Uint8Array, width: number, height: number): Contour[] {
  const visited = new Uint8Array(width * height);
  const contours: Contour[] = [];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      if (edges[idx] === 255 && visited[idx] === 0) {
        const contour = floodFill(edges, visited, width, height, x, y);
        if (contour.points.length > 50) { // Filter small noise
          contours.push(contour);
        }
      }
    }
  }
  
  return contours;
}

/**
 * Flood fill to extract a single contour
 */
function floodFill(
  edges: Uint8Array, 
  visited: Uint8Array, 
  width: number, 
  height: number, 
  startX: number, 
  startY: number
): Contour {
  const points: Point[] = [];
  const stack: Point[] = [{ x: startX, y: startY }];
  
  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    const idx = y * width + x;
    
    if (visited[idx] || edges[idx] !== 255) continue;
    
    visited[idx] = 1;
    points.push({ x, y });
    
    // Check 8 neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          stack.push({ x: nx, y: ny });
        }
      }
    }
  }
  
  return {
    points,
    perimeter: calculatePerimeter(points),
    area: calculatePolygonArea(points),
  };
}

/**
 * Calculate perimeter of a set of points
 */
function calculatePerimeter(points: Point[]): number {
  if (points.length < 2) return 0;
  let perimeter = 0;
  
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    perimeter += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }
  
  return perimeter;
}

/**
 * Calculate polygon area using shoelace formula
 */
function calculatePolygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += (p1.x * p2.y) - (p2.x * p1.y);
  }
  
  return Math.abs(area) / 2;
}

/**
 * Find quadrilaterals by approximating contours
 */
function findQuadrilaterals(contours: Contour[], width: number, height: number): Array<{corners: Point[], score: number}> {
  const quadrilaterals: Array<{corners: Point[], score: number}> = [];
  const imageArea = width * height;
  
  for (const contour of contours) {
    // Filter by area (document should be 10-90% of image)
    const areaRatio = contour.area / imageArea;
    if (areaRatio < 0.05 || areaRatio > 0.95) continue;
    
    // Approximate contour to polygon
    const approx = approximatePolygon(contour.points, contour.perimeter * 0.01);
    
    // Look for quadrilaterals (4 corners)
    if (approx.length === 4) {
      const corners = approx;
      
      // Calculate score based on:
      // 1. Aspect ratio (documents are usually 1.3-1.6)
      const aspectRatio = calculateAspectRatio(corners);
      const aspectScore = aspectRatio >= 1.2 && aspectRatio <= 1.8 ? 1 : 0.5;
      
      // 2. Corner angles (should be close to 90°)
      const angleScore = calculateAngleScore(corners);
      
      // 3. Convexity
      const convexityScore = isConvex(corners) ? 1 : 0.3;
      
      const score = (aspectScore + angleScore + convexityScore) / 3;
      
      quadrilaterals.push({ corners, score });
    }
  }
  
  return quadrilaterals;
}

/**
 * Approximate a polygon using Ramer-Douglas-Peucker algorithm
 */
function approximatePolygon(points: Point[], epsilon: number): Point[] {
  if (points.length <= 4) return points;
  
  // Find the point with maximum distance from line between start and end
  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = pointLineDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }
  
  if (maxDist > epsilon) {
    // Recursive approximation
    const left = approximatePolygon(points.slice(0, maxIdx + 1), epsilon);
    const right = approximatePolygon(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  } else {
    return [start, end];
  }
}

/**
 * Calculate distance from point to line segment
 */
function pointLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const len2 = dx * dx + dy * dy;
  
  if (len2 === 0) return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
  
  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  
  return Math.sqrt(Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2));
}

/**
 * Calculate aspect ratio of quadrilateral
 */
function calculateAspectRatio(corners: Point[]): number {
  if (corners.length !== 4) return 1;
  
  // Calculate distances between consecutive corners
  const d1 = Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2));
  const d2 = Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2));
  
  return Math.max(d1, d2) / Math.min(d1, d2);
}

/**
 * Calculate score based on how close angles are to 90°
 */
function calculateAngleScore(corners: Point[]): number {
  if (corners.length !== 4) return 0;
  
  let totalScore = 0;
  
  for (let i = 0; i < 4; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % 4];
    const p3 = corners[(i + 2) % 4];
    
    const angle = calculateAngle(p1, p2, p3);
    const deviation = Math.abs(angle - 90);
    totalScore += Math.max(0, 1 - deviation / 45); // 0-1 score
  }
  
  return totalScore / 4;
}

/**
 * Calculate angle at p2 formed by p1-p2-p3
 */
function calculateAngle(p1: Point, p2: Point, p3: Point): number {
  const dx1 = p1.x - p2.x;
  const dy1 = p1.y - p2.y;
  const dx2 = p3.x - p2.x;
  const dy2 = p3.y - p2.y;
  
  const dot = dx1 * dx2 + dy1 * dy2;
  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
  
  if (len1 === 0 || len2 === 0) return 0;
  
  const cos = dot / (len1 * len2);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
}

/**
 * Check if quadrilateral is convex
 */
function isConvex(corners: Point[]): boolean {
  if (corners.length !== 4) return false;
  
  let sign = 0;
  
  for (let i = 0; i < 4; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % 4];
    const p3 = corners[(i + 2) % 4];
    
    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
    
    if (sign === 0) {
      sign = cross > 0 ? 1 : -1;
    } else if ((cross > 0 && sign < 0) || (cross < 0 && sign > 0)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Select best quadrilateral based on multiple criteria
 */
function selectBestQuadrilateral(
  quadrilaterals: Array<{corners: Point[], score: number}>, 
  edges: Uint8Array, 
  width: number, 
  height: number
): {corners: Point[], score: number} | null {
  if (quadrilaterals.length === 0) return null;
  
  let best = quadrilaterals[0];
  let bestScore = best.score;
  
  for (const quad of quadrilaterals) {
    // Calculate edge density along the quadrilateral
    const edgeDensity = calculateEdgeDensity(quad.corners, edges, width, height);
    
    // Combined score: shape score + edge density
    const combinedScore = quad.score * 0.6 + edgeDensity * 0.4;
    
    if (combinedScore > bestScore) {
      best = quad;
      bestScore = combinedScore;
    }
  }
  
  return { corners: best.corners, score: bestScore };
}

/**
 * Calculate edge density along quadrilateral edges
 */
function calculateEdgeDensity(corners: Point[], edges: Uint8Array, width: number, height: number): number {
  let edgeCount = 0;
  let total = 0;
  
  for (let i = 0; i < 4; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % 4];
    const steps = Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
    
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const x = Math.round(p1.x + (p2.x - p1.x) * t);
      const y = Math.round(p1.y + (p2.y - p1.y) * t);
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        total++;
        if (edges[y * width + x] === 255) {
          edgeCount++;
        }
      }
    }
  }
  
  return total > 0 ? edgeCount / total : 0;
}

/**
 * Sort corners in order: top-left, top-right, bottom-right, bottom-left
 */
function sortCorners(corners: Point[]): Point[] {
  if (corners.length !== 4) return corners;
  
  // Calculate centroid
  const centroid = corners.reduce(
    (acc, c) => ({ x: acc.x + c.x / 4, y: acc.y + c.y / 4 }),
    { x: 0, y: 0 }
  );
  
  // Sort by angle from centroid
  return [...corners].sort((a, b) => {
    const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
    const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
    return angleA - angleB;
  });
}

/**
 * Apply perspective transform to crop and straighten document
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
  
  const sorted = sortCorners(corners);
  
  // Simple perspective correction using canvas transform
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
 * Auto-enhance scanned document
 */
export function enhanceDocument(imageData: ImageData): ImageData {
  const data = imageData.data;
  const length = data.length;
  
  // Calculate histogram
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < length; i += 4) {
    const brightness = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
    histogram[brightness]++;
  }
  
  // Find min and max brightness (1st and 99th percentile)
  let min = 0, max = 255;
  const totalPixels = length / 4;
  let cumulative = 0;
  
  for (let i = 0; i < 256; i++) {
    cumulative += histogram[i];
    if (cumulative > totalPixels * 0.01) {
      min = i;
      break;
    }
  }
  
  cumulative = 0;
  for (let i = 255; i >= 0; i--) {
    cumulative += histogram[i];
    if (cumulative > totalPixels * 0.01) {
      max = i;
      break;
    }
  }
  
  // Apply contrast stretching
  const range = max - min;
  if (range > 0) {
    for (let i = 0; i < length; i += 4) {
      for (let j = 0; j < 3; j++) {
        const stretched = ((data[i + j] - min) / range) * 255;
        data[i + j] = Math.max(0, Math.min(255, Math.round(stretched)));
      }
    }
  }
  
  return imageData;
}

/**
 * Process a scanned image with all optimizations
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
        if (detected && detected.confidence > 0.3) {
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
