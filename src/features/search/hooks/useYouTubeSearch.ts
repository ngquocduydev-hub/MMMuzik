'use client';

import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/lib/http';
import type { SearchResultDto } from '@/shared/types';
import { searchTracks } from '../services/searchApi';

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

/**
 * Search state machine (Phase 3). EXPLICIT submit only — never search-as-you-type
 * (the YouTube Data API quota is a scarce shared resource; per-keystroke calls
 * would drain it). A monotonic request id discards stale responses so a slow
 * earlier query can't overwrite a newer one. `unavailable` = the server degraded
 * (no key / quota spent / API error) → the UI offers the URL-paste fallback.
 */
export function useYouTubeSearch(roomId: string | null) {
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<SearchResultDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const reqId = useRef(0);

  const search = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!roomId || !query) return;
      const id = ++reqId.current;
      setStatus('loading');
      setError(null);
      setSubmittedQuery(query);
      try {
        const res = await searchTracks(roomId, query);
        if (id !== reqId.current) return; // superseded by a newer search
        if (!res.available) {
          setResults([]);
          setStatus('unavailable');
          return;
        }
        setResults(res.results);
        setStatus('ready');
      } catch (err) {
        if (id !== reqId.current) return;
        setError(err instanceof ApiError ? err.message : 'Search failed — try again');
        setStatus('error');
      }
    },
    [roomId],
  );

  const reset = useCallback(() => {
    reqId.current++; // invalidate any in-flight response
    setStatus('idle');
    setResults([]);
    setError(null);
    setSubmittedQuery('');
  }, []);

  return { status, results, error, submittedQuery, search, reset };
}
