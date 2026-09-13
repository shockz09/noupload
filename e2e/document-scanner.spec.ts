import { expect, test } from "@playwright/test";

/**
 * The camera scanner, against synthetic photographs with known geometry.
 *
 * These run in a real browser because the detector's Canny pass is WASM — the
 * interesting failures are in the parts a jsdom test cannot reach.
 *
 * Flattening is checked with a page that is black on its left half and white on
 * its right, so a correct result has one straight vertical edge down the middle.
 * That is exactly what the previous implementation could not produce: it cropped
 * an axis-aligned box and stretched it, leaving the photograph's skew in place,
 * so the edge came out as a diagonal.
 */

/** Injected into the page: builds a photo of a page lying on a dark desk. */
const scene = `
  const solveH = (src, dst) => {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [sx, sy] = src[i], [dx, dy] = dst[i];
      A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]); b.push(dx);
      A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]); b.push(dy);
    }
    for (let i = 0; i < 8; i++) {
      let p = i;
      for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      for (let r = i + 1; r < 8; r++) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const h = new Array(9).fill(1);
    for (let i = 7; i >= 0; i--) {
      let s = b[i];
      for (let c = i + 1; c < 8; c++) s -= A[i][c] * h[c];
      h[i] = s / A[i][i];
    }
    return h;
  };

  const invert3 = ([a, b, c, d, e, f, g, i, j]) => {
    const det = a * (e * j - f * i) - b * (d * j - f * g) + c * (d * i - e * g);
    return [(e*j-f*i)/det, (c*i-b*j)/det, (b*f-c*e)/det,
            (f*g-d*j)/det, (a*j-c*g)/det, (c*d-a*f)/det,
            (d*i-e*g)/det, (b*g-a*i)/det, (a*e-b*d)/det];
  };

  /**
   * "text"  - a realistic sheet: light paper, lines of type. Used where the
   *           question is how accurately the page itself is located.
   * "split" - black left half, white right half, giving one hard vertical edge
   *           to check the flattening against. Deliberately unrealistic.
   */
  const makePage = (w, h, content) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    x.fillStyle = "#fbfbf8"; x.fillRect(0, 0, w, h);
    if (content === "split") {
      x.fillStyle = "#141414"; x.fillRect(0, 0, w / 2, h);
    } else {
      x.fillStyle = "#1a1a1a";
      x.font = Math.round(h * 0.045) + "px serif";
      x.fillText("INVOICE", w * 0.08, h * 0.12);
      for (let i = 0; i < 22; i++) {
        x.fillStyle = "#2b2b2b";
        x.fillRect(w * 0.08, h * 0.2 + i * h * 0.033, w * (0.55 + 0.28 * Math.abs(Math.sin(i * 2.3))), h * 0.007);
      }
    }
    return x.getImageData(0, 0, w, h);
  };

  /**
   * @param skew    0 gives a square-on photo; 1 a steeply angled one.
   * @param content "text" or "split" - see makePage. Omit for an empty desk.
   */
  window.__buildScene = (seed, W, H, skew, content) => {
    let s = seed;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#4a3b2c"); g.addColorStop(1, "#2e241a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const desk = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < desk.data.length; i += 4) {
      const n = (rnd() - 0.5) * 30;
      desk.data[i] += n; desk.data[i + 1] += n; desk.data[i + 2] += n;
    }
    ctx.putImageData(desk, 0, 0);

    if (!content) return { canvas, truth: null };

    const pw = 620, ph = 850;
    const page = makePage(pw, ph, content);
    const jitter = () => (rnd() - 0.5) * Math.min(W, H) * 0.14 * skew;
    const truth = [
      [W * 0.1 + jitter(), H * 0.1 + jitter()],
      [W * 0.9 + jitter(), H * 0.1 + jitter()],
      [W * 0.9 + jitter(), H * 0.9 + jitter()],
      [W * 0.1 + jitter(), H * 0.9 + jitter()],
    ];
    const Hi = invert3(solveH([[0, 0], [pw, 0], [pw, ph], [0, ph]], truth));

    const out = ctx.getImageData(0, 0, W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const w2 = Hi[6] * x + Hi[7] * y + Hi[8];
        const u = (Hi[0] * x + Hi[1] * y + Hi[2]) / w2;
        const v = (Hi[3] * x + Hi[4] * y + Hi[5]) / w2;
        if (u < 0 || v < 0 || u >= pw || v >= ph) continue;
        const si = ((v | 0) * pw + (u | 0)) * 4;
        const di = (y * W + x) * 4;
        // uneven lighting across the sheet, plus a little sensor noise
        const shade = 0.8 + 0.2 * (1 - v / ph) + (rnd() - 0.5) * 0.04;
        out.data[di] = page.data[si] * shade;
        out.data[di + 1] = page.data[si + 1] * shade;
        out.data[di + 2] = page.data[si + 2] * shade;
        out.data[di + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    return { canvas, truth };
  };
`;

