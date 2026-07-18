// brainrouter-desktop/src/panels/DesignStudioPanel.tsx
import React, { useCallback, useRef, useState } from 'react';
import { Icon } from '../icons.js';
import { ResettableBoundary } from '../components/primitives/ResettableBoundary.js';
import './design/designStudio.css';
import { BrandsView } from './design/BrandsView.js';
import { DesignsView } from './design/DesignsView.js';
import { usePrototypes } from '../lib/design/usePrototypes.js';
import { type PreviewHandle, type Device, type PickInfo } from './design/PreviewCanvas.js';
import { DesignChat } from './design/DesignChat.js';
import type { DesignChatControls } from './design/DesignChatRail.js';

export type StudioTab = 'designs' | 'brands';

// Canvas is gone: it was a read-only board of the same prototypes the Design
// tab now renders on a real world canvas you can drag, resize, annotate and
// pack into components. Keeping both meant one of them was always the wrong
// place to click.
const TABS: Array<{ id: StudioTab; label: string; hint: string }> = [
  { id: 'designs', label: 'Design', hint: 'Preview, drive and inspect a prototype' },
  { id: 'brands', label: 'Brands', hint: 'The brand system: colour, type, shape, motion, voice' },
];

// Fallback for the side-panel rendering (renderPanelBody), which has no composer
// state — the chat still runs and picks; only the model/mode selects go inert.
const NO_CHAT_CONTROLS: DesignChatControls = { q: () => { /* no-op */ }, modelChoices: [], modeLabel: '', effort: '' };

export function DesignStudioPanel({ workspaceRoot, branch, railOpen = true, onOpenRail, chat = NO_CHAT_CONTROLS, onRouteToMainChat, chatOpen: chatOpenProp, onChatOpenChange }: { workspaceRoot?: string; branch?: string | null; railOpen?: boolean; onOpenRail?: () => void; chat?: DesignChatControls; onRouteToMainChat?: (prompt: string) => void; chatOpen?: boolean; onChatOpenChange?: (open: boolean) => void }): React.ReactElement {
  const [tab, setTab] = useState<StudioTab>('designs');
  // Design mode controls the fix chat from the app's top-right cluster
  // (TopbarRight); the side-panel route passes no props and falls back to
  // local state (opened via the inspector's "Open Fix Chat", closed via the
  // chat header's ×).
  const [chatOpenLocal, setChatOpenLocal] = useState(false);
  const chatOpen = chatOpenProp ?? chatOpenLocal;
  const setChatOpen = onChatOpenChange ?? setChatOpenLocal;
  const protos = usePrototypes(workspaceRoot);
  const [device, setDevice] = useState<Device>('desktop');
  // ONE webview for the whole studio — Designs previews it, the inspector drives it,
  // and the fix chat reloads it. No second instance to drift out of sync.
  const previewRef = useRef<PreviewHandle>(null);
  const [picked, setPicked] = useState<PickInfo | null>(null);
  const [draftContext, setDraftContext] = useState<string | null>(null);

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
          {/* One boundary per view, keyed by the tab. The app-wide boundary in
              main.tsx replaces the whole window, so a throw in any one of these
              took the nav down with it and "Dismiss" re-rendered the same broken
              view — errors on every tab switch, with no way back but a reload. */}
          <ResettableBoundary resetKey={tab} label={TABS.find((t) => t.id === tab)?.label ?? 'This view'}>
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
                onOpenAi={() => setChatOpen(true)}
                onDraftContextChange={setDraftContext}
              />
            )}
          </ResettableBoundary>
        </div>

        {chatOpen && (
          <DesignChat
            selected={protos.selected}
            picked={picked?.testid ?? null}
            draftContext={draftContext}
            onClose={() => setChatOpen(false)}
            onRouteToMainChat={onRouteToMainChat ? (prompt) => { setChatOpen(false); onRouteToMainChat(prompt); } : undefined}
            onApplied={() => {
              // Surface the edit on the shared preview: reload if Designs is mounted,
              // otherwise switch to it (mounting loads the just-edited file fresh).
              if (tab === 'designs') previewRef.current?.reload(); else setTab('designs');
              setTimeout(() => { protos.refresh(); }, 400);
            }}
          />
        )}
      </div>
    </div>
  );
}
