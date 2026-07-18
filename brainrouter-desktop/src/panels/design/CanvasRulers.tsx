import React from 'react';
import { rulerTicks } from '../../lib/design/canvasRulers.js';
import type { Viewport } from '../../lib/design/canvasViewport.js';

export function CanvasRulers({ view, width, height }: { view: Viewport; width: number; height: number }): React.ReactElement {
  const across = rulerTicks(width, view.scale, view.x);
  const down = rulerTicks(height, view.scale, view.y);
  return <>
    <div className="ds-ruler ds-ruler--top" aria-hidden="true">
      {across.map((tick) => <span key={`x-${tick.value}`} className="ds-ruler-tick" style={{ left: tick.offset }}><b>{tick.value}</b></span>)}
    </div>
    <div className="ds-ruler ds-ruler--right" aria-hidden="true">
      {down.map((tick) => <span key={`y-${tick.value}`} className="ds-ruler-tick" style={{ top: tick.offset }}><b>{tick.value}</b></span>)}
    </div>
  </>;
}
