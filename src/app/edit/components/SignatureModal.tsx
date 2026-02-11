"use client";

import { useCallback, useState } from "react";
import { SignatureDrawPad, SignatureUpload } from "@/components/signature";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  onSignatureCreate: (dataUrl: string) => void;
}

type TabType = "draw" | "type" | "upload";

const FONTS = [
  { name: "Script", value: "'Dancing Script', cursive" },
  { name: "Elegant", value: "'Great Vibes', cursive" },
  { name: "Casual", value: "'Caveat', cursive" },
  { name: "Bold", value: "'Permanent Marker', cursive" },
];

export function SignatureModal({ open, onClose, onSignatureCreate }: SignatureModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("draw");
  const [typedText, setTypedText] = useState("");
  const [selectedFont, setSelectedFont] = useState("'Dancing Script', cursive");

  const handleSignatureReady = useCallback(
    (dataUrl: string) => {
      onSignatureCreate(dataUrl);
      onClose();
    },
    [onSignatureCreate, onClose],
  );

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleFontChange = useCallback((font: string) => {
    setSelectedFont(font);
  }, []);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTypedText(e.target.value);
  }, []);

  const handleTypeSignature = useCallback(() => {
    if (!typedText.trim()) return;

    // Create a canvas to render the typed signature
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `48px ${selectedFont}`;
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "middle";
    ctx.fillText(typedText, 20, 50);

    // Make white pixels transparent
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
        data[i + 3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    handleSignatureReady(canvas.toDataURL("image/png"));
  }, [typedText, selectedFont, handleSignatureReady]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="bg-card border-2 border-foreground rounded-none p-0 gap-0 max-w-lg"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="flex-row items-center justify-between border-b-2 border-foreground px-4 py-3 space-y-0">
          <DialogTitle className="font-bold text-lg">Add Signature</DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b-2 border-foreground">
          {(["draw", "type", "upload"] as TabType[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                activeTab === tab ? "bg-primary text-white" : "bg-card hover:bg-muted"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === "draw" && <SignatureDrawPad onSignatureReady={handleSignatureReady} height={150} />}

          {activeTab === "type" && (
            <div className="space-y-4">
              <label className="sr-only" htmlFor="signature-text">
                Type your signature
              </label>
              <input
                id="signature-text"
                type="text"
                value={typedText}
                onChange={handleTextChange}
                placeholder="Type your signature"
                className="w-full border-2 border-foreground/30 px-4 py-3 text-2xl focus:border-primary focus:outline-none"
                style={{ fontFamily: selectedFont }}
                autoFocus
              />
              <div className="flex gap-2 flex-wrap">
                {FONTS.map((font) => (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() => handleFontChange(font.value)}
                    className={`px-3 py-1 text-sm border-2 transition-colors ${
                      selectedFont === font.value
                        ? "border-primary bg-primary/10"
                        : "border-foreground/30 hover:border-foreground/50"
                    }`}
                    style={{ fontFamily: font.value }}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
              <div
                className="border-2 border-foreground/30 p-4 h-24 flex items-center"
                style={{ fontFamily: selectedFont }}
                aria-live="polite"
              >
                <span className="text-4xl">{typedText || "Preview"}</span>
              </div>
              <button
                type="button"
                onClick={handleTypeSignature}
                disabled={!typedText.trim()}
                className="btn-primary py-2 px-4 text-sm w-full disabled:opacity-50"
              >
                Use Signature
              </button>
            </div>
          )}

          {activeTab === "upload" && <SignatureUpload onSignatureReady={handleSignatureReady} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
