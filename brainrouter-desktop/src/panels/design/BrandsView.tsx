// brainrouter-desktop/src/panels/design/BrandsView.tsx
import React from 'react';
import { colorTokens, heatRamp, typeScale, radii, spacingScale, elevation, motionSpec } from '../../lib/design/designTokens.js';
import { ICONOGRAPHY, BRAND_VOICE, DO_DONT, brandChecklist } from '../../lib/design/brand.js';
import { BrandSignature } from './BrandSignature.js';

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
  return (
    <div className="ds-system">
      <BrandSignature branch={branch} commit={commit} iso={iso} />

      <Section title="Color" hint="Near-monochrome canvas. Exactly one chromatic pull.">
        <div className="ds-swatches">
          {colorTokens().map((c) => (
            <div key={c.token} className="ds-swatch">
              <span className="ds-swatch-chip" style={{ background: c.value }} />
              <div>
                <div className="ds-swatch-name">{c.name}</div>
                <div className="ds-swatch-meta" data-mono>{c.token} · {c.value}</div>
                <div className="ds-swatch-role">{c.role}</div>
              </div>
            </div>
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
          {typeScale().map((t) => (
            <div key={t.role} className="ds-type-row" style={{ fontFamily: t.family === 'mono' ? 'var(--ds-mono)' : 'var(--ds-font)', fontSize: t.size, fontWeight: t.weight }}>
              {t.role} <span className="ds-swatch-meta" data-mono>{t.size}/{t.weight} · {t.family}</span>
            </div>
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
  );
}
