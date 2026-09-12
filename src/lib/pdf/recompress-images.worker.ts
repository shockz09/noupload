/// <reference lib="webworker" />

import type { PDFDict, PDFRawStream } from "pdf-lib";

declare const self: DedicatedWorkerGlobalScope;

export interface RecompressMessage {
  id: string;
  inputData: Uint8Array;
  /** MozJPEG quality, already matched to the level the user picked. */
  quality: number;
  /**
   * Measure what the document is made of and return that instead of re-encoding
   * anything. Parsing costs a second or two; running the image path on a
   * document that turns out to be all text costs far more.
   */
  probeOnly?: boolean;
}

/**
 * What a document is made of, measured in one parse. Enough to pick the right
 * engine up front instead of running each one to find out.
 */
export interface DocumentProfile {
  /**
   * Encrypted documents are a dead end for every engine, and some of them fail
   * by handing back a valid-looking file with the user's content gone, so this
   * is checked before anything runs.
   */
  encrypted: boolean;
  /** Image bytes as a fraction of the file. */
  imageShare: number;
  /** Of those image bytes, the fraction MozJPEG can actually re-encode. */
  compatibleShare: number;
  /** Embedded font bytes as a fraction of the file — what MuPDF subsets away. */
  fontShare: number;
  imageCount: number;
}

export interface RecompressResponse {
  id: string;
  success: boolean;
  data?: Uint8Array;
  /** probeOnly: what the document is made of, for routing. */
  profile?: DocumentProfile;
  /** Images converted / images eligible, for logging. */
  converted?: number;
  total?: number;
  error?: string;
  progress?: string;
}

/**
 * Undoes the PNG predictor Ghostscript applies to Flate image streams.
 *
 * Each row is prefixed with a filter-type byte and encoded against its left and
 * upper neighbours; without reversing that, the "pixels" are deltas and the
 * re-encoded image is noise.
 */
function undoPngPredictor(data: Uint8Array, colors: number, bitsPerComponent: number, columns: number): Uint8Array {
  const bytesPerPixel = Math.max(1, Math.ceil((colors * bitsPerComponent) / 8));
  const rowLength = Math.ceil((colors * bitsPerComponent * columns) / 8);
  const rows = Math.floor(data.length / (rowLength + 1));
  const out = new Uint8Array(rows * rowLength);

  let prev = new Uint8Array(rowLength);

  for (let r = 0; r < rows; r++) {
    const filterType = data[r * (rowLength + 1)];
    const src = data.subarray(r * (rowLength + 1) + 1, r * (rowLength + 1) + 1 + rowLength);
    const cur = out.subarray(r * rowLength, (r + 1) * rowLength);
    cur.set(src);

    switch (filterType) {
      case 0: // None
        break;
      case 1: // Sub
        for (let i = bytesPerPixel; i < rowLength; i++) cur[i] = (cur[i] + cur[i - bytesPerPixel]) & 0xff;
        break;
      case 2: // Up
        for (let i = 0; i < rowLength; i++) cur[i] = (cur[i] + prev[i]) & 0xff;
        break;
      case 3: // Average
        for (let i = 0; i < rowLength; i++) {
          const left = i >= bytesPerPixel ? cur[i - bytesPerPixel] : 0;
          cur[i] = (cur[i] + ((left + prev[i]) >> 1)) & 0xff;
        }
        break;
      case 4: // Paeth
        for (let i = 0; i < rowLength; i++) {
          const a = i >= bytesPerPixel ? cur[i - bytesPerPixel] : 0;
          const b = prev[i];
          const c = i >= bytesPerPixel ? prev[i - bytesPerPixel] : 0;
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          cur[i] = (cur[i] + pred) & 0xff;
        }
        break;
      default:
        throw new Error(`Unsupported PNG predictor filter ${filterType}`);
    }

    prev = cur;
  }

  return out;
}

/** Components per pixel for the colour spaces we are willing to re-encode. */
type Components = 1 | 3;

