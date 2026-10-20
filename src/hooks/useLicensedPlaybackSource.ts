// src/hooks/useLicensedPlaybackSource.ts
//
// Resolves a playable source for a title from the Net-web backend.
//
// Replaces the old useStreamExtraction hook (multi-provider scrape/bypass
// pipeline, deleted in the piracy-removal pass). The backend resolves every
// provider concurrently and hands back what answered, so there is no source
// cascade or embed fallback to manage here.
//
// The backend returns per-source request headers, and most providers only
// serve segments to a request carrying the right User-Agent/Referer. Those
// headers are surfaced here so the player can use them instead of inventing
// its own — a mismatch is the usual cause of a stream that resolves but
// then 403s on the first segment.

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  getPlaybackSources,
  LicensedPlaybackSource,
} from '../services/licensedPlayback/LicensedPlaybackService';

export interface UseLicensedPlaybackSourceParams {
  mediaId: string;
  mediaType: string; // 'movie' | 'tv'
  season?: number;
  episode?: number;
  /**
   * Title and year of the title being played.
   *
   * These are not cosmetic. Most providers are title-based, and the backend
   * can only use the TMDB-id-based one without them, so omitting them makes
   * the request resolve zero sources. Pass whatever the caller knows.
   */
  title?: string;
  year?: number;
  isOffline?: boolean;
  offlineFilePath?: string;
  directStreamUrl?: string | null; // pre-resolved URL passed in via navigation params, if any
}

export interface UseLicensedPlaybackSourceResult {
  videoUrl: string | null;
  /** Request headers the provider expects. Pass these to the player. */
  streamHeaders?: Record<string, string>;
  /** Every source the backend resolved, best-effort ordered. For quality/audio choice. */
  sources: LicensedPlaybackSource[];
  /** The source currently selected from `sources`. */
  activeSource: LicensedPlaybackSource | null;
  /** Index of `activeSource` within `sources`. */
  activeIndex: number;
  /** Select a different source by index, for a quality or audio-track picker. */
  selectSource: (index: number) => void;
  isResolved: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useLicensedPlaybackSource(
  params: UseLicensedPlaybackSourceParams
): UseLicensedPlaybackSourceResult {
  const {
    mediaId, mediaType, season, episode, title, year,
    isOffline, offlineFilePath, directStreamUrl,
  } = params;

  const [sources, setSources] = useState<LicensedPlaybackSource[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isResolved, setIsResolved] = useState<boolean>(!!directStreamUrl || !!isOffline);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a stale resolve landing after params changed or unmount.
  const requestIdRef = useRef(0);

  const resolve = useCallback(async () => {
    if (isOffline && offlineFilePath) {
      setIsResolved(true);
      return;
    }
    if (directStreamUrl) {
      setIsResolved(true);
      return;
    }
    if (!mediaId) return;

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const found = await getPlaybackSources({
        tmdbId: mediaId,
        mediaType: mediaType === 'tv' ? 'tv' : 'movie',
        season,
        episode,
        title: title || undefined,
        year,
      });
      if (requestId !== requestIdRef.current) return;

      setSources(found);
      setActiveIndex(0);
      if (found.length === 0) {
        setError('Playback is not available for this title yet.');
      }
      setIsResolved(true);
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      console.warn('[useLicensedPlaybackSource] Failed to resolve playback source:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Playback is not available for this title yet.'
      );
      setIsResolved(true);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [mediaId, mediaType, season, episode, title, year, isOffline, offlineFilePath, directStreamUrl]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  const selectSource = useCallback((index: number) => {
    setActiveIndex((current) => {
      if (index < 0 || index >= sources.length) return current;
      return index;
    });
  }, [sources.length]);

  const activeSource = sources[activeIndex] ?? null;

  const videoUrl = useMemo(() => {
    if (isOffline && offlineFilePath) return offlineFilePath;
    if (directStreamUrl) return directStreamUrl;
    return activeSource?.url ?? null;
  }, [isOffline, offlineFilePath, directStreamUrl, activeSource]);

  return {
    videoUrl,
    streamHeaders: activeSource?.headers,
    sources,
    activeSource,
    activeIndex,
    selectSource,
    isResolved,
    isLoading,
    error,
  };
}

export default useLicensedPlaybackSource;
