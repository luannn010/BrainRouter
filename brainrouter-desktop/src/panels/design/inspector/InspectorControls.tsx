// brainrouter-desktop/src/panels/design/inspector/InspectorControls.tsx
// The inspector's vocabulary. Every control is label-first and keyboard
// reachable; the panel is only ~300px wide, so labels sit above their field and
// icon rows carry a title + aria-label instead of visible text.
import React, { useState } from 'react';
import { Icon } from '../../../icons.js';

export function Section({ title, icon, action, defaultOpen = true, children }: { title: string; icon?: string; action?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }): React.ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  return <section className="ds-inspector-section">
    <div className="ds-inspector-sectionhead">
      <button type="button" className="ds-section-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Icon name={open ? 'chev-down' : 'chev-right'} size={11} />
        {icon ? <Icon name={icon} size={11} /> : null}
        <h3>{title}</h3>
      </button>
      {action}
    </div>
    {open ? <div className="ds-section-body">{children}</div> : null}
  </section>;
}

export function Row({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="ds-inspector-grid">{children}</div>;
}

export function Field({ label, value, onChange, prefix, suffix, type = 'text', options, placeholder, title, disabled }: { label: string; value: string; onChange: (value: string) => void; prefix?: string; suffix?: string; type?: 'text' | 'number'; options?: readonly { value: string; label: string }[]; placeholder?: string; title?: string; disabled?: boolean }): React.ReactElement {
  return <label className={`ds-field${disabled ? ' is-disabled' : ''}`} title={title ?? label}>
    <span className="ds-field-label">{label}</span>
    {options
      ? <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      : <span className="ds-field-input">{prefix ? <i className="ds-field-affix" aria-hidden>{prefix}</i> : null}<input type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />{suffix ? <i className="ds-field-affix ds-field-affix--end" aria-hidden>{suffix}</i> : null}</span>}
  </label>;
}

/** `disabled` is used where the underlying CSS provably cannot take effect (an
 *  inline box, an auto-height box) — a latching control that moves nothing is
 *  worse than one that says why it is unavailable. */
export function SegmentedIcons({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: readonly { value: string; icon: string; title: string }[]; disabled?: boolean }): React.ReactElement {
  return <div className={`ds-segrow${disabled ? ' is-disabled' : ''}`} role="group" aria-label={label}>
    {options.map((option) => <button key={option.value} type="button" className={`ds-segbtn${value === option.value ? ' is-active' : ''}`} aria-pressed={value === option.value} disabled={disabled} title={option.title} aria-label={option.title} onClick={() => onChange(option.value)}><Icon name={option.icon} size={12} /></button>)}
  </div>;
}

export function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }): React.ReactElement {
  return <label className="ds-togglerow"><span>{label}</span><input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i className="ds-switch" aria-hidden /></label>;
}

export function Swatch({ label, value, alpha, onChange, onAlphaChange }: { label: string; value: string; alpha: string; onChange: (value: string) => void; onAlphaChange: (value: string) => void }): React.ReactElement {
  return <div className="ds-swatchrow">
    <span className="ds-swatch-chip" style={{ background: value || 'transparent' }} aria-hidden />
    <label className="ds-swatch-hex"><span className="ds-sr-only">{`${label} colour`}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>
    <label className="ds-swatch-alpha"><span className="ds-sr-only">{`${label} opacity`}</span><input type="number" min="0" max="100" value={alpha} onChange={(event) => onAlphaChange(event.target.value)} /></label>
    <i className="ds-field-affix" aria-hidden>%</i>
  </div>;
}
