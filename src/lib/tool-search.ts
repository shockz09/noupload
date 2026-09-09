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

/**
 * Query shapes that mean "convert X to Y".
 *
 * Two alternatives, because the separators need different padding rules.
 * Symbol arrows are unambiguous and may be written unspaced ("png->jpg").
 * Word separators MUST be surrounded by whitespace: the lazy `(.+?)` would
 * otherwise latch onto the first occurrence anywhere in the string, and
 * "to"/"2"/"as" all live inside real format words - "pho|to| to pdf",
 * "mp|2| to mp3", "r|as|ter to png".
 */
const CONVERT_RE = /^(.+?)\s*(?:→|->|=>)\s*(.+)$|^(.+?)\s+(?:to|2|into|as)\s+(.+)$/;

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
  "parts",
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

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Short terms ("pdf", "gif", "word") must match at a word start so "word"
 * does not hit "password"; longer terms keep plain substring matching
 * ("compress" inside "compressed"). The match is a word *prefix*, not a
 * whole word, so typing "res" still narrows to Resize - this box filters
 * as you type and every real query passes through its own prefixes.
 */
/**
 * Compiled word-start patterns, keyed by term. matchesTerm runs once per
 * (tool x term x keyword) on every keystroke, so recompiling the same handful
 * of patterns thousands of times a second is pure overhead. The key space is
 * bounded by what a user can type into one search box.
 */
const TERM_RE = new Map<string, RegExp>();

function termPattern(term: string): RegExp {
  let re = TERM_RE.get(term);
  if (!re) {
    re = new RegExp(`\\b${escapeRe(term)}`);
    TERM_RE.set(term, re);
  }
  return re;
}

function matchesTerm(text: string, term: string): boolean {
  if (term.length > 4) return text.includes(term);
  return termPattern(term).test(text);
}

