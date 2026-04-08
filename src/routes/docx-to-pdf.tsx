import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docx-to-pdf")({
	head: () => ({
		meta: [
			{ title: "Word to PDF Free - Convert DOCX to PDF Online | noupload" },
			{ name: "description", content: "Convert Word documents to PDF for free. Supports DOCX, DOC, ODT, RTF. LibreOffice-quality rendering runs 100% in your browser." },
			{ name: "keywords", content: "word to pdf, docx to pdf, convert word, doc to pdf, document to pdf, odt to pdf, free word converter, offline docx to pdf" },
			{ property: "og:title", content: "Word to PDF Free - Convert DOCX to PDF Online" },
			{ property: "og:description", content: "Convert Word documents to PDF for free. LibreOffice-quality rendering, works 100% offline in your browser." },
		],
	}),
	component: DocxToPdfPage,
});

import { WordIcon } from "@/components/icons/pdf";
import { LibreOfficeConverterPage } from "@/components/pdf/libreoffice-converter-page";

function DocxToPdfPage() {
  return (
    <LibreOfficeConverterPage
      icon={<WordIcon className="w-7 h-7" />}
      iconClass="tool-docx-to-pdf"
      title="Word to PDF"
      description="Convert Word documents to PDF with LibreOffice-quality rendering"
      accept=".docx,.doc,.odt,.rtf"
      dropzoneTitle="Drop your document here"
      dropzoneSubtitle="Supports DOCX, DOC, ODT, RTF"
      fileIcon={<WordIcon className="w-5 h-5" />}
      buttonLabel="Convert to PDF"
      sourceToolLabel="Word to PDF"
      infoBoxContent="Powered by LibreOffice WASM — the same rendering engine used by desktop LibreOffice. Handles complex formatting, tables, images, headers, and footers faithfully. First use downloads ~53MB engine (cached after). Everything runs in your browser — your files never leave your device."
    />
  );
}
