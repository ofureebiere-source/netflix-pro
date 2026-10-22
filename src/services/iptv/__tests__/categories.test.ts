import {
  LIVE_CATEGORIES,
  FALLBACK_CATEGORY_ID,
  categoryForGroup,
  categoriesForGroups,
  categoryById,
} from '../categories';

describe('categories', () => {
  describe('taxonomy', () => {
    it('uses a unique id for every category', () => {
      const ids = LIVE_CATEGORIES.map((category) => category.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('uses a unique i18n key for every category', () => {
      const keys = LIVE_CATEGORIES.map((category) => category.labelKey);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('does not carry the xxx category', () => {
      expect(LIVE_CATEGORIES.some((category) => category.id === 'xxx')).toBe(false);
    });

    it('namespaces every label key under livetv.category', () => {
      for (const category of LIVE_CATEGORIES) {
        expect(category.labelKey).toBe(`livetv.category.${category.id}`);
      }
    });
  });

  describe('categoryForGroup', () => {
    it('resolves a genre group', () => {
      expect(categoryForGroup('News')).toBe('news');
    });

    it('is case-insensitive', () => {
      expect(categoryForGroup('MOVIES')).toBe('movies');
      expect(categoryForGroup('sports')).toBe('sports');
    });

    it('tolerates surrounding whitespace', () => {
      expect(categoryForGroup('  Kids  ')).toBe('kids');
    });

    it('returns null for a country group, which is a different axis', () => {
      expect(categoryForGroup('United States')).toBeNull();
      expect(categoryForGroup('India')).toBeNull();
    });

    it('returns null for a group that is not in the taxonomy', () => {
      expect(categoryForGroup('Some Random Group')).toBeNull();
    });

    it('maps the catalogue aliases onto one category', () => {
      expect(categoryForGroup('Undefined')).toBe(FALLBACK_CATEGORY_ID);
      expect(categoryForGroup('Anime')).toBe('animation');
      expect(categoryForGroup('Politics')).toBe('legislative');
    });
  });

  describe('categoriesForGroups', () => {
    it('resolves every genre a channel claims', () => {
      expect(categoriesForGroups(['News', 'Sports']).sort()).toEqual(['news', 'sports']);
    });

    it('ignores country groups mixed in with genres', () => {
      expect(categoriesForGroups(['United States', 'News'])).toEqual(['news']);
    });

    it('falls back to the catch-all when no group names a genre', () => {
      expect(categoriesForGroups(['United States'])).toEqual([FALLBACK_CATEGORY_ID]);
    });

    it('falls back for an empty group list', () => {
      expect(categoriesForGroups([])).toEqual([FALLBACK_CATEGORY_ID]);
    });

    it('de-duplicates a genre claimed twice under different aliases', () => {
      expect(categoriesForGroups(['Anime', 'Animation'])).toEqual(['animation']);
    });
  });

  describe('categoryById', () => {
    it('finds a category', () => {
      expect(categoryById('movies')?.labelKey).toBe('livetv.category.movies');
    });

    it('returns undefined for an unknown id', () => {
      expect(categoryById('nope')).toBeUndefined();
    });
  });
});
