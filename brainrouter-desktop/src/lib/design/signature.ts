// brainrouter-desktop/src/lib/design/signature.ts
import type { DesignContext } from '@kinqs/brainrouter-core/dist/prototype/prototypePrompt.js';

export const WORDMARK = 'BrainRouter';
export const TAGLINE = 'The Memory Instrument';

/**
 * The canonical brand steer. Feeding this DesignContext to buildPrototypePrompt
 * makes every generated/fixed prototype on-identity: Signal accent, dark, precise.
 */
export const BRAINROUTER_SIGNATURE: DesignContext = {
  designType: 'developer memory instrument — a calm dark data dashboard',
  brandColor: '#34C28E',
  tone: ['dark', 'high-contrast', 'minimal', 'precise'],
};

/** The signature mark: a memory node-graph — one recalled core + three satellites. */
export const SIGNATURE_MARK: { nodes: Array<{ cx: number; cy: number; r: number; core?: boolean }>; edges: Array<[number, number]> } = {
  nodes: [
    { cx: 12, cy: 12, r: 3, core: true },
    { cx: 5, cy: 6, r: 1.6 },
    { cx: 19, cy: 7, r: 1.6 },
    { cx: 18, cy: 18, r: 1.6 },
  ],
  edges: [[0, 1], [0, 2], [0, 3]],
};

export type StampInput = { branch?: string | null; commit?: string | null; protoId?: string | null; iso: string };

/** A mono provenance readout: `brainrouter · <branch> · <commit7> · <protoId> · <date>`. */
export function buildSignatureStamp(input: StampInput): string {
  const parts = ['brainrouter'];
  if (input.branch) parts.push(input.branch);
  if (input.commit) parts.push(input.commit.slice(0, 7));
  if (input.protoId) parts.push(input.protoId);
  parts.push(input.iso.slice(0, 10));
  return parts.join(' · ');
}
