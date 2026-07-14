// brainrouter-desktop/src/panels/DesignStudioPanel.tsx
import React, { useCallback, useRef, useState } from 'react';
import { Icon } from '../icons.js';
import './design/designStudio.css';
import { CanvasView } from './design/CanvasView.js';
import { BrandsView } from './design/BrandsView.js';
import { DesignsView } from './design/DesignsView.js';
import { usePrototypes } from '../lib/design/usePrototypes.js';
import { type PreviewHandle, type Device, type PickInfo } from './design/PreviewCanvas.js';
import { DesignChat } from './design/DesignChat.js';
import type { DesignChatControls } from './design/DesignChatRail.js';

export type StudioTab = 'canvas' | 'brands' | 'designs';

const TABS: Array<{ id: StudioTab; label: string; hint: string }> = [
  { id: 'canvas', label: 'Canvas', hint: 'All prototype flows on one infinite canvas' },
  { id: 'brands', label: 'Brands', hint: 'The brand system: colour, type, shape, motion, voice' },
  { id: 'designs', label: 'Designs', hint: 'Preview, drive and inspect a prototype' },
];

// Fallback for the side-panel rendering (renderPanelBody), which has no composer
// state — the chat still runs and picks; only the model/mode selects go inert.
const NO_CHAT_CONTROLS: DesignChatControls = { q: () => { /* no-op */ }, modelChoices: [], modeLabel: '', effort: '' };

export function DesignStudioPanel({ workspaceRoot, branch, railOpen = true, onOpenRail, chat = NO_CHAT_CONTROLS }: { workspaceRoot?: string; branch?: string | null; railOpen?: boolean; onOpenRail?: () => void; chat?: DesignChatControls }): React.ReactElement {
  const [tab, setTab] = useState<StudioTab>('canvas');
  const [chatOpen, setChatOpen] = useState(false);
  const protos = usePrototypes();
  const [device, setDevice] = useState<Device>('desktop');
  // ONE webview for the whole studio — Designs previews it, the inspector drives it,
  // and the fix chat reloads it. No second instance to drift out of sync.
  const previewRef = useRef<PreviewHandle>(null);
  const [picked, setPicked] = useState<PickInfo | null>(null);
  // Bumped after an agent edit so the Canvas re-reads every frame's HTML.
  const [canvasKey, setCanvasKey] = useState(0);

  // Stable identity so the Canvas's memoised frames don't re-render on every tick.
  const openInDesigns = useCallback((id: string): void => { protos.select(id); setTab('designs'); }, [protos.select]);

  return (
    <div className="design-studio">
      <div className="ds-nav">
        <div className="ds-nav-left">
          {/* Design mode has no Chat/Track header, so the "open sidebar"
              affordance lives here. Without it, hiding the left rail in the
              Design tab leaves no way to bring it back. */}
          {!railOpen && onOpenRail ? (
            <button type="button" className="ds-chat-toggle ds-chat-toggle--icon" title="Open sidebar" aria-label="Open sidebar" onClick={onOpenRail}>
              <Icon name="layout" size={15} />
            </button>
          ) : null}
          {/* Fix-chat trigger — sits to the LEFT of the brand. Moved off the
              right edge, where the app's floating top-right cluster (settings ·
              export · side-panel) covered it. */}
          <button
            type="button"
            className="ds-chat-toggle ds-chat-toggle--icon"
            aria-pressed={chatOpen}
            aria-label="Fix chat"
            title="Fix chat — describe a UI change and BrainRouter edits the prototype"
            onClick={() => setChatOpen((v) => !v)}
          >
            <Icon name="bubble" size={16} />
          </button>
          <span className="ds-nav-brand ds-eyebrow">Design Studio</span>
        </div>
        <div className="ds-seggroup" role="tablist" aria-label="Design Studio sections">
          {TABS.map((t) => (
            <button key={t.id} role="tab" className="ds-seg" aria-selected={tab === t.id} title={t.hint} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
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
              controls={chat}
            />
          )}
        </div>

        {chatOpen && (
          <DesignChat
            selected={protos.selected}
            picked={picked?.testid ?? null}
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
