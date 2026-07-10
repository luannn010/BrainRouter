// brainrouter-desktop/src/panels/DesignStudioPanel.tsx
import React, { useRef, useState } from 'react';
import './design/designStudio.css';
import { CanvasView } from './design/CanvasView.js';
import { BrandsView } from './design/BrandsView.js';
import { DesignsView } from './design/DesignsView.js';
import { usePrototypes } from '../lib/design/usePrototypes.js';
import { type PreviewHandle, type Device } from './design/PreviewCanvas.js';
import { DesignChat } from './design/DesignChat.js';

export type StudioTab = 'canvas' | 'brands' | 'designs';

const TABS: Array<{ id: StudioTab; label: string; hint: string }> = [
  { id: 'canvas', label: 'Canvas', hint: 'All prototype flows on one infinite canvas' },
  { id: 'brands', label: 'Brands', hint: 'The brand system: colour, type, shape, motion, voice' },
  { id: 'designs', label: 'Designs', hint: 'Preview, drive and inspect a prototype' },
];

export function DesignStudioPanel({ workspaceRoot, branch }: { workspaceRoot?: string; branch?: string | null }): React.ReactElement {
  const [tab, setTab] = useState<StudioTab>('canvas');
  const [chatOpen, setChatOpen] = useState(false);
  const protos = usePrototypes();
  const [device, setDevice] = useState<Device>('desktop');
  // ONE webview for the whole studio — Designs previews it, the inspector drives it,
  // and the fix chat reloads it. No second instance to drift out of sync.
  const previewRef = useRef<PreviewHandle>(null);
  const [picked, setPicked] = useState<string | null>(null);
  // Bumped after an agent edit so the Canvas re-reads every frame's HTML.
  const [canvasKey, setCanvasKey] = useState(0);

  const openInDesigns = (id: string): void => { protos.select(id); setTab('designs'); };

  return (
    <div className="design-studio">
      <div className="ds-nav">
        <span className="ds-nav-brand ds-eyebrow">Design Studio</span>
        <span className="ds-nav-spacer" />
        <div className="ds-seggroup" role="tablist" aria-label="Design Studio sections">
          {TABS.map((t) => (
            <button key={t.id} role="tab" className="ds-seg" aria-selected={tab === t.id} title={t.hint} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="ds-nav-spacer" />
        <button className="ds-chat-toggle" aria-pressed={chatOpen} onClick={() => setChatOpen((v) => !v)}>Fix chat</button>
      </div>

      <div className="ds-body">
        <div className="ds-view" role="tabpanel">
          {tab === 'canvas' && <CanvasView key={canvasKey} onOpenInDesigns={openInDesigns} />}
          {tab === 'brands' && <BrandsView branch={branch} commit={null} iso={new Date().toISOString()} />}
          {tab === 'designs' && (
            <DesignsView
              workspaceRoot={workspaceRoot}
              protos={protos}
              device={device}
              setDevice={setDevice}
              previewRef={previewRef}
              picked={picked}
              onPick={setPicked}
            />
          )}
        </div>

        {chatOpen && (
          <DesignChat
            selected={protos.selected}
            picked={picked}
            onApplied={() => {
              // Surface the edit on the shared preview: reload if Designs is mounted,
              // otherwise switch to it (mounting loads the just-edited file fresh).
              if (tab === 'designs') previewRef.current?.reload(); else setTab('designs');
              setTimeout(() => { protos.refresh(); setCanvasKey((k) => k + 1); }, 400);
            }}
          />
        )}
      </div>
    </div>
  );
}
