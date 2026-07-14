import { useCallback, useEffect, useState } from 'react';
import { bridgeQuery } from '../bridgeQuery.js';
import {
  createCanvasDocument,
  mergeCanvasDocument,
  type CanvasDocument,
  type CanvasPrototypeEntry,
} from './canvasModel.js';

export interface CanvasDocumentApi {
  document: CanvasDocument;
  loading: boolean;
  error: string | null;
  save: (next: CanvasDocument) => void;
  refresh: () => void;
}

export function useCanvasDocument(entries: readonly CanvasPrototypeEntry[]): CanvasDocumentApi {
  const [document, setDocument] = useState<CanvasDocument>(() => createCanvasDocument(entries));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await bridgeQuery<{ document?: unknown; error?: string }>('design:read-canvas-document', {});
      if (result?.error) throw new Error(result.error);
      setDocument(mergeCanvasDocument(result?.document, entries));
    } catch (err) {
      // A missing or malformed local document should not make the Canvas unusable.
      setDocument(createCanvasDocument(entries));
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }, [entries]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback((next: CanvasDocument): void => {
    setDocument(next);
    void bridgeQuery<{ ok?: boolean; error?: string }>('design:write-canvas-document', { document: next })
      .then((result) => { if (result?.error) setError(result.error); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return { document, loading, error, save, refresh: () => void load() };
}
