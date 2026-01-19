"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FileIcon } from "@/components/icons";

// Lazy load heavy dependencies (~5MB total)
const getMarked = async () => (await import("marked")).marked;
const getKatex = async () => (await import("katex")).default;
const getPdfLib = async () => import("pdf-lib");
const getDOMPurify = async () => (await import("dompurify")).default;
import {
	ErrorBox,
	ProgressBar,
	PdfPageHeader,
} from "@/components/pdf/shared";

const STORAGE_KEY = "markdown-to-pdf-draft";

// Sample markdown with math
const SAMPLE_MARKDOWN = `# Quick Start

Write **bold**, *italic*, and \`code\` easily.

## Math Support

Inline: $E = mc^2$ and $x^2 + y^2 = r^2$

Block math:
$$\\int_0^1 x^2 dx = \\frac{1}{3}$$

## Lists

- Item one
- Item two

1. First
2. Second

## Table

| Name | Value |
|------|-------|
| Pi | 3.14 |
| e | 2.72 |

> Start writing your document!
`;

// Theme configurations
type Theme = "light" | "sepia" | "dark";
const THEMES: { id: Theme; name: string; bg: string; text: string; accent: string }[] = [
	{ id: "light", name: "Light", bg: "#ffffff", text: "#1a1a1a", accent: "#6366f1" },
	{ id: "sepia", name: "Sepia", bg: "#f4ecd8", text: "#433422", accent: "#8b4513" },
	{ id: "dark", name: "Dark", bg: "#1a1a2e", text: "#e4e4e7", accent: "#818cf8" },
];

// Configure marked with custom renderer for math (async for lazy loading)
async function renderMarkdownWithMath(markdown: string): Promise<string> {
	const [katex, marked, DOMPurify] = await Promise.all([
		getKatex(),
		getMarked(),
		getDOMPurify(),
	]);

	// Process block math first ($$...$$)
	let processed = markdown.replace(
		/\$\$([\s\S]*?)\$\$/g,
		(_, math) => {
			try {
				return `<div class="math-block">${katex.renderToString(math.trim(), {
					displayMode: true,
					throwOnError: false,
				})}</div>`;
			} catch {
				return `<div class="math-error">Math error: ${math}</div>`;
			}
		}
	);

	// Process inline math ($...$) - be careful not to match $$ or escaped \$
	processed = processed.replace(
		/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g,
		(_, math) => {
			try {
				return katex.renderToString(math.trim(), {
					displayMode: false,
					throwOnError: false,
				});
			} catch {
				return `<span class="math-error">${math}</span>`;
			}
		}
	);

	// Render markdown
	const html = marked.parse(processed, { async: false }) as string;

	// Sanitize HTML to prevent XSS attacks
	// Allow KaTeX-specific elements and attributes
	const sanitized = DOMPurify.sanitize(html, {
		ADD_TAGS: ["semantics", "annotation", "mrow", "mi", "mo", "mn", "msup", "msub", "mfrac", "mspace", "mtext", "mover", "munder"],
		ADD_ATTR: ["xmlns", "encoding", "mathvariant", "stretchy", "fence", "separator", "accent", "accentunder"],
	});

	return sanitized;
}

// PDF generation styles with theme support
function getPdfStyles(theme: Theme, fontSize: number) {
	const themeConfig = THEMES.find(t => t.id === theme) || THEMES[0];

	return `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: ${fontSize}px;
    line-height: 1.7;
    color: ${themeConfig.text};
    background: ${themeConfig.bg};
    padding: 40px 50px;
    max-width: 800px;
    margin: 0 auto;
  }

  h1, h2, h3, h4, h5, h6 {
    font-weight: 600;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    line-height: 1.3;
  }

  h1 { font-size: 2em; border-bottom: 2px solid ${themeConfig.text}20; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid ${themeConfig.text}20; padding-bottom: 0.2em; }
  h3 { font-size: 1.25em; }

  p { margin: 1em 0; }

  a { color: ${themeConfig.accent}; text-decoration: none; }
  a:hover { text-decoration: underline; }

  code {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.9em;
    background: ${themeConfig.text}10;
    padding: 0.2em 0.4em;
    border-radius: 4px;
  }

  pre {
    background: ${theme === 'dark' ? '#0d0d1a' : '#1e1e1e'};
    color: #d4d4d4;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1em 0;
  }

  pre code {
    background: none;
    padding: 0;
    color: inherit;
  }

  blockquote {
    border-left: 4px solid ${themeConfig.accent};
    padding-left: 16px;
    margin: 1em 0;
    color: ${themeConfig.text}99;
    font-style: italic;
    background: ${themeConfig.text}08;
    padding: 12px 16px;
    border-radius: 0 8px 8px 0;
  }

  ul, ol {
    margin: 1em 0;
    padding-left: 2em;
  }

  li { margin: 0.3em 0; }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
  }

  th, td {
    border: 1px solid ${themeConfig.text}20;
    padding: 10px 14px;
    text-align: left;
  }

  th {
    background: ${themeConfig.text}08;
    font-weight: 600;
  }

  tr:nth-child(even) {
    background: ${themeConfig.text}05;
  }

  hr {
    border: none;
    border-top: 1px solid ${themeConfig.text}20;
    margin: 2em 0;
  }

  img {
    max-width: 100%;
    height: auto;
  }

  .math-block {
    display: flex;
    justify-content: center;
    margin: 1.5em 0;
    overflow-x: auto;
  }

  .math-error {
    color: #dc2626;
    background: #fef2f2;
    padding: 4px 8px;
    border-radius: 4px;
  }

  /* KaTeX specific */
  .katex { font-size: 1.1em; }
  .katex-display { margin: 1em 0; }
</style>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
`;
}

