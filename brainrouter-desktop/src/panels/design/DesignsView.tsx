import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../icons.js';
import { bridgeQuery } from '../../lib/bridgeQuery.js';
import { extractDesignElements, resolvePickedElement, type DesignElement, type DraftOperation } from '../../lib/design/designElements.js';
import {
  ANNOTATIONS_STORAGE_KEY, annotationsKey, bringToFront, duplicateAnnotation,
  flipAnnotation, parseAnnotationStore, pasteAnnotation, removeAnnotation,
  sendToBack, serializeAnnotationStore, toggleAnnotationFlag, type DesignAnnotation,
} from '../../lib/design/designAnnotations.js';
import { isEditableTarget, shouldArmElementPicker, toolForKey, type DesignTool, type FrameKind, type ShapeKind } from '../../lib/design/designTools.js';
import { fitBounds, panBy, screenToWorld, snapTo, wheelGesture, zoomAt, type ViewBounds, type Viewport } from '../../lib/design/canvasViewport.js';
import { idsOfKind, isSelected, marqueeSelect, selectOnly, selectionBounds, toggleSelection, type SelectableItem, type Selection } from '../../lib/design/designSelection.js';
import { useCanvasDocument } from '../../lib/design/useCanvasDocument.js';
import { useCanvasFrames } from '../../lib/design/useCanvasFrames.js';
import type { CanvasNode } from '../../lib/design/canvasModel.js';
import type { MeasuredElement } from '../../lib/design/designMeasure.js';
import type { ConstraintBox } from '../../lib/design/designConstraints.js';
import { PreviewCanvas, type PreviewHandle, type Device, type PickInfo } from './PreviewCanvas.js';
import { DEVICE_SIZE, DesignScreen } from './DesignScreen.js';
import { DesignBottomToolbar } from './DesignBottomToolbar.js';
import { StageOverlay } from './StageOverlay.js';
import { DesignInspector, type InspectorTab } from './DesignInspector.js';
import { DesignResourceRail, type DesignResource } from './DesignResourceRail.js';
import { CanvasRulers } from './CanvasRulers.js';
import type { PrototypesApi } from '../../lib/design/usePrototypes.js';
import type { PrototypeFrame } from '../../lib/design/useCanvasFrames.js';

const DEVICES: Device[] = ['desktop', 'tablet', 'phone'];
const DRAFT_KEY = 'brainrouter.design-tab.drafts';
/** The live surface floats above every screen frame; frame z is a small index. */
const LIVE_LAYER_Z = 1000;