/** Parse "mp4 to mp3" style queries. Returns null when not a conversion. */
export function parseConvertIntent(query: string): ConvertIntent | null {
  // Drop a leading verb so "change mp4 to mp3" parses like "mp4 to mp3".
  const stripped = normalize(query).replace(LEADING_VERBS, "");
  const m = CONVERT_RE.exec(stripped);
  if (!m) return null;
  // Group 1/2 = symbol-arrow branch, 3/4 = word-separator branch.
  const from = (m[1] ?? m[3]).trim();
  const to = (m[2] ?? m[4]).trim();
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

/** The declared io formats themselves, normalized (no family widening). */
function ioTokens(list: string[]): Set<string> {
  const s = new Set<string>();
  for (const f of list) s.add(f.toLowerCase().replace(/^\./, "").trim());
  return s;
}

/**
 * Does a declared io list cover one side of an intent?
 *
 * Matching on family alone is too loose in the `to` direction: every
 * image->image converter would claim "heic to webp" even when it can only
 * emit jpeg. So a list covers a format when it names that format outright,
 * or when it names the whole family as an explicit wildcard - "image" in
 * Images -> PDF's `from` really does mean any image.
 */
function ioCovers(tokens: Set<string>, token: string, family: string): boolean {
  return tokens.has(token) || tokens.has(family);
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

interface ToolText {
  title: string;
  desc: string;
  category: string;
  keywords: string[];
}

/**
 * Lowercased tool text, cached per tool object. The grids are module-level
 * constants, so this is computed once for the life of the page instead of
 * re-lowercasing every field of every tool on every keystroke.
 */
const TOOL_TEXT = new WeakMap<SearchableTool, ToolText>();

function toolText(tool: SearchableTool): ToolText {
  let t = TOOL_TEXT.get(tool);
  if (!t) {
    t = {
      title: tool.title.toLowerCase(),
      desc: tool.description.toLowerCase(),
      category: tool.category.toLowerCase(),
      keywords: (tool.keywords ?? []).map((kw) => kw.toLowerCase()),
    };
    TOOL_TEXT.set(tool, t);
  }
  return t;
}

/**
 * Score tools for a query. Returns tools sorted best-first, or with fuzzy
 * fallback results when nothing matched. `limit` caps fuzzy output.
 */
export function scoreTools<T extends SearchableTool>(tools: T[], query: string, limit?: number): T[] {
  const q = normalize(query);
  if (!q) return limit ? tools.slice(0, limit) : tools;

  // Strip a leading filler verb ("make video smaller" -> "video smaller") so
  // it does not count as a term nothing can satisfy. The pattern only fires
  // at the start and only when more words follow, so a search for the Convert
  // tool by name is untouched.
  const rawTerms = q.replace(LEADING_VERBS, "").split(/\s+/);
  // A query made entirely of stopwords ("a", "to", "my") would leave no
  // terms at all and match nothing, so the box would read "No tools found"
  // for a single typed letter. Fall back to the raw tokens in that case.
  const stripped = rawTerms.filter((t) => !STOPWORDS.has(t));
  const terms = stripped.length ? stripped : rawTerms;
  const intent = parseConvertIntent(q);
  const expansions = expandedTerms(terms);
  const scored: { tool: T; score: number }[] = [];
  const unmatched: T[] = [];
  for (const tool of tools) {
    const { title, desc, category, keywords: kwLower } = toolText(tool);

    // Very short queries skip phrase matching: "to" would otherwise
    // keyword-match "video to gif" and crown nonsense winners.
    const phrase = q.length >= 3;
    const exactKw = phrase && kwLower.some((kw) => kw === q);
    // Keyword covers the query ("video to mp3" for "mp3") is a strong
    // signal; a keyword merely appearing inside the longer query is weak.
    // Containment checks use strict inequality: exact equality is the
    // exactKw signal, and must not triple-count through both directions.
    // Both go through matchesTerm so they honour the same word-start rule
    // as term matching - a raw includes() here let "word" score against
    // the "password" keyword, defeating the guard in matchesTerm.
    const kwCoversQuery = phrase && kwLower.some((kw) => kw !== q && matchesTerm(kw, q));
    // Only ever a ranking nudge, never proof of a match: the query merely
    // *containing* a keyword leaves the rest of the query unaccounted for.
    // Crop lists "trim", so "vodio trim" used to return Crop and nothing
    // else - one stray keyword outvoting the every-term-must-hit rule.
    const queryCoversKw = phrase && kwLower.some((kw) => kw !== q && matchesTerm(q, kw));
    const titleMatch = terms.some((t) => title.includes(t));
    const descMatch = terms.some((t) => desc.includes(t));

    // Every term must hit somewhere, expansions included. We track whether
    // any term landed *only* via a synonym, because such a hit feeds no
    // other score component: without points of its own a synonym-only
    // match totals 0 and the gate below drops it ("read" never reached OCR
    // even though SYNONYMS maps read -> ocr).
    let termsMatch = terms.length > 0;
    let synonymHit = false;
    for (const t of terms) {
      const extras = expansions.get(t) ?? [];
      const direct =
        matchesTerm(title, t) ||
        matchesTerm(desc, t) ||
        matchesTerm(category, t) ||
        kwLower.some((kw) => matchesTerm(kw, t));
      const viaSynonym =
        !direct &&
        (kwLower.some((kw) => extras.some((e) => matchesTerm(kw, e) || matchesTerm(e, kw))) ||
          extras.some((e) => matchesTerm(desc, e) || matchesTerm(title, e)));
      if (!direct && !viaSynonym) {
        termsMatch = false;
        break;
      }
      if (viaSynonym) synonymHit = true;
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
      (synonymHit ? 10 : 0) +
      (descMatch ? 5 : 0);
    let matched = termsMatch || kwCoversQuery || exactKw || titleExact;

    // Conversion intent: io declarations decide the winner.
    if (intent && tool.io) {
      const fromTok = ioTokens(tool.io.from);
      const toTok = ioTokens(tool.io.to);
      const fromHit = ioCovers(fromTok, intent.fromToken, intent.fromFamily);
      const toHit = ioCovers(toTok, intent.toToken, intent.toFamily);
      // Comparing tokens (not families) is what makes direction legible
      // inside a family: "pdf to word" is reversed for DOCX -> PDF even
      // though pdf and docx share the `document` family.
      const reversed =
        ioCovers(toTok, intent.fromToken, intent.fromFamily) && ioCovers(fromTok, intent.toToken, intent.toFamily);
      if (fromHit && toHit) {
        score += 120;
        matched = true;
      } else if (reversed) {
        // Closest converter we have, pointing the other way ("pdf to word"
        // -> DOCX to PDF). Ranked below exact matches, but above the family
        // guess below: both endpoints match on the token, just transposed.
        score += 60;
        matched = true;
      } else if (fromHit && ioFamilies(tool.io.to).has(intent.toFamily)) {
        // Right input and the right output *family*, but not that exact
        // format - HEIC -> JPEG for "heic to webp". The weakest positive
        // signal: inside a broad family it fires on coincidence (OCR emits
        // pdf, so it looks "document-shaped" for "pdf to word").
        score += 35;
        matched = true;
      } else if (toHit) {
        score += 30;
      }
    } else if (intent) {
      // No io declared: an exact "x to y" keyword phrase still counts.
      const intentPhrase = `${intent.fromToken} ${intent.toToken}`;
      if (kwLower.some((kw) => kw === intentPhrase || kw === `${intent.fromToken} to ${intent.toToken}`)) {
        score += 100;
        matched = true;
      }
    }

    // Gate on `matched` alone: a tool that satisfied every term is a real
    // result even when the signals that fired award no points. Requiring
    // score > 0 here silently rerouted such tools into the fuzzy bucket.
    if (matched) {
      scored.push({ tool, score });
    } else {
      // Deferred: scoring these is only worth it if nothing matches at all,
      // which is the rare case. Doing it here cost ~4x the whole search on
      // every keystroke, for candidates that were then thrown away.
      unmatched.push(tool);
    }
  }

  if (scored.length) {
    return scored.sort((a, b) => b.score - a.score).map((s) => s.tool);
  }

  // Fuzzy fallback: surface closest titles/keywords above threshold.
  const fuzzyTerms = terms.filter((t) => t.length > 2);
  const near: { tool: T; score: number }[] = [];
  for (const tool of unmatched) {
    const { title, keywords } = toolText(tool);
    let sim = trigramSimilarity(q, title);
    for (const kw of keywords) sim = Math.max(sim, trigramSimilarity(q, kw));
    for (const t of fuzzyTerms) sim = Math.max(sim, trigramSimilarity(t, title));
    if (sim >= 0.34) near.push({ tool, score: sim });
  }
  return near
    .sort((a, b) => b.score - a.score)
    .slice(0, limit ?? 8)
    .map((u) => u.tool);
}
