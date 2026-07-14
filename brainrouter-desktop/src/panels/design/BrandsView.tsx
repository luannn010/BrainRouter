// brainrouter-desktop/src/panels/design/BrandsView.tsx
import React, { useMemo, useState } from 'react';
import { colorTokens, heatRamp, typeScale, radii, spacingScale, elevation, motionSpec } from '../../lib/design/designTokens.js';
import type { BrandOverrides } from '../../lib/design/designTokens.js';
import { ICONOGRAPHY, BRAND_VOICE, DO_DONT, brandChecklist } from '../../lib/design/brand.js';
import { BrandSignature } from './BrandSignature.js';
import { bridgeQuery } from '../../lib/bridgeQuery.js';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="ds-section">
      <div className="ds-section-head">
        <p className="ds-eyebrow">{title}</p>
        {hint ? <p className="ds-section-hint">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Brands — the reproducible definition of the identity: signature, colour,
 * type, spacing, shape, elevation, motion, iconography, voice and guardrails.
 * Everything here is rendered from the token model, so the sheet cannot drift
 * from the code that ships.
 */
export function BrandsView({ branch, commit, iso }: { branch?: string | null; commit?: string | null; iso: string }): React.ReactElement {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [typeOverrides, setTypeOverrides] = useState<BrandOverrides['typography']>({});
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});
  const [overridesLoaded, setOverridesLoaded] = useState(false);
  const [tone, setTone] = useState<'calm' | 'bold' | 'editorial' | 'technical'>('calm');
  const types = useMemo(() => typeScale().map((type) => ({ ...type, ...(typeOverrides[type.role] ?? {}) })), [typeOverrides]);
  const colors = useMemo(() => colorTokens().map((color) => ({ ...color, value: colorOverrides[color.token] ?? color.value })), [colorOverrides]);
  const palettes = { calm: ['#34C28E', '#6B8F80', '#A7C7B9', '#ECEFF2'], bold: ['#34C28E', '#E5675F', '#E0A063', '#ECEFF2'], editorial: ['#C98F6E', '#8B6F62', '#E8D7C9', '#25201D'], technical: ['#4DA3FF', '#34C28E', '#6B7480', '#D9A441'] } as const;
  const activeType = types.find((type) => type.role === selectedType) ?? null;
  const activeColor = colors.find((color) => color.token === selectedColor) ?? null;
  React.useEffect(() => {
    let active = true;
    bridgeQuery<{ overrides?: { typography?: typeof typeOverrides; colors?: Record<string, string> } }>('design:read-brand-overrides', {})
      .then((result: { overrides?: Partial<BrandOverrides> }) => {
        if (!active) return;
        if (result.overrides?.typography) setTypeOverrides(result.overrides.typography);
        if (result.overrides?.colors) setColorOverrides(result.overrides.colors);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setOverridesLoaded(true); });
    return () => { active = false; };
  }, []);
  React.useEffect(() => {
    if (!overridesLoaded) return;
    void bridgeQuery('design:write-brand-overrides', { overrides: { typography: typeOverrides, colors: colorOverrides } }).catch(() => undefined);
  }, [overridesLoaded, typeOverrides, colorOverrides]);
  return (
    <div className="ds-brands-shell">
    <div className="ds-system">
      <BrandSignature branch={branch} commit={commit} iso={iso} />

      <Section title="Color" hint="Near-monochrome canvas. Exactly one chromatic pull.">
        <div className="ds-swatches">
          {colors.map((c) => (
            <button key={c.token} type="button" className={`ds-swatch ds-swatch--button${selectedColor === c.token ? ' is-selected' : ''}`} onClick={() => { setSelectedColor(c.token); setSelectedType(null); }}>
              <span className="ds-swatch-chip" style={{ background: c.value }} />
              <div>
                <div className="ds-swatch-name">{c.name}</div>
                <div className="ds-swatch-meta" data-mono>{c.token} · {c.value}</div>
                <div className="ds-swatch-role">{c.role}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Recall Heat" hint="Data encoding for the memory graph and timelines only — never UI chrome.">
        <div className="ds-heat">
          {heatRamp().map((h) => (
            <div key={h.token} className="ds-heat-stop">
              <span className="ds-heat-chip" style={{ background: h.value }} />
              <span data-mono>{h.name}</span>
              <span className="ds-swatch-meta" data-mono>{h.value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography" hint="Geist for prose. Geist Mono for every datum.">
        <div className="ds-type">
          {types.map((t) => (
            <button key={t.role} type="button" className={`ds-type-row ds-type-row--button${selectedType === t.role ? ' is-selected' : ''}`} onClick={() => { setSelectedType(t.role); setSelectedColor(null); }} style={{ fontFamily: t.family === 'mono' ? 'var(--ds-mono)' : 'var(--ds-font)', fontSize: t.size, fontWeight: t.weight }}>
              {t.role} <span className="ds-swatch-meta" data-mono>{t.size}/{t.weight} · {t.family}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Spacing" hint="4px base unit — every gap lands on this rhythm.">
        <div className="ds-spacing">
          {spacingScale().map((s) => (
            <div key={s} className="ds-spacing-stop">
              <span className="ds-spacing-bar" style={{ width: s }} />
              <span className="ds-swatch-meta" data-mono>{s}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shape" hint="Architectural, not bloated.">
        <div className="ds-radii">
          {radii().map((r) => (
            <span key={r.token} className="ds-radii-chip" style={{ borderRadius: r.px }} data-mono>{r.px}px</span>
          ))}
        </div>
      </Section>

      <Section title="Elevation" hint="Colour steps + a neutral depth shadow. Never a coloured glow.">
        <div className="ds-elev">
          {elevation().map((e) => (
            <div key={e.token} className="ds-elev-row">
              <span className="ds-elev-chip" style={{ boxShadow: e.value }} />
              <div>
                <div className="ds-swatch-name">{e.name}</div>
                <div className="ds-swatch-meta" data-mono>{e.token}</div>
                <div className="ds-swatch-role">{e.use}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Motion" hint="Transform and opacity only. One signature loop.">
        <dl className="ds-deflist">
          {motionSpec().map((m) => (
            <React.Fragment key={m.name}>
              <dt>{m.name}</dt>
              <dd><span data-mono>{m.value}</span> — {m.use}</dd>
            </React.Fragment>
          ))}
        </dl>
      </Section>

      <Section title="Iconography" hint={`${ICONOGRAPHY.library} · stroke ${ICONOGRAPHY.strokeWidth}`}>
        <div className="ds-sig-steer">
          {ICONOGRAPHY.sizes.map((s) => <span key={s} className="ds-chip" data-mono>{s}px</span>)}
        </div>
        <ul className="ds-rules">
          {ICONOGRAPHY.rules.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </Section>

      <Section title="Voice" hint="How the product speaks.">
        <dl className="ds-deflist">
          {BRAND_VOICE.map((v) => (
            <React.Fragment key={v.principle}>
              <dt>{v.principle}</dt>
              <dd>{v.guidance}</dd>
            </React.Fragment>
          ))}
        </dl>
      </Section>

      <Section title="Components" hint="The specimens every surface reuses.">
        <div className="ds-specimens">
          <button className="ds-btn ds-btn--accent">Recall</button>
          <button className="ds-btn ds-btn--ghost">Dismiss</button>
          <span className="ds-status"><span className="ds-dot ds-dot--live" /> live · auto-route</span>
          <span className="ds-chip" data-mono>source · ts · conf 0.82</span>
          <span className="ds-node ds-node--fact">fact node</span>
          <span className="ds-node ds-node--inferred">inferred node</span>
        </div>
      </Section>

      <Section title="Guardrails" hint="What keeps a new surface on-identity.">
        <div className="ds-guard">
          <div>
            <p className="ds-guard-head ds-guard-head--do">Do</p>
            <ul className="ds-rules">{DO_DONT.do.map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
          <div>
            <p className="ds-guard-head ds-guard-head--dont">Don&rsquo;t</p>
            <ul className="ds-rules">{DO_DONT.dont.map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
        </div>
      </Section>

      <Section title="Checklist" hint="Ship gate for any new surface.">
        <ul className="ds-rules ds-check">{brandChecklist().map((c) => <li key={c}>{c}</li>)}</ul>
      </Section>
    </div>
    <aside className="ds-brand-inspector" aria-label="Brand element inspector">
      <div className="ds-section-head"><p className="ds-eyebrow">Element inspector</p><p className="ds-section-hint">Select a type sample or color token to edit its visual role.</p></div>
      {activeType ? <>
        <div className="ds-inspector-title"><strong>{activeType.role}</strong><span data-mono>Typography</span></div>
        <label className="ds-field">Font family<select value={activeType.family} onChange={(event) => setTypeOverrides((current) => ({ ...current, [activeType.role]: { ...activeType, family: event.target.value as 'sans' | 'mono' } }))}><option value="sans">Geist Sans</option><option value="mono">Geist Mono</option></select></label>
        <label className="ds-field">Font size<input type="number" min={8} max={96} value={activeType.size} onChange={(event) => setTypeOverrides((current) => ({ ...current, [activeType.role]: { ...activeType, size: Number(event.target.value) } }))} /></label>
        <label className="ds-field">Weight<select value={activeType.weight} onChange={(event) => setTypeOverrides((current) => ({ ...current, [activeType.role]: { ...activeType, weight: Number(event.target.value) } }))}><option value={400}>400 Regular</option><option value={500}>500 Medium</option><option value={600}>600 Semibold</option><option value={700}>700 Bold</option></select></label>
      </> : activeColor ? <>
        <div className="ds-inspector-title"><strong>{activeColor.name}</strong><span data-mono>{activeColor.token}</span></div>
        <label className="ds-field">Color<input type="color" value={activeColor.value} onChange={(event) => setColorOverrides((current) => ({ ...current, [activeColor.token]: event.target.value }))} /></label>
        <label className="ds-field">Hex<input value={activeColor.value} onChange={(event) => setColorOverrides((current) => ({ ...current, [activeColor.token]: event.target.value }))} /></label>
        <div className="ds-field"><span>Tone palette</span><select value={tone} onChange={(event) => setTone(event.target.value as typeof tone)}><option value="calm">Calm</option><option value="bold">Bold</option><option value="editorial">Editorial</option><option value="technical">Technical</option></select><div className="ds-palette-suggestions">{palettes[tone].map((value) => <button key={value} type="button" title={`Use ${value}`} style={{ background: value }} onClick={() => setColorOverrides((current) => ({ ...current, [activeColor.token]: value }))} />)}</div></div>
      </> : <div className="ds-inspector-empty">Click a typography sample or color swatch to inspect it here.</div>}
    </aside>
    </div>
  );
}
