/**
 * The locale the content layer reads.
 *
 * `TMDBMetadata` needs a region and language on every request, but it is a
 * plain module that cannot use a React hook and must not import the store (the
 * store's slice imports the metadata layer, so that would be a cycle). A tiny
 * module-level holder breaks the cycle: something near the app root resolves
 * the locale once and publishes it here, and the metadata functions read the
 * current value synchronously.
 *
 * The values are deliberately primed with the US defaults the code used to
 * hardcode, so a fetch that happens before detection completes behaves exactly
 * as it did before this existed — then improves as soon as detection lands.
 */
import { getCountryInfo, FALLBACK_COUNTRY } from './countryService';

/** Streaming providers, by TMDB id, that count as "popular" in a region. */
const DEFAULT_PROVIDERS = '8|9|15|337|1899';

export interface LocaleSnapshot {
  region: string;
  language: string;
  /** True once detection has actually resolved, rather than the primed default. */
  detected: boolean;
}

let snapshot: LocaleSnapshot = {
  region: FALLBACK_COUNTRY,
  language: 'en',
  detected: false,
};

export const getLocaleSnapshot = (): LocaleSnapshot => snapshot;

/** The region to pass as `watch_region` / `region`. */
export const getRegion = (): string => snapshot.region;

/**
 * The language to pass as `language`. Empty string means "let TMDB default",
 * which is what the calls did before this existed.
 */
export const getLanguage = (): string => snapshot.language;

export const getProviderFilter = (): string => DEFAULT_PROVIDERS;

/**
 * Publish a resolved locale. Called once at startup by `useLocale`, and again
 * whenever the user overrides the language in Settings.
 */
export const setLocaleSnapshot = (next: Partial<LocaleSnapshot>): void => {
  snapshot = { ...snapshot, ...next, detected: true };
};

/**
 * Resolve the device's locale and publish it.
 *
 * Safe to call more than once; concurrent callers share the lookup inside
 * `countryService`. Returns the snapshot so a caller can react to it.
 */
export const resolveAndPublishLocale = async (): Promise<LocaleSnapshot> => {
  const info = await getCountryInfo();
  setLocaleSnapshot({
    region: info.countryCode,
    language: info.languages[0] ?? snapshot.language,
  });
  return snapshot;
};

/** Test seam: put the holder back to its primed default. */
export const __resetLocaleSnapshot = (): void => {
  snapshot = { region: FALLBACK_COUNTRY, language: 'en', detected: false };
};
