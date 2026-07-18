// brainrouter-desktop/src/DesignWindow.tsx
// The Design Studio as its own window (main.ts opens it with #design). It is a
// deliberately thin shell: a project switcher and the studio, with none of the
// chat/track chrome — the canvas gets the whole window.
//
// Switching project here calls workspace:open, which swaps the host INSIDE this
// window, exactly as the main window's project list does. So a design window
// behaves like a second workspace window that happens to show one panel.
import React, { useEffect, useState } from 'react';
import { Icon } from './icons.js';
import { DesignStudioPanel } from './panels/DesignStudioPanel.js';

interface Workspaces { current: string | null; recents: string[] }

/** `\path\to\thing` → `thing`, for the switcher's label. */
function basename(root: string): string {
  const parts = root.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? root;
}

export function DesignWindow(): React.ReactElement {
  const [workspaces, setWorkspaces] = useState<Workspaces>({ current: null, recents: [] });
  const [branch, setBranch] = useState<string | undefined>(undefined);
  const [switching, setSwitching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = (): void => {
    void window.brainrouter.workspaceRecents()
      .then((next) => setWorkspaces({ current: next.current ?? null, recents: next.recents ?? [] }))
      .catch(() => undefined);
  };
  useEffect(refresh, []);

  // The window title already names the project; keep the document in step so
  // the OS window list is readable when several are open.
  useEffect(() => {
    if (workspaces.current) document.title = `Design — ${basename(workspaces.current)}`;
  }, [workspaces.current]);

  useEffect(() => {
    const off = window.brainrouter.onEvent((msg: unknown) => {
      const event = ((msg as { event?: { kind?: string; branch?: string } }).event ?? msg) as { kind?: string; branch?: string };
      if (event?.kind === 'session-changed') { setSwitching(false); refresh(); }
      if (typeof event?.branch === 'string') setBranch(event.branch);
    });
    return off;
  }, []);

  const choose = (root: string): void => {
    setOpen(false);
    if (root === workspaces.current) return;
    setSwitching(true);
    setNotice(null);
    void window.brainrouter.openWorkspace(root)
      .then((result) => {
        if (result?.needsTrust) { setSwitching(false); setNotice(`${basename(root)} is not trusted yet — open it once in the main window to trust it.`); return; }
        if (!result?.opened) { setSwitching(false); setNotice(`Could not open ${basename(root)}.`); return; }
        setWorkspaces((current) => ({ ...current, current: root }));
      })
      .catch(() => { setSwitching(false); setNotice('Could not reach the workspace.'); });
  };

  return <div className="design-window">
    <header className="design-window-bar">
      <span className="design-window-brand"><Icon name="design-studio" size={14} /><strong>Design</strong></span>
      <div className="pop-wrap">
        {open ? <div className="menu-pop left design-window-menu" role="menu">
          {workspaces.recents.length === 0 ? <p className="ds-empty">No projects yet.</p> : null}
          {workspaces.recents.map((root) => (
            <button key={root} type="button" role="menuitem" className={root === workspaces.current ? 'is-active' : ''} onClick={() => choose(root)}>
              <Icon name="folder" size={12} />
              <span>{basename(root)}</span>
              <small data-mono>{root}</small>
            </button>
          ))}
        </div> : null}
        <button type="button" className="design-window-project" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name="folder" size={13} />
          <span>{workspaces.current ? basename(workspaces.current) : 'Choose a project'}</span>
          <Icon name="chev-down" size={11} />
        </button>
      </div>
      {switching ? <span className="design-window-status"><span className="spinner" /> Opening…</span> : null}
      {notice ? <span className="design-window-status is-warn" role="status">{notice}</span> : null}
    </header>
    <div className="design-window-body">
      {workspaces.current
        ? <DesignStudioPanel key={workspaces.current} workspaceRoot={workspaces.current} branch={branch} />
        : <div className="ds-empty">Choose a project to start designing.</div>}
    </div>
  </div>;
}
