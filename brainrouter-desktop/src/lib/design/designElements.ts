import { cssDeclarationsFor, groupResetsFor, type DraftOperation, type DraftProperty } from './designProperties.js';

export type { DraftOperation, DraftProperty } from './designProperties.js';

export type DesignElement = {
  ref: string;
  tag: string;
  text: string;
  depth: number;
  testid: string | null;
  componentId: string | null;
  attributes: Record<string, string>;
  childCount: number;
};

export type PickedDesignElement = { testid: string | null; tag: string; label: string };

const SKIP_TAGS = new Set(['script', 'style', 'svg', 'path', 'meta', 'link', 'head']);
const COMPONENT_TAGS = new Set(['button', 'form', 'input', 'nav', 'header', 'section', 'article', 'a', 'select', 'textarea']);

function attrsFrom(raw = ''): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([:\w-]+)(?:\s*=\s*["']([^"']*)["'])?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) attrs[match[1].toLowerCase()] = match[2] ?? '';
  return attrs;
}

function textFrom(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

function elementRef(tag: string, attrs: Record<string, string>, index: number): string {
  return attrs['data-testid'] ? `${tag}[data-testid="${attrs['data-testid']}"]` : `${tag}:${index}`;
}

export function elementRefFor(element: Pick<DesignElement, 'ref'>): string {
  return element.ref;
}

export function extractDesignElements(html: string): DesignElement[] {
  const elements: DesignElement[] = [];
  const stack: Array<{ tag: string; elementIndex: number }> = [];
  const occurrences = new Map<string, number>();
  const tagPattern = /<\/?([a-z][\w:-]*)(\s[^<>]*?)?\s*\/?\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    const tag = match[1].toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;
    const isClosing = match[0].startsWith('</');
    if (isClosing) {
      const index = stack.map((item) => item.tag).lastIndexOf(tag);
      if (index >= 0) stack.splice(index, 1);
      continue;
    }
    const attrs = attrsFrom(match[2]);
    const key = tag;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    const ref = elementRef(tag, attrs, occurrence);
    const start = match.index + match[0].length;
    const close = new RegExp(`<\\/${tag}\\s*>`, 'ig');
    close.lastIndex = start;
    const closing = close.exec(html);
    const inner = closing ? html.slice(start, closing.index) : '';
    const element: DesignElement = {
      ref,
      tag,
      text: textFrom(inner),
      depth: stack.length,
      testid: attrs['data-testid'] || null,
      componentId: attrs['data-component-id'] || null,
      attributes: attrs,
      childCount: (inner.match(/<[a-z][\w:-]*(?:\s[^<>]*?)?>/gi) ?? []).length,
    };
    elements.push(element);
    if (!/\/\s*>$/.test(match[0]) && closing) stack.push({ tag, elementIndex: elements.length - 1 });
  }
  return elements;
}

export function componentElements(elements: readonly DesignElement[]): DesignElement[] {
  return elements.filter((element) => Boolean(element.componentId) || COMPONENT_TAGS.has(element.tag));
}

export function resolvePickedElement(elements: readonly DesignElement[], picked: PickedDesignElement | null): DesignElement | null {
  if (!picked) return null;
  if (picked.testid) return elements.find((element) => element.testid === picked.testid) ?? null;
  const label = picked.label.trim().toLowerCase();
  return elements.find((element) => element.tag === picked.tag && label && (element.text.toLowerCase().includes(label) || element.attributes['aria-label']?.toLowerCase() === label))
    ?? elements.find((element) => element.tag === picked.tag)
    ?? null;
}

function selectorFor(ref: string): string | null {
  const testid = /^([\w:-]+)\[data-testid="([^"]+)"\]$/.exec(ref);
  return testid ? `<${testid[1]}[^>]*data-testid=["']${testid[2]}["'][^>]*>` : null;
}

export function applyDraftOperations(html: string, operations: readonly DraftOperation[]): string {
  let result = html;
  const grouped = new Map<string, DraftOperation[]>();
  for (const operation of operations) {
    const list = grouped.get(operation.elementRef) ?? [];
    list.push(operation);
    grouped.set(operation.elementRef, list);
  }
  for (const [ref, list] of grouped) {
    const selector = selectorFor(ref);
    if (!selector) continue;
    const open = new RegExp(selector, 'i');
    const opening = result.match(open)?.[0];
    if (!opening) continue;
    // Note: this string path writes into a data-br-draft-style="…" attribute, so
    // no declaration value may contain a double quote (contextualAlternates is
    // single-quoted for exactly this reason).
    const declarations = list.flatMap((operation) => cssDeclarationsFor(operation.property, operation.value));
    const styles = [...groupResetsFor(declarations), ...declarations].map(([property, value]) => `${property}:${value}`);
    let nextOpening = opening;
    if (styles.length) {
      const existing = /data-br-draft-style=["']([^"']*)["']/.exec(nextOpening)?.[1];
      const merged = [existing, ...styles].filter(Boolean).join(';');
      nextOpening = nextOpening.includes('data-br-draft-style=')
        ? nextOpening.replace(/data-br-draft-style=["'][^"']*["']/, `data-br-draft-style="${merged}"`)
        : nextOpening.replace(/>$/, ` data-br-draft-style="${merged}">`);
    }
    const textOperation = list.find((operation) => operation.property === 'text');
    if (textOperation) {
      const tag = /^<([a-z][\w:-]*)/i.exec(opening)?.[1];
      if (tag) {
        const close = new RegExp(`(<${tag}[^>]*>)[\\s\\S]*?(<\\/${tag}\\s*>)`, 'i');
        result = result.replace(close, `$1${String(textOperation.value).replace(/[&<>"']/g, '')}$2`);
      }
    }
    result = result.replace(open, nextOpening);
  }
  return result;
}
