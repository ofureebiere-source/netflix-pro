/**
 * Live TV preferences that must survive a restart: favourites, recently
 * watched, and the last category/country the viewer browsed.
 *
 * Channels are stored whole rather than by id. The catalogue is fetched from a
 * public index that the app does not control, so a channel can vanish between
 * launches — keeping the record means a favourite still resolves to something
 * playable, and a stale one can be pruned on read instead of silently emptying
 * the list.
 *
 * Zustand with `persist` rather than Redux: the Redux `settings` slice is
 * in-memory only, so favourites written there would be lost on every restart.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LiveChannel } from '../services/iptv/iptvCatalog';

/** How many recents to keep. Beyond this the list stops being a shortcut. */
export const MAX_RECENTS = 20;

/** How many favourites to keep. */
export const MAX_FAVOURITES = 200;

interface LiveTvState {
  favourites: LiveChannel[];
  recents: LiveChannel[];
  lastCategoryId: string | null;
  lastCountryCode: string | null;

  toggleFavourite: (channel: LiveChannel) => void;
  isFavourite: (id: string) => boolean;
  recordRecent: (channel: LiveChannel) => void;
  clearRecents: () => void;
  setLastCategory: (categoryId: string | null) => void;
  setLastCountry: (countryCode: string | null) => void;
}

/**
 * Keep only the fields the UI needs.
 *
 * A `LiveChannel` carries its headers and full group list; persisting those for
 * 200 favourites is a lot of JSON to parse on every launch. The playback path
 * re-reads the channel from the catalogue, so the stored copy only has to
 * render a row.
 */
const toStored = (channel: LiveChannel): LiveChannel => ({
  id: channel.id,
  name: channel.name,
  url: channel.url,
  logo: channel.logo,
  groups: channel.groups,
  countryCode: channel.countryCode,
  quality: channel.quality,
  isGeoBlocked: channel.isGeoBlocked,
  isPartTime: channel.isPartTime,
  categories: channel.categories,
});

export const useLiveTvStore = create<LiveTvState>()(
  persist(
    (set, get) => ({
      favourites: [],
      recents: [],
      lastCategoryId: null,
      lastCountryCode: null,

      toggleFavourite: (channel) =>
        set((state) => {
          const exists = state.favourites.some((item) => item.id === channel.id);
          if (exists) {
            return { favourites: state.favourites.filter((item) => item.id !== channel.id) };
          }
          return { favourites: [toStored(channel), ...state.favourites].slice(0, MAX_FAVOURITES) };
        }),

      isFavourite: (id) => get().favourites.some((item) => item.id === id),

      recordRecent: (channel) =>
        set((state) => ({
          // Move an existing entry to the front rather than duplicating it, so
          // re-watching a channel refreshes its position.
          recents: [
            toStored(channel),
            ...state.recents.filter((item) => item.id !== channel.id),
          ].slice(0, MAX_RECENTS),
        })),

      clearRecents: () => set({ recents: [] }),

      setLastCategory: (categoryId) => set({ lastCategoryId: categoryId }),
      setLastCountry: (countryCode) => set({ lastCountryCode: countryCode }),
    }),
    {
      name: 'netflixpro.livetv',
      storage: createJSONStorage(() => AsyncStorage),
      // Only the data is persisted; the actions are rebuilt on rehydrate.
      partialize: (state) => ({
        favourites: state.favourites,
        recents: state.recents,
        lastCategoryId: state.lastCategoryId,
        lastCountryCode: state.lastCountryCode,
      }),
    }
  )
);
