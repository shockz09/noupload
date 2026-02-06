import { getPdfjsWorkerSrc } from "@/lib/pdfjs-config";

// ============ Types ============

interface TextItem {
	str: string;
	x: number;
	y: number;
	width: number;
	fontSize: number;
	fontName: string;
	isBold: boolean;
	isItalic: boolean;
	pageNumber: number;
}

interface TextLine {
	items: TextItem[];
	y: number;
	fontSize: number;
	isBold: boolean;
	isItalic: boolean;
	text: string;
	pageNumber: number;
}

type HeadingLevel = "h1" | "h2" | "h3" | "body";

interface ClassifiedLine extends TextLine {
	level: HeadingLevel;
}

interface BookmarkNode {
	title: string;
	pageNumber: number;
	children: BookmarkNode[];
}

interface Chapter {
	title: string;
	html: string;
}

interface PageDimensions {
	width: number;
	height: number;
}

interface ConversionResult {
	blob: Blob;
	filename: string;
	chapterCount: number;
	pageCount: number;
}

// ============ Font Parsing ============

function parseFontFlags(fontName: string): { isBold: boolean; isItalic: boolean } {
	const name = fontName.toLowerCase();
	const isBold =
		name.includes("bold") ||
		name.includes("-bd") ||
		name.includes("_bd") ||
		name.includes(",bold") ||
		name.includes("black") ||
		name.includes("heavy");
	const isItalic =
		name.includes("italic") ||
		name.includes("oblique") ||
		name.includes("-it") ||
		name.includes("_it") ||
		name.includes(",italic") ||
		name.includes("ital");
	return { isBold, isItalic };
}

// ============ PDF Bookmark/Outline Extraction ============

async function extractBookmarks(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	pdf: any,
): Promise<BookmarkNode[]> {
	try {
		const outline = await pdf.getOutline();
		if (!outline || outline.length === 0) return [];

		return await resolveOutline(pdf, outline);
	} catch {
		return [];
	}
}

async function resolveOutline(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	pdf: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	items: any[],
): Promise<BookmarkNode[]> {
	const nodes: BookmarkNode[] = [];

	for (const item of items) {
		let pageNumber = 1;

		try {
			if (item.dest) {
				// dest can be a string (named destination) or an array
				const dest = typeof item.dest === "string"
					? await pdf.getDestination(item.dest)
					: item.dest;

				if (dest && dest[0]) {
					const pageRef = dest[0];
					const pageIndex = await pdf.getPageIndex(pageRef);
					pageNumber = pageIndex + 1; // 0-indexed to 1-indexed
				}
			}
		} catch {
			// If we can't resolve the destination, default to page 1
		}

		const children = item.items && item.items.length > 0
			? await resolveOutline(pdf, item.items)
			: [];

		nodes.push({
			title: item.title || "Untitled",
			pageNumber,
			children,
		});
	}

	return nodes;
}

// ============ Text Extraction ============

