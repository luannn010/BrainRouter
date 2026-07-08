// brainrouter-desktop/src/panels/design/PreviewCanvas.tsx
import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import type { WebviewEl } from '../../lib/uitest/webviewBridge.js';
import { fileUrlFor, type PrototypeEntry } from '../../lib/design/prototypeMeta.js';

export type Device = 'desktop' | 'tablet' | 'phone';
const DEVICE_W: Record<Device, number | null> = { desktop: null, tablet: 820, phone: 390 };

export interface PreviewHandle { reload: () => void; getWebview: () => WebviewEl | null; }

export const PreviewCanvas = forwardRef<PreviewHandle, {
  workspaceRoot?: string;
  selected: PrototypeEntry | null;
  device: Device;
  onWebviewReady?: (wv: WebviewEl) => void;
}>(function PreviewCanvas({ workspaceRoot, selected, device, onWebviewReady }, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const wvRef = useRef<WebviewEl | null>(null);

  // Create the hardened <webview> once (main.ts already gates its src via webviewPolicy).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const wv = document.createElement('webview') as unknown as WebviewEl;
    wv.setAttribute('src', 'data:text/html,<body style="background:%230B0D0F"></body>');
    wv.setAttribute('partition', 'persist:design-studio');
    wv.style.width = '100%'; wv.style.height = '100%'; wv.style.border = '0';
    host.appendChild(wv);
    wvRef.current = wv;
    const onReady = (): void => { if (onWebviewReady) onWebviewReady(wv); };
    wv.addEventListener('dom-ready', onReady);
    return () => { try { host.removeChild(wv); } catch { /* ignore */ } wvRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the selected prototype as an authorized file:// url.
  useEffect(() => {
    const wv = wvRef.current;
    if (!wv || !selected || !workspaceRoot) return;
    const url = fileUrlFor(workspaceRoot, selected.path);
    wv.loadURL(url).catch(() => { /* policy refusal or missing file — surfaced by did-fail-load */ });
  }, [selected?.path, workspaceRoot]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({ reload: () => wvRef.current?.reload(), getWebview: () => wvRef.current }), []);

  const maxW = DEVICE_W[device];
  return (
    <div className="ds-preview">
      <div className={`ds-stage ds-stage--${device}`} style={maxW ? { maxWidth: maxW } : undefined} ref={hostRef} />
      {!selected && <div className="ds-empty">No prototypes yet. The seed loads automatically — or generate one from the Fix chat.</div>}
    </div>
  );
});
