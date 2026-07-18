import React from 'react';
import { shouldResetBoundary } from '../../lib/design/boundaryReset.js';

interface Props { resetKey: string; label: string; children: React.ReactNode }
interface State { error: Error | null; key: string }

/**
 * A boundary scoped to one view. The app-wide boundary in main.tsx is the last
 * resort — it replaces the whole window, so a throw in one Design Studio tab
 * took the nav down with it and left no way back except a reload. This one
 * keeps the failure inside the panel that caused it and clears itself when the
 * user switches to a different view.
 */
export class ResettableBoundary extends React.Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (shouldResetBoundary(state.key, props.resetKey, state.error !== null)) return { error: null, key: props.resetKey };
    return state.key === props.resetKey ? null : { key: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error(`[BrainRouter] ${this.props.label} failed to render:`, error, info?.componentStack);
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="ds-viewerror" role="alert">
        <p className="ds-eyebrow">{this.props.label} could not be shown</p>
        <p className="ds-viewerror-msg">{error.message || String(error)}</p>
        <p className="ds-viewerror-hint">The rest of the studio still works — switch tabs and back to retry.</p>
        <button type="button" className="ds-iconbtn" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}
