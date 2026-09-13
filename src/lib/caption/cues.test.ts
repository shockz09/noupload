import { describe, expect, it } from "vitest";
import { cueAt, layoutLine, mergeWords, timestamp, toSRT, toVTT, wordsToCues } from "./cues";

const say = (text: string, start: number, end: number) => ({ text, start, end });

describe("layoutLine", () => {
  it("leaves a line that already fits alone", () => {
    expect(layoutLine("short enough to read")).toBe("short enough to read");
  });

  it("never produces more than two lines", () => {
    const long = "word ".repeat(40).trim();
    expect(layoutLine(long).split("\n")).toHaveLength(2);
  });

  it("balances the two lines", () => {
    const [first, second] = layoutLine("the quick brown fox jumps over the lazy dog and keeps running").split("\n");
    expect(Math.abs(first.length - second.length)).toBeLessThan(12);
  });

  it("prefers breaking after punctuation when the balance is near enough", () => {
    const out = layoutLine("we tried it again, then we gave up on it entirely");
    expect(out.split("\n")[0].endsWith(",")).toBe(true);
  });

  it("collapses stray whitespace", () => {
    expect(layoutLine("  spaced   out  ")).toBe("spaced out");
  });
});

describe("wordsToCues", () => {
  it("breaks on a long pause", () => {
    const cues = wordsToCues([say("hello", 0, 0.4), say("there", 0.5, 0.9), say("again", 3, 3.4)]);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe("hello there");
    expect(cues[1].text).toBe("again");
  });

  it("never exceeds two lines' worth of characters in one cue", () => {
    const words = Array.from({ length: 60 }, (_, i) => say(`word${i}`, i * 0.2, i * 0.2 + 0.15));
    for (const cue of wordsToCues(words)) {
      expect(cue.text.replace(/\n/g, " ").length).toBeLessThanOrEqual(84);
    }
  });

  it("closes a cue at a sentence end once it has enough on it", () => {
    const words = "this is a fairly complete sentence that ends here."
      .split(" ")
      .map((w, i) => say(w, i * 0.3, i * 0.3 + 0.25));
    words.push(say("next", 4, 4.3));
    const cues = wordsToCues(words);
    expect(cues[0].text.replace(/\n/g, " ").endsWith("here.")).toBe(true);
  });

  it("stretches a very short cue so it can be read", () => {
    const [cue] = wordsToCues([say("yes", 1, 1.2)], 10);
    expect(cue.end - cue.start).toBeCloseTo(1.0, 5);
  });

  it("never stretches a cue over the one after it", () => {
    const cues = wordsToCues([say("yes", 1, 1.2), say("no", 2, 2.2)], 10);
    expect(cues[0].end).toBeLessThanOrEqual(cues[1].start);
  });

  it("never stretches past the end of the media", () => {
    const [cue] = wordsToCues([say("yes", 9.8, 9.9)], 10);
    expect(cue.end).toBeLessThanOrEqual(10);
  });

  /**
   * A cue that ends before it starts is a subtitle file no player will load, so
   * it must not be possible to build one. Two ways in, both real:
   *
   *  - the media duration used to be treated as a hard ceiling, and the model's
   *    last word can carry a timestamp past the end of the audio it came from,
   *    which turned the final cue into `12.0 --> 10.0`;
   *  - the word timings are the model's, not ours, and one arriving backwards
   *    should cost that cue its duration rather than the whole file.
   */
  it("never ends a cue before it starts, even past the end of the media", () => {
    for (const cue of wordsToCues([say("hi", 0, 0.5), say("late", 12, 12.2)], 10)) {
      expect(cue.end).toBeGreaterThanOrEqual(cue.start);
    }
  });

  /**
   * The timings are the model's, and this is the only place that can stop a bad
   * one spreading. Everything downstream assumes cues are well-formed: `cueAt`
   * binary-searches on it, `toSRT` writes it straight into the file, and a
   * player given `00:00:30,000 --> 00:00:20,000` rejects the whole track.
   *
   * So rather than one hand-picked bad input, this runs a deterministic spread
   * of them — words timed backwards, words out of order, zero-length words,
   * duplicates — and asserts the invariant holds on every output.
   */
  it("emits well-formed cues however malformed the words are", () => {
    // A tiny LCG: the point is a wide, *reproducible* spread of shapes.
    let seed = 12345;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let attempt = 0; attempt < 300; attempt++) {
      const words = Array.from({ length: 1 + Math.floor(random() * 12) }, (_, i) => {
        const start = Math.round(random() * 40 * 10) / 10;
        // Half the time a sane duration, half the time something impossible.
        const end = random() < 0.5 ? start + Math.round(random() * 70) / 10 : Math.round(random() * 40 * 10) / 10;
        return say(random() < 0.25 ? `w${i}.` : `w${i}`, start, end);
      });

      // Ordering is a precondition mergeWords keeps, not something this can
      // repair — out-of-order words make out-of-order cues. Well-formedness of
      // each individual cue is unconditional.
      for (const cue of wordsToCues(words, 30)) {
        expect(cue.end).toBeGreaterThanOrEqual(cue.start);
      }
    }
  });

  it("keeps a cue that runs past the declared duration rather than collapsing it", () => {
    const [cue] = wordsToCues([say("late", 12, 12.4)], 10);
    expect(cue.end - cue.start).toBeCloseTo(0.4, 5);
  });

  /** Stretching is for short cues; it must never take time off a long one. */
  it("never shortens a cue that already has its time", () => {
    const words = "one two three four five six seven eight".split(" ").map((w, i) => say(w, i * 0.5, i * 0.5 + 0.45));
    const [cue] = wordsToCues(words, 100);
    expect(cue.end - cue.start).toBeGreaterThan(3);
  });

  /**
   * cueAt binary-searches on the assumption that cues are ordered and disjoint,
   * and two cards on screen at once is wrong regardless. The merge tolerance
   * lets a word overlap the previous one by up to 50 ms, so this is reachable.
   */
  it("never overlaps two cues", () => {
    const words = Array.from({ length: 40 }, (_, i) => say(i % 5 === 4 ? `w${i}.` : `w${i}`, i * 0.6, i * 0.6 + 0.64));
    const cues = wordsToCues(words, 100);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i].start).toBeGreaterThanOrEqual(cues[i - 1].end);
    }
  });

  it("ignores empty words", () => {
    expect(wordsToCues([say(" ", 0, 0.1), say("real", 0.2, 0.4)])[0].text).toBe("real");
  });

  it("returns nothing for no words", () => {
    expect(wordsToCues([])).toEqual([]);
  });
});