async function extractTextItems(
	file: File,
	onProgress?: (current: number, total: number) => void,
): Promise<{
	items: TextItem[];
	pageCount: number;
	pageDimensions: Map<number, PageDimensions>;
	bookmarks: BookmarkNode[];
	metadata: { title?: string; author?: string };
}> {
	const pdfjsLib = await import("pdfjs-dist");
	pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfjsWorkerSrc(pdfjsLib.version);

	const arrayBuffer = await file.arrayBuffer();
	const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
	const totalPages = pdf.numPages;

	// Extract metadata
	const meta = await pdf.getMetadata().catch(() => null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const info = (meta?.info as any) || {};
	const metadata = {
		title: info.Title || undefined,
		author: info.Author || undefined,
	};

	// Extract bookmarks
	const bookmarks = await extractBookmarks(pdf);

	const allItems: TextItem[] = [];
	const pageDimensions = new Map<number, PageDimensions>();

	for (let i = 1; i <= totalPages; i++) {
		onProgress?.(i, totalPages);
		const page = await pdf.getPage(i);
		const viewport = page.getViewport({ scale: 1 });

		pageDimensions.set(i, { width: viewport.width, height: viewport.height });

		const textContent = await page.getTextContent();

		for (const item of textContent.items) {
			if (!("str" in item) || !item.str.trim()) continue;

			const textItem = item as {
				str: string;
				transform: number[];
				width: number;
				height: number;
				fontName: string;
			};

			const fontSize = Math.abs(textItem.transform[3]);
			const x = textItem.transform[4];
			const y = textItem.transform[5];
			const { isBold, isItalic } = parseFontFlags(textItem.fontName);

			allItems.push({
				str: textItem.str,
				x,
				y,
				width: textItem.width,
				fontSize: Math.round(fontSize * 10) / 10,
				fontName: textItem.fontName,
				isBold,
				isItalic,
				pageNumber: i,
			});
		}

		page.cleanup();
	}

	return { items: allItems, pageCount: totalPages, pageDimensions, bookmarks, metadata };
}

// ============ Multi-Column Detection ============

function detectColumns(items: TextItem[], pageWidth: number): TextItem[][] {
	if (items.length === 0) return [items];

	// Collect all x positions
	const xPositions = items.map((it) => it.x);
	const midPage = pageWidth / 2;

	// Count items clearly on left vs right
	const leftItems = items.filter((it) => it.x + it.width < midPage - 20);
	const rightItems = items.filter((it) => it.x > midPage + 20);

	// If both sides have significant content, it's likely two columns
	const minColumnItems = items.length * 0.2;
	if (leftItems.length > minColumnItems && rightItems.length > minColumnItems) {
		// Find the column gap: cluster x positions
		const gap = findColumnGap(xPositions, pageWidth);
		if (gap > 0) {
			const left = items.filter((it) => it.x + it.width / 2 < gap);
			const right = items.filter((it) => it.x + it.width / 2 >= gap);
			return [left, right];
		}
	}

	return [items];
}

function findColumnGap(xPositions: number[], pageWidth: number): number {
	// Build histogram of x positions in buckets
	const bucketSize = 10;
	const buckets = new Map<number, number>();

	for (const x of xPositions) {
		const bucket = Math.floor(x / bucketSize) * bucketSize;
		buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
	}

	// Look for a gap in the middle third of the page
	const thirdStart = pageWidth / 3;
	const thirdEnd = (pageWidth * 2) / 3;

	let bestGap = 0;
	let minCount = Infinity;

	for (let x = thirdStart; x < thirdEnd; x += bucketSize) {
		const bucket = Math.floor(x / bucketSize) * bucketSize;
		const count = buckets.get(bucket) || 0;
		if (count < minCount) {
			minCount = count;
			bestGap = x + bucketSize / 2;
		}
	}

	// Only return gap if it's truly empty or near-empty
	return minCount <= 2 ? bestGap : 0;
}

// ============ Line Merging ============

function mergeIntoLines(items: TextItem[]): TextLine[] {
	if (items.length === 0) return [];

	// Group items by page, then merge items on same line (similar Y)
	const lineThreshold = 2;
	const lines: TextLine[] = [];

	let currentLine: TextItem[] = [items[0]];
	let currentY = items[0].y;
	let currentPage = items[0].pageNumber;

	for (let i = 1; i < items.length; i++) {
		const item = items[i];
		const samePage = item.pageNumber === currentPage;
		const sameY = Math.abs(item.y - currentY) < lineThreshold;

		if (samePage && sameY) {
			currentLine.push(item);
		} else {
			lines.push(buildLine(currentLine));
			currentLine = [item];
			currentY = item.y;
			currentPage = item.pageNumber;
		}
	}
	lines.push(buildLine(currentLine));

	return lines;
}

function buildLine(items: TextItem[]): TextLine {
	items.sort((a, b) => a.x - b.x);

	let text = "";
	for (let i = 0; i < items.length; i++) {
		if (i > 0) {
			const gap = items[i].x - (items[i - 1].x + items[i - 1].width);
			text += gap > Math.max(items[i].fontSize * 0.3, 1) ? " " : "";
		}
		text += items[i].str;
	}

	const fontSize = mode(items.map((it) => it.fontSize));
	const isBold = items.filter((it) => it.isBold).length > items.length / 2;
	const isItalic = items.filter((it) => it.isItalic).length > items.length / 2;

	return {
		items,
		y: items[0].y,
		fontSize,
		isBold,
		isItalic,
		text: text.trim(),
		pageNumber: items[0].pageNumber,
	};
}

// ============ Structure Detection ============

function detectBodyFontSize(lines: TextLine[]): number {
	const sizes = lines.map((l) => l.fontSize);
	return mode(sizes);
}

function classifyLines(lines: TextLine[], bodySize: number): ClassifiedLine[] {
	return lines.map((line) => {
		const ratio = bodySize > 0 ? line.fontSize / bodySize : 1;
		let level: HeadingLevel = "body";

		if (ratio >= 1.8) {
			level = "h1";
		} else if (ratio >= 1.4) {
			level = "h2";
		} else if (ratio >= 1.15 && line.isBold) {
			level = "h3";
		}

		return { ...line, level };
	});
}

// ============ Page Number Stripping ============

function isPageNumberLine(line: ClassifiedLine, pageNumber: number, pageHeight: number): boolean {
	if (line.level !== "body") return false;

	const text = line.text.trim();

	// Must be short (page numbers are typically 1-5 chars, or "Page X" style)
	if (text.length > 15) return false;

	// Check if it's a bare number
	const bareNumber = /^\d{1,5}$/.test(text);

	// Check common page number patterns: "- 5 -", "Page 5", "5 of 20", "| 5 |", "v", "vi", "ix" etc
	const pagePattern = /^[-–—|]*\s*\d{1,5}\s*[-–—|]*$/.test(text)
		|| /^page\s+\d{1,5}$/i.test(text)
		|| /^\d{1,5}\s+of\s+\d{1,5}$/i.test(text)
		|| /^[ivxlcdm]{1,6}$/i.test(text); // Roman numerals

	if (!bareNumber && !pagePattern) return false;

	// Check position: top 8% or bottom 8% of page
	const topZone = pageHeight * 0.92; // pdfjs Y is from bottom
	const bottomZone = pageHeight * 0.08;
	const isAtEdge = line.y > topZone || line.y < bottomZone;

	if (!isAtEdge) return false;

	// If it's a bare number, check if it matches or is close to the page number
	if (bareNumber) {
		const num = parseInt(text, 10);
		// Allow some offset since page numbering might not start at 1
		return Math.abs(num - pageNumber) < 20;
	}

	return true;
}

function stripPageNumbers(lines: ClassifiedLine[], pageDimensions: Map<number, PageDimensions>): ClassifiedLine[] {
	return lines.filter((line) => {
		const dims = pageDimensions.get(line.pageNumber);
		if (!dims) return true;
		return !isPageNumberLine(line, line.pageNumber, dims.height);
	});
}

// ============ Header/Footer Filtering ============

function filterHeadersFooters(lines: ClassifiedLine[]): ClassifiedLine[] {
	if (lines.length === 0) return lines;

	const pageCount = new Set(lines.map((l) => l.pageNumber)).size;
	if (pageCount < 3) return lines;

	// Group by approximate Y position and normalized text
	const posTextCounts = new Map<string, number>();
	for (const line of lines) {
		if (line.level !== "body") continue;
		// Normalize: strip numbers to catch "Page 1", "Page 2" etc as same pattern
		const normalized = line.text.trim().replace(/\d+/g, "#");
		const key = `${Math.round(line.y / 10) * 10}|${normalized}`;
		posTextCounts.set(key, (posTextCounts.get(key) || 0) + 1);
	}

	const threshold = pageCount * 0.5;
	const repeatedKeys = new Set<string>();
	for (const [key, count] of posTextCounts) {
		if (count >= threshold) {
			repeatedKeys.add(key);
		}
	}

	if (repeatedKeys.size === 0) return lines;

	return lines.filter((line) => {
		const normalized = line.text.trim().replace(/\d+/g, "#");
		const key = `${Math.round(line.y / 10) * 10}|${normalized}`;
		return !repeatedKeys.has(key);
	});
}

// ============ Paragraph Merging (cross-page aware) ============

function mergeParagraphs(lines: ClassifiedLine[]): ClassifiedLine[] {
	if (lines.length === 0) return lines;

	const merged: ClassifiedLine[] = [];
	let para: ClassifiedLine | undefined;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Headings always stand alone
		if (line.level !== "body") {
			if (para) {
				merged.push(para);
				para = undefined;
			}
			merged.push(line);
			continue;
		}

		if (!para) {
			para = Object.assign({}, line);
			continue;
		}

		const samePage = line.pageNumber === para.pageNumber;

		if (samePage) {
			// Same page: merge if Y-gap is small enough
			const yGap = Math.abs(para.y - line.y);
			const lineHeight = para.fontSize * 1.5;
			const isContiguous = yGap < lineHeight * 1.8;
			const sameStyle = line.isBold === para.isBold && line.isItalic === para.isItalic;

			if (isContiguous && sameStyle) {
				para.text = joinText(para.text, line.text);
				para.y = line.y;
			} else {
				merged.push(para);
				para = Object.assign({}, line);
			}
		} else {
			// Cross-page: merge if previous paragraph ends mid-sentence
			const sameStyle = line.isBold === para.isBold && line.isItalic === para.isItalic;
			const prevEndsMidSentence = isMidSentence(para.text);

			if (sameStyle && prevEndsMidSentence) {
				para.text = joinText(para.text, line.text);
				para.y = line.y;
				para.pageNumber = line.pageNumber;
			} else {
				merged.push(para);
				para = Object.assign({}, line);
			}
		}
	}

	if (para) {
		merged.push(para);
	}

	return merged;
}

