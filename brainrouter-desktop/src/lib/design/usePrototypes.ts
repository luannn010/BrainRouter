// brainrouter-desktop/src/lib/design/usePrototypes.ts
import { useCallback, useEffect, useState } from 'react';
import { bridgeQuery } from '../bridgeQuery.js';
import { sortByRecent, type PrototypeEntry } from './prototypeMeta.js';

export interface PrototypesApi {
  entries: PrototypeEntry[];
  selected: PrototypeEntry | null;
  select: (id: string) => void;
  refresh: () => void;
  loading: boolean;
  error: string | null;
}

export function usePrototypes(): PrototypesApi {
  const [entries, setEntries] = useState<PrototypeEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      await bridgeQuery('design:ensure-seed', {});
      const res = await bridgeQuery<{ prototypes?: PrototypeEntry[]; error?: string }>('design:list-prototypes', {});
      if (res?.error) throw new Error(res.error);
      const list = sortByRecent(res?.prototypes ?? []);
      setEntries(list);
      setSelectedId((cur) => cur && list.some((e) => e.id === cur) ? cur : (list[0]?.id ?? null));
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return {
    entries,
    selected: entries.find((e) => e.id === selectedId) ?? null,
    select: setSelectedId,
    refresh: () => void load(),
    loading,
    error,
  };
}
