import { describe, expect, it } from "vitest";
import { audioTools } from "@/app/audio-tools-grid";
import { imageTools } from "@/app/image-tools-grid";
import { pdfTools } from "@/app/pdf-tools-grid";
import { qrTools } from "@/app/qr-tools-grid";
import { allTools } from "@/app/tools-hub";
import { videoTools } from "@/app/video-tools-grid";
import { parseConvertIntent, type SearchableTool, scoreTools } from "./tool-search";

/**
 * These run against the real grid exports rather than fixtures, so editing a
 * tool's keywords or io declaration is caught here instead of in the browser.
 */
// Annotated rather than `satisfies`: the grids infer a union of object
// literals in which only some members carry `io`, so the element type has to
// be widened to SearchableTool for `tool.io` to be readable here.
const SUITES: Record<"pdf" | "image" | "audio" | "video" | "qr", readonly SearchableTool[]> = {
  pdf: pdfTools,
  image: imageTools,
  audio: audioTools,
  video: videoTools,
  qr: qrTools,
};

const ALL_TOOLS = Object.values(SUITES).flat();

/** Titles of the top `n` results, best first. */
function top(suite: keyof typeof SUITES, query: string, n = 1): string[] {
  return scoreTools([...SUITES[suite]], query)
    .slice(0, n)
    .map((t) => t.title);
}

function titles(suite: keyof typeof SUITES, query: string): string[] {
  return scoreTools([...SUITES[suite]], query).map((t) => t.title);
}

describe("parseConvertIntent", () => {
  it("parses the plain forms", () => {
    expect(parseConvertIntent("mp4 to mp3")).toMatchObject({ fromToken: "mp4", toToken: "mp3" });
    expect(parseConvertIntent("png into jpg")).toMatchObject({ fromToken: "png", toToken: "jpg" });
    expect(parseConvertIntent("mp3 2 wav")).toMatchObject({ fromToken: "mp3", toToken: "wav" });
    expect(parseConvertIntent("wav as flac")).toMatchObject({ fromToken: "wav", toToken: "flac" });
  });

  it("parses symbol arrows, spaced or not", () => {
    for (const q of ["png->jpg", "png -> jpg", "mp4=>webm", "pdf→jpg", "pdf → jpg"]) {
      expect(parseConvertIntent(q), q).not.toBeNull();
    }
  });

  it("strips a leading verb", () => {
    expect(parseConvertIntent("convert mp4 to mp3")).toMatchObject({ fromToken: "mp4", toToken: "mp3" });
    expect(parseConvertIntent("turn pdf into word")).toMatchObject({ fromToken: "pdf", toToken: "word" });
  });

  // Regression: the separator alternation used to match inside a word. A lazy
  // (.+?) latched onto the "to" in "pho|to|" and the overall match succeeded,
  // so the regex never backtracked to the real separator and intent was lost.
  it("does not split on a separator embedded in a word", () => {
    expect(parseConvertIntent("photo to pdf")).toMatchObject({ fromToken: "photo", toToken: "pdf" });
    expect(parseConvertIntent("photo into pdf")).toMatchObject({ fromToken: "photo", toToken: "pdf" });
    expect(parseConvertIntent("photo to jpg")).toMatchObject({ fromToken: "photo", toToken: "jpg" });
  });

  it("rejects phrases that merely contain a separator word", () => {
    for (const q of ["add text to pdf", "merge pdf", "remove background", "sign pdf"]) {
      expect(parseConvertIntent(q), q).toBeNull();
    }
  });

  it("rejects a conversion between formats it does not know", () => {
    // Both sides must resolve to a known family, otherwise every "x to y"
    // phrase would be read as a conversion.
    expect(parseConvertIntent("cheese to biscuits")).toBeNull();
  });
});

