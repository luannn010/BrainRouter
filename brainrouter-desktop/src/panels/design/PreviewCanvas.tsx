// brainrouter-desktop/src/panels/design/PreviewCanvas.tsx
import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { startPick as wvStartPick, readPick, cancelPick, type WebviewEl } from '../../lib/uitest/webviewBridge.js';
import type { DraftOperation } from '../../lib/design/designElements.js';
import { buildApplyPayload, buildApplyScript } from '../../lib/design/designProperties.js';
import { buildMeasureScript, MEASURED_CSS_PROPERTIES, parseMeasurement, type MeasuredElement } from '../../lib/design/designMeasure.js';
import type { ConstraintBox } from '../../lib/design/designConstraints.js';
import { fileUrlFor, type PrototypeEntry } from '../../lib/design/prototypeMeta.js';
import { markWebviewReady, queueWebviewUrl } from '../../lib/design/webviewLifecycle.js';
import { computeStageMetrics } from '../../lib/design/stageMetrics.js';

export type Device = 'desktop' | 'tablet' | 'phone';
const DEVICE_W: Record<Device, number | null> = { desktop: null, tablet: 820, phone: 390 };

export type PickInfo = { testid: string | null; tag: string; label: string; w?: number; h?: number };

export interface PreviewHandle {
  reload: () => void;
  getWebview: () => WebviewEl | null;
  /** Start element-pick mode; calls back with the picked element (or null if
   *  cancelled), then ends. Returns stop() to cancel early. Electron uses the
   *  webview a11y bridge; the browser preview drives the injected picker over
   *  postMessage. */
  startPick: (onPicked: (info: PickInfo | null) => void) => () => void;
  /** `boxes` supplies measured geometry keyed by element ref — only the
   *  constraint properties need it, and only for refs it contains. */
  applyDraft: (operations: readonly DraftOperation[], target?: WebviewEl, boxes?: Record<string, ConstraintBox>) => Promise<void>;
  /** Reads the element's real box and computed styles out of the preview, so the
   *  inspector shows what IS rather than what a draft claims. Resolves null when
   *  the surface is not ready or the ref no longer matches anything. */
  measure: (ref: string) => Promise<MeasuredElement | null>;
}

