/**
 * Brand system — the non-token elements a brand needs to be reproducible:
 * iconography rules, voice, and the do/don't guardrails. Colour, type, spacing,
 * shape and motion live in `designTokens.ts`; the mark and the DesignContext
 * seed live in `signature.ts`. Together these are the Brands sheet.
 */

export interface IconographyRules {
  library: string;
  strokeWidth: number;
  sizes: number[];
  rules: string[];
}

/** One icon family, one stroke, never emoji. */
export const ICONOGRAPHY: IconographyRules = {
  library: 'Phosphor (outline)',
  strokeWidth: 1.5,
  sizes: [13, 16, 20, 24],
  rules: [
    'One family, one stroke width — never mix filled and outline at the same level.',
    'Icons inherit currentColor; never hard-code an icon colour.',
    'Icon-only controls carry an aria-label.',
    'Never use an emoji as a structural icon.',
  ],
};

export interface VoicePrinciple { principle: string; guidance: string }

/** How the product speaks: calm, precise, never breathless. */
export const BRAND_VOICE: VoicePrinciple[] = [
  { principle: 'Calm', guidance: 'State what happened. No exclamation marks, no hype, no fake urgency.' },
  { principle: 'Precise', guidance: 'Name the thing exactly — "recall took 214ms", not "lightning fast".' },
  { principle: 'Provenance-first', guidance: 'Every claim carries its source, timestamp and confidence.' },
  { principle: 'Recede', guidance: 'The interface narrates only when it must; the data speaks.' },
];

export interface DoDont { do: string[]; dont: string[] }

/** The guardrails that keep the system on-identity. */
export const DO_DONT: DoDont = {
  do: [
    'Keep the canvas near-monochrome; let Signal be the only chromatic pull.',
    'Render every datum — ids, counts, timestamps, hashes — in mono.',
    'Use Recall Heat only inside the graph/timeline, with a visible legend.',
    'Build elevation from colour steps + a 1px inner top-highlight.',
    'Encode node type by border style, not by adding another hue.',
    'Ship skeleton, empty and error states for every data view.',
  ],
  dont: [
    'No AI-purple, indigo or violet; no neon; no outer-glow shadow.',
    'No Inter, no serif — they read generic and off-identity.',
    'No ornamental gradients on surfaces, buttons or text.',
    'No pure #000 or #fff — use Void and Frost.',
    'No second accent: Heat is data, Semantic is state; neither is a brand hue.',
    'No emoji as icons; no generic spinners.',
  ],
};

/** The checklist a new surface must satisfy before it is "on brand". */
export function brandChecklist(): string[] {
  return [
    'Exactly one accent (Signal) carries every primary action.',
    'All data is monospace; all prose is sans.',
    'Radii come from the 4 / 6 / 10 / 12 scale.',
    'Spacing lands on the 4px rhythm.',
    'Motion animates transform and opacity only, and respects reduced-motion.',
    'Focus is always visible; icon-only controls are labelled.',
  ];
}
