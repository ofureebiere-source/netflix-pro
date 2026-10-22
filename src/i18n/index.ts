// src/i18n/index.ts
/**
 * The translation runtime.
 *
 * A tiny implementation rather than a library: the app needs key lookup and a
 * fallback, not pluralisation rules or ICU formatting, and every dependency
 * here ships inside the bundle.
 *
 * Resolution order is explicit, and the last step is what makes it safe:
 * requested locale → English → the key itself. An untranslated string shows an
 * English word rather than a raw `settings.downloads`.
 */
import translations, { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, type Locale, type TranslationKey } from './translations';

export { LOCALES, LOCALE_NAMES, DEFAULT_LOCALE };
export type { Locale, TranslationKey };

/** Narrow an arbitrary string (a device locale, say) to a supported one. */
export const normalizeLocale = (value?: string | null): Locale => {
  if (!value) return DEFAULT_LOCALE;
  const base = value.toLowerCase().split(/[-_]/)[0];
  return (LOCALES as readonly string[]).includes(base) ? (base as Locale) : DEFAULT_LOCALE;
};

export const translate = (
  locale: Locale,
  key: TranslationKey,
  fallback?: string
): string => {
  const table = translations[locale];
  return table?.[key] ?? translations[DEFAULT_LOCALE][key] ?? fallback ?? key;
};

/** Bind a locale once, for callers that translate repeatedly. */
export const translatorFor = (locale: Locale) =>
  (key: TranslationKey, fallback?: string) => translate(locale, key, fallback);
