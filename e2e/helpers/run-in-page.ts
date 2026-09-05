/**
 * File bytes in a form that survives the page.evaluate serialization boundary.
 *
 * Note for specs: modules must be imported by dev-server URL ("/src/lib/...")
 * inside page.evaluate — Vite doesn't resolve bare specifiers there, and it only
 * serves /src/* once the page is on the app origin, so page.goto() first.
 */
export function toBytes(buf: Buffer | Uint8Array): number[] {
	return Array.from(new Uint8Array(buf));
}

/** Shape every probe in these specs returns, so failures carry a message. */
export type Outcome = { ok: true; [k: string]: unknown } | { ok: false; error: string };
