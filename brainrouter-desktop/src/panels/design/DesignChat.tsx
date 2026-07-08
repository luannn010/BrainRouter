// brainrouter-desktop/src/panels/design/DesignChat.tsx
import React, { useEffect, useRef, useState } from 'react';
import { buildUiFixPrompt } from '../../lib/design/prototypeMeta.js';
import type { PrototypeEntry } from '../../lib/design/prototypeMeta.js';

type Line = { role: 'you' | 'brainrouter'; text: string };

export function DesignChat({ selected, picked, onApplied }: {
  selected: PrototypeEntry | null;
  picked: string | null;
  onApplied: () => void;
}): React.ReactElement {
  const [draft, setDraft] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [live, setLive] = useState('');
  const [running, setRunning] = useState(false);
  const liveRef = useRef('');

  // Subscribe to agent stream in isolation (own liveText; does not touch the main chat state).
  useEffect(() => {
    const off = window.brainrouter.onEvent((msg: unknown) => {
      const e = ((msg as { event?: { kind?: string; text?: string } }).event ?? msg) as { kind?: string; text?: string };
      if (e?.kind === 'assistant-delta') { liveRef.current += e.text ?? ''; setLive(liveRef.current); }
      else if (e?.kind === 'assistant-turn-end') {
        const text = liveRef.current.trim();
        liveRef.current = ''; setLive('');
        setRunning(false);
        if (text) setLines((l) => [...l, { role: 'brainrouter', text }]);
        onApplied(); // reload the preview — the file was just edited
      }
    });
    return off;
  }, [onApplied]);

  const submit = (): void => {
    const instruction = draft.trim();
    if (!instruction || !selected || running) return;
    const prompt = buildUiFixPrompt({ relPath: selected.path, instruction, pickedRef: picked });
    setLines((l) => [...l, { role: 'you', text: instruction }]);
    setDraft(''); setRunning(true); liveRef.current = ''; setLive('');
    // `hidden: true` keeps this design-fix turn OUT of the main chat transcript
    // (the dock renders its own stream via onEvent). AgentCommand supports it:
    // { kind:'start-turn'; prompt; hidden?; images? }. If, at runtime, `hidden`
    // also suppresses the assistant-delta events the dock listens for, drop it
    // and accept a shared transcript for v1 (see Task 10 Notes).
    window.brainrouter.send({ kind: 'start-turn', prompt, hidden: true } as never);
  };

  return (
    <div className="ds-chat">
      <div className="ds-chat-head">
        <span className="ds-eyebrow">Fix UI</span>
        <span className="ds-mono ds-chat-target" data-mono>{selected ? selected.title : 'no prototype'}{picked ? ` · ${picked}` : ''}</span>
      </div>
      <div className="ds-chat-log">
        {lines.map((l, i) => <div key={i} className={`ds-msg ds-msg--${l.role}`}><span className="ds-eyebrow">{l.role}</span><div>{l.text}</div></div>)}
        {running && <div className="ds-msg ds-msg--brainrouter"><span className="ds-eyebrow"><span className="ds-dot ds-dot--live" /> brainrouter</span><div>{live || 'editing the prototype…'}</div></div>}
      </div>
      <form className="ds-chat-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <textarea className="ds-chat-input" rows={2} placeholder={selected ? 'e.g. make the primary button use the Signal color' : 'Select a prototype first'} value={draft}
          disabled={!selected || running}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <button className="ds-btn ds-btn--accent" type="submit" disabled={!selected || running || !draft.trim()}>{running ? 'Fixing…' : 'Fix'}</button>
      </form>
    </div>
  );
}
