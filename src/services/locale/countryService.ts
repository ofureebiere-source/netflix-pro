/**
 * Country and language detection, for locale-aware content.
 *
 * Every content fetch used to be language-agnostic, so a viewer in France got
 * the same English catalogue as a viewer in the US (TODO section 8). The
 * country comes from `ipapi.co`, which needs no key and no permission — it
 * reads the caller's IP server-side.
 *
 * Two rules govern this module:
 *
 *  - Detect once per install, then serve from cache. The free tier is
 *    rate-limited per IP, and a cold start that waits on a third party is a
 *    cold start that can hang. The cache is the normal path; the network is
 *    the exception.
 *  - Never block the UI. Detection resolves to a usable value in every
 *    failure mode (offline, rate-limited, blocked, malformed), falling back to
 *    the device locale and then to a constant.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

const CACHE_KEY = 'netflixpro.locale.country';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6000;
const ENDPOINT = 'https://ipapi.co/json/';

/** Used only when detection and the device locale both fail. */
export const FALLBACK_COUNTRY = 'US';

export interface CountryInfo {
  /** ISO 3166-1 alpha-2, upper case. */
  countryCode: string;
  countryName: string;
  /** ISO 639-1 codes the country speaks, most-spoken first. */
  languages: string[];
  /** Where the value came from, for the debug screen. */
  source: 'cache' | 'network' | 'device' | 'fallback';
}

interface CachedCountry extends CountryInfo {
  fetchedAt: number;
}

/**
 * The device's own locale, used when the IP lookup cannot answer.
 *
 * This is the better fallback: it needs no network, and a viewer whose device
 * is set to French is more likely to want French than a hardcoded US default.
 */
const fromDeviceLocale = (): CountryInfo => {
  try {
    const locales = Localization.getLocales();
    const primary = locales?.[0];
    const countryCode = primary?.regionCode?.toUpperCase();
    const language = primary?.languageCode?.toLowerCase();
    if (countryCode || language) {
      return {
        countryCode: countryCode || FALLBACK_COUNTRY,
        countryName: countryCode || '',
        languages: language ? [language] : [],
        source: 'device',
      };
    }
  } catch {
    // Fall through to the constant.
  }
  return { countryCode: FALLBACK_COUNTRY, countryName: '', languages: [], source: 'fallback' };
};

const readCache = async (): Promise<CountryInfo | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCountry;
    if (!parsed?.countryCode) return null;
    if (Date.now() - (parsed.fetchedAt ?? 0) > CACHE_TTL_MS) return null;
    return { ...parsed, source: 'cache' };
  } catch {
    return null;
  }
};

const writeCache = async (info: CountryInfo): Promise<void> => {
  try {
    const payload: CachedCountry = { ...info, fetchedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // A cache that cannot be written costs a lookup next launch, nothing more.
  }
};

const fetchCountry = async (): Promise<CountryInfo | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      country_code?: string;
      country_name?: string;
      languages?: string;
    };
    const code = data?.country_code?.toUpperCase();
    if (!code) return null;
    return {
      countryCode: code,
      countryName: data?.country_name ?? '',
      languages: (data?.languages ?? '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
      source: 'network',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

let inFlight: Promise<CountryInfo> | null = null;
let resolved: CountryInfo | null = null;

/**
 * Resolve this device's country, from cache when possible.
 *
 * Concurrent callers share one lookup rather than racing several. Never
 * rejects — callers always get a usable value.
 */
export const getCountryInfo = async (): Promise<CountryInfo> => {
  if (resolved) return resolved;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const cached = await readCache();
    if (cached) {
      resolved = cached;
      return cached;
    }
    const fetched = await fetchCountry();
    if (fetched) {
      await writeCache(fetched);
      resolved = fetched;
      return fetched;
    }
    // Offline or rate-limited: the device locale still beats a constant, and
    // is not cached, so the next launch can try the network again.
    resolved = fromDeviceLocale();
    return resolved;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
};

/** The content language to prefer, most specific first. */
export const getPreferredLanguage = async (): Promise<string> => {
  const info = await getCountryInfo();
  if (info.languages.length > 0) return info.languages[0];
  return fromDeviceLocale().languages[0] ?? '';
};

/** Drop the cached country, so the next read re-detects. */
export const clearCountryCache = async (): Promise<void> => {
  resolved = null;
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing cached.
  }
};

export const __testing = { fromDeviceLocale, readCache, writeCache, fetchCountry };
