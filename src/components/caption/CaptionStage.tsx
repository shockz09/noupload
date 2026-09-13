import { memo, useCallback, useEffect, useRef, useState } from "react";
import { VolumeIcon } from "@/components/icons/audio";
import { PauseIcon, PlayIcon } from "@/components/icons/ui";
import { type Cue, clock, cueAt } from "@/lib/caption/cues";

/**
 * The media, with the subtitles on it.
 *
 * One `<video>` element plays everything — for an audio file it simply has no
 * picture, and the component dresses it as an audio player instead of showing a
 * black rectangle where a video would be.
 *
 * Two things here are worth knowing about:
 *
 * Captions are driven off the frame clock (`requestVideoFrameCallback`, or
 * animation frames for audio) rather than `timeupdate`, which only fires about
 * four times a second and would show every line up to 250 ms late. The overlay
 * text and the playhead are written straight to the DOM instead of through
 * state, because the page around them — an editable list of a few hundred rows
 * — has no business re-rendering sixty times a second.
 *
 * The strip underneath is one tick per subtitle across the whole duration. It
 * is not a progress bar; it is the shape of the talking, so a glance shows
 * where the gaps are, and a click jumps there.
 */

interface CaptionStageProps {
  src: string;
  cues: Cue[];
  duration: number;
  /** Loudness envelope, 0..1 per bucket. Drawn as the waveform for audio files. */
  peaks: number[];
  /**
   * Whether the file is expected to have a picture, from its name. The element
   * reports the truth on `loadedmetadata`, but that is a beat too late: an
   * audio file would show a black video frame until it arrives, and if the
   * media never loads at all it would stay there.
   */
  expectVideo: boolean;
  /** Fires only when the covering cue changes, not every frame. */
  onActiveChange: (index: number) => void;
  mediaRef: React.RefObject<HTMLVideoElement | null>;
}

