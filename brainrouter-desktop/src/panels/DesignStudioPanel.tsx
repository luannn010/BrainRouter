// brainrouter-desktop/src/panels/DesignStudioPanel.tsx
import React, { useState } from 'react';
import './design/designStudio.css';
import { SystemView } from './design/SystemView.js';

export type StudioTab = 'system' | 'preview' | 'test';

const TABS: Array<{ id: StudioTab; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'preview', label: 'Preview' },
  { id: 'test', label: 'Test' },
];

export function DesignStudioPanel({ workspaceRoot, branch }: { workspaceRoot?: string; branch?: string | null }): React.ReactElement {
  const [tab, setTab] = useState<StudioTab>('system');
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="design-studio">
      <div className="ds-nav" role="tablist" aria-label="Design Studio">
        {TABS.map((t) => (
          <button key={t.id} role="tab" className="ds-seg" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
        <span className="ds-nav-spacer" />
        <button className="ds-chat-toggle" aria-pressed={chatOpen} onClick={() => setChatOpen((v) => !v)}>Fix chat</button>
      </div>
      <div className="ds-body">
        <div className="ds-view" role="tabpanel">
          {tab === 'system' && <SystemView branch={branch} commit={null} iso={new Date().toISOString()} />}
          {tab === 'preview' && <div className="ds-empty">Preview canvas — Task 7.</div>}
          {tab === 'test' && <div className="ds-empty">Test canvas — Task 8.</div>}
        </div>
        {chatOpen && <div className="ds-empty" style={{ width: 320, borderLeft: '1px solid var(--ds-border)' }}>Fix chat — Task 9.</div>}
      </div>
    </div>
  );
}
