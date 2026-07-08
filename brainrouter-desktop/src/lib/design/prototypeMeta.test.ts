// brainrouter-desktop/src/lib/design/prototypeMeta.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { prototypeIdFromPath, prototypeTitleFrom, sortByRecent, fileUrlFor, buildUiFixPrompt } from './prototypeMeta.js';

test('id is the filename stem under proto/', () => {
  assert.equal(prototypeIdFromPath('proto/prototype-welcome.html'), 'prototype-welcome');
  assert.equal(prototypeIdFromPath('proto/prototype-1736200000000-3a105892.html'), 'prototype-1736200000000-3a105892');
});

test('title prefers <title>, falls back to a humanized filename', () => {
  assert.equal(prototypeTitleFrom('<title>Kanban Board</title>', 'proto/x.html'), 'Kanban Board');
  assert.equal(prototypeTitleFrom('<html></html>', 'proto/prototype-welcome.html'), 'Welcome');
});

test('sortByRecent is newest-first', () => {
  const sorted = sortByRecent([
    { id: 'a', path: 'proto/a.html', title: 'A', mtimeMs: 100 },
    { id: 'b', path: 'proto/b.html', title: 'B', mtimeMs: 300 },
    { id: 'c', path: 'proto/c.html', title: 'C', mtimeMs: 200 },
  ]);
  assert.deepEqual(sorted.map((e) => e.id), ['b', 'c', 'a']);
});

test('fileUrlFor builds a forward-slash file:// url the webview policy accepts', () => {
  const url = fileUrlFor('C:\\ws', 'proto/prototype-welcome.html');
  assert.ok(url.startsWith('file:///'));
  assert.ok(url.endsWith('/proto/prototype-welcome.html'));
  assert.ok(!url.includes('\\'));
});

test('buildUiFixPrompt names the one file, the instruction, and stays on-brand + self-contained', () => {
  const p = buildUiFixPrompt({ relPath: 'proto/prototype-welcome.html', instruction: 'make the primary button use Signal', pickedRef: 'submit-btn' });
  assert.match(p, /proto\/prototype-welcome\.html/);
  assert.match(p, /make the primary button use Signal/);
  assert.match(p, /submit-btn/);
  assert.match(p, /self-contained/i);
  assert.match(p, /#34C28E/); // brand steer injected
});

test('buildUiFixPrompt omits the picked-element line when none is provided', () => {
  const p = buildUiFixPrompt({ relPath: 'proto/x.html', instruction: 'tighten spacing' });
  assert.doesNotMatch(p, /selected element/i);
});
