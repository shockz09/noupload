import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = "https://noupload.xyz";

	// PDF Tools (25)
	const pdfTools = [
		"",
		"/compress",
		"/merge",
		"/split",
		"/rotate",
		"/sign",
		"/organize",
		"/page-numbers",
		"/watermark",
		"/pdf-to-images",
		"/images-to-pdf",
		"/ocr",
		"/sanitize",
		"/encrypt",
		"/decrypt",
		"/reverse",
		"/pdf-to-text",
		"/duplicate",
		"/delete",
		"/edit",
		"/metadata",
		"/grayscale",
		"/pdf-to-pdfa",
		"/extract-images",
		"/html-to-pdf",
		"/markdown-to-pdf",
	];

	// Image Tools (21)
	const imageTools = [
		"/image",
		"/image/compress",
		"/image/resize",
		"/image/crop",
		"/image/rotate",
		"/image/convert",
		"/image/filters",
		"/image/watermark",
		"/image/border",
		"/image/adjust",
		"/image/strip-metadata",
		"/image/to-base64",
		"/image/favicon",
		"/image/heic-to-jpeg",
		"/image/bulk-resize",
		"/image/bulk-compress",
		"/image/bulk-convert",
		"/image/blur",
		"/image/collage",
		"/image/palette",
		"/image/remove-bg",
		"/image/screenshot",
	];

	// Audio Tools (14)
	const audioTools = [
		"/audio",
		"/audio/trim",
		"/audio/merge",
		"/audio/convert",
		"/audio/speed",
		"/audio/volume",
		"/audio/reverse",
		"/audio/fade",
		"/audio/extract",
		"/audio/denoise",
		"/audio/normalize",
		"/audio/remove-silence",
		"/audio/waveform",
		"/audio/metadata",
		"/audio/record",
	];

	// QR Tools (4)
	const qrTools = [
		"/qr",
		"/qr/generate",
		"/qr/scan",
		"/qr/bulk",
		"/qr/barcode",
	];

	// Other pages
	const otherPages = ["/privacy"];

	const allPages = [
		...pdfTools,
		...imageTools,
		...audioTools,
		...qrTools,
		...otherPages,
	];

	return allPages.map((route) => ({
		url: `${baseUrl}${route}`,
		lastModified: new Date(),
		changeFrequency: "weekly" as const,
		priority: route === "" ? 1 : route.split("/").length === 2 ? 0.9 : 0.8,
	}));
}
