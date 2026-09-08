import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system")({
  head: () => ({
    meta: [{ title: "Design System — noupload (local only)" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: DesignSystemPage,
});

import type React from "react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import * as AudioIcons from "@/components/icons/audio";
import * as ImageIcons from "@/components/icons/image";
import * as PdfIcons from "@/components/icons/pdf";
import * as UiIcons from "@/components/icons/ui";
import * as VideoIcons from "@/components/icons/video";
import { FileDropzone } from "@/components/pdf/file-dropzone";
import { FileList } from "@/components/pdf/file-list";
import { PasswordInput } from "@/components/pdf/PasswordInput";
import { ProcessingState } from "@/components/pdf/processing-state";
import {
  ErrorBox,
  FormatSelector,
  InfoBox,
  PageHeader,
  ProcessButton,
  ProgressBar,
  QualitySlider,
  SuccessCard,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────

const SEMANTIC_COLORS: [string, string, string][] = [
  ["--background", "#FAF7F2", "Warm paper — page ground"],
  ["--foreground", "#1A1612", "Body text, all borders"],
  ["--card", "#FFFEFA", "Card / panel surface"],
  ["--popover", "#FFFEFA", "Popover surface"],
  ["--primary", "#C84C1C", "Burnt orange — main actions"],
  ["--primary-foreground", "#FFFEFA", "Text on primary"],
  ["--secondary", "#2C2520", "Deep ink"],
  ["--secondary-foreground", "#FAF7F2", "Text on secondary"],
  ["--muted", "#F0EBE3", "Paper texture tone"],
  ["--muted-foreground", "#6B5E52", "Secondary text"],
  ["--accent", "#FFF0D4", "Warm highlight / info bg"],
  ["--accent-foreground", "#1A1612", "Text on accent"],
  ["--success", "#2D5A3D", "Forest green — completion"],
  ["--success-foreground", "#FFFEFA", "Text on success"],
  ["--destructive", "#B91C1C", "Errors, delete actions"],
  ["--border", "#E8E0D5", "Subtle dividers"],
  ["--input", "#F5F0E8", "Input ground"],
  ["--ring", "#C84C1C", "Focus ring"],
];

const CHART_COLORS: [string, string][] = [
  ["--chart-1", "#C84C1C"],
  ["--chart-2", "#2D5A3D"],
  ["--chart-3", "#1E4A7C"],
  ["--chart-4", "#7C4A1E"],
  ["--chart-5", "#4A1E7C"],
];

const TOOL_COLORS: [string, string][] = [
  ["tool-edit", "#0369A1"],
  ["tool-organize", "#5B21B6"],
  ["tool-merge", "#C84C1C"],
  ["tool-split", "#1E4A7C"],
  ["tool-compress", "#2D5A3D"],
  ["tool-pdf-to-images", "#7C4A1E"],
  ["tool-images-to-pdf", "#6B3D7C"],
  ["tool-rotate", "#1A6B5A"],
  ["tool-watermark", "#8B4513"],
  ["tool-page-numbers", "#4A5568"],
  ["tool-ocr", "#9C4221"],
  ["tool-sign", "#4A1E7C"],
  ["tool-encrypt", "#1E3A5F"],
  ["tool-decrypt", "#047857"],
  ["tool-reverse", "#0F766E"],
  ["tool-duplicate", "#A16207"],
  ["tool-delete", "#B91C1C"],
  ["tool-grayscale", "#4B5563"],
  ["tool-pdfa", "#1E40AF"],
  ["tool-remove-bg", "#7C3AED"],
  ["tool-image-compress", "#166534"],
  ["tool-resize", "#1E4A7C"],
  ["tool-convert", "#9C4221"],
  ["tool-heic", "#0E7490"],
  ["tool-crop", "#991B1B"],
  ["tool-rotate-image", "#5B21B6"],
  ["tool-strip-metadata", "#3F6212"],
  ["tool-image-edit", "#C84C1C"],
  ["tool-adjust", "#92400E"],
  ["tool-filters", "#9D174D"],
  ["tool-image-watermark", "#6B21A8"],
  ["tool-border", "#4B5563"],
  ["tool-base64", "#115E59"],
  ["tool-favicon", "#4A1E7C"],
  ["tool-screenshot", "#7C3AED"],
  ["tool-qr-generate", "#1E4A7C"],
  ["tool-qr-scan", "#7C1E4A"],
  ["tool-audio-trim", "#5B21B6"],
  ["tool-audio-record", "#991B1B"],
  ["tool-audio-volume", "#1E4A7C"],
  ["tool-audio-speed", "#92400E"],
  ["tool-audio-fade", "#166534"],
  ["tool-audio-compress", "#D97706"],
  ["tool-audio-reverse", "#7C1E4A"],
  ["tool-audio-waveform", "#0E7490"],
  ["tool-audio-convert", "#0891B2"],
  ["tool-audio-extract", "#B45309"],
  ["tool-audio-denoise", "#047857"],
  ["tool-audio-normalize", "#1D4ED8"],
  ["tool-audio-silence", "#BE185D"],
  ["tool-audio-merge", "#B91C1C"],
  ["tool-audio-metadata", "#7C3AED"],
  ["tool-video-compress", "#E11D48"],
  ["tool-video-trim", "#BE123C"],
  ["tool-video-convert", "#9F1239"],
  ["tool-video-rotate", "#881337"],
  ["tool-video-resize", "#C2410C"],
  ["tool-video-crop", "#B91C1C"],
  ["tool-video-remove-audio", "#991B1B"],
  ["tool-video-to-gif", "#9F1239"],
  ["tool-video-metadata", "#A21CAF"],
  ["tool-video-speed", "#9D174D"],
  ["tool-metadata", "#0369A1"],
  ["tool-blur", "#DC2626"],
  ["tool-barcode", "#1E3A5F"],
  ["tool-palette", "#DB2777"],
  ["tool-extract-images", "#B45309"],
  ["tool-collage", "#7C3AED"],
  ["tool-html-to-pdf", "#7F1D1D"],
  ["tool-qr-bulk", "#4A1E7C"],
  ["tool-markdown-to-pdf", "#059669"],
  ["tool-pptx-to-pdf", "#86198F"],
  ["tool-docx-to-pdf", "#1E3A8A"],
  ["tool-xlsx-to-pdf", "#166534"],
];

const NOISE_SVG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")";

interface Texture {
  name: string;
  desc: string;
  backgroundImage: string;
  opacity: number;
  amplify: number;
  mixBlendMode: "multiply" | "normal";
}

const TEXTURES: Texture[] = [
  {
    name: "paper-texture",
    desc: "Fractal-noise SVG grain, multiplied over the page at 2.5% opacity. Kills the flatness of a solid fill.",
    backgroundImage: NOISE_SVG,
    opacity: 0.025,
    amplify: 12,
    mixBlendMode: "multiply",
  },
];

interface SectionDef {
  id: string;
  label: string;
  Component: () => ReactNode;
}

interface NavGroup {
  label: string;
  blurb: string;
  sections: SectionDef[];
}

// Single source of truth: the rail, the group headings and the render order all
// come from here, so the nav can never drift out of sync with the page.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Foundations",
    blurb: "The raw material — tokens and surfaces everything else is built from.",
    sections: [
      { id: "color", label: "Color", Component: ColorSection },
      { id: "tool-colors", label: "Tool accents", Component: ToolColorSection },
      { id: "type", label: "Typography", Component: TypeSection },
      { id: "surface", label: "Surfaces & patterns", Component: SurfaceSection },
    ],
  },
  {
    label: "Components",
    blurb: "The brutalist classes and shared React components that make up the app.",
    sections: [
      { id: "buttons", label: "Buttons", Component: ButtonSection },
      { id: "pills", label: "Pills, badges & tags", Component: PillSection },
      { id: "cards", label: "Tool cards", Component: CardSection },
      { id: "inputs", label: "Inputs & controls", Component: InputSection },
      { id: "nav", label: "Page header & nav", Component: NavSection },
    ],
  },
  {
    label: "Flows",
    blurb: "The states a tool page moves through, in the order a user meets them.",
    sections: [
      { id: "files", label: "Dropzone & files", Component: FileSection },
      { id: "feedback", label: "Progress, errors & info", Component: FeedbackSection },
      { id: "success", label: "Success states", Component: SuccessSection },
    ],
  },
  {
    label: "Library",
    blurb: "Shared assets and the Radix primitives kept in components/ui.",
    sections: [
      { id: "icons", label: "Icons", Component: IconSection },
      { id: "animations", label: "Animations", Component: AnimationSection },
      { id: "primitives", label: "shadcn primitives", Component: PrimitiveSection },
    ],
  },
];

const ALL_SECTIONS: SectionDef[] = NAV_GROUPS.flatMap((g) => g.sections);
const SECTION_IDS: string[] = ALL_SECTIONS.map((s) => s.id);

/** Two-digit index shown in the rail and beside each section heading. */
function sectionNumber(id: string): string {
  return String(SECTION_IDS.indexOf(id) + 1).padStart(2, "0");
}

// ─────────────────────────────────────────────────────────────
// Layout helpers (local to this page — deliberately plain so the
// showcase chrome never competes with the components on show)
// ─────────────────────────────────────────────────────────────

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-6">
      <div className="space-y-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm font-bold text-primary tabular-nums">{sectionNumber(id)}</span>
          <h2 className="text-2xl sm:text-3xl font-display">{title}</h2>
          <div className="flex-1 h-0.5 bg-foreground" />
          <a
            href="#top"
            className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            top
          </a>
        </div>
        {note && <p className="text-sm text-muted-foreground max-w-2xl">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-xs bg-muted px-1.5 py-0.5 border border-border">{children}</code>;
}

function Frame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`border-2 border-foreground bg-card p-6 ${className}`}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

