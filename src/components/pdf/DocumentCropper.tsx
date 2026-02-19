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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageRect, setImageRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Calculate the actual displayed image rectangle within the container
  const calculateImageRect = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return null;

    const container = containerRef.current.getBoundingClientRect();
    const img = imageRef.current;
    const imgNatural = {
      width: img.naturalWidth,
      height: img.naturalHeight,
    };

    // Calculate how the image is displayed (object-contain behavior)
    const containerRatio = container.width / container.height;
    const imageRatio = imgNatural.width / imgNatural.height;

    let displayWidth, displayHeight, offsetX, offsetY;

    if (imageRatio > containerRatio) {
      // Image is wider relative to container - fit to width
      displayWidth = container.width;
      displayHeight = container.width / imageRatio;
      offsetX = 0;
      offsetY = (container.height - displayHeight) / 2;
    } else {
      // Image is taller relative to container - fit to height
      displayHeight = container.height;
      displayWidth = container.height * imageRatio;
      offsetX = (container.width - displayWidth) / 2;
      offsetY = 0;
    }

    return {
      x: offsetX,
      y: offsetY,
      width: displayWidth,
      height: displayHeight,
    };
  }, []);

  // Initialize corners when image loads
  useEffect(() => {
    const rect = calculateImageRect();
    if (!rect) return;
    setImageRect(rect);

    if (detectedCorners && detectedCorners.length === 4) {
      // Convert image-relative coordinates to display-relative
      const displayCorners = detectedCorners.map((corner) => ({
        x: rect.x + corner.x * rect.width,
        y: rect.y + corner.y * rect.height,
      }));
      setCorners(displayCorners);
    } else {
      // Default corners - inset from image edges
      const inset = 20; // pixels from edge
      setCorners([
        { x: rect.x + inset, y: rect.y + inset },
        { x: rect.x + rect.width - inset, y: rect.y + inset },
        { x: rect.x + rect.width - inset, y: rect.y + rect.height - inset },
        { x: rect.x + inset, y: rect.y + rect.height - inset },
      ]);
    }
    setImageLoaded(true);
  }, [detectedCorners, calculateImageRect]);

  // Update image rect on resize
  useEffect(() => {
    const handleResize = () => {
      if (!imageLoaded) return;
      const newRect = calculateImageRect();
      if (newRect && imageRect) {
        // Scale existing corners to new rect
        const scaleX = newRect.width / imageRect.width;
        const scaleY = newRect.height / imageRect.height;
        const offsetX = newRect.x - imageRect.x;
        const offsetY = newRect.y - imageRect.y;

        setCorners((prev) =>
          prev.map((corner) => ({
            x: (corner.x - imageRect.x) * scaleX + newRect.x + offsetX,
            y: (corner.y - imageRect.y) * scaleY + newRect.y + offsetY,
          }))
        );
        setImageRect(newRect);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [imageLoaded, imageRect, calculateImageRect]);

  const handleImageLoad = useCallback(() => {
    // Trigger the effect above
    const rect = calculateImageRect();
    if (rect) {
      setImageRect(rect);
    }
  }, [calculateImageRect]);

  const getMousePos = useCallback(
    (e: React.MouseEvent | React.TouchEvent): Point | null => {
      if (!containerRef.current) return null;

      const rect = containerRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingIndex(index);
    },
    []
  );

  // Global mouse/touch handlers for dragging
  useEffect(() => {
    if (draggingIndex === null) return;

    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current || !imageRect) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX;
      const clientY = e instanceof TouchEvent ? e.touches[0].clientY : e.clientY;

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Constrain to image rectangle
      const constrainedX = Math.max(imageRect.x, Math.min(imageRect.x + imageRect.width, x));
      const constrainedY = Math.max(imageRect.y, Math.min(imageRect.y + imageRect.height, y));

      setCorners((prev) => {
        const newCorners = [...prev];
        newCorners[draggingIndex] = { x: constrainedX, y: constrainedY };
        return newCorners;
      });
    };

    const handleGlobalUp = () => {
      setDraggingIndex(null);
    };

    window.addEventListener("mousemove", handleGlobalMove);
    window.addEventListener("mouseup", handleGlobalUp);
    window.addEventListener("touchmove", handleGlobalMove);
    window.addEventListener("touchend", handleGlobalUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMove);
      window.removeEventListener("mouseup", handleGlobalUp);
      window.removeEventListener("touchmove", handleGlobalMove);
      window.removeEventListener("touchend", handleGlobalUp);
    };
  }, [draggingIndex, imageRect]);

  const handleConfirm = useCallback(() => {
    if (!imageRef.current || !imageRect) return;

    // Convert display coordinates back to image-relative coordinates (0-1)
    const imageRelativeCorners = corners.map((corner) => ({
      x: (corner.x - imageRect.x) / imageRect.width,
      y: (corner.y - imageRect.y) / imageRect.height,
    }));

    // Convert to absolute pixel coordinates
    const absoluteCorners = imageRelativeCorners.map((corner) => ({
      x: Math.round(corner.x * imageRef.current!.naturalWidth),
      y: Math.round(corner.y * imageRef.current!.naturalHeight),
    }));

    onConfirm(absoluteCorners);
  }, [corners, imageRect, onConfirm]);

  if (!imageLoaded) {
    return (
      <div className="border-2 border-foreground bg-card overflow-hidden">
        <div className="p-4 border-b-2 border-foreground">
          <span className="font-bold">Loading image...</span>
        </div>
        <div ref={containerRef} className="relative bg-black min-h-[300px]">
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Document to crop"
            className="w-full h-auto max-h-[70vh] object-contain"
            onLoad={handleImageLoad}
            draggable={false}
          />
        </div>
      </div>
    );
  }

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

      {/* Image with overlay */}
      <div
        ref={containerRef}
        className="relative bg-black select-none"
        style={{ touchAction: "none", minHeight: "300px" }}
      >
        <img
          ref={imageRef}
          src={imageSrc}
          alt="Document to crop"
          className="w-full h-auto max-h-[70vh] object-contain"
          draggable={false}
        />

        {/* SVG Overlay - positioned absolutely over the image */}
        {imageRect && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          >
            {/* Dark overlay outside crop area */}
            <defs>
              <mask id="cropMask">
                <rect width="100%" height="100%" fill="white" />
                <polygon
                  points={corners.map((c) => `${c.x},${c.y}`).join(" ")}
                  fill="black"
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#cropMask)" />

            {/* Crop border */}
            <polygon
              points={corners.map((c) => `${c.x},${c.y}`).join(" ")}
              fill="none"
              stroke="#C84C1C"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          </svg>
        )}

        {/* Draggable corners - HTML elements positioned absolutely */}
        {imageRect &&
          corners.map((corner, index) => (
            <div
              key={index}
              className={`absolute cursor-move z-10 transition-transform ${
                draggingIndex === index ? "scale-125 z-20" : "hover:scale-110"
              }`}
              style={{
                left: `${corner.x}px`,
                top: `${corner.y}px`,
                width: `${CORNER_HIT_AREA}px`,
                height: `${CORNER_HIT_AREA}px`,
                marginLeft: `-${CORNER_HIT_AREA / 2}px`,
                marginTop: `-${CORNER_HIT_AREA / 2}px`,
              }}
              onMouseDown={(e) => handleMouseDown(e, index)}
              onTouchStart={(e) => handleMouseDown(e, index)}
            >
              {/* Visual corner marker */}
              <div
                className={`absolute rounded-full border-2 border-foreground shadow-lg ${
                  draggingIndex === index ? "bg-primary" : "bg-white"
                }`}
                style={{
                  width: `${CORNER_SIZE}px`,
                  height: `${CORNER_SIZE}px`,
                  left: `${(CORNER_HIT_AREA - CORNER_SIZE) / 2}px`,
                  top: `${(CORNER_HIT_AREA - CORNER_SIZE) / 2}px`,
                }}
              />
            </div>
          ))}
      </div>

      {/* Controls */}
      <div className="p-6 bg-card border-t-2 border-foreground">
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={onRetake}
            className="flex items-center justify-center gap-2 px-6 h-12 border-2 border-foreground font-bold transition-all hover:bg-accent whitespace-nowrap"
          >
            <svg
              className="w-5 h-5 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Retake
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center justify-center gap-2 px-6 h-12 bg-primary text-white border-2 border-foreground font-bold transition-all hover:opacity-90 whitespace-nowrap"
          >
            <svg
              className="w-5 h-5 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Confirm & Add
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">Drag the corners to adjust the document boundaries</p>
      </div>
    </div>
  );
}
