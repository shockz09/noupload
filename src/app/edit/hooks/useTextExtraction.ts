"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadPdfjs } from "@/lib/pdfjs-config";
import { parseFontName, mapToWebFont } from "@/lib/font";
import { cleanupCanvas } from "@/lib/canvas";

export interface TextRegion {
	id: string;
	text: string;
	bbox: { x: number; y: number; width: number; height: number };
	fontSize: number;
	fontFamily: string;
	fontWeight: string;
	fontStyle: string;
	color: string;
	pageNumber: number;
	source: "native" | "ocr";
}

interface UseTextExtractionOptions {
	file: File | null;
	pageNumber: number;
	zoom: number;
}

interface UseTextExtractionReturn {
	regions: TextRegion[];
	isExtracting: boolean;
	extractionSource: "native" | "ocr" | null;
}

export function useTextExtraction({ file, pageNumber, zoom }: UseTextExtractionOptions): UseTextExtractionReturn {
	const [regions, setRegions] = useState<TextRegion[]>([]);
	const [isExtracting, setIsExtracting] = useState(false);
	const [extractionSource, setExtractionSource] = useState<"native" | "ocr" | null>(null);

	const cacheRef = useRef<Map<string, { regions: TextRegion[]; source: "native" | "ocr" }>>(new Map());
	const currentFileRef = useRef<File | null>(null);

	useEffect(() => {
		if (file !== currentFileRef.current) {
			cacheRef.current.clear();
			currentFileRef.current = file;
			setRegions([]);
			setExtractionSource(null);
		}
	}, [file]);

	const extractText = useCallback(async () => {
		if (!file || !pageNumber) return;

		const cacheKey = `${pageNumber}-${zoom}`;
		const cached = cacheRef.current.get(cacheKey);
		if (cached) {
			setRegions(cached.regions);
			setExtractionSource(cached.source);
			return;
		}

		setIsExtracting(true);
		setRegions([]);

		try {
			const nativeRegions = await extractNativeText(file, pageNumber, zoom);

			if (nativeRegions.length > 0) {
				cacheRef.current.set(cacheKey, { regions: nativeRegions, source: "native" });
				setRegions(nativeRegions);
				setExtractionSource("native");
				setIsExtracting(false);
				return;
			}

			const ocrRegions = await extractOCRText(file, pageNumber, zoom);
			cacheRef.current.set(cacheKey, { regions: ocrRegions, source: "ocr" });
			setRegions(ocrRegions);
			setExtractionSource("ocr");
		} catch (err) {
			console.error("Text extraction failed:", err);
			setRegions([]);
			setExtractionSource(null);
		} finally {
			setIsExtracting(false);
		}
	}, [file, pageNumber, zoom]);

	useEffect(() => {
		extractText();
	}, [extractText]);

	return { regions, isExtracting, extractionSource };
}

/**
 * Convert RGB components (0-1) to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
	const toHex = (c: number) => {
		const hex = Math.round(c * 255).toString(16);
		return hex.length === 1 ? `0${hex}` : hex;
	};
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extract text colors from operatorList
 */
async function extractTextColors(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	page: any,
): Promise<Map<number, string>> {
	const colorMap = new Map<number, string>();

	try {
		const operatorList = await page.getOperatorList();
		const { OPS } = await import("pdfjs-dist");

		let currentColor = "#000000";
		let textIndex = 0;

		for (let i = 0; i < operatorList.fnArray.length; i++) {
			const fn = operatorList.fnArray[i];
			const args = operatorList.argsArray[i];

			// Track fill color changes
			if (fn === OPS.setFillRGBColor && args.length >= 3) {
				currentColor = rgbToHex(args[0], args[1], args[2]);
			} else if (fn === OPS.setFillGray && args.length >= 1) {
				currentColor = rgbToHex(args[0], args[0], args[0]);
			} else if (fn === OPS.setFillCMYKColor && args.length >= 4) {
				// Simple CMYK to RGB conversion
				const [c, m, y, k] = args;
				const r = (1 - c) * (1 - k);
				const g = (1 - m) * (1 - k);
				const b = (1 - y) * (1 - k);
				currentColor = rgbToHex(r, g, b);
			}

			// When we see text operations, associate current color with text index
			if (fn === OPS.showText || fn === OPS.showSpacedText) {
				colorMap.set(textIndex, currentColor);
				textIndex++;
			}
		}
	} catch (err) {
		console.warn("Could not extract text colors:", err);
	}

	return colorMap;
}

/**
 * Extract text using PDF.js with color and font style info
 */