export const CaptionStage = memo(function CaptionStage({
  src,
  cues,
  duration,
  peaks,
  expectVideo,
  onActiveChange,
  mediaRef,
}: CaptionStageProps) {
  const overlayRef = useRef<HTMLParagraphElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  /** Whatever draws playback position: a bar for video, the waveform for audio. */
  const progressRef = useRef<HTMLSpanElement>(null);
  /** What the overlay currently says, so a re-cut cue is not left stale on it. */
  const shownRef = useRef({ index: -1, text: "" });
  const cuesRef = useRef(cues);

  const [audioOnly, setAudioOnly] = useState(!expectVideo);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  // Whole seconds only: the clock is the one thing here that needs to re-render,
  // and it needs to do so once a second, not once a frame.
  const [elapsed, setElapsed] = useState(0);

  // The sync loop reads cues through a ref: it must see the newest list without
  // being torn down and restarted every time a chunk of transcription lands.
  cuesRef.current = cues;

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    // Audio-only files never produce video frames, so they fall back to the
    // animation clock — same cadence, and it keeps running with no picture.
    const byFrame = typeof media.requestVideoFrameCallback === "function" && !audioOnly;
    let looping = false;
    let handle = 0;

    const sync = () => {
      const time = media.currentTime;

      if (duration > 0) {
        const percent = `${((time / duration) * 100).toFixed(2)}%`;
        if (headRef.current) headRef.current.style.left = percent;
        progressRef.current?.style.setProperty("--played", percent);
      }
      setElapsed((previous) => (Math.floor(time) === previous ? previous : Math.floor(time)));

      const index = cueAt(cuesRef.current, time);
      const text = index >= 0 ? cuesRef.current[index].text : "";
      const shown = shownRef.current;
      // Text as well as index: while transcription is still running the words
      // under a given index keep changing as each window re-cuts the cues, and
      // watching the index alone would leave the last version on screen.
      if (index === shown.index && text === shown.text) return;

      shownRef.current = { index, text };
      if (overlayRef.current) {
        overlayRef.current.textContent = text;
        overlayRef.current.hidden = index < 0;
      }
      if (index !== shown.index) onActiveChange(index);
    };

    const frame = () => {
      sync();
      if (looping) handle = byFrame ? media.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
    };

    // Only run the clock while the media is actually moving. A paused audio
    // file would otherwise hold an animation frame open forever, re-reading the
    // time and writing styles sixty times a second to say nothing changed.
    const startLoop = () => {
      if (looping) return;
      looping = true;
      handle = byFrame ? media.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
    };

    const stopLoop = () => {
      if (!looping) return;
      looping = false;
      if (byFrame) media.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
    };

    // Paused, the position still has to follow a seek or a newly loaded file.
    const settle = () => {
      sync();
      if (!media.paused && !media.ended) startLoop();
    };

    media.addEventListener("play", startLoop);
    media.addEventListener("playing", startLoop);
    media.addEventListener("pause", stopLoop);
    media.addEventListener("ended", stopLoop);
    media.addEventListener("seeked", settle);
    media.addEventListener("loadedmetadata", settle);
    settle();

    return () => {
      stopLoop();
      media.removeEventListener("play", startLoop);
      media.removeEventListener("playing", startLoop);
      media.removeEventListener("pause", stopLoop);
      media.removeEventListener("ended", stopLoop);
      media.removeEventListener("seeked", settle);
      media.removeEventListener("loadedmetadata", settle);
    };
  }, [mediaRef, duration, onActiveChange, audioOnly]);

  // Cues are re-cut as each window of transcription lands. While the media is
  // paused nothing is driving the clock, so the overlay is refreshed here
  // instead — otherwise a line fixed in the list would not change on the video.
  useEffect(() => {
    const media = mediaRef.current;
    if (!media?.paused) return;
    const index = cueAt(cues, media.currentTime);
    const text = index >= 0 ? cues[index].text : "";
    if (index === shownRef.current.index && text === shownRef.current.text) return;
    shownRef.current = { index, text };
    if (overlayRef.current) {
      overlayRef.current.textContent = text;
      overlayRef.current.hidden = index < 0;
    }
  }, [cues, mediaRef]);

  // Captions should scale with the frame they sit in, not with the viewport:
  // the same clip in a narrow column and a wide one wants different type.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      const size = Math.max(14, Math.min(26, entry.contentRect.width * 0.032));
      frame.style.setProperty("--caption-size", `${size}px`);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const togglePlay = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) void media.play().catch(() => {});
    else media.pause();
  }, [mediaRef]);

  const toggleMute = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.muted = !media.muted;
    setMuted(media.muted);
  }, [mediaRef]);

  const seekFromPointer = useCallback(
    (clientX: number, element: HTMLElement) => {
      const media = mediaRef.current;
      if (!media || duration <= 0) return;
      const bounds = element.getBoundingClientRect();
      const fraction = (clientX - bounds.left) / bounds.width;
      media.currentTime = Math.max(0, Math.min(duration, fraction * duration));
    },
    [mediaRef, duration],
  );

  const captionPlate = (
    <p
      ref={overlayRef}
      hidden
      className={
        audioOnly
          ? "whitespace-pre-wrap text-center font-semibold leading-snug"
          : "inline-block whitespace-pre-wrap bg-black px-2 py-1 text-left font-semibold leading-snug text-white"
      }
      style={{ fontSize: "var(--caption-size, 18px)" }}
    />
  );

  return (
    <div className="space-y-3">
      {/* One element, one place in the tree, whatever kind of file it is: moving
          the video between branches when the picture turns out to be missing
          would remount it and reload the source. */}
      <div ref={frameRef} className={`relative ${audioOnly ? "" : "border-2 border-foreground bg-black"}`}>
        {/* Captions are drawn over the media by this component rather than
            attached as a text track, so the list and the overlay never disagree. */}
        <video
          ref={mediaRef}
          src={src}
          playsInline
          preload="metadata"
          onClick={togglePlay}
          onLoadedMetadata={(event) => setAudioOnly(event.currentTarget.videoHeight === 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className={audioOnly ? "h-0 w-full" : "w-full max-h-[58vh] cursor-pointer bg-black"}
        />

        {!audioOnly && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-16 px-[5%] text-center">{captionPlate}</div>

            {/* The app's own transport rather than the browser's: the native bar
                sits exactly where the captions go, and looks nothing like the
                rest of the page. */}
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/85 to-transparent px-3 pt-8 pb-2">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
                className="text-white transition-opacity hover:opacity-70"
              >
                {playing ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
              </button>

              <span className="font-mono text-xs tabular-nums text-white/80">
                {clock(elapsed)} / {clock(duration)}
              </span>

              <button
                type="button"
                aria-label="Seek"
                onClick={(event) => seekFromPointer(event.clientX, event.currentTarget)}
                className="relative h-4 flex-1 cursor-pointer"
              >
                <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-white/25" />
                {/* A <span>, not a <div>: this is inside a <button>, which may
                    only hold phrasing content. */}
                <span
                  ref={progressRef}
                  className="absolute inset-y-0 left-0 right-0 block"
                  style={{ clipPath: "inset(0 calc(100% - var(--played, 0%)) 0 0)" }}
                >
                  <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-white" />
                </span>
              </button>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className={`text-white transition-opacity hover:opacity-70 ${muted ? "opacity-40" : ""}`}
              >
                <VolumeIcon className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else void mediaRef.current?.requestFullscreen?.();
                }}
                aria-label="Fullscreen"
                className="text-white transition-opacity hover:opacity-70"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {audioOnly && (
        // No picture to fill a frame, so the captions get a plate of their own
        // above the player the rest of the app uses for audio.
        <div className="border-2 border-foreground bg-background">
          <div className="grid min-h-[104px] place-items-center border-b-2 border-foreground bg-muted/30 px-6 py-6">
            {captionPlate}
          </div>

          <div className="flex items-stretch">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className={`grid h-16 w-16 shrink-0 place-items-center border-r-2 border-foreground transition-colors ${
                playing
                  ? "bg-foreground text-background"
                  : "bg-background text-foreground hover:bg-foreground hover:text-background"
              }`}
            >
              {playing ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6 ml-0.5" />}
            </button>

            <div className="flex min-w-0 flex-1 flex-col">
              <button
                type="button"
                aria-label="Seek"
                onClick={(event) => seekFromPointer(event.clientX, event.currentTarget)}
                className="relative min-h-[44px] flex-1 cursor-pointer overflow-hidden bg-muted/40"
              >
                <Waveform peaks={peaks} className="text-foreground/20" />
                {/* The same bars again, clipped to how far playback has got.
                      Clipping one layer keeps the bars identical and needs no
                      per-frame React work — only a CSS variable moves. */}
                <span
                  ref={progressRef}
                  className="absolute inset-0 block"
                  style={{ clipPath: "inset(0 calc(100% - var(--played, 0%)) 0 0)" }}
                >
                  <Waveform peaks={peaks} className="text-primary" />
                </span>
              </button>

              <div className="flex items-center gap-3 border-t-2 border-foreground px-3 py-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {clock(elapsed)} / {clock(duration)}
                </span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute" : "Mute"}
                  className={`transition-opacity hover:opacity-60 ${muted ? "opacity-40" : ""}`}
                >
                  <VolumeIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cues.length > 0 && duration > 0 && (
        <button
          type="button"
          aria-label="Jump to a point in the media"
          onClick={(event) => seekFromPointer(event.clientX, event.currentTarget)}
          className="relative block h-6 w-full cursor-pointer"
        >
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground/20" />
          {cues.map((cue) => (
            <span
              key={cue.start}
              className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-foreground/50"
              style={{ left: `${((cue.start / duration) * 100).toFixed(2)}%` }}
            />
          ))}
          <span
            ref={headRef}
            className="absolute top-0 h-6 w-1.5 -translate-x-1/2 border border-foreground bg-primary"
            style={{ left: "0%" }}
          />
        </button>
      )}
    </div>
  );
});

/** Loudness bars. Flat and faint until the envelope arrives from the worker. */
const Waveform = memo(function Waveform({ peaks, className }: { peaks: number[]; className: string }) {
  const bars = peaks.length > 0 ? peaks : new Array(120).fill(0.08);
  return (
    <span className={`absolute inset-0 flex items-center gap-px px-1 ${className}`}>
      {bars.map((peak, index) => (
        <span
          // Bars are a fixed-length envelope, not a list of things: position
          // is the only identity they have.
          key={index}
          className="flex-1 bg-current"
          style={{ height: `${Math.max(6, peak * 82)}%` }}
        />
      ))}
    </span>
  );
});
