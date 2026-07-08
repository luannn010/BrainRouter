// brainrouter-desktop/src/panels/design/BrandSignature.tsx
import React from 'react';
import { SIGNATURE_MARK, WORDMARK, TAGLINE, BRAINROUTER_SIGNATURE, buildSignatureStamp } from '../../lib/design/signature.js';

export function BrandSignature({ branch, commit, iso }: { branch?: string | null; commit?: string | null; iso: string }): React.ReactElement {
  const stamp = buildSignatureStamp({ branch, commit, iso });
  return (
    <section className="ds-card ds-sig">
      <p className="ds-eyebrow">Brand signature</p>
      <div className="ds-sig-lockup">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {SIGNATURE_MARK.edges.map(([a, b], i) => (
            <line key={i} x1={SIGNATURE_MARK.nodes[a].cx} y1={SIGNATURE_MARK.nodes[a].cy} x2={SIGNATURE_MARK.nodes[b].cx} y2={SIGNATURE_MARK.nodes[b].cy} stroke="#34C28E" strokeWidth="1.2" opacity="0.6" />
          ))}
          {SIGNATURE_MARK.nodes.map((n, i) => (
            <circle key={i} cx={n.cx} cy={n.cy} r={n.r} fill={n.core ? '#34C28E' : 'none'} stroke="#34C28E" strokeWidth={n.core ? 0 : 1.4} />
          ))}
        </svg>
        <div>
          <div className="ds-sig-word">{WORDMARK}</div>
          <div className="ds-eyebrow">{TAGLINE}</div>
        </div>
      </div>
      <div className="ds-sig-steer">
        <span className="ds-chip" data-mono>type · {BRAINROUTER_SIGNATURE.designType}</span>
        <span className="ds-chip" data-mono>accent · {BRAINROUTER_SIGNATURE.brandColor}</span>
        {(BRAINROUTER_SIGNATURE.tone ?? []).map((t) => <span key={t} className="ds-chip" data-mono>{t}</span>)}
      </div>
      <p className="ds-sig-stamp" data-mono>{stamp}</p>
    </section>
  );
}
