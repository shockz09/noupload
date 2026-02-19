"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}

interface DocumentCropperProps {
  imageSrc: string;
  detectedCorners?: Point[];
  onConfirm: (corners: Point[]) => void;
  onRetake: () => void;
}

const CORNER_SIZE = 24;
const CORNER_HIT_AREA = 40;

export function DocumentCropper({ imageSrc, detectedCorners, onConfirm, onRetake }: DocumentCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [corners, setCorners] = useState<Point[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);

  // Calculate image display rect based on object-contain logic
  const getImageRect = useCallback(() => {
    if (!containerRef.current || imageNaturalSize.width === 0) return null;

    const container = containerRef.current.getBoundingClientRect();
    const containerRatio = container.width / container.height;
    const imageRatio = imageNaturalSize.width / imageNaturalSize.height;

    let displayWidth: number, displayHeight: number, offsetX: number, offsetY: number;

    if (imageRatio > containerRatio) {
      // Image is wider - fit to width
      displayWidth = container.width;
      displayHeight = container.width / imageRatio;
      offsetX = 0;
      offsetY = (container.height - displayHeight) / 2;
    } else {
      // Image is taller - fit to height
      displayHeight = container.height;
      displayWidth = container.height * imageRatio;
      offsetX = (container.width - displayWidth) / 2;
      offsetY = 0;
    }

    return { x: offsetX, y: offsetY, width: displayWidth, height: displayHeight };
  }, [imageNaturalSize]);

  // Initialize everything when image loads
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current.getBoundingClientRect();

    setImageNaturalSize({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    setContainerSize({ width: container.width, height: container.height });

    // Calculate initial corner positions
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = container.width / container.height;

    let displayWidth: number, displayHeight: number, offsetX: number, offsetY: number;

    if (imgRatio > containerRatio) {
      displayWidth = container.width;
      displayHeight = container.width / imgRatio;
      offsetX = 0;
      offsetY = (container.height - displayHeight) / 2;
    } else {
      displayHeight = container.height;
      displayWidth = container.height * imgRatio;
      offsetX = (container.width - displayWidth) / 2;
      offsetY = 0;
    }

    if (detectedCorners && detectedCorners.length === 4) {
      // Use detected corners
      const displayCorners = detectedCorners.map((corner) => ({
        x: offsetX + corner.x * displayWidth,
        y: offsetY + corner.y * displayHeight,
      }));
      setCorners(displayCorners);
    } else {
      // Default corners with inset
      const inset = Math.min(displayWidth, displayHeight) * 0.1;
      setCorners([
        { x: offsetX + inset, y: offsetY + inset },
        { x: offsetX + displayWidth - inset, y: offsetY + inset },
        { x: offsetX + displayWidth - inset, y: offsetY + displayHeight - inset },
        { x: offsetX + inset, y: offsetY + displayHeight - inset },
      ]);
    }

    setIsReady(true);
  }, [detectedCorners]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (!isReady || !containerRef.current) return;

      const oldRect = getImageRect();
      const container = containerRef.current.getBoundingClientRect();
      setContainerSize({ width: container.width, height: container.height });

      // Recalculate with new size
      const newRect = getImageRect();
      if (oldRect && newRect) {
        const scaleX = newRect.width / oldRect.width;
        const scaleY = newRect.height / oldRect.height;

        setCorners((prev) =>
          prev.map((corner) => ({
            x: (corner.x - oldRect.x) * scaleX + newRect.x,
            y: (corner.y - oldRect.y) * scaleY + newRect.y,
          }))
        );
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isReady, getImageRect]);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingIndex(index);
  }, []);

  // Global drag handlers
  useEffect(() => {
    if (draggingIndex === null) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const imageRect = getImageRect();
      if (!imageRect || !containerRef.current) return;

      const container = containerRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const x = clientX - container.left;
      const y = clientY - container.top;

      // Constrain to image bounds
      const constrainedX = Math.max(imageRect.x, Math.min(imageRect.x + imageRect.width, x));
      const constrainedY = Math.max(imageRect.y, Math.min(imageRect.y + imageRect.height, y));

      setCorners((prev) => {
        const newCorners = [...prev];
        newCorners[draggingIndex] = { x: constrainedX, y: constrainedY };
        return newCorners;
      });
    };

    const handleUp = () => setDraggingIndex(null);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [draggingIndex, getImageRect]);

  const handleConfirm = useCallback(() => {
    if (!imageRef.current) return;

    const imageRect = getImageRect();
    if (!imageRect) return;

    // Convert display coordinates to image-relative (0-1)
    const relativeCorners = corners.map((corner) => ({
      x: (corner.x - imageRect.x) / imageRect.width,
      y: (corner.y - imageRect.y) / imageRect.height,
    }));

    // Convert to absolute pixel coordinates
    const absoluteCorners = relativeCorners.map((corner) => ({
      x: Math.round(corner.x * imageNaturalSize.width),
      y: Math.round(corner.y * imageNaturalSize.height),
    }));

    onConfirm(absoluteCorners);
  }, [corners, getImageRect, imageNaturalSize, onConfirm]);

  return (
    <div className="border-2 border-foreground bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-foreground">
        <span className="font-bold">Adjust corners to fit document</span>
        <button
          type="button"
          onClick={onRetake}
          className="text-sm font-semibold text-muted-foreground hover:text-destructive transition-colors"
        >
          Retake
        </button>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="relative bg-black select-none"
        style={{ touchAction: "none", minHeight: "300px", height: "50vh" }}
      >
        <img
          ref={imageRef}
          src={imageSrc}
          alt="Document to crop"
          className="w-full h-full object-contain"
          onLoad={handleImageLoad}
          draggable={false}
        />

        {isReady && corners.length === 4 && (
          <>
            {/* SVG overlay for lines and dark area */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: containerSize.width, height: containerSize.height }}
            >
              <defs>
                <mask id="cropMask">
                  <rect width="100%" height="100%" fill="white" />
                  <polygon points={corners.map((c) => `${c.x},${c.y}`).join(" ")} fill="black" />
                </mask>
              </defs>

              {/* Dark overlay */}
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#cropMask)" />

              {/* Border lines */}
              <polygon
                points={corners.map((c) => `${c.x},${c.y}`).join(" ")}
                fill="none"
                stroke="#C84C1C"
                strokeWidth="3"
                strokeDasharray="8,4"
              />
            </svg>

            {/* Corner handles */}
            {corners.map((corner, index) => (
              <div
                key={index}
                className={`absolute cursor-move ${draggingIndex === index ? "z-30" : "z-20"}`}
                style={{
                  left: corner.x - CORNER_HIT_AREA / 2,
                  top: corner.y - CORNER_HIT_AREA / 2,
                  width: CORNER_HIT_AREA,
                  height: CORNER_HIT_AREA,
                  transition: draggingIndex === null ? "transform 0.1s" : "none",
                  transform: draggingIndex === index ? "scale(1.3)" : "scale(1)",
                }}
                onMouseDown={(e) => handleMouseDown(e, index)}
                onTouchStart={(e) => handleMouseDown(e, index)}
              >
                <div
                  className={`absolute rounded-full border-3 border-foreground shadow-xl ${
                    draggingIndex === index ? "bg-primary" : "bg-white"
                  }`}
                  style={{
                    width: CORNER_SIZE,
                    height: CORNER_SIZE,
                    left: (CORNER_HIT_AREA - CORNER_SIZE) / 2,
                    top: (CORNER_HIT_AREA - CORNER_SIZE) / 2,
                    borderWidth: "3px",
                  }}
                />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-card border-t-2 border-foreground">
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={onRetake}
            className="flex items-center justify-center gap-2 px-6 h-12 border-2 border-foreground font-bold transition-all hover:bg-accent whitespace-nowrap"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Retake
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isReady}
            className="flex items-center justify-center gap-2 px-6 h-12 bg-primary text-white border-2 border-foreground font-bold transition-all hover:opacity-90 whitespace-nowrap disabled:opacity-50"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Confirm & Add
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">Drag the white circles to adjust the document boundaries</p>
      </div>
    </div>
  );
}
