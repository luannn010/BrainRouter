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