function isMidSentence(text: string): boolean {
	const trimmed = text.trimEnd();
	if (trimmed.length === 0) return false;

	const lastChar = trimmed[trimmed.length - 1];

	// Ends with sentence-ending punctuation = NOT mid-sentence
	const sentenceEnders = '.!?:;\'"' + '\u201C\u201D\u2018\u2019\u00BB)]';
	if (sentenceEnders.includes(lastChar)) return false;

	// Ends with a hyphen = word was split across lines
	if (lastChar === "-" || lastChar === "\u2010" || lastChar === "\u2011") return true;

	// Ends with a comma, letter, or number = likely mid-sentence
	return true;
}

/**
 * Join two text fragments, stitching hyphenated words.
 * "compre-" + "hensive" → "comprehensive"
 * "normal end" + "next line" → "normal end next line"
 */
function joinText(prev: string, next: string): string {
	const trimmed = prev.trimEnd();
	if (trimmed.length === 0) return next;

	const lastChar = trimmed[trimmed.length - 1];
	const isHyphen = lastChar === "-" || lastChar === "\u2010" || lastChar === "\u2011";

	if (isHyphen) {
		// Remove the hyphen and join directly (no space)
		return trimmed.slice(0, -1) + next;
	}

	return `${prev} ${next}`;
}

