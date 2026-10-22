import { useLiveTvStore, MAX_RECENTS, MAX_FAVOURITES } from '../liveTvStore';
import type { LiveChannel } from '../../services/iptv/iptvCatalog';

const channel = (id: string, overrides: Partial<LiveChannel> = {}): LiveChannel => ({
  id,
  name: `Channel ${id}`,
  url: `https://example.test/${id}.m3u8`,
  groups: ['News'],
  categories: ['news'],
  isGeoBlocked: false,
  isPartTime: false,
  ...overrides,
});

const reset = () =>
  useLiveTvStore.setState({
    favourites: [],
    recents: [],
    lastCategoryId: null,
    lastCountryCode: null,
  });

describe('liveTvStore', () => {
  beforeEach(reset);

  describe('favourites', () => {
    it('starts empty', () => {
      expect(useLiveTvStore.getState().favourites).toEqual([]);
    });

    it('adds a channel', () => {
      useLiveTvStore.getState().toggleFavourite(channel('a'));
      expect(useLiveTvStore.getState().favourites.map((item) => item.id)).toEqual(['a']);
    });

    it('removes a channel when toggled twice', () => {
      useLiveTvStore.getState().toggleFavourite(channel('a'));
      useLiveTvStore.getState().toggleFavourite(channel('a'));
      expect(useLiveTvStore.getState().favourites).toEqual([]);
    });

    it('reports membership', () => {
      useLiveTvStore.getState().toggleFavourite(channel('a'));
      expect(useLiveTvStore.getState().isFavourite('a')).toBe(true);
      expect(useLiveTvStore.getState().isFavourite('b')).toBe(false);
    });

    it('keeps the newest favourite first', () => {
      useLiveTvStore.getState().toggleFavourite(channel('a'));
      useLiveTvStore.getState().toggleFavourite(channel('b'));
      expect(useLiveTvStore.getState().favourites.map((item) => item.id)).toEqual(['b', 'a']);
    });

    it('does not exceed the cap', () => {
      for (let i = 0; i < MAX_FAVOURITES + 5; i++) {
        useLiveTvStore.getState().toggleFavourite(channel(`c${i}`));
      }
      expect(useLiveTvStore.getState().favourites).toHaveLength(MAX_FAVOURITES);
    });

    it('stores only the fields the list needs, not the headers', () => {
      useLiveTvStore
        .getState()
        .toggleFavourite(channel('a', { headers: { 'User-Agent': 'Agent/1' } }));
      expect(useLiveTvStore.getState().favourites[0].headers).toBeUndefined();
    });

    it('removes the right channel from the middle of the list', () => {
      ['a', 'b', 'c'].forEach((id) => useLiveTvStore.getState().toggleFavourite(channel(id)));
      useLiveTvStore.getState().toggleFavourite(channel('b'));
      expect(useLiveTvStore.getState().favourites.map((item) => item.id)).toEqual(['c', 'a']);
    });
  });

  describe('recents', () => {
    it('records a channel', () => {
      useLiveTvStore.getState().recordRecent(channel('a'));
      expect(useLiveTvStore.getState().recents.map((item) => item.id)).toEqual(['a']);
    });

    it('moves a re-watched channel to the front instead of duplicating it', () => {
      ['a', 'b'].forEach((id) => useLiveTvStore.getState().recordRecent(channel(id)));
      useLiveTvStore.getState().recordRecent(channel('a'));
      expect(useLiveTvStore.getState().recents.map((item) => item.id)).toEqual(['a', 'b']);
    });

    it('does not exceed the cap', () => {
      for (let i = 0; i < MAX_RECENTS + 5; i++) {
        useLiveTvStore.getState().recordRecent(channel(`c${i}`));
      }
      expect(useLiveTvStore.getState().recents).toHaveLength(MAX_RECENTS);
    });

    it('keeps the most recent entry when trimming', () => {
      for (let i = 0; i < MAX_RECENTS + 5; i++) {
        useLiveTvStore.getState().recordRecent(channel(`c${i}`));
      }
      expect(useLiveTvStore.getState().recents[0].id).toBe(`c${MAX_RECENTS + 4}`);
    });

    it('clears', () => {
      useLiveTvStore.getState().recordRecent(channel('a'));
      useLiveTvStore.getState().clearRecents();
      expect(useLiveTvStore.getState().recents).toEqual([]);
    });

    it('leaves favourites untouched', () => {
      useLiveTvStore.getState().toggleFavourite(channel('a'));
      useLiveTvStore.getState().recordRecent(channel('b'));
      useLiveTvStore.getState().clearRecents();
      expect(useLiveTvStore.getState().favourites.map((item) => item.id)).toEqual(['a']);
    });
  });

  describe('last browsed position', () => {
    it('remembers the last category', () => {
      useLiveTvStore.getState().setLastCategory('news');
      expect(useLiveTvStore.getState().lastCategoryId).toBe('news');
    });

    it('remembers the last country', () => {
      useLiveTvStore.getState().setLastCountry('US');
      expect(useLiveTvStore.getState().lastCountryCode).toBe('US');
    });
  });

  describe('persistence', () => {
    it('writes through to storage', async () => {
      useLiveTvStore.getState().toggleFavourite(channel('a'));
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await new Promise((resolve) => setTimeout(resolve, 0));
      const raw = await AsyncStorage.getItem('netflixpro.livetv');
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw).state.favourites[0].id).toBe('a');
    });

    it('does not persist the actions', async () => {
      useLiveTvStore.getState().toggleFavourite(channel('a'));
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await new Promise((resolve) => setTimeout(resolve, 0));
      const raw = await AsyncStorage.getItem('netflixpro.livetv');
      expect(JSON.parse(raw).state.toggleFavourite).toBeUndefined();
    });
  });
});