describe("mergeWords", () => {
  it("drops words the overlap already delivered", () => {
    const kept = [say("one", 0, 0.5), say("two", 0.6, 1)];
    mergeWords(kept, [say("two", 0.6, 1), say("three", 1.1, 1.5)]);
    expect(kept.map((w) => w.text)).toEqual(["one", "two", "three"]);
  });

  it("takes everything when there is nothing yet", () => {
    expect(mergeWords([], [say("one", 0, 0.5)])).toHaveLength(1);
  });

  it("mutates the list it is given rather than returning a copy", () => {
    // The worker relies on this: it keeps one array across every window.
    const kept: ReturnType<typeof say>[] = [];
    expect(mergeWords(kept, [say("one", 0, 0.5)])).toBe(kept);
  });

  /**
   * The real thing: 90-second windows with 2 seconds of lead-in, exactly as the
   * worker cuts them. Speech runs straight through the seams, so every window
   * after the first re-transcribes words the previous one already delivered.
   * Getting this wrong duplicates or drops a word every 88 seconds, which is
   * the bug this whole function exists to prevent.
   */
  it("stitches overlapping windows without repeating or losing a word", () => {
    const WINDOW = 90;
    const OVERLAP = 2;
    const total = 300;

    // One word every 0.4 s across the whole recording, numbered so a duplicate
    // or a gap is visible in the output rather than merely a wrong count.
    const spoken = Array.from({ length: Math.floor(total / 0.4) }, (_, i) => say(`w${i}`, i * 0.4, i * 0.4 + 0.3));

    const kept: ReturnType<typeof say>[] = [];
    for (let from = 0; from < total - 0.05; from += WINDOW - OVERLAP) {
      const to = Math.min(total, from + WINDOW);
      // What the model returns for this window: every word inside it, lead-in
      // included — the model has no idea the previous window existed.
      mergeWords(
        kept,
        spoken.filter((w) => w.start >= from && w.end <= to),
      );
    }

    expect(kept.map((w) => w.text)).toEqual(spoken.map((w) => w.text));
  });

  /**
   * The 50 ms of slack is the whole reason the comparison is not a plain `>`.
   * Real timings jitter: a genuinely new word often starts a hair before the
   * previous one is marked as ending. Dropping it loses a word from the
   * transcript, so the tolerance has to lean towards keeping.
   */
  it("keeps a new word that starts a hair before the last one ended", () => {
    const kept = [say("before", 10, 10.5)];
    mergeWords(kept, [say("after", 10.47, 10.9)]);
    expect(kept.map((w) => w.text)).toEqual(["before", "after"]);
  });

  it("still drops a repeat that arrives well inside what we have", () => {
    const kept = [say("one", 10, 10.5), say("two", 10.6, 11)];
    mergeWords(kept, [say("one", 10, 10.5)]);
    expect(kept).toHaveLength(2);
  });

  it("keeps timestamps ascending across a seam", () => {
    const kept = [say("a", 87, 87.4), say("b", 88, 88.4)];
    mergeWords(kept, [say("b", 88, 88.4), say("c", 89, 89.4)]);
    for (let i = 1; i < kept.length; i++) {
      expect(kept[i].start).toBeGreaterThanOrEqual(kept[i - 1].start);
    }
  });
});

