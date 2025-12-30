import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://noupload.xyz";

  // PDF Tools
  const pdfTools = [
    "",
    "/merge",
    "/split",
    "/compress",
    "/rotate",
    "/sign",
    "/organize",
    "/page-numbers",
    "/watermark",
    "/pdf-to-images",
    "/images-to-pdf",
    "/ocr",
  ];

  // Image Tools
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
  ];

  // Audio Tools
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
  ];

  // Other
  const otherPages = ["/qr"];

  const allPages = [...pdfTools, ...imageTools, ...audioTools, ...otherPages];

  return allPages.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.8,
  }));
}
