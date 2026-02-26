import { ToolsHub } from "./tools-hub";

export default function Home() {
  return (
    <div className="page-enter space-y-8">
      {/* Hero Section */}
      <section className="space-y-8 py-8">
        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-display leading-[1.1] tracking-tight">
            Tools that <span className="italic">respect</span>{" "}
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
          <span className="whitespace-nowrap">servers—because</span> we don&apos;t have any.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2 text-sm font-semibold">
          <span>No uploads</span>
          <span className="text-muted-foreground">·</span>
          <span>No servers</span>
          <span className="text-muted-foreground">·</span>
          <span>Free forever</span>
        </div>
      </section>

      {/* Unified Tools Hub */}
      <ToolsHub />
    </div>
  );
}
