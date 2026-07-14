// brainrouter-desktop/src/panels/design/DesignChatRail.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../../icons.js';
import { buildUiFixPrompt, type PrototypeEntry } from '../../lib/design/prototypeMeta.js';
import { bridgeQuery } from '../../lib/bridgeQuery.js';
import type { BrandOverrides } from '../../lib/design/designTokens.js';
import type { PreviewHandle, PickInfo } from './PreviewCanvas.js';

type Line = { role: 'you' | 'brainrouter'; text: string };

/** The session modes exactly as the main composer sets them. */
const MODES: Array<{ label: string; executionMode: string; reviewPolicy: string }> = [
  { label: 'Plan mode', executionMode: 'planning', reviewPolicy: 'request' },
  { label: 'Accept edits', executionMode: 'fast', reviewPolicy: 'request' },
  { label: 'Auto mode', executionMode: 'fast', reviewPolicy: 'proceed' },
];
const EFFORTS = ['low', 'medium', 'high'];

/** Chat controls reused from the app so a fix turn runs in the active session
 *  with the model/mode/effort the user picks here. */
export interface DesignChatControls {
  q: (id: string, name: string, args?: Record<string, unknown>) => void;
  modelChoices: string[];
  currentModel?: string;
  modeLabel: string;
  effort: string;
}

/**
 * Designs "Fix chat" rail — replaces the old flow inspector. A real agent chat
 * (streams a fix turn in the active session) with a compact model/mode/effort
 * row and a Claude-style element picker: "Pick element" arms the preview, hover
 * highlights, a click drops the element in as the fix target.
 */
