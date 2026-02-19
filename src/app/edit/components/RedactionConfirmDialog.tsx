"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RedactionConfirmDialogProps {
  open: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RedactionConfirmDialog({ open, count, onConfirm, onCancel }: RedactionConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="bg-card border-2 border-foreground rounded-none max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 flex items-center justify-center shrink-0">
              <svg
                aria-hidden="true"
                className="w-6 h-6 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M3.6 9h16.8L12 3.6z" />
                <path d="M3.6 9v9.8a2 2 0 0 0 2 2h12.8a2 2 0 0 0 2-2V9" />
              </svg>
            </div>
            <DialogTitle className="text-xl font-bold">Apply Redactions?</DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="text-muted-foreground">
                Your document contains{" "}
                <span className="font-bold text-foreground">
                  {count} redaction{count !== 1 ? "s" : ""}
                </span>
                .
              </p>
              <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-500 p-3">
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  This action permanently removes the redacted content.
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  The content cannot be recovered once the PDF is exported.
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-row gap-3 sm:justify-stretch">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold transition-colors border-2 border-red-600"
          >
            Apply & Export
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-3">
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
