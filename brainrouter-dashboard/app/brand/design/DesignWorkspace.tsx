"use client";

import { useEffect, useMemo, useState } from "react";
import type { DesignFlow, FlowScreen } from "../studioTypes";
import { STUDIO_MODELS } from "../studioTypes";
import { adminApi } from "../../../lib/adminApi";
import "./designWorkspace.css";

const PROMPTS = [
  "Make the primary action more prominent",
  "Use a calmer, more spacious layout",
  "Add a compact empty state for new teams",
];

type ChatMessage = { role: "user" | "assistant"; text: string };
type PreviewVariant = "default" | "spacious" | "prominent" | "empty";
type DesignArtifact = { variant: PreviewVariant; instruction: string; updatedAt: string };
const ARTIFACT_STORAGE_KEY = "brainrouter.design-studio.artifacts";

function previewVariantFor(prompt: string): PreviewVariant {
  const value = prompt.toLowerCase();
  if (/(empty|zero state|no data)/.test(value)) return "empty";
  if (/(prominent|stronger|primary action|call to action|cta)/.test(value)) return "prominent";
  if (/(spacious|calm|breathing room|less dense)/.test(value)) return "spacious";
  return "default";
}

function Preview({ screen, variant }: { screen: FlowScreen; variant: PreviewVariant }) {
  return <div className="design-preview__frame">
    <div className="design-preview__browserbar"><span /><span /><span /><code>{screen.route}</code></div>
    <div className={`design-preview__app design-preview__app--${variant}`}>
      <aside className="design-preview__nav"><div className="design-preview__logo">BR</div><i /><i /><i /><i /><div className="design-preview__avatar">JD</div></aside>
      <main className="design-preview__content">
        <div className="design-preview__crumb">Workspace <b>/</b> {screen.name}</div>
        <div className="design-preview__heading"><div><h2>{screen.name}</h2><p>{screen.description}</p></div><button>Primary action</button></div>
        {variant === "empty" && <div className="design-preview__empty"><b>No activity yet</b><span>Invite your team to create the first signal.</span></div>}
        {screen.kind === "form" ? <div className="design-preview__form"><label>Workspace name<span /></label><label>Invite teammates<span /></label><div className="design-preview__formrow"><span /><span /></div><button>Continue</button></div> : <>
          <div className="design-preview__metrics"><span><b>24</b><small>Active members</small></span><span><b>86%</b><small>Weekly momentum</small></span><span><b>12</b><small>Open threads</small></span></div>
          <div className="design-preview__table"><div /><div /><div /><div /></div>
        </>}
      </main>
    </div>
  </div>;
}

