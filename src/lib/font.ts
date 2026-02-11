/**
 * Font parsing utilities for PDF text extraction
 * Handles font name parsing and web-safe font mapping
 */

export interface ParsedFont {
	fontFamily: string;
	fontWeight: string;
	fontStyle: string;
	isBold: boolean;
	isItalic: boolean;
}

/**
 * Parse a PDF font name to extract style and weight information
 * Returns comprehensive font info for use in both web rendering and EPUB
 */
export function parseFontName(pdfFontName: string): ParsedFont {
	const name = pdfFontName.toLowerCase();

	// Detect weight
	let fontWeight = "normal";
	let isBold = false;

	if (
		name.includes("bold") ||
		name.includes("-bd") ||
		name.includes("_bd") ||
		name.includes(",bold") ||
		name.includes("black") ||
		name.includes("heavy") ||
		/\bbd\b/.test(name) ||
		name.endsWith("bd")
	) {
		fontWeight = "bold";
		isBold = true;
	} else if (name.includes("black") || name.includes("heavy") || name.includes("ultra")) {
		fontWeight = "900";
		isBold = true;
	} else if (name.includes("extrabold") || name.includes("extra bold") || name.includes("extra-bold")) {
		fontWeight = "800";
		isBold = true;
	} else if (
		name.includes("semibold") ||
		name.includes("semi bold") ||
		name.includes("semi-bold") ||
		name.includes("demibold") ||
		name.includes("demi")
	) {
		fontWeight = "600";
		isBold = true;
	} else if (name.includes("medium") || name.includes("-md") || name.includes("_md") || /\bmd\b/.test(name)) {
		fontWeight = "500";
	} else if (name.includes("light") || name.includes("-lt") || name.includes("_lt") || /\blt\b/.test(name)) {
		fontWeight = "300";
	} else if (name.includes("extralight") || name.includes("extra light") || name.includes("ultra light")) {
		fontWeight = "200";
	} else if (name.includes("thin") || name.includes("hairline")) {
		fontWeight = "100";
	}

	// Detect style
	let fontStyle = "normal";
	let isItalic = false;

	if (
		name.includes("italic") ||
		name.includes("oblique") ||
		name.includes("-it") ||
		name.includes("_it") ||
		name.includes(",italic") ||
		/\bit\b/.test(name) ||
		name.endsWith("it") ||
		name.includes("ital")
	) {
		fontStyle = "italic";
		isItalic = true;
	}

	return { fontFamily: mapToWebFont(pdfFontName), fontWeight, fontStyle, isBold, isItalic };
}

/**
 * Map PDF font family to closest web-safe font
 */
export function mapToWebFont(pdfFontFamily: string): string {
	const name = pdfFontFamily.toLowerCase();

	// Check for common font families
	if (name.includes("arial")) return "Arial, Helvetica, sans-serif";
	if (name.includes("helvetica")) return "Helvetica, Arial, sans-serif";
	if (name.includes("times")) return "Times New Roman, Times, serif";
	if (name.includes("georgia")) return "Georgia, Times, serif";
	if (name.includes("courier")) return "Courier New, Courier, monospace";
	if (name.includes("verdana")) return "Verdana, Geneva, sans-serif";
	if (name.includes("tahoma")) return "Tahoma, Geneva, sans-serif";
	if (name.includes("trebuchet")) return "Trebuchet MS, sans-serif";
	if (name.includes("impact")) return "Impact, sans-serif";
	if (name.includes("comic")) return "Comic Sans MS, cursive";
	if (name.includes("calibri")) return "Calibri, Arial, sans-serif";
	if (name.includes("cambria")) return "Cambria, Georgia, serif";
	if (name.includes("consolas")) return "Consolas, Monaco, monospace";
	if (name.includes("roboto")) return "Roboto, Arial, sans-serif";
	if (name.includes("open sans") || name.includes("opensans")) return "'Open Sans', Arial, sans-serif";
	if (name.includes("lato")) return "Lato, Arial, sans-serif";
	if (name.includes("montserrat")) return "Montserrat, Arial, sans-serif";
	if (name.includes("source")) return "'Source Sans Pro', Arial, sans-serif";
	if (name.includes("palatino")) return "Palatino Linotype, Book Antiqua, serif";
	if (name.includes("garamond")) return "Garamond, Georgia, serif";
	if (name.includes("bookman")) return "Bookman Old Style, Georgia, serif";

	// Serif detection
	if (name.includes("serif") && !name.includes("sans")) return "Times New Roman, Times, serif";

	// Monospace detection
	if (name.includes("mono") || name.includes("code") || name.includes("fixed"))
		return "Courier New, Courier, monospace";

	// Default to sans-serif
	return "Arial, Helvetica, sans-serif";
}

/**
 * Legacy compatibility: Parse font flags (simple version used by pdf-to-epub)
 * @deprecated Use parseFontName instead
 */
export function parseFontFlags(fontName: string): { isBold: boolean; isItalic: boolean } {
	const parsed = parseFontName(fontName);
	return { isBold: parsed.isBold, isItalic: parsed.isItalic };
}
