"use client";

import Link from "next/link";
import {
	ArchiveIcon,
	ArrowRightIcon,
	BookIcon,
	CompressIcon,
	DeletePagesIcon,
	DuplicateIcon,
	EditIcon,
	ExtractImageIcon,
	FileIcon,
	GrayscaleIcon,
	HtmlIcon,
	ImageIcon,
	LockIcon,
	MergeIcon,
	MetadataIcon,
	NumbersIcon,
	OcrIcon,
	OrganizeIcon,
	ReversePagesIcon,
	RotateIcon,
	SanitizeIcon,
	SignatureIcon,
	SplitIcon,
	TextIcon,
	UnlockIcon,
	WatermarkIcon,
} from "@/components/icons";
import { ToolSearch } from "@/components/shared/ToolSearch";

const tools = [
	{
		title: "Edit PDF",
		description: "Add text, signatures, shapes, and annotations",
		href: "/edit",
		icon: EditIcon,
		category: "edit",
		colorClass: "tool-edit",
	},
	{
		title: "Organize PDF",
		description: "Sort, add and delete pages with drag & drop",
		href: "/organize",
		icon: OrganizeIcon,
		category: "organize",
		colorClass: "tool-organize",
	},
	{
		title: "Merge PDF",
		description: "Combine multiple PDFs into one document",
		href: "/merge",
		icon: MergeIcon,
		category: "organize",
		colorClass: "tool-merge",
	},
	{
		title: "Split PDF",
		description: "Extract pages or divide into multiple files",
		href: "/split",
		icon: SplitIcon,
		category: "organize",
		colorClass: "tool-split",
	},
	{
		title: "Compress",
		description: "Reduce file size while keeping quality",
		href: "/compress",
		icon: CompressIcon,
		category: "optimize",
		colorClass: "tool-compress",
	},
	{
		title: "Grayscale",
		description: "Convert color PDFs to black and white",
		href: "/grayscale",
		icon: GrayscaleIcon,
		category: "convert",
		colorClass: "tool-grayscale",
	},
	{
		title: "PDF to PDF/A",
		description: "Convert to archival format for preservation",
		href: "/pdf-to-pdfa",
		icon: ArchiveIcon,
		category: "convert",
		colorClass: "tool-pdfa",
	},
	{
		title: "PDF → Images",
		description: "Convert pages to JPG or PNG",
		href: "/pdf-to-images",
		icon: ImageIcon,
		category: "convert",
		colorClass: "tool-pdf-to-images",
	},
	{
		title: "Images → PDF",
		description: "Create a PDF from your images",
		href: "/images-to-pdf",
		icon: FileIcon,
		category: "convert",
		colorClass: "tool-images-to-pdf",
	},
	{
		title: "Markdown → PDF",
		description: "Convert Markdown with LaTeX math to PDF",
		href: "/markdown-to-pdf",
		icon: TextIcon,
		category: "convert",
		colorClass: "tool-markdown-to-pdf",
	},
	{
		title: "HTML → PDF",
		description: "Convert HTML with CSS to PDF documents",
		href: "/html-to-pdf",
		icon: HtmlIcon,
		category: "convert",
		colorClass: "tool-html-to-pdf",
	},
	{
		title: "Rotate",
		description: "Rotate pages in any direction",
		href: "/rotate",
		icon: RotateIcon,
		category: "organize",
		colorClass: "tool-rotate",
	},
	{
		title: "Watermark",
		description: "Add text watermarks to documents",
		href: "/watermark",
		icon: WatermarkIcon,
		category: "edit",
		colorClass: "tool-watermark",
	},
	{
		title: "Page Numbers",
		description: "Add page numbers to your PDF",
		href: "/page-numbers",
		icon: NumbersIcon,
		category: "edit",
		colorClass: "tool-page-numbers",
	},
	{
		title: "OCR",
		description: "Extract text from scanned docs",
		href: "/ocr",
		icon: OcrIcon,
		category: "convert",
		colorClass: "tool-ocr",
	},
	{
		title: "Sign PDF",
		description: "Add your signature to documents",
		href: "/sign",
		icon: SignatureIcon,
		category: "edit",
		colorClass: "tool-sign",
	},
	{
		title: "Sanitize PDF",
		description: "Remove metadata and hidden data",
		href: "/sanitize",
		icon: SanitizeIcon,
		category: "security",
		colorClass: "tool-sanitize",
	},
	{
		title: "Encrypt PDF",
		description: "Add password protection to your PDF",
		href: "/encrypt",
		icon: LockIcon,
		category: "security",
		colorClass: "tool-encrypt",
	},
	{
		title: "Decrypt PDF",
		description: "Remove password from protected PDFs",
		href: "/decrypt",
		icon: UnlockIcon,
		category: "security",
		colorClass: "tool-decrypt",
	},
	{
		title: "Reverse Pages",
		description: "Flip the order of all pages",
		href: "/reverse",
		icon: ReversePagesIcon,
		category: "organize",
		colorClass: "tool-reverse",
	},
	{
		title: "PDF → Text",
		description: "Extract text content from PDFs",
		href: "/pdf-to-text",
		icon: TextIcon,
		category: "convert",
		colorClass: "tool-convert",
	},
	{
		title: "Duplicate Pages",
		description: "Copy and append pages to your PDF",
		href: "/duplicate",
		icon: DuplicateIcon,
		category: "organize",
		colorClass: "tool-duplicate",
	},
	{
		title: "Delete Pages",
		description: "Remove unwanted pages from PDF",
		href: "/delete",
		icon: DeletePagesIcon,
		category: "organize",
		colorClass: "tool-delete",
	},
	{
		title: "PDF Metadata",
		description: "View and edit document properties",
		href: "/metadata",
		icon: MetadataIcon,
		category: "edit",
		colorClass: "tool-metadata",
	},
	{
		title: "Extract Images",
		description: "Pull all images from a PDF",
		href: "/extract-images",
		icon: ExtractImageIcon,
		category: "convert",
		colorClass: "tool-extract-images",
	},
	{
		title: "PDF → EPUB",
		description: "Convert PDFs to ebook format",
		href: "/pdf-to-epub",
		icon: BookIcon,
		category: "convert",
		colorClass: "tool-convert",
	},
];

