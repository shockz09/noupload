import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — noupload",
  description: "Our privacy policy is simple: we don't collect your data. All processing happens in your browser.",
};

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export default function PrivacyPage() {
  return (
    <div className="page-enter max-w-3xl mx-auto space-y-12">
      {/* Hero */}
      <section className="space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display leading-[1.1] tracking-tight">
          We don&apos;t{" "}
          <span className="relative inline-block">
            collect
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
          </span>{" "}
          your data
        </h1>

        <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
          Your files stay on your device. We can&apos;t see them, we don&apos;t store them, we don&apos;t want them.
        </p>

        <p className="text-sm text-muted-foreground">Last updated: January 2025</p>
      </section>

      {/* Content */}
      <div className="space-y-10">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="w-8 h-8 border-2 border-foreground flex items-center justify-center text-sm font-bold">
              1
            </span>
            What We Don&apos;t Collect
          </h2>
          <div className="pl-11 space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">Your files</strong> — PDFs, images, audio files are processed entirely
              in your browser. They never touch our servers.
            </p>
            <p>
              <strong className="text-foreground">Personal information</strong> — No accounts, no emails, no sign-ups.
              You&apos;re anonymous.
            </p>
            <p>
              <strong className="text-foreground">Cookies for tracking</strong> — We don&apos;t use cookies to track you
              across the web.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="w-8 h-8 border-2 border-foreground flex items-center justify-center text-sm font-bold">
              2
            </span>
            What We Do Collect
          </h2>
          <div className="pl-11 space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">Anonymous usage analytics</strong> — We use privacy-friendly analytics
              to see which pages are visited. This includes:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Page views (not tied to any identity)</li>
              <li>Country (derived from IP, not stored)</li>
              <li>Device type (mobile/desktop)</li>
              <li>Referrer (where you came from)</li>
            </ul>
            <p>This data is aggregated and anonymous. We can&apos;t identify individual users.</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="w-8 h-8 border-2 border-foreground flex items-center justify-center text-sm font-bold">
              3
            </span>
            How It Works
          </h2>
          <div className="pl-11 space-y-3 text-muted-foreground">
            <p>When you use our tools:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>You select a file from your device</li>
              <li>Your browser processes it using JavaScript/WebAssembly</li>
              <li>The result is generated locally</li>
              <li>You download the result directly</li>
            </ol>
            <p>At no point does your file leave your computer. The &quot;server&quot; is your own browser.</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="w-8 h-8 border-2 border-foreground flex items-center justify-center text-sm font-bold">
              4
            </span>
            Third Parties
          </h2>
          <div className="pl-11 space-y-3 text-muted-foreground">
            <p>
              <strong className="text-foreground">Hosting</strong> — We&apos;re hosted on Vercel. They may collect
              standard server logs (IP addresses, timestamps) as part of their infrastructure.
            </p>
            <p>
              <strong className="text-foreground">Analytics</strong> — We use Vercel Analytics, which is privacy-focused
              and doesn&apos;t use cookies.
            </p>
            <p>We don&apos;t use Google Analytics, Facebook Pixel, or any other invasive tracking.</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="w-8 h-8 border-2 border-foreground flex items-center justify-center text-sm font-bold">
              5
            </span>
            Your Rights
          </h2>
          <div className="pl-11 space-y-3 text-muted-foreground">
            <p>
              Since we don&apos;t collect personal data, there&apos;s nothing to delete, export, or correct. You&apos;re
              in full control.
            </p>
            <p>
              If you have questions, reach out on{" "}
              <a
                href="https://github.com/shockz09/noupload"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                GitHub
              </a>
              .
            </p>
          </div>
        </section>
      </div>

      {/* Footer */}
      <section className="border-t-2 border-foreground pt-8">
        <p className="text-sm text-muted-foreground">
          This policy is effective as of January 2025. We&apos;ll update this page if anything changes — but honestly,
          our approach is simple enough that it probably won&apos;t.
        </p>
      </section>
    </div>
  );
}
