// brainrouter-desktop/src/panels/design/QuickComponentChat.tsx
// A compact prompt box that turns a description into a component using the
// model configured in app settings. This is deliberately NOT the agent loop:
// `design:quick-generate` is a one-shot completion, so generating a component
// never writes files and never appears in the main chat transcript.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { bridgeQuery } from '../../lib/bridgeQuery.js';

export function QuickComponentChat({ onGenerated, onClose }: {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
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
        onClose();
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  };

  return createPortal(
    <div className="ds-quickchat-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="ds-quickchat" role="dialog" aria-label="Create a component with chat">
        <div className="ds-quickchat-head">
          <strong>Create a component</strong>
          <small data-mono>{model ?? 'no model configured'}</small>
        </div>
        <textarea className="ds-quickchat-input" autoFocus rows={3} value={prompt} placeholder="A pricing card with a title, a price and a primary button"
          aria-label="Describe the component" onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }} />
        {error ? <p className="ds-quickchat-error" role="alert">{error}</p> : null}
        <div className="ds-quickchat-actions">
          <button type="button" className="ds-iconbtn" onClick={onClose}>Cancel</button>
          <button type="button" className="ds-iconbtn is-primary" disabled={busy || !prompt.trim()} onClick={submit}>
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
