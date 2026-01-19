"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { HtmlIcon, PrintIcon } from "@/components/icons";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { PdfPageHeader } from "@/components/pdf/shared";
import { formatFileSize } from "@/lib/utils";

function injectPrintStyles(html: string): string {
	const printCSS = `
<style>
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; }
  }
</style>`;

	if (html.includes("</head>")) {
		return html.replace("</head>", `${printCSS}</head>`);
	}
	if (html.includes("<head>")) {
		return html.replace("<head>", `<head>${printCSS}`);
	}
	return printCSS + html;
}

function isHtmlContent(text: string): boolean {
	const trimmed = text.trim().toLowerCase();
	return (
		trimmed.startsWith("<!doctype") ||
		trimmed.startsWith("<html") ||
		trimmed.startsWith("<head") ||
		trimmed.startsWith("<body") ||
		(trimmed.includes("<") && trimmed.includes(">") && trimmed.includes("</"))
	);
}

export default function HtmlToPdfPage() {
	const [file, setFile] = useState<File | null>(null);
	const [htmlContent, setHtmlContent] = useState<string>("");
	const [pastedContent, setPastedContent] = useState(false);
	const printFrameRef = useRef<HTMLIFrameElement>(null);

	const htmlWithPrintStyles = useMemo(() => {
		if (!htmlContent.trim()) return "";
		return injectPrintStyles(htmlContent);
	}, [htmlContent]);

	// Global paste handler
	useEffect(() => {
		const handlePaste = (e: ClipboardEvent) => {
			// Don't capture if user is typing in an input/textarea
			if (
				document.activeElement?.tagName === "INPUT" ||
				document.activeElement?.tagName === "TEXTAREA"
			) {
				return;
			}

			const text = e.clipboardData?.getData("text/plain");
			if (text && isHtmlContent(text)) {
				e.preventDefault();
				setHtmlContent(text);
				setPastedContent(true);
				setFile(null);
			}
		};

		document.addEventListener("paste", handlePaste);
		return () => document.removeEventListener("paste", handlePaste);
	}, []);

	const handleFileSelected = useCallback(async (files: File[]) => {
		if (files.length === 0) return;
		const selectedFile = files[0];
		setFile(selectedFile);
		setPastedContent(false);
		const text = await selectedFile.text();
		setHtmlContent(text);
	}, []);

	const handleExport = useCallback(() => {
		const iframe = printFrameRef.current;
		if (iframe?.contentWindow) {
			iframe.contentWindow.print();
		}
	}, []);

	const handleClear = useCallback(() => {
		setFile(null);
		setHtmlContent("");
		setPastedContent(false);
	}, []);

	const hasContent = htmlContent.trim().length > 0;

	return (
		<div className="page-enter max-w-2xl mx-auto space-y-6">
			<PdfPageHeader
				icon={<HtmlIcon className="w-7 h-7" />}
				iconClass="tool-html-to-pdf"
				title="HTML to PDF"
				description="Convert HTML files to PDF documents"
			/>

			{hasContent ? (
				<div className="space-y-6">
					{/* Source info */}
					<div className="flex items-center justify-between p-4 border-2 border-foreground bg-muted/30">
						<div className="flex items-center gap-3">
							<HtmlIcon className="w-8 h-8" />
							<div>
								{file ? (
									<>
										<p className="font-bold truncate max-w-xs">{file.name}</p>
										<p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
									</>
								) : (
									<>
										<p className="font-bold">Pasted HTML</p>
										<p className="text-sm text-muted-foreground">{htmlContent.length.toLocaleString()} characters</p>
									</>
								)}
							</div>
						</div>
						<button
							type="button"
							onClick={handleClear}
							className="text-sm font-bold text-muted-foreground hover:text-foreground"
						>
							Clear
						</button>
					</div>

					{/* Preview */}
					<div className="space-y-3">
						<span className="font-bold">Preview</span>
						<div className="border-2 border-foreground bg-white h-[400px] overflow-auto">
							<iframe
								ref={printFrameRef}
								srcDoc={htmlWithPrintStyles}
								title="HTML Preview"
								className="w-full h-full border-none"
								sandbox="allow-same-origin allow-modals"
							/>
						</div>
					</div>

					{/* Export */}
					<div className="space-y-2">
						<button type="button" onClick={handleExport} className="btn-primary w-full">
							<PrintIcon className="w-5 h-5" />
							Export to PDF
						</button>
						<p className="text-xs text-muted-foreground text-center">
							Opens print dialog — select &quot;Save as PDF&quot; as destination
						</p>
					</div>
				</div>
			) : (
				<div className="space-y-6">
					<FileDropzone
						accept=".html,.htm"
						multiple={false}
						onFilesSelected={handleFileSelected}
						title="Drop your HTML file here"
						subtitle="or click to browse"
					/>

					<div className="info-box">
						<svg aria-hidden="true" className="w-5 h-5 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<circle cx="12" cy="12" r="10" />
							<path d="M12 16v-4" />
							<path d="M12 8h.01" />
						</svg>
						<div className="text-sm">
							<p className="font-bold text-foreground mb-1">HTML to PDF</p>
							<p className="text-muted-foreground">
								Upload an HTML file or press <kbd className="px-1.5 py-0.5 bg-muted border border-foreground/20 rounded text-xs font-mono">Ctrl+V</kbd> to paste HTML code.
								Uses native print for best quality with selectable text.
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
