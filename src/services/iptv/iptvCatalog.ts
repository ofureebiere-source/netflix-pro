/**
 * Live TV catalogue, sourced from the public iptv-org project.
 *
 * ── WHY THIS SOURCE ─────────────────────────────────────────────────────
 * iptv-org publishes a maintained, community-contributed index of publicly
 * available live streams, with no API key and no account. It is the same data
 * the project's other clients use, so there is one notion of "what is on".
 *
 * ── ONE FETCH, TWO AXES ─────────────────────────────────────────────────
 * iptv-org publishes several regroupings of the same channels. Two matter:
 *
 *   index.m3u          11,362 channels grouped by *genre*  (`group-title="News"`)
 *   index.country.m3u  12,854 channels grouped by *country* (`group-title="India"`)
 *
 * Only `index.m3u` is fetched. Its `group-title` values are exactly the 30
 * genre names the category taxonomy is built from, and every one of its entries
 * carries a `tvg-id` whose country segment gives the country — so a single
 * download populates both the genre grid and the country list. Fetching the
 * country regrouping as well would double the transfer for channels that are
 * largely duplicates of ones already held.
 *
 * ── CACHING ─────────────────────────────────────────────────────────────
 * The playlist is ~2.5 MB, so it is cached to disk and re-parsed from there
 * rather than re-downloaded. Parsing the full index costs ~60 ms, which is
 * cheap enough that caching the raw text (smaller) beats caching the parsed
 * objects (larger).
 */

import * as LegacyFileSystem from 'expo-file-system/legacy';

import { parseM3U, sortChannels, type IptvChannel } from './m3uParser';
import {
  LIVE_CATEGORIES,
  categoriesForGroups,
  type LiveCategory,
} from './categories';

export const PLAYLIST_URL = 'https://iptv-org.github.io/iptv/index.m3u';
export const COUNTRIES_URL = 'https://iptv-org.github.io/api/countries.json';

/** Six hours. The upstream index changes slowly; a stale grid is harmless. */
export const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;

const NETWORK_TIMEOUT_MS = 20000;
const PRELOAD_TIMEOUT_MS = 8000;
const CACHE_DIR = `${LegacyFileSystem.documentDirectory}livetv/`;
const PLAYLIST_CACHE_FILE = `${CACHE_DIR}index.m3u`;
const META_CACHE_FILE = `${CACHE_DIR}meta.json`;

/** A channel with its category ids resolved, so the grid can filter cheaply. */
export interface LiveChannel extends IptvChannel {
  categories: string[];
}

export interface LiveCountry {
  /** Upper-case ISO code, matching `countries.json`. */
  code: string;
  name: string;
  flag: string;
  channelCount: number;
}

export interface LiveCategoryInfo extends LiveCategory {
  channelCount: number;
}

export interface LiveCatalog {
  channels: LiveChannel[];
  /** Categories that actually hold channels, most-populated first. */
  categories: LiveCategoryInfo[];
  countries: LiveCountry[];
  fetchedAt: number;
  /** True when this came from the disk cache rather than the network. */
  fromCache: boolean;
}

interface PlaylistMeta {
  fetchedAt: number;
}

const withTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const ensureCacheDir = async (): Promise<void> => {
  try {
    const info = await LegacyFileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) await LegacyFileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  } catch {
    // A cache directory that cannot be created costs a re-download, nothing more.
  }
};

const readCachedPlaylist = async (): Promise<string | null> => {
  try {
    const metaRaw = await LegacyFileSystem.readAsStringAsync(META_CACHE_FILE);
    const meta = JSON.parse(metaRaw) as PlaylistMeta;
    if (!meta?.fetchedAt) return null;
    if (Date.now() - meta.fetchedAt > CATALOG_TTL_MS) return null;
    const text = await LegacyFileSystem.readAsStringAsync(PLAYLIST_CACHE_FILE);
    return text || null;
  } catch {
    return null;
  }
};

const writeCachedPlaylist = async (text: string): Promise<void> => {
  try {
    await ensureCacheDir();
    await LegacyFileSystem.writeAsStringAsync(PLAYLIST_CACHE_FILE, text);
    const meta: PlaylistMeta = { fetchedAt: Date.now() };
    await LegacyFileSystem.writeAsStringAsync(META_CACHE_FILE, JSON.stringify(meta));
  } catch {
    // Failing to cache costs a re-download next launch.
  }
};

/** Force the next load to hit the network, e.g. from pull-to-refresh. */
export const clearLiveCatalogCache = async (): Promise<void> => {
  try {
    await LegacyFileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
  } catch {
    // Nothing to clear.
  }
};

interface CountryMeta {
  name: string;
  code: string;
  flag?: string;
}

const fetchCountries = async (): Promise<CountryMeta[]> => {
  try {
    const response = await withTimeout(COUNTRIES_URL, NETWORK_TIMEOUT_MS);
    if (!response.ok) return [];
    const parsed = await response.json();
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Country names are cosmetic; the grid still works without them.
    return [];
  }
};

/** Country metadata for a code, tolerating the catalogue's lowercase form. */
const countryLookup = (countries: CountryMeta[]): Map<string, CountryMeta> => {
  const map = new Map<string, CountryMeta>();
  for (const country of countries) {
    if (country?.code) map.set(country.code.toUpperCase(), country);
  }
  return map;
};

