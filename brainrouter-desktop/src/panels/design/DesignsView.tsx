import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../icons.js';
import { bridgeQuery } from '../../lib/bridgeQuery.js';
import { extractDesignElements, resolvePickedElement, type DesignElement, type DraftOperation } from '../../lib/design/designElements.js';
import {
  ANNOTATIONS_STORAGE_KEY, annotationsKey, boundsOf, bringToFront, createAnnotation,
  duplicateAnnotation, flipAnnotation, frameSelection, groupAnnotations, parseAnnotationStore,
  pasteAnnotation, sendToBack, serializeAnnotationStore, setMask, ungroupAnnotations,
  type DesignAnnotation,
} from '../../lib/design/designAnnotations.js';
import { DEFAULT_AUTO_LAYOUT, autoLayoutAnnotations } from '../../lib/design/designAutoLayout.js';
import { flattenToPath } from '../../lib/design/designOutline.js';
import { addComponent, componentFromHtml, componentFromSelection, uniqueComponentName } from '../../lib/design/designComponents.js';
import { DesignContextMenu, type MenuAction, type MenuTarget } from './DesignContextMenu.js';
import { QuickComponentChat } from './QuickComponentChat.js';
import { isEditableTarget, shouldArmElementPicker, toolForKey, type DesignTool, type FrameKind, type ShapeKind } from '../../lib/design/designTools.js';
import { fitBounds, panBy, screenToWorld, snapTo, wheelGesture, zoomAt, type ViewBounds, type Viewport } from '../../lib/design/canvasViewport.js';
import { idsOfKind, isSelected, marqueeSelect, selectOnly, selectionBounds, toggleSelection, type SelectableItem, type Selection } from '../../lib/design/designSelection.js';
import { MIN_SCREEN, isResizeHandle, resizeRect } from '../../lib/design/screenResize.js';
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
import { COMPONENT_DRAG_TYPE, DesignResourceRail, type DesignResource } from './DesignResourceRail.js';
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
  const [annoIds, setAnnoIds] = useState<string[]>([]);
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
  /** Canvas-level right-click menu (screens and empty space). */
  const [screenMenu, setScreenMenu] = useState<{ x: number; y: number; target: MenuTarget } | null>(null);
  const [screenNotice, setScreenNotice] = useState<string | null>(null);
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  /** Screens copy as ids — pasting one duplicates its prototype file. */
  const [screenClipboard, setScreenClipboard] = useState<string[]>([]);
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

  // --- screen-side actions (the annotation-side ones live in StageOverlay) ---
  const mapScreens = (ids: readonly string[], fn: (node: CanvasNode) => CanvasNode): void => {
    if (ids.length === 0) return;
    saveNodes(nodes.map((node) => ids.includes(node.prototypeId) ? fn(node) : node));
  };
  const toggleScreenFlag = (ids: readonly string[], flag: 'hidden' | 'locked'): void =>
    mapScreens(ids, (node) => ({ ...node, [flag]: node[flag] ? undefined : true }));
  const flipScreens = (ids: readonly string[], key: 'flipX' | 'flipY'): void =>
    mapScreens(ids, (node) => ({ ...node, [key]: node[key] ? undefined : true }));
  const raiseScreens = (ids: readonly string[], to: 'front' | 'back'): void => {
    if (ids.length === 0) return;
    const z = nodes.map((node) => node.zIndex);
    const edge = to === 'front' ? Math.max(0, ...z) + 1 : Math.min(0, ...z) - 1;
    mapScreens(ids, (node) => ({ ...node, zIndex: edge }));
  };
  /** A screen leaves the board; its HTML file is never deleted. */
  const removeScreens = (ids: readonly string[]): void => {
    if (ids.length === 0) return;
    canvas.save({ ...canvas.document, hiddenPrototypeIds: [...new Set([...canvas.document.hiddenPrototypeIds, ...ids])] });
    setSelection([]);
  };
  const duplicateScreens = async (ids: readonly string[]): Promise<void> => {
    for (const id of ids) {
      const result = await bridgeQuery<{ id?: string; error?: string }>('design:duplicate-prototype', { id })
        .catch((): { id?: string; error?: string } => ({ error: 'Could not reach the workspace.' }));
      if (result?.error || !result?.id) { setScreenNotice(result?.error ?? 'Could not duplicate that screen.'); return; }
    }
    protos.refresh();
  };

  // Deliberately does NOT switch tabs: packing a layer now shows up in place,
  // as the layer's own row turning into a component. Jumping to the Components
  // tab would hide the one piece of feedback that says what happened.
  const saveComponents = (component: ReturnType<typeof componentFromHtml>): void => {
    canvas.save({ ...canvas.document, components: addComponent(canvas.document.components, component) });
  };
  const createComponentFrom = (members: readonly DesignAnnotation[]): void => {
    if (members.length === 0) return;
    const base = members.length === 1 ? (members[0].label.trim() || 'Component') : 'Component';
    const component = componentFromSelection(uniqueComponentName(canvas.document.components, base), members);
    saveComponents(component);
    // Record the pack on the source layers so the tree can show them as the
    // component they became. A link to a component that is later deleted
    // resolves to nothing and reads as unpacked, so no cleanup pass is needed.
    const ids = new Set(members.map((a) => a.id));
    changeAnnotations(annotations.map((a) => ids.has(a.id) ? { ...a, componentId: component.id } : a));
    setScreenNotice(`Packed ${members.length === 1 ? `"${component.name}"` : `${members.length} layers`} into a component.`);
  };
  const flattenSelection = (members: readonly DesignAnnotation[]): void => {
    const bounds = boundsOf(members);
    const d = flattenToPath(members);
    if (!bounds || !d) return;
    const ids = members.map((a) => a.id);
    const baked: DesignAnnotation = { ...createAnnotation('path', bounds, { label: 'Flattened' }), path: d };
    changeAnnotations([...annotations.filter((a) => !ids.includes(a.id)), baked]);
    setAnnoIds([baked.id]);
  };
  const addAutoLayout = (container: DesignAnnotation): void => {
    const withLayout = annotations.map((a) => a.id === container.id ? { ...a, autoLayout: a.autoLayout ?? DEFAULT_AUTO_LAYOUT } : a);
    changeAnnotations(autoLayoutAnnotations(withLayout, container.id));
  };

  useEffect(() => {
    let active = true;
    setSelectedRef(null);
    setAnnoIds([]);
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
      const chosen = annotations.filter((a) => annoIds.includes(a.id));
      const selected = chosen.length > 0 ? chosen[chosen.length - 1] : null;
      const ids = chosen.map((a) => a.id);
      const screens = idsOfKind(selection, 'screen');
      if ((e.ctrlKey || e.metaKey) && e.altKey) {
        // Ctrl+Alt+G frames, Ctrl+Alt+M masks, Ctrl+Alt+K makes a component.
        if (k === 'g' && chosen.length) { const { list, id } = frameSelection(annotations, ids); changeAnnotations(list); setAnnoIds(id ? [id] : []); e.preventDefault(); }
        else if (k === 'm' && selected?.groupId) { changeAnnotations(setMask(annotations, selected.id)); e.preventDefault(); }
        else if (k === 'k' && chosen.length) { createComponentFrom(chosen); e.preventDefault(); }
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && k === 'g' && chosen.length) { changeAnnotations(ungroupAnnotations(annotations, ids)); e.preventDefault(); }
        else if (k === 'g' && chosen.length >= 2) { changeAnnotations(groupAnnotations(annotations, ids).list); e.preventDefault(); }
        else if (e.shiftKey && k === 'h') { toggleScreenFlag(screens, 'hidden'); if (chosen.length) { changeAnnotations(annotations.map((a) => ids.includes(a.id) ? { ...a, hidden: !a.hidden } : a)); setAnnoIds([]); } e.preventDefault(); }
        else if (e.shiftKey && k === 'l') { toggleScreenFlag(screens, 'locked'); if (chosen.length) changeAnnotations(annotations.map((a) => ids.includes(a.id) ? { ...a, locked: !a.locked } : a)); e.preventDefault(); }
        else if (k === 'c' && selected) { setClipboard({ ...selected }); e.preventDefault(); }
        else if (k === 'x' && selected) { setClipboard({ ...selected }); changeAnnotations(annotations.filter((a) => !ids.includes(a.id))); setAnnoIds([]); e.preventDefault(); }
        else if (k === 'v' && clipboard) { const { list, id } = pasteAnnotation(annotations, clipboard); changeAnnotations(list); setAnnoIds([id]); e.preventDefault(); }
        else if (k === 'd' && selected) { const { list, id } = duplicateAnnotation(annotations, selected.id); changeAnnotations(list); setAnnoIds(id ? [id] : []); e.preventDefault(); }
        return;
      }
      if (e.altKey && e.shiftKey && k === 'f' && chosen.length) { flattenSelection(chosen); e.preventDefault(); return; }
      if (e.altKey || e.repeat) return;
      if (e.shiftKey) {
        if (k === 'a' && selected) { addAutoLayout(selected); e.preventDefault(); }
        else if (k === 'h') { flipScreens(screens, 'flipX'); if (chosen.length) changeAnnotations(ids.reduce((list, id) => flipAnnotation(list, id, 'x'), annotations)); e.preventDefault(); }
        else if (k === 'v') { flipScreens(screens, 'flipY'); if (chosen.length) changeAnnotations(ids.reduce((list, id) => flipAnnotation(list, id, 'y'), annotations)); e.preventDefault(); }
        return;
      }
      if (e.key === ']') { if (chosen.length) { changeAnnotations(ids.reduce((list, id) => bringToFront(list, id), annotations)); } raiseScreens(screens, 'front'); e.preventDefault(); return; }
      if (e.key === '[') { if (chosen.length) { changeAnnotations([...ids].reverse().reduce((list, id) => sendToBack(list, id), annotations)); } raiseScreens(screens, 'back'); e.preventDefault(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (chosen.length) { changeAnnotations(annotations.filter((a) => !ids.includes(a.id))); setAnnoIds([]); }
        else if (screens.length) removeScreens(screens);
        e.preventDefault();
        return;
      }
      if (e.key === '0') { fitAll(); e.preventDefault(); return; }
      if (e.key === 'Escape') { setAnnoIds([]); setSelection([]); setTool('select'); return; }
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

    const screenEl = target.closest<HTMLElement>('.ds-screen, .ds-live-screen, .ds-screen-head, .ds-screen-resize');
    const id = screenEl?.dataset.screenId ?? '';
    if (screenEl && id) {
      const node = nodes.find((item) => item.prototypeId === id);
      const next = e.shiftKey
        ? toggleSelection(selection, { kind: 'screen', id })
        : (isSelected(selection, 'screen', id) ? selection : selectOnly({ kind: 'screen', id }));
      setSelection(next);
      if (id !== protos.selected?.id) protos.select(id);
      if (!node || node.locked) return;

      // Resize: a handle names the edges it moves. Checked before the drag
      // branch because handles sit on top of the frame they belong to.
      const handleName = target.closest<HTMLElement>('.ds-screen-resize')?.dataset.resize ?? '';
      if (isResizeHandle(handleName)) {
        const grid = canvas.document.preferences.snapEnabled ? canvas.document.preferences.gridSize : 1;
        const startBox = { x: node.position.x, y: node.position.y, w: node.width, h: node.height };
        const from = { x: e.clientX, y: e.clientY, scale: viewRef.current.scale };
        let latest = nodes;
        const onMove = (ev: PointerEvent): void => {
          const box = resizeRect(startBox, handleName, (ev.clientX - from.x) / from.scale, (ev.clientY - from.y) / from.scale, { grid, min: MIN_SCREEN });
          latest = nodes.map((item) => item.prototypeId === id
            ? { ...item, position: { x: box.x, y: box.y }, width: box.w, height: box.h }
            : item);
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

      // Drag: the header always drags. The BODY drags too, except on the live
      // screen, whose body is the running prototype and has to stay clickable —
      // that one is what its header is for.
      const onHeader = Boolean(target.closest('.ds-screen-head'));
      const onLiveBody = Boolean(target.closest('.ds-live-screen'));
      if (!onHeader && onLiveBody) return;

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

  // Right-click on the canvas. Annotations handle their own right-click inside
  // the live screen and stop propagation, so anything arriving here is a screen
  // or empty space.
  const onShellContextMenu = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (tool === 'inspect') return;
    e.preventDefault();
    const screenEl = (e.target as HTMLElement).closest<HTMLElement>('.ds-screen, .ds-live-screen');
    const id = screenEl?.dataset.screenId ?? '';
    const node = id ? nodes.find((item) => item.prototypeId === id) : undefined;
    if (node && !isSelected(selection, 'screen', node.prototypeId)) setSelection(selectOnly({ kind: 'screen', id: node.prototypeId }));
    setScreenMenu({
      x: e.clientX,
      y: e.clientY,
      target: node ? { kind: 'screen', id: node.prototypeId, locked: node.locked === true } : null,
    });
  };

  const applyScreenAction = (action: MenuAction): void => {
    const target = screenMenu?.target;
    const ids = target?.kind === 'screen'
      ? (isSelected(selection, 'screen', target.id) ? idsOfKind(selection, 'screen') : [target.id])
      : [];
    switch (action) {
      case 'duplicate': void duplicateScreens(ids); break;
      case 'copy': setScreenClipboard(ids); break;
      case 'cut': setScreenClipboard(ids); removeScreens(ids); break;
      case 'paste': void duplicateScreens(screenClipboard); break;
      case 'delete': removeScreens(ids); break;
      case 'front': raiseScreens(ids, 'front'); break;
      case 'back': raiseScreens(ids, 'back'); break;
      case 'toggle-hidden': toggleScreenFlag(ids, 'hidden'); break;
      case 'toggle-locked': toggleScreenFlag(ids, 'locked'); break;
      case 'flip-x': flipScreens(ids, 'flipX'); break;
      case 'flip-y': flipScreens(ids, 'flipY'); break;
      case 'show-all': canvas.save({ ...canvas.document, hiddenPrototypeIds: [] }); break;
      case 'create-component-chat': setQuickChatOpen(true); break;
      // Group/frame/mask/flatten/outline are annotation concepts; a screen is a
      // whole document, so those rows stay disabled for a screen target.
      default: break;
    }
  };

  // Dropping a saved component places it as a screen-sized frame at the drop
  // point, so it becomes something you can position and annotate like anything
  // else on the board.
  const onCanvasDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    const id = e.dataTransfer.getData(COMPONENT_DRAG_TYPE);
    if (!id) return;
    e.preventDefault();
    const component = canvas.document.components.find((item) => item.id === id);
    const shell = shellRef.current;
    if (!component || !shell) return;
    const rect = shell.getBoundingClientRect();
    const at = screenToWorld(viewRef.current, e.clientX - rect.left, e.clientY - rect.top);
    const grid = canvas.document.preferences.snapEnabled ? canvas.document.preferences.gridSize : 1;
    const placed = createAnnotation('frame', {
      x: snapTo(at.x, grid), y: snapTo(at.y, grid), w: component.width, h: component.height,
    }, { label: component.name });
    changeAnnotations([...annotations, placed]);
    setAnnoIds([placed.id]);
    setScreenNotice(`Placed "${component.name}" on ${protos.selected?.title ?? 'the screen'}.`);
  };
  const onCanvasDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    if (!e.dataTransfer.types.includes(COMPONENT_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
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
  // The rail's two trees drive two different selections. Picking in one clears
  // the other, or the rail would show two highlighted rows and the inspector
  // would keep showing a DOM element that is no longer selected.
  const selectLayer = (ref: string): void => {
    setAnnoIds([]);
    setSelectedRef(ref);
    setInspectorTab('design');
    const element = elements.find((item) => item.ref === ref);
    if (element?.testid) onPick({ testid: element.testid, tag: element.tag, label: element.testid });
  };
  const selectCanvasLayer = (id: string, additive: boolean): void => {
    setAnnoIds((current) => additive
      ? (current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
      : (current.includes(id) ? current : [id]));
    // `picked` also feeds selectedElement, so clearing the ref alone would
    // leave the inspector showing the old element.
    setSelectedRef(null);
    onPick(null);
  };
  const selectFromCanvas = (ids: string[]): void => {
    setAnnoIds(ids);
    if (ids.length === 0) return;
    setSelectedRef(null);
    onPick(null);
  };

  return <div className="ds-designs ds-design-editor">
    <DesignResourceRail activeResource={resource} onResourceChange={setResource} entries={protos.entries} selected={protos.selected} onSelect={protos.select} elements={elements} selectedRef={selectedRef} onLayerSelect={selectLayer}
      components={canvas.document.components}
      onDeleteComponent={(id) => canvas.save({ ...canvas.document, components: canvas.document.components.filter((item) => item.id !== id) })}
      annotations={annotations} selectedAnnoIds={annoIds} onAnnotationSelect={selectCanvasLayer} />
    <main className="ds-editor-stage">
      <div className="ds-canvas-bar"><div className="ds-stage-title"><Icon name="file" size={13} /><span>{protos.selected?.title ?? 'No flow'}</span><small data-mono>{protos.selected?.path ?? 'Choose a file from the left rail'}</small></div><span className="ds-nav-spacer" />{DEVICES.map((item) => <button key={item} type="button" className="ds-iconbtn" aria-pressed={device === item} onClick={() => applyDevice(item)}>{item}</button>)}<button type="button" className="ds-iconbtn" onClick={() => previewRef.current?.reload()} aria-label="Reload prototype"><Icon name="refresh" size={13} /></button></div>
      <div ref={shellRef} className={`ds-stage-shell ds-stage-shell--${tool}${isPanning ? ' is-panning' : ''}`} onPointerDown={onShellPointerDown} onContextMenu={onShellContextMenu} onDragOver={onCanvasDragOver} onDrop={onCanvasDrop}>
        <div className="ds-design-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          {shownNodes.map((node) => <DesignScreen key={node.prototypeId} node={node}
            title={titleById.get(node.prototypeId) ?? node.prototypeId}
            content={contentById.get(node.prototypeId) ?? null}
            active={node.prototypeId === protos.selected?.id}
            selected={isSelected(selection, 'screen', node.prototypeId)}
            scale={view.scale} />)}
          {activeNode ? <div className={`ds-live-screen${isSelected(selection, 'screen', activeNode.prototypeId) ? ' is-selected' : ''}`} data-screen-id={activeNode.prototypeId}
            style={{ left: activeNode.position.x, top: activeNode.position.y, width: activeNode.width, height: activeNode.height, zIndex: LIVE_LAYER_Z }}>
            <PreviewCanvas ref={previewRef} workspaceRoot={workspaceRoot} selected={protos.selected} device={device}
              overlay={<StageOverlay tool={tool} frameKind={frameKind} shapeKind={shapeKind} zoom={view.scale * 100} annotations={annotations} selectedIds={annoIds}
                clipboard={clipboard} onSelect={selectFromCanvas} onChange={changeAnnotations} onClipboardChange={setClipboard}
                onCreateComponent={createComponentFrom} onQuickChat={() => setQuickChatOpen(true)} />}
              onWebviewReady={(wv) => { setPreviewReady((tick) => tick + 1); if (operations.length) void previewRef.current?.applyDraft(operations, wv); }} />
          </div> : null}
          {marquee ? <div className="ds-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} /> : null}
        </div>
        {!protos.selected && <div className="ds-empty">No flow selected. Pick one on the left — the sample flows load automatically.</div>}
        {screenNotice ? <p className="ds-stage-notice" role="status">{screenNotice}<button type="button" className="ds-iconbtn" onClick={() => setScreenNotice(null)}>Dismiss</button></p> : null}
        <CanvasRulers view={view} width={shellSize?.w ?? 0} height={shellSize?.h ?? 0} />
        {screenMenu ? <DesignContextMenu x={screenMenu.x} y={screenMenu.y} target={screenMenu.target}
          selectionCount={idsOfKind(selection, 'screen').length}
          clipboardFilled={screenClipboard.length > 0}
          hiddenCount={canvas.document.hiddenPrototypeIds.length}
          onAction={applyScreenAction}
          onClose={() => setScreenMenu(null)} /> : null}
        {quickChatOpen ? <QuickComponentChat
          onGenerated={(html, name) => {
            saveComponents(componentFromHtml(uniqueComponentName(canvas.document.components, name || 'Component'), html, { w: 320, h: 200 }));
            // A generated component has no layer on the canvas to point at, so
            // the Components tab is the only place it becomes visible.
            setResource('components');
          }}
          onClose={() => setQuickChatOpen(false)} /> : null}
      </div>
      <DesignBottomToolbar tool={tool} onToolChange={setTool} frameKind={frameKind} shapeKind={shapeKind}
        onFrameKindChange={setFrameKind} onShapeKindChange={setShapeKind}
        zoom={Math.round(view.scale * 100)} onZoomChange={setZoomPercent} onFit={fitAll} />
    </main>
    <DesignInspector element={selectedElement} measured={measured} tab={inspectorTab} onTabChange={setInspectorTab} operations={operations} onOperationChange={updateOperation} onSave={saveDraft} onRevert={revertDraft} onOpenAi={onOpenAi} />
  </div>;
}
