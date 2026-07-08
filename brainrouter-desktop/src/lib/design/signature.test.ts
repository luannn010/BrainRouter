// brainrouter-desktop/src/lib/design/signature.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAINROUTER_SIGNATURE, SIGNATURE_MARK, WORDMARK, buildSignatureStamp } from './signature.js';

test('the brand signature seeds prototypes with Signal + dark, precise tone', () => {
  assert.equal(WORDMARK, 'BrainRouter');
  assert.equal(BRAINROUTER_SIGNATURE.brandColor, '#34C28E');
  assert.ok(BRAINROUTER_SIGNATURE.tone?.includes('dark'));
  assert.ok(BRAINROUTER_SIGNATURE.tone?.includes('high-contrast'));
  assert.match(BRAINROUTER_SIGNATURE.designType ?? '', /memory/i);
});

test('the mark is a memory node-graph: one core + three satellites, three edges', () => {
  assert.equal(SIGNATURE_MARK.nodes.length, 4);
  assert.equal(SIGNATURE_MARK.nodes.filter((n) => n.core).length, 1);
  assert.equal(SIGNATURE_MARK.edges.length, 3);
});

test('the stamp is a mono provenance readout, commit truncated to 7', () => {
  const stamp = buildSignatureStamp({ branch: 'feat/x', commit: '3a105892abc', protoId: 'welcome', iso: '2026-07-08T10:00:00.000Z' });
  assert.equal(stamp, 'brainrouter · feat/x · 3a10589 · welcome · 2026-07-08');
});

test('the stamp degrades gracefully when git context is missing', () => {
  assert.equal(buildSignatureStamp({ iso: '2026-07-08T10:00:00.000Z' }), 'brainrouter · 2026-07-08');
});
