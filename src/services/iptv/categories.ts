/**
 * The Live TV category taxonomy.
 *
 * The catalogue's own `group-title` field is not a clean genre list: across the
 * public playlists it holds 219 distinct values, and they mix genres (`News`,
 * `Sports`) with country names (`United States`, `India`) in the same field. So
 * categories are derived by intersecting each channel's groups with the known
 * genre set below, rather than by trusting the field wholesale.
 *
 * The set is iptv-org's own published taxonomy (`api/categories.json`), minus
 * `xxx`, which is not carried here. Using their ids and names rather than
 * inventing our own keeps the categories stable when their catalogue changes,
 * and means the category playlists under `categories/<id>.m3u` line up with what
 * the app shows.
 *
 * A note on the vocabulary: viewers expect film-style genres ("Action",
 * "Adventure"). Those do not exist in this data — it is live television, and
 * its taxonomy is the one below. Inventing genres the catalogue cannot populate
 * would produce categories that are always empty.
 */

export interface LiveCategory {
  /** iptv-org category id; also the `categories/<id>.m3u` filename. */
  id: string;
  /** i18n key under `livetv.category.*`. */
  labelKey: string;
  /** Ionicons glyph used on the category card. */
  icon: string;
  /**
   * Group names that belong to this category, lower-cased.
   *
   * `group-title` is free text, so a few categories need spellings the
   * catalogue actually uses (`Legislative` is political coverage; `General` and
   * the literal `Undefined` group are both catch-alls).
   */
  aliases: string[];
}

export const LIVE_CATEGORIES: LiveCategory[] = [
  { id: 'movies', labelKey: 'livetv.category.movies', icon: 'film', aliases: ['movies', 'movie', 'cinema'] },
  { id: 'series', labelKey: 'livetv.category.series', icon: 'albums', aliases: ['series', 'tv shows', 'tv'] },
  { id: 'news', labelKey: 'livetv.category.news', icon: 'newspaper', aliases: ['news'] },
  { id: 'sports', labelKey: 'livetv.category.sports', icon: 'football', aliases: ['sports', 'sport'] },
  { id: 'entertainment', labelKey: 'livetv.category.entertainment', icon: 'sparkles', aliases: ['entertainment'] },
  { id: 'kids', labelKey: 'livetv.category.kids', icon: 'balloon', aliases: ['kids', 'children'] },
  { id: 'documentary', labelKey: 'livetv.category.documentary', icon: 'videocam', aliases: ['documentary', 'documentaries'] },
  { id: 'music', labelKey: 'livetv.category.music', icon: 'musical-notes', aliases: ['music'] },
  { id: 'comedy', labelKey: 'livetv.category.comedy', icon: 'happy', aliases: ['comedy'] },
  { id: 'animation', labelKey: 'livetv.category.animation', icon: 'color-palette', aliases: ['animation', 'anime', 'cartoons'] },
  { id: 'family', labelKey: 'livetv.category.family', icon: 'people', aliases: ['family'] },
  { id: 'culture', labelKey: 'livetv.category.culture', icon: 'globe', aliases: ['culture'] },
  { id: 'education', labelKey: 'livetv.category.education', icon: 'school', aliases: ['education', 'educational'] },
  { id: 'lifestyle', labelKey: 'livetv.category.lifestyle', icon: 'home', aliases: ['lifestyle'] },
  { id: 'cooking', labelKey: 'livetv.category.cooking', icon: 'restaurant', aliases: ['cooking', 'food'] },
  { id: 'travel', labelKey: 'livetv.category.travel', icon: 'airplane', aliases: ['travel'] },
  { id: 'outdoor', labelKey: 'livetv.category.outdoor', icon: 'trail-sign', aliases: ['outdoor'] },
  { id: 'relax', labelKey: 'livetv.category.relax', icon: 'leaf', aliases: ['relax', 'relaxing'] },
  { id: 'science', labelKey: 'livetv.category.science', icon: 'flask', aliases: ['science'] },
  { id: 'weather', labelKey: 'livetv.category.weather', icon: 'partly-sunny', aliases: ['weather'] },
  { id: 'auto', labelKey: 'livetv.category.auto', icon: 'car-sport', aliases: ['auto', 'automotive', 'cars'] },
  { id: 'business', labelKey: 'livetv.category.business', icon: 'briefcase', aliases: ['business', 'finance'] },
  { id: 'shop', labelKey: 'livetv.category.shop', icon: 'cart', aliases: ['shop', 'shopping'] },
  { id: 'legislative', labelKey: 'livetv.category.legislative', icon: 'document-text', aliases: ['legislative', 'politics', 'government'] },
  { id: 'public', labelKey: 'livetv.category.public', icon: 'business', aliases: ['public'] },
  { id: 'religious', labelKey: 'livetv.category.religious', icon: 'flower', aliases: ['religious', 'religion'] },
  { id: 'classic', labelKey: 'livetv.category.classic', icon: 'time', aliases: ['classic'] },
  { id: 'interactive', labelKey: 'livetv.category.interactive', icon: 'game-controller', aliases: ['interactive', 'gaming'] },
  // The catch-all last: everything the viewer cannot place otherwise lands here.
  { id: 'general', labelKey: 'livetv.category.general', icon: 'tv', aliases: ['general', 'undefined', 'other', 'international'] },
];

/**
 * Category id used for a channel whose groups name no genre at all.
 *
 * These are the entries grouped only by country — `group-title="United States"`
 * — which is common. Dropping them would silently hide a large slice of the
 * catalogue from the category grid, so they are collected rather than lost.
 */
export const FALLBACK_CATEGORY_ID = 'general';

/** Lookup from a lower-cased group name to the category that owns it. */
const ALIAS_TO_CATEGORY = new Map<string, string>();
for (const category of LIVE_CATEGORIES) {
  for (const alias of category.aliases) ALIAS_TO_CATEGORY.set(alias, category.id);
}

/**
 * Resolve a single `group-title` value to a category id, if it names a genre.
 *
 * Country groups return null: they are not genres, and country browsing is a
 * separate axis driven by the channel's `tvg-id` country code.
 */
export const categoryForGroup = (group: string): string | null =>
  ALIAS_TO_CATEGORY.get(group.trim().toLowerCase()) ?? null;

/**
 * Every category a channel belongs to, with the catch-all applied when the
 * channel names no genre.
 */
export const categoriesForGroups = (groups: string[]): string[] => {
  const found = new Set<string>();
  for (const group of groups) {
    const category = categoryForGroup(group);
    if (category) found.add(category);
  }
  return found.size > 0 ? [...found] : [FALLBACK_CATEGORY_ID];
};

/** The category metadata for an id, for rendering a header or a card. */
export const categoryById = (id: string): LiveCategory | undefined =>
  LIVE_CATEGORIES.find((category) => category.id === id);
