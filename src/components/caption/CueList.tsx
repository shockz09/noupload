import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Cue, cueTimecode } from "@/lib/caption/cues";

/**
 * The subtitles, as a list you can fix.
 *
 * Two targets per row and no ambiguity between them: the timecode seeks, the
 * words edit. Rows are plain contenteditable rather than inputs — a subtitle
 * wraps to two lines and an `<input>` cannot, while a `<textarea>` per row
 * costs a layout each on files that run to hundreds of cues.
 *
 * Editing is only offered once transcription has finished. While it is still
 * running, new words keep re-cutting the cue boundaries underneath, and an edit
 * made against boundaries that no longer exist would quietly disappear.
 */

interface CueListProps {
  cues: Cue[];
  activeIndex: number;
  editable: boolean;
  onSeek: (time: number) => void;
  onEdit: (index: number, text: string) => void;
}

export const CueList = memo(function CueList({ cues, activeIndex, editable, onSeek, onEdit }: CueListProps) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return cues.map((cue, index) => ({ cue, index }));
    return cues.map((cue, index) => ({ cue, index })).filter(({ cue }) => cue.text.toLowerCase().includes(needle));
  }, [cues, needle]);

  /**
   * Follow along with playback by scrolling *this list* — and only this list.
   *
   * `scrollIntoView` is the obvious call and the wrong one: it scrolls every
   * scrollable ancestor, so each new cue would drag the whole page down to the
   * list and away from the video being watched. Adjusting `scrollTop` by hand
   * gives the same "bring it just into view" behaviour with the window left
   * exactly where the viewer put it.
   *
   * It also stays out of the way of anyone typing in a row.
   */
  useEffect(() => {
    const container = listRef.current;
    if (activeIndex < 0 || !container) return;
    if (document.activeElement?.getAttribute("contenteditable") === "plaintext-only") return;

    const row = container.querySelector(`[data-cue="${activeIndex}"]`);
    if (!row) return;

    const view = container.getBoundingClientRect();
    const target = row.getBoundingClientRect();
    if (target.top < view.top) container.scrollTop += target.top - view.top;
    else if (target.bottom > view.bottom) container.scrollTop += target.bottom - view.bottom;
  }, [activeIndex]);

  if (cues.length === 0) return null;

  return (
    <section className="border-2 border-foreground">
      <header className="flex items-center gap-3 border-b-2 border-foreground bg-muted/40 px-3 py-2">
        <h2 className="font-display text-lg">Subtitles</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {needle ? `${visible.length} of ${cues.length}` : cues.length}
        </span>
        <div className="flex-1" />
        {cues.length > 12 && (
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a line"
            className="w-32 border-2 border-foreground bg-background px-2 py-1 text-sm focus:w-44 focus:outline-none sm:w-40 sm:focus:w-56"
          />
        )}
      </header>

      <div ref={listRef} className="max-h-[52vh] overflow-y-auto overscroll-contain">
        {visible.map(({ cue, index }) => (
          <CueRow
            key={`${index}-${cue.start}`}
            cue={cue}
            index={index}
            active={index === activeIndex}
            editable={editable}
            onSeek={onSeek}
            onEdit={onEdit}
          />
        ))}
        {visible.length === 0 && <p className="px-3 py-6 text-sm text-muted-foreground">Nothing matches “{query}”.</p>}
      </div>
    </section>
  );
});

interface CueRowProps {
  cue: Cue;
  index: number;
  active: boolean;
  editable: boolean;
  onSeek: (time: number) => void;
  onEdit: (index: number, text: string) => void;
}

const CueRow = memo(function CueRow({ cue, index, active, editable, onSeek, onEdit }: CueRowProps) {
  const textRef = useRef<HTMLParagraphElement>(null);

  // The element is uncontrolled while focused — React must not rewrite the node
  // a caret is sitting in — so incoming text is written by hand, and only when
  // it actually differs from what is on screen.
  useLayoutEffect(() => {
    const node = textRef.current;
    if (!node) return;
    const flat = cue.text.replace(/\n/g, " ");
    if (node !== document.activeElement && node.textContent !== flat) node.textContent = flat;
  }, [cue.text]);

  return (
    <div
      data-cue={index}
      className={`grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-foreground/10 px-3 py-2 [contain-intrinsic-size:auto_52px] [content-visibility:auto] ${
        active ? "bg-primary/10" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onSeek(cue.start)}
        title="Jump to this line"
        className={`h-fit border-2 px-1.5 py-0.5 font-mono text-xs tabular-nums transition-colors ${
          cue.edited
            ? "border-foreground bg-primary text-white"
            : active
              ? "border-foreground bg-foreground text-background"
              : "border-transparent text-muted-foreground hover:border-foreground hover:text-foreground"
        }`}
      >
        {cueTimecode(cue.start)}
      </button>

      <p
        ref={textRef}
        contentEditable={editable ? "plaintext-only" : false}
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={(event) => onEdit(index, event.currentTarget.textContent ?? "")}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className={`text-[15px] leading-relaxed break-words outline-none ${
          active ? "font-medium" : ""
        } ${editable ? "focus:bg-background focus:ring-2 focus:ring-foreground" : ""}`}
      />
    </div>
  );
});