const categoryLabels: Record<string, string> = {
	organize: "Organize",
	optimize: "Optimize",
	convert: "Convert",
	edit: "Edit",
	security: "Security",
};

export default function Home() {
	return (
		<div className="page-enter space-y-16">
			{/* Hero Section */}
			<section className="space-y-8 py-8">
				<div className="max-w-3xl">
					<h1 className="text-3xl sm:text-5xl lg:text-7xl font-display leading-[1.1] tracking-tight">
						PDF tools that <span className="italic">respect</span>{" "}
						<span className="relative inline-block">
							your privacy
							<svg
								aria-hidden="true"
								className="absolute -bottom-2 left-0 w-full h-3 text-primary"
								viewBox="0 0 200 12"
								preserveAspectRatio="none"
							>
								<path
									d="M0,8 Q50,0 100,8 T200,8"
									fill="none"
									stroke="currentColor"
									strokeWidth="3"
									strokeLinecap="round"
								/>
							</svg>
						</span>
					</h1>
				</div>

				<p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
					Everything runs in your browser. Your files never touch our{" "}
					<span className="whitespace-nowrap">servers—because</span> we
					don&apos;t have any.
				</p>

				<div className="flex flex-wrap items-center gap-4 pt-2 text-sm font-semibold">
					<span>No uploads</span>
					<span className="text-muted-foreground">·</span>
					<span>No servers</span>
					<span className="text-muted-foreground">·</span>
					<span>Free forever</span>
				</div>
			</section>

			{/* Image Tools Banner */}
			<Link href="/image" className="block group">
				<div className="relative overflow-hidden border-2 border-foreground bg-gradient-to-r from-[#16A34A]/10 to-[#2563EB]/10 p-6 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0_0_#1a1a1a] transition-all">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								New
							</div>
							<h3 className="text-xl font-bold">Image Tools</h3>
							<p className="text-sm text-muted-foreground">
								Compress, resize, convert, crop, and more
							</p>
						</div>
						<div className="flex items-center gap-2 text-primary font-bold">
							<span>Explore</span>
							<ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
						</div>
					</div>
				</div>
			</Link>

			{/* Tools Grid */}
			<section className="space-y-8">
				<div className="flex items-center gap-4">
					<h2 className="text-2xl font-display">Tools</h2>
					<div className="flex-1 h-0.5 bg-foreground" />
				</div>

				<ToolSearch
					tools={tools}
					categoryLabels={categoryLabels}
					placeholder="Search PDF tools..."
				/>
			</section>

			{/* Features Section */}
			<section className="py-12 border-t-2 border-foreground">
				<div className="grid sm:grid-cols-3 gap-6">
					<div className="feature-item">
						<div className="feature-icon">
							<svg
								aria-hidden="true"
								className="w-6 h-6"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
								<polyline points="9 12 11 14 15 10" />
							</svg>
						</div>
						<h3 className="text-lg font-bold mb-2">Privacy First</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your documents stay on your device. We can&apos;t see them even if
							we wanted to.
						</p>
					</div>

					<div className="feature-item">
						<div className="feature-icon">
							<svg
								aria-hidden="true"
								className="w-6 h-6"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<circle cx="12" cy="12" r="10" />
								<polyline points="12 6 12 12 16 14" />
							</svg>
						</div>
						<h3 className="text-lg font-bold mb-2">Lightning Fast</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							No upload wait times. Processing starts instantly in your browser.
						</p>
					</div>

					<div className="feature-item">
						<div className="feature-icon">
							<svg
								aria-hidden="true"
								className="w-6 h-6"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
								<line x1="12" y1="2" x2="12" y2="12" />
							</svg>
						</div>
						<h3 className="text-lg font-bold mb-2">Works Offline</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Once loaded, use the tools even without an internet connection.
						</p>
					</div>
				</div>
			</section>
		</div>
	);
}
