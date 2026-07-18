export type WebviewLoadState = {
  ready: boolean;
  pendingUrl: string | null;
  currentUrl: string | null;
};

export function queueWebviewUrl(state: WebviewLoadState, url: string): WebviewLoadState {
  if (!state.ready) return { ...state, pendingUrl: url };
  return { ...state, currentUrl: url, pendingUrl: null };
}

export function markWebviewReady(state: WebviewLoadState): WebviewLoadState {
  return { ready: true, pendingUrl: null, currentUrl: state.pendingUrl ?? state.currentUrl };
}

