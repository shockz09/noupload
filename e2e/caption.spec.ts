import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { getDropzoneAccept } from "./helpers/dropzone";
import { hasFfmpeg, mkvTone, mkvWithAudio, mp4MonoAudio, mp4NoAudio, mp4WithAudio, webmVp8 } from "./helpers/fixtures";
import { toBytes } from "./helpers/run-in-page";

/**
 * Subtitling, everywhere except the model itself.
 *
 * The speech model is a 240 MB download onto a GPU, so no test here runs it —
 * what these cover is everything around it, which is where the bugs actually
 * live: getting arbitrary media down to the 16 kHz mono the model wants, and
 * turning word timings back into a subtitle file a player will accept.
 *
 * Both halves need a real browser. The decoder is Web Audio and Mediabunny
 * doing the work, and the only honest check on a subtitle file is whether the
 * browser's own WebVTT parser reads back what we meant — which is why these are
 * e2e rather than another round of unit tests.
 */

test.describe("subtitles", () => {
  // ------------------------------------------------------------ the page

  test("is offered under both Audio and Video, and listed once overall", async ({ page }) => {
    await page.goto("/");

    const counts = await page.evaluate(async () => {
      const [{ audioTools }, { videoTools }, { allTools }] = await Promise.all([
        // @ts-expect-error -- dev-server module path
        import("/src/app/audio-tools-grid.tsx"),
        // @ts-expect-error -- dev-server module path
        import("/src/app/video-tools-grid.tsx"),
        // @ts-expect-error -- dev-server module path
        import("/src/app/tools-hub.tsx"),
      ]);
      const isCaption = (tool: { href: string }) => tool.href === "/caption";
      return {
        audio: audioTools.filter(isCaption).length,
        video: videoTools.filter(isCaption).length,
        all: allTools.filter(isCaption).length,
        duplicateHrefs: allTools
          .map((t: { href: string }) => t.href)
          .filter((h: string, i: number, a: string[]) => a.indexOf(h) !== i),
      };
    });

    expect(counts.audio).toBe(1);
    expect(counts.video).toBe(1);
    // Concatenating the family lists hands the same tool over twice; the "All"
    // tab must still show one card, under one React key.
    expect(counts.all).toBe(1);
    expect(counts.duplicateHrefs).toEqual([]);
  });

  /**
   * The page as a browser that *can* run this sees it.
   *
   * No headless Chromium hands back a WebGPU adapter — SwiftShader does not
   * provide one either, which was tried — so the supported half of this page is
   * unreachable in a test unless the capability probe is answered for it. That
   * is all this stub does: it says "yes, there is an adapter" and changes
   * nothing else, so everything below is the app's own behaviour.
   */
  test.describe("on a browser that can run it", () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "gpu", {
          configurable: true,
          value: { requestAdapter: async () => ({ stub: true }) },
        });
      });
    });

    test("offers the dropzone, and does not fetch the model to do it", async ({ page }) => {
      // Opening a page must not pull a quarter of a gigabyte. The weights are
      // fetched when a file is dropped, or up front only when they are already
      // cached — never on a first visit that might just bounce. That costs real
      // bandwidth on the model host, for a visitor who may only be looking.
      // Routed on the context, not listened for on the page: the fetch would
      // come from the worker, and worker requests never reach page.on. Aborting
      // rather than counting keeps a regression here from actually pulling a
      // quarter of a gigabyte through the test.
      const weightRequests: string[] = [];
      await page.context().route(/huggingface\.co|\.onnx(\?|$)/, (route) => {
        weightRequests.push(route.request().url());
        void route.abort();
      });

      await page.goto("/caption");
      await expect(page.getByText("Drop a video or audio file here")).toBeVisible();
      await expect(page.getByText("Runs on your own machine")).toBeVisible();
      await page.waitForTimeout(1500);

      expect(weightRequests).toEqual([]);
    });

    test("accepts the media formats it claims to", async ({ page }) => {
      await page.goto("/caption");
      const accept = await getDropzoneAccept(page);
      for (const extension of [".mp4", ".mov", ".mkv", ".webm", ".mp3", ".wav", ".m4a"]) {
        expect(accept).toContain(extension);
      }
    });
  });

  // ------------------------------------------------------ subtitle files

  /**
   * The browser's own WebVTT parser is the only opinion that counts on whether
   * a .vtt file is valid, so the file is handed to it through a <track> and
   * read back out of `track.cues`.
   */
  async function parseVTT(page: Page, vtt: string) {
    return page.evaluate(async (text: string) => {
      const video = document.createElement("video");
      const track = document.createElement("track");
      track.src = URL.createObjectURL(new Blob([text], { type: "text/vtt" }));
      track.kind = "subtitles";
      track.default = true;
      video.append(track);
      document.body.append(video);
      track.track.mode = "hidden";

      await new Promise<void>((resolve, reject) => {
        track.addEventListener("load", () => resolve(), { once: true });
        track.addEventListener("error", () => reject(new Error("the browser rejected the VTT")), { once: true });
        setTimeout(() => reject(new Error("the VTT never finished loading")), 5000);
      });

      const cues = Array.from(track.track.cues ?? []).map((cue) => ({
        start: cue.startTime,
        end: cue.endTime,
        // `.text` is the raw cue source, escapes and all. What the viewer reads
        // is the parsed form, which is what getCueAsHTML builds.
        text: (cue as VTTCue).getCueAsHTML().textContent ?? "",
        raw: (cue as VTTCue).text,
      }));
      URL.revokeObjectURL(track.src);
      video.remove();
      return cues;
    }, vtt);
  }

  test("writes a VTT the browser reads back cue for cue", async ({ page }) => {
    await page.goto("/caption");

    const vtt = await page.evaluate(async () => {
      // @ts-expect-error -- dev-server module path
      const { toVTT, wordsToCues } = await import("/src/lib/caption/cues.ts");
      const words = [
        { text: "the", start: 0.0, end: 0.2 },
        { text: "quick", start: 0.25, end: 0.6 },
        { text: "fox.", start: 0.65, end: 1.1 },
        { text: "then", start: 4.0, end: 4.3 },
        { text: "nothing", start: 4.35, end: 4.9 },
      ];
      return toVTT(wordsToCues(words, 10));
    });

    const cues = await parseVTT(page, vtt);
    expect(cues.length).toBeGreaterThan(0);
    expect(cues.map((cue) => cue.text).join(" ")).toContain("the quick fox.");

    for (const cue of cues) expect(cue.end).toBeGreaterThan(cue.start);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i].start).toBeGreaterThanOrEqual(cues[i - 1].end);
    }
  });

  /**
   * "<" opens a tag in WebVTT and "&" opens an entity, so a caption containing
   * either is not text as far as the parser is concerned. Someone fixing a line
   * by hand will type both. What comes back out has to be what they typed.
   */
  test("survives markup a person might type into a caption", async ({ page }) => {
    await page.goto("/caption");

    const vtt = await page.evaluate(async () => {
      // @ts-expect-error -- dev-server module path
      const { toVTT } = await import("/src/lib/caption/cues.ts");
      return toVTT([
        { start: 0, end: 2, text: "R&D <laughs> 5 < 6" },
        { start: 3, end: 5, text: "an arrow --> here" },
      ]);
    });

    const cues = await parseVTT(page, vtt);
    expect(cues).toHaveLength(2);
    // What the viewer sees is exactly what was typed...
    expect(cues[0].text).toBe("R&D <laughs> 5 < 6");
    expect(cues[1].text).toBe("an arrow --> here");
    // ...which it only is because the file escaped it on the way out. Written
    // literally, "<laughs>" parses as a tag and disappears from the caption.
    expect(cues[0].raw).toContain("&lt;laughs>");
  });

  test("writes an SRT with ascending, non-overlapping timings", async ({ page }) => {
    await page.goto("/caption");

    const srt = await page.evaluate(async () => {
      // @ts-expect-error -- dev-server module path
      const { toSRT, wordsToCues } = await import("/src/lib/caption/cues.ts");
      // A last word timed past the end of the audio, which is what the model
      // does: the cue must not come back as `12.000 --> 10.000`.
      const words = Array.from({ length: 30 }, (_, i) => ({
        text: i % 4 === 3 ? `word${i}.` : `word${i}`,
        start: i * 0.4,
        end: i * 0.4 + 0.35,
      }));
      words.push({ text: "over.", start: 12.4, end: 12.9 });
      return toSRT(wordsToCues(words, 12));
    });

    const timings = [...srt.matchAll(/(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)/g)];
    expect(timings.length).toBeGreaterThan(1);

    const seconds = (h: string, m: string, s: string, ms: string) => +h * 3600 + +m * 60 + +s + +ms / 1000;
    let previousEnd = -1;
    for (const [, h1, m1, s1, ms1, h2, m2, s2, ms2] of timings) {
      const start = seconds(h1, m1, s1, ms1);
      const end = seconds(h2, m2, s2, ms2);
      expect(end).toBeGreaterThanOrEqual(start);
      expect(start).toBeGreaterThanOrEqual(previousEnd);
      previousEnd = end;
    }

    // Numbered from one, with no gaps: a missing index makes players skip cues.
    const indices = [...srt.matchAll(/^(\d+)$/gm)].map((match) => Number(match[1]));
    expect(indices).toEqual(indices.map((_, i) => i + 1));
  });

  // ------------------------------------------------------------ decoding

  test.describe("decoding to 16 kHz mono", () => {
    test.skip(!hasFfmpeg(), "needs ffmpeg to build media fixtures");

    /**
     * Runs the real decoder on real bytes and reports back enough to tell a
     * good result from a plausible-looking one.
     *
     * `crossings` is what makes this more than a smoke test: every fixture is a
     * 440 Hz sine, so counting sign changes recovers the pitch. A resampler
     * that aliases, drops a channel, or mis-strides gets the sample count right
     * and the frequency wrong.
     */
    async function decode(page: Page, bytes: number[], name: string, via: "auto" | "streaming" = "auto") {
      return page.evaluate(
        async ({ b, name, via }) => {
          // @ts-expect-error -- dev-server module path
          const { decodeToMono16k, decodeStreaming, NoAudioError } = await import("/src/lib/caption/decode.ts");
          const file = new File([new Uint8Array(b)], name);
          const run = via === "streaming" ? decodeStreaming : decodeToMono16k;

          const progress: number[] = [];
          try {
            const { pcm, sampleRate, duration } = await run(file, (f: number) => progress.push(f));

            // Skip the first and last 10%: encoder priming and the tail fade
            // are not the steady-state signal being measured.
            const from = Math.floor(pcm.length * 0.1);
            const to = Math.floor(pcm.length * 0.9);
            let crossings = 0;
            let peak = 0;
            for (let i = from + 1; i < to; i++) {
              if (pcm[i] >= 0 !== pcm[i - 1] >= 0) crossings++;
              const level = Math.abs(pcm[i]);
              if (level > peak) peak = level;
            }
            const seconds = (to - from) / sampleRate;

            return {
              ok: true as const,
              sampleRate,
              duration,
              samples: pcm.length,
              peak,
              hz: crossings / 2 / seconds,
              progress,
            };
          } catch (error) {
            return { ok: false as const, noAudio: error instanceof NoAudioError, error: String(error) };
          }
        },
        { b: bytes, name, via },
      );
    }

    const read = (path: string) => toBytes(readFileSync(path));

    test("resamples 48 kHz stereo down without wrecking the signal", async ({ page }) => {
      await page.goto("/caption");
      const result = await decode(page, read(mp4WithAudio("caption-48k.mp4")), "caption-48k.mp4");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.sampleRate).toBe(16_000);
      expect(result.duration).toBeGreaterThan(1.8);
      expect(result.duration).toBeLessThan(2.3);
      expect(result.samples).toBeGreaterThan(28_000);
      // The tone survived the trip: still 440 Hz, still audible.
      expect(result.hz).toBeGreaterThan(420);
      expect(result.hz).toBeLessThan(460);
      expect(result.peak).toBeGreaterThan(0.05);
    });

    test("resamples 22.05 kHz mono up without wrecking the signal", async ({ page }) => {
      await page.goto("/caption");
      const result = await decode(page, read(mp4MonoAudio("caption-mono.mp4")), "caption-mono.mp4");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.sampleRate).toBe(16_000);
      expect(result.hz).toBeGreaterThan(420);
      expect(result.hz).toBeLessThan(460);
      expect(result.peak).toBeGreaterThan(0.05);
    });

    test("reads Opus in WebM", async ({ page }) => {
      await page.goto("/caption");
      const result = await decode(page, read(webmVp8("caption-vp8.webm")), "caption-vp8.webm");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.sampleRate).toBe(16_000);
      expect(result.hz).toBeGreaterThan(420);
      expect(result.hz).toBeLessThan(460);
    });

    test("reads Matroska", async ({ page }) => {
      await page.goto("/caption");
      const result = await decode(page, read(mkvWithAudio("caption-mkv.mkv")), "caption-mkv.mkv");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.sampleRate).toBe(16_000);
      expect(result.hz).toBeGreaterThan(420);
      expect(result.hz).toBeLessThan(460);
    });

    /**
     * The streaming decoder, called head-on.
     *
     * It cannot be reached through `decodeToMono16k` here: Chromium's own
     * decoder reads every container mediabunny does — Matroska included, which
     * was measured rather than assumed — so the fast path always wins, and the
     * only other way in is a file above the 300 MB rule. Neither is testable.
     * But this is the code that runs on a gigabyte file and on browsers with a
     * narrower decoder, so it gets checked directly instead of not at all.
     */
    test("streams to the same 16 kHz mono, and finishes its progress", async ({ page }) => {
      await page.goto("/caption");
      const bytes = read(mp4WithAudio("caption-48k.mp4"));

      const result = await page.evaluate(async (b) => {
        // @ts-expect-error -- dev-server module path
        const { decodeStreaming } = await import("/src/lib/caption/decode.ts");
        const file = new File([new Uint8Array(b)], "caption-48k.mp4");

        const progress: number[] = [];
        const { pcm, sampleRate, duration } = await decodeStreaming(file, (f: number) => progress.push(f));

        const from = Math.floor(pcm.length * 0.1);
        const to = Math.floor(pcm.length * 0.9);
        let crossings = 0;
        let peak = 0;
        for (let i = from + 1; i < to; i++) {
          if (pcm[i] >= 0 !== pcm[i - 1] >= 0) crossings++;
          const level = Math.abs(pcm[i]);
          if (level > peak) peak = level;
        }
        return {
          sampleRate,
          duration,
          samples: pcm.length,
          peak,
          hz: crossings / 2 / ((to - from) / sampleRate),
          progress,
        };
      }, bytes);

      expect(result.sampleRate).toBe(16_000);
      expect(result.duration).toBeGreaterThan(1.8);
      expect(result.duration).toBeLessThan(2.3);
      expect(result.hz).toBeGreaterThan(420);
      expect(result.hz).toBeLessThan(460);
      expect(result.peak).toBeGreaterThan(0.05);

      // The buffer is preallocated from the container duration and returned as
      // a view over the part actually filled, so a wrong length here means the
      // trailing slack leaked into the audio handed to the model.
      expect(result.samples).toBeLessThanOrEqual(Math.ceil(result.duration * 16_000) + 1);

      // The bar has to reach the end; it used to stop wherever the last yield
      // happened to land.
      expect(result.progress.at(-1)).toBe(1);
    });

    /**
     * The resampler averages the input samples each output sample spans rather
     * than picking the nearest one. Averaging three samples is a mild low-pass
     * — a boxcar, not a designed filter — but it is the difference between
     * clean speech and aliased hash: going 48 kHz to 16 kHz, anything above
     * 8 kHz folds back down on top of the voice.
     *
     * A 10 kHz tone is the check, against a 440 Hz one from an identical
     * fixture. Measured: averaging leaves the high tone at 0.79 of the low
     * one, point-sampling passes it through at 1.00 — disguised as 6 kHz.
     */
    test("attenuates what will not fit under the new Nyquist limit", async ({ page }) => {
      await page.goto("/caption");

      // Through the streaming decoder on purpose: Chromium's own decoder reads
      // these files and resamples them with its own filter, so going in by the
      // front door would measure Chrome's resampler rather than this one.
      // The two fixtures are identical but for the frequency.
      const low = await decode(page, read(mkvTone("caption-tone-440.mkv", 440)), "a.mkv", "streaming");
      const high = await decode(page, read(mkvTone("caption-tone-10k.mkv", 10_000)), "b.mkv", "streaming");

      expect(low.ok).toBe(true);
      expect(high.ok).toBe(true);
      if (!low.ok || !high.ok) return;

      // 440 Hz sails through untouched. The fixture itself peaks at 0.125 —
      // ffmpeg's sine source is not full scale — so this is a floor, not a
      // claim about absolute level.
      expect(low.peak).toBeGreaterThan(0.11);
      expect(high.peak).toBeLessThan(low.peak * 0.9);
    });

    test("says there is no audio rather than returning silence", async ({ page }) => {
      await page.goto("/caption");
      const result = await decode(page, read(mp4NoAudio("caption-silent.mp4")), "caption-silent.mp4");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.noAudio).toBe(true);
    });
  });
});
