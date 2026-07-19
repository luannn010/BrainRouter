/**
 * webviewGuard — the one place that decides whether an Electron <webview> can be
 * driven right now, and what a failed drive means.
 *
 * Electron's <webview> methods (executeJavaScript, loadURL, reload, getURL,
 * capturePage, setZoomFactor, goBack/goForward, openDevTools) throw
 * SYNCHRONOUSLY when the element is not in the document or has not yet emitted
 * `dom-ready`. Where that throw lands depends only on the shape of the caller: a
 * React effect cleanup routes it to the nearest error boundary, a plain timer
 * callback makes it an uncaught window error, an async body makes it an
 * unhandled rejection. All three are the same teardown race, so the fix is to
 * stop the throw at the boundary rather than to catch it three different ways at
 * every call site.
 */

/**
 * Electron's own message, reused as the sentinel for our pre-check so both
 * halves of the guard produce one recognisable, self-describing error.
 */
export const WEBVIEW_UNAVAILABLE =
  'The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.';

/** Minimal shape the guard inspects — keeps this module DOM-free and testable. */
export interface AttachableEl { isConnected: boolean }

/**
 * The attachment half of the precondition. `isConnected` is exact for "still in
 * the document" but says NOTHING about dom-ready, so `false` here is conclusive
 * and `true` is not — which is precisely why callers must ALSO wrap the call in
 * try/catch. There is no element-level way to ask "has dom-ready fired?"
 * (`getWebContentsId()` answers only by throwing), and threading each panel's
 * own `ready` flag into the bridge would reintroduce the per-call-site design
 * this guard exists to replace.
 */
export function isWebviewAttached(wv: AttachableEl | null | undefined): boolean {
  return !!wv && wv.isConnected === true;
}

/**
 * True when an error is the detached / not-yet-dom-ready failure — ours, or
 * Electron's across versions. Anything else is a real fault and stays loud.
 *
 * This only decides whether to WARN; the bridge absorbs every failure either
 * way. So a miss here costs a stray console line, never a crash.
 */
export function isWebviewUnavailableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!message) return false;
  const text = message.toLowerCase();
  return text.includes('must be attached to the dom')
    || text.includes('getwebcontentsid')
    || (text.includes('webcontents') && (text.includes('not available') || text.includes('destroyed')));
}

/** Text for an ActionResult's `error` field, so a failure is never shapeless. */
export function webviewErrorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return WEBVIEW_UNAVAILABLE;
}