// Formatting toolbar button component
function ToolbarButton({
	onClick,
	title,
	children,
	active = false,
}: {
	onClick: () => void;
	title: string;
	children: React.ReactNode;
	active?: boolean;
}) {
	return (
		<button
			type="button"
			onMouseDown={(e) => e.preventDefault()} // Prevent focus loss from textarea
			onClick={onClick}
			title={title}
			className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded transition-colors ${
				active
					? "bg-primary/20 text-primary"
					: "hover:bg-muted text-foreground/70 hover:text-foreground"
			}`}
		>
			{children}
		</button>
	);
}

// Static data hoisted outside component to avoid recreation on each render
const SNIPPETS = [
	{ name: "Matrix", code: "$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$" },
	{ name: "Limit", code: "$$\\lim_{x \\to \\infty} f(x)$$" },
	{ name: "Derivative", code: "$$\\frac{d}{dx} f(x)$$" },
	{ name: "Integral", code: "$$\\int_{a}^{b} f(x) dx$$" },
	{ name: "Summation", code: "$$\\sum_{i=1}^{n} x_i$$" },
	{ name: "Table 3x3", code: "| Col 1 | Col 2 | Col 3 |\n|-------|-------|-------|\n| A1 | B1 | C1 |\n| A2 | B2 | C2 |\n| A3 | B3 | C3 |" },
	{ name: "Code JS", code: "```javascript\nfunction example() {\n  return 'Hello';\n}\n```" },
	{ name: "Code Python", code: "```python\ndef example():\n    return 'Hello'\n```" },
	{ name: "Checklist", code: "- [ ] Task 1\n- [ ] Task 2\n- [x] Completed" },
	{ name: "Image", code: "![Alt text](url)" },
] as const;

const EMOJIS = [
	{ category: "Reactions", items: ["👍", "👎", "👏", "🎉", "❤️", "🔥", "⭐", "💯", "✅", "❌", "⚠️", "💡"] },
	{ category: "Objects", items: ["📝", "📌", "📎", "📊", "📈", "📉", "💻", "📱", "🔗", "🔒", "🔑", "📁"] },
	{ category: "Arrows", items: ["➡️", "⬅️", "⬆️", "⬇️", "↗️", "↘️", "↙️", "↖️", "🔄", "🔃", "↩️", "↪️"] },
	{ category: "Symbols", items: ["ℹ️", "❓", "❗", "💬", "🏷️", "🎯", "🚀", "⚡", "🛠️", "⚙️", "🔧", "📋"] },
] as const;

export default function MarkdownToPdfPage() {
	const [markdown, setMarkdown] = useState("");
	const [docTitle, setDocTitle] = useState("Untitled Document");
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [showPreview, setShowPreview] = useState(true);
	const [theme, setTheme] = useState<Theme>("light");
	const [fontSize, setFontSize] = useState(14);
	const previewRef = useRef<HTMLIFrameElement>(null);
	const editorRef = useRef<HTMLTextAreaElement>(null);
	const settingsRef = useRef<HTMLDivElement>(null);
	const [renderedHtml, setRenderedHtml] = useState("");
	const [wordCount, setWordCount] = useState(0);
	const [charCount, setCharCount] = useState(0);
	const [lastSaved, setLastSaved] = useState<Date | null>(null);
	const [showSettings, setShowSettings] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [showSnippets, setShowSnippets] = useState(false);
	const [scrollSync, setScrollSync] = useState(true);
	const [readingTime, setReadingTime] = useState(0);
	const [history, setHistory] = useState<string[]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [isUndoRedo, setIsUndoRedo] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [lineCount, setLineCount] = useState(1);
	const [showLineNumbers, setShowLineNumbers] = useState(true);
	const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });
	const [showFindReplace, setShowFindReplace] = useState(false);
	const [findText, setFindText] = useState("");
	const [replaceText, setReplaceText] = useState("");
	const [findCount, setFindCount] = useState(0);
	const [wordWrap, setWordWrap] = useState(true);
	const [typewriterMode, setTypewriterMode] = useState(false);
	const [tableOfContents, setTableOfContents] = useState<{ level: number; text: string; line: number }[]>([]);
	const [showToc, setShowToc] = useState(false);
	const [showEmoji, setShowEmoji] = useState(false);
	const [showExport, setShowExport] = useState(false);
	const [saveAnimation, setSaveAnimation] = useState(false);
	const [wordGoal, setWordGoal] = useState<number | null>(null);
	const [showGoalInput, setShowGoalInput] = useState(false);
	const [savedSelection, setSavedSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
	const lineNumbersRef = useRef<HTMLDivElement>(null);
	const exportRef = useRef<HTMLDivElement>(null);
	const snippetsRef = useRef<HTMLDivElement>(null);
	const tocRef = useRef<HTMLDivElement>(null);
	const emojiRef = useRef<HTMLDivElement>(null);
	const findRef = useRef<HTMLDivElement>(null);

	// Load from localStorage on mount
	useEffect(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const data = JSON.parse(saved);
				if (data.markdown) setMarkdown(data.markdown);
				if (data.docTitle) setDocTitle(data.docTitle);
				if (data.theme) setTheme(data.theme);
				if (data.fontSize) setFontSize(data.fontSize);
				if (data.savedAt) setLastSaved(new Date(data.savedAt));
				if (typeof data.wordWrap === "boolean") setWordWrap(data.wordWrap);
				if (typeof data.typewriterMode === "boolean") setTypewriterMode(data.typewriterMode);
				if (typeof data.showLineNumbers === "boolean") setShowLineNumbers(data.showLineNumbers);
			} else {
				setMarkdown(SAMPLE_MARKDOWN);
			}
		} catch {
			setMarkdown(SAMPLE_MARKDOWN);
		}
	}, []);

	// Click outside to close dropdowns
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
				setShowSettings(false);
			}
			if (snippetsRef.current && !snippetsRef.current.contains(e.target as Node)) {
				setShowSnippets(false);
			}
			if (tocRef.current && !tocRef.current.contains(e.target as Node)) {
				setShowToc(false);
			}
			if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
				setShowEmoji(false);
			}
			if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
				setShowExport(false);
			}
			if (findRef.current && !findRef.current.contains(e.target as Node)) {
				setShowFindReplace(false);
			}
		};
		if (showSettings || showSnippets || showToc || showEmoji || showExport || showFindReplace) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [showSettings, showSnippets, showToc, showEmoji, showExport, showFindReplace]);

	// Extract table of contents from markdown
	useEffect(() => {
		const toc: { level: number; text: string; line: number }[] = [];
		const lines = markdown.split("\n");

		lines.forEach((line, index) => {
			const match = line.match(/^(#{1,6})\s+(.+)$/);
			if (match) {
				toc.push({
					level: match[1].length,
					text: match[2].replace(/[*_`]/g, ""),
					line: index + 1,
				});
			}
		});

		setTableOfContents(toc);
	}, [markdown]);

	// Escape key handlers
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (isFullscreen) setIsFullscreen(false);
				if (showSettings) setShowSettings(false);
				if (showSnippets) setShowSnippets(false);
				if (showToc) setShowToc(false);
				if (showFindReplace) setShowFindReplace(false);
				if (showEmoji) setShowEmoji(false);
				if (showExport) setShowExport(false);
			}
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isFullscreen, showSettings, showSnippets, showToc, showFindReplace, showEmoji, showExport]);

	// Scroll sync between editor and preview
	const handleEditorScroll = useCallback(() => {
		if (!scrollSync || !editorRef.current || !previewRef.current) return;
		const editor = editorRef.current;
		const preview = previewRef.current.contentDocument?.documentElement;
		if (!preview) return;

		const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
		const previewScrollTop = scrollPercentage * (preview.scrollHeight - preview.clientHeight);
		preview.scrollTop = previewScrollTop;
	}, [scrollSync]);

	// History management for undo/redo
	useEffect(() => {
		if (isUndoRedo) {
			setIsUndoRedo(false);
			return;
		}
		if (!markdown && history.length === 0) return;

		// Debounce history updates
		const timer = setTimeout(() => {
			setHistory((prev) => {
				const newHistory = prev.slice(0, historyIndex + 1);
				// Don't add if same as last entry
				if (newHistory[newHistory.length - 1] === markdown) return prev;
				const updated = [...newHistory, markdown].slice(-50); // Keep last 50 states
				setHistoryIndex(updated.length - 1);
				return updated;
			});
		}, 500);

		return () => clearTimeout(timer);
	}, [markdown]);

	const handleUndo = useCallback(() => {
		if (historyIndex > 0) {
			setIsUndoRedo(true);
			setHistoryIndex(historyIndex - 1);
			setMarkdown(history[historyIndex - 1]);
		}
	}, [history, historyIndex]);

	const handleRedo = useCallback(() => {
		if (historyIndex < history.length - 1) {
			setIsUndoRedo(true);
			setHistoryIndex(historyIndex + 1);
			setMarkdown(history[historyIndex + 1]);
		}
	}, [history, historyIndex]);

	// Autosave to localStorage
	useEffect(() => {
		if (!markdown) return;

		const timer = setTimeout(() => {
			try {
				const data = {
					markdown,
					docTitle,
					theme,
					fontSize,
					wordWrap,
					typewriterMode,
					showLineNumbers,
					savedAt: new Date().toISOString(),
				};
				localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
				setLastSaved(new Date());
				// Trigger save animation
				setSaveAnimation(true);
				setTimeout(() => setSaveAnimation(false), 1000);
			} catch {
				// Ignore storage errors
			}
		}, 1000);

		return () => clearTimeout(timer);
	}, [markdown, docTitle, theme, fontSize, wordWrap, typewriterMode, showLineNumbers]);

	// Update preview and counts when markdown changes
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const html = await renderMarkdownWithMath(markdown);
				if (cancelled) return;
				setRenderedHtml(html);

				// Count words and characters
				const text = markdown.replace(/[#*`[\]()>-]/g, "").trim();
				const words = text ? text.split(/\s+/).length : 0;
				setWordCount(words);
				setCharCount(markdown.length);
				// Average reading speed: 200 words per minute
				setReadingTime(Math.ceil(words / 200));
				// Count lines
				setLineCount(markdown.split("\n").length);
			} catch (err) {
				console.error("Render error:", err);
			}
		})();
		return () => { cancelled = true; };
	}, [markdown]);

	// Sync line numbers scroll with editor
	const handleEditorScrollWithLineNumbers = useCallback(() => {
		handleEditorScroll();
		if (lineNumbersRef.current && editorRef.current) {
			lineNumbersRef.current.scrollTop = editorRef.current.scrollTop;
		}
	}, [handleEditorScroll]);

	// Drag and drop handlers
	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		const files = e.dataTransfer.files;
		if (files.length > 0) {
			const file = files[0];
			if (file.type === "text/markdown" || file.name.match(/\.(md|markdown|txt)$/i)) {
				const reader = new FileReader();
				reader.onload = (ev) => {
					const content = ev.target?.result as string;
					setMarkdown(content);
					setDocTitle(file.name.replace(/\.(md|markdown|txt)$/i, ""));
					setError(null);
				};
				reader.onerror = () => setError("Failed to read file");
				reader.readAsText(file);
			} else {
				setError("Please drop a markdown file (.md, .markdown, or .txt)");
			}
		}
	}, []);

	// Update cursor position
	const updateCursorPosition = useCallback(() => {
		if (!editorRef.current) return;
		const textarea = editorRef.current;
		const text = textarea.value.substring(0, textarea.selectionStart);
		const lines = text.split("\n");
		const line = lines.length;
		const col = lines[lines.length - 1].length + 1;
		setCursorPosition({ line, col });
		// Always save selection for toolbar buttons
		setSavedSelection({
			start: textarea.selectionStart,
			end: textarea.selectionEnd,
		});
	}, []);

	// Find text matches
	useEffect(() => {
		if (!findText) {
			setFindCount(0);
			return;
		}
		const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
		const matches = markdown.match(regex);
		setFindCount(matches ? matches.length : 0);
	}, [findText, markdown]);

	// Find and replace functions
	const handleFindNext = useCallback(() => {
		if (!findText || !editorRef.current) return;
		const textarea = editorRef.current;
		const start = textarea.selectionEnd;
		const index = markdown.toLowerCase().indexOf(findText.toLowerCase(), start);
		if (index !== -1) {
			textarea.focus();
			textarea.setSelectionRange(index, index + findText.length);
		} else {
			// Wrap around to beginning
			const wrapIndex = markdown.toLowerCase().indexOf(findText.toLowerCase());
			if (wrapIndex !== -1) {
				textarea.focus();
				textarea.setSelectionRange(wrapIndex, wrapIndex + findText.length);
			}
		}
	}, [findText, markdown]);

	const handleReplace = useCallback(() => {
		if (!findText || !editorRef.current) return;
		const textarea = editorRef.current;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selectedText = markdown.substring(start, end);

		if (selectedText.toLowerCase() === findText.toLowerCase()) {
			const newMarkdown = markdown.substring(0, start) + replaceText + markdown.substring(end);
			setMarkdown(newMarkdown);
			setTimeout(() => {
				textarea.setSelectionRange(start, start + replaceText.length);
			}, 0);
		} else {
			handleFindNext();
		}
	}, [findText, replaceText, markdown, handleFindNext]);

	const handleReplaceAll = useCallback(() => {
		if (!findText) return;
		const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
		setMarkdown(markdown.replace(regex, replaceText));
	}, [findText, replaceText, markdown]);

	// Jump to a specific line in the editor
	const jumpToLine = useCallback((lineNumber: number) => {
		if (!editorRef.current) return;
		const textarea = editorRef.current;
		const lines = markdown.split("\n");
		let charIndex = 0;
		for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
			charIndex += lines[i].length + 1; // +1 for newline
		}
		textarea.focus();
		textarea.setSelectionRange(charIndex, charIndex);
		// Scroll to make the line visible
		const lineHeight = 26; // ~1.625rem
		const targetScroll = (lineNumber - 5) * lineHeight; // Show 5 lines above
		textarea.scrollTop = Math.max(0, targetScroll);
		setCursorPosition({ line: lineNumber, col: 1 });
		setShowToc(false);
	}, [markdown]);

	// Update iframe content
	useEffect(() => {
		if (previewRef.current && renderedHtml) {
			const doc = previewRef.current.contentDocument;
			if (doc) {
				doc.open();
				doc.write(`
					<!DOCTYPE html>
					<html>
					<head>
						<meta charset="utf-8">
						${getPdfStyles(theme, fontSize)}
					</head>
					<body>
						${renderedHtml}
					</body>
					</html>
				`);
				doc.close();
			}
		}
	}, [renderedHtml, theme, fontSize]);

	// Save selection when textarea loses focus (for toolbar buttons)
	const handleEditorBlur = useCallback(() => {
		if (editorRef.current) {
			setSavedSelection({
				start: editorRef.current.selectionStart,
				end: editorRef.current.selectionEnd,
			});
		}
	}, []);

	// Insert text at cursor position
	const insertAtCursor = useCallback((before: string, after: string = "") => {
		const textarea = editorRef.current;
		if (!textarea) return;

		// Always use saved selection (updated on every cursor move)
		const { start, end } = savedSelection;

		const selectedText = markdown.substring(start, end);
		const newText = markdown.substring(0, start) + before + selectedText + after + markdown.substring(end);

		setMarkdown(newText);

		// Restore focus and cursor position
		const newCursorPos = start + before.length + selectedText.length;
		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(newCursorPos, newCursorPos);
			// Update saved selection to new position
			setSavedSelection({ start: newCursorPos, end: newCursorPos });
		}, 0);
	}, [markdown, savedSelection]);

	// Formatting handlers
	const handleBold = useCallback(() => insertAtCursor("**", "**"), [insertAtCursor]);
	const handleItalic = useCallback(() => insertAtCursor("*", "*"), [insertAtCursor]);
	const handleCode = useCallback(() => insertAtCursor("`", "`"), [insertAtCursor]);
	const handleCodeBlock = () => insertAtCursor("\n```\n", "\n```\n");
	const handleLink = useCallback(() => insertAtCursor("[", "](url)"), [insertAtCursor]);
	const handleH1 = () => insertAtCursor("# ");
	const handleH2 = () => insertAtCursor("## ");
	const handleH3 = () => insertAtCursor("### ");
	const handleBulletList = () => insertAtCursor("- ");
	const handleNumberedList = () => insertAtCursor("1. ");
	const handleBlockquote = () => insertAtCursor("> ");
	const handleInlineMath = () => insertAtCursor("$", "$");
	const handleBlockMath = () => insertAtCursor("\n$$\n", "\n$$\n");
	const handleHorizontalRule = () => insertAtCursor("\n---\n");
	const handleTable = () => insertAtCursor("\n| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1 | Cell 2 |\n");
	const handleStrikethrough = useCallback(() => insertAtCursor("~~", "~~"), [insertAtCursor]);

	// Handle paste (including images from clipboard)
	const handlePaste = useCallback((e: React.ClipboardEvent) => {
		const items = e.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (item.type.startsWith("image/")) {
				e.preventDefault();
				const file = item.getAsFile();
				if (!file) continue;

				const reader = new FileReader();
				reader.onload = (ev) => {
					const dataUrl = ev.target?.result as string;
					// Insert markdown image syntax with data URL
					const imageMarkdown = `![Pasted image](${dataUrl})`;
					insertAtCursor(imageMarkdown);
				};
				reader.readAsDataURL(file);
				return;
			}
		}
	}, [insertAtCursor]);

	const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (ev) => {
			const content = ev.target?.result as string;
			setMarkdown(content);
			setDocTitle(file.name.replace(/\.(md|markdown|txt)$/i, ""));
			setError(null);
		};
		reader.onerror = () => setError("Failed to read file");
		reader.readAsText(file);
		e.target.value = "";
	}, []);

	const handleConvert = async () => {
		if (!markdown.trim()) {
			setError("Please enter some markdown content");
			return;
		}

		setIsProcessing(true);
		setProgress(10);
		setError(null);

		try {
			// Dynamically import html-to-image
			const { toPng } = await import("html-to-image");

			setProgress(20);

			// Render markdown with math
			const html = await renderMarkdownWithMath(markdown);
			const themeConfig = THEMES.find(t => t.id === theme) || THEMES[0];

			setProgress(30);

			// Create a hidden div for rendering (no external CSS to avoid CORS)
			const container = document.createElement("div");
			container.style.position = "absolute";
			container.style.left = "-9999px";
			container.style.top = "0";
			container.style.width = "800px";
			container.style.padding = "40px 50px";
			container.style.background = themeConfig.bg;
			container.style.color = themeConfig.text;
			container.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
			container.style.fontSize = `${fontSize}px`;
			container.style.lineHeight = "1.7";
			container.innerHTML = html;
			document.body.appendChild(container);

			// Apply inline styles for common elements
			const style = document.createElement("style");
			style.textContent = `
				h1, h2, h3, h4, h5, h6 { font-weight: 600; margin-top: 1.5em; margin-bottom: 0.5em; line-height: 1.3; }
				h1 { font-size: 2em; border-bottom: 2px solid ${themeConfig.text}20; padding-bottom: 0.3em; }
				h2 { font-size: 1.5em; border-bottom: 1px solid ${themeConfig.text}20; padding-bottom: 0.2em; }
				h3 { font-size: 1.25em; }
				p { margin: 1em 0; }
				a { color: ${themeConfig.accent}; }
				code { font-family: 'JetBrains Mono', monospace; font-size: 0.9em; background: ${themeConfig.text}10; padding: 0.2em 0.4em; border-radius: 4px; }
				pre { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 1em 0; }
				pre code { background: none; padding: 0; color: inherit; }
				blockquote { border-left: 4px solid ${themeConfig.accent}; padding-left: 16px; margin: 1em 0; color: ${themeConfig.text}99; font-style: italic; }
				ul, ol { margin: 1em 0; padding-left: 2em; }
				li { margin: 0.3em 0; }
				table { width: 100%; border-collapse: collapse; margin: 1em 0; }
				th, td { border: 1px solid ${themeConfig.text}20; padding: 10px 14px; text-align: left; }
				th { background: ${themeConfig.text}08; font-weight: 600; }
				hr { border: none; border-top: 1px solid ${themeConfig.text}20; margin: 2em 0; }
				.math-block { display: flex; justify-content: center; margin: 1.5em 0; }
				.katex { font-size: 1.1em; }
			`;
			container.appendChild(style);

			// Wait for content to render
			await new Promise(resolve => setTimeout(resolve, 300));

			setProgress(50);

			// Convert to image
			const dataUrl = await toPng(container, {
				quality: 1,
				pixelRatio: 2,
				backgroundColor: themeConfig.bg,
				skipAutoScale: true,
			});

			// Cleanup
			document.body.removeChild(container);

			setProgress(70);

			// Create PDF
			const { PDFDocument } = await getPdfLib();
			const pdfDoc = await PDFDocument.create();

			// Fetch the image data
			const imageResponse = await fetch(dataUrl);
			const imageBytes = await imageResponse.arrayBuffer();
			const pngImage = await pdfDoc.embedPng(imageBytes);

			// Calculate dimensions (A4-ish proportions)
			const pageWidth = 612; // Letter width in points
			const scale = pageWidth / pngImage.width;
			const pageHeight = pngImage.height * scale;

			// Add page with image
			const page = pdfDoc.addPage([pageWidth, pageHeight]);
			page.drawImage(pngImage, {
				x: 0,
				y: 0,
				width: pageWidth,
				height: pageHeight,
			});

			setProgress(90);

			// Save PDF
			const pdfBytes = await pdfDoc.save();
			const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });

			setProgress(100);

			// Download directly
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${docTitle.replace(/[^a-z0-9]/gi, "_")}.pdf`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Conversion failed");
		} finally {
			setIsProcessing(false);
		}
	};

	const handleClear = () => {
		setMarkdown("");
		setDocTitle("Untitled Document");
		setError(null);
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// Ignore
		}
	};

	const handleLoadSample = () => {
		setMarkdown(SAMPLE_MARKDOWN);
		setDocTitle("Mathematical Document");
		setError(null);
	};

	const handleDownloadMarkdown = () => {
		const blob = new Blob([markdown], { type: "text/markdown" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${docTitle.replace(/[^a-z0-9]/gi, "_")}.md`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleInsertSnippet = (code: string) => {
		insertAtCursor(code);
		setShowSnippets(false);
	};

	const handleInsertEmoji = (emoji: string) => {
		insertAtCursor(emoji);
		setShowEmoji(false);
	};

	// Auto-continue lists on Enter
	const handleListContinuation = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key !== "Enter") return false;

		const textarea = e.currentTarget;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		if (start !== end) return false; // Has selection

		// Get current line
		const textBefore = markdown.substring(0, start);
		const lastNewline = textBefore.lastIndexOf("\n");
		const currentLine = textBefore.substring(lastNewline + 1);

		// Check for bullet lists
		const bulletMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)$/);
		if (bulletMatch) {
			const [, indent, bullet, content] = bulletMatch;
			if (content.trim() === "") {
				// Empty bullet - remove it
				e.preventDefault();
				const newText = markdown.substring(0, start - currentLine.length) + markdown.substring(start);
				setMarkdown(newText);
				setTimeout(() => {
					textarea.setSelectionRange(start - currentLine.length, start - currentLine.length);
				}, 0);
				return true;
			}
			// Continue the list
			e.preventDefault();
			const newBullet = `\n${indent}${bullet} `;
			const newText = markdown.substring(0, start) + newBullet + markdown.substring(end);
			setMarkdown(newText);
			setTimeout(() => {
				textarea.setSelectionRange(start + newBullet.length, start + newBullet.length);
			}, 0);
			return true;
		}

		// Check for numbered lists
		const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
		if (numberedMatch) {
			const [, indent, num, content] = numberedMatch;
			if (content.trim() === "") {
				// Empty item - remove it
				e.preventDefault();
				const newText = markdown.substring(0, start - currentLine.length) + markdown.substring(start);
				setMarkdown(newText);
				setTimeout(() => {
					textarea.setSelectionRange(start - currentLine.length, start - currentLine.length);
				}, 0);
				return true;
			}
			// Continue with next number
			e.preventDefault();
			const nextNum = parseInt(num, 10) + 1;
			const newItem = `\n${indent}${nextNum}. `;
			const newText = markdown.substring(0, start) + newItem + markdown.substring(end);
			setMarkdown(newText);
			setTimeout(() => {
				textarea.setSelectionRange(start + newItem.length, start + newItem.length);
			}, 0);
			return true;
		}

		// Check for checkboxes
		const checkboxMatch = currentLine.match(/^(\s*)(-)\s+\[[ x]\]\s+(.*)$/);
		if (checkboxMatch) {
			const [, indent, , content] = checkboxMatch;
			if (content.trim() === "") {
				// Empty checkbox - remove it
				e.preventDefault();
				const newText = markdown.substring(0, start - currentLine.length) + markdown.substring(start);
				setMarkdown(newText);
				setTimeout(() => {
					textarea.setSelectionRange(start - currentLine.length, start - currentLine.length);
				}, 0);
				return true;
			}
			// Continue with new unchecked checkbox
			e.preventDefault();
			const newCheckbox = `\n${indent}- [ ] `;
			const newText = markdown.substring(0, start) + newCheckbox + markdown.substring(end);
			setMarkdown(newText);
			setTimeout(() => {
				textarea.setSelectionRange(start + newCheckbox.length, start + newCheckbox.length);
			}, 0);
			return true;
		}

		// Check for blockquotes
		const quoteMatch = currentLine.match(/^(\s*)(>+)\s*(.*)$/);
		if (quoteMatch) {
			const [, indent, quotes, content] = quoteMatch;
			if (content.trim() === "") {
				// Empty quote - end it
				e.preventDefault();
				const newText = markdown.substring(0, start - currentLine.length) + markdown.substring(start);
				setMarkdown(newText);
				setTimeout(() => {
					textarea.setSelectionRange(start - currentLine.length, start - currentLine.length);
				}, 0);
				return true;
			}
			// Continue quote
			e.preventDefault();
			const newQuote = `\n${indent}${quotes} `;
			const newText = markdown.substring(0, start) + newQuote + markdown.substring(end);
			setMarkdown(newText);
			setTimeout(() => {
				textarea.setSelectionRange(start + newQuote.length, start + newQuote.length);
			}, 0);
			return true;
		}

		return false;
	}, [markdown]);

	// Auto-pair brackets and quotes
	const handleAutoPair = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const textarea = e.currentTarget;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const hasSelection = start !== end;

		const pairs: { [key: string]: string } = {
			"(": ")",
			"[": "]",
			"{": "}",
			'"': '"',
			"'": "'",
			"`": "`",
			"$": "$",
		};

		const closingChars = Object.values(pairs);

		// If typing a closing character and it's already there, just move past it
		if (closingChars.includes(e.key) && markdown[start] === e.key && !hasSelection) {
			e.preventDefault();
			textarea.setSelectionRange(start + 1, start + 1);
			return true;
		}

		// Auto-pair opening characters
		if (pairs[e.key]) {
			e.preventDefault();
			const selectedText = markdown.substring(start, end);
			const newText = markdown.substring(0, start) + e.key + selectedText + pairs[e.key] + markdown.substring(end);
			setMarkdown(newText);
			setTimeout(() => {
				if (hasSelection) {
					textarea.setSelectionRange(start + 1, end + 1);
				} else {
					textarea.setSelectionRange(start + 1, start + 1);
				}
			}, 0);
			return true;
		}

		// Handle backspace: delete matching pairs
		if (e.key === "Backspace" && start === end && start > 0) {
			const charBefore = markdown[start - 1];
			const charAfter = markdown[start];
			if (pairs[charBefore] === charAfter) {
				e.preventDefault();
				const newText = markdown.substring(0, start - 1) + markdown.substring(start + 1);
				setMarkdown(newText);
				setTimeout(() => textarea.setSelectionRange(start - 1, start - 1), 0);
				return true;
			}
		}

		return false;
	}, [markdown]);

	// Handle keyboard shortcuts
	const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// Update cursor position on any key
		setTimeout(updateCursorPosition, 0);

		// Handle list continuation on Enter
		if (handleListContinuation(e)) {
			return;
		}

		// Handle auto-pairing first (if it handles the key, don't continue)
		if (handleAutoPair(e)) {
			return;
		}

		if (e.metaKey || e.ctrlKey) {
			switch (e.key) {
				case "b":
					e.preventDefault();
					handleBold();
					break;
				case "i":
					e.preventDefault();
					handleItalic();
					break;
				case "k":
					e.preventDefault();
					handleLink();
					break;
				case "e":
					e.preventDefault();
					handleCode();
					break;
				case "z":
					if (e.shiftKey) {
						e.preventDefault();
						handleRedo();
					} else {
						e.preventDefault();
						handleUndo();
					}
					break;
				case "y":
					e.preventDefault();
					handleRedo();
					break;
				case "f":
					e.preventDefault();
					setShowFindReplace(true);
					break;
				case "h":
					e.preventDefault();
					setShowFindReplace(true);
					break;
			}
		}
	}, [handleBold, handleItalic, handleLink, handleCode, handleUndo, handleRedo, updateCursorPosition]);

	// Fullscreen editor overlay
	if (isFullscreen) {
		return (
			<div className="fixed inset-0 z-50 bg-background flex flex-col">
				{/* Fullscreen Header */}
				<div className="flex items-center gap-3 px-4 py-3 border-b border-foreground/10 bg-card">
					<input
						type="text"
						value={docTitle}
						onChange={(e) => setDocTitle(e.target.value)}
						className="markdown-editor flex-1 text-lg font-semibold bg-transparent"
						placeholder="Document Title"
					/>
					<span className="text-xs text-muted-foreground">
						{wordCount} words · {readingTime} min read
					</span>
					{lastSaved && (
						<span className="text-xs text-muted-foreground">
							Saved {lastSaved.toLocaleTimeString()}
						</span>
					)}
					<button
						type="button"
						onClick={() => setIsFullscreen(false)}
						className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-muted hover:bg-muted/80 rounded transition-colors"
					>
						<svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
						Exit (Esc)
					</button>
				</div>

				{/* Fullscreen Editor */}
				<textarea
					ref={editorRef}
					value={markdown}
					onChange={(e) => {
						setMarkdown(e.target.value);
						// Typewriter mode: keep cursor in center
						if (typewriterMode && editorRef.current) {
							const textarea = editorRef.current;
							const lineHeight = 26;
							const centerOffset = textarea.clientHeight / 2 - lineHeight;
							const lines = e.target.value.substring(0, e.target.selectionStart).split("\n").length;
							textarea.scrollTop = Math.max(0, lines * lineHeight - centerOffset);
						}
					}}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					onBlur={handleEditorBlur}
					className="markdown-editor flex-1 p-6 font-mono text-base bg-transparent resize-none leading-relaxed"
					style={{
						whiteSpace: wordWrap ? "pre-wrap" : "pre",
						overflowWrap: wordWrap ? "break-word" : "normal",
						overflowX: wordWrap ? "hidden" : "auto",
					}}
					placeholder="Start writing..."
					spellCheck={false}
					autoFocus
				/>
			</div>
		);
	}

	return (
		<main className="container py-8 max-w-7xl">
			<PdfPageHeader
				icon={<FileIcon className="w-6 h-6" />}
				iconClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
				title="Markdown to PDF"
				description="Convert Markdown with math equations (LaTeX) to PDF"
			/>

			<div className="mt-8 space-y-4">
				{/* Document Title */}
				<div className="flex items-center gap-3">
					<input
						type="text"
						value={docTitle}
						onChange={(e) => setDocTitle(e.target.value)}
						className="markdown-editor flex-1 text-xl font-semibold bg-transparent border-b border-transparent hover:border-foreground/20 focus:border-foreground/40 px-1 py-1 transition-colors"
						placeholder="Document Title"
					/>
					{lastSaved && (
						<span className={`text-xs hidden sm:flex items-center gap-1 transition-colors duration-300 ${saveAnimation ? "text-green-500" : "text-muted-foreground"}`}>
							{saveAnimation && (
								<svg aria-hidden="true" className="w-3 h-3 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
									<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
								</svg>
							)}
							{saveAnimation ? "Saved!" : `Saved ${lastSaved.toLocaleTimeString()}`}
						</span>
					)}
				</div>

				{/* Top Toolbar */}
				<div className="flex flex-wrap items-center gap-2 p-3 bg-card border border-foreground/10 rounded-lg">
					<label className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-muted hover:bg-muted/80 rounded cursor-pointer transition-colors">
						<svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
						</svg>
						<input
							type="file"
							accept=".md,.markdown,.txt"
							onChange={handleFileUpload}
							className="hidden"
						/>
						<span className="hidden sm:inline">Upload</span>
					</label>
					{/* Export Dropdown */}
					<div className="relative" ref={exportRef}>
						<button
							type="button"
							onClick={() => setShowExport(!showExport)}
							disabled={!markdown.trim()}
							className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
								showExport ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"
							}`}
							title="Export options"
						>
							<svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
							</svg>
							<span className="hidden sm:inline">Export</span>
							<svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
							</svg>
						</button>

						{showExport && (
							<div className="absolute top-full left-0 mt-2 p-2 bg-card border border-foreground/10 rounded-lg shadow-xl z-[100] w-40">
								<button
									type="button"
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => {
										handleConvert();
										setShowExport(false);
									}}
									className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors text-left"
								>
									<svg aria-hidden="true" className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
									</svg>
									PDF
								</button>
								<button
									type="button"
									onMouseDown={(e) => e.preventDefault()}
									onClick={async () => {
										const html = await renderMarkdownWithMath(markdown);
										const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title>${getPdfStyles(theme, fontSize)}</head><body>${html}</body></html>`;
										const blob = new Blob([fullHtml], { type: "text/html" });
										const url = URL.createObjectURL(blob);
										const a = document.createElement("a");
										a.href = url;
										a.download = `${docTitle.replace(/[^a-z0-9]/gi, "_")}.html`;
										a.click();
										URL.revokeObjectURL(url);
										setShowExport(false);
									}}
									className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors text-left"
								>
									<svg aria-hidden="true" className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
									</svg>
									HTML
								</button>
								<button
									type="button"
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => {
										handleDownloadMarkdown();
										setShowExport(false);
									}}
									className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors text-left"
								>
									<svg aria-hidden="true" className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
									Markdown
								</button>
							</div>
						)}
					</div>
					<button
						type="button"
						onClick={handleLoadSample}
						className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-muted hover:bg-muted/80 rounded transition-colors"
					>
						<svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						<span className="hidden sm:inline">Sample</span>
					</button>
					<button
						type="button"
						onClick={handleClear}
						className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-muted hover:bg-muted/80 rounded transition-colors"
					>
						<svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
						<span className="hidden sm:inline">Clear</span>
					</button>

					<div className="w-px h-6 bg-foreground/10 mx-1 hidden sm:block" />

					{/* Settings Button */}
					<div className="relative" ref={settingsRef}>
						<button
							type="button"
							onClick={() => setShowSettings(!showSettings)}
							className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
								showSettings ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"
							}`}
						>
							<svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							<span className="hidden sm:inline">Style</span>
						</button>

						{showSettings && (
							<div className="absolute top-full left-0 mt-2 p-4 bg-card border-2 border-foreground/10 rounded-lg shadow-lg z-50 w-64">
								<div className="space-y-4">
									{/* Theme */}
									<fieldset>
										<legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
											Theme
										</legend>
										<div className="flex gap-2" role="group">
											{THEMES.map((t) => (
												<button
													key={t.id}
													type="button"
													onClick={() => setTheme(t.id)}
													className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-all ${
														theme === t.id
															? "ring-2 ring-primary ring-offset-2"
															: "hover:bg-muted"
													}`}
													style={{ background: t.bg, color: t.text }}
												>
													{t.name}
												</button>
											))}
										</div>
									</fieldset>

									{/* Font Size */}
									<div>
										<label
											htmlFor="font-size-slider"
											className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block"
										>
											Font Size: {fontSize}px
										</label>
										<input
											id="font-size-slider"
											type="range"
											min="12"
											max="18"
											value={fontSize}
											onChange={(e) => setFontSize(Number(e.target.value))}
											className="w-full accent-primary"
										/>
										<div className="flex justify-between text-xs text-muted-foreground mt-1">
											<span>Small</span>
											<span>Large</span>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Fullscreen Button */}
					<button
						type="button"
						onClick={() => setIsFullscreen(true)}
						className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-muted hover:bg-muted/80 rounded transition-colors"
						title="Focus mode"
					>
						<svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
						</svg>
						<span className="hidden lg:inline">Focus</span>
					</button>

					<div className="flex-1" />

					<span className="text-xs text-muted-foreground hidden md:block">
						{wordCount} words · {charCount} chars · {readingTime} min read
					</span>

					<div className="w-px h-6 bg-foreground/10 mx-1 hidden sm:block" />

					<label className="flex items-center gap-2 text-sm cursor-pointer select-none">
						<div className={`relative w-10 h-5 rounded-full transition-colors ${showPreview ? "bg-primary" : "bg-muted"}`}>
							<div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showPreview ? "translate-x-5" : "translate-x-0.5"}`} />
							<input
								type="checkbox"
								checked={showPreview}
								onChange={(e) => setShowPreview(e.target.checked)}
								className="sr-only"
							/>
						</div>
						<span className="text-muted-foreground hidden sm:inline">Preview</span>
					</label>
				</div>

				{/* Editor and Preview */}
				<div className={`grid gap-4 overflow-hidden ${showPreview ? "lg:grid-cols-2" : ""}`} style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
					{/* Editor Panel */}
					<div className="flex flex-col border border-foreground/10 rounded-lg bg-card focus-within:outline-none h-full min-h-0 overflow-hidden" style={{ outline: "none" }}>
						{/* Formatting Toolbar */}
						<div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-foreground/10 bg-muted/30">
							{/* Undo/Redo */}
							<ToolbarButton onClick={handleUndo} title="Undo (Ctrl+Z)">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
								</svg>
							</ToolbarButton>
							<ToolbarButton onClick={handleRedo} title="Redo (Ctrl+Y)">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4" />
								</svg>
							</ToolbarButton>

							<div className="w-px h-5 bg-foreground/10 mx-1 shrink-0" />

							{/* Text formatting */}
							<ToolbarButton onClick={handleBold} title="Bold (Ctrl+B)">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
								</svg>
							</ToolbarButton>
							<ToolbarButton onClick={handleItalic} title="Italic (Ctrl+I)">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
								</svg>
							</ToolbarButton>
							<ToolbarButton onClick={handleCode} title="Inline Code (Ctrl+E)">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>
								</svg>
							</ToolbarButton>
							<ToolbarButton onClick={handleStrikethrough} title="Strikethrough">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/>
								</svg>
							</ToolbarButton>

							<div className="w-px h-5 bg-foreground/10 mx-1 shrink-0" />

							{/* Headers */}
							<ToolbarButton onClick={handleH1} title="Heading 1">
								<span className="text-xs font-bold">H1</span>
							</ToolbarButton>
							<ToolbarButton onClick={handleH2} title="Heading 2">
								<span className="text-xs font-bold">H2</span>
							</ToolbarButton>
							<ToolbarButton onClick={handleH3} title="Heading 3">
								<span className="text-xs font-bold">H3</span>
							</ToolbarButton>

							<div className="w-px h-5 bg-foreground/10 mx-1 shrink-0" />

							{/* Lists */}
							<ToolbarButton onClick={handleBulletList} title="Bullet List">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
								</svg>
							</ToolbarButton>
							<ToolbarButton onClick={handleNumberedList} title="Numbered List">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
								</svg>
							</ToolbarButton>
							<ToolbarButton onClick={handleBlockquote} title="Blockquote">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
								</svg>
							</ToolbarButton>

							<div className="w-px h-5 bg-foreground/10 mx-1 shrink-0" />

							{/* Math */}
							<ToolbarButton onClick={handleInlineMath} title="Inline Math ($...$)">
								<span className="text-xs font-mono">∑</span>
							</ToolbarButton>
							<ToolbarButton onClick={handleBlockMath} title="Block Math ($$...$$)">
								<span className="text-xs font-mono">∫</span>
							</ToolbarButton>

							<ToolbarButton onClick={handleLink} title="Link (Ctrl+K)">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
									<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
								</svg>
							</ToolbarButton>
							<ToolbarButton onClick={handleCodeBlock} title="Code Block">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<rect x="3" y="3" width="18" height="18" rx="2"/>
									<path d="M7 8l4 4-4 4M13 16h4"/>
								</svg>
							</ToolbarButton>
							<ToolbarButton onClick={handleTable} title="Table">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<rect x="3" y="3" width="18" height="18" rx="2"/>
									<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
								</svg>
							</ToolbarButton>
							<ToolbarButton onClick={handleHorizontalRule} title="Horizontal Rule">
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M3 12h18"/>
								</svg>
							</ToolbarButton>

							<div className="w-px h-5 bg-foreground/10 mx-1 shrink-0" />

							{/* Snippets Dropdown */}
							<div className="relative" ref={snippetsRef}>
								<ToolbarButton
									onClick={() => setShowSnippets(!showSnippets)}
									title="Insert Snippet"
									active={showSnippets}
								>
									<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
										<path d="M14 2v6h6M12 18v-6M9 15h6" />
									</svg>
								</ToolbarButton>

								{showSnippets && (
									<div className="absolute top-full left-0 mt-2 p-2 bg-card border border-foreground/10 rounded-lg shadow-xl z-[100] w-48">
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 mb-1">
											Snippets
										</div>
										{SNIPPETS.map((snippet) => (
											<button
												key={snippet.name}
												type="button"
												onMouseDown={(e) => e.preventDefault()}
												onClick={() => handleInsertSnippet(snippet.code)}
												className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
											>
												{snippet.name}
											</button>
										))}
									</div>
								)}
							</div>

							{/* Emoji Picker */}
							<div className="relative" ref={emojiRef}>
								<ToolbarButton
									onClick={() => setShowEmoji(!showEmoji)}
									title="Insert Emoji"
									active={showEmoji}
								>
									<span className="text-base">😀</span>
								</ToolbarButton>

								{showEmoji && (
									<div className="absolute top-full left-0 mt-2 p-2 bg-card border border-foreground/10 rounded-lg shadow-xl z-[100] w-64 max-h-72 overflow-y-auto">
										{EMOJIS.map((group) => (
											<div key={group.category} className="mb-2">
												<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 py-1">
													{group.category}
												</div>
												<div className="grid grid-cols-6 gap-1">
													{group.items.map((emoji) => (
														<button
															key={emoji}
															type="button"
															onMouseDown={(e) => e.preventDefault()}
															onClick={() => handleInsertEmoji(emoji)}
															className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors text-lg"
														>
															{emoji}
														</button>
													))}
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							<div className="w-px h-5 bg-foreground/10 mx-1 shrink-0" />

							{/* Line numbers toggle */}
							<ToolbarButton
								onClick={() => setShowLineNumbers(!showLineNumbers)}
								title="Toggle Line Numbers"
								active={showLineNumbers}
							>
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M3 5h2M3 12h2M3 19h2M9 5h12M9 12h12M9 19h12" />
								</svg>
							</ToolbarButton>

							<div className="w-px h-5 bg-foreground/10 mx-1 shrink-0" />

							{/* Find/Replace */}
							<div className="relative" ref={findRef}>
								<ToolbarButton
									onClick={() => setShowFindReplace(!showFindReplace)}
									title="Find & Replace (Ctrl+F)"
									active={showFindReplace}
								>
									<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<circle cx="11" cy="11" r="8" />
										<path d="M21 21l-4.35-4.35" />
									</svg>
								</ToolbarButton>

								{showFindReplace && (
									<div className="absolute top-full right-0 mt-2 p-3 bg-card border border-foreground/10 rounded-lg shadow-xl z-[100] w-64">
										<div className="space-y-2">
											<div>
												<input
													type="text"
													value={findText}
													onChange={(e) => setFindText(e.target.value)}
													onKeyDown={(e) => e.key === "Enter" && handleFindNext()}
													placeholder="Find..."
													className="w-full px-2 py-1.5 text-sm bg-background border border-foreground/20 rounded focus:outline-none focus:border-primary"
													autoFocus
												/>
												{findText && (
													<span className="text-xs text-muted-foreground mt-1 block">
														{findCount} found
													</span>
												)}
											</div>
											<input
												type="text"
												value={replaceText}
												onChange={(e) => setReplaceText(e.target.value)}
												onKeyDown={(e) => e.key === "Enter" && handleReplace()}
												placeholder="Replace..."
												className="w-full px-2 py-1.5 text-sm bg-background border border-foreground/20 rounded focus:outline-none focus:border-primary"
											/>
											<div className="flex gap-1">
												<button
													type="button"
													onMouseDown={(e) => e.preventDefault()}
													onClick={handleFindNext}
													disabled={!findText}
													className="flex-1 px-2 py-1 text-xs font-medium bg-muted hover:bg-muted/80 rounded disabled:opacity-50 transition-colors"
												>
													Next
												</button>
												<button
													type="button"
													onMouseDown={(e) => e.preventDefault()}
													onClick={handleReplace}
													disabled={!findText}
													className="flex-1 px-2 py-1 text-xs font-medium bg-muted hover:bg-muted/80 rounded disabled:opacity-50 transition-colors"
												>
													Replace
												</button>
												<button
													type="button"
													onMouseDown={(e) => e.preventDefault()}
													onClick={handleReplaceAll}
													disabled={!findText}
													className="flex-1 px-2 py-1 text-xs font-medium bg-muted hover:bg-muted/80 rounded disabled:opacity-50 transition-colors"
												>
													All
												</button>
											</div>
										</div>
									</div>
								)}
							</div>

							<div className="w-px h-5 bg-foreground/10 mx-1 shrink-0" />

							{/* Word Wrap Toggle */}
							<ToolbarButton
								onClick={() => setWordWrap(!wordWrap)}
								title={wordWrap ? "Disable Word Wrap" : "Enable Word Wrap"}
								active={wordWrap}
							>
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M3 6h18M3 12h15a3 3 0 110 6h-4m0 0l2-2m-2 2l2 2M3 18h7" />
								</svg>
							</ToolbarButton>

							{/* Typewriter Mode Toggle */}
							<ToolbarButton
								onClick={() => setTypewriterMode(!typewriterMode)}
								title={typewriterMode ? "Disable Typewriter Mode" : "Enable Typewriter Mode"}
								active={typewriterMode}
							>
								<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<rect x="2" y="4" width="20" height="16" rx="2" />
									<path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h8M6 16h12" />
								</svg>
							</ToolbarButton>

							{/* Table of Contents */}
							<div className="relative" ref={tocRef}>
								<ToolbarButton
									onClick={() => setShowToc(!showToc)}
									title="Table of Contents"
									active={showToc}
								>
									<svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M4 6h16M4 10h16M4 14h10M4 18h10" />
									</svg>
								</ToolbarButton>

								{showToc && (
									<div className="absolute top-full right-0 mt-2 p-2 bg-card border border-foreground/10 rounded-lg shadow-xl z-[100] w-64 max-h-80 overflow-y-auto">
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 mb-1">
											Table of Contents
										</div>
										{tableOfContents.length === 0 ? (
											<div className="px-2 py-3 text-sm text-muted-foreground text-center">
												No headings found
											</div>
										) : (
											tableOfContents.map((item, index) => (
												<button
													key={index}
													type="button"
													onMouseDown={(e) => e.preventDefault()}
													onClick={() => jumpToLine(item.line)}
													className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors truncate"
													style={{ paddingLeft: `${8 + (item.level - 1) * 12}px` }}
												>
													<span className="text-muted-foreground mr-1.5">
														{"#".repeat(item.level)}
													</span>
													{item.text}
												</button>
											))
										)}
									</div>
								)}
							</div>
						</div>


						{/* Editor with Line Numbers */}
						<div
							className={`relative flex flex-1 min-h-0 overflow-hidden ${isDragging ? "ring-2 ring-primary ring-inset bg-primary/5" : ""} focus-within:outline-none`}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
						>
							{/* Drag overlay */}
							{isDragging && (
								<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 pointer-events-none">
									<div className="flex flex-col items-center gap-2 text-primary">
										<svg aria-hidden="true" className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
										</svg>
										<span className="font-medium">Drop markdown file here</span>
									</div>
								</div>
							)}

							{/* Line numbers */}
							{showLineNumbers && (
								<div
									ref={lineNumbersRef}
									className="w-10 shrink-0 py-4 pr-2 text-right font-mono text-xs text-muted-foreground/50 select-none overflow-hidden"
									style={{ lineHeight: "1.625rem" }}
								>
									{Array.from({ length: lineCount }, (_, i) => (
										<div key={i + 1}>{i + 1}</div>
									))}
								</div>
							)}

							{/* Editor */}
							<textarea
								ref={editorRef}
								value={markdown}
								onChange={(e) => {
									setMarkdown(e.target.value);
									setTimeout(updateCursorPosition, 0);
									// Typewriter mode: keep cursor in center
									if (typewriterMode && editorRef.current) {
										const textarea = editorRef.current;
										const lineHeight = 26;
										const centerOffset = textarea.clientHeight / 2 - lineHeight;
										const lines = e.target.value.substring(0, e.target.selectionStart).split("\n").length;
										textarea.scrollTop = Math.max(0, lines * lineHeight - centerOffset);
									}
								}}
								onKeyDown={handleKeyDown}
								onKeyUp={updateCursorPosition}
								onClick={updateCursorPosition}
								onSelect={updateCursorPosition}
								onScroll={handleEditorScrollWithLineNumbers}
								onPaste={handlePaste}
								onBlur={handleEditorBlur}
								className={`markdown-editor flex-1 h-full p-4 ${showLineNumbers ? "pl-3" : ""} font-mono text-sm bg-transparent resize-none overflow-y-auto`}
								style={{
									lineHeight: "1.625rem",
									whiteSpace: wordWrap ? "pre-wrap" : "pre",
									overflowWrap: wordWrap ? "break-word" : "normal",
									overflowX: wordWrap ? "hidden" : "auto",
									scrollbarWidth: "thin",
									scrollbarColor: "transparent transparent",
									outline: "0",
									border: "0",
									boxShadow: "none",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.scrollbarColor = "rgba(0,0,0,0.2) transparent";
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.scrollbarColor = "transparent transparent";
								}}
								placeholder="Start writing your markdown here...

# Heading
**Bold** and *italic* text
$E = mc^2$ for inline math
$$\int_0^1 x^2 dx$$ for block math"
								spellCheck={false}
							/>
						</div>

						{/* Status bar with cursor position */}
						<div className="flex items-center justify-between px-3 py-1.5 border-t border-foreground/10 text-xs text-muted-foreground bg-muted/20 gap-3">
							<div className="flex items-center gap-3 flex-1">
								<span className="hidden sm:block">
									{wordCount} words · {charCount} chars · {readingTime} min read
								</span>
								<span className="sm:hidden">
									{wordCount}w · {charCount}c
								</span>
								{/* Word Goal */}
								{wordGoal ? (
									<div className="hidden sm:flex items-center gap-1.5">
										<div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
											<div
												className={`h-full rounded-full transition-all ${
													wordCount >= wordGoal ? "bg-green-500" : "bg-primary"
												}`}
												style={{ width: `${Math.min(100, (wordCount / wordGoal) * 100)}%` }}
											/>
										</div>
										<span className={wordCount >= wordGoal ? "text-green-500 font-medium" : ""}>
											{wordCount}/{wordGoal}
											{wordCount >= wordGoal && " ✓"}
										</span>
										<button
											type="button"
											onClick={() => setWordGoal(null)}
											className="hover:text-foreground"
											title="Clear goal"
										>
											×
										</button>
									</div>
								) : (
									<button
										type="button"
										onClick={() => setShowGoalInput(true)}
										className="hidden sm:inline-flex items-center hover:text-foreground transition-colors whitespace-nowrap"
										title="Set word goal"
									>
										+&nbsp;Goal
									</button>
								)}
								{showGoalInput && !wordGoal && (
									<div className="hidden sm:flex items-center gap-1">
										<input
											type="number"
											placeholder="Words"
											className="w-16 px-1.5 py-0.5 text-xs bg-background border border-foreground/20 rounded focus:outline-none focus:border-primary"
											min="1"
											autoFocus
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													const target = e.target as HTMLInputElement;
													const goal = parseInt(target.value, 10);
													if (goal > 0) {
														setWordGoal(goal);
														setShowGoalInput(false);
													}
												}
												if (e.key === "Escape") {
													setShowGoalInput(false);
												}
											}}
											onBlur={() => setShowGoalInput(false)}
										/>
									</div>
								)}
							</div>
							<div className="flex items-center gap-3">
								<span className="font-mono">
									Ln {cursorPosition.line}, Col {cursorPosition.col}
								</span>
							</div>
						</div>
					</div>

					{/* Preview Panel */}
					{showPreview && (
						<div className="flex flex-col border border-foreground/10 rounded-lg overflow-hidden h-full min-h-0">
							<div className="flex items-center gap-2 px-3 py-2 border-b border-foreground/10 bg-muted/30">
								<svg aria-hidden="true" className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
								<span className="text-sm font-medium text-muted-foreground">Live Preview</span>
								<div className="flex items-center gap-2 ml-auto">
									<button
										type="button"
										onClick={() => setScrollSync(!scrollSync)}
										className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
											scrollSync
												? "bg-primary/10 text-primary"
												: "text-muted-foreground hover:bg-muted"
										}`}
										title="Sync scrolling between editor and preview"
									>
										<svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
											<path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
										</svg>
										Sync
									</button>
									<span className="text-xs text-muted-foreground capitalize">{theme} · {fontSize}px</span>
								</div>
							</div>
							<div className="flex-1 min-h-0 overflow-hidden" style={{ background: THEMES.find(t => t.id === theme)?.bg }}>
								<iframe
									ref={previewRef}
									className="w-full h-full"
									title="Preview"
									sandbox="allow-same-origin"
								/>
							</div>
						</div>
					)}
				</div>

				{/* Error */}
				{error && <ErrorBox message={error} />}

				{/* Progress */}
				{isProcessing && <ProgressBar progress={progress} label="Converting..." />}

			</div>
		</main>
	);
}