const SCENE_W = 900;
const SCENE_H = 1200;

test.describe("camera document scanner", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.addScriptTag({ content: scene });
  });

  test("finds the page in an angled photo", async ({ page }) => {
    const result = await page.evaluate(
      async ([W, H]) => {
        // @ts-expect-error -- dev-server module path
        const { detectDocument } = await import("/src/lib/document-scanner.ts");
        const errors: number[] = [];

        for (let seed = 1; seed <= 5; seed++) {
          const { canvas, truth } = (window as any).__buildScene(seed * 7919, W, H, 1, "text");
          const found = await detectDocument(canvas);
          if (!found) return { ok: false as const, error: `seed ${seed}: no page found` };

          const mean =
            found.corners.reduce(
              (sum: number, c: { x: number; y: number }, i: number) =>
                sum + Math.hypot(c.x - truth[i][0], c.y - truth[i][1]),
              0,
            ) / 4;
          errors.push(mean);
        }
        return { ok: true as const, worst: Math.max(...errors) };
      },
      [SCENE_W, SCENE_H],
    );

    expect(result.ok, "error" in result ? result.error : undefined).toBe(true);
    if (!result.ok) return;
    // The hand-rolled detector this replaced returned null on every one of these.
    expect(result.worst).toBeLessThan(15);
  });

  test("flattens the perspective instead of cropping a box around it", async ({ page }) => {
    const result = await page.evaluate(
      async ([W, H]) => {
        // @ts-expect-error -- dev-server module path
        const { detectDocument, rectifyDocument } = await import("/src/lib/document-scanner.ts");

        const { canvas } = (window as any).__buildScene(4242, W, H, 1, "split");
        const found = await detectDocument(canvas);
        if (!found) return { ok: false as const, error: "no page found" };

        const flat = await rectifyDocument(canvas, found.corners);
        const ctx = flat.getContext("2d")!;
        const { data } = ctx.getImageData(0, 0, flat.width, flat.height);

        // Walk each row and note where black gives way to white. On a properly
        // flattened page that column is the same every row.
        const columns: number[] = [];
        for (let y = Math.round(flat.height * 0.2); y < flat.height * 0.8; y += 4) {
          for (let x = 1; x < flat.width; x++) {
            const i = (y * flat.width + x) * 4;
            const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
            if (lum > 128) {
              columns.push(x);
              break;
            }
          }
        }
        if (columns.length < 10) return { ok: false as const, error: "no edge found in the output" };

        const mean = columns.reduce((a, b) => a + b, 0) / columns.length;
        const spread = Math.sqrt(columns.reduce((s, c) => s + (c - mean) ** 2, 0) / columns.length);

        return {
          ok: true as const,
          spread,
          meanColumn: mean,
          width: flat.width,
          height: flat.height,
        };
      },
      [SCENE_W, SCENE_H],
    );

    expect(result.ok, "error" in result ? result.error : undefined).toBe(true);
    if (!result.ok) return;
    const { spread, meanColumn, width, height } = result;

    // The whole point of the fix: a straight vertical edge, not a diagonal.
    expect(spread).toBeLessThan(3);
    // ...and it lands down the middle, so the page was not cropped off-centre.
    expect(meanColumn / width).toBeGreaterThan(0.45);
    expect(meanColumn / width).toBeLessThan(0.55);
    // Output geometry follows the page, rather than the old fixed 800x1100.
    expect(height).toBeGreaterThan(width);
  });

  test("reports nothing when the camera is pointed at a bare desk", async ({ page }) => {
    const found = await page.evaluate(
      async ([W, H]) => {
        // @ts-expect-error -- dev-server module path
        const { detectDocument } = await import("/src/lib/document-scanner.ts");
        const { canvas } = (window as any).__buildScene(31337, W, H, 1);
        return await detectDocument(canvas);
      },
      [SCENE_W, SCENE_H],
    );

    expect(found).toBeNull();
  });

  test("refuses a corner list that is not a quad", async ({ page }) => {
    const message = await page.evaluate(async () => {
      // @ts-expect-error -- dev-server module path
      const { rectifyDocument } = await import("/src/lib/document-scanner.ts");
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      try {
        await rectifyDocument(canvas, [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ]);
        return null;
      } catch (err) {
        return (err as Error).message;
      }
    });

    expect(message).toContain("four corners");
  });
});
