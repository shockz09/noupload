import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/xlsx-to-pdf")({
	head: () => ({
		meta: [
			{ title: "Excel to PDF Free - Convert XLSX to PDF Online | noupload" },
			{ name: "description", content: "Convert Excel spreadsheets to PDF for free. Supports XLSX, XLS, ODS, CSV. LibreOffice-quality rendering runs 100% in your browser." },
			{ name: "keywords", content: "excel to pdf, xlsx to pdf, convert excel, xls to pdf, spreadsheet to pdf, ods to pdf, free excel converter, offline xlsx to pdf" },
			{ property: "og:title", content: "Excel to PDF Free - Convert XLSX to PDF Online" },
			{ property: "og:description", content: "Convert Excel spreadsheets to PDF for free. LibreOffice-quality rendering, works 100% offline in your browser." },
		],
	}),
	component: XlsxToPdfPage,
});

import { ExcelIcon } from "@/components/icons/pdf";
import { LibreOfficeConverterPage } from "@/components/pdf/libreoffice-converter-page";

function XlsxToPdfPage() {
  return (
    <LibreOfficeConverterPage
      icon={<ExcelIcon className="w-7 h-7" />}
      iconClass="tool-xlsx-to-pdf"
      title="Excel to PDF"
      description="Convert Excel spreadsheets to PDF with LibreOffice-quality rendering"
      accept=".xlsx,.xls,.ods,.csv"
      dropzoneTitle="Drop your spreadsheet here"
      dropzoneSubtitle="Supports XLSX, XLS, ODS, CSV"
      fileIcon={<ExcelIcon className="w-5 h-5" />}
      buttonLabel="Convert to PDF"
      sourceToolLabel="Excel to PDF"
      infoBoxContent="Powered by LibreOffice WASM — the same rendering engine used by desktop LibreOffice. Preserves cell formatting, formulas, charts, and print layouts. First use downloads ~53MB engine (cached after). Everything runs in your browser — your files never leave your device."
    />
  );
}