describe("formatting", () => {
  it("writes SRT timestamps with a comma", () => {
    expect(timestamp(3661.5, true)).toBe("01:01:01,500");
  });

  it("writes VTT timestamps with a dot", () => {
    expect(timestamp(3661.5)).toBe("01:01:01.500");
  });

  it("clamps negatives rather than emitting a broken timestamp", () => {
    expect(timestamp(-1)).toBe("00:00:00.000");
  });

  it("numbers SRT entries from one", () => {
    const srt = toSRT([
      { start: 0, end: 1, text: "one" },
      { start: 1, end: 2, text: "two" },
    ]);
    expect(srt.startsWith("1\n00:00:00,000 --> 00:00:01,000\none\n")).toBe(true);
    expect(srt).toContain("2\n00:00:01,000 --> 00:00:02,000\ntwo");
  });

  it("starts VTT with its header", () => {
    expect(toVTT([{ start: 0, end: 1, text: "hi" }]).startsWith("WEBVTT\n\n")).toBe(true);
  });

  /**
   * WebVTT parses cue text as markup. Left alone, "<laughs>" is read as a tag
   * and vanishes from the rendered caption, and "&" opens an entity — both are
   * things a person editing a line will type.
   */
  it("escapes markup in VTT cue text", () => {
    const vtt = toVTT([{ start: 0, end: 1, text: "R&D <laughs>" }]);
    expect(vtt).toContain("R&amp;D &lt;laughs>");
  });

  /** "-->" in cue text would be read as the start of a new timing line. */
  it("escapes an arrow in VTT cue text", () => {
    expect(toVTT([{ start: 0, end: 1, text: "a --> b" }])).toContain("a --&gt; b");
  });

  it("leaves ordinary text untouched", () => {
    expect(toVTT([{ start: 0, end: 1, text: "just words" }])).toContain("\njust words\n");
  });
});

describe("cueAt", () => {
  const cues = [
    { start: 0, end: 1, text: "a" },
    { start: 2, end: 3, text: "b" },
    { start: 4, end: 5, text: "c" },
  ];

  it("finds the covering cue", () => {
    expect(cueAt(cues, 2.5)).toBe(1);
  });

  it("includes the boundaries", () => {
    expect(cueAt(cues, 2)).toBe(1);
    expect(cueAt(cues, 3)).toBe(1);
  });

  it("returns -1 in the gaps and past the end", () => {
    expect(cueAt(cues, 1.5)).toBe(-1);
    expect(cueAt(cues, 99)).toBe(-1);
  });

  it("returns -1 for an empty list", () => {
    expect(cueAt([], 1)).toBe(-1);
  });
});
