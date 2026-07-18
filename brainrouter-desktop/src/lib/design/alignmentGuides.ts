// Snapping a dragged screen to the other screens' edges and centres, plus the
// guides that show why it snapped. Pure geometry in world units — the caller
// converts pointer deltas before asking.
//
// Modelled on OpenPencil's packages/scene-graph/src/snap.ts: 5 candidate pairs
// per axis, sibling nodes only, closest wins.

export interface GuideBox { x: number; y: number; w: number; h: number }

/** A line to draw: `at` is the world coordinate on `axis`, `from`/`to` its extent. */
export interface Guide { axis: 'x' | 'y'; at: number; from: number; to: number }

export interface SnapResult { x: number; y: number; guides: Guide[] }

/** How close, in world units, an edge must be before it grabs. */
export const SNAP_THRESHOLD = 5;

/**
 * The five pairings on one axis: near↔near, near↔far, far↔near, far↔far, and
 * centre↔centre. Edges pair with edges and centres with centres — an edge
 * never snaps to a centre, which would make a box jump to a line that means
 * nothing to it.
 */
function candidatePairs(start: number, size: number, otherStart: number, otherSize: number): Array<{ mine: number; theirs: number }> {
  const near = start;
  const far = start + size;
  const centre = start + size / 2;
  const theirNear = otherStart;
  const theirFar = otherStart + otherSize;
  const theirCentre = otherStart + otherSize / 2;
  return [
    { mine: near, theirs: theirNear },
    { mine: near, theirs: theirFar },
    { mine: far, theirs: theirNear },
    { mine: far, theirs: theirFar },
    { mine: centre, theirs: theirCentre },
  ];
}

interface Candidate { delta: number; at: number; other: GuideBox }

function bestOn(start: number, size: number, others: readonly GuideBox[], axis: 'x' | 'y', tolerance: number): Candidate | null {
  let best: Candidate | null = null;
  for (const other of others) {
    const otherStart = axis === 'x' ? other.x : other.y;
    const otherSize = axis === 'x' ? other.w : other.h;
    for (const pair of candidatePairs(start, size, otherStart, otherSize)) {
      const delta = pair.theirs - pair.mine;
      if (Math.abs(delta) > tolerance) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, at: pair.theirs, other };
    }
  }
  return best;
}

/**
 * Nudges `moving` onto the nearest neighbour line within `tolerance` on each
 * axis independently, and returns the guides for whatever grabbed. The axes are
 * independent so a box can snap horizontally without being dragged vertically.
 *
 * A guide spans both boxes rather than only their overlap: two boxes that share
 * a left edge but sit far apart vertically have no overlap to draw, and a line
 * that does not reach both of them explains nothing.
 */
export function snapToNeighbours(moving: GuideBox, others: readonly GuideBox[], tolerance: number = SNAP_THRESHOLD): SnapResult {
  const guides: Guide[] = [];
  const horizontal = bestOn(moving.x, moving.w, others, 'x', tolerance);
  const vertical = bestOn(moving.y, moving.h, others, 'y', tolerance);
  const x = moving.x + (horizontal?.delta ?? 0);
  const y = moving.y + (vertical?.delta ?? 0);
  if (horizontal) {
    guides.push({
      axis: 'x',
      at: horizontal.at,
      from: Math.min(y, horizontal.other.y),
      to: Math.max(y + moving.h, horizontal.other.y + horizontal.other.h),
    });
  }
  if (vertical) {
    guides.push({
      axis: 'y',
      at: vertical.at,
      from: Math.min(x, vertical.other.x),
      to: Math.max(x + moving.w, vertical.other.x + vertical.other.w),
    });
  }
  return { x, y, guides };
}
