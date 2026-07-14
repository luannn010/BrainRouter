// brainrouter-desktop/src/panels/design/PreviewCanvas.tsx
import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { startPick as wvStartPick, readPick, cancelPick, type WebviewEl } from '../../lib/uitest/webviewBridge.js';
import { fileUrlFor, type PrototypeEntry } from '../../lib/design/prototypeMeta.js';

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
}

export const PreviewCanvas = forwardRef<PreviewHandle, {
  workspaceRoot?: string;
  selected: PrototypeEntry | null;
  device: Device;
  onWebviewReady?: (wv: WebviewEl) => void;
}>(function PreviewCanvas({ workspaceRoot, selected, device, onWebviewReady }, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const wvRef = useRef<WebviewEl | null>(null);
  // Electron loads the prototype as a hardened <webview> + file:// url. The
  // browser preview (dev bridge) has no webview tag, so it falls back to a
  // sandboxed <iframe> pointed at the dev prototypeProxy (a same-origin served
  // doc, so the flow's own CSP governs and its nav script can run).
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastSrcRef = useRef<string>('');

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
      host.appendChild(wv);
      wvRef.current = wv;
      const onReady = (): void => { if (onWebviewReady) onWebviewReady(wv); };
      wv.addEventListener('dom-ready', onReady);
      return () => { try { host.removeChild(wv); } catch { /* ignore */ } wvRef.current = null; };
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
      wv.loadURL(fileUrlFor(workspaceRoot, selected.path)).catch(() => { /* policy refusal or missing file — surfaced by did-fail-load */ });
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
      if (wvRef.current) { wvRef.current.reload(); return; }
      // Re-assigning src reloads the iframe document (best-effort in browser).
      if (iframeRef.current && lastSrcRef.current) iframeRef.current.src = lastSrcRef.current;
    },
    getWebview: () => wvRef.current,
    startPick: (onPicked) => {
      const wv = wvRef.current;
      if (wv) {
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
        const cleanup = (): void => {
          window.removeEventListener('message', onMsg);
          try { frame.contentWindow?.postMessage({ __brpPick: 'off' }, '*'); } catch { /* ignore */ }
        };
        window.addEventListener('message', onMsg);
        try { frame.contentWindow.postMessage({ __brpPick: 'on' }, '*'); } catch { /* ignore */ }
        return cleanup;
      }
      return () => { /* no preview surface to pick from */ };
    },
  }), []);

  const maxW = DEVICE_W[device];
  return (
    <div className="ds-preview">
      <div className={`ds-stage ds-stage--${device}`} style={maxW ? { maxWidth: maxW } : undefined} ref={hostRef} />
      {!selected && <div className="ds-empty">No flow selected. Pick one on the left — the sample flows load automatically.</div>}
    </div>
  );
});
