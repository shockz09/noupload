import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";

function QRIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<rect x="3" y="3" width="7" height="7" />
			<rect x="14" y="3" width="7" height="7" />
			<rect x="3" y="14" width="7" height="7" />
			<rect x="14" y="14" width="3" height="3" />
			<rect x="18" y="14" width="3" height="3" />
			<rect x="14" y="18" width="3" height="3" />
			<rect x="18" y="18" width="3" height="3" />
		</svg>
	);
}

function ScanIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M3 7V5a2 2 0 0 1 2-2h2" />
			<path d="M17 3h2a2 2 0 0 1 2 2v2" />
			<path d="M21 17v2a2 2 0 0 1-2 2h-2" />
			<path d="M7 21H5a2 2 0 0 1-2-2v-2" />
			<line x1="7" y1="12" x2="17" y2="12" />
		</svg>
	);
}

function BulkIcon({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<rect x="3" y="3" width="6" height="6" />
			<rect x="15" y="3" width="6" height="6" />
			<rect x="3" y="15" width="6" height="6" />
			<rect x="15" y="15" width="6" height="6" />
		</svg>
	);
}

export default function QRPage() {
	return (
		<div className="page-enter space-y-12">
			{/* Header */}
			<section className="space-y-8 py-8">
				<Link
					href="/"
					className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
				>
					<ArrowLeftIcon className="w-4 h-4" />
					Back to Tools
				</Link>

				<div className="max-w-3xl">
					<h1 className="text-3xl sm:text-5xl lg:text-7xl font-display leading-[1.1] tracking-tight">
						QR codes,{" "}
						<span className="relative inline-block">
							<span className="italic">instantly</span>
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
					Generate QR codes for any content or scan existing ones. Everything
					happens in your browser.
				</p>

				<div className="flex flex-wrap items-center gap-4 pt-2 text-sm font-semibold">
					<span>No uploads</span>
					<span className="text-muted-foreground">·</span>
					<span>No servers</span>
					<span className="text-muted-foreground">·</span>
					<span>Free forever</span>
				</div>
			</section>

			{/* Tool Selection */}
			<section className="space-y-6">
				<div className="flex items-center gap-4">
					<h2 className="text-2xl font-display">Choose Tool</h2>
					<div className="flex-1 h-0.5 bg-foreground" />
				</div>

				<div className="grid sm:grid-cols-3 gap-4">
					{/* Generate Card */}
					<Link
						href="/qr/generate"
						className="tool-card tool-qr-generate group text-left transition-all hover:ring-4 hover:ring-[#1E4A7C] hover:ring-offset-2"
					>
						<span className="category-tag">Create</span>
						<div className="space-y-4">
							<div className="tool-icon tool-qr-generate">
								<QRIcon className="w-6 h-6" />
							</div>
							<div className="space-y-2 pr-12">
								<h3 className="text-xl font-bold text-foreground">
									Generate QR
								</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">
									Create QR codes for text, URLs, WiFi, UPI, and more
								</p>
							</div>
							<div className="flex items-center gap-2 text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity pt-2">
								<span>Open</span>
								<svg
									aria-hidden="true"
									className="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.5"
								>
									<path d="M5 12h14" />
									<path d="m12 5 7 7-7 7" />
								</svg>
							</div>
						</div>
					</Link>

					{/* Scan Card */}
					<Link
						href="/qr/scan"
						className="tool-card tool-qr-scan group text-left transition-all hover:ring-4 hover:ring-[#7C1E4A] hover:ring-offset-2"
					>
						<span className="category-tag">Read</span>
						<div className="space-y-4">
							<div className="tool-icon tool-qr-scan">
								<ScanIcon className="w-6 h-6" />
							</div>
							<div className="space-y-2 pr-12">
								<h3 className="text-xl font-bold text-foreground">Scan QR</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">
									Use your camera to read any QR code instantly
								</p>
							</div>
							<div className="flex items-center gap-2 text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity pt-2">
								<span>Open</span>
								<svg
									aria-hidden="true"
									className="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.5"
								>
									<path d="M5 12h14" />
									<path d="m12 5 7 7-7 7" />
								</svg>
							</div>
						</div>
					</Link>

					{/* Bulk Generate Card */}
					<Link
						href="/qr/bulk"
						className="tool-card tool-qr-generate group text-left transition-all hover:ring-4 hover:ring-[#4A1E7C] hover:ring-offset-2"
					>
						<span className="category-tag">Batch</span>
						<div className="space-y-4">
							<div className="tool-icon tool-qr-generate">
								<BulkIcon className="w-6 h-6" />
							</div>
							<div className="space-y-2 pr-12">
								<h3 className="text-xl font-bold text-foreground">
									Bulk Generate
								</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">
									Create multiple QR codes at once
								</p>
							</div>
							<div className="flex items-center gap-2 text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity pt-2">
								<span>Open</span>
								<svg
									aria-hidden="true"
									className="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.5"
								>
									<path d="M5 12h14" />
									<path d="m12 5 7 7-7 7" />
								</svg>
							</div>
						</div>
					</Link>
				</div>
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
						<h3 className="text-lg font-bold mb-2">100% Private</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							QR codes are generated locally. Your data never leaves your
							device.
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
								<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
							</svg>
						</div>
						<h3 className="text-lg font-bold mb-2">Instant</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Generate and scan in milliseconds. No waiting for servers.
						</p>
					</div>

					<div className="feature-item">
						<div className="feature-icon">
							<QRIcon className="w-6 h-6" />
						</div>
						<h3 className="text-lg font-bold mb-2">Multiple Formats</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Text, URLs, WiFi, UPI payments, email, phone, and SMS supported.
						</p>
					</div>
				</div>
			</section>
		</div>
	);
}
