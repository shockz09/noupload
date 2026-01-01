import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Compress PDF Online Free - Reduce PDF File Size",
	description:
		"Reduce PDF file size for free. Choose compression level, see size reduction instantly. Works offline, your files stay private.",
	keywords: [
		"compress pdf",
		"reduce pdf size",
		"pdf compressor",
		"shrink pdf",
		"free pdf compression",
		"optimize pdf",
	],
	openGraph: {
		title: "Compress PDF Online Free - Reduce PDF File Size",
		description:
			"Reduce PDF file size for free. Works 100% offline, your files stay private.",
	},
};

export default function CompressLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