const buildCatalog = (
  channels: LiveChannel[],
  countries: CountryMeta[],
  fetchedAt: number,
  fromCache: boolean
): LiveCatalog => {
  const categoryCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();

  for (const channel of channels) {
    for (const category of channel.categories) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
    if (channel.countryCode) {
      const code = channel.countryCode.toUpperCase();
      countryCounts.set(code, (countryCounts.get(code) ?? 0) + 1);
    }
  }

  // Only offer a category that has something behind it — an empty grid is a
  // dead end for the viewer.
  const categories: LiveCategoryInfo[] = LIVE_CATEGORIES.map((category) => ({
    ...category,
    channelCount: categoryCounts.get(category.id) ?? 0,
  }))
    .filter((category) => category.channelCount > 0)
    .sort((a, b) => b.channelCount - a.channelCount);

  const byCode = countryLookup(countries);
  const countryNames: LiveCountry[] = [...countryCounts.entries()]
    .map(([code, channelCount]) => {
      const meta = byCode.get(code);
      return {
        code,
        name: meta?.name || code,
        flag: meta?.flag || '',
        channelCount,
      };
    })
    .sort((a, b) => b.channelCount - a.channelCount);

  return { channels, categories, countries: countryNames, fetchedAt, fromCache };
};

/** Resolve categories and drop the ones with no genre, keeping order stable. */
const decorate = (channels: IptvChannel[]): LiveChannel[] =>
  sortChannels(channels).map((channel) => ({
    ...channel,
    categories: categoriesForGroups(channel.groups),
  }));

let inFlight: Promise<LiveCatalog> | null = null;
let memo: LiveCatalog | null = null;

/**
 * Load the catalogue.
 *
 * Concurrent callers share one load — the tab, the search box and the country
 * list all ask on mount, and three parallel downloads of a 2.5 MB playlist
 * would be wasteful and could race on the cache file.
 */
export const loadLiveCatalog = async (options: { force?: boolean } = {}): Promise<LiveCatalog> => {
  if (!options.force && memo) return memo;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const cachedText = options.force ? null : await readCachedPlaylist();

    if (cachedText) {
      const countries = await fetchCountries();
      const catalog = buildCatalog(decorate(parseM3U(cachedText)), countries, Date.now(), true);
      memo = catalog;
      return catalog;
    }

    const response = await withTimeout(PLAYLIST_URL, NETWORK_TIMEOUT_MS);
    if (!response.ok) {
      throw new Error(`Live TV playlist request failed (HTTP ${response.status})`);
    }
    const text = await response.text();
    if (!text.includes('#EXTINF')) {
      throw new Error('Live TV playlist was empty or not a playlist');
    }

    const [countries] = await Promise.all([fetchCountries(), writeCachedPlaylist(text)]);
    const catalog = buildCatalog(decorate(parseM3U(text)), countries, Date.now(), false);
    memo = catalog;
    return catalog;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
};

/** The last loaded catalogue without touching the network, if there is one. */
export const peekLiveCatalog = (): LiveCatalog | null => memo;

export const channelsInCategory = (catalog: LiveCatalog, categoryId: string): LiveChannel[] =>
  catalog.channels.filter((channel) => channel.categories.includes(categoryId));

export const channelsInCountry = (catalog: LiveCatalog, countryCode: string): LiveChannel[] => {
  const code = countryCode.toUpperCase();
  return catalog.channels.filter((channel) => channel.countryCode?.toUpperCase() === code);
};

export const findChannel = (catalog: LiveCatalog, id: string): LiveChannel | undefined =>
  catalog.channels.find((channel) => channel.id === id);

/**
 * Warm a channel's stream so tapping it starts playback instead of buffering.
 *
 * A live HLS stream begins with a small manifest at the same host as its
 * segments, so fetching that manifest resolves DNS, completes the TLS handshake
 * and gets the CDN to serve the first segment from a warm path — the work that
 * otherwise happens in front of the viewer on tap.
 *
 * Geo-blocked channels are skipped: the request is known to fail, so it would
 * spend the viewer's data to confirm it. Failures are swallowed for the same
 * reason — this is an optimisation, and must never surface as an error.
 */
export const preloadChannel = async (channel: LiveChannel): Promise<boolean> => {
  if (channel.isGeoBlocked) return false;
  if (!/^https?:\/\//i.test(channel.url)) return false;
  try {
    const response = await withTimeout(channel.url, PRELOAD_TIMEOUT_MS);
    // Read a little so the body is actually transferred, then release it.
    await response.text();
    return response.ok;
  } catch {
    return false;
  }
};

/** How many channels to warm at once. Enough to help, few enough to not flood. */
const PRELOAD_CONCURRENCY = 4;

/**
 * Warm the streams for a set of channels.
 *
 * Called with the channels currently on screen as the grid scrolls. The
 * in-flight set is keyed by channel id so a channel is never fetched twice while
 * its first warm-up is still running.
 */
const warming = new Set<string>();

export const preloadChannels = async (channels: LiveChannel[]): Promise<void> => {
  const queue = channels.filter((channel) => !channel.isGeoBlocked && !warming.has(channel.id));
  if (queue.length === 0) return;

  for (let i = 0; i < queue.length; i += PRELOAD_CONCURRENCY) {
    const batch = queue.slice(i, i + PRELOAD_CONCURRENCY);
    for (const channel of batch) warming.add(channel.id);
    await Promise.all(
      batch.map((channel) =>
        preloadChannel(channel).finally(() => warming.delete(channel.id))
      )
    );
  }
};