async function extractNativeText(file: File, pageNumber: number, scale: number): Promise<TextRegion[]> {
	const pdfjsLib = await loadPdfjs();

	const arrayBuffer = await file.arrayBuffer();
	const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
	const page = await pdf.getPage(pageNumber);

	const viewport = page.getViewport({ scale });
	const textContent = await page.getTextContent();

	// Get styles dictionary from textContent
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const styles =
		((textContent as any).styles as Record<
			string,
			{ fontFamily?: string; ascent?: number; descent?: number; vertical?: boolean }
		>) || {};

	// Extract colors from operatorList
	const colorMap = await extractTextColors(page);

	const regions: TextRegion[] = [];
	let textOpIndex = 0;

	for (let i = 0; i < textContent.items.length; i++) {
		const item = textContent.items[i];
		if (!("str" in item) || !item.str.trim()) continue;

		const textItem = item as {
			str: string;
			transform: number[];
			width: number;
			height: number;
			fontName: string;
		};

		const [, , , , tx, ty] = textItem.transform;
		const fontHeight = Math.abs(textItem.transform[3]);
		const fontSize = fontHeight * scale;

		const x = tx * scale;
		const y = (viewport.height / scale - ty) * scale;
		const width = textItem.width * scale;
		const height = fontSize;
		const adjustedY = y - height;

		// Get style info from styles dictionary
		const styleInfo = styles[textItem.fontName];
		const styleFontFamily = styleInfo?.fontFamily || "";

		// Parse font info from both fontName and styleFontFamily
		const parsedFromName = parseFontName(textItem.fontName || "");
		const parsedFromStyle = parseFontName(styleFontFamily || "");

		// Prefer style fontFamily if available, otherwise use parsed
		let fontFamily = parsedFromStyle.fontFamily;
		if (styleFontFamily && !styleFontFamily.includes("g_d")) {
			// Use the actual fontFamily from styles if it looks real (not like "g_d0_f1")
			fontFamily = mapToWebFont(styleFontFamily);
		}

		// Use detected weight/style from either source (prefer the one that found something)
		const fontWeight = parsedFromName.fontWeight !== "normal" ? parsedFromName.fontWeight : parsedFromStyle.fontWeight;
		const fontStyle = parsedFromName.fontStyle !== "normal" ? parsedFromName.fontStyle : parsedFromStyle.fontStyle;

		// Get color from operatorList (fallback to black)
		const color = colorMap.get(textOpIndex) || "#000000";
		textOpIndex++;

		regions.push({
			id: `native-${pageNumber}-${i}`,
			text: textItem.str,
			bbox: {
				x,
				y: adjustedY,
				width: Math.max(width, 10),
				height: Math.max(height, 8),
			},
			fontSize,
			fontFamily,
			fontWeight,
			fontStyle,
			color,
			pageNumber,
			source: "native",
		});
	}

	return regions;
}

/**
 * Extract text using Tesseract OCR
 */
async function extractOCRText(file: File, pageNumber: number, targetScale: number): Promise<TextRegion[]> {
	const pdfjsLib = await loadPdfjs();

	const arrayBuffer = await file.arrayBuffer();
	const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
	const page = await pdf.getPage(pageNumber);

	const ocrRenderScale = 2;
	const viewport = page.getViewport({ scale: ocrRenderScale });

	const canvas = document.createElement("canvas");
	canvas.width = viewport.width;
	canvas.height = viewport.height;
	const ctx = canvas.getContext("2d")!;

	await page.render({
		canvasContext: ctx,
		viewport,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any).promise;

	const blob = await new Promise<Blob>((resolve) => {
		canvas.toBlob((b) => resolve(b!), "image/png");
	});

	const Tesseract = await import("tesseract.js");
	const worker = await Tesseract.createWorker("eng");
	const result = await worker.recognize(blob, {}, { blocks: true });
	await worker.terminate();

	const regions: TextRegion[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const data = result.data as any;

	const scaleFactor = targetScale / ocrRenderScale;

	if (data.words) {
		for (let i = 0; i < data.words.length; i++) {
			const word = data.words[i];
			if (!word.text.trim() || word.confidence < 60) continue;

			const bbox = word.bbox;
			const height = (bbox.y1 - bbox.y0) * scaleFactor;

			regions.push({
				id: `ocr-${pageNumber}-${i}`,
				text: word.text,
				bbox: {
					x: bbox.x0 * scaleFactor,
					y: bbox.y0 * scaleFactor,
					width: (bbox.x1 - bbox.x0) * scaleFactor,
					height,
				},
				fontSize: height * 0.85,
				fontFamily: "Arial, Helvetica, sans-serif",
				fontWeight: "normal",
				fontStyle: "normal",
				color: "#000000",
				pageNumber,
				source: "ocr",
			});
		}
	}

	cleanupCanvas(canvas);

	return regions;
}