// ============ Chapter Building ============

function buildChaptersFromBookmarks(
	lines: ClassifiedLine[],
	bookmarks: BookmarkNode[],
): Chapter[] {
	if (bookmarks.length === 0) return [];

	// Flatten bookmark hierarchy (top-level = chapters, children = sections within)
	const chapterMarkers = flattenBookmarksToChapters(bookmarks);
	if (chapterMarkers.length === 0) return [];

	// Sort markers by page number
	chapterMarkers.sort((a, b) => a.pageNumber - b.pageNumber);

	const chapters: Chapter[] = [];

	for (let i = 0; i < chapterMarkers.length; i++) {
		const marker = chapterMarkers[i];
		const nextMarker = chapterMarkers[i + 1];

		// Get all lines from this marker's page to the next marker's page
		const chapterLines = lines.filter((line) => {
			if (nextMarker) {
				return line.pageNumber >= marker.pageNumber && line.pageNumber < nextMarker.pageNumber;
			}
			return line.pageNumber >= marker.pageNumber;
		});

		if (chapterLines.length === 0) continue;

		let html = `<h1>${escapeHtml(marker.title)}</h1>\n`;
		for (const line of chapterLines) {
			// Skip the line if it matches the bookmark title (already rendered as h1)
			if (line.text.trim() === marker.title.trim() && line.level !== "body") {
				continue;
			}
			html += lineToHtml(line);
		}

		chapters.push({ title: marker.title, html });
	}

	return chapters;
}

function flattenBookmarksToChapters(bookmarks: BookmarkNode[]): { title: string; pageNumber: number }[] {
	const markers: { title: string; pageNumber: number }[] = [];

	for (const bm of bookmarks) {
		markers.push({ title: bm.title, pageNumber: bm.pageNumber });
		// Include children as sub-chapters only if there are few top-level items
		// (otherwise we'd get too many chapters)
		if (bookmarks.length < 5 && bm.children.length > 0) {
			for (const child of bm.children) {
				markers.push({ title: child.title, pageNumber: child.pageNumber });
			}
		}
	}

	return markers;
}

