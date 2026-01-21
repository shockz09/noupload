import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Convert PDF to PDF/A Free - Archive-Ready PDF Converter",
	description:
		"Convert PDF to PDF/A format for free. Create archive-ready, long-term preservation PDFs. ISO compliant. Works offline, completely private.",
	keywords: [
		"pdf to pdfa",
		"pdfa converter",
		"pdf archive format",
		"convert to pdfa",
		"pdf long term storage",
		"iso pdf format",
		"free pdfa converter",
	],
	openGraph: {
		title: "Convert PDF to PDF/A Free - Archive-Ready PDF Converter",
		description:
			"Convert PDF to PDF/A archive format for free. ISO compliant. Works 100% offline.",
	},
};

export default function PdfToPdfaLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
