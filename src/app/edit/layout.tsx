import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Edit PDF Free - Add Text, Images & Annotations Online",
	description:
		"Edit PDF files for free. Add text, images, signatures, highlights, and annotations. Draw, redact, and stamp PDFs. Works offline, completely private.",
	keywords: [
		"edit pdf",
		"pdf editor",
		"annotate pdf",
		"add text to pdf",
		"pdf markup",
		"free pdf editor",
		"online pdf editor",
	],
	openGraph: {
		title: "Edit PDF Free - Add Text, Images & Annotations Online",
		description:
			"Edit PDF files for free. Add text, images, signatures, and annotations. Works 100% offline.",
	},
};

export default function EditLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