function buildChapters(
	lines: ClassifiedLine[],
	bookmarks: BookmarkNode[],
): Chapter[] {
	if (lines.length === 0) {
		return [{ title: "Empty Document", html: "<p>No text content found.</p>" }];
	}

	// Strategy 1: Use PDF bookmarks if available (most reliable)
	if (bookmarks.length > 0) {
		const chapters = buildChaptersFromBookmarks(lines, bookmarks);
		if (chapters.length > 0) return chapters;
	}

	// Strategy 2: Use h1-level headings
	const hasH1 = lines.some((l) => l.level === "h1");
	if (hasH1) {
		return buildChaptersByHeadings(lines);
	}

	// Strategy 3: Use h2 headings as chapter splits if there are several
	const h2Lines = lines.filter((l) => l.level === "h2");
	if (h2Lines.length >= 2) {
		return buildChaptersByLevel(lines, "h2");
	}

	// Strategy 4: Smart grouping — batch pages into logical chunks
	return buildChaptersByGroupedPages(lines);
}

function buildChaptersByHeadings(lines: ClassifiedLine[]): Chapter[] {
	return buildChaptersByLevel(lines, "h1");
}

function buildChaptersByLevel(lines: ClassifiedLine[], splitLevel: HeadingLevel): Chapter[] {
	const chapters: Chapter[] = [];
	let currentTitle = "Introduction";
	let currentHtml = "";

	for (const line of lines) {
		if (line.level === splitLevel) {
			if (currentHtml.trim()) {
				chapters.push({ title: currentTitle, html: currentHtml });
			}
			currentTitle = line.text;
			currentHtml = `<h1>${escapeHtml(line.text)}</h1>\n`;
		} else {
			currentHtml += lineToHtml(line);
		}
	}

	if (currentHtml.trim()) {
		chapters.push({ title: currentTitle, html: currentHtml });
	}

	return chapters.length > 0
		? chapters
		: [{ title: "Document", html: "<p>No content.</p>" }];
}

function buildChaptersByGroupedPages(lines: ClassifiedLine[]): Chapter[] {
	// Group pages into chunks of ~10 pages each for a reasonable chapter size
	const pageGroups = new Map<number, ClassifiedLine[]>();
	for (const line of lines) {
		const group = pageGroups.get(line.pageNumber) || [];
		group.push(line);
		pageGroups.set(line.pageNumber, group);
	}

	const pageNumbers = [...pageGroups.keys()].sort((a, b) => a - b);
	const totalPages = pageNumbers.length;

	if (totalPages <= 15) {
		// Small doc — single chapter
		let html = "";
		for (const line of lines) {
			html += lineToHtml(line);
		}
		return [{ title: "Document", html }];
	}

	// Group into chunks of ~10 pages
	const chunkSize = 10;
	const chapters: Chapter[] = [];

	for (let i = 0; i < pageNumbers.length; i += chunkSize) {
		const chunkPages = pageNumbers.slice(i, i + chunkSize);
		const startPage = chunkPages[0];
		const endPage = chunkPages[chunkPages.length - 1];

		let html = "";
		for (const pageNum of chunkPages) {
			const pageLines = pageGroups.get(pageNum) || [];
			for (const line of pageLines) {
				html += lineToHtml(line);
			}
		}

		if (html.trim()) {
			const title = startPage === endPage
				? `Page ${startPage}`
				: `Pages ${startPage}–${endPage}`;
			chapters.push({ title, html });
		}
	}

	return chapters.length > 0
		? chapters
		: [{ title: "Document", html: "<p>No content.</p>" }];
}

function lineToHtml(line: ClassifiedLine): string {
	let content = escapeHtml(line.text);

	if (line.isBold && line.level === "body") {
		content = `<strong>${content}</strong>`;
	}
	if (line.isItalic) {
		content = `<em>${content}</em>`;
	}

	switch (line.level) {
		case "h1":
			return `<h1>${content}</h1>\n`;
		case "h2":
			return `<h2>${content}</h2>\n`;
		case "h3":
			return `<h3>${content}</h3>\n`;
		default:
			return `<p>${content}</p>\n`;
	}
}

// ============ Utilities ============