export function DesignChatRail({ selected, previewRef, picked, onPick, controls }: {
  selected: PrototypeEntry | null;
  previewRef: React.RefObject<PreviewHandle>;
  picked: PickInfo | null;
  onPick: (info: PickInfo | null) => void;
  controls: DesignChatControls;
}): React.ReactElement {
  const [draft, setDraft] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [live, setLive] = useState('');
  const [running, setRunning] = useState(false);
  const [brandOverrides, setBrandOverrides] = useState<BrandOverrides | null>(null);
  const [picking, setPicking] = useState(false);
  const liveRef = useRef('');
  const runningRef = useRef(false);
  const stopPickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;
    bridgeQuery<{ overrides?: Partial<BrandOverrides> }>('design:read-brand-overrides', {})
      .then((result) => {
        if (!active || !result.overrides) return;
        setBrandOverrides({ typography: result.overrides.typography ?? {}, colors: result.overrides.colors ?? {} });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  // Stream the agent turn — gated on runningRef so this rail reacts only to its
  // OWN fix turn, not every unrelated turn on the shared event bus.
  useEffect(() => {
    const off = window.brainrouter.onEvent((msg: unknown) => {
      if (!runningRef.current) return;
      const e = ((msg as { event?: { kind?: string; text?: string } }).event ?? msg) as { kind?: string; text?: string };
      if (e?.kind === 'assistant-delta') { liveRef.current += e.text ?? ''; setLive(liveRef.current); }
      else if (e?.kind === 'assistant-turn-end') {
        const text = liveRef.current.trim();
        liveRef.current = ''; setLive('');
        runningRef.current = false; setRunning(false);
        if (text) setLines((l) => [...l, { role: 'brainrouter', text }]);
        previewRef.current?.reload(); // the flow file was just edited
      }
    });
    return off;
  }, [previewRef]);

  // Cancel any in-flight pick loop on unmount.
  useEffect(() => () => { stopPickRef.current?.(); }, []);

  const togglePick = (): void => {
    if (picking) { stopPickRef.current?.(); stopPickRef.current = null; setPicking(false); return; }
    if (!previewRef.current) return;
    setPicking(true);
    stopPickRef.current = previewRef.current.startPick((info) => {
      stopPickRef.current = null; setPicking(false);
      if (info) onPick(info);
    });
  };

  const submit = (): void => {
    const instruction = draft.trim();
    if (!instruction || !selected || running) return;
    const prompt = buildUiFixPrompt({ relPath: selected.path, instruction, pickedRef: picked?.testid ?? null, brandOverrides });
    setLines((l) => [...l, { role: 'you', text: instruction }]);
    setDraft(''); runningRef.current = true; setRunning(true); liveRef.current = ''; setLive('');
    // Runs in the ACTIVE session (same model/mode the controls below set). hidden
    // keeps the verbose fix prompt out of the main transcript.
    window.brainrouter.send({ kind: 'start-turn', prompt, hidden: true });
  };

  const setModel = (m: string): void => { if (m) window.brainrouter.send({ kind: 'set-model', model: m, persist: false }); };
  const pickMode = (label: string): void => { const m = MODES.find((x) => x.label === label); if (m) controls.q('a-mode', 'action:set-session-mode', { executionMode: m.executionMode, reviewPolicy: m.reviewPolicy }); };
  const setEffort = (lvl: string): void => controls.q('a-mode', 'action:set-session-mode', { effort: lvl });

  const cur = controls.currentModel ?? '';
  return (
    <aside className="ds-chatrail" aria-label="Fix chat">
      <div className="ds-chatrail-head">
        <span className="ds-eyebrow">Fix chat</span>
        <span className="ds-mono ds-chat-target" data-mono>{selected ? selected.title : 'no flow'}</span>
      </div>

      <div className="ds-chat-controls">
        <select className="ds-select" aria-label="Model" value={cur} onChange={(e) => setModel(e.target.value)}>
          {cur && !controls.modelChoices.includes(cur) ? <option value={cur}>{cur}</option> : null}
          {controls.modelChoices.length === 0 ? <option value="">default model</option> : null}
          {controls.modelChoices.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="ds-select" aria-label="Mode" value={MODES.some((m) => m.label === controls.modeLabel) ? controls.modeLabel : ''} onChange={(e) => pickMode(e.target.value)}>
          {!MODES.some((m) => m.label === controls.modeLabel) ? <option value="">{controls.modeLabel || 'mode'}</option> : null}
          {MODES.map((m) => <option key={m.label} value={m.label}>{m.label}</option>)}
        </select>
        <select className="ds-select" aria-label="Reasoning effort" value={EFFORTS.includes(controls.effort) ? controls.effort : ''} onChange={(e) => setEffort(e.target.value)}>
          {!EFFORTS.includes(controls.effort) ? <option value="">{controls.effort || 'effort'}</option> : null}
          {EFFORTS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
        </select>
      </div>

      <div className="ds-chat-controls">
        <button type="button" className={`ds-iconbtn${picking ? ' is-armed' : ''}`} aria-pressed={picking} onClick={togglePick} disabled={!selected}>
          <Icon name="search" size={12} />{picking ? 'Click an element · Esc' : 'Pick element'}
        </button>
        {picked ? (
          <span className="ds-pick-chip" data-mono title={picked.label}>
            {picked.label}
            <button type="button" className="ds-pick-clear" aria-label="Clear picked element" onClick={() => onPick(null)}><Icon name="close" size={9} /></button>
          </span>
        ) : null}
      </div>

      <div className="ds-chat-log">
        {lines.length === 0 && !running ? <p className="ds-empty">Describe a change and BrainRouter edits the flow. Pick an element first to target it.</p> : null}
        {lines.map((l, i) => <div key={i} className={`ds-msg ds-msg--${l.role}`}><span className="ds-eyebrow">{l.role}</span><div>{l.text}</div></div>)}
        {running && <div className="ds-msg ds-msg--brainrouter"><span className="ds-eyebrow"><span className="ds-dot ds-dot--live" /> brainrouter</span><div>{live || 'editing the flow…'}</div></div>}
      </div>

      <form className="ds-chat-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <textarea className="ds-chat-input" rows={2}
          placeholder={selected ? (picked ? `Fix ${picked.label}…` : 'e.g. make the Sign in button larger') : 'Select a flow first'}
          value={draft} disabled={!selected || running}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <button className="ds-btn ds-btn--accent" type="submit" disabled={!selected || running || !draft.trim()}>{running ? 'Fixing…' : 'Fix'}</button>
      </form>
    </aside>
  );
}