export function DesignWorkspace({ flow, screen, onBackToCanvas }: { flow: DesignFlow; screen: FlowScreen; onBackToCanvas: () => void }) {
  const [model, setModel] = useState<string>(STUDIO_MODELS[0].id);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("Ready to edit this screen");
  const [configuredModels, setConfiguredModels] = useState<string[]>([]);
  const [modelSource, setModelSource] = useState<"configured" | "fallback">("fallback");
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: `I’m ready to refine ${screen.name}. Ask for a visual change and I’ll keep the edit scoped to this screen.` }]);
  const [generating, setGenerating] = useState(false);
  const [artifact, setArtifact] = useState<DesignArtifact>({ variant: "default", instruction: "", updatedAt: "" });
  const modelOptions = useMemo(() => configuredModels.length > 0 ? configuredModels.map((id) => ({ id, label: id, note: "Configured" })) : STUDIO_MODELS, [configuredModels]);
  const selectedModel = useMemo(() => modelOptions.find((item) => item.id === model) ?? modelOptions[0], [model, modelOptions]);

  useEffect(() => {
    let active = true;
    setPrompt("");
    setStatus("Ready to edit this screen");
    setArtifact({ variant: "default", instruction: "", updatedAt: "" });
    adminApi.getDesignArtifact(flow.id, screen.id).then(({ artifact: savedArtifact }) => {
      if (active && savedArtifact) setArtifact(savedArtifact);
    }).catch(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(ARTIFACT_STORAGE_KEY) ?? "{}");
        if (active) setArtifact(saved[`${flow.id}:${screen.id}`] ?? { variant: "default", instruction: "", updatedAt: "" });
      } catch { if (active) setArtifact({ variant: "default", instruction: "", updatedAt: "" }); }
    });
    setMessages([{ role: "assistant", text: `I’m ready to refine ${screen.name}. Ask for a visual change and I’ll keep the edit scoped to this screen.` }]);
    return () => { active = false; };
  }, [flow.id, screen.id, screen.name]);

  useEffect(() => {
    let active = true;
    adminApi.listProviders()
      .then(({ providers }) => {
        if (!active) return;
        const llm = providers.filter((provider) => provider.kind === "llm");
        const ids = Array.from(new Set(llm.flatMap((provider) => [provider.model, ...(provider.models ?? [])]).filter(Boolean)));
        setConfiguredModels(ids);
        setModelSource(ids.length > 0 ? "configured" : "fallback");
        if (ids.length > 0) setModel(ids[0]);
      })
      .catch(() => { if (active) setModelSource("fallback"); });
    return () => { active = false; };
  }, []);

  const applyPrompt = async () => {
    const next = prompt.trim();
    if (!next || generating) { if (!next) setStatus("Add an instruction before applying an edit"); return; }
    setGenerating(true);
    const nextArtifact: DesignArtifact = { variant: previewVariantFor(next), instruction: next, updatedAt: new Date().toISOString() };
    setArtifact(nextArtifact);
    try {
      const saved = JSON.parse(window.localStorage.getItem(ARTIFACT_STORAGE_KEY) ?? "{}");
      window.localStorage.setItem(ARTIFACT_STORAGE_KEY, JSON.stringify({ ...saved, [`${flow.id}:${screen.id}`]: nextArtifact }));
    } catch { /* Artifact persistence is optional. */ }
    void adminApi.saveDesignArtifact(flow.id, screen.id, nextArtifact).catch(() => undefined);
    setMessages((current) => [...current, { role: "user", text: next }]);
    setPrompt("");
    try {
      const result = await adminApi.generateDesign({ flowName: flow.name, screenName: screen.name, route: screen.route, screenDescription: screen.description, prompt: next, model: selectedModel.id });
      setMessages((current) => [...current, { role: "assistant", text: result.output || `Scoped to ${screen.name} · ready for ${selectedModel.label}.` }]);
      setStatus(`Generated with ${result.model}`);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: `The model is unavailable, so this direction is kept locally for ${screen.name}.` }]);
      setStatus(`Local edit direction saved · ${selectedModel.label}`);
    } finally {
      setGenerating(false);
    }
  };

  const resetArtifact = () => {
    const nextArtifact: DesignArtifact = { variant: "default", instruction: "", updatedAt: new Date().toISOString() };
    setArtifact(nextArtifact);
    try {
      const saved = JSON.parse(window.localStorage.getItem(ARTIFACT_STORAGE_KEY) ?? "{}");
      delete saved[`${flow.id}:${screen.id}`];
      window.localStorage.setItem(ARTIFACT_STORAGE_KEY, JSON.stringify(saved));
    } catch { /* Storage is optional. */ }
    void adminApi.deleteDesignArtifact(flow.id, screen.id).catch(() => undefined);
    setStatus("Reverted this screen to its base artifact");
  };
  const previewVariant = artifact.variant;

  return <section className="design-workspace">
    <div className="design-workspace__header">
      <div><button type="button" className="studio-ghost-button" onClick={onBackToCanvas}>← Canvas</button><span className="design-workspace__crumb">{flow.name} <b>·</b> {screen.name}</span><h2>Design this web flow</h2><p>Give the selected screen a precise instruction, then keep iterating in context.</p></div>
      <div className="design-workspace__model"><span className="studio-eyebrow">Model · {modelSource}</span><select value={model} onChange={(event) => setModel(event.target.value)} aria-label="Design model">{modelOptions.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.note}</option>)}</select></div>
    </div>
    <div className="design-workspace__body">
      <div className="design-workspace__preview"><Preview screen={screen} variant={previewVariant} /><div className="design-workspace__preview-note"><span className="status-dot" /> Preview is scoped to <b>{screen.name}</b> · {screen.route}{previewVariant !== "default" && <em> · {previewVariant} direction applied</em>}</div></div>
      <aside className="design-workspace__composer">
        <div className="design-workspace__artifact"><div><span className="studio-eyebrow">Screen artifact</span><strong>{artifact.variant === "default" ? "Base direction" : `${artifact.variant} direction`}</strong></div>{artifact.instruction && <p>{artifact.instruction}</p>}<button type="button" className="studio-ghost-button" onClick={resetArtifact} disabled={artifact.variant === "default" && !artifact.instruction}>Revert</button></div>
        <div className="studio-eyebrow">Prompt editor</div>
        <h3>What should change?</h3>
        <p className="design-workspace__muted">Describe the UI change in plain language. The selected model will use the current screen and brand context.</p>
        <div className="design-workspace__chat" aria-live="polite">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`design-workspace__message design-workspace__message--${message.role}`}><span>{message.role === "user" ? "You" : "Studio"}</span><p>{message.text}</p></div>)}</div>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); applyPrompt(); } }} placeholder="e.g. Make the onboarding form feel more welcoming…" rows={5} aria-label="Design prompt" />
        <div className="design-workspace__suggestions"><span className="studio-eyebrow">Try a direction</span>{PROMPTS.map((item) => <button type="button" key={item} onClick={() => setPrompt(item)}>{item}<span>↗</span></button>)}</div>
        <button type="button" className="studio-primary-button design-workspace__apply" onClick={() => { void applyPrompt(); }} disabled={generating}>{generating ? "Thinking…" : `Apply to ${screen.name}`} <span>⌘↵</span></button>
        <div className="design-workspace__status" role="status"><span className="status-dot" />{status}</div>
      </aside>
    </div>
  </section>;
}
