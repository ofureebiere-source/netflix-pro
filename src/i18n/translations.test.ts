/**
 * Guards the translation tables.
 *
 * The failure this catches is a locale that silently loses keys: TypeScript
 * enforces the full key set on the `Record<TranslationKey, string>` locales, but
 * the spread-based ones would quietly fall back to English. A user in Germany
 * seeing one English row among German ones is the symptom.
 */
import translations, { LOCALES, DEFAULT_LOCALE, LOCALE_NAMES } from './translations';
import { normalizeLocale, translate, translatorFor } from './index';

const englishKeys = Object.keys(translations.en).sort();

describe('translation tables', () => {
  it('has a name for every locale', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_NAMES[locale]).toBeTruthy();
    }
  });

  it('has a table for every declared locale', () => {
    for (const locale of LOCALES) {
      expect(translations[locale]).toBeDefined();
    }
  });

  it('covers every English key in every locale', () => {
    for (const locale of LOCALES) {
      const missing = englishKeys.filter((key) => !(key in translations[locale]));
      expect({ locale, missing }).toEqual({ locale, missing: [] });
    }
  });

  it('has no empty translations', () => {
    for (const locale of LOCALES) {
      const empty = Object.entries(translations[locale])
        .filter(([, value]) => !String(value).trim())
        .map(([key]) => key);
      expect({ locale, empty }).toEqual({ locale, empty: [] });
    }
  });
});

describe('normalizeLocale', () => {
  it('maps a regional tag to its base locale', () => {
    expect(normalizeLocale('fr-CA')).toBe('fr');
    expect(normalizeLocale('pt_BR')).toBe('pt');
  });

  it('falls back to English for an unsupported or absent locale', () => {
    expect(normalizeLocale('ja')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
  });
});

describe('translate', () => {
  it('returns the localized string', () => {
    expect(translate('fr', 'common.cancel')).toBe('Annuler');
  });

  it('falls back to English rather than leaking the key', () => {
    // A key present in English must never render as `settings.downloads`.
    const result = translate('fr', 'common.save');
    expect(result).not.toContain('.');
  });

  it('binds a locale for repeated lookups', () => {
    const t = translatorFor('de');
    expect(t('common.cancel')).toBe('Abbrechen');
  });
});
