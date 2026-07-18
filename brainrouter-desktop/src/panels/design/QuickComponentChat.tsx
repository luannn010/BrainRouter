// brainrouter-desktop/src/panels/design/QuickComponentChat.tsx
// A small prompt box anchored where you right-clicked, in the style of VS
// Code's inline chat: one line in, one component out, placed right there.
//
// Deliberately NOT the agent loop: `design:quick-generate` is a one-shot
// completion, so generating a component never writes files and never appears
// in the main chat transcript. Rendered through a portal because the canvas is
// transform-scaled and a positioned child would inherit that scale.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../icons.js';
import { bridgeQuery } from '../../lib/bridgeQuery.js';

const WIDTH = 360;

export function QuickComponentChat({ at, onGenerated, onClose }: {
  /** Client coordinates of the click that asked for a component. */
  at: { x: number; y: number };
  onGenerated: (html: string, name: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bridgeQuery<{ model?: string }>('config-snapshot', {})
      .then((snapshot) => setModel(snapshot?.model ?? null))
      .catch(() => setModel(null));
  }, []);

  // Dismiss on Escape or a click outside, the same way the context menu does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onDown = (e: PointerEvent): void => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose]);

  const submit = (): void => {
    const instruction = prompt.trim();
    if (!instruction || busy) return;
    setBusy(true);
    setError(null);
    void bridgeQuery<{ html?: string; error?: string }>('design:quick-generate', { prompt: instruction }, 60_000)
      .then((result) => {
        if (result?.error || !result?.html?.trim()) { setError(result?.error ?? 'The model returned nothing.'); return; }
        onGenerated(result.html, instruction.slice(0, 40));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  };

  const left = Math.max(8, Math.min(at.x, window.innerWidth - WIDTH - 8));
  const top = Math.max(8, Math.min(at.y, window.innerHeight - 96));

  return createPortal(
    <div ref={ref} className="ds-inline-chat" style={{ left, top, width: WIDTH }} role="dialog" aria-label="Create a component">
      <div className="ds-inline-chat-row">
        <Icon name="spark" size={13} />
        <input autoFocus className="ds-inline-chat-input" value={prompt} disabled={busy}
          placeholder="Describe a component — a primary button, a price card…"
          aria-label="Describe the component"
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
        <button type="button" className="ds-inline-chat-go" disabled={busy || !prompt.trim()} onClick={submit}
          aria-label="Generate component" title="Generate (Enter)">
          <Icon name="chev-up" size={12} />
        </button>
        <button type="button" className="ds-inline-chat-close" onClick={onClose} aria-label="Close" title="Close (Esc)">
          <Icon name="close" size={12} />
        </button>
      </div>
      <div className="ds-inline-chat-foot">
        <small data-mono>{busy ? 'Generating…' : model ?? 'no model configured'}</small>
      </div>
      {error ? <p className="ds-inline-chat-error" role="alert">{error}</p> : null}
    </div>,
    document.body,
  );
}
