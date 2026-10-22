// src/hooks/useTranslation.ts
import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/zustand';
import { normalizeLocale, translate, type Locale, type TranslationKey } from '../i18n';
import { getLocaleSnapshot } from '../services/locale/localeState';

/**
 * Translate UI strings into the active language.
 *
 * Resolution is: an explicit choice in Settings wins; otherwise the locale the
 * app detected from the network or the device. The detected value is read from
 * the locale holder rather than a hook of its own, so this stays usable in the
 * many places that only need a `t` function.
 *
 * The language also feeds the content layer, so picking a language here changes
 * both the interface and the catalogue — which is the behaviour the Settings
 * description promises.
 */
export const useTranslation = () => {
  const appLanguage = useAppStore((state) => state.appLanguage);

  const locale: Locale = useMemo(() => {
    if (appLanguage) return normalizeLocale(appLanguage);
    return normalizeLocale(getLocaleSnapshot().language);
  }, [appLanguage]);

  const t = useCallback(
    (key: TranslationKey, fallback?: string) => translate(locale, key, fallback),
    [locale]
  );

  return { t, locale };
};

export default useTranslation;
