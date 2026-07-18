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
import type { MeasuredElement } from '../../lib/design/designMeasure.js';
import type { ConstraintBox } from '../../lib/design/designConstraints.js';
import { PreviewCanvas, type PreviewHandle, type Device, type PickInfo } from './PreviewCanvas.js';
import { DesignBottomToolbar } from './DesignBottomToolbar.js';
import { StageOverlay } from './StageOverlay.js';
import { DesignInspector, type InspectorTab } from './DesignInspector.js';
import { DesignResourceRail, type DesignResource } from './DesignResourceRail.js';
import { CanvasRulers } from './CanvasRulers.js';
import type { PrototypesApi } from '../../lib/design/usePrototypes.js';
import type { PrototypeFrame } from '../../lib/design/useCanvasFrames.js';

const DEVICES: Device[] = ['desktop', 'tablet', 'phone'];
const DRAFT_KEY = 'brainrouter.design-tab.drafts';

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
  const [zoom, setZoom] = useState(100);
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
  // The shell can't hand the preview a resolvable %-height, so it is measured
  // and the stage sized in explicit px (see stageMetrics.ts).
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [shellSize, setShellSize] = useState<{ w: number; h: number } | null>(null);
  // Bumped on webview dom-ready so pick-arming retries once the surface can pick.
  const [previewReady, setPreviewReady] = useState(0);
  const [pickCycle, setPickCycle] = useState(0);
  // The selected element's real box + computed styles, read back from the
  // preview so the inspector shows what IS rather than a placeholder.
  const [measured, setMeasured] = useState<MeasuredElement | null>(null);

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
      if (e.key === 'Escape') { setSelectedAnnoId(null); setTool('select'); return; }
      const next = toolForKey(e.key);
      if (next) {
        setTool(next.tool);
        if (next.frameKind) setFrameKind(next.frameKind);
        if (next.shapeKind) setShapeKind(next.shapeKind);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // no deps — re-attached per render so the handler always sees fresh state

  // Hand tool: drag scrolls the shell. The overlay masks the webview/iframe
  // (which would otherwise swallow the pointer), and the event bubbles here.
  const onShellPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (tool !== 'hand' || e.button !== 0) return;
    const shell = shellRef.current;
    if (!shell) return;
    const start = { x: e.clientX, y: e.clientY, left: shell.scrollLeft, top: shell.scrollTop };
    setIsPanning(true);
    const onMove = (ev: PointerEvent): void => {
      shell.scrollLeft = start.left - (ev.clientX - start.x);
      shell.scrollTop = start.top - (ev.clientY - start.y);
    };
    const onUp = (): void => {
      setIsPanning(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
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
  const selectLayer = (ref: string): void => { setSelectedRef(ref); setInspectorTab('design'); const testid = elements.find((element) => element.ref === ref)?.testid; if (testid) onPick({ testid, tag: elements.find((element) => element.ref === ref)?.tag ?? 'div', label: testid }); };

  return <div className="ds-designs ds-design-editor">
    <DesignResourceRail activeResource={resource} onResourceChange={setResource} entries={protos.entries} selected={protos.selected} onSelect={protos.select} elements={elements} selectedRef={selectedRef} onLayerSelect={selectLayer} />
    <main className="ds-editor-stage">
      <div className="ds-canvas-bar"><div className="ds-stage-title"><Icon name="file" size={13} /><span>{protos.selected?.title ?? 'No flow'}</span><small data-mono>{protos.selected?.path ?? 'Choose a file from the left rail'}</small></div><span className="ds-nav-spacer" />{DEVICES.map((item) => <button key={item} type="button" className="ds-iconbtn" aria-pressed={device === item} onClick={() => setDevice(item)}>{item}</button>)}<button type="button" className="ds-iconbtn" onClick={() => previewRef.current?.reload()} aria-label="Reload prototype"><Icon name="refresh" size={13} /></button></div>
      <div ref={shellRef} className={`ds-stage-shell ds-stage-shell--${tool}${isPanning ? ' is-panning' : ''}`} onPointerDown={onShellPointerDown}>
        <PreviewCanvas ref={previewRef} workspaceRoot={workspaceRoot} selected={protos.selected} device={device} zoom={zoom} shellSize={shellSize}
          overlay={<StageOverlay tool={tool} frameKind={frameKind} shapeKind={shapeKind} zoom={zoom} annotations={annotations} selectedId={selectedAnnoId}
            clipboard={clipboard} onSelect={setSelectedAnnoId} onChange={changeAnnotations} onClipboardChange={setClipboard} />}
          onWebviewReady={(wv) => { setPreviewReady((tick) => tick + 1); if (operations.length) void previewRef.current?.applyDraft(operations, wv); }} />
        <CanvasRulers zoom={zoom} />
      </div>
      <DesignBottomToolbar tool={tool} onToolChange={setTool} frameKind={frameKind} shapeKind={shapeKind}
        onFrameKindChange={setFrameKind} onShapeKindChange={setShapeKind}
        zoom={zoom} onZoomChange={setZoom} onFit={() => setZoom(100)} />
    </main>
    <DesignInspector element={selectedElement} measured={measured} tab={inspectorTab} onTabChange={setInspectorTab} operations={operations} onOperationChange={updateOperation} onSave={saveDraft} onRevert={revertDraft} onOpenAi={onOpenAi} />
  </div>;
}
