// Keeping long, synchronous work from freezing the page.
//
// Anything that crunches numbers for more than a frame has to hand control back
// periodically, or nothing repaints: no progress bar moves, no button responds, and
// on a big file the tab looks hung until the work is done.

/**
 * How long to work before handing the browser a chance to paint.
 *
 * Yielding is not free — the browser does a rendering pass each time. Measured over
 * a 10-minute WAV encode: at 32ms it cost 26% more wall time, at 64ms nothing
 * measurable, and past ~100ms the page starts feeling unresponsive to input. 64ms
 * leaves about 15 frames a second, which is plenty for a progress bar.
 */
const YIELD_INTERVAL_MS = 64;

/**
 * Hand control back to the browser so it can render.
 *
 * A MessageChannel message is an ordinary task, and the browser renders between
 * tasks. `scheduler.yield()` looks like the tidier API but resumes at a priority
 * that cuts ahead of rendering: measured over the same work at the same yield count,
 * it let 2 frames through where this let 7. `setTimeout` is worse still — nested
 * timers are clamped to 4ms, more than the work between yields.
 */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(undefined);
  });
}

/**
 * Returns a function to call from inside a long loop: it yields once the interval
 * has elapsed and does nothing the rest of the time, so short jobs never pay for it.
 * It reports whether it actually yielded, which is the moment worth reporting
 * progress on — there is no point telling the page a number it can't paint.
 *
 * Call it on chunk boundaries rather than every iteration — the clock check is cheap
 * but not free.
 */
export function createYielder(): () => Promise<boolean> {
  let last = performance.now();
  return async () => {
    if (performance.now() - last < YIELD_INTERVAL_MS) return false;
    await yieldToBrowser();
    last = performance.now();
    return true;
  };
}
