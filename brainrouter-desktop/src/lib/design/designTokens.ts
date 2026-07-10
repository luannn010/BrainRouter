/**
 * Memory Instrument — the canonical BrainRouter design tokens, as data.
 * The Design Studio's System view renders these; designStudio.css mirrors the
 * same values as scoped CSS custom properties (a test keeps them honest).
 */
export const MEMORY_INSTRUMENT = {
  surfaceBase: '#0B0D0F',
  surfaceRaised: '#14171A',
  surfaceOverlay: '#1E2227',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#ECEFF2',
  textSecondary: '#9BA3AC',
  textMuted: '#5E6670',
  accent: '#34C28E',
  accentPress: '#28A87C',
  accentWash: 'rgba(52,194,142,0.14)',
  heat: { hot: '#E0A063', warm: '#C98F6E', cool: '#6B7480', cold: '#3C434B' },
  danger: '#E5675F',
  warn: '#D9A441',
} as const;

export type TokenSwatch = { name: string; token: string; value: string; role: string };

export function colorTokens(): TokenSwatch[] {
  const M = MEMORY_INSTRUMENT;
  return [
    { name: 'Void', token: '--ds-bg', value: M.surfaceBase, role: 'Page canvas' },
    { name: 'Substrate', token: '--ds-surface', value: M.surfaceRaised, role: 'Panels, cards' },
    { name: 'Lifted', token: '--ds-overlay', value: M.surfaceOverlay, role: 'Popovers, active rows' },
    { name: 'Frost', token: '--ds-text', value: M.text, role: 'Primary text' },
    { name: 'Mist', token: '--ds-text-2', value: M.textSecondary, role: 'Secondary text' },
    { name: 'Ash', token: '--ds-text-3', value: M.textMuted, role: 'Metadata, disabled' },
    { name: 'Signal', token: '--ds-accent', value: M.accent, role: 'THE accent — action, active, live' },
    { name: 'Rose', token: '--ds-danger', value: M.danger, role: 'Contradiction, destructive' },
    { name: 'Amber', token: '--ds-warn', value: M.warn, role: 'Stale-vs-code caution' },
  ];
}

export function heatRamp(): TokenSwatch[] {
  const H = MEMORY_INSTRUMENT.heat;
  return [
    { name: 'Ember', token: '--ds-heat-hot', value: H.hot, role: 'Hot — recalled now' },
    { name: 'Coal', token: '--ds-heat-warm', value: H.warm, role: 'Warm — recently active' },
    { name: 'Slate', token: '--ds-heat-cool', value: H.cool, role: 'Cool — dormant' },
    { name: 'Cinder', token: '--ds-heat-cold', value: H.cold, role: 'Cold — archival' },
  ];
}

export function typeScale(): Array<{ role: string; family: 'sans' | 'mono'; size: number; weight: number }> {
  return [
    { role: 'Display', family: 'sans', size: 44, weight: 600 },
    { role: 'H1', family: 'sans', size: 28, weight: 600 },
    { role: 'H2', family: 'sans', size: 20, weight: 600 },
    { role: 'H3 / Section', family: 'sans', size: 16, weight: 500 },
    { role: 'Body', family: 'sans', size: 14, weight: 400 },
    { role: 'Label / Eyebrow', family: 'mono', size: 12, weight: 500 },
    { role: 'Data / Metric', family: 'mono', size: 13, weight: 500 },
  ];
}

export function radii(): Array<{ token: string; px: number }> {
  return [
    { token: '--ds-radius-chip', px: 4 },
    { token: '--ds-radius-control', px: 6 },
    { token: '--ds-radius-card', px: 10 },
    { token: '--ds-radius-panel', px: 12 },
  ];
}

/** 4px base unit — every gap, pad and inset lands on this rhythm. */
export function spacingScale(): number[] {
  return [4, 8, 12, 16, 24, 32, 48, 64];
}

/** Elevation is colour-steps + a NEUTRAL depth shadow — never a coloured glow. */
export function elevation(): Array<{ name: string; token: string; value: string; use: string }> {
  return [
    { name: 'Inset', token: '--ds-elev-inset', value: 'inset 0 1px 0 rgba(255,255,255,0.05)', use: 'Pressable top-highlight' },
    { name: 'Small', token: '--ds-shadow-sm', value: '0 1px 2px rgba(0,0,0,0.35)', use: 'Resting cards' },
    { name: 'Medium', token: '--ds-shadow-md', value: '0 6px 16px -6px rgba(0,0,0,0.5)', use: 'Hover / raised' },
    { name: 'Large', token: '--ds-shadow-lg', value: '0 24px 60px -20px rgba(0,0,0,0.62)', use: 'Popovers, modals' },
  ];
}

/** Restrained + physical: transform/opacity only, one signature loop. */
export function motionSpec(): Array<{ name: string; value: string; use: string }> {
  return [
    { name: 'Transition', value: '180ms cubic-bezier(0.2, 0.8, 0.2, 1)', use: 'Hover / state change' },
    { name: 'Tactile press', value: 'scale(0.98)', use: ':active on buttons and nodes' },
    { name: 'Stagger', value: 'calc(var(--i) * 40ms)', use: 'List and grid reveal' },
    { name: 'Breathe', value: 'opacity 0.5 ↔ 1 over 2.4s', use: 'The one signature loop — live status dot' },
  ];
}
