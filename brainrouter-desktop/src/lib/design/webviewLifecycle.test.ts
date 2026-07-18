import test from 'node:test';
import assert from 'node:assert/strict';
import { markWebviewReady, queueWebviewUrl, type WebviewLoadState } from './webviewLifecycle.js';

test('queues navigation until dom-ready, then releases the latest URL once', () => {
  const initial: WebviewLoadState = { ready: false, pendingUrl: null, currentUrl: null };
  const queued = queueWebviewUrl(initial, 'file:///project/proto/first.html');
  assert.deepEqual(queued, { ready: false, pendingUrl: 'file:///project/proto/first.html', currentUrl: null });
  const replaced = queueWebviewUrl(queued, 'file:///project/proto/second.html');
  assert.equal(replaced.pendingUrl, 'file:///project/proto/second.html');
  assert.deepEqual(markWebviewReady(replaced), { ready: true, pendingUrl: null, currentUrl: 'file:///project/proto/second.html' });
});

test('navigates immediately after dom-ready', () => {
  const ready: WebviewLoadState = { ready: true, pendingUrl: null, currentUrl: 'file:///project/proto/first.html' };
  assert.deepEqual(queueWebviewUrl(ready, 'file:///project/proto/second.html'), { ready: true, pendingUrl: null, currentUrl: 'file:///project/proto/second.html' });
});

// dom-ready re-fires after every load. The handler may only navigate to a URL
// still pending at that moment — currentUrl always stays populated, so loading
// it on each dom-ready produced an infinite reload loop (ERR_ABORTED spam).
test('a later dom-ready re-fire leaves nothing pending to load', () => {
  const first = markWebviewReady(queueWebviewUrl({ ready: false, pendingUrl: null, currentUrl: null }, 'file:///project/proto/flow.html'));
  assert.equal(first.pendingUrl, null);
  const again = markWebviewReady(first);
  assert.deepEqual(again, { ready: true, pendingUrl: null, currentUrl: 'file:///project/proto/flow.html' });
});

