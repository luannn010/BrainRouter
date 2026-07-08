// brainrouter-desktop/src/panels/DesignStudioPanel.tsx
import React, { useRef, useState } from 'react';
import './design/designStudio.css';
import { SystemView } from './design/SystemView.js';
import { usePrototypes } from '../lib/design/usePrototypes.js';
import { PreviewCanvas, type PreviewHandle, type Device } from './design/PreviewCanvas.js';
import { TestCanvas } from './design/TestCanvas.js';

export type StudioTab = 'system' | 'preview' | 'test';

const TABS: Array<{ id: StudioTab; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'preview', label: 'Preview' },
  { id: 'test', label: 'Test' },
];

export function DesignStudioPanel({ workspaceRoot, branch }: { workspaceRoot?: string; branch?: string | null }): React.ReactElement {
  const [tab, setTab] = useState<StudioTab>('system');
  const [chatOpen, setChatOpen] = useState(false);
  const protos = usePrototypes();
  const [device, setDevice] = useState<Device>('desktop');
  const previewRef = useRef<PreviewHandle>(null);
  const [picked, setPicked] = useState<string | null>(null);

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
          {tab === 'preview' && (
            <div className="ds-testwrap">
              <div className="ds-canvas-bar">
                <select className="ds-select" value={protos.selected?.id ?? ''} onChange={(e) => protos.select(e.target.value)}>
                  {protos.entries.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
                {(['desktop', 'tablet', 'phone'] as Device[]).map((d) => (
                  <button key={d} className="ds-iconbtn" aria-pressed={device === d} onClick={() => setDevice(d)}>{d}</button>
                ))}
                <span className="ds-nav-spacer" />
                <button className="ds-iconbtn" onClick={() => previewRef.current?.reload()}>Reload</button>
              </div>
              <PreviewCanvas ref={previewRef} workspaceRoot={workspaceRoot} selected={protos.selected} device={device} />
            </div>
          )}
          {tab === 'test' && <TestCanvas workspaceRoot={workspaceRoot} selected={protos.selected} device={device} picked={picked} onPick={setPicked} />}
        </div>
        {chatOpen && <div className="ds-empty" style={{ width: 320, borderLeft: '1px solid var(--ds-border)' }}>Fix chat — Task 9.</div>}
      </div>
    </div>
  );
}
