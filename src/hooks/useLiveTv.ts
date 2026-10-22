/**
 * Loads the Live TV catalogue and derives what the screen renders.
 *
 * Uses React Query rather than a plain effect so the catalogue is shared across
 * the tab, the search box and the country list, and so returning to the tab
 * does not re-download a 2.5 MB playlist. The query key is stable and the
 * service has its own disk cache, so a mount after the TTL still avoids the
 * network.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  channelsInCategory,
  channelsInCountry,
  clearLiveCatalogCache,
  loadLiveCatalog,
  preloadChannels,
  type LiveCatalog,
  type LiveChannel,
} from '../services/iptv/iptvCatalog';
import { matchesQuery } from '../services/iptv/m3uParser';

export const LIVE_CATALOG_QUERY_KEY = ['livetv', 'catalog'] as const;

export interface UseLiveTvResult {
  catalog: LiveCatalog | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => void;
}

export const useLiveTvCatalog = (): UseLiveTvResult => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: LIVE_CATALOG_QUERY_KEY,
    queryFn: () => loadLiveCatalog(),
    // The service owns the freshness window; re-running the loader on focus
    // would only re-parse a playlist that has not changed.
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  return {
    catalog: query.data ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => {
      // Drop both caches so a pull-to-refresh really re-fetches.
      void clearLiveCatalogCache().then(() =>
        queryClient.invalidateQueries({ queryKey: LIVE_CATALOG_QUERY_KEY })
      );
    },
  };
};

/**
 * The channels for a category, sorted and memoised.
 *
 * Filtering is O(channels) and the grid re-renders on every scroll frame, so
 * the result is memoised on the category rather than recomputed per render.
 */
export const useCategoryChannels = (
  catalog: LiveCatalog | null,
  categoryId: string | null
): LiveChannel[] =>
  useMemo(() => {
    if (!catalog || !categoryId) return [];
    return channelsInCategory(catalog, categoryId);
  }, [catalog, categoryId]);

export const useCountryChannels = (
  catalog: LiveCatalog | null,
  countryCode: string | null
): LiveChannel[] =>
  useMemo(() => {
    if (!catalog || !countryCode) return [];
    return channelsInCountry(catalog, countryCode);
  }, [catalog, countryCode]);

/** Free-text search across the whole catalogue. */
export const useChannelSearch = (
  catalog: LiveCatalog | null,
  query: string
): LiveChannel[] =>
  useMemo(() => {
    if (!catalog) return [];
    const trimmed = query.trim();
    if (!trimmed) return [];
    return catalog.channels.filter((channel) => matchesQuery(channel, trimmed));
  }, [catalog, query]);

/**
 * Warm the streams for the channels about to be shown.
 *
 * Called as the grid settles so a tap starts playback from an already-open
 * connection. The returned function is stable, because FlatList holds on to
 * callbacks that use it.
 */
export const useChannelPreload = (): ((channels: LiveChannel[]) => void) =>
  useCallback((channels: LiveChannel[]) => {
    void preloadChannels(channels);
  }, []);
