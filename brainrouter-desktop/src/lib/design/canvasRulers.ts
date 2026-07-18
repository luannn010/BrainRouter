// brainrouter-desktop/src/lib/design/canvasRulers.ts
// Ruler ticks for a pannable, zoomable world. `origin` is the screen-space
// position of world 0 — the same number the world layer translates by — so the
// ruler and the canvas can never disagree about where the origin is.
export type RulerTick = { value: number; offset: number };

/** Pitches a designer reads without counting. */
const STEPS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000];
/** Hard stop so a pathological pitch can't spin the render loop. */
const MAX_TICKS = 512;

/** The smallest pitch whose on-screen spacing clears `minSpacing`. */
export function rulerStep(scale: number, minSpacing = 64): number {
  const safe = Number.isFinite(scale) && scale > 0 ? scale : 1;
  for (const step of STEPS) if (step * safe >= minSpacing) return step;
  return STEPS[STEPS.length - 1];
}

export function rulerTicks(length: number, scale: number, origin = 0, step?: number): RulerTick[] {
  const safeLength = Math.max(0, length);
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const pitch = step !== undefined && step > 0 ? step : rulerStep(safeScale);
  // The first tick at or past the left edge of the viewport.
  const first = Math.ceil((0 - origin) / safeScale / pitch) * pitch;
  const ticks: RulerTick[] = [];
  for (let value = first; ticks.length < MAX_TICKS; value += pitch) {
    const offset = value * safeScale + origin;
    if (offset > safeLength) break;
    ticks.push({ value, offset });
  }
  return ticks;
}
