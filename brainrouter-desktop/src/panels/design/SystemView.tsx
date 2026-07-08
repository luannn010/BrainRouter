// brainrouter-desktop/src/panels/design/SystemView.tsx
import React from 'react';
import { colorTokens, heatRamp, typeScale, radii } from '../../lib/design/designTokens.js';
import { BrandSignature } from './BrandSignature.js';

export function SystemView({ branch, commit, iso }: { branch?: string | null; commit?: string | null; iso: string }): React.ReactElement {
  return (
    <div className="ds-system">
      <BrandSignature branch={branch} commit={commit} iso={iso} />

      <section>
        <p className="ds-eyebrow">Color · one Signal accent</p>
        <div className="ds-swatches">
          {colorTokens().map((c) => (
            <div key={c.token} className="ds-swatch">
              <span className="ds-swatch-chip" style={{ background: c.value }} />
              <div><div className="ds-swatch-name">{c.name}</div><div className="ds-swatch-meta" data-mono>{c.token} · {c.value}</div><div className="ds-swatch-role">{c.role}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="ds-eyebrow">Recall Heat · graph/timeline data only</p>
        <div className="ds-heat">
          {heatRamp().map((h) => (
            <div key={h.token} className="ds-heat-stop"><span className="ds-heat-chip" style={{ background: h.value }} /><span data-mono>{h.name}</span><span className="ds-swatch-meta" data-mono>{h.value}</span></div>
          ))}
        </div>
      </section>

      <section>
        <p className="ds-eyebrow">Type · Geist + Geist Mono</p>
        <div className="ds-type">
          {typeScale().map((t) => (
            <div key={t.role} className="ds-type-row" style={{ fontFamily: t.family === 'mono' ? 'var(--ds-mono)' : 'var(--ds-font)', fontSize: t.size, fontWeight: t.weight }}>
              {t.role} <span className="ds-swatch-meta" data-mono>{t.size}/{t.weight} · {t.family}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="ds-eyebrow">Components</p>
        <div className="ds-specimens">
          <button className="ds-btn ds-btn--accent">Recall</button>
          <button className="ds-btn ds-btn--ghost">Dismiss</button>
          <span className="ds-status"><span className="ds-dot ds-dot--live" /> live · auto-route</span>
          <span className="ds-chip" data-mono>source · ts · conf 0.82</span>
          <span className="ds-node ds-node--fact">fact node</span>
          <span className="ds-node ds-node--inferred">inferred node</span>
        </div>
        <div className="ds-radii">
          {radii().map((r) => <span key={r.token} className="ds-radii-chip" style={{ borderRadius: r.px }} data-mono>{r.px}px</span>)}
        </div>
      </section>
    </div>
  );
}
