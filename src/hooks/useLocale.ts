// src/hooks/useLocale.ts
import { useEffect, useState } from 'react';
import { getCountryInfo, type CountryInfo } from '../services/locale/countryService';
import { resolveAndPublishLocale, setLocaleSnapshot } from '../services/locale/localeState';

/**
 * Resolve the device's locale once and keep the content layer in step.
 *
 * Mounted near the app root. Detection is fire-and-forget: the UI renders
 * immediately with the primed defaults and improves when the lookup lands,
 * because a home screen that waits on `ipapi.co` is a home screen that can
 * hang on a slow network.
 *
 * `languageOverride` lets Settings win over detection, which is the documented
 * rule — an explicit user choice always beats a guess.
 */
export const useLocale = (languageOverride?: string | null) => {
  const [country, setCountry] = useState<CountryInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const info = await getCountryInfo();
      if (cancelled) return;
      setCountry(info);
      await resolveAndPublishLocale();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (languageOverride) setLocaleSnapshot({ language: languageOverride });
  }, [languageOverride]);

  return { country };
};

export default useLocale;
