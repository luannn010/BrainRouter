// brainrouter-desktop/src/panels/design/TestCanvas.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { WebviewEl } from '../../lib/uitest/webviewBridge.js';
import { startPick, readPick, cancelPick, a11ySnapshot, tap, typeText } from '../../lib/uitest/webviewBridge.js';
import { PreviewCanvas, type PreviewHandle, type Device } from './PreviewCanvas.js';
import type { PrototypeEntry } from '../../lib/design/prototypeMeta.js';

export function TestCanvas({ workspaceRoot, selected, device, picked, onPick }: {
  workspaceRoot?: string;
  selected: PrototypeEntry | null;
  device: Device;
  picked: string | null;
  onPick: (ref: string | null) => void;
}): React.ReactElement {
  const previewRef = useRef<PreviewHandle>(null);
  const [a11y, setA11y] = useState<Array<{ role: string; name: string; testid?: string }>>([]);
  const [typeVal, setTypeVal] = useState('');
  const [status, setStatus] = useState('');

  const wv = (): WebviewEl | null => previewRef.current?.getWebview() ?? null;

  // Track the in-flight pick loop so it can't outlive the component (leak on tab switch).
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
    stopPickLoop(); // cancel any in-flight pick before starting a new one
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
    <div className="ds-testwrap">
      <div className="ds-canvas-bar">
        <button className="ds-iconbtn" onClick={() => void doPick()}>Pick</button>
        <button className="ds-iconbtn" onClick={() => void doA11y()}>Inspect a11y</button>
        <button className="ds-iconbtn" disabled={!picked} onClick={() => void doTap()}>Tap</button>
        <input className="ds-select" placeholder="type text…" value={typeVal} onChange={(e) => setTypeVal(e.target.value)} />
        <button className="ds-iconbtn" disabled={!picked} onClick={() => void doType()}>Type</button>
        <span className="ds-nav-spacer" />
        <button className="ds-iconbtn" onClick={() => previewRef.current?.reload()}>Reload</button>
      </div>
      <div className="ds-testsplit">
        <PreviewCanvas ref={previewRef} workspaceRoot={workspaceRoot} selected={selected} device={device} />
        <aside className="ds-testinspect">
          <p className="ds-eyebrow">Selected</p>
          <p className="ds-mono ds-testpicked" data-mono>{picked ? `[data-testid="${picked}"]` : '— pick an element —'}</p>
          <p className="ds-eyebrow">Status</p>
          <p className="ds-mono" data-mono>{status || '—'}</p>
          <p className="ds-eyebrow">Accessibility tree</p>
          <ul className="ds-a11y">
            {a11y.map((n, i) => <li key={i} data-mono>{n.role} · {n.name}{n.testid ? ` · ${n.testid}` : ''}</li>)}
          </ul>
        </aside>
      </div>
    </div>
  );
}
