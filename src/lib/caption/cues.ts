/**
 * Turning a flat list of timed words into subtitles people can read.
 *
 * The model gives one timestamp per word. Everything that makes a subtitle a
 * subtitle — where a line breaks, when a card leaves the screen, how long the
 * eye gets — is decided here, with no model and no DOM involved, so it can be
 * tested on its own.
 *
 * Conventions follow broadcast practice (BBC/Netflix house styles agree on the
 * numbers that matter): at most two lines, ~42 characters a line, and a card
 * stays up long enough to be read even when the words are quick.
 */

export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

export interface Cue {
  start: number;
  end: number;
  /** Display text. May contain a single "\n" — never more. */
  text: string;
  /** True once a human has edited this line, so the UI can mark it. */
  edited?: boolean;
}

const LINE_CHARS = 42; // characters per line before wrapping
const MAX_CHARS = 84; // two full lines
const MAX_DUR = 6; // seconds a single card may stay up
const MIN_DUR = 1.0; // a card shorter than this flashes; stretch it if there is room
const GAP_BREAK = 0.7; // a pause at least this long ends a card
/** A sentence may end a card early, but only once it is worth showing on its own. */
const SENTENCE_MIN_FILL = 0.45;

const SENTENCE_END = /[.!?]["')\]]?$/;

/** Split points that read better than a plain "shortest longer line" split. */
const PREFERRED_BREAK_AFTER = /[,;:—–]$/;

/**
 * Wrap to at most two lines.
 *
 * Among the splits that keep both halves closest in length, prefer one that
 * follows punctuation — a line that breaks after a comma reads as a phrase,
 * one that breaks mid-phrase reads as a mistake. Text that fits on one line is
 * left alone, and text too long for two is still split in two rather than
 * spilling: one very long line is worse than two slightly long ones.
 */
export function layoutLine(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= LINE_CHARS) return clean;

  const words = clean.split(" ");
  let best: { score: number; out: string } | null = null;

  for (let i = 1; i < words.length; i++) {
    const head = words.slice(0, i).join(" ");
    const tail = words.slice(i).join(" ");
    // Lower is better: balance first, but a break that follows punctuation is
    // worth a few characters of imbalance — it lands on a phrase boundary.
    const score = Math.max(head.length, tail.length) - (PREFERRED_BREAK_AFTER.test(head) ? 6 : 0);
    if (!best || score < best.score) best = { score, out: `${head}\n${tail}` };
  }

  return best ? best.out : clean;
}

/**
 * Group timed words into cues.
 *
 * The decision to close a card is made *before* a word is appended, so a card
 * never overshoots the character or duration limit and then gets fixed up.
 */
export function wordsToCues(words: TimedWord[], duration = Number.POSITIVE_INFINITY): Cue[] {
  const cues: Cue[] = [];
  let group: TimedWord[] = [];

  const textOf = (ws: TimedWord[]) => ws.map((w) => w.text.trim()).join(" ");

  const flush = () => {
    if (group.length === 0) return;
    cues.push({
      start: group[0].start,
      end: group[group.length - 1].end,
      text: layoutLine(textOf(group)),
    });
    group = [];
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const piece = word.text.trim();
    if (!piece) continue;

    if (group.length > 0) {
      const grown = textOf(group).length + 1 + piece.length;
      const stretched = word.end - group[0].start > MAX_DUR;
      if (grown > MAX_CHARS || stretched) flush();
    }

    group.push(word);

    const next = words[i + 1];
    const gap = next ? next.start - word.end : Number.POSITIVE_INFINITY;
    const endsSentence = SENTENCE_END.test(piece);
    const worthClosing = textOf(group).length > MAX_CHARS * SENTENCE_MIN_FILL;

    if (!next || gap >= GAP_BREAK || (endsSentence && worthClosing)) flush();
  }
  flush();

  return breathe(cues, duration);
}

/**
 * Give short cues room to be read, without ever overlapping the next one.
 *
 * A three-word answer can occupy 400ms of speech; left alone it blinks. It is
 * extended into the silence that follows it — never into the next cue, and
 * never past the end of the media.
 */
function breathe(cues: Cue[], duration: number): Cue[] {
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.end - cue.start >= MIN_DUR) continue;
    const ceiling = i + 1 < cues.length ? cues[i + 1].start : duration;
    cue.end = Math.min(cue.start + MIN_DUR, ceiling);
  }
  return cues;
}

/**
 * Merge a freshly transcribed chunk into what is already there.
 *
 * Chunks overlap on purpose — the model needs lead-in audio to get the first
 * words of a window right — so the overlap arrives twice. Anything starting at
 * or before the last word already kept is a repeat and is dropped.
 */
export function mergeWords(kept: TimedWord[], incoming: TimedWord[]): TimedWord[] {
  const lastEnd = kept.length > 0 ? kept[kept.length - 1].end : Number.NEGATIVE_INFINITY;
  for (const word of incoming) {
    if (word.start >= lastEnd - 0.05) kept.push(word);
  }
  return kept;
}

// ---------------------------------------------------------------- formatting

const pad = (n: number, width = 2) => String(Math.floor(n)).padStart(width, "0");

/** SRT/VTT timestamp. SRT separates milliseconds with a comma, VTT with a dot. */
export function timestamp(seconds: number, comma = false): string {
  const s = Math.max(0, seconds);
  const hh = pad(s / 3600);
  const mm = pad((s % 3600) / 60);
  const ss = (s % 60).toFixed(3).padStart(6, "0");
  return `${hh}:${mm}:${comma ? ss.replace(".", ",") : ss}`;
}

/** Short clock for the UI: 1:04, 12:09. */
export function clock(seconds: number): string {
  return `${Math.floor(Math.max(0, seconds) / 60)}:${pad(Math.max(0, seconds) % 60)}`;
}

/** Cue timecode with hundredths, monospaced in the list: 01:04.28 */
export function cueTimecode(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${pad(s / 60)}:${pad(s % 60)}.${pad((s % 1) * 100)}`;
}

export function toSRT(cues: Cue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${timestamp(c.start, true)} --> ${timestamp(c.end, true)}\n${c.text}\n`)
    .join("\n");
}

export function toVTT(cues: Cue[]): string {
  return `WEBVTT\n\n${cues.map((c) => `${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text}\n`).join("\n")}`;
}

/** Plain transcript: cue breaks are a display concern, so they collapse away. */
export function toText(cues: Cue[]): string {
  return cues.map((c) => c.text.replace(/\n/g, " ")).join(" ");
}

/** Index of the cue covering `time`, or -1. Cues are ordered and disjoint. */
export function cueAt(cues: Cue[], time: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (time < cues[mid].start) hi = mid - 1;
    else if (time > cues[mid].end) lo = mid + 1;
    else return mid;
  }
  return -1;
}
