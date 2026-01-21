import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "HTML to PDF Converter Free - Convert Web Pages to PDF",
	description:
		"Convert HTML files to PDF for free. Transform web pages and HTML code into PDF documents. Preserves formatting. Works offline, completely private.",
	keywords: [
		"html to pdf",
		"convert html to pdf",
		"webpage to pdf",
		"html pdf converter",
		"web page to pdf",
		"free html to pdf",
	],
	openGraph: {
		title: "HTML to PDF Converter Free - Convert Web Pages to PDF",
		description:
			"Convert HTML files to PDF for free. Preserves formatting. Works 100% offline.",
	},
};

export default function HtmlToPdfLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
