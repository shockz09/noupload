"use client";

import Link from "next/link";
import { type ComponentType, memo, useCallback, useMemo, useState } from "react";

interface Tool {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  category: string;
  colorClass: string;
}

interface ToolSearchProps {
  tools: Tool[];
  categoryLabels: Record<string, string>;
  placeholder?: string;
}

const SearchIcon = memo(function SearchIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
});

const ClearIcon = memo(function ClearIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
});

export const ToolSearch = memo(function ToolSearch({
  tools,
  categoryLabels,
  placeholder = "Search tools...",
}: ToolSearchProps) {
  const [query, setQuery] = useState("");

  const filteredTools = useMemo(() => {
    if (!query.trim()) return tools;

    const searchTerms = query.toLowerCase().trim().split(/\s+/);

    return tools.filter((tool) => {
      const searchableText = `${tool.title} ${tool.description} ${tool.category}`.toLowerCase();
      return searchTerms.every((term) => searchableText.includes(term));
    });
  }, [tools, query]);

  const handleClear = useCallback(() => {
    setQuery("");
  }, []);

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <SearchIcon className="w-5 h-5 text-muted-foreground" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-3 bg-background border-2 border-foreground text-foreground placeholder:text-muted-foreground font-medium !outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <ClearIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Results count when searching */}
      {query && (
        <p className="text-sm text-muted-foreground font-medium">
          {filteredTools.length === 0
            ? "No tools found"
            : `${filteredTools.length} tool${filteredTools.length === 1 ? "" : "s"} found`}
        </p>
      )}

      {/* Tools Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;

          return (
            <Link key={tool.href} href={tool.href}>
              <article className={`tool-card ${tool.colorClass} group h-full cursor-pointer`}>
                <span className="category-tag">{categoryLabels[tool.category] || tool.category}</span>

                <div className="space-y-4">
                  <div className="tool-icon">
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="space-y-2 pr-16">
                    <h3 className="text-xl font-bold text-foreground">{tool.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{tool.description}</p>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                    <span>Use tool</span>
                    <svg
                      aria-hidden="true"
                      className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    </div>
  );
});

export default ToolSearch;
