// The editor's right-hand panel: whatever is selected decides what shows.
// Advanced sections start folded and carry a dot once they change something,
// so the common controls stay in reach without hiding what's been done.

import { useState } from "react";
import { fmtTime } from "@/components/video-editor/Timeline";
import {
  type AnimProp,
  type Clip,
  type ColorAdjust,
  type Crop,
  clipEnd,
  isNeutral,
  MAX_SPEED,
  MAX_VOLUME,
  type MediaClip,
  type MediaItem,
  MIN_SPEED,
  NEUTRAL_COLOR,
  NO_CROP,
  type Pose,
  type Project,
  projectDuration,
  type TextAnim,
  type TextClip,
  type Track,
} from "@/lib/video/editor/model";

// ── Building blocks ──────────────────────────────────────────

// Fold state outlives selection changes, so a section opened once stays open.
const folds = new Map<string, boolean>();

export function Section({
  title,
  children,
  action,
  collapsible,
  defaultOpen = true,
  changed,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  changed?: boolean;
}) {
  const [open, setOpen] = useState(() => folds.get(title) ?? defaultOpen);
  const shown = !collapsible || open;
  const heading = (
    <span className="flex items-center gap-1.5">
      {collapsible && (
        <svg
          aria-hidden="true"
          viewBox="0 0 10 10"
          className={`w-2.5 h-2.5 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="M3 1.5L7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth={2} />
        </svg>
      )}
      <h3 className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
      {changed && <span title="Changed" className="w-1.5 h-1.5 rounded-full bg-primary" />}
    </span>
  );
  return (
    <section className={`px-4 border-b-2 border-foreground/10 ${shown ? "py-4 space-y-3.5" : "py-3"}`}>
      <div className="flex items-center justify-between">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => {
              folds.set(title, !open);
              setOpen(!open);
            }}
            className="hover:text-foreground"
          >
            {heading}
          </button>
        ) : (
          heading
        )}
        {shown && action}
      </div>
      {shown && children}
    </section>
  );
}

/** Track fill up to the thumb, for .range-brutal. */
export const fill = (v: number, min: number, max: number) =>
  ({ "--fill": `${((v - min) / (max - min || 1)) * 100}%` }) as React.CSSProperties;

export const pct = (v: number) => `${Math.round(v * 100)}%`;
const secs = (v: number) => `${v.toFixed(1)}s`;
const signed = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}`;
const deg = (v: number) => `${Math.round(v)}°`;

export interface KeyToggle {
  /** A keyframe sits at the playhead. */
  on: boolean;
  /** The property has keyframes at all. */
  animated: boolean;
  onToggle: () => void;
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onLive,
  onCommit,
  keyframe,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onLive: (v: number) => void;
  onCommit: () => void;
  keyframe?: KeyToggle;
}) {
  return (
    <div className="block">
      <span className="flex items-center justify-between mb-1.5 gap-2">
        <span className="flex items-center gap-1.5 min-w-0">
          {keyframe && (
            <button
              type="button"
              onClick={keyframe.onToggle}
              title={
                keyframe.on
                  ? "Remove keyframe here"
                  : keyframe.animated
                    ? "Add keyframe here"
                    : "Animate: add a keyframe here"
              }
              aria-label={`${label} keyframe`}
              aria-pressed={keyframe.on}
              className={`w-3 h-3 shrink-0 rotate-45 border-2 border-foreground transition-colors ${
                keyframe.on
                  ? "bg-yellow-400"
                  : keyframe.animated
                    ? "bg-yellow-400/30 hover:bg-yellow-400/60"
                    : "bg-card hover:bg-accent"
              }`}
            />
          )}
          <span className="text-xs font-bold truncate">{label}</span>
        </span>
        <span className="text-[11px] font-mono font-bold px-1.5 bg-muted border border-foreground/20 tabular-nums">
          {format(value)}
        </span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onLive(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
        className="range-brutal w-full"
        style={fill(value, min, max)}
      />
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: React.ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="flex border-2 border-foreground bg-background" role="group" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`flex-1 min-w-0 h-8 px-1 text-xs font-bold transition-colors ${i > 0 ? "border-l-2 border-foreground" : ""} ${
            o.value === value ? "bg-foreground text-background" : "hover:bg-accent"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Like Segmented, but each button switches on and off by itself. */
function ToggleGroup({
  label,
  options,
}: {
  label: string;
  options: { key: string; label: React.ReactNode; title: string; on: boolean; onToggle: () => void }[];
}) {
  return (
    <div className="flex border-2 border-foreground bg-background" role="group" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.key}
          type="button"
          title={o.title}
          aria-label={o.title}
          aria-pressed={o.on}
          onClick={o.onToggle}
          className={`flex-1 min-w-0 h-8 px-1 text-xs font-bold transition-colors ${i > 0 ? "border-l-2 border-foreground" : ""} ${
            o.on ? "bg-foreground text-background" : "hover:bg-accent"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
  hint,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={hint}
      onClick={() => onChange(!on)}
      className="w-full flex items-center justify-between gap-3 text-left"
    >
      <span className="text-xs font-bold">{label}</span>
      <span
        className={`w-9 h-5 shrink-0 border-2 border-foreground relative transition-colors ${on ? "bg-primary" : "bg-background"}`}
      >
        <span className={`absolute top-0.5 w-3 h-3 bg-foreground transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-full h-8 text-xs font-bold border-2 border-foreground bg-background hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

const TEXT_COLORS = ["#ffffff", "#1a1612", "#facc15", "#c84c1c", "#38bdf8"];

export function ColorField({
  value,
  onLive,
  onCommit,
  presets = TEXT_COLORS,
}: {
  value: string;
  onLive: (v: string) => void;
  onCommit: () => void;
  presets?: string[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      {presets.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => {
            onLive(c);
            onCommit();
          }}
          className={`w-6 h-6 border-2 border-foreground ${value.toLowerCase() === c ? "ring-2 ring-primary ring-offset-1" : ""}`}
          style={{ background: c }}
        />
      ))}
      <input
        type="color"
        title="Custom colour"
        className="swatch-brutal ml-auto"
        value={value}
        onChange={(e) => onLive(e.target.value)}
        onBlur={onCommit}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-bold">{label}</span>
      {children}
    </div>
  );
}

// ── Clip editing API the inspectors talk to ──────────────────

export interface ClipActions<C extends Clip = Clip> {
  /** Continuous edit (a slider moving); one undo step per interaction. */
  live: (patch: Partial<C>) => void;
  /** Ends a continuous edit. */
  commit: () => void;
  /** One-off edit. */
  patch: (patch: Partial<C>) => void;
  /** The animatable values at the playhead. */
  pose: Pose;
  livePose: (patch: Partial<Pose>) => void;
  patchPose: (patch: Partial<Pose>) => void;
  keyframe: (prop: AnimProp) => KeyToggle;
}

export interface MediaActions extends ClipActions<MediaClip> {
  setSpeed: (speed: number, live: boolean) => void;
  /** Scale at which the clip covers the whole frame. */
  fillScale: number;
  detachAudio: (() => void) | null;
  normalize: () => void;
  reverse: () => void;
  freeze: (() => void) | null;
  busy: string | null;
}

function ClipSummary({ thumb, name, clip, kind }: { thumb?: string | null; name: string; clip: Clip; kind: string }) {
  return (
    <div className="px-4 py-4 border-b-2 border-foreground/10 flex items-center gap-3">
      <div className="w-16 aspect-video shrink-0 border-2 border-foreground bg-muted overflow-hidden flex items-center justify-center">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{kind}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold truncate" title={name}>
          {name}
        </p>
        <p className="text-[11px] font-mono text-muted-foreground">
          {fmtTime(clip.start)} → {fmtTime(clipEnd(clip))} · {clip.duration.toFixed(1)}s
        </p>
      </div>
    </div>
  );
}

function TransformSection({
  clip,
  actions,
  media,
}: {
  clip: Clip;
  actions: ClipActions;
  media?: { fillScale: number; flipH: boolean; flipV: boolean; onFlip: (patch: Partial<MediaClip>) => void };
}) {
  const { pose, livePose, commit, patchPose, keyframe } = actions;
  const animated = Object.keys(clip.keyframes).length > 0;
  const moved = clip.x !== 0.5 || clip.y !== 0.5 || clip.rotation !== 0 || clip.opacity !== 1 || clip.scale !== 1;
  return (
    <Section
      title="Transform"
      changed={animated || moved || !!(media && (media.flipH || media.flipV))}
      action={
        <button
          type="button"
          className="text-[11px] font-bold underline underline-offset-2 text-muted-foreground hover:text-foreground"
          onClick={() => actions.patch({ x: 0.5, y: 0.5, scale: 1, opacity: 1, rotation: 0, keyframes: {} })}
        >
          Reset
        </button>
      }
    >
      {media && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Segmented
              label="Fit"
              options={[
                { value: "fit", label: "Fit", title: "Whole picture inside the frame" },
                { value: "fill", label: "Fill", title: "Cover the frame, cropping the overflow" },
              ]}
              value={
                Math.abs(pose.scale - 1) < 0.005
                  ? "fit"
                  : Math.abs(pose.scale - media.fillScale) < 0.005
                    ? "fill"
                    : ("" as "fit")
              }
              onChange={(v) => patchPose({ scale: v === "fill" ? media.fillScale : 1, x: 0.5, y: 0.5 })}
            />
            <ToggleGroup
              label="Flip"
              options={[
                {
                  key: "h",
                  label: "⇆",
                  title: "Flip horizontally",
                  on: media.flipH,
                  onToggle: () => media.onFlip({ flipH: !media.flipH }),
                },
                {
                  key: "v",
                  label: "⇅",
                  title: "Flip vertically",
                  on: media.flipV,
                  onToggle: () => media.onFlip({ flipV: !media.flipV }),
                },
              ]}
            />
          </div>
          <Slider
            label="Scale"
            value={pose.scale}
            min={0.1}
            max={4}
            step={0.01}
            format={pct}
            onLive={(v) => livePose({ scale: v })}
            onCommit={commit}
            keyframe={keyframe("scale")}
          />
        </>
      )}
      <Slider
        label="Rotation"
        value={pose.rotation}
        min={-180}
        max={180}
        step={1}
        format={deg}
        onLive={(v) => livePose({ rotation: v })}
        onCommit={commit}
        keyframe={keyframe("rotation")}
      />
      <Slider
        label="Opacity"
        value={pose.opacity}
        min={0}
        max={1}
        step={0.01}
        format={pct}
        onLive={(v) => livePose({ opacity: v })}
        onCommit={commit}
        keyframe={keyframe("opacity")}
      />
      <div className="grid grid-cols-2 gap-3">
        <Slider
          label="X"
          value={pose.x}
          min={-0.5}
          max={1.5}
          step={0.005}
          format={pct}
          onLive={(v) => livePose({ x: v })}
          onCommit={commit}
          keyframe={keyframe("x")}
        />
        <Slider
          label="Y"
          value={pose.y}
          min={-0.5}
          max={1.5}
          step={0.005}
          format={pct}
          onLive={(v) => livePose({ y: v })}
          onCommit={commit}
          keyframe={keyframe("y")}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Drag it in the preview; corners resize, the knob rotates. ◆ animates a value from the playhead.
      </p>
    </Section>
  );
}

const SPEED_PRESETS = [0.5, 1, 1.5, 2, 4];

export function MediaInspector({
  clip,
  item,
  trackKind,
  actions,
}: {
  clip: MediaClip;
  item: MediaItem | undefined;
  trackKind: Track["kind"];
  actions: MediaActions;
}) {
  if (!item) return <p className="p-4 text-xs text-muted-foreground">This clip's media was removed.</p>;
  const { live, commit, patch } = actions;
  const visual = trackKind !== "audio" && item.kind !== "audio";
  const timed = item.kind !== "image";
  const maxFade = Math.max(0, Math.min(10, clip.duration / 2));
  const thumb = item.kind === "video" ? item.thumbs.find(Boolean) : item.kind === "image" ? item.url : null;
  const setCrop = (k: keyof Crop, v: number) => {
    const other =
      k === "left" ? clip.crop.right : k === "right" ? clip.crop.left : k === "top" ? clip.crop.bottom : clip.crop.top;
    live({ crop: { ...clip.crop, [k]: Math.min(v, 0.95 - other) } });
  };
  const setColor = (k: keyof ColorAdjust, v: number) => live({ color: { ...clip.color, [k]: v } });
  const cropped = clip.crop.left || clip.crop.top || clip.crop.right || clip.crop.bottom;
  return (
    <>
      <ClipSummary
        thumb={visual ? thumb : null}
        name={item.name}
        clip={clip}
        kind={trackKind === "audio" ? "Audio" : item.kind}
      />
      {actions.busy && (
        <p className="px-4 py-2 text-[11px] font-bold border-b-2 border-foreground/10 bg-accent animate-pulse">
          {actions.busy}
        </p>
      )}
      {visual && (
        <TransformSection
          clip={clip}
          actions={actions as unknown as ClipActions}
          media={{ fillScale: actions.fillScale, flipH: clip.flipH, flipV: clip.flipV, onFlip: patch }}
        />
      )}
      {timed && (
        <Section title="Speed" collapsible defaultOpen={false} changed={clip.speed !== 1}>
          <Slider
            label="Speed"
            value={Math.log2(clip.speed)}
            min={Math.log2(MIN_SPEED)}
            max={Math.log2(MAX_SPEED)}
            step={0.01}
            format={(v) => `${+(2 ** v).toFixed(2)}×`}
            onLive={(v) => actions.setSpeed(2 ** v, true)}
            onCommit={commit}
          />
          <Segmented
            label="Speed presets"
            options={SPEED_PRESETS.map((s) => ({ value: s, label: `${s}×` }))}
            value={clip.speed}
            onChange={(s) => actions.setSpeed(s, false)}
          />
          <div className={`grid gap-2 ${actions.freeze ? "grid-cols-2" : ""}`}>
            <ActionButton
              onClick={actions.reverse}
              disabled={!!actions.busy || item.kind !== "video"}
              title="Make a reversed copy of this clip"
            >
              Reverse
            </ActionButton>
            {actions.freeze && (
              <ActionButton
                onClick={actions.freeze}
                disabled={!!actions.busy}
                title="Hold the frame at the playhead for 2 seconds"
              >
                Freeze frame
              </ActionButton>
            )}
          </div>
        </Section>
      )}
      {visual && (
        <Section
          title="Crop"
          collapsible
          defaultOpen={false}
          changed={!!cropped}
          action={
            cropped ? (
              <button
                type="button"
                className="text-[11px] font-bold underline underline-offset-2 text-muted-foreground hover:text-foreground"
                onClick={() => patch({ crop: NO_CROP })}
              >
                Reset
              </button>
            ) : null
          }
        >
          <div className="grid grid-cols-2 gap-3">
            {(["left", "right", "top", "bottom"] as const).map((k) => (
              <Slider
                key={k}
                label={k[0].toUpperCase() + k.slice(1)}
                value={clip.crop[k]}
                min={0}
                max={0.9}
                step={0.005}
                format={pct}
                onLive={(v) => setCrop(k, v)}
                onCommit={commit}
              />
            ))}
          </div>
        </Section>
      )}
      {visual && (
        <Section
          title="Color"
          collapsible
          defaultOpen={false}
          changed={!isNeutral(clip.color)}
          action={
            !isNeutral(clip.color) ? (
              <button
                type="button"
                className="text-[11px] font-bold underline underline-offset-2 text-muted-foreground hover:text-foreground"
                onClick={() => patch({ color: NEUTRAL_COLOR })}
              >
                Reset
              </button>
            ) : null
          }
        >
          <Slider
            label="Brightness"
            value={clip.color.brightness}
            min={-1}
            max={1}
            step={0.01}
            format={signed}
            onLive={(v) => setColor("brightness", v)}
            onCommit={commit}
          />
          <Slider
            label="Contrast"
            value={clip.color.contrast}
            min={-1}
            max={1}
            step={0.01}
            format={signed}
            onLive={(v) => setColor("contrast", v)}
            onCommit={commit}
          />
          <Slider
            label="Saturation"
            value={clip.color.saturation}
            min={-1}
            max={1}
            step={0.01}
            format={signed}
            onLive={(v) => setColor("saturation", v)}
            onCommit={commit}
          />
          <Slider
            label="Temperature"
            value={clip.color.temperature}
            min={-1}
            max={1}
            step={0.01}
            format={signed}
            onLive={(v) => setColor("temperature", v)}
            onCommit={commit}
          />
        </Section>
      )}
      {visual && (
        <Section title="Transition in" collapsible defaultOpen={false} changed={!!clip.transition}>
          <Segmented
            label="Transition"
            options={[
              { value: "none", label: "None" },
              { value: "crossfade", label: "Crossfade" },
              { value: "dip", label: "Dip", title: "Dip to black" },
            ]}
            value={clip.transition?.kind ?? "none"}
            onChange={(v) =>
              patch({ transition: v === "none" ? null : { kind: v, duration: clip.transition?.duration ?? 0.6 } })
            }
          />
          {clip.transition && (
            <Slider
              label="Length"
              value={clip.transition.duration}
              min={0.1}
              max={Math.max(0.2, Math.min(3, clip.duration))}
              step={0.05}
              format={secs}
              onLive={(v) => live({ transition: { ...clip.transition!, duration: v } })}
              onCommit={commit}
            />
          )}
          <p className="text-[11px] text-muted-foreground">
            Blends from the clip right before this one on the track, or fades in if there's a gap.
          </p>
        </Section>
      )}
      {item.hasAudio && (
        <Section title="Audio" changed={clip.volume !== 1 || clip.duck}>
          <Slider
            label="Volume"
            value={clip.volume}
            min={0}
            max={MAX_VOLUME}
            step={0.01}
            format={pct}
            onLive={(v) => live({ volume: v })}
            onCommit={commit}
          />
          <div className={`grid gap-2 ${actions.detachAudio ? "grid-cols-2" : ""}`}>
            <ActionButton
              onClick={actions.normalize}
              disabled={!!actions.busy}
              title="Bring the loudest moment up (or down) to just under full scale"
            >
              Normalize
            </ActionButton>
            {actions.detachAudio && (
              <ActionButton
                onClick={actions.detachAudio}
                title="Put the sound on an audio track, still linked to the picture"
              >
                Separate audio
              </ActionButton>
            )}
          </div>
          <Toggle
            label="Lower when others play"
            on={clip.duck}
            onChange={(duck) => patch({ duck })}
            hint="Ducks this clip (music, say) under any other audio, like a voice-over."
          />
        </Section>
      )}
      {maxFade > 0 && (
        <Section title="Fades" collapsible defaultOpen={false} changed={clip.fadeIn > 0 || clip.fadeOut > 0}>
          <div className="grid grid-cols-2 gap-3">
            <Slider
              label="In"
              value={Math.min(clip.fadeIn, maxFade)}
              min={0}
              max={maxFade}
              step={0.1}
              format={secs}
              onLive={(v) => live({ fadeIn: v })}
              onCommit={commit}
            />
            <Slider
              label="Out"
              value={Math.min(clip.fadeOut, maxFade)}
              min={0}
              max={maxFade}
              step={0.1}
              format={secs}
              onLive={(v) => live({ fadeOut: v })}
              onCommit={commit}
            />
          </div>
        </Section>
      )}
      {item.kind === "image" && (
        <p className="px-4 py-3 text-[11px] text-muted-foreground">
          Drag the clip's right edge on the timeline to change how long it shows.
        </p>
      )}
    </>
  );
}

const ANIMS: { value: TextAnim; label: string; title?: string }[] = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "pop", label: "Pop" },
  { value: "type", label: "Type", title: "Typewriter" },
];

export function TextInspector({ clip, actions }: { clip: TextClip; actions: ClipActions<TextClip> }) {
  const { live, commit, patch } = actions;
  return (
    <>
      <Section title="Content">
        <textarea
          data-text-editor
          value={clip.text}
          rows={3}
          aria-label="Text"
          onChange={(e) => live({ text: e.target.value })}
          onBlur={commit}
          className="w-full resize-y border-2 border-foreground bg-background p-2.5 text-sm font-medium focus:outline-none focus:shadow-[3px_3px_0_0_var(--primary)] transition-shadow"
        />
        <p className="text-[11px] text-muted-foreground">Or double-click the text in the preview.</p>
      </Section>
      <Section title="Style">
        <Field label="Font">
          <Segmented
            label="Font"
            options={[
              { value: "sans", label: <span style={{ fontFamily: "Onest" }}>Sans</span> },
              { value: "serif", label: <span style={{ fontFamily: "Instrument Serif", fontSize: 15 }}>Serif</span> },
              { value: "mono", label: <span className="font-mono">Mono</span> },
              { value: "heavy", label: <span style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>Heavy</span> },
            ]}
            value={clip.font}
            onChange={(font) => patch({ font })}
          />
        </Field>
        <Slider
          label="Size"
          value={clip.size}
          min={16}
          max={300}
          step={1}
          format={(v) => `${v}px`}
          onLive={(v) => live({ size: v })}
          onCommit={commit}
        />
        <div className="grid grid-cols-2 gap-2">
          <ToggleGroup
            label="Weight and slant"
            options={[
              {
                key: "b",
                label: <span className="font-black">B</span>,
                title: "Bold",
                on: clip.bold,
                onToggle: () => patch({ bold: !clip.bold }),
              },
              {
                key: "i",
                label: <span className="italic font-serif">I</span>,
                title: "Italic",
                on: clip.italic,
                onToggle: () => patch({ italic: !clip.italic }),
              },
            ]}
          />
          <Segmented
            label="Align"
            options={(["left", "center", "right"] as const).map((a) => ({
              value: a,
              title: `Align ${a}`,
              label: (
                <svg aria-hidden="true" viewBox="0 0 16 16" className="w-3.5 h-3.5 mx-auto" fill="currentColor">
                  <rect x={a === "right" ? 4 : a === "center" ? 2 : 1} y="3" width="12" height="2" />
                  <rect x={a === "left" ? 1 : a === "center" ? 4 : 7} y="7" width="8" height="2" />
                  <rect x={a === "right" ? 3 : a === "center" ? 3 : 1} y="11" width="10" height="2" />
                </svg>
              ),
            }))}
            value={clip.align}
            onChange={(align) => patch({ align })}
          />
        </div>
        <Field label="Colour">
          <ColorField value={clip.color} onLive={(c) => live({ color: c })} onCommit={commit} />
        </Field>
        <Field label="Outline">
          <Segmented
            label="Outline"
            options={[
              { value: "none", label: "None" },
              { value: "on", label: "Outline" },
            ]}
            value={clip.outline ? "on" : "none"}
            onChange={(v) =>
              patch({ outline: v === "on" ? (clip.color.toLowerCase() === "#1a1612" ? "#ffffff" : "#1a1612") : null })
            }
          />
          {clip.outline && <ColorField value={clip.outline} onLive={(c) => live({ outline: c })} onCommit={commit} />}
        </Field>
        <Field label="Background">
          <Segmented
            label="Background"
            options={[
              { value: "none", label: "None" },
              { value: "box", label: "Box" },
            ]}
            value={clip.background ? "box" : "none"}
            onChange={(v) => patch({ background: v === "box" ? "#1a1612" : null })}
          />
          {clip.background && (
            <ColorField value={clip.background} onLive={(c) => live({ background: c })} onCommit={commit} />
          )}
        </Field>
        <Toggle label="Drop shadow" on={clip.shadow} onChange={(shadow) => patch({ shadow })} />
      </Section>
      <Section
        title="Animation"
        collapsible
        defaultOpen={false}
        changed={clip.animIn !== "none" || clip.animOut !== "none"}
      >
        <Field label="In">
          <Segmented label="Animate in" options={ANIMS} value={clip.animIn} onChange={(animIn) => patch({ animIn })} />
        </Field>
        <Field label="Out">
          <Segmented
            label="Animate out"
            options={ANIMS}
            value={clip.animOut}
            onChange={(animOut) => patch({ animOut })}
          />
        </Field>
      </Section>
      <TransformSection clip={clip} actions={actions as unknown as ClipActions} />
    </>
  );
}

export function MultiInspector({
  count,
  linked,
  onDelete,
  onRippleDelete,
  onLink,
  onUnlink,
}: {
  count: number;
  linked: boolean;
  onDelete: () => void;
  onRippleDelete: () => void;
  onLink: () => void;
  onUnlink: () => void;
}) {
  return (
    <>
      <div className="px-4 py-5 border-b-2 border-foreground/10">
        <p className="font-display text-3xl leading-none">{count} clips</p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Drag any of them to move the group. ⌥-click picks one out.
        </p>
      </div>
      <Section title="Group">
        <ActionButton onClick={linked ? onUnlink : onLink} title="Linked clips move, trim and split together">
          {linked ? "Unlink" : "Link together"}
        </ActionButton>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton onClick={onDelete}>Delete</ActionButton>
          <ActionButton onClick={onRippleDelete} title="Delete and close the gaps (⇧⌫)">
            Ripple delete
          </ActionButton>
        </div>
      </Section>
    </>
  );
}

const RESOLUTIONS = [
  { label: "1080p landscape (1920×1080)", short: "1080p", w: 1920, h: 1080 },
  { label: "720p landscape (1280×720)", short: "720p", w: 1280, h: 720 },
  { label: "4K landscape (3840×2160)", short: "4K", w: 3840, h: 2160 },
  { label: "Vertical 1080×1920", short: "9:16", w: 1080, h: 1920 },
  { label: "Square 1080×1080", short: "1:1", w: 1080, h: 1080 },
  { label: "Portrait 4:5 (1080×1350)", short: "4:5", w: 1080, h: 1350 },
];

export function ProjectInspector({
  project,
  onChange,
}: {
  project: Project;
  onChange: (patch: Partial<Project>) => void;
}) {
  const isPreset = RESOLUTIONS.some((r) => r.w === project.width && r.h === project.height);
  const duration = projectDuration(project);
  return (
    <>
      <Section title="Frame size">
        <div className="grid grid-cols-3 gap-2">
          {RESOLUTIONS.map((r) => {
            const active = r.w === project.width && r.h === project.height;
            const a = r.w / r.h;
            const bw = a >= 1 ? 28 : 28 * a;
            const bh = a >= 1 ? 28 / a : 28;
            return (
              <button
                key={r.label}
                type="button"
                title={r.label}
                onClick={() => onChange({ width: r.w, height: r.h })}
                className={`h-16 flex flex-col items-center justify-center gap-1.5 border-2 border-foreground transition-colors ${
                  active ? "bg-foreground text-background" : "bg-background hover:bg-accent"
                }`}
              >
                <span
                  className={`border-2 ${active ? "border-background" : "border-foreground"}`}
                  style={{ width: bw, height: bh }}
                />
                <span className="text-[10px] font-bold leading-none">{r.short}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] font-mono text-muted-foreground">
          {project.width}×{project.height}
          {!isPreset && " · from your video"}
        </p>
      </Section>
      <Section title="Frame rate">
        <Segmented
          label="Frame rate"
          options={[24, 25, 30, 50, 60].map((f) => ({ value: f, label: f, title: `${f} fps` }))}
          value={project.fps}
          onChange={(fps) => onChange({ fps })}
        />
      </Section>
      <Section title="Background">
        <ColorField
          value={project.background}
          presets={["#000000", "#ffffff", "#faf7f2", "#1a1612"]}
          onLive={(c) => onChange({ background: c })}
          onCommit={() => {}}
        />
      </Section>
      <div className="px-4 py-4 grid grid-cols-2 gap-2">
        <Stat label="Length" value={fmtTime(duration)} />
        <Stat label="Clips" value={String(project.clips.length)} />
      </div>
      <p className="px-4 pb-4 text-[11px] text-muted-foreground">
        Select a clip on the timeline or in the preview to edit it. Right-click anything for more, and hit ? for
        shortcuts.
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-foreground bg-background px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
