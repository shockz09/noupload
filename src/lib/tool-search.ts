/**
 * Intent-aware tool search.
 *
 * Three layers on top of plain keyword matching:
 *  1. Conversion intent: "mp4 to mp3" parses to (video, mp4) -> (audio, mp3)
 *     and ranks converters whose declared io (from/to formats) covers it.
 *  2. Synonym expansion: "rip" ~ "extract", "shrink" ~ "compress", etc.
 *  3. Trigram fuzzy fallback when nothing matches (typos still land).
 *
 * Everything here is deterministic, synchronous and client-side.
 */

export interface ToolIO {
  /** Input formats the tool accepts, e.g. ["mp4", "mov", "mkv"] */
  from: string[];
  /** Output formats the tool produces, e.g. ["mp3", "wav", "m4a"] */
  to: string[];
}

export interface SearchableTool {
  title: string;
  description: string;
  href: string;
  category: string;
  keywords?: string[];
  io?: ToolIO;
}

/** Query shapes that mean "convert X to Y". */
const CONVERT_RE = /^(.+?)\s*(?:→|->|=>|to|2|into|as)\s*(.+)$/;

/**
 * Format token -> semantic family. Tokens listed under a family are treated
 * as equivalent when matching io declarations. Family names themselves
 * ("video", "audio", ...) are valid tokens so "video to audio" works too.
 */
const FORMAT_FAMILIES: Record<string, string[]> = {
  image: [
    "image",
    "images",
    "photo",
    "picture",
    "img",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "svg",
    "heic",
    "heif",
    "avif",
    "bmp",
    "tiff",
    "ico",
  ],
  video: ["video", "videos", "movie", "clip", "mp4", "mov", "mkv", "avi", "webm", "flv", "wmv", "m4v"],
  audio: ["audio", "sound", "song", "music", "track", "mp3", "wav", "ogg", "m4a", "aac", "flac", "opus", "wma"],
  document: ["document", "doc", "docx", "pdf", "word", "odt", "rtf"],
  text: ["text", "txt", "plain text", "subtitle", "srt"],
  markdown: ["markdown", "md", "latex", "math"],
  web: ["webpage", "website", "web", "html", "url"],
  slides: ["slides", "powerpoint", "ppt", "pptx", "presentation"],
  spreadsheet: ["spreadsheet", "excel", "xls", "xlsx", "csv", "ods"],
  ebook: ["ebook", "epub", "kindle"],
  archiveformat: ["pdfa", "pdf/a", "archival"],
};

/** token -> family, with family names self-referencing. */
const TOKEN_FAMILY: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [family, tokens] of Object.entries(FORMAT_FAMILIES)) {
    m[family] = family;
    for (const t of tokens) m[t] = family;
  }
  return m;
})();

function familyOf(token: string): string | undefined {
  return TOKEN_FAMILY[token.toLowerCase().replace(/^\./, "").trim()];
}

/** User word -> extra words that should also count as matches. */
const SYNONYMS: Record<string, string[]> = {
  rip: ["extract", "pull", "get"],
  mute: ["remove audio", "silent", "no sound"],
  shrink: ["compress", "smaller", "reduce"],
  optimize: ["compress", "reduce"],
  louder: ["volume", "boost", "amplify"],
  quieter: ["volume", "reduce"],
  combine: ["merge", "join"],
  concatenate: ["merge", "join"],
  cut: ["trim", "clip"],
  searchable: ["ocr"],
  stamp: ["watermark"],
  kindle: ["epub", "ebook"],
  ebook: ["epub"],
  anonymity: ["sanitize"],
  redact: ["sanitize", "blur"],
  censor: ["blur", "pixelate"],
  caption: ["watermark", "subtitle"],
  signature: ["sign"],
  esign: ["sign"],
  screenshot: ["capture"],
  background: ["remove-bg", "transparent"],
  read: ["extract", "ocr"],
};

/**
 * Words ignored when matching terms: filler and number words that would
 * otherwise fluke-match text somewhere on an unrelated card.
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "my",
  "me",
  "for",
  "of",
  "from",
  "into",
  "with",
  "and",
  "to",
  "two",
  "three",
  "four",
  "five",
  "part",
]);

/** Verbs people prefix to conversion queries ("change mp4 to mp3"). */
const LEADING_VERBS =
  /^(?:convert|change|turn|transform|make|create|generate|get|produce|export|save|switch)\s+(?=.+\s)/;

