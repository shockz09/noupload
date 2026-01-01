import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Add Watermark to PDF Free - Text Watermark Online",
	description:
		"Add text watermark to PDF for free. Customize opacity, rotation, position, and font size. Drag to place anywhere. Works 100% in your browser.",
	keywords: [
		"add watermark pdf",
		"pdf watermark",
		"watermark pdf online",
		"text watermark",
		"pdf stamp",
	],
	openGraph: {
		title: "Add Watermark to PDF Free",
		description:
			"Add customizable text watermarks to your PDF. Adjust opacity and rotation. Works 100% offline.",
	},
};

export default function WatermarkLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