function mode(arr: number[]): number {
	if (arr.length === 0) return 12;

	const freq = new Map<number, number>();
	let maxCount = 0;
	let maxVal = arr[0];

	for (const val of arr) {
		const rounded = Math.round(val);
		const count = (freq.get(rounded) || 0) + 1;
		freq.set(rounded, count);
		if (count > maxCount) {
			maxCount = count;
			maxVal = rounded;
		}
	}

	return maxVal;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

// ============ Cover Image ============

async function renderCoverImage(file: File): Promise<string | undefined> {
	try {
		const pdfjsLib = await import("pdfjs-dist");
		pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfjsWorkerSrc(pdfjsLib.version);

		const arrayBuffer = await file.arrayBuffer();
		const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
		const page = await pdf.getPage(1);

		// Render at 2x for crisp cover
		const viewport = page.getViewport({ scale: 2 });
		const canvas = document.createElement("canvas");
		canvas.width = viewport.width;
		canvas.height = viewport.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return undefined;

		await page.render({ canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]).promise;
		page.cleanup();

		// Convert to JPEG data URL
		const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

		// Cleanup
		canvas.width = 0;
		canvas.height = 0;

		return dataUrl;
	} catch {
		return undefined;
	}
}

// ============ Main Export ============

export async function convertPdfToEpub(
	file: File,
	onProgress?: (progress: number) => void,
): Promise<ConversionResult> {
	// Step 1: Extract text items + bookmarks (0-60%)
	onProgress?.(5);
	const { items, pageCount, pageDimensions, bookmarks, metadata } = await extractTextItems(
		file,
		(current, total) => {
			onProgress?.(5 + (current / total) * 55);
		},
	);

	if (items.length === 0) {
		throw new Error("No text found in PDF. The document may be scanned — try the OCR tool first.");
	}

	// Step 2: Handle multi-column layouts (60-62%)
	onProgress?.(61);
	const reorderedItems: TextItem[] = [];
	const itemsByPage = new Map<number, TextItem[]>();
	for (const item of items) {
		const arr = itemsByPage.get(item.pageNumber) || [];
		arr.push(item);
		itemsByPage.set(item.pageNumber, arr);
	}

	for (const [pageNum, pageItems] of itemsByPage) {
		const dims = pageDimensions.get(pageNum);
		const pageWidth = dims?.width || 612;
		const columns = detectColumns(pageItems, pageWidth);
		for (const col of columns) {
			// Sort each column top-to-bottom
			col.sort((a, b) => b.y - a.y);
			reorderedItems.push(...col);
		}
	}

	// Step 3: Merge into lines (62-65%)
	onProgress?.(63);
	const lines = mergeIntoLines(reorderedItems);

	// Step 4: Detect structure (65-72%)
	onProgress?.(67);
	const bodySize = detectBodyFontSize(lines);
	const classified = classifyLines(lines, bodySize);

	// Step 5: Strip page numbers (72-74%)
	onProgress?.(73);
	const noPageNums = stripPageNumbers(classified, pageDimensions);

	// Step 6: Filter headers/footers (74-76%)
	onProgress?.(75);
	const filtered = filterHeadersFooters(noPageNums);

	// Step 7: Merge paragraphs with cross-page joining (76-78%)
	onProgress?.(77);
	const paragraphed = mergeParagraphs(filtered);

	// Step 8: Build chapters (78-82%)
	onProgress?.(80);
	const chapters = buildChapters(paragraphed, bookmarks);

	// Step 9: Render cover image (82-86%)
	onProgress?.(83);
	const coverDataUrl = await renderCoverImage(file);

	// Step 10: Generate EPUB (86-98%)
	onProgress?.(87);

	const { default: epub } = await import("epub-gen-memory/bundle");

	const baseName = file.name.replace(/\.pdf$/i, "");
	const title = metadata.title || baseName;
	const author = metadata.author || "Unknown Author";

	const blob = await epub(
		{
			title,
			author,
			cover: coverDataUrl,
			lang: "en",
			tocTitle: "Table of Contents",
			css: `
				body { font-family: Georgia, "Times New Roman", serif; line-height: 1.6; margin: 1em; color: #1a1a1a; }
				h1 { font-size: 1.8em; margin-top: 1.5em; margin-bottom: 0.5em; page-break-before: always; }
				h1:first-child { page-break-before: avoid; }
				h2 { font-size: 1.4em; margin-top: 1.2em; margin-bottom: 0.4em; }
				h3 { font-size: 1.15em; margin-top: 1em; margin-bottom: 0.3em; }
				p { margin: 0.5em 0; text-align: justify; }
				strong { font-weight: bold; }
				em { font-style: italic; }
			`,
		},
		chapters.map((ch) => ({
			title: ch.title,
			content: ch.html,
		})),
	);

	onProgress?.(100);

	return {
		blob,
		filename: `${baseName}.epub`,
		chapterCount: chapters.length,
		pageCount,
	};
}
