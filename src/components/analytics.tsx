"use client";

import dynamic from "next/dynamic";

// Defer analytics loading until after hydration
const VercelAnalytics = dynamic(() => import("@vercel/analytics/next").then((mod) => mod.Analytics), { ssr: false });

export function Analytics() {
  return <VercelAnalytics />;
}
