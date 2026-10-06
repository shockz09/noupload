// Auto captions for the editor: transcribe the edit's own audio mix with the
// on-device speech model the Subtitles tool uses, then drop the lines onto a
// text track as ordinary, editable text clips.

import { useEffect, useState } from "react";
import { ProgressBar } from "@/components/video/shared";
import type { Cue } from "@/lib/caption/cues";
import { useCaptioner } from "@/lib/caption/useCaptioner";

function fmtMB(bytes: number) {
  return `${Math.round(bytes / 1e6)} MB`;
}

export function CaptionsDialog({
  getPcm,
  onAdd,
  onClose,
}: {
  /** The edit's audio as 16 kHz mono, or null when nothing is audible. */
  getPcm: () => Promise<Float32Array | null>;
  onAdd: (cues: Cue[]) => void;
  onClose: () => void;
}) {
  const cap = useCaptioner();
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const noGpu = cap.model.phase === "error" && cap.model.failure === "no-webgpu";
  const running = preparing || cap.run.phase === "reading" || cap.run.phase === "transcribing";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !running) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, running]);

  const generate = async () => {
    setProblem(null);
    setPreparing(true);
    try {
      const pcm = await getPcm();
      if (!pcm || pcm.length === 0) {
        setProblem("There's no audible audio in the edit to caption.");
        return;
      }
      cap.startPcm(pcm, 16_000);
    } catch {
      setProblem("Couldn't mix the edit's audio for captioning.");
    } finally {
      setPreparing(false);
    }
  };

  const fetching = cap.model.phase === "fetching";
  const progress = fetching
    ? cap.model.bytesReady / Math.max(1, cap.model.bytesTotal)
    : cap.run.duration > 0
      ? cap.run.secondsDone / cap.run.duration
      : 0;
  const label = preparing
    ? "Mixing the edit's audio…"
    : fetching
      ? `Downloading the speech model · ${fmtMB(cap.model.bytesReady)} of ${fmtMB(cap.model.bytesTotal)}`
      : cap.model.phase === "compiling"
        ? "Getting the model ready…"
        : `Listening · ${Math.round(cap.run.secondsDone)}s of ${Math.round(cap.run.duration)}s`;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-foreground/40">
      <div className="w-full max-w-md max-h-full overflow-y-auto border-2 border-foreground bg-background p-6 shadow-[8px_8px_0_0_var(--foreground)] select-text">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]">Captions</p>
        <h2 className="font-display text-3xl mt-1 mb-3">Auto captions</h2>
        <p className="text-sm text-muted-foreground">
          Transcribes everything you can hear in the edit and adds it as text clips you can restyle and fix. It runs on
          this device: the speech model downloads once ({fmtMB(cap.model.bytesTotal)}), and nothing leaves your browser.
        </p>

        <div className="mt-5 space-y-3">
          {noGpu && (
            <p className="text-sm border-2 border-foreground bg-card p-3">
              This needs WebGPU, which this browser doesn't have turned on. Chrome or Edge on a desktop will work.
            </p>
          )}
          {(problem || cap.error) && <p className="text-sm text-destructive font-bold">{problem ?? cap.error}</p>}
          {running && <ProgressBar progress={Math.round(progress * 100)} label={label} />}
          {cap.finished && (
            <div className="border-2 border-foreground bg-card">
              <p className="px-3 py-2 border-b-2 border-foreground text-xs font-bold">
                {cap.cues.length} {cap.cues.length === 1 ? "line" : "lines"} found
              </p>
              <ul className="max-h-40 overflow-y-auto divide-y divide-foreground/10">
                {cap.cues.slice(0, 50).map((c, i) => (
                  <li key={i} className="px-3 py-1.5 text-xs">
                    <span className="font-mono text-muted-foreground mr-2">{c.start.toFixed(1)}s</span>
                    {c.text.replace("\n", " ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => {
              if (running) cap.cancel();
              else onClose();
            }}
          >
            {running ? "Stop" : "Cancel"}
          </button>
          {cap.finished && cap.cues.length > 0 ? (
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                onAdd(cap.cues);
                onClose();
              }}
            >
              Add to timeline
            </button>
          ) : (
            <button type="button" className="btn-primary flex-1" disabled={noGpu || running} onClick={generate}>
              {cap.finished ? "Try again" : "Generate"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
