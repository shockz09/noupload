import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF0 — Private PDF Tools",
  description: "Free, private PDF tools that run entirely in your browser. No uploads, no servers, no tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background">
        {/* Paper texture overlay */}
        <div className="paper-texture" />

        {/* Header */}
        <header className="header-main sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <a href="/" className="header-logo">
              PDF<span>0</span>
            </a>

            <nav className="flex items-center gap-3">
              <div className="header-badge">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>100% Private</span>
              </div>
              <div className="hidden sm:flex header-badge">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <span>Instant</span>
              </div>
            </nav>
          </div>
        </header>

        <main className="relative max-w-6xl mx-auto px-6 py-12">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t-2 border-foreground mt-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground font-medium">
                Your files never leave your device. Built for privacy.
              </p>
              <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                <span className="w-2.5 h-2.5 bg-[#2D5A3D] animate-pulse" />
                All processing local
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
