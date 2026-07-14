// brainrouter-desktop/src/panels/design/DesignsView.tsx
import React from 'react';
import { PreviewCanvas, type PreviewHandle, type Device, type PickInfo } from './PreviewCanvas.js';
import { DesignChatRail, type DesignChatControls } from './DesignChatRail.js';
import type { PrototypesApi } from '../../lib/design/usePrototypes.js';

const DEVICES: Device[] = ['desktop', 'tablet', 'phone'];

/**
 * Designs — the mock prototypes: the FILES on the left, the live prototype in the
 * middle, and the flow inspector on the right. Preview and test share ONE webview,
 * so what you drive is exactly the frame you see.
 */
export function DesignsView({ workspaceRoot, protos, device, setDevice, previewRef, picked, onPick, controls }: {
  workspaceRoot?: string;
  protos: PrototypesApi;
  device: Device;
  setDevice: (d: Device) => void;
  previewRef: React.RefObject<PreviewHandle>;
  picked: PickInfo | null;
  onPick: (info: PickInfo | null) => void;
  controls: DesignChatControls;
}): React.ReactElement {
  return (
    <div className="ds-designs">
      <aside className="ds-files" aria-label="Flows">
        <div className="ds-files-head">
          <span className="ds-eyebrow">Flows</span>
          <button className="ds-iconbtn" onClick={protos.refresh} aria-label="Refresh flows">Refresh</button>
        </div>
        {protos.error && <p className="ds-empty ds-error">{protos.error}</p>}
        {!protos.error && protos.entries.length === 0 && (
          <p className="ds-empty">No flows yet. Ask the Fix chat to generate one.</p>
        )}
        <ul className="ds-filelist">
          {protos.entries.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={`ds-fileitem${protos.selected?.id === e.id ? ' is-selected' : ''}`}
                aria-current={protos.selected?.id === e.id}
                onClick={() => protos.select(e.id)}
              >
                <span className="ds-fileitem-title">{e.title}</span>
                <span className="ds-fileitem-path" data-mono>{e.path}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="ds-designs-main">
        <div className="ds-canvas-bar">
          <span className="ds-eyebrow">{protos.selected?.title ?? 'No flow'}</span>
          <span className="ds-nav-spacer" />
          {DEVICES.map((d) => (
            <button key={d} className="ds-iconbtn" aria-pressed={device === d} onClick={() => setDevice(d)}>{d}</button>
          ))}
          <button className="ds-iconbtn" onClick={() => previewRef.current?.reload()}>Reload</button>
        </div>
        <PreviewCanvas ref={previewRef} workspaceRoot={workspaceRoot} selected={protos.selected} device={device} />
      </div>

      <DesignChatRail selected={protos.selected} previewRef={previewRef} picked={picked} onPick={onPick} controls={controls} />
    </div>
  );
}
