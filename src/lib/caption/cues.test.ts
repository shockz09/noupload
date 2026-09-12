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
