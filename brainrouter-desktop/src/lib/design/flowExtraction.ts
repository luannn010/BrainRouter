export type PrototypeTransition = {
  kind: 'go' | 'show';
  target: string;
  testid?: string;
};

export type FlowExtraction = {
  transitions: PrototypeTransition[];
  warnings: string[];
};

/** Extracts the small, deterministic navigation vocabulary used by seeded prototypes. */
export function extractPrototypeTransitions(html: string): FlowExtraction {
  const transitions: PrototypeTransition[] = [];
  const warnings: string[] = [];
  const elementPattern = /<([a-z][\w:-]*)([^>]*?)>/gi;
  let match: RegExpExecArray | null;
  while ((match = elementPattern.exec(html))) {
    const attributes = match[2];
    const kindMatch = /\bdata-(go|show)\s*=\s*["']([^"']+)["']/i.exec(attributes);
    if (!kindMatch) continue;
    const target = kindMatch[2].trim();
    if (!target) {
      warnings.push(`empty data-${kindMatch[1]} target on <${match[1]}>`);
      continue;
    }
    const testid = /\bdata-testid\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1];
    transitions.push({ kind: kindMatch[1].toLowerCase() as 'go' | 'show', target, ...(testid ? { testid } : {}) });
  }
  return { transitions, warnings };
}