/**
 * Suite nouns steer results toward the matching tool family: "black and
 * white photo" should prefer an image tool over the PDF one.
 */
const SUITE_HINTS: Array<[string[], string]> = [
  [["photo", "image", "picture", "png", "jpg", "jpeg", "heic", "heif", "webp", "avif"], "/image/"],
  [["video", "movie", "clip", "mp4", "mov", "mkv", "webm"], "/video/"],
  [["audio", "song", "sound", "music", "mp3", "wav", "flac"], "/audio/"],
  [["qr", "barcode"], "/qr/"],
];

function normalize(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

export interface ConvertIntent {
  fromFamily: string;
  toFamily: string;
  /** original normalized tokens, e.g. "mp4", "mp3" */
  fromToken: string;
  toToken: string;
}

/**
 * Short terms ("pdf", "gif", "word") must match on word boundaries so
 * "word" does not hit "password"; longer terms keep plain substring
 * matching ("compress" inside "compressed").
 */
function matchesTerm(text: string, term: string): boolean {
  if (term.length > 4) return text.includes(term);
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
}

/** Parse "mp4 to mp3" style queries. Returns null when not a conversion. */
export function parseConvertIntent(query: string): ConvertIntent | null {
  // Drop a leading verb so "change mp4 to mp3" parses like "mp4 to mp3".
  const stripped = normalize(query).replace(LEADING_VERBS, "");
  const m = CONVERT_RE.exec(stripped);
  if (!m) return null;
  const [, rawFrom, rawTo] = m;
  const from = rawFrom.trim();
  const to = rawTo.trim();
  if (!from || !to) return null;
  const fromFamily = familyOf(from);
  const toFamily = familyOf(to);
  // Both sides must be recognizable formats, otherwise this is just a
  // phrase that happens to contain "to" ("add text to pdf").
  if (!fromFamily || !toFamily) return null;
  return { fromFamily, toFamily, fromToken: from, toToken: to };
}

function ioFamilies(list: string[]): Set<string> {
  const s = new Set<string>();
  for (const f of list) {
    const fam = familyOf(f);
    s.add(fam ?? f.toLowerCase());
  }
  return s;
}

function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  const t = `  ${s.toLowerCase()} `;
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

function trigramSimilarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

function expandedTerms(terms: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const t of terms) {
    const extras = SYNONYMS[t];
    map.set(t, extras ?? []);
  }
  return map;
}

/**
 * Score tools for a query. Returns tools sorted best-first, or with fuzzy
 * fallback results when nothing matched. `limit` caps fuzzy output.
 */