self.onmessage = async (event: MessageEvent<RecompressMessage>) => {
  const { id, inputData, quality, probeOnly } = event.data;

  try {
    const [
      { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFDict, PDFArray, PDFRef, decodePDFRawStream },
      { default: encode },
    ] = await Promise.all([import("pdf-lib"), import("@jsquash/jpeg/encode")]);

    const doc = await PDFDocument.load(inputData, { ignoreEncryption: true, updateMetadata: false });
    const context = doc.context;

    /** DeviceRGB/DeviceGray, directly or behind an ICCBased/Cal wrapper. */
    const componentsOf = (raw: unknown): Components | null => {
      const cs = context.lookup(raw as never);

      if (cs instanceof PDFName) {
        const name = cs.asString();
        if (name === "/DeviceRGB" || name === "/CalRGB") return 3;
        if (name === "/DeviceGray" || name === "/CalGray") return 1;
        return null;
      }

      if (cs instanceof PDFArray && cs.size() >= 2) {
        const family = context.lookup(cs.get(0));
        if (!(family instanceof PDFName)) return null;
        const familyName = family.asString();

        if (familyName === "/ICCBased") {
          const stream = context.lookup(cs.get(1));
          const n = stream instanceof PDFRawStream ? context.lookup(stream.dict.get(PDFName.of("N"))) : null;
          if (n instanceof PDFNumber) {
            if (n.asNumber() === 3) return 3;
            if (n.asNumber() === 1) return 1;
          }
          return null;
        }

        if (familyName === "/CalRGB") return 3;
        if (familyName === "/CalGray") return 1;
      }

      return null;
    };

    /** The filter chain as plain names, so a one-element array reads the same. */
    const filterNames = (dict: PDFDict): string[] => {
      const filter = context.lookup(dict.get(PDFName.of("Filter")));
      if (filter instanceof PDFName) return [filter.asString()];
      if (filter instanceof PDFArray) {
        const names: string[] = [];
        for (let i = 0; i < filter.size(); i++) {
          const entry = context.lookup(filter.get(i));
          if (entry instanceof PDFName) names.push(entry.asString());
        }
        return names;
      }
      return [];
    };

    /** Ghostscript's own Flate photos — the ones it left for us to encode. */
    const isLoose = (dict: PDFDict): boolean => {
      const names = filterNames(dict);
      return names.length === 1 && names[0] === "/FlateDecode";
    };

    /**
     * Can MozJPEG take this image? The probe asks the same question of the
     * original file so the router knows, before paying for a Ghostscript pass,
     * whether this route can cover the document at all.
     */
    const isConvertible = (stream: PDFRawStream): boolean => {
      const dict = stream.dict;
      if (context.lookup(dict.get(PDFName.of("ImageMask")))) return false;
      if (context.lookup(dict.get(PDFName.of("Decode")))) return false;
      const bpc = context.lookup(dict.get(PDFName.of("BitsPerComponent")));
      if (!(bpc instanceof PDFNumber) || bpc.asNumber() !== 8) return false;
      return componentsOf(dict.get(PDFName.of("ColorSpace"))) !== null;
    };

    const allObjects = [...context.enumerateIndirectObjects()];

    const images = allObjects.filter(
      ([, object]) =>
        object instanceof PDFRawStream &&
        context.lookup(object.dict.get(PDFName.of("Subtype"))) === PDFName.of("Image"),
    );

    /**
     * Soft masks carry a shape, not a picture, and JPEG's ringing lands on the
     * edge of that shape as a halo around whatever it cuts out — on a quiz deck
     * whose logos arrive as image-plus-mask, re-encoding the masks left visible
     * grey mush around every sharp edge (worst-tile SSIM 0.27 against 0.55 with
     * them left alone).
     *
     * Leaving them lossless costs 64KB on that file. Encoding them at a quality
     * high enough to avoid the halo was measured instead, and gave 3KB of that
     * back, so there is nothing to buy here: they stay as they are.
     */
    const maskTags = new Set<string>();
    for (const [, object] of images) {
      const dict = (object as PDFRawStream).dict;
      for (const key of ["SMask", "Mask"]) {
        const value = dict.get(PDFName.of(key));
        if (value instanceof PDFRef) maskTags.add(value.tag);
      }
    }

    const dimensionsOf = (dict: PDFDict): { width: number; height: number } | null => {
      const w = context.lookup(dict.get(PDFName.of("Width")));
      const h = context.lookup(dict.get(PDFName.of("Height")));
      if (!(w instanceof PDFNumber) || !(h instanceof PDFNumber)) return null;
      const width = w.asNumber();
      const height = h.asNumber();
      return width >= 1 && height >= 1 ? { width, height } : null;
    };

    /** Images we are willing to touch, in document order. */
    const eligible: number[] = [];
    for (let index = 0; index < images.length; index++) {
      const [ref, object] = images[index];
      const stream = object as PDFRawStream;
      if (maskTags.has(ref.tag)) continue;
      if (!isConvertible(stream)) continue;
      if (!isLoose(stream.dict)) continue;
      if (!dimensionsOf(stream.dict)) continue;
      eligible.push(index);
    }

    if (probeOnly) {
      let imageBytes = 0;
      let compatibleBytes = 0;

      for (const [, object] of images) {
        const stream = object as PDFRawStream;
        const size = stream.getContents().length;
        imageBytes += size;
        if (isConvertible(stream)) compatibleBytes += size;
      }

      // Embedded font programs, which is what MuPDF's subsetting goes after.
      let fontBytes = 0;
      for (const [, object] of allObjects) {
        if (!(object instanceof PDFRawStream)) continue;
        const dict = object.dict;
        const subtype = context.lookup(dict.get(PDFName.of("Subtype")));
        const isFontProgram =
          dict.get(PDFName.of("Length1")) !== undefined ||
          (subtype instanceof PDFName && ["/Type1C", "/CIDFontType0C", "/OpenType"].includes(subtype.asString()));
        if (isFontProgram) fontBytes += object.getContents().length;
      }

      const total = Math.max(inputData.length, 1);
      self.postMessage({
        id,
        success: true,
        profile: {
          encrypted: doc.isEncrypted,
          imageShare: imageBytes / total,
          compatibleShare: imageBytes > 0 ? compatibleBytes / imageBytes : 0,
          fontShare: fontBytes / total,
          imageCount: images.length,
        },
      } as RecompressResponse);
      return;
    }

    let converted = 0;

    for (let seen = 0; seen < eligible.length; seen++) {
      const [ref, object] = images[eligible[seen]];
      const stream = object as PDFRawStream;
      const dict = stream.dict;

      if (seen % 10 === 0) {
        self.postMessage({
          id,
          progress: `Re-encoding images (${seen + 1}/${eligible.length})...`,
        } as RecompressResponse);
      }

      try {
        // Only losslessly-stored photos are touched. Anything else — a stencil
        // mask, an exotic colour space, 1/2/4-bit data, an inverted /Decode
        // array — is left exactly as it was found.
        const dims = dimensionsOf(dict);
        if (!dims) continue;
        const { width, height } = dims;

        const components = componentsOf(dict.get(PDFName.of("ColorSpace")));
        if (!components) continue;

        let samples = decodePDFRawStream(stream).decode();

        const parms = context.lookup(dict.get(PDFName.of("DecodeParms")));
        if (parms instanceof PDFDict) {
          const predictor = context.lookup(parms.get(PDFName.of("Predictor")));
          const predictorValue = predictor instanceof PDFNumber ? predictor.asNumber() : 1;
          if (predictorValue >= 10) {
            const columns = context.lookup(parms.get(PDFName.of("Columns")));
            const colorsEntry = context.lookup(parms.get(PDFName.of("Colors")));
            samples = undoPngPredictor(
              samples,
              colorsEntry instanceof PDFNumber ? colorsEntry.asNumber() : 1,
              8,
              columns instanceof PDFNumber ? columns.asNumber() : width,
            );
          } else if (predictorValue !== 1) {
            // TIFF predictor: rare from pdfwrite, not worth guessing at.
            continue;
          }
        }

        const pixelCount = width * height;
        if (samples.length < pixelCount * components) continue;

        // MozJPEG takes RGBA regardless; grayscale is written into all three
        // channels so any luma conversion inside the encoder is a no-op.
        const rgba = new Uint8ClampedArray(pixelCount * 4);
        if (components === 3) {
          for (let p = 0, s = 0, d = 0; p < pixelCount; p++, s += 3, d += 4) {
            rgba[d] = samples[s];
            rgba[d + 1] = samples[s + 1];
            rgba[d + 2] = samples[s + 2];
            rgba[d + 3] = 255;
          }
        } else {
          for (let p = 0, d = 0; p < pixelCount; p++, d += 4) {
            const v = samples[p];
            rgba[d] = v;
            rgba[d + 1] = v;
            rgba[d + 2] = v;
            rgba[d + 3] = 255;
          }
        }

        const jpeg = new Uint8Array(
          await encode(new ImageData(rgba, width, height), {
            quality,
            // PDF readers are only guaranteed baseline DCT; a progressive scan
            // is smaller but not universally safe inside a PDF.
            baseline: true,
            progressive: false,
            optimize_coding: true,
            color_space: components === 3 ? 3 : 1,
          }),
        );

        if (jpeg.length >= stream.getContents().length) continue;

        dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
        dict.delete(PDFName.of("DecodeParms"));
        context.assign(ref, PDFRawStream.of(dict, jpeg));
        converted++;
      } catch (imageError) {
        // One awkward image must not cost the whole document its compression.
        console.warn("[recompress worker] skipped an image:", imageError);
      }
    }

    const saved = await doc.save({ useObjectStreams: true, addDefaultPage: false });
    const result = new Uint8Array(saved);

    self.postMessage({ id, success: true, data: result, converted, total: eligible.length } as RecompressResponse, [
      result.buffer,
    ]);
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    } as RecompressResponse);
  }
};
