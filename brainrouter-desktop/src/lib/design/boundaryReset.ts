// When a studio view throws, its boundary latches the error. Switching to
// another tab has to clear that latch, or the panel is wedged until a full
// reload — which is what a single app-wide boundary did.

/**
 * True when a latched error should be dropped because the boundary is now
 * showing different content. A healthy boundary is never reset: remounting a
 * working view on every tab change would discard its state for nothing.
 */
export function shouldResetBoundary(previousKey: string, nextKey: string, hasError: boolean): boolean {
  return hasError && previousKey !== nextKey;
}
