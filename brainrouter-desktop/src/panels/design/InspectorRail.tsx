// brainrouter-desktop/src/panels/design/InspectorRail.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { WebviewEl } from '../../lib/uitest/webviewBridge.js';
import { startPick, readPick, cancelPick, a11ySnapshot, tap, typeText } from '../../lib/uitest/webviewBridge.js';
import type { PreviewHandle } from './PreviewCanvas.js';

/**
 * The flow-test rail. It drives the SHARED preview webview through the existing
 * uitest bridge — it deliberately owns no webview of its own, so what you test is
 * exactly the frame you are looking at.
 */
export function InspectorRail({ previewRef, picked, onPick }: {
  previewRef: React.RefObject<PreviewHandle>;
  picked: string | null;
  onPick: (ref: string | null) => void;
}): React.ReactElement {
  const [a11y, setA11y] = useState<Array<{ role: string; name: string; testid?: string }>>([]);
  const [typeVal, setTypeVal] = useState('');
  const [status, setStatus] = useState('');

  const wv = (): WebviewEl | null => previewRef.current?.getWebview() ?? null;

  // Track the in-flight pick loop so it can't outlive the component.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPickLoop = (): void => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const doPick = async (): Promise<void> => {
    const el = wv(); if (!el) return;
    stopPickLoop();
    setStatus('Click an element in the preview…');
    await startPick(el);
    pollRef.current = setInterval(async () => {
      const r = await readPick(el);
      if (r) {
        stopPickLoop();
        const ref = r.testid ?? r.suggestion ?? null;
        onPick(ref);
        setStatus(ref ? `Picked [data-testid="${ref}"]` : `Picked <${r.tag}> "${r.text.slice(0, 24)}" (no testid)`);
      }
    }, 300);
    timeoutRef.current = setTimeout(() => { stopPickLoop(); void cancelPick(el); }, 20_000);
  };

  const doA11y = async (): Promise<void> => { const el = wv(); if (el) setA11y(await a11ySnapshot(el)); };
  const doTap = async (): Promise<void> => { const el = wv(); if (el && picked) { const r = await tap(el, picked); setStatus(r.ok ? `Tapped ${picked}` : `Tap failed: ${r.error ?? ''}`); } };
  const doType = async (): Promise<void> => { const el = wv(); if (el && picked) { const r = await typeText(el, picked, typeVal); setStatus(r.ok ? `Typed into ${picked}` : `Type failed: ${r.error ?? ''}`); } };

  return (
    <aside className="ds-testinspect" aria-label="Flow inspector">
      <p className="ds-eyebrow">Drive the flow</p>
      <div className="ds-inspect-actions">
        <button className="ds-iconbtn" onClick={() => void doPick()}>Pick</button>
        <button className="ds-iconbtn" onClick={() => void doA11y()}>Inspect a11y</button>
        <button className="ds-iconbtn" disabled={!picked} onClick={() => void doTap()}>Tap</button>
      </div>
      <div className="ds-inspect-actions">
        <input className="ds-select" placeholder="type text…" aria-label="Text to type" value={typeVal} onChange={(e) => setTypeVal(e.target.value)} />
        <button className="ds-iconbtn" disabled={!picked} onClick={() => void doType()}>Type</button>
      </div>

      <p className="ds-eyebrow">Selected</p>
      <p className="ds-testpicked" data-mono>{picked ? `[data-testid="${picked}"]` : '— pick an element —'}</p>

      <p className="ds-eyebrow">Status</p>
      <p data-mono className="ds-inspect-status">{status || '—'}</p>

      <p className="ds-eyebrow">Accessibility tree</p>
      {a11y.length === 0
        ? <p className="ds-inspect-status" data-mono>— run Inspect a11y —</p>
        : <ul className="ds-a11y">{a11y.map((n, i) => <li key={i} data-mono>{n.role} · {n.name}{n.testid ? ` · ${n.testid}` : ''}</li>)}</ul>}
    </aside>
  );
}
