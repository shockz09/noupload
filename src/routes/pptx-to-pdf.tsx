import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pptx-to-pdf")({
	head: () => ({
		meta: [
			{ title: "PPTX to PDF Converter Free - Convert PowerPoint to PDF | noupload" },
			{ name: "description", content: "Convert PowerPoint presentations to PDF for free. Supports PPTX, PPT, ODP, PPTM. LibreOffice-quality rendering runs 100% in your browser." },
			{ name: "keywords", content: "pptx to pdf, powerpoint to pdf, convert pptx, ppt to pdf, presentation to pdf, odp to pdf, free pptx converter, offline pptx to pdf" },
			{ property: "og:title", content: "PPTX to PDF Converter Free - Convert PowerPoint to PDF" },
			{ property: "og:description", content: "Convert PowerPoint presentations to PDF for free. LibreOffice-quality rendering, works 100% offline in your browser." },
		],
	}),
	component: PptxToPdfPage,
});

import { PptxIcon } from "@/components/icons/pdf";
import { LibreOfficeConverterPage } from "@/components/pdf/libreoffice-converter-page";

function PptxToPdfPage() {
  return (
    <LibreOfficeConverterPage
      icon={<PptxIcon className="w-7 h-7" />}
      iconClass="tool-pptx-to-pdf"
      title="PPTX to PDF"
      description="Convert PowerPoint presentations to PDF with LibreOffice-quality rendering"
      accept=".pptx,.ppt,.odp,.pptm"
      dropzoneTitle="Drop your presentation here"
      dropzoneSubtitle="Supports PPTX, PPT, ODP, PPTM"
      fileIcon={<PptxIcon className="w-5 h-5" />}
      buttonLabel="Convert to PDF"
      sourceToolLabel="PPTX to PDF"
      infoBoxContent="Powered by LibreOffice WASM — the same rendering engine used by desktop LibreOffice. Handles charts, SmartArt, custom fonts, and complex layouts faithfully. First use downloads ~53MB engine (cached after). Everything runs in your browser — your files never leave your device."
    />
  );
}