export const PreviewCanvas = forwardRef<PreviewHandle, {
  workspaceRoot?: string;
  selected: PrototypeEntry | null;
  device: Device;
  zoom?: number;
  /** Measured .ds-stage-shell size — the shell can't hand the surface a
   *  resolvable percentage height, so the stage is sized in explicit px. */
  shellSize?: { w: number; h: number } | null;
  /** Rendered inside the (zoom-scaled) stage, above the preview surface —
   *  the annotation/mask layer. */
  overlay?: React.ReactNode;
  onWebviewReady?: (wv: WebviewEl) => void;
}>(function PreviewCanvas({ workspaceRoot, selected, device, zoom = 100, shellSize, overlay, onWebviewReady }, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const wvRef = useRef<WebviewEl | null>(null);
  // Electron loads the prototype as a hardened <webview> + file:// url. The
  // browser preview (dev bridge) has no webview tag, so it falls back to a
  // sandboxed <iframe> pointed at the dev prototypeProxy (a same-origin served
  // doc, so the flow's own CSP governs and its nav script can run).
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastSrcRef = useRef<string>('');
  const measureIdRef = useRef(0);
  const webviewStateRef = useRef({ ready: false, pendingUrl: null as string | null, currentUrl: null as string | null });

  // Create the preview surface once — a real Electron webview if available
  // (main.ts gates its src via webviewPolicy), otherwise the iframe fallback.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const wv = document.createElement('webview') as unknown as WebviewEl;
    // Electron defines loadURL on the webview prototype; a plain browser makes an
    // inert unknown element with no such method — that's our fallback signal.
    if (typeof (wv as { loadURL?: unknown }).loadURL === 'function') {
      wv.setAttribute('src', 'data:text/html,<body style="background:%230B0D0F"></body>');
      wv.setAttribute('partition', 'persist:design-studio');
      wv.style.width = '100%'; wv.style.height = '100%'; wv.style.border = '0';
      const onReady = (): void => {
        // dom-ready fires on EVERY document load, not just the first — only a
        // URL queued while the webview wasn't ready yet may be loaded here.
        // Reading currentUrl instead (it stays set forever) re-loaded the same
        // prototype on every dom-ready: an infinite reload loop whose each
        // loadURL aborted the previous one (main-process ERR_ABORTED spam and
        // leaked did-stop-loading listeners), killing every stage interaction.
        const queued = webviewStateRef.current.pendingUrl;
        webviewStateRef.current = markWebviewReady(webviewStateRef.current);
        if (queued) {
          void wv.loadURL(queued).catch(() => { /* policy refusal or missing file — surfaced by did-fail-load */ });
        }
        if (onWebviewReady) onWebviewReady(wv);
      };
      wv.addEventListener('dom-ready', onReady);
      host.appendChild(wv);
      wvRef.current = wv;
      return () => { wv.removeEventListener('dom-ready', onReady); try { host.removeChild(wv); } catch { /* ignore */ } wvRef.current = null; webviewStateRef.current = { ready: false, pendingUrl: null, currentUrl: null }; };
    }
    const frame = document.createElement('iframe');
    // allow-scripts lets a prototype run its own JS (drive it hands-on); no
    // allow-same-origin keeps it in an opaque origin so it can't reach the app.
    frame.setAttribute('sandbox', 'allow-scripts allow-forms');
    frame.setAttribute('title', 'Prototype preview');
    frame.style.width = '100%'; frame.style.height = '100%'; frame.style.border = '0'; frame.style.background = '#0B0D0F';
    host.appendChild(frame);
    iframeRef.current = frame;
    return () => { try { host.removeChild(frame); } catch { /* ignore */ } iframeRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the selected prototype into whichever surface exists.
  useEffect(() => {
    if (!selected) return;
    const wv = wvRef.current;
    if (wv && workspaceRoot) {
      const url = fileUrlFor(workspaceRoot, selected.path);
      webviewStateRef.current = queueWebviewUrl(webviewStateRef.current, url);
      if (webviewStateRef.current.ready) void wv.loadURL(url).catch(() => { /* policy refusal or missing file — surfaced by did-fail-load */ });
      return;
    }
    const frame = iframeRef.current;
    if (!frame) return;
    // Served same-origin by the dev prototypeProxy (vite.config.ts) so the flow's
    // own CSP governs and its inline nav script runs — a srcdoc iframe would
    // inherit the app's `script-src 'self'` and stay inert.
    const src = `/__brp/proto?id=${encodeURIComponent(selected.id)}`;
    lastSrcRef.current = src;
    frame.src = src;
  }, [selected?.id, selected?.path, workspaceRoot]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    reload: () => {
      if (wvRef.current) {
        if (!webviewStateRef.current.ready) { webviewStateRef.current.pendingUrl = webviewStateRef.current.currentUrl ?? lastSrcRef.current; return; }
        wvRef.current.reload(); return;
      }
      // Re-assigning src reloads the iframe document (best-effort in browser).
      if (iframeRef.current && lastSrcRef.current) iframeRef.current.src = lastSrcRef.current;
    },
    getWebview: () => wvRef.current,
    applyDraft: async (operations, target, boxes) => {
      const wv = target ?? wvRef.current;
      if (wv && webviewStateRef.current.ready) {
        const code = buildApplyScript(operations, boxes);
        if (code) await wv.executeJavaScript(code, true);
        return;
      }
      // Browser fallback: send resolved DATA, never code. Prototypes ship
      // `script-src 'unsafe-inline'`, which permits the injected inline handler
      // but NOT eval — so the guest applies these declarations itself.
      const ops = buildApplyPayload(operations, boxes);
      if (ops.length === 0) return;
      const frame = iframeRef.current;
      try { frame?.contentWindow?.postMessage({ __brpApply: { ops } }, '*'); } catch { /* guest not ready */ }
    },
    measure: async (ref) => {
      const wv = wvRef.current;
      if (wv && webviewStateRef.current.ready) {
        // Electron: executeJavaScript is injected by the embedder, so unlike an
        // in-page eval it is not blocked by the prototype's CSP.
        try { return parseMeasurement(await wv.executeJavaScript(buildMeasureScript(ref), false)); } catch { return null; }
      }
      const frame = iframeRef.current;
      if (!frame?.contentWindow) return null;
      // Opaque-origin iframe — postMessage is the only channel, and replies cannot
      // be matched by origin, so the request carries an id the guest echoes back.
      const id = `m${measureIdRef.current++}`;
      return new Promise<MeasuredElement | null>((resolve) => {
        const onMsg = (event: MessageEvent): void => {
          const data = (event.data ?? {}) as { __brpMeasured?: { id?: string; value?: unknown } };
          if (!data.__brpMeasured || data.__brpMeasured.id !== id) return;
          window.clearTimeout(timer);
          window.removeEventListener('message', onMsg);
          resolve(parseMeasurement(data.__brpMeasured.value));
        };
        const timer = window.setTimeout(() => { window.removeEventListener('message', onMsg); resolve(null); }, 1200);
        window.addEventListener('message', onMsg);
        try { frame.contentWindow?.postMessage({ __brpMeasure: { id, ref, props: MEASURED_CSS_PROPERTIES } }, '*'); }
        catch { window.clearTimeout(timer); window.removeEventListener('message', onMsg); resolve(null); }
      });
    },
    startPick: (onPicked) => {
      const wv = wvRef.current;
      if (wv) {
        if (!webviewStateRef.current.ready) return () => { /* wait for dom-ready before picking */ };
        // Electron — drive the webview's a11y pick bridge, poll for the result.
        let stopped = false;
        void wvStartPick(wv);
        const poll = setInterval(() => {
          void readPick(wv).then((r) => {
            if (stopped || !r) return;
            stopped = true; clearInterval(poll);
            onPicked({ testid: r.testid ?? null, tag: r.tag, label: r.testid ?? r.suggestion ?? r.tag });
          });
        }, 300);
        return () => { stopped = true; clearInterval(poll); void cancelPick(wv); };
      }
      const frame = iframeRef.current;
      if (frame && frame.contentWindow) {
        // Browser — talk to the injected picker (prototypeProxy) over postMessage.
        const onMsg = (e: MessageEvent): void => {
          const d = (e.data ?? {}) as { __brpPicked?: PickInfo | null };
          if (!('__brpPicked' in d)) return;
          cleanup();
          onPicked(d.__brpPicked ?? null);
        };
        // A pick armed while the document is still loading is lost (the picker
        // script hasn't attached its listener yet) — re-send on every load so
        // pick mode survives prototype switches and reloads.
        const onLoad = (): void => { try { frame.contentWindow?.postMessage({ __brpPick: 'on' }, '*'); } catch { /* ignore */ } };
        const cleanup = (): void => {
          window.removeEventListener('message', onMsg);
          frame.removeEventListener('load', onLoad);
          try { frame.contentWindow?.postMessage({ __brpPick: 'off' }, '*'); } catch { /* ignore */ }
        };
        window.addEventListener('message', onMsg);
        frame.addEventListener('load', onLoad);
        try { frame.contentWindow.postMessage({ __brpPick: 'on' }, '*'); } catch { /* ignore */ }
        return cleanup;
      }
      return () => { /* no preview surface to pick from */ };
    },
  }), []);

  const maxW = DEVICE_W[device];
  // The zoom wrapper's LAYOUT size is the scaled size — transform:scale never
  // creates layout overflow, so without it the shell could not scroll a
  // zoomed-in stage. The stage keeps its base size and scales visually; the
  // overlay lives inside it, so annotations track zoom for free.
  const metrics = shellSize ? computeStageMetrics({ shellW: shellSize.w, shellH: shellSize.h, zoom: zoom ?? 100, deviceWidth: maxW }) : null;
  return (
    <div className="ds-preview">
      <div className="ds-stage-zoom" style={metrics ? { width: metrics.scaledW, height: metrics.scaledH } : undefined}>
        <div className={`ds-stage ds-stage--${device}`} ref={hostRef}
          style={metrics
            ? { width: metrics.baseW, height: metrics.baseH, transform: `scale(${metrics.scale})`, transformOrigin: 'top left' }
            : (maxW ? { maxWidth: maxW } : undefined)}>
          {overlay}
        </div>
      </div>
      {!selected && <div className="ds-empty">No flow selected. Pick one on the left — the sample flows load automatically.</div>}
    </div>
  );
});