describe("conversion queries pick the right converter", () => {
  // The table from the PR description: these are the queries the feature exists to serve.
  it.each([
    ["video", "mp4 to mp3", "Extract Audio"],
    ["video", "webm to wav", "Extract Audio"],
    ["video", "extract audio from video", "Extract Audio"],
    ["video", "mute my video", "Remove Audio"],
    ["video", "mp4 to gif", "To GIF"],
    ["image", "heic to jpg", "HEIC → JPEG"],
    ["image", "png to webp", "Convert"],
    ["image", "svg to png", "Convert"],
    ["pdf", "photo to pdf", "Images → PDF"],
    ["pdf", "pdf to jpg", "PDF → Images"],
    ["pdf", "md to pdf", "Markdown → PDF"],
    ["pdf", "xlsx to pdf", "XLSX → PDF"],
    ["pdf", "pptx to pdf", "PPTX → PDF"],
    ["audio", "flac to mp3", "Convert"],
  ] as const)("%s: %j -> %s", (suite, query, want) => {
    expect(top(suite, query)).toEqual([want]);
  });

  // Regression: io matching compared format *families*, so every image->image
  // converter claimed the full bonus. HEIC → JPEG can only emit jpeg.
  it("does not offer a converter that cannot emit the requested format", () => {
    expect(top("image", "heic to webp")).toEqual(["Convert"]);
    expect(top("image", "png to jpg")).toEqual(["Convert"]);
  });

  // Regression: pdf shares the `document` family with docx/word, so comparing
  // families made direction undetectable and the reversed branch dead code.
  it("ranks the reversed converter when the real direction is unsupported", () => {
    expect(top("pdf", "pdf to word")).toEqual(["DOCX → PDF"]);
    expect(top("pdf", "turn pdf into word")).toEqual(["DOCX → PDF"]);
    expect(top("pdf", "pdf to excel")).toEqual(["XLSX → PDF"]);
  });
});

describe("term matching", () => {
  // Regression: short terms required a whole-word match, so a prefix typed on
  // the way to a real query matched nothing. This box filters as you type.
  it("narrows on a word prefix while typing", () => {
    expect(titles("image", "res")).toContain("Resize");
    expect(titles("pdf", "com")).toContain("Compress");
    expect(titles("audio", "vol")).toContain("Volume");
  });

  it("never goes empty while a tool's own title is being typed", () => {
    for (const [suite, list] of Object.entries(SUITES)) {
      for (const tool of list) {
        const typed = tool.title.toLowerCase();
        for (let i = 1; i <= typed.length; i++) {
          const prefix = typed.slice(0, i);
          expect(titles(suite as keyof typeof SUITES, prefix), `${suite} "${prefix}"`).not.toHaveLength(0);
        }
      }
    }
  });

  // Regression: a raw includes() on keywords bypassed the word-start rule, so
  // "word" scored against the "password" keyword.
  it("does not match a short term inside a longer word", () => {
    expect(top("pdf", "word")).toEqual(["DOCX → PDF"]);
    expect(titles("pdf", "word").slice(0, 2)).not.toContain("Encrypt PDF");
  });

  it("still matches the longer word when it is typed in full", () => {
    expect(top("pdf", "password")).toEqual(["Encrypt PDF"]);
    expect(top("pdf", "remove password")).toEqual(["Decrypt PDF"]);
  });

  // Regression: stopword stripping could empty the term list, and a query with
  // no terms matched nothing at all.
  it("returns results for a query made entirely of stopwords", () => {
    for (const q of ["a", "to"]) {
      expect(titles("pdf", q), q).not.toHaveLength(0);
    }
    // "my" is a stopword too, but genuinely matches no PDF tool, so an empty
    // result is the right answer rather than the bug this guards against.
    expect(titles("pdf", "my")).toHaveLength(0);
  });
});

describe("synonyms", () => {
  // Regression: synonym hits scored nothing, so a tool matched only through a
  // synonym totalled 0 and was discarded by a `score > 0` gate.
  it.each([
    ["pdf", "read", "OCR"],
    ["pdf", "searchable", "OCR"],
    ["pdf", "stamp", "Watermark"],
    ["pdf", "combine", "Merge PDF"],
    ["pdf", "concatenate", "Merge PDF"],
    ["pdf", "kindle", "PDF → EPUB"],
    ["video", "shrink", "Compress"],
    ["video", "rip", "Extract Audio"],
    ["audio", "louder", "Volume"],
    ["image", "optimize", "Compress"],
    ["image", "censor", "Blur & Pixelate"],
  ] as const)("%s: %j reaches %s", (suite, query, want) => {
    expect(titles(suite, query)).toContain(want);
  });
});

describe("fuzzy fallback", () => {
  it("recovers from typos when nothing matches exactly", () => {
    expect(top("video", "viedo compres")).toEqual(["Compress"]);
  });

  it("returns nothing for a query with no plausible match", () => {
    expect(titles("pdf", "zzzqqqxyw")).toHaveLength(0);
  });
});