export function DesignsView({ workspaceRoot, protos, device, setDevice, previewRef, picked, onPick, onOpenAi, onDraftContextChange }: {
  workspaceRoot?: string;
  protos: PrototypesApi;
  device: Device;
  setDevice: (d: Device) => void;
  previewRef: React.RefObject<PreviewHandle>;
  picked: PickInfo | null;
  onPick: (info: PickInfo | null) => void;
  onOpenAi: () => void;
  onDraftContextChange: (context: string | null) => void;
}): React.ReactElement {
  const [resource, setResource] = useState<DesignResource>('files');
  const [tool, setTool] = useState<DesignTool>('select');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('design');
  const [frame, setFrame] = useState<PrototypeFrame | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [operations, setOperations] = useState<DraftOperation[]>([]);
  const [annotations, setAnnotations] = useState<DesignAnnotation[]>([]);
  const [selectedAnnoId, setSelectedAnnoId] = useState<string | null>(null);
  const [frameKind, setFrameKind] = useState<FrameKind>('frame');
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rectangle');
  // Session clipboard for annotations (never the OS clipboard).
  const [clipboard, setClipboard] = useState<DesignAnnotation | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [shellSize, setShellSize] = useState<{ w: number; h: number } | null>(null);
  // Bumped on webview dom-ready so pick-arming retries once the surface can pick.
  const [previewReady, setPreviewReady] = useState(0);
  const [pickCycle, setPickCycle] = useState(0);
  // The selected element's real box + computed styles, read back from the
  // preview so the inspector shows what IS rather than a placeholder.
  const [measured, setMeasured] = useState<MeasuredElement | null>(null);

  // --- World canvas -------------------------------------------------------
  // The shell is a fixed viewport; one world layer inside it carries
  // translate(pan) scale(zoom) and every screen is absolutely positioned in
  // world coordinates. Positions persist in the shared CanvasDocument.
  const [view, setView] = useState<Viewport>({ scale: 1, x: 64, y: 64 });
  const [selection, setSelection] = useState<Selection>([]);
  const [marquee, setMarquee] = useState<ViewBounds | null>(null);
  const [dragNodes, setDragNodes] = useState<CanvasNode[] | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const spaceRef = useRef(false);
  /** Set once the user pans or zooms; until then the board stays auto-framed. */
  const touchedRef = useRef(false);

  const { frames } = useCanvasFrames();
  const canvasEntries = useMemo(() => protos.entries.map((entry) => ({ id: entry.id })), [protos.entries]);
  const canvas = useCanvasDocument(canvasEntries);
  const nodes = canvas.document.nodes;
  const shownNodes = dragNodes ?? nodes;
  const contentById = useMemo(() => new Map(frames.map((item) => [item.id, item.content])), [frames]);
  const titleById = useMemo(() => new Map(protos.entries.map((entry) => [entry.id, entry.title])), [protos.entries]);
  const activeNode = shownNodes.find((node) => node.prototypeId === protos.selected?.id) ?? null;
  const screenItems: SelectableItem[] = useMemo(() => shownNodes.map((node) => ({
    kind: 'screen' as const,
    id: node.prototypeId,
    bounds: { x: node.position.x, y: node.position.y, w: node.width, h: node.height },
  })), [shownNodes]);

  const saveNodes = (next: CanvasNode[]): void => canvas.save({ ...canvas.document, nodes: next });

  useEffect(() => {
    let active = true;
    setSelectedRef(null);
    setSelectedAnnoId(null);
    if (!protos.selected) { setFrame(null); setAnnotations([]); return () => { active = false; }; }
    void bridgeQuery<{ path?: string; content?: string; error?: string }>('design:read-prototype', { id: protos.selected.id }).then((result) => {
      if (!active) return;
      if (result.error || !result.content) { setFrame(null); return; }
      setFrame({ ...protos.selected!, path: result.path ?? protos.selected!.path, content: result.content });
    }).catch(() => { if (active) setFrame(null); });
    try {
      const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? '{}') as Record<string, DraftOperation[]>;
      setOperations(saved[`${workspaceRoot ?? 'unknown'}:${protos.selected.id}`] ?? []);
    } catch { setOperations([]); }
    try {
      const store = parseAnnotationStore(window.localStorage.getItem(ANNOTATIONS_STORAGE_KEY));
      setAnnotations(store[annotationsKey(workspaceRoot, protos.selected.id)] ?? []);
    } catch { setAnnotations([]); }
    return () => { active = false; };
  }, [protos.selected?.id, workspaceRoot]);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const measure = (): void => setShellSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Ctrl/Cmd + wheel must preventDefault or the whole app zooms instead of the
  // canvas — React's synthetic onWheel is passive, so this is a native listener.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const onWheel = (e: WheelEvent): void => {
      const rect = shell.getBoundingClientRect();
      const gesture = wheelGesture(e);
      e.preventDefault();
      touchedRef.current = true;
      setView((current) => gesture.kind === 'zoom'
        ? zoomAt(current, gesture.factor, e.clientX - rect.left, e.clientY - rect.top)
        : panBy(current, gesture.dx, gesture.dy));
    };
    shell.addEventListener('wheel', onWheel, { passive: false });
    return () => shell.removeEventListener('wheel', onWheel);
  }, []);

  // Frame the ACTIVE screen until the user takes the view over. Fitting the
  // whole board here would open this tab at ~24% on a narrow shell, and the
  // Designs tab is an editing surface — you need to be able to read it. "Fit"
  // still frames everything on demand. Re-running on resize matters: the first
  // measurement lands before the flex layout settles.
  useEffect(() => {
    if (touchedRef.current || !shellSize || shellSize.w < 2) return;
    const focus = activeNode ?? shownNodes[0];
    if (!focus) return;
    setView(fitBounds({ x: focus.position.x, y: focus.position.y, w: focus.width, h: focus.height }, shellSize.w, shellSize.h, 48));
  }, [shellSize, activeNode?.prototypeId, shownNodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const elements = useMemo(() => frame ? extractDesignElements(frame.content) : [], [frame]);
  const selectedElement = elements.find((element) => element.ref === selectedRef) ?? resolvePickedElement(elements, picked) ?? null;

  // Re-measure whenever the selection, the surface or the draft changes. Debounced
  // because every keystroke in the inspector rewrites `operations`, and each
  // measure is a round trip into the guest document.
  useEffect(() => {
    const ref = selectedElement?.ref;
    if (!ref) { setMeasured(null); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      void previewRef.current?.measure(ref).then((result) => { if (active) setMeasured(result); }).catch(() => { if (active) setMeasured(null); });
    }, 120);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selectedElement?.ref, previewReady, operations]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const resolved = resolvePickedElement(elements, picked);
    if (!resolved) return;
    setSelectedRef(resolved.ref);
    setResource('components');
    setInspectorTab('design');
  }, [elements, picked]);

  // Inspect = one-shot element pick, then back to select. The pick script
  // preventDefaults guest clicks, so it arms ONLY while Inspect is active —
  // every other tool leaves the prototype fully interactive (drivable). The
  // stop handle is held and called on tool switch/unmount so pick mode never
  // leaks; the old inline startPick call discarded it.
  useEffect(() => {
    if (!shouldArmElementPicker(tool)) return;
    let disposed = false;
    const stop = previewRef.current?.startPick((info) => {
      if (disposed) return;
      onPick(info);
      const resolved = resolvePickedElement(elements, info);
      if (resolved) setSelectedRef(resolved.ref);
      if (resolved) setResource('components');
      if (info) setInspectorTab('design');
      if (tool === 'select') setPickCycle((cycle) => cycle + 1);
      else setTool('select');
    }) ?? null;
    return () => { disposed = true; stop?.(); };
  }, [tool, elements, onPick, previewReady, pickCycle]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeAnnotations = (next: DesignAnnotation[]): void => {
    setAnnotations(next);
    if (!protos.selected) return;
    try {
      const store = parseAnnotationStore(window.localStorage.getItem(ANNOTATIONS_STORAGE_KEY));
      store[annotationsKey(workspaceRoot, protos.selected.id)] = next;
      window.localStorage.setItem(ANNOTATIONS_STORAGE_KEY, serializeAnnotationStore(store));
    } catch { /* Local persistence is optional. */ }
  };

  // Keyboard map (Figma-style): tool keys V/H/F/S/R/L/O/T/I, Delete, Escape,
  // Ctrl+C/X/V/D clipboard ops, ]/[ z-order, Shift+H/V flips, Ctrl+Shift+H/L
  // hide/lock — never while typing in an input/textarea.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isEditableTarget(e.target as HTMLElement | null)) return;
      // Space arms hand-panning for as long as it is held, on any tool.
      if (e.code === 'Space') { spaceRef.current = true; e.preventDefault(); return; }
      const k = e.key.toLowerCase();
      const selected = selectedAnnoId ? annotations.find((a) => a.id === selectedAnnoId) ?? null : null;
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.shiftKey && k === 'h' && selected) { changeAnnotations(toggleAnnotationFlag(annotations, selected.id, 'hidden')); setSelectedAnnoId(null); e.preventDefault(); }
        else if (e.shiftKey && k === 'l' && selected) { changeAnnotations(toggleAnnotationFlag(annotations, selected.id, 'locked')); e.preventDefault(); }
        else if (k === 'c' && selected) { setClipboard({ ...selected }); e.preventDefault(); }
        else if (k === 'x' && selected) { setClipboard({ ...selected }); changeAnnotations(removeAnnotation(annotations, selected.id)); setSelectedAnnoId(null); e.preventDefault(); }
        else if (k === 'v' && clipboard) { const { list, id } = pasteAnnotation(annotations, clipboard); changeAnnotations(list); setSelectedAnnoId(id); e.preventDefault(); }
        else if (k === 'd' && selected) { const { list, id } = duplicateAnnotation(annotations, selected.id); changeAnnotations(list); setSelectedAnnoId(id); e.preventDefault(); }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.shiftKey) {
        if (k === 'h' && selected) { changeAnnotations(flipAnnotation(annotations, selected.id, 'x')); e.preventDefault(); }
        else if (k === 'v' && selected) { changeAnnotations(flipAnnotation(annotations, selected.id, 'y')); e.preventDefault(); }
        return;
      }
      if (e.key === ']') { if (selected) { changeAnnotations(bringToFront(annotations, selected.id)); e.preventDefault(); } return; }
      if (e.key === '[') { if (selected) { changeAnnotations(sendToBack(annotations, selected.id)); e.preventDefault(); } return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected) { changeAnnotations(removeAnnotation(annotations, selected.id)); setSelectedAnnoId(null); e.preventDefault(); }
        return;
      }
      if (e.key === '0') { fitAll(); e.preventDefault(); return; }
      if (e.key === 'Escape') { setSelectedAnnoId(null); setSelection([]); setTool('select'); return; }
      const next = toolForKey(e.key);
      if (next) {
        setTool(next.tool);
        if (next.frameKind) setFrameKind(next.frameKind);
        if (next.shapeKind) setShapeKind(next.shapeKind);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent): void => { if (e.code === 'Space') spaceRef.current = false; };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }); // no deps — re-attached per render so the handler always sees fresh state

  // One pointer entry point for the canvas: pan, drag a screen, select a
  // screen, or rubber-band. The screen BODY is deliberately not a drag handle —
  // the live prototype stays clickable, exactly as it was before the canvas.
  const onShellPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const shell = shellRef.current;
    if (!shell) return;
    const target = e.target as HTMLElement;
    const wantsPan = e.button === 1 || spaceRef.current || tool === 'hand';
    if (e.button !== 0 && !wantsPan) return;

    if (wantsPan) {
      const start = { x: e.clientX, y: e.clientY, view: viewRef.current };
      touchedRef.current = true;
      setIsPanning(true);
      const onMove = (ev: PointerEvent): void => setView(panBy(start.view, ev.clientX - start.x, ev.clientY - start.y));
      const onUp = (): void => {
        setIsPanning(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.preventDefault();
      return;
    }

    const screenEl = target.closest<HTMLElement>('.ds-screen, .ds-live-screen');
    const id = screenEl?.dataset.screenId ?? '';
    if (screenEl && id) {
      const node = nodes.find((item) => item.prototypeId === id);
      const next = e.shiftKey
        ? toggleSelection(selection, { kind: 'screen', id })
        : (isSelected(selection, 'screen', id) ? selection : selectOnly({ kind: 'screen', id }));
      setSelection(next);
      if (id !== protos.selected?.id) protos.select(id);
      if (!node || node.locked || !target.closest('.ds-screen-head')) return;

      const moving = new Set(idsOfKind(next, 'screen'));
      moving.add(id);
      const origins = new Map(nodes.filter((item) => moving.has(item.prototypeId)).map((item) => [item.prototypeId, item.position]));
      const grid = canvas.document.preferences.snapEnabled ? canvas.document.preferences.gridSize : 1;
      const start = { x: e.clientX, y: e.clientY, scale: viewRef.current.scale };
      let latest = nodes;
      const onMove = (ev: PointerEvent): void => {
        const dx = (ev.clientX - start.x) / start.scale;
        const dy = (ev.clientY - start.y) / start.scale;
        latest = nodes.map((item) => {
          const origin = origins.get(item.prototypeId);
          return origin ? { ...item, position: { x: snapTo(origin.x + dx, grid), y: snapTo(origin.y + dy, grid) } } : item;
        });
        setDragNodes(latest);
      };
      const onUp = (): void => {
        setDragNodes(null);
        saveNodes(latest);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.preventDefault();
      return;
    }

    if (tool !== 'select') return;
    const rect = shell.getBoundingClientRect();
    const origin = screenToWorld(viewRef.current, e.clientX - rect.left, e.clientY - rect.top);
    const onMove = (ev: PointerEvent): void => {
      const at = screenToWorld(viewRef.current, ev.clientX - rect.left, ev.clientY - rect.top);
      setMarquee({
        x: Math.min(origin.x, at.x), y: Math.min(origin.y, at.y),
        w: Math.abs(at.x - origin.x), h: Math.abs(at.y - origin.y),
      });
    };
    const onUp = (): void => {
      setMarquee((box) => {
        setSelection(box && (box.w > 2 || box.h > 2) ? marqueeSelect(screenItems, box) : []);
        return null;
      });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const setZoomPercent = (percent: number): void => {
    const shell = shellRef.current;
    if (!shell) return;
    touchedRef.current = true;
    setView((current) => zoomAt(current, (percent / 100) / current.scale, shell.clientWidth / 2, shell.clientHeight / 2));
  };
  const fitAll = (): void => {
    const shell = shellRef.current;
    if (!shell || screenItems.length === 0) return;
    const all = screenItems.map((item) => ({ kind: item.kind, id: item.id }));
    const bounds = selectionBounds(screenItems, selection.length ? selection : all);
    if (!bounds) return;
    touchedRef.current = true;
    setView(fitBounds(bounds, shell.clientWidth, shell.clientHeight, 64));
  };
  // Device presets resize the active screen rather than scaling the whole
  // stage — on a canvas, "phone" is a property of one screen, not the view.
  const applyDevice = (next: Device): void => {
    setDevice(next);
    if (!activeNode) return;
    const size = DEVICE_SIZE[next];
    saveNodes(nodes.map((node) => node.prototypeId === activeNode.prototypeId ? { ...node, width: size.w, height: size.h } : node));
  };

  // Constraints need the measured geometry of the ref they target; only the
  // selected element is measured, which is also the only one being edited.
  const measuredBoxes = (): Record<string, ConstraintBox> => measured ? { [measured.ref]: measured.box } : {};
  const updateOperation = (operation: DraftOperation): void => {
    setOperations((current) => {
      const next = [...current.filter((item) => !(item.elementRef === operation.elementRef && item.property === operation.property)), operation];
      void previewRef.current?.applyDraft(next, undefined, measuredBoxes());
      onDraftContextChange(JSON.stringify(next));
      return next;
    });
  };
  const saveDraft = (): void => {
    if (!protos.selected) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? '{}') as Record<string, DraftOperation[]>;
      saved[`${workspaceRoot ?? 'unknown'}:${protos.selected.id}`] = operations;
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(saved));
    } catch { /* Local persistence is optional. */ }
    void previewRef.current?.applyDraft(operations, undefined, measuredBoxes());
  };
  const revertDraft = (): void => {
    if (!protos.selected) return;
    setOperations([]);
    try {
      const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? '{}') as Record<string, DraftOperation[]>;
      delete saved[`${workspaceRoot ?? 'unknown'}:${protos.selected.id}`];
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(saved));
    } catch { /* Local persistence is optional. */ }
    previewRef.current?.reload();
  };
  const selectLayer = (ref: string): void => {
    setSelectedRef(ref);
    setInspectorTab('design');
    const element = elements.find((item) => item.ref === ref);
    if (element?.testid) onPick({ testid: element.testid, tag: element.tag, label: element.testid });
  };

  return <div className="ds-designs ds-design-editor">
    <DesignResourceRail activeResource={resource} onResourceChange={setResource} entries={protos.entries} selected={protos.selected} onSelect={protos.select} elements={elements} selectedRef={selectedRef} onLayerSelect={selectLayer} />
    <main className="ds-editor-stage">
      <div className="ds-canvas-bar"><div className="ds-stage-title"><Icon name="file" size={13} /><span>{protos.selected?.title ?? 'No flow'}</span><small data-mono>{protos.selected?.path ?? 'Choose a file from the left rail'}</small></div><span className="ds-nav-spacer" />{DEVICES.map((item) => <button key={item} type="button" className="ds-iconbtn" aria-pressed={device === item} onClick={() => applyDevice(item)}>{item}</button>)}<button type="button" className="ds-iconbtn" onClick={() => previewRef.current?.reload()} aria-label="Reload prototype"><Icon name="refresh" size={13} /></button></div>
      <div ref={shellRef} className={`ds-stage-shell ds-stage-shell--${tool}${isPanning ? ' is-panning' : ''}`} onPointerDown={onShellPointerDown}>
        <div className="ds-design-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          {shownNodes.map((node) => <DesignScreen key={node.prototypeId} node={node}
            title={titleById.get(node.prototypeId) ?? node.prototypeId}
            content={contentById.get(node.prototypeId) ?? null}
            active={node.prototypeId === protos.selected?.id}
            selected={isSelected(selection, 'screen', node.prototypeId)} />)}
          {activeNode ? <div className={`ds-live-screen${isSelected(selection, 'screen', activeNode.prototypeId) ? ' is-selected' : ''}`} data-screen-id={activeNode.prototypeId}
            style={{ left: activeNode.position.x, top: activeNode.position.y, width: activeNode.width, height: activeNode.height, zIndex: LIVE_LAYER_Z }}>
            <PreviewCanvas ref={previewRef} workspaceRoot={workspaceRoot} selected={protos.selected} device={device}
              overlay={<StageOverlay tool={tool} frameKind={frameKind} shapeKind={shapeKind} zoom={view.scale * 100} annotations={annotations} selectedId={selectedAnnoId}
                clipboard={clipboard} onSelect={setSelectedAnnoId} onChange={changeAnnotations} onClipboardChange={setClipboard} />}
              onWebviewReady={(wv) => { setPreviewReady((tick) => tick + 1); if (operations.length) void previewRef.current?.applyDraft(operations, wv); }} />
          </div> : null}
          {marquee ? <div className="ds-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} /> : null}
        </div>
        {!protos.selected && <div className="ds-empty">No flow selected. Pick one on the left — the sample flows load automatically.</div>}
        <CanvasRulers view={view} width={shellSize?.w ?? 0} height={shellSize?.h ?? 0} />
      </div>
      <DesignBottomToolbar tool={tool} onToolChange={setTool} frameKind={frameKind} shapeKind={shapeKind}
        onFrameKindChange={setFrameKind} onShapeKindChange={setShapeKind}
        zoom={Math.round(view.scale * 100)} onZoomChange={setZoomPercent} onFit={fitAll} />
    </main>
    <DesignInspector element={selectedElement} measured={measured} tab={inspectorTab} onTabChange={setInspectorTab} operations={operations} onOperationChange={updateOperation} onSave={saveDraft} onRevert={revertDraft} onOpenAi={onOpenAi} />
  </div>;
}