function DesignSystemPage() {
  const isDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
  if (!isDev) {
    return (
      <div className="page-enter max-w-xl mx-auto text-center space-y-4 py-16">
        <h1 className="text-4xl font-display">Not here</h1>
        <p className="text-muted-foreground">
          The design system reference is a local development page. Run <Code>pnpm dev</Code> to open it.
        </p>
      </div>
    );
  }
  return <DesignSystem />;
}

/** Highlights the section currently under the header as the page scrolls. */
function useActiveSection(): string {
  const [active, setActive] = useState(SECTION_IDS[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const onscreen = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (onscreen[0]) setActive(onscreen[0].target.id);
      },
      // Only count a section as active once it clears the sticky header.
      { rootMargin: "-96px 0px -65% 0px" },
    );

    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return active;
}

function SideRail({ active }: { active: string }) {
  return (
    <nav aria-label="Design system sections" className="hidden lg:block lg:sticky lg:top-24 self-start">
      <div className="space-y-6 border-l-2 border-foreground pl-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
            {group.sections.map((section) => {
              const isActive = section.id === active;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={`flex items-baseline gap-2 py-0.5 text-sm transition-colors ${
                    isActive ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="font-mono text-[10px] tabular-nums opacity-60">{sectionNumber(section.id)}</span>
                  <span>{section.label}</span>
                </a>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

function MobileNav() {
  return (
    <nav aria-label="Design system sections" className="lg:hidden space-y-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
          <div className="flex flex-wrap gap-2">
            {group.sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="border-2 border-foreground bg-card px-3 py-1.5 text-xs font-bold hover:bg-accent transition-colors"
              >
                {section.label}
              </a>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function GroupHeading({ group }: { group: NavGroup }) {
  const first = sectionNumber(group.sections[0].id);
  const last = sectionNumber(group.sections[group.sections.length - 1].id);

  return (
    <div className="border-y-2 border-foreground py-4 space-y-1">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs font-bold text-muted-foreground tabular-nums">
          {first}–{last}
        </span>
        <h2 className="text-xl font-bold uppercase tracking-wide">{group.label}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{group.blurb}</p>
    </div>
  );
}

function DesignSystem() {
  const active = useActiveSection();
  const iconCount = ICON_SETS.reduce((n, [, icons]) => n + icons.length, 0);

  return (
    <div id="top" className="page-enter space-y-10 scroll-mt-24">
      <header className="space-y-4">
        <h1 className="text-4xl sm:text-6xl font-display leading-[1.1] tracking-tight">
          noupload <span className="italic">design system</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Every token, class and shared component rendered live from the real source. Neo-brutalist editorial: thick
          black borders, hard offset shadows, warm paper, no rounded-everything.
        </p>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground">
          {[
            ["sections", ALL_SECTIONS.length],
            ["tool accents", TOOL_COLORS.length],
            ["icons", iconCount],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-baseline gap-1.5">
              <dt className="sr-only">{label as string}</dt>
              <dd className="font-bold text-foreground tabular-nums">{value as number}</dd>
              <span>{label as string}</span>
            </div>
          ))}
        </dl>
      </header>

      <MobileNav />

      <div className="lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-12">
        <SideRail active={active} />

        <div className="space-y-16 min-w-0">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-12">
              <GroupHeading group={group} />
              {group.sections.map(({ id, Component }) => (
                <Component key={id} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Color ────────────────────────────────────────────────────

function Swatch({ name, hex, desc }: { name: string; hex: string; desc?: string }) {
  return (
    <div className="border-2 border-foreground bg-card">
      <div className="h-20 border-b-2 border-foreground" style={{ background: hex }} />
      <div className="p-3 space-y-1">
        <p className="font-mono text-xs font-bold">{name}</p>
        <p className="font-mono text-xs text-muted-foreground">{hex}</p>
        {desc && <p className="text-xs text-muted-foreground leading-snug">{desc}</p>}
      </div>
    </div>
  );
}

function ColorSection() {
  return (
    <Section
      id="color"
      title="Color"
      note="Semantic tokens live in :root in app/globals.css and are exposed to Tailwind through @theme inline, so bg-primary, text-muted-foreground and friends all resolve to these."
    >
      <Spec label="Semantic tokens">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {SEMANTIC_COLORS.map(([name, hex, desc]) => (
            <Swatch key={name} name={name} hex={hex} desc={desc} />
          ))}
        </div>
      </Spec>
      <Spec label="Chart series">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {CHART_COLORS.map(([name, hex]) => (
            <Swatch key={name} name={name} hex={hex} />
          ))}
        </div>
      </Spec>
      <Spec label="On-color contrast">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ["Primary", "#C84C1C", "#FFFEFA"],
            ["Secondary", "#2C2520", "#FAF7F2"],
            ["Success", "#2D5A3D", "#FFFEFA"],
            ["Destructive", "#B91C1C", "#FFFFFF"],
          ].map(([label, bg, fg]) => (
            <div key={label} className="border-2 border-foreground p-5 space-y-1" style={{ background: bg, color: fg }}>
              <p className="font-bold">{label}</p>
              <p className="text-sm opacity-80">The quick brown fox</p>
            </div>
          ))}
        </div>
      </Spec>
    </Section>
  );
}

// ── Tool accents ─────────────────────────────────────────────

function ToolColorSection() {
  const [query, setQuery] = useState("");
  const filtered = TOOL_COLORS.filter(([cls]) => cls.includes(query.toLowerCase().trim()));

  return (
    <Section
      id="tool-colors"
      title="Tool accents"
      note="Every tool owns an accent, set as --tool-color on a .tool-* class. The tool card's second offset shadow picks it up, which is what gives each card its identity."
    >
      <input
        type="text"
        value={query}
        placeholder="Filter tool classes…"
        onChange={(e) => setQuery(e.target.value)}
        className="input-field max-w-sm"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(([cls, hex]) => (
          <div key={cls} className="flex items-center gap-3 border-2 border-foreground bg-card p-3">
            <div className="w-10 h-10 border-2 border-foreground shrink-0" style={{ background: hex }} />
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold truncate">.{cls}</p>
              <p className="font-mono text-xs text-muted-foreground">{hex}</p>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-sm text-muted-foreground">No tool class matches “{query}”.</p>}
      <p className="text-xs text-muted-foreground">
        {TOOL_COLORS.length} accents total. Add new ones next to the others in <Code>app/globals.css</Code>.
      </p>
    </Section>
  );
}

// ── Typography ───────────────────────────────────────────────

function TypeSection() {
  return (
    <Section
      id="type"
      title="Typography"
      note="Instrument Serif for display, Onest for everything else, system mono for code and extracted text. No Inter, no Roboto."
    >
      <Spec label="Display scale — .font-display">
        <Frame className="space-y-4">
          <p className="text-7xl font-display leading-none">Aa 7xl</p>
          <p className="text-5xl font-display leading-none">Aa 5xl</p>
          <p className="text-4xl font-display">Page title — text-4xl</p>
          <p className="text-3xl font-display">Success heading — text-3xl</p>
          <p className="text-2xl font-display">Section heading — text-2xl</p>
          <p className="text-2xl font-display italic">Italic accent — used in the hero</p>
        </Frame>
      </Spec>
      <Spec label="Body scale — Onest">
        <Frame className="space-y-3">
          <p className="text-base">
            Body — text-base. Your files never leave your device; every tool runs in the browser.
          </p>
          <p className="text-sm font-medium">Small — text-sm font-medium, used for helper copy.</p>
          <p className="text-sm text-muted-foreground">Small muted — secondary information.</p>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Micro — text-xs bold uppercase tracking-wider
          </p>
          <p className="font-mono text-sm">Mono — 1234.56 kB · tabular-nums for counters</p>
          <p className="input-label">.input-label — the field label treatment</p>
        </Frame>
      </Spec>
      <Spec label="Weights">
        <Frame className="space-y-2">
          {[
            ["font-normal", "400"],
            ["font-medium", "500"],
            ["font-semibold", "600"],
            ["font-bold", "700"],
          ].map(([cls, weight]) => (
            <p key={cls} className={cls}>
              <span className="font-mono text-xs text-muted-foreground mr-3">
                {cls} / {weight}
              </span>
              Neo-brutalist editorial
            </p>
          ))}
        </Frame>
      </Spec>
    </Section>
  );
}

// ── Surfaces ─────────────────────────────────────────────────

function SurfaceSection() {
  return (
    <Section
      id="surface"
      title="Surfaces & patterns"
      note="Background textures and the offset-shadow vocabulary that stands in for elevation."
    >
      <Spec label="Textures">
        <p className="text-sm text-muted-foreground max-w-2xl">
          The class is a <Code>position: fixed; inset: 0</Code> full-viewport overlay, so it cannot be previewed in a
          box using the class itself. These swatches reproduce the same background values, contained — at the shipped
          opacity, and amplified so the grain is actually legible.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {TEXTURES.map((tex) => (
            <div key={tex.name} className="space-y-3">
              <div className="grid grid-cols-2 gap-px bg-foreground border-2 border-foreground">
                {[
                  { label: "as shipped", opacity: tex.opacity },
                  { label: `amplified ${tex.amplify}x`, opacity: Math.min(1, tex.opacity * tex.amplify) },
                ].map((variant) => (
                  <div key={variant.label} className="relative h-40 bg-card overflow-hidden">
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: tex.backgroundImage,
                        opacity: variant.opacity,
                        mixBlendMode: tex.mixBlendMode,
                      }}
                    />
                    <span className="absolute bottom-2 left-2 font-mono text-[10px] font-bold text-muted-foreground">
                      {variant.label}
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <p className="font-mono text-xs font-bold">.{tex.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{tex.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <InfoBox title="Where it is used">
          <Code>.paper-texture</Code> is mounted once in <Code>routes/__root.tsx</Code>, so it is already sitting over
          this entire page — the grain you see everywhere is it.
        </InfoBox>
      </Spec>
      <Spec label="Shadow vocabulary">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-2">
          <div className="border-2 border-foreground bg-card p-5 shadow-[3px_3px_0_0_#1A1612]">
            <p className="font-bold text-sm">Hard offset 3px</p>
            <p className="text-xs text-muted-foreground mt-1">Button hover</p>
          </div>
          <div className="border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_#1A1612,8px_8px_0_0_#C84C1C]">
            <p className="font-bold text-sm">Double shadow</p>
            <p className="text-xs text-muted-foreground mt-1">Tool card hover — black + accent</p>
          </div>
          <div className="border-2 border-foreground bg-card p-5 shadow-[-4px_0_0_0_#C84C1C]">
            <p className="font-bold text-sm">Left accent</p>
            <p className="text-xs text-muted-foreground mt-1">File item hover</p>
          </div>
        </div>
      </Spec>
      <Spec label="Borders">
        <Frame className="space-y-4">
          {[
            ["border", "1px — subtle divider on --border"],
            ["border-2 border-foreground", "2px — the default structural border"],
            ["border-[3px] border-foreground", "3px — dropzone and success card"],
          ].map(([cls, desc]) => (
            <div key={cls} className={`${cls} bg-background p-4`}>
              <p className="font-mono text-xs font-bold">{cls}</p>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </div>
          ))}
        </Frame>
      </Spec>
    </Section>
  );
}

// ── Buttons ──────────────────────────────────────────────────

function ButtonSection() {
  const [processing, setProcessing] = useState(false);
  const run = useCallback(() => {
    setProcessing(true);
    setTimeout(() => setProcessing(false), 1800);
  }, []);

  return (
    <Section
      id="buttons"
      title="Buttons"
      note="The .btn-* classes are the real buttons across the app. Hover shifts the element up-left and drops a hard shadow behind it — press to see the translate reverse."
    >
      <Spec label=".btn-primary / .btn-secondary / .btn-success">
        <Frame className="flex flex-wrap gap-4">
          <button type="button" className="btn-primary">
            <UiIcons.SparklesIcon className="w-5 h-5" />
            Primary action
          </button>
          <button type="button" className="btn-secondary">
            Secondary
          </button>
          <button type="button" className="btn-success">
            <UiIcons.DownloadIcon className="w-5 h-5" />
            Download
          </button>
        </Frame>
      </Spec>
      <Spec label="Disabled & full width">
        <Frame className="space-y-4">
          <button type="button" className="btn-primary" disabled>
            Disabled primary
          </button>
          <button type="button" className="btn-primary w-full">
            <PdfIcons.MergeIcon className="w-5 h-5" />
            Full-width primary
          </button>
        </Frame>
      </Spec>
      <Spec label="ProcessButton — shared, swaps to a spinner while working">
        <Frame>
          <ProcessButton
            onClick={run}
            isProcessing={processing}
            processingLabel="Compressing…"
            icon={<PdfIcons.CompressIcon className="w-5 h-5" />}
            label="Compress PDF"
          />
        </Frame>
      </Spec>
      <Spec label="Icon-only and link treatments">
        <Frame className="flex flex-wrap items-center gap-4">
          <button type="button" className="btn-success px-3">
            <UiIcons.CopyIcon className="w-5 h-5" />
          </button>
          <button type="button" className="btn-secondary px-3">
            <UiIcons.TrashIcon className="w-5 h-5" />
          </button>
          <button type="button" className="back-link">
            <UiIcons.ArrowLeftIcon className="w-4 h-4" />
            Back to tools
          </button>
        </Frame>
      </Spec>
    </Section>
  );
}

// ── Pills, badges, tags ──────────────────────────────────────

function PillSection() {
  const [active, setActive] = useState("all");
  const cats: [string, string, string][] = [
    ["all", "All", "#C84C1C"],
    ["pdf", "PDF", "#2563EB"],
    ["image", "Image", "#16A34A"],
    ["audio", "Audio", "#8B5CF6"],
    ["video", "Video", "#E11D48"],
    ["qr", "QR Code", "#F59E0B"],
  ];

  return (
    <Section
      id="pills"
      title="Pills, badges & tags"
      note="The hub's category switcher, search result tags, and the header's status chips."
    >
      <Spec label=".category-pill — click to switch">
        <Frame className="flex flex-wrap gap-3">
          {cats.map(([key, label, color]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              data-active={key === active}
              className="category-pill px-4 py-2 text-sm font-bold cursor-pointer"
              style={{ "--cat-color": color } as React.CSSProperties}
            >
              {label}
              <span
                className={`ml-1.5 text-xs font-semibold ${key === active ? "opacity-90" : "text-muted-foreground"}`}
              >
                12
              </span>
            </button>
          ))}
        </Frame>
      </Spec>
      <Spec label=".category-tag — absolutely pinned to a tool card's top-right">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            ["organize", "Merge PDF", "tool-merge", PdfIcons.MergeIcon],
            ["optimize", "Compress", "tool-compress", PdfIcons.CompressIcon],
            ["secure", "Encrypt", "tool-encrypt", UiIcons.LockIcon],
          ].map(([cat, title, cls, Icon]) => {
            const I = Icon as IconComponent;
            return (
              <div key={cat as string} className="tool-card-link">
                <div className={`tool-card ${cls as string}`}>
                  <span className="category-tag">{cat as string}</span>
                  <div className={`tool-icon ${cls as string}`}>
                    <I className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold mt-4">{title as string}</h3>
                </div>
              </div>
            );
          })}
        </div>
      </Spec>
      <Spec label="Badge primitive (shadcn) — rounded, used sparingly">
        <Frame className="flex flex-wrap gap-3">
          <Badge>default</Badge>
          <Badge variant="secondary">secondary</Badge>
          <Badge variant="destructive">destructive</Badge>
          <Badge variant="outline">outline</Badge>
        </Frame>
      </Spec>
    </Section>
  );
}

// ── Tool cards ───────────────────────────────────────────────

function CardSection() {
  const samples: [string, string, string, (p: { className?: string }) => ReactNode][] = [
    ["Merge PDF", "Combine multiple PDFs into one document", "tool-merge", PdfIcons.MergeIcon],
    ["Split PDF", "Extract pages or divide into multiple files", "tool-split", PdfIcons.SplitIcon],
    ["Compress", "Reduce file size while keeping quality", "tool-compress", PdfIcons.CompressIcon],
    ["Remove background", "Erase image backgrounds on-device", "tool-remove-bg", ImageIcons.ImageIcon],
    ["Trim audio", "Cut a clip out of any track", "tool-audio-trim", AudioIcons.AudioIcon],
    ["Compress video", "Smaller files, same footage", "tool-video-compress", VideoIcons.VideoToolIcon],
  ];

  return (
    <Section
      id="cards"
      title="Tool cards"
      note="Hover a card: it lifts up-left and gains a black shadow plus a second shadow in its own accent. The icon wiggles. This is the app's signature interaction."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
        {samples.map(([title, desc, cls, Icon]) => (
          <div key={title} className="tool-card-link">
            <div className={`tool-card ${cls}`}>
              <div className={`tool-icon ${cls}`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mt-4">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <Spec label="Card primitive (shadcn) — rounded, only inside dialogs and panels">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Card title</CardTitle>
            <CardDescription>Soft-cornered surface from the primitive set.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Kept for compatibility with shadcn components; the brutalist border style is preferred for app chrome.
            </p>
          </CardContent>
          <CardFooter className="gap-2">
            <Button size="sm">Confirm</Button>
            <Button size="sm" variant="outline">
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </Spec>
    </Section>
  );
}

// ── Inputs ───────────────────────────────────────────────────

function InputSection() {
  const [quality, setQuality] = useState(72);
  const [format, setFormat] = useState("png");
  const [mode, setMode] = useState("extract");
  const [pwd, setPwd] = useState("");

  return (
    <Section
      id="inputs"
      title="Inputs & controls"
      note="Typewriter-style fields: 2px border, no radius, and a focus state that shifts the field up-left with a coloured shadow."
    >
      <Spec label=".input-field + .input-label — focus one to see the shift">
        <Frame className="space-y-5 max-w-md">
          <div className="space-y-2">
            <label htmlFor="ds-text" className="input-label">
              Pages to extract
            </label>
            <input id="ds-text" type="text" placeholder="e.g., 1, 3, 5-10" className="input-field" />
          </div>
          <div className="space-y-2">
            <label htmlFor="ds-num" className="input-label">
              Rotation
            </label>
            <input id="ds-num" type="number" defaultValue={90} className="input-field" />
          </div>
          <div className="space-y-2">
            <label htmlFor="ds-area" className="input-label">
              Watermark text
            </label>
            <textarea id="ds-area" rows={3} placeholder="CONFIDENTIAL" className="input-field w-full" />
          </div>
        </Frame>
      </Spec>
      <Spec label=".mode-selector / .mode-option — segmented control">
        <Frame>
          <div className="mode-selector">
            {[
              ["extract", "Extract pages"],
              ["range", "Split by range"],
              ["every", "Every N pages"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`mode-option ${mode === value ? "active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </Frame>
      </Spec>
      <Spec label="QualitySlider — shared">
        <Frame className="max-w-md">
          <QualitySlider label="Quality" value={quality} onChange={setQuality} />
        </Frame>
      </Spec>
      <Spec label="FormatSelector — shared">
        <Frame className="max-w-lg space-y-6">
          <FormatSelector
            label="Output format"
            value={format}
            onChange={setFormat}
            formats={[
              { value: "png", label: "PNG", desc: "Lossless" },
              { value: "jpeg", label: "JPEG", desc: "Smaller" },
              { value: "webp", label: "WebP", desc: "Modern" },
            ]}
          />
          <FormatSelector
            value={format}
            onChange={setFormat}
            columns={4}
            formats={[
              { value: "png", label: "PNG" },
              { value: "jpeg", label: "JPEG" },
              { value: "webp", label: "WebP" },
              { value: "avif", label: "AVIF" },
            ]}
          />
        </Frame>
      </Spec>
      <Spec label="PasswordInput — with reveal toggle">
        <Frame className="max-w-md">
          <PasswordInput
            id="ds-password"
            label="Document password"
            value={pwd}
            onChange={setPwd}
            placeholder="Enter the PDF password"
            hint="Needed only for encrypted documents."
          />
        </Frame>
      </Spec>
      <Spec label="Checkbox & radio (native, bordered)">
        <Frame className="space-y-3">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary" />
            Flatten form fields on export
          </label>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="radio" name="ds-radio" defaultChecked className="w-4 h-4 accent-primary" />
            All pages
          </label>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="radio" name="ds-radio" className="w-4 h-4 accent-primary" />
            Selected pages only
          </label>
        </Frame>
      </Spec>
      <Spec label="Input / Label primitives (shadcn)">
        <Frame className="max-w-sm space-y-2">
          <Label htmlFor="ds-primitive">Email</Label>
          <Input id="ds-primitive" placeholder="you@example.com" />
          <Input placeholder="Invalid state" aria-invalid />
          <Input placeholder="Disabled" disabled />
        </Frame>
      </Spec>
    </Section>
  );
}

// ── Dropzone & files ─────────────────────────────────────────

const DEMO_FILES = [
  { id: "1", file: new File([new Uint8Array(240 * 1024)], "annual-report-2025.pdf", { type: "application/pdf" }) },
  { id: "2", file: new File([new Uint8Array(1_800_000)], "scanned-contract.pdf", { type: "application/pdf" }) },
  { id: "3", file: new File([new Uint8Array(64 * 1024)], "appendix-b.pdf", { type: "application/pdf" }) },
];

function FileSection() {
  const [files, setFiles] = useState(DEMO_FILES);
  const noop = useCallback(() => {}, []);

  const remove = useCallback((id: string) => setFiles((f) => f.filter((x) => x.id !== id)), []);
  const reorder = useCallback((from: number, to: number) => {
    setFiles((f) => {
      const next = [...f];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);
  const reset = useCallback(() => setFiles(DEMO_FILES), []);

  return (
    <Section
      id="files"
      title="Dropzone & files"
      note="The dropzone is the real component — drag a file over it to see the dragging state and the corner fold grow. The file list below is fully draggable."
    >
      <Spec label="FileDropzone — default">
        <FileDropzone accept=".pdf" multiple onFilesSelected={noop} title="Drop your PDFs here" />
      </Spec>
      <Spec label="FileDropzone — compact">
        <FileDropzone accept=".pdf" multiple={false} compact onFilesSelected={noop} />
      </Spec>
      <Spec label="FileDropzone — custom copy, single file">
        <FileDropzone
          accept=".png,.jpg,.jpeg,.webp"
          multiple={false}
          onFilesSelected={noop}
          title="Drop an image"
          subtitle="PNG, JPEG or WebP · up to 100MB"
        />
      </Spec>
      <Spec label="FileList — drag the handles to reorder">
        <div className="space-y-3">
          <FileList files={files} onRemove={remove} onReorder={reorder} onClear={reset} />
          {files.length !== DEMO_FILES.length && (
            <button type="button" onClick={reset} className="btn-secondary">
              Restore demo files
            </button>
          )}
        </div>
      </Spec>
      <Spec label=".file-item — the single-file info row (FileInfo)">
        <div className="file-item">
          <div className="pdf-icon-box">
            <PdfIcons.PdfIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">annual-report-2025.pdf</p>
            <p className="text-sm text-muted-foreground">240 KB · 18 pages</p>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Change file
          </button>
        </div>
      </Spec>
      <Spec label="Drag affordances">
        <Frame className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="file-number">1</span>
            <span className="text-sm text-muted-foreground">.file-number</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="drag-handle">
              <UiIcons.GripIcon className="w-4 h-4" />
            </span>
            <span className="text-sm text-muted-foreground">.drag-handle</span>
          </div>
        </Frame>
      </Spec>
    </Section>
  );
}

// ── Feedback ─────────────────────────────────────────────────

function FeedbackSection() {
  const [progress, setProgress] = useState(42);
  const [status, setStatus] = useState<"processing" | "error">("processing");

  return (
    <Section
      id="feedback"
      title="Progress, errors & info"
      note="Progress is an industrial striped bar that marches while active. Errors shake once to draw the eye."
    >
      <Spec label="ProgressBar — shared, striped and animated">
        <Frame className="space-y-6">
          <ProgressBar progress={progress} />
          <ProgressBar progress={progress} label="Rendering page 3 of 18…" />
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="flex-1"
            />
            <span className="font-mono text-sm font-bold tabular-nums w-12 text-right">{progress}%</span>
          </div>
        </Frame>
      </Spec>
      <Spec label=".progress-bar at the edges">
        <Frame className="space-y-4">
          {[0, 8, 50, 100].map((p) => (
            <div key={p} className="space-y-1">
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${p}%` }} />
              </div>
              <p className="font-mono text-xs text-muted-foreground">{p}%</p>
            </div>
          ))}
        </Frame>
      </Spec>
      <Spec label="ErrorBox — shared, shakes on mount">
        <div className="space-y-3">
          <ErrorBox key={`err-${progress}`} message="Failed to read the PDF — it may be password protected." />
          <p className="text-xs text-muted-foreground">Move the slider above to remount and replay the shake.</p>
        </div>
      </Spec>
      <Spec label="InfoBox — shared">
        <div className="space-y-4">
          <InfoBox title="Everything stays local">
            Files are processed in your browser. Nothing is uploaded, and closing the tab clears everything.
          </InfoBox>
          <InfoBox>Large PDFs may take a moment on the first run while the WASM engine loads.</InfoBox>
          <InfoBox title="With a custom icon" icon={<UiIcons.ShieldIcon className="w-5 h-5 mt-0.5 shrink-0" />}>
            Any node can replace the default info glyph.
          </InfoBox>
        </div>
      </Spec>
      <Spec label="ProcessingState — the older circular-spinner variant">
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStatus("processing")}
              className={`mode-option ${status === "processing" ? "active" : ""}`}
            >
              processing
            </button>
            <button
              type="button"
              onClick={() => setStatus("error")}
              className={`mode-option ${status === "error" ? "active" : ""}`}
            >
              error
            </button>
          </div>
          <ProcessingState
            status={status}
            progress={progress}
            message="Compressing pages…"
            fileName="annual-report-2025.pdf"
            fileSize={240 * 1024}
            error="Ghostscript ran out of memory on this document."
            onStartOver={() => setStatus("processing")}
          />
        </div>
      </Spec>
      <Spec label="Progress primitive (shadcn)">
        <Frame>
          <Progress value={progress} />
        </Frame>
      </Spec>
    </Section>
  );
}

// ── Success ──────────────────────────────────────────────────

function SuccessSection() {
  const [nonce, setNonce] = useState(0);
  const replay = useCallback(() => setNonce((n) => n + 1), []);

  return (
    <Section
      id="success"
      title="Success states"
      note="The approval stamp is the signature moment: it scales in from 2x, overshoots, and settles at a -3° tilt while the checkmark draws itself."
    >
      <button type="button" onClick={replay} className="btn-secondary">
        <UiIcons.RefreshIcon className="w-4 h-4" />
        Replay stamp
      </button>
      <div key={nonce} className="max-w-2xl mx-auto">
        <SuccessCard
          stampText="Approved"
          title="Your PDF is ready"
          subtitle="3 files merged into one 412 KB document."
          downloadLabel="Download PDF"
          onDownload={(e) => e.preventDefault()}
          onCopy={() => {}}
          onStartOver={() => {}}
          startOverLabel="Merge more"
        />
      </div>
      <Spec label="Without a stamp, with custom content">
        <div key={`plain-${nonce}`} className="max-w-2xl mx-auto">
          <SuccessCard
            title="Text extracted"
            downloadLabel="Download .txt"
            onDownload={(e) => e.preventDefault()}
            onStartOver={() => {}}
            startOverLabel="Start over"
          >
            <div className="border-2 border-foreground bg-muted/40 p-4 text-left font-mono text-xs max-h-32 overflow-auto">
              NOUPLOAD PRIVACY NOTICE{"\n\n"}All processing happens on this device. No file is transmitted.
            </div>
          </SuccessCard>
        </div>
      </Spec>
      <Spec label=".success-stamp on its own">
        <Frame className="flex justify-center py-10">
          <div key={`stamp-${nonce}`} className="success-stamp">
            <span className="success-stamp-text">Done</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </Frame>
      </Spec>
    </Section>
  );
}

// ── Nav ──────────────────────────────────────────────────────

function NavSection() {
  return (
    <Section
      id="nav"
      title="Page header & nav"
      note="Every tool page opens with the same header: back link, accented icon tile, serif title, muted description."
    >
      <Frame>
        <PageHeader
          icon={<PdfIcons.MergeIcon className="w-7 h-7" />}
          iconClass="tool-merge"
          title="Merge PDF"
          description="Combine multiple PDFs into one document"
          backHref="/"
          backLabel="Back to tools"
        />
      </Frame>
      <Spec label="Icon tiles at every accent">
        <Frame className="flex flex-wrap gap-4">
          {[
            ["tool-split", PdfIcons.SplitIcon],
            ["tool-compress", PdfIcons.CompressIcon],
            ["tool-ocr", PdfIcons.OcrIcon],
            ["tool-sign", PdfIcons.SignatureIcon],
            ["tool-encrypt", UiIcons.LockIcon],
            ["tool-video-compress", VideoIcons.VideoToolIcon],
          ].map(([cls, Icon]) => {
            const I = Icon as (p: { className?: string }) => ReactNode;
            return (
              <div key={cls as string} className={`tool-icon ${cls as string}`}>
                <I className="w-6 h-6" />
              </div>
            );
          })}
        </Frame>
      </Spec>
      <Spec label=".back-link">
        <Frame>
          <a href="#nav" className="back-link">
            <UiIcons.ArrowLeftIcon className="w-4 h-4" />
            Back to tools
          </a>
        </Frame>
      </Spec>
    </Section>
  );
}

// ── shadcn primitives ────────────────────────────────────────

function PrimitiveSection() {
  return (
    <Section
      id="primitives"
      title="shadcn primitives"
      note="Radix-backed pieces kept in components/ui. They still carry shadcn's rounded defaults, so reach for the brutalist classes above for anything user-facing on a tool page."
    >
      <Spec label="Button — variants">
        <Frame className="flex flex-wrap gap-3">
          {(["default", "secondary", "destructive", "outline", "ghost", "link"] as const).map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
        </Frame>
      </Spec>
      <Spec label="Button — sizes & states">
        <Frame className="flex flex-wrap items-center gap-3">
          <Button size="sm">sm</Button>
          <Button size="default">default</Button>
          <Button size="lg">lg</Button>
          <Button size="icon" aria-label="Copy">
            <UiIcons.CopyIcon />
          </Button>
          <Button size="icon-sm" aria-label="Delete">
            <UiIcons.TrashIcon />
          </Button>
          <Button size="icon-lg" aria-label="Download">
            <UiIcons.DownloadIcon />
          </Button>
          <Button disabled>disabled</Button>
        </Frame>
      </Spec>
      <Spec label="Tabs">
        <Frame>
          <Tabs defaultValue="pages">
            <TabsList>
              <TabsTrigger value="pages">Pages</TabsTrigger>
              <TabsTrigger value="fields">Form fields</TabsTrigger>
              <TabsTrigger value="meta">Metadata</TabsTrigger>
            </TabsList>
            <TabsContent value="pages" className="pt-4 text-sm text-muted-foreground">
              Page thumbnails would render here.
            </TabsContent>
            <TabsContent value="fields" className="pt-4 text-sm text-muted-foreground">
              Detected AcroForm fields.
            </TabsContent>
            <TabsContent value="meta" className="pt-4 text-sm text-muted-foreground">
              Title, author, producer.
            </TabsContent>
          </Tabs>
        </Frame>
      </Spec>
      <Spec label="Separator">
        <Frame className="space-y-4">
          <p className="text-sm">Above</p>
          <Separator />
          <p className="text-sm">Below</p>
          <div className="flex items-center gap-4 h-10">
            <span className="text-sm">Left</span>
            <Separator orientation="vertical" />
            <span className="text-sm">Right</span>
          </div>
        </Frame>
      </Spec>
      <Spec label="Dialog">
        <Frame>
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="btn-secondary">
                Open dialog
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Discard this draft?</DialogTitle>
                <DialogDescription>Your unsaved annotations will be lost. This cannot be undone.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Keep editing</Button>
                <Button variant="destructive">Discard</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Frame>
      </Spec>
      <Spec label="ScrollArea">
        <Frame>
          <ScrollArea className="h-40 border-2 border-foreground">
            <div className="p-4 space-y-2">
              {Array.from({ length: 24 }, (_, i) => (
                <p key={i} className="text-sm">
                  Page {i + 1} — extracted text line
                </p>
              ))}
            </div>
          </ScrollArea>
        </Frame>
      </Spec>
    </Section>
  );
}

// ── Icons ────────────────────────────────────────────────────

type IconComponent = (p: { className?: string }) => ReactNode;

function iconEntries(mod: Record<string, unknown>): [string, IconComponent][] {
  return Object.entries(mod)
    .filter(([name, value]) => typeof value === "function" && name.endsWith("Icon"))
    .map(([name, value]): [string, IconComponent] => [name, value as IconComponent])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

const ICON_SETS: [string, [string, IconComponent][]][] = [
  ["ui", iconEntries(UiIcons as unknown as Record<string, unknown>)],
  ["pdf", iconEntries(PdfIcons as unknown as Record<string, unknown>)],
  ["image", iconEntries(ImageIcons as unknown as Record<string, unknown>)],
  ["audio", iconEntries(AudioIcons as unknown as Record<string, unknown>)],
  ["video", iconEntries(VideoIcons as unknown as Record<string, unknown>)],
];

function IconSection() {
  const [query, setQuery] = useState("");
  const q = query.toLowerCase().trim();
  const total = ICON_SETS.reduce((n, [, icons]) => n + icons.length, 0);

  return (
    <Section
      id="icons"
      title="Icons"
      note="Hand-drawn stroke icons in components/icons, split by domain. All take a className and inherit currentColor. Click a name to copy it."
    >
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          value={query}
          placeholder="Filter icons…"
          onChange={(e) => setQuery(e.target.value)}
          className="input-field max-w-sm"
        />
        <span className="text-sm text-muted-foreground">{total} icons</span>
      </div>
      {ICON_SETS.map(([set, icons]) => {
        const shown = icons.filter(([name]) => name.toLowerCase().includes(q));
        if (shown.length === 0) return null;
        return (
          <Spec key={set} label={`components/icons/${set} — ${shown.length}`}>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {shown.map(([name, Icon]) => (
                <button
                  key={name}
                  type="button"
                  title={`Copy "${name}"`}
                  onClick={() => navigator.clipboard?.writeText(name)}
                  className="border-2 border-foreground bg-card p-3 flex flex-col items-center gap-2 hover:bg-accent transition-colors"
                >
                  <Icon className="w-6 h-6" />
                  <span className="font-mono text-[10px] leading-tight text-center break-all">{name}</span>
                </button>
              ))}
            </div>
          </Spec>
        );
      })}
    </Section>
  );
}

// ── Animations ───────────────────────────────────────────────

const ANIMATIONS: [string, string][] = [
  ["animate-fade-up", "Page and element entrance — 30px rise"],
  ["animate-fade-in", "Plain opacity fade"],
  ["animate-shake", "Error feedback — one sharp wobble"],
  ["animate-scan-line", "OCR / scanning sweep"],
  ["page-enter", "Applied to every route's root element"],
];

function AnimationSection() {
  const [nonce, setNonce] = useState(0);

  return (
    <Section
      id="animations"
      title="Animations"
      note="Transform and opacity only. Replay to see each one from the start; the keyframes live at the top of globals.css."
    >
      <button type="button" onClick={() => setNonce((n) => n + 1)} className="btn-primary">
        <UiIcons.RefreshIcon className="w-5 h-5" />
        Replay all
      </button>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {ANIMATIONS.map(([cls, desc]) => (
          <div key={cls} className="border-2 border-foreground bg-card p-4 space-y-3 overflow-hidden">
            <div key={`${cls}-${nonce}`} className={`${cls} bg-primary text-primary-foreground p-3 font-bold text-sm`}>
              {cls.replace("animate-", "")}
            </div>
            <p className="font-mono text-[10px] font-bold">.{cls}</p>
            <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
          </div>
        ))}
      </div>
      <Spec label=".stagger-children — cascading list entrance">
        <div key={`stagger-${nonce}`} className="stagger-children grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="border-2 border-foreground bg-accent p-4 font-bold text-sm text-center">
              {i + 1}
            </div>
          ))}
        </div>
      </Spec>
      <Spec label="Drag-and-drop states — normally driven by pointer events">
        <div className="space-y-3">
          <div className="file-item drag-lifting">
            <div className="pdf-icon-box">
              <PdfIcons.PdfIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold">.drag-lifting</p>
              <p className="text-sm text-muted-foreground">The row being dragged</p>
            </div>
          </div>
          <div className="file-item drag-over-target">
            <div className="pdf-icon-box">
              <PdfIcons.PdfIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold">.drag-over-target</p>
              <p className="text-sm text-muted-foreground">The drop slot under the cursor</p>
            </div>
          </div>
          <div key={`settled-${nonce}`} className="file-item drag-settled">
            <div className="pdf-icon-box">
              <PdfIcons.PdfIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold">.drag-settled</p>
              <p className="text-sm text-muted-foreground">Lands after a successful drop</p>
            </div>
          </div>
        </div>
      </Spec>
      <Spec label="Spinners">
        <Frame className="flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-3">
            <UiIcons.LoaderIcon className="w-5 h-5" />
            <span className="text-sm text-muted-foreground">LoaderIcon</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Ring spinner</span>
          </div>
          <div className="flex items-center gap-3 bg-primary p-2">
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm text-primary-foreground">On primary</span>
          </div>
        </Frame>
      </Spec>
    </Section>
  );
}
