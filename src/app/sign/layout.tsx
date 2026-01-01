import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Sign PDF Online Free - Add Signature to PDF",
	description:
		"Add your signature to PDF documents for free. Draw or upload your signature, place it anywhere on the page. Works 100% offline, no file uploads needed.",
	keywords: [
		"sign pdf",
		"add signature to pdf",
		"pdf signature",
		"esign pdf",
		"free pdf signer",
		"online pdf signature",
	],
	openGraph: {
		title: "Sign PDF Online Free - Add Signature to PDF",
		description:
			"Add your signature to PDF documents for free. Draw or upload your signature, works 100% offline.",
	},
};

export default function SignLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
