"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { PdfPageHeader } from "@/components/pdf/shared";
import { ErrorBox } from "@/components/shared";
import { downloadBlob } from "@/lib/download";
import { getErrorMessage } from "@/lib/error";
import { getFileBaseName } from "@/lib/utils";
import { DraftRecoveryDialog } from "./components/DraftRecoveryDialog";
import { EditorCanvas } from "./components/EditorCanvas";
import { EditorToolbar, type StampData } from "./components/EditorToolbar";
import { PageSidebar } from "./components/PageSidebar";
import { RedactionConfirmDialog } from "./components/RedactionConfirmDialog";
import { SignatureModal } from "./components/SignatureModal";
import { ZoomControls } from "./components/ZoomControls";
import { useAutoSave } from "./hooks/useAutoSave";
import type { FormField } from "./hooks/useFormFields";
import { countRedactions, exportPdf } from "./lib/export-pdf";

// Edit icon for the header
const EditIcon = memo(function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
});

export interface PageState {
  pageNumber: number;
  rotation: 0 | 90 | 180 | 270;
  deleted: boolean;
}

export type Tool =
  | "select"
  | "text"
  | "signature"
  | "highlight"
  | "underline"
  | "strikethrough"
  | "draw"
  | "shape-rect"
  | "shape-circle"
  | "shape-arrow"
  | "shape-line"
  | "stamp"
  | "image"
  | "whiteout"
  | "redact";

