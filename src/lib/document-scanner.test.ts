import { describe, expect, it } from "vitest";
import { enhanceDocument } from "./document-scanner";

/**
 * Node has no ImageData. `enhanceDocument` only ever touches `.data`, so a bare
 * buffer stands in for one.
 */
const imageOf = (pixels: number[][]): ImageData => {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  return { data, width: pixels.length, height: 1, colorSpace: "srgb" };
};

const grey = (level: number, count: number) => Array.from({ length: count }, () => [level, level, level]);

describe("enhanceDocument", () => {
  it("stretches a flat grey page across the full range", () => {
    // A photographed page: nothing darker than 90, nothing brighter than 160.
    const pixels = [...grey(90, 50), ...grey(125, 50), ...grey(160, 50)];

    const { data } = enhanceDocument(imageOf(pixels));

    expect(data[0]).toBeLessThan(10); // the darkest ink goes to black
    expect(data[149 * 4]).toBeGreaterThan(245); // the paper goes to white
  });

  it("keeps the mid-tone in the middle", () => {
    const pixels = [...grey(100, 50), ...grey(150, 50), ...grey(200, 50)];

    const { data } = enhanceDocument(imageOf(pixels));

    expect(data[50 * 4]).toBeGreaterThan(110);
    expect(data[50 * 4]).toBeLessThan(145);
  });

  it("preserves ordering — a darker pixel never ends up lighter", () => {
    const pixels = [...grey(80, 20), ...grey(110, 20), ...grey(140, 20), ...grey(170, 20)];

    const { data } = enhanceDocument(imageOf(pixels));

    const sampled = [0, 20, 40, 60].map((i) => data[i * 4]);
    expect(sampled).toEqual([...sampled].sort((a, b) => a - b));
  });

  it("ignores a lone speck of dust when choosing the black point", () => {
    // One stray black pixel in 400 sits below the 1st percentile, so the
    // mapping should be decided by the page, not by the speck.
    const withSpeck = enhanceDocument(imageOf([[0, 0, 0], ...grey(120, 200), ...grey(180, 199)]));
    const without = enhanceDocument(imageOf([...grey(120, 200), ...grey(180, 200)]));

    expect(withSpeck.data[4]).toBe(without.data[0]);
  });

  it("leaves a uniform image alone rather than dividing by zero", () => {
    const { data } = enhanceDocument(imageOf(grey(128, 10)));

    expect([...data.slice(0, 3)]).toEqual([128, 128, 128]);
  });

  it("does not disturb the alpha channel", () => {
    const { data } = enhanceDocument(imageOf([...grey(60, 10), ...grey(200, 10)]));

    expect(data[3]).toBe(255);
    expect(data[data.length - 1]).toBe(255);
  });
});