export function scoreTools<T extends SearchableTool>(tools: T[], query: string, limit?: number): T[] {
  const q = normalize(query);
  if (!q) return limit ? tools.slice(0, limit) : tools;

  const terms = q.split(/\s+/).filter((t) => !STOPWORDS.has(t));
  const intent = parseConvertIntent(q);
  const expansions = expandedTerms(terms);
  const scored: { tool: T; score: number }[] = [];
  const unmatched: { tool: T; score: number }[] = [];
  for (const tool of tools) {
    const title = tool.title.toLowerCase();
    const desc = tool.description.toLowerCase();
    const category = tool.category.toLowerCase();
    const kwLower = (tool.keywords ?? []).map((kw) => kw.toLowerCase());

    // Very short queries skip phrase matching: "to" would otherwise
    // keyword-match "video to gif" and crown nonsense winners.
    const phrase = q.length >= 3;
    const exactKw = phrase && kwLower.some((kw) => kw === q);
    // Keyword covers the query ("video to mp3" for "mp3") is a strong
    // signal; a keyword merely appearing inside the longer query is weak.
    // Containment checks use strict inequality: exact equality is the
    // exactKw signal, and must not triple-count through both directions.
    const kwCoversQuery = phrase && kwLower.some((kw) => kw.includes(q) && kw !== q);
    const queryCoversKw = phrase && kwLower.some((kw) => q.includes(kw) && kw !== q);
    const titleMatch = terms.some((t) => title.includes(t));
    const descMatch = terms.some((t) => desc.includes(t));

    // Every term must hit somewhere, expansions included.
    let termsMatch = terms.length > 0;
    for (const t of terms) {
      const extras = expansions.get(t) ?? [];
      const hit =
        matchesTerm(title, t) ||
        matchesTerm(desc, t) ||
        matchesTerm(category, t) ||
        kwLower.some((kw) => matchesTerm(kw, t) || extras.some((e) => matchesTerm(kw, e) || matchesTerm(e, kw))) ||
        extras.some((e) => matchesTerm(desc, e) || matchesTerm(title, e));
      if (!hit) {
        termsMatch = false;
        break;
      }
    }

    const termExactKw = terms.some((t) => kwLower.includes(t));

    // A multi-word keyword whose every word appears in the query (directly
    // or via a synonym) is a strong hit even when not contiguous:
    // "remove password" ⊆ "remove pdf password".
    const termSet = new Set(terms);
    const extrasVocab = new Set(terms.flatMap((t) => expansions.get(t) ?? []).flatMap((e) => e.split(/\s+/)));
    const wordKnown = (w: string) => termSet.has(w) || extrasVocab.has(w);
    const kwPhraseCovered = kwLower.some((kw) => kw.includes(" ") && kw.split(/\s+/).every(wordKnown));

    // Query that names the tool: "sign pdf" is literally the tool's title.
    // Typing a tool's exact name is the strongest possible signal.
    const titleWords = title.replace(/[^a-z0-9]+/g, " ").trim();
    const titleExact = phrase && titleWords === q;

    // Suite nouns ("photo", "song") prefer the matching tool family.
    const suiteHint = SUITE_HINTS.some(
      ([nouns, prefix]) => terms.some((t) => nouns.includes(t)) && tool.href.startsWith(prefix),
    );
    let score =
      (exactKw ? 100 : 0) +
      (titleExact ? 120 : 0) +
      (kwCoversQuery ? 50 : 0) +
      (kwPhraseCovered ? 45 : 0) +
      (queryCoversKw ? 20 : 0) +
      (termExactKw ? 20 : 0) +
      (titleMatch ? 20 : 0) +
      (suiteHint ? 15 : 0) +
      (descMatch ? 5 : 0);
    let matched = termsMatch || kwCoversQuery || queryCoversKw || exactKw || titleExact;

    // Conversion intent: io declarations decide the winner.
    if (intent && tool.io) {
      const fromFam = ioFamilies(tool.io.from);
      const toFam = ioFamilies(tool.io.to);
      const fromHit = fromFam.has(intent.fromFamily);
      const toHit = toFam.has(intent.toFamily);
      if (fromHit && toHit) {
        score += 120;
        matched = true;
      } else if (toHit) {
        score += 30;
        matched = matched || termsMatch;
      } else if (toFam.has(intent.fromFamily) && fromFam.has(intent.toFamily)) {
        // Reversed direction: closest converter we have ("pdf to word" ->
        // DOCX to PDF). Ranked below exact matches.
        score += 40;
        matched = true;
      }
    } else if (intent) {
      // No io declared: an exact "x to y" keyword phrase still counts.
      const phrase = `${intent.fromToken} ${intent.toToken}`;
      if (kwLower.some((kw) => kw === phrase || kw === `${intent.fromToken} to ${intent.toToken}`)) {
        score += 100;
        matched = true;
      }
    }

    if (matched && score > 0) {
      scored.push({ tool, score });
    } else {
      // Keep fuzzy candidates warm instead of dropping them.
      const sim = Math.max(
        trigramSimilarity(q, title),
        ...kwLower.map((kw) => trigramSimilarity(q, kw)),
        ...terms.filter((t) => t.length > 2).map((t) => trigramSimilarity(t, title)),
      );
      unmatched.push({ tool, score: sim });
    }
  }

  if (scored.length) {
    return scored.sort((a, b) => b.score - a.score).map((s) => s.tool);
  }

  // Fuzzy fallback: surface closest titles/keywords above threshold.
  return unmatched
    .filter((u) => u.score >= 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit ?? 8)
    .map((u) => u.tool);
}
