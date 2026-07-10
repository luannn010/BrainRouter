import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDesignHost } from './designHost.js';

function ws(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-'));
  mkdirSync(path.join(dir, 'proto'), { recursive: true });
  return dir;
}

test('ensureSeed writes a welcome prototype only when proto/ is empty', () => {
  const dir = ws();
  try {
    const first = createDesignHost(dir).ensureSeed();
    assert.equal(first.created, true);
    assert.match(first.path, /^proto\/.*\.html$/);
    const second = createDesignHost(dir).ensureSeed();
    assert.equal(second.created, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('listPrototypes returns authorized proto html with title + id, newest first', () => {
  const dir = ws();
  try {
    writeFileSync(path.join(dir, 'proto', 'a.html'), '<title>Alpha</title>');
    writeFileSync(path.join(dir, 'proto', 'b.html'), '<title>Beta</title>');
    writeFileSync(path.join(dir, 'proto', 'notes.txt'), 'ignore me');
    const { prototypes } = createDesignHost(dir).listPrototypes();
    assert.equal(prototypes.length, 2);
    assert.ok(prototypes.every((p) => p.path.startsWith('proto/') && p.path.endsWith('.html')));
    assert.ok(prototypes.some((p) => p.title === 'Alpha'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('readPrototype returns content for an authorized id and errors on traversal', () => {
  const dir = ws();
  try {
    writeFileSync(path.join(dir, 'proto', 'a.html'), '<title>Alpha</title><body>hi</body>');
    const host = createDesignHost(dir);
    const ok = host.readPrototype('a');
    assert.ok('content' in ok && ok.content.includes('hi'));
    const bad = host.readPrototype('../../etc/passwd');
    assert.ok('error' in bad);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('readPrototypes batches frames with content, newest first, and honours the limit', () => {
  const dir = ws();
  try {
    writeFileSync(path.join(dir, 'proto', 'a.html'), '<title>Alpha</title><body>A</body>');
    writeFileSync(path.join(dir, 'proto', 'b.html'), '<title>Beta</title><body>B</body>');
    writeFileSync(path.join(dir, 'proto', 'skip.txt'), 'not html');
    const host = createDesignHost(dir);

    const all = host.readPrototypes();
    assert.equal(all.frames.length, 2);
    assert.equal(all.truncated, false);
    assert.ok(all.frames.every((f) => typeof f.content === 'string' && f.content.length > 0));
    // newest-first ordering is preserved from the shared scan
    assert.ok(all.frames[0].mtimeMs >= all.frames[1].mtimeMs);

    const capped = host.readPrototypes({ limit: 1 });
    assert.equal(capped.frames.length, 1);
    assert.equal(capped.truncated, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('readPrototypes drops oversized frames rather than flooding the renderer', () => {
  const dir = ws();
  try {
    writeFileSync(path.join(dir, 'proto', 'small.html'), '<title>Small</title>');
    writeFileSync(path.join(dir, 'proto', 'huge.html'), `<title>Huge</title>${'x'.repeat(600_000)}`);
    const { frames } = createDesignHost(dir).readPrototypes();
    assert.equal(frames.length, 1);
    assert.equal(frames[0].title, 'Small');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
