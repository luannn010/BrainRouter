// brainrouter-desktop/src/lib/design/prototypeMeta.ts
import { buildDesignSteering } from '@kinqs/brainrouter-core/dist/prototype/prototypePrompt.js';
import { BRAINROUTER_SIGNATURE } from './signature.js';
import type { BrandOverrides } from './designTokens.js';

export type PrototypeEntry = { id: string; path: string; title: string; mtimeMs: number };

export function prototypeIdFromPath(relPath: string): string {
  const base = relPath.split('/').pop() ?? relPath;
  return base.replace(/\.html?$/i, '');
}

export function prototypeTitleFrom(html: string, relPath: string): string {
  const m = /<title>([^<]+)<\/title>/i.exec(html);
  if (m && m[1].trim()) return m[1].trim();
  const stem = prototypeIdFromPath(relPath).replace(/^prototype[-_]?/i, '').replace(/[-_]\d{10,}.*$/, '');
  const words = stem.replace(/[-_]+/g, ' ').trim();
  if (!words) return 'Untitled prototype';
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sortByRecent(entries: PrototypeEntry[]): PrototypeEntry[] {
  return [...entries].sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function fileUrlFor(workspaceRoot: string, relPath: string): string {
  const root = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  const rel = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const full = `${root}/${rel}`;
  return `file:///${full.replace(/^\/+/, '')}`;
}

/**
 * A tightly-scoped prompt: the agent edits ONE self-contained prototype file in
 * place, keeps it self-contained + on the BrainRouter Memory Instrument brand,
 * and — when the user picked an element in the Test canvas — targets it.
 */
export function buildUiFixPrompt(input: { relPath: string; instruction: string; pickedRef?: string | null; brandOverrides?: BrandOverrides | null }): string {
  const steer = buildDesignSteering(BRAINROUTER_SIGNATURE);
  const picked = input.pickedRef ? `\nThe selected element is \`[data-testid="${input.pickedRef}"]\` — scope the change to it unless the instruction says otherwise.` : '';
  const brand = input.brandOverrides ? `\nCurrent workspace brand overrides (honor these when relevant):\n${JSON.stringify(input.brandOverrides)}` : '';
  return [
    `Edit the existing prototype file \`${input.relPath}\` in place to satisfy this UI change:`,
    ``,
    `> ${input.instruction}`,
    picked,
    brand,
    ``,
    `Rules:`,
    `- Keep the file a SINGLE self-contained HTML document (inline CSS/JS, no external URLs).`,
    `- Preserve existing \`data-testid\` attributes so manual testing keeps working; add testids to any new interactive elements.`,
    `- Stay on the BrainRouter "Memory Instrument" brand:`,
    steer || `- Primary brand color: #34C28E — the single accent.`,
    `- Do not rename the file or create new files; write the whole updated document back to \`${input.relPath}\`.`,
  ].join('\n');
}
