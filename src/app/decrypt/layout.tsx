import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Decrypt PDF - Remove Password Protection",
	description:
		"Unlock password-protected PDF files. Remove encryption from your documents. Works 100% in your browser.",
	keywords: [
		"decrypt pdf",
		"unlock pdf",
		"remove pdf password",
		"pdf unlocker",
		"pdf password remover",
	],
	openGraph: {
		title: "Decrypt PDF - Remove Password",
		description: "Unlock password-protected PDFs. Works 100% offline.",
	},
};

export default function DecryptLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
