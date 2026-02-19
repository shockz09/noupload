"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DraftRecoveryDialogProps {
  open: boolean;
  savedAt: number;
  onResume: () => void;
  onDiscard: () => void;
}

export function DraftRecoveryDialog({ open, savedAt, onResume, onDiscard }: DraftRecoveryDialogProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="bg-card border-2 border-foreground rounded-none max-w-md"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Resume Editing?</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            You have an unsaved draft from <span className="font-semibold text-foreground">{formatTime(savedAt)}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-3 sm:justify-stretch">
          <button type="button" onClick={onResume} className="btn-primary flex-1 py-3">
            Resume Draft
          </button>
          <button type="button" onClick={onDiscard} className="btn-secondary flex-1 py-3">
            Start Fresh
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
