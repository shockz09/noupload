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
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Initialize corners when image loads
  useEffect(() => {
    if (detectedCorners && detectedCorners.length === 4) {
      setCorners(detectedCorners);
    } else {
      // Default to image corners
      setCorners([
        { x: 0.1, y: 0.1 }, // top-left
        { x: 0.9, y: 0.1 }, // top-right
        { x: 0.9, y: 0.9 }, // bottom-right
        { x: 0.1, y: 0.9 }, // bottom-left
      ]);
    }
  }, [detectedCorners]);

  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setImageSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
      setImageLoaded(true);
    }
  }, []);

  const getMousePos = useCallback((e: React.MouseEvent | React.TouchEvent): Point | null => {
    if (!containerRef.current) return null;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingIndex(index);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (draggingIndex === null) return;
    
    const pos = getMousePos(e);
    if (!pos) return;

    setCorners(prev => {
      const newCorners = [...prev];
      newCorners[draggingIndex] = {
        x: Math.max(0, Math.min(1, pos.x)),
        y: Math.max(0, Math.min(1, pos.y)),
      };
      return newCorners;
    });
  }, [draggingIndex, getMousePos]);

  const handleMouseUp = useCallback(() => {
    setDraggingIndex(null);
  }, []);

  // Global mouse/touch handlers for dragging outside container
  useEffect(() => {
    if (draggingIndex === null) return;

    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX;
      const clientY = e instanceof TouchEvent ? e.touches[0].clientY : e.clientY;
      
      const pos = {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      };

      setCorners(prev => {
        const newCorners = [...prev];
        newCorners[draggingIndex] = {
          x: Math.max(0, Math.min(1, pos.x)),
          y: Math.max(0, Math.min(1, pos.y)),
        };
        return newCorners;
      });
    };

    const handleGlobalUp = () => {
      setDraggingIndex(null);
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchmove', handleGlobalMove);
    window.addEventListener('touchend', handleGlobalUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [draggingIndex]);

  const handleConfirm = useCallback(() => {
    if (!imageRef.current) return;
    
    // Convert relative coordinates to absolute pixel coordinates
    const absoluteCorners = corners.map(corner => ({
      x: Math.round(corner.x * imageRef.current!.naturalWidth),
      y: Math.round(corner.y * imageRef.current!.naturalHeight),
    }));
    
    onConfirm(absoluteCorners);
  }, [corners, onConfirm]);

  // Calculate polygon path for the crop overlay
  const polygonPath = corners.length === 4
    ? `M ${corners[0].x * 100} ${corners[0].y * 100} L ${corners[1].x * 100} ${corners[1].y * 100} L ${corners[2].x * 100} ${corners[2].y * 100} L ${corners[3].x * 100} ${corners[3].y * 100} Z`
    : '';

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
        style={{ touchAction: 'none' }}
      >
        <img
          ref={imageRef}
          src={imageSrc}
          alt="Document to crop"
          className="w-full aspect-[4/3] object-contain"
          onLoad={handleImageLoad}
          draggable={false}
        />

        {imageLoaded && (
          <>
            {/* Dark overlay outside crop area */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <mask id="cropMask">
                  <rect width="100" height="100" fill="white" />
                  <polygon 
                    points={corners.map(c => `${c.x * 100},${c.y * 100}`).join(' ')}
                    fill="black"
                  />
                </mask>
              </defs>
              <rect 
                width="100" 
                height="100" 
                fill="rgba(0,0,0,0.5)" 
                mask="url(#cropMask)"
              />
              
              {/* Crop border */}
              <polygon
                points={corners.map(c => `${c.x * 100},${c.y * 100}`).join(' ')}
                fill="none"
                stroke="#C84C1C"
                strokeWidth="0.5"
                strokeDasharray="2,1"
              />
            </svg>

            {/* Draggable corners */}
            {corners.map((corner, index) => (
              <div
                key={index}
                className={`absolute cursor-move z-10 transition-transform ${
                  draggingIndex === index ? 'scale-125 z-20' : 'hover:scale-110'
                }`}
                style={{
                  left: `${corner.x * 100}%`,
                  top: `${corner.y * 100}%`,
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
                    draggingIndex === index ? 'bg-primary' : 'bg-white'
                  }`}
                  style={{
                    width: `${CORNER_SIZE}px`,
                    height: `${CORNER_SIZE}px`,
                    left: `${(CORNER_HIT_AREA - CORNER_SIZE) / 2}px`,
                    top: `${(CORNER_HIT_AREA - CORNER_SIZE) / 2}px`,
                  }}
                >
                  {/* Corner direction indicator */}
                  <div 
                    className="absolute w-full h-full"
                    style={{
                      background: `
                        linear-gradient(to ${
                          index === 0 ? 'bottom right' :
                          index === 1 ? 'bottom left' :
                          index === 2 ? 'top left' : 'top right'
                        }, transparent 50%, rgba(0,0,0,0.1) 50%)
                      `,
                      borderRadius: '50%',
                    }}
                  />
                </div>
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
            className="flex items-center gap-2 px-6 py-3 border-2 border-foreground font-bold transition-all hover:bg-accent"
          >
            <svg
              className="w-5 h-5"
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
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white border-2 border-foreground font-bold transition-all hover:opacity-90"
          >
            <svg
              className="w-5 h-5"
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

        <p className="text-center text-sm text-muted-foreground mt-4">
          Drag the corners to adjust the document boundaries
        </p>
      </div>
    </div>
  );
}