export default function EditPdfPage() {
  // File state
  const [file, setFile] = useState<File | null>(null);

  // Editor state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [pageStates, setPageStates] = useState<PageState[]>([]);

  // Draft recovery state
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftChecked, setDraftChecked] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [showRedactionDialog, setShowRedactionDialog] = useState(false);
  const [redactionCount, setRedactionCount] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);

  // Form fields state
  const [formFields, setFormFields] = useState<FormField[]>([]);

  // Toolbar options
  const [highlightColor, setHighlightColor] = useState("#FFEB3B");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [fillColor] = useState("transparent");

  // Text formatting state
  const [isUnderlineActive, setIsUnderlineActive] = useState(false);
  const [isStrikethroughActive, setIsStrikethroughActive] = useState(false);

  // Refs for text formatting functions from EditorCanvas
  const applyUnderlineRef = useRef<(() => void) | null>(null);
  const applyStrikethroughRef = useRef<(() => void) | null>(null);

  const handleToggleUnderline = useCallback(() => {
    setIsUnderlineActive((prev) => !prev);
    applyUnderlineRef.current?.();
  }, []);

  const handleToggleStrikethrough = useCallback(() => {
    setIsStrikethroughActive((prev) => !prev);
    applyStrikethroughRef.current?.();
  }, []);

  const handleTextFormattingChange = useCallback(
    (
      applyUnderline: () => void,
      applyStrikethrough: () => void,
      currentUnderline: boolean,
      currentStrikethrough: boolean,
    ) => {
      applyUnderlineRef.current = applyUnderline;
      applyStrikethroughRef.current = applyStrikethrough;
      setIsUnderlineActive(currentUnderline);
      setIsStrikethroughActive(currentStrikethrough);
    },
    [],
  );

  // Reset text formatting when switching away from text tool
  useEffect(() => {
    if (activeTool !== "text") {
      setIsUnderlineActive(false);
      setIsStrikethroughActive(false);
    }
  }, [activeTool]);

  // Page objects (Fabric.js objects per page)
  const [pageObjects, setPageObjects] = useState<Map<number, object[]>>(new Map());

  // Undo/redo state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoRef = useRef<(() => void) | null>(null);
  const redoRef = useRef<(() => void) | null>(null);

  const handleUndoRedoChange = useCallback(
    (newCanUndo: boolean, newCanRedo: boolean, undoFn: () => void, redoFn: () => void) => {
      setCanUndo(newCanUndo);
      setCanRedo(newCanRedo);
      undoRef.current = undoFn;
      redoRef.current = redoFn;
    },
    [],
  );

  const handleUndo = useCallback(() => {
    undoRef.current?.();
  }, []);

  const handleRedo = useCallback(() => {
    redoRef.current?.();
  }, []);

  // Signature modal state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);

  const handleSignatureCreate = useCallback((dataUrl: string) => {
    setPendingSignature(dataUrl);
    setActiveTool("select"); // Switch to select after creating signature
  }, []);

  // Stamp state
  const [pendingStamp, setPendingStamp] = useState<StampData | null>(null);

  const handleStampSelect = useCallback((stamp: StampData) => {
    setPendingStamp(stamp);
    setActiveTool("select");
  }, []);

  // Image state
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  const handleImageSelect = useCallback((dataUrl: string) => {
    setPendingImage(dataUrl);
  }, []);

  const handleObjectsChange = useCallback((pageNumber: number, objects: object[]) => {
    setPageObjects((prev) => {
      const next = new Map(prev);
      next.set(pageNumber, objects);
      return next;
    });
  }, []);

  const handleFileSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setCurrentPage(1);
      setZoom(1);
      setActiveTool("select");
    }
  }, []);

  const handleTotalPagesChange = useCallback((total: number) => {
    setTotalPages(total);
    // Initialize page states
    setPageStates(
      Array.from({ length: total }, (_, i) => ({
        pageNumber: i + 1,
        rotation: 0,
        deleted: false,
      })),
    );
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.25, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.25, 0.25));
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages],
  );

  const handleClear = useCallback(() => {
    setFile(null);
    setCurrentPage(1);
    setTotalPages(0);
    setZoom(1);
    setActiveTool("select");
    setPageStates([]);
    setPageObjects(new Map());
  }, []);

  // Modal/dialog callbacks - memoized to prevent child re-renders
  const openSignatureModal = useCallback(() => setShowSignatureModal(true), []);
  const closeSignatureModal = useCallback(() => setShowSignatureModal(false), []);
  const clearPendingSignature = useCallback(() => setPendingSignature(null), []);
  const clearPendingStamp = useCallback(() => setPendingStamp(null), []);
  const clearPendingImage = useCallback(() => setPendingImage(null), []);
  const closeRedactionDialog = useCallback(() => setShowRedactionDialog(false), []);

  // Auto-save hook
  const { draft, hasDraft, clearDraft, loadDraft } = useAutoSave({
    file,
    pageStates,
    pageObjects,
    currentPage,
    enabled: !!file, // Only save when file is loaded
  });

  // Check for existing draft on mount
  useEffect(() => {
    if (!draftChecked && hasDraft && !file) {
      setShowDraftDialog(true);
      setDraftChecked(true);
    }
  }, [draftChecked, hasDraft, file]);

  const handleResumeDraft = useCallback(async () => {
    const draftData = await loadDraft();
    if (draftData) {
      const blob = new Blob([draftData.fileData], { type: "application/pdf" });
      const restoredFile = new File([blob], draftData.fileName, { type: "application/pdf" });

      setFile(restoredFile);
      setCurrentPage(draftData.currentPage);
      setPageStates(draftData.pageStates);
      setPageObjects(new Map(draftData.pageObjects));
    }
    setShowDraftDialog(false);
  }, [loadDraft]);

  const handleDiscardDraft = useCallback(async () => {
    await clearDraft();
    setShowDraftDialog(false);
  }, [clearDraft]);

  // Export handlers
  const performExport = useCallback(async () => {
    if (!file) return;

    setIsExporting(true);
    setShowRedactionDialog(false);

    try {
      const pdfBytes = await exportPdf({
        file,
        pageStates,
        pageObjects,
        formFields,
      });

      // Generate filename
      const baseName = getFileBaseName(file.name);
      const filename = `${baseName}-edited.pdf`;

      downloadBlob(pdfBytes, filename);

      // Clear draft after successful export
      await clearDraft();
    } catch (err) {
      console.error("Export failed:", err);
      setExportError(getErrorMessage(err, "Failed to export PDF. Please try again."));
    } finally {
      setIsExporting(false);
    }
  }, [file, pageStates, pageObjects, formFields, clearDraft]);

  const handleExportClick = useCallback(() => {
    if (!file) return;

    // Check for redactions
    const count = countRedactions(pageObjects);
    if (count > 0) {
      setRedactionCount(count);
      setShowRedactionDialog(true);
    } else {
      performExport();
    }
  }, [file, pageObjects, performExport]);

  return (
    <div className="page-enter">
      {!file ? (
        <div className="max-w-4xl mx-auto space-y-8">
          <PdfPageHeader
            icon={<EditIcon className="w-7 h-7" />}
            iconClass="tool-edit"
            title="Edit PDF"
            description="Add text, signatures, highlights, shapes, and more"
          />

          <FileDropzone
            accept=".pdf"
            multiple={false}
            onFilesSelected={handleFileSelected}
            title="Drop your PDF file here"
          />
        </div>
      ) : (
        <div className="h-[calc(100vh-120px)] flex flex-col">
          {/* Toolbar */}
          <EditorToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            highlightColor={highlightColor}
            onHighlightColorChange={setHighlightColor}
            strokeColor={strokeColor}
            onStrokeColorChange={setStrokeColor}
            onClear={handleClear}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onSignatureClick={openSignatureModal}
            onStampSelect={handleStampSelect}
            onImageSelect={handleImageSelect}
            isUnderlineActive={isUnderlineActive}
            isStrikethroughActive={isStrikethroughActive}
            onToggleUnderline={handleToggleUnderline}
            onToggleStrikethrough={handleToggleStrikethrough}
          />

          {/* Main editor area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Page sidebar */}
            <PageSidebar
              file={file}
              currentPage={currentPage}
              pageStates={pageStates}
              onPageSelect={handlePageChange}
              onPageStatesChange={setPageStates}
              onTotalPagesChange={handleTotalPagesChange}
            />

            {/* Canvas area */}
            <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
              <EditorCanvas
                file={file}
                currentPage={currentPage}
                zoom={zoom}
                activeTool={activeTool}
                pageStates={pageStates}
                highlightColor={highlightColor}
                strokeColor={strokeColor}
                fillColor={fillColor}
                pageObjects={pageObjects}
                onObjectsChange={handleObjectsChange}
                onUndoRedoChange={handleUndoRedoChange}
                pendingSignature={pendingSignature}
                onSignaturePlaced={clearPendingSignature}
                pendingStamp={pendingStamp}
                onStampPlaced={clearPendingStamp}
                pendingImage={pendingImage}
                onImagePlaced={clearPendingImage}
                onFormFieldsChange={setFormFields}
                onToolChange={setActiveTool}
                onTextFormattingChange={handleTextFormattingChange}
              />

              {/* Export Error */}
              {exportError && (
                <div className="px-4 py-2">
                  <ErrorBox message={exportError} />
                </div>
              )}

              {/* Zoom controls */}
              <ZoomControls
                zoom={zoom}
                currentPage={currentPage}
                totalPages={totalPages}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onPageChange={handlePageChange}
                onExport={handleExportClick}
                isExporting={isExporting}
              />
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      <SignatureModal
        open={showSignatureModal}
        onClose={closeSignatureModal}
        onSignatureCreate={handleSignatureCreate}
      />

      {/* Draft Recovery Dialog */}
      <DraftRecoveryDialog
        open={showDraftDialog}
        savedAt={draft?.savedAt ?? 0}
        onResume={handleResumeDraft}
        onDiscard={handleDiscardDraft}
      />

      {/* Redaction Confirm Dialog */}
      <RedactionConfirmDialog
        open={showRedactionDialog}
        count={redactionCount}
        onConfirm={performExport}
        onCancel={closeRedactionDialog}
      />
    </div>
  );
}
