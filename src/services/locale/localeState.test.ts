/**
 * Guards the locale plumbing.
 *
 * The bug this exists to prevent is subtle: the metadata layer used to hardcode
 * US region and providers on every request, so the catalogue was silently
 * American regardless of where the viewer was. These assert that the values the
 * metadata layer reads actually move, and that the primed default keeps the old
 * behaviour until detection lands.
 */
import {
  getRegion,
  getLanguage,
  getProviderFilter,
  getLocaleSnapshot,
  setLocaleSnapshot,
  __resetLocaleSnapshot,
} from './localeState';

beforeEach(() => {
  __resetLocaleSnapshot();
});

describe('primed defaults', () => {
  it('reproduces the old hardcoded US behaviour before detection resolves', () => {
    // A fetch that races detection must not change behaviour versus before.
    expect(getRegion()).toBe('US');
    expect(getLanguage()).toBe('en');
    expect(getProviderFilter()).toBe('8|9|15|337|1899');
    expect(getLocaleSnapshot().detected).toBe(false);
  });
});

describe('setLocaleSnapshot', () => {
  it('moves the region and language the metadata layer reads', () => {
    setLocaleSnapshot({ region: 'FR', language: 'fr' });
    expect(getRegion()).toBe('FR');
    expect(getLanguage()).toBe('fr');
    expect(getLocaleSnapshot().detected).toBe(true);
  });

  it('leaves untouched fields alone when only the language changes', () => {
    // This is the Settings override path: the user picks a language and the
    // detected region must survive it.
    setLocaleSnapshot({ region: 'FR', language: 'fr' });
    setLocaleSnapshot({ language: 'de' });
    expect(getRegion()).toBe('FR');
    expect(getLanguage()).toBe('de');
  });
});
