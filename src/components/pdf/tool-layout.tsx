"use client";

import Link from "next/link";
import { memo, type ReactNode } from "react";

interface ToolLayoutProps {
  title: string;
  description: string;
  icon: ReactNode;
  iconBg?: string;
  children: ReactNode;
}

export const ToolLayout = memo(function ToolLayout({
  title,
  description,
  icon,
  iconBg = "bg-primary/10",
  children,
}: ToolLayoutProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Breadcrumb */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4 group-hover:-translate-x-1 transition-transform"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to all tools
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className={`w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
        <div>
          <h1 className="text-3xl font-bold mb-2">{title}</h1>
          <p className="text-muted-foreground text-lg">{description}</p>
        </div>
      </div>

      {/* Content */}
      <div className="animate-fade-in">{children}</div>
    </div>
  );
});
