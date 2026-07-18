"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { useIsMobile } from "../../lib/useIsMobile";
import { DEFAULT_CONFIG, dimsFor, type BrandConfig, type Mode } from "./brandPresets";
import { buildSVG } from "./buildSVG";
import { useBrandExport } from "./useBrandExport";
import { BrandControls } from "./BrandControls";
import { Editor } from "./editor/Editor";
import { FlowCanvas } from "./canvas/FlowCanvas";
import { DesignWorkspace } from "./design/DesignWorkspace";
import { DESIGN_FLOWS } from "./studioFixtures";
import type { FlowPosition, StudioTab } from "./studioTypes";
import { InlineLoading } from "../../components/LoadingSpinner";

const MODES: [Mode, string][] = [["canvas", "Poster studio"], ["avatar", "Avatar / PFP"], ["logo", "Logo"]];
const POSITIONS_STORAGE_KEY = "brainrouter.design-studio.positions";
const HIDDEN_STORAGE_KEY = "brainrouter.design-studio.hidden-screens";

export default function BrandStudioPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [cfg, setCfg] = useState<BrandConfig>(DEFAULT_CONFIG);
  const [scale, setScale] = useState(2);
  const [tab, setTab] = useState<StudioTab>("canvas");
  const [flowId, setFlowId] = useState(DESIGN_FLOWS[0].id);
  const [selectedScreenId, setSelectedScreenId] = useState(DESIGN_FLOWS[0].screens[0].id);
  const [positions, setPositions] = useState<Record<string, FlowPosition>>(() => Object.fromEntries(DESIGN_FLOWS.flatMap((flow) => flow.screens.map((screen) => [screen.id, { x: screen.x, y: screen.y }]))));
  const [hiddenScreens, setHiddenScreens] = useState<Record<string, string[]>>({});
  const isMobile = useIsMobile();

  useEffect(() => { if (user && !user.isAdmin) router.replace("/overview"); }, [user, router]);
  useEffect(() => {
    try {
      const savedPositions = window.localStorage.getItem(POSITIONS_STORAGE_KEY);
      const savedHidden = window.localStorage.getItem(HIDDEN_STORAGE_KEY);
      if (savedPositions) setPositions((current) => ({ ...current, ...JSON.parse(savedPositions) }));
      if (savedHidden) setHiddenScreens(JSON.parse(savedHidden));
    } catch { /* Storage is optional. */ }
  }, []);
  useEffect(() => { try { window.localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positions)); } catch { /* Storage is optional. */ } }, [positions]);
  useEffect(() => { try { window.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(hiddenScreens)); } catch { /* Storage is optional. */ } }, [hiddenScreens]);

  const flow = DESIGN_FLOWS.find((item) => item.id === flowId) ?? DESIGN_FLOWS[0];
  const screen = flow.screens.find((item) => item.id === selectedScreenId) ?? flow.screens[0];
  const set = (patch: Partial<BrandConfig>) => setCfg((current) => ({ ...current, ...patch }));
  const svg = useMemo(() => buildSVG(cfg), [cfg]);
  const { downloadSVG, downloadPNG, copySVG, busy, copied } = useBrandExport(cfg);

  if (isLoading) {
    return <div style={{ padding: "48px" }}><InlineLoading label="Loading…" /></div>;
  }
  if (!user || !user.isAdmin) return null;

  const { w, h } = dimsFor(cfg);
  const ar = w / h;
  const previewMaxW = ar < 1 ? Math.round(660 * ar) : ar > 2.4 ? 860 : 700;
  const previewHtml = svg.replace("<svg ", `<svg style="display:block;width:auto;height:auto;max-width:min(100%, ${previewMaxW}px);max-height:70vh;margin:0 auto;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.4)" `);

  return <div className="studio-page" style={{ display: "flex", flexDirection: "column", gap: "22px", maxWidth: "1400px" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: "var(--text)" }}>Design Studio</h1>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent)", background: "var(--accent-wash)", border: "1px solid var(--border-hover-accent)", borderRadius: "var(--radius-pill)", padding: "3px 10px" }}>Admin only</span>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0, maxWidth: "70ch", lineHeight: 1.55 }}>Shape a web app as a connected set of screens, refine one flow with prompts, and keep the brand system close to every decision.</p>
    </div>

    <div role="tablist" aria-label="Design Studio surfaces" style={{ display: "flex", gap: "5px", padding: "4px", width: "fit-content", maxWidth: "100%", border: "1px solid var(--border)", borderRadius: "11px", background: "var(--surface-raised)" }}>
      {(["canvas", "design", "brands"] as StudioTab[]).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} style={{ padding: "9px 18px", border: "0", borderRadius: "8px", cursor: "pointer", textTransform: "capitalize", fontSize: "13px", fontWeight: 650, color: tab === item ? "var(--accent)" : "var(--text-secondary)", background: tab === item ? "var(--accent-wash)" : "transparent" }}>{item}</button>)}
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
      <span className="studio-eyebrow">Flow</span>
      <select value={flowId} onChange={(event) => { setFlowId(event.target.value); const next = DESIGN_FLOWS.find((item) => item.id === event.target.value); if (next) setSelectedScreenId(next.screens[0].id); }} aria-label="Select design flow" style={{ padding: "9px 11px", color: "var(--text)", background: "var(--surface-overlay)", border: "1px solid var(--border-strong)", borderRadius: "8px", fontSize: "13px", minWidth: "230px" }}>{DESIGN_FLOWS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{flow.description}</span>
    </div>

    <div style={{ display: tab === "canvas" ? "block" : "none" }}><FlowCanvas flow={flow} positions={positions} onPositionsChange={setPositions} selectedScreen={screen.id} onSelect={setSelectedScreenId} onEdit={() => setTab("design")} hiddenScreenIds={hiddenScreens[flow.id] ?? []} onHide={(id) => { setHiddenScreens((current) => ({ ...current, [flow.id]: [...new Set([...(current[flow.id] ?? []), id])] })); const next = flow.screens.find((item) => item.id !== id && !(hiddenScreens[flow.id] ?? []).includes(item.id)); if (next) setSelectedScreenId(next.id); }} onShow={(id) => { setHiddenScreens((current) => ({ ...current, [flow.id]: (current[flow.id] ?? []).filter((item) => item !== id) })); setSelectedScreenId(id); }} /></div>
    <div style={{ display: tab === "design" ? "block" : "none" }}><DesignWorkspace flow={flow} screen={screen} onBackToCanvas={() => setTab("canvas")} /></div>
    {tab === "brands" && <>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {MODES.map(([mode, label]) => <button key={mode} type="button" onClick={() => set({ mode })} style={{ padding: "9px 16px", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", background: cfg.mode === mode ? "var(--accent-wash)" : "var(--surface-raised)", border: `1px solid ${cfg.mode === mode ? "var(--border-hover-accent)" : "var(--border)"}`, color: cfg.mode === mode ? "var(--accent)" : "var(--text-secondary)" }}>{label}</button>)}
      </div>
      {cfg.mode === "canvas" ? <Editor /> : <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(300px, 340px) minmax(0, 1fr)", gap: "24px", alignItems: "start" }}>
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-panel)", padding: "20px", position: "sticky", top: "16px", maxHeight: "calc(100vh - 110px)", overflowY: "auto" }}><BrandControls cfg={cfg} set={set} /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "28px", background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-panel)", minHeight: "340px" }}><div style={{ width: "100%", display: "flex", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: previewHtml }} /></div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <select value={scale} onChange={(event) => setScale(Number(event.target.value))} title="PNG resolution" style={{ padding: "11px 12px", borderRadius: "10px", background: "var(--surface-overlay)", border: "1px solid var(--border-strong)", color: "var(--text)", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}><option value={1}>1×</option><option value={2}>2× HD</option><option value={3}>3×</option><option value={4}>4×</option></select>
            <button type="button" onClick={() => downloadPNG(scale)} disabled={busy} style={{ padding: "11px 20px", borderRadius: "10px", background: "var(--accent)", border: "1px solid var(--accent)", color: "#06130E", fontWeight: 600, fontSize: "14px", cursor: busy ? "default" : "pointer", opacity: busy ? .7 : 1 }}>{busy ? "Rendering…" : `Download PNG (${Math.round(w * scale)}×${Math.round(h * scale)})`}</button>
            <button type="button" onClick={downloadSVG} style={{ padding: "11px 20px", borderRadius: "10px", background: "var(--surface-overlay)", border: "1px solid var(--border-strong)", color: "var(--text)", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}>Download SVG</button>
            <button type="button" onClick={copySVG} style={{ padding: "11px 20px", borderRadius: "10px", background: "transparent", border: "1px solid var(--border-strong)", color: copied ? "var(--accent)" : "var(--text-secondary)", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}>{copied ? "Copied ✓" : "Copy SVG"}</button>
          </div>
        </div>
      </div>}
    </>}
  </div>;
}
