import { useCallback, useEffect, useState } from 'react';
import { bridgeQuery } from '../bridgeQuery.js';
import type { PrototypeEntry } from './prototypeMeta.js';

/** A prototype plus its self-contained HTML — one Canvas frame. */
export type PrototypeFrame = PrototypeEntry & { content: string };

export interface CanvasFramesApi {
  frames: PrototypeFrame[];
  /** True when the host capped the frame set (too many, or one was oversized). */
  truncated: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Loads every prototype's HTML in ONE host round-trip (`design:read-prototypes`)
 * so the Canvas can draw N frames without N IPC calls.
 */
export function useCanvasFrames(): CanvasFramesApi {
  const [frames, setFrames] = useState<PrototypeFrame[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      await bridgeQuery('design:ensure-seed', {});
      const res = await bridgeQuery<{ frames?: PrototypeFrame[]; truncated?: boolean; error?: string }>('design:read-prototypes', {});
      if (res?.error) throw new Error(res.error);
      setFrames(res?.frames ?? []);
      setTruncated(!!res?.truncated);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { frames, truncated, loading, error, refresh: () => void load() };
}