describe("invariants across every tool", () => {
  it("ranks each tool first for its own title", () => {
    for (const [suite, list] of Object.entries(SUITES)) {
      for (const tool of list) {
        // Titles render the direction as "→"; a user types "to".
        const typed = tool.title.toLowerCase().replace(/→/g, "to");
        expect(top(suite as keyof typeof SUITES, typed), typed).toEqual([tool.title]);
      }
    }
  });

  it("surfaces each tool for every conversion it declares", () => {
    for (const [suite, list] of Object.entries(SUITES)) {
      for (const tool of list) {
        if (!tool.io) continue;
        for (const from of tool.io.from) {
          for (const to of tool.io.to) {
            if (from === to) continue;
            const q = `${from} to ${to}`;
            expect(top(suite as keyof typeof SUITES, q, 2), `${suite} "${q}"`).toContain(tool.title);
          }
        }
      }
    }
  });

  it("declares io on every converter that names a format in its keywords", () => {
    // Guards the metadata itself: a converter whose keywords advertise "x to y"
    // but declares no io is invisible to the whole intent layer.
    const missing = ALL_TOOLS.filter(
      (t) => !t.io && (t.keywords ?? []).some((kw) => / to /.test(kw) && parseConvertIntent(kw) !== null),
    ).map((t) => t.title);
    expect(missing).toEqual([]);
  });
});

describe("robustness", () => {
  it("never throws on hostile input", () => {
    const nasty = [
      "",
      "   ",
      "\\",
      "[",
      "(((",
      "(?:",
      "[a-z]+",
      ".*",
      "$^",
      " ",
      "→→→",
      "😀 to 🎉",
      "<script>alert(1)</script>",
      "a".repeat(5000),
      "*".repeat(500),
      "a to ".repeat(200),
    ];
    for (const q of nasty) {
      expect(() => scoreTools([...pdfTools], q), JSON.stringify(q.slice(0, 20))).not.toThrow();
    }
  });

  it("stays responsive on a pathological query", () => {
    // The separator alternation is the ReDoS-shaped part; assert it degrades
    // linearly rather than catastrophically.
    const started = performance.now();
    scoreTools([...ALL_TOOLS], "a to ".repeat(500));
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("returns every tool for an empty query, and honours limit", () => {
    expect(scoreTools([...pdfTools], "")).toHaveLength(pdfTools.length);
    expect(scoreTools([...pdfTools], "   ")).toHaveLength(pdfTools.length);
    expect(scoreTools([...pdfTools], "", 3)).toHaveLength(3);
  });
});

/**
 * The "All" tab searches every tool at once. Cross-suite collisions only show
 * up here: three different tools are called "Compress", and "trim" is a Crop
 * keyword as well as a tool name.
 */
describe("the combined All Tools list", () => {
  const search = (q: string) => scoreTools([...allTools], q).map((t) => t.title);

  it("covers every tool in the per-suite grids", () => {
    expect(new Set(allTools.map((tool) => tool.href))).toEqual(new Set(ALL_TOOLS.map((tool) => tool.href)));
  });

  /**
   * A tool may belong to two families — Subtitles is listed under both Audio
   * and Video — so the concatenation that builds this list can hand the same
   * tool over twice. That would show two identical cards on the "All" tab,
   * overcount the tab's badge, and repeat a React key, since the grid is keyed
   * by href.
   */
  it("lists each tool once, however many grids it belongs to", () => {
    const hrefs = allTools.map((tool) => tool.href);
    expect(hrefs).toHaveLength(new Set(hrefs).size);
  });

  // Regression: `queryCoversKw` treated "the query contains a keyword" as proof
  // of a match, so Crop (which lists "trim") won outright for "vodio trim"
  // while Trim itself was dropped. One stray keyword outvoted every-term-hits.
  it("does not let a single keyword outvote the rest of the query", () => {
    expect(search("vodio trim")[0]).toBe("Trim");
    expect(search("trim my video")).toEqual(["Trim"]);
  });

  // Regression: a leading filler verb counted as a term nothing could satisfy,
  // so the query fell through to the fuzzy fallback and ranked by typo-distance.
  it("ignores a leading filler verb", () => {
    expect(search("make video smaller")).toEqual(["Compress"]);
    expect(search("convert mp4 to mp3")[0]).toBe("Extract Audio");
  });

  it("keeps a term meaningful across suites with same-named tools", () => {
    // Three tools are called "Compress"; the qualifier has to pick one.
    expect(search("compress video")).toEqual(["Compress"]);
    expect(search("compress image")).toEqual(["Compress"]);
    expect(search("compress").filter((t) => t === "Compress").length).toBeGreaterThan(1);
  });

  it("still answers the headline conversion queries", () => {
    expect(search("mp4 to mp3")[0]).toBe("Extract Audio");
    expect(search("heic to jpg")[0]).toBe("HEIC → JPEG");
  });

  it("never goes empty while typing any tool title", () => {
    for (const tool of allTools) {
      const typed = tool.title.toLowerCase();
      for (let i = 1; i <= typed.length; i++) {
        expect(search(typed.slice(0, i)), `"${typed.slice(0, i)}"`).not.toHaveLength(0);
      }
    }
  });
});
