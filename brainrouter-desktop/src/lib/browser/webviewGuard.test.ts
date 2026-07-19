import test from 'node:test';
import assert from 'node:assert/strict';
import { WEBVIEW_UNAVAILABLE, isWebviewAttached, isWebviewUnavailableError, webviewErrorText } from './webviewGuard.js';

test('a missing element is not attached', () => {
  assert.equal(isWebviewAttached(null), false);
  assert.equal(isWebviewAttached(undefined), false);
});

test('attachment follows isConnected', () => {
  assert.equal(isWebviewAttached({ isConnected: false }), false);
  assert.equal(isWebviewAttached({ isConnected: true }), true);
});

test('the pre-check sentinel is recognised by the classifier', () => {
  // Load-bearing: the pre-check path and the real-throw path must stay equally
  // quiet, or half the teardown noise comes back as warnings.
  assert.equal(isWebviewUnavailableError(new Error(WEBVIEW_UNAVAILABLE)), true);
});

test('classifies the real Electron detachment message', () => {
  assert.equal(isWebviewUnavailableError(new Error(
    'The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.',
  )), true);
});

test('classifies the getWebContentsId and destroyed-webContents variants', () => {
  assert.equal(isWebviewUnavailableError(new Error("Cannot read properties of null (reading 'getWebContentsId')")), true);
  assert.equal(isWebviewUnavailableError(new Error('webContents is not available')), true);
  assert.equal(isWebviewUnavailableError(new Error('The webContents was destroyed')), true);
});

test('is case-insensitive and accepts a bare string rejection', () => {
  assert.equal(isWebviewUnavailableError('THE WEBVIEW MUST BE ATTACHED TO THE DOM'), true);
});

test('does NOT classify a genuine guest-script fault as teardown noise', () => {
  // The whole point of classifying rather than blanket-silencing: a broken
  // injected snippet must still reach the console.
  assert.equal(isWebviewUnavailableError(new Error('ReferenceError: foo is not defined')), false);
  assert.equal(isWebviewUnavailableError(new TypeError('el.click is not a function')), false);
  assert.equal(isWebviewUnavailableError(new Error('Script failed to execute')), false);
});

test('does not classify empty or non-error values', () => {
  assert.equal(isWebviewUnavailableError(null), false);
  assert.equal(isWebviewUnavailableError(undefined), false);
  assert.equal(isWebviewUnavailableError({}), false);
  assert.equal(isWebviewUnavailableError(new Error('')), false);
  assert.equal(isWebviewUnavailableError(''), false);
});

test('error text prefers the real message and falls back to the sentinel', () => {
  assert.equal(webviewErrorText(new Error('boom')), 'boom');
  assert.equal(webviewErrorText('boom'), 'boom');
  assert.equal(webviewErrorText(new Error('')), WEBVIEW_UNAVAILABLE);
  assert.equal(webviewErrorText(null), WEBVIEW_UNAVAILABLE);
});
