// Regression tests for the detachment crash: switching the Design Studio off
// the Design tab ran a React effect cleanup that called cancelPick() on a
// <webview> the mutation phase had already removed from the document. Electron
// throws SYNCHRONOUSLY there, and a synchronous throw inside a passive-effect
// destroy is routed to the nearest error boundary — so the whole Design Studio
// showed "could not be shown" on every single tab switch.
//
// These drive the bridge with a fake element rather than a real <webview>: the
// contract under test is "never throws, never rejects, whatever the element
// does", which does not need Electron to verify.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEBVIEW_UNAVAILABLE } from './webviewGuard.js';
import { a11ySnapshot, callWebview, cancelPick, cursorCenter, execInGuest, extractLive, readPick, startPick, tap, type WebviewEl } from './webviewBridge.js';

test('cursorCenter returns the geometric center of a rect', () => {
  assert.deepEqual(cursorCenter({ left: 0, top: 0, width: 100, height: 40 }), { x: 50, y: 20 });
});

test('cursorCenter accounts for the rect offset (scrolled/positioned element)', () => {
  assert.deepEqual(cursorCenter({ left: 200, top: 120, width: 60, height: 20 }), { x: 230, y: 130 });
});

test('cursorCenter handles a zero-size rect (collapsed element) as its own point', () => {
  assert.deepEqual(cursorCenter({ left: 12, top: 8, width: 0, height: 0 }), { x: 12, y: 8 });
});

/** Electron's behaviour on a detached or pre-dom-ready webview: a SYNC throw. */
function throwingWebview(connected: boolean): WebviewEl {
  return {
    isConnected: connected,
    executeJavaScript(): Promise<unknown> { throw new Error(WEBVIEW_UNAVAILABLE); },
    reload(): void { throw new Error(WEBVIEW_UNAVAILABLE); },
  } as unknown as WebviewEl;
}

function workingWebview(value: unknown): WebviewEl {
  return {
    isConnected: true,
    executeJavaScript(): Promise<unknown> { return Promise.resolve(value); },
  } as unknown as WebviewEl;
}

test('cancelPick on a DETACHED webview resolves instead of throwing', async () => {
  // The exact reported bug. If this throws, the Design Studio breaks on every
  // tab switch, because the caller is a React effect cleanup.
  const wv = throwingWebview(false);
  const result = await cancelPick(wv);
  assert.equal(result.ok, false);
  assert.equal(result.error, WEBVIEW_UNAVAILABLE);
});

test('cancelPick survives an ATTACHED element that still throws (pre-dom-ready)', async () => {
  // isConnected passes, so only the try/catch half of the guard can save this —
  // dom-ready is not observable from the element.
  const result = await cancelPick(throwingWebview(true));
  assert.equal(result.ok, false);
});

test('calling it synchronously does not throw at the call site', () => {
  // The distinction that matters: a sync throw escapes `void fn()` and reaches
  // the error boundary, whereas a rejected promise does not. Assert the shape,
  // not just the eventual value.
  const wv = throwingWebview(false);
  assert.doesNotThrow(() => { void cancelPick(wv); });
  assert.doesNotThrow(() => { void startPick(wv); });
  assert.doesNotThrow(() => { void readPick(wv); });
  assert.doesNotThrow(() => { void tap(wv, 'anything'); });
});

test('every wrapper yields its own neutral value on a dead surface', async () => {
  const wv = throwingWebview(false);
  assert.equal(await readPick(wv), null, 'readPick reads as no-pick-yet');
  assert.deepEqual(await extractLive(wv), [], 'list reads are empty');
  assert.deepEqual(await a11ySnapshot(wv), []);
  assert.equal((await startPick(wv)).ok, false, 'commands report failure in-band');
  assert.equal(await execInGuest(wv, '1+1'), null);
});

test('a live webview is completely unaffected', async () => {
  assert.equal(await readPick(workingWebview(null)), null);
  assert.deepEqual(await extractLive(workingWebview([{ testid: 'a' }])), [{ testid: 'a' }]);
  assert.equal(await execInGuest(workingWebview(42), '40+2'), 42);
});

test('a guest-script rejection still reaches the caller as a failed result', async () => {
  // Swallowing detachment must NOT swallow real faults: a broken snippet has to
  // stay visible, or the guard hides the bugs it was meant to survive.
  const wv = {
    isConnected: true,
    executeJavaScript(): Promise<unknown> { return Promise.reject(new Error('ReferenceError: foo is not defined')); },
  } as unknown as WebviewEl;
  const result = await startPick(wv);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'ReferenceError: foo is not defined', 'the real message survives');
});

test('callWebview returns the fallback rather than throwing on a sync method', () => {
  assert.equal(callWebview(throwingWebview(false), 'reload', (el) => { el.reload(); return 'ran'; }, 'skipped'), 'skipped');
  assert.equal(callWebview(throwingWebview(true), 'reload', (el) => { el.reload(); return 'ran'; }, 'skipped'), 'skipped');
  assert.equal(callWebview(null, 'reload', () => 'ran', 'skipped'), 'skipped');
});

test('callWebview runs the function when the element is usable', () => {
  assert.equal(callWebview(workingWebview(null), 'reload', () => 'ran', 'skipped'), 'ran');
});
