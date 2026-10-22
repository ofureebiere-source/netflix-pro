/**
 * Guards country detection's failure paths.
 *
 * Detection is a third-party call on the startup path, so the behaviour that
 * matters is what happens when it does not answer: the app must still resolve a
 * usable locale rather than hang or render an empty catalogue.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { __testing } from './countryService';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('fetchCountry', () => {
  it('parses a well-formed ipapi.co response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ country_code: 'fr', country_name: 'France', languages: 'fr,en' }),
    }) as unknown as typeof fetch;

    const info = await __testing.fetchCountry();
    expect(info).toEqual({
      countryCode: 'FR',
      countryName: 'France',
      languages: ['fr', 'en'],
      source: 'network',
    });
  });

  it('returns null rather than throwing when the request fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    expect(await __testing.fetchCountry()).toBeNull();
  });

  it('returns null on a rate-limit response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    expect(await __testing.fetchCountry()).toBeNull();
  });

  it('returns null when the payload carries no country code', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: true, reason: 'RateLimited' }),
    }) as unknown as typeof fetch;
    expect(await __testing.fetchCountry()).toBeNull();
  });
});

describe('cache', () => {
  it('round-trips a detected country', async () => {
    await __testing.writeCache({
      countryCode: 'JP', countryName: 'Japan', languages: ['ja'], source: 'network',
    });
    const cached = await __testing.readCache();
    expect(cached?.countryCode).toBe('JP');
    expect(cached?.source).toBe('cache');
  });

  it('ignores an expired entry so the next launch re-detects', async () => {
    const stale = { countryCode: 'JP', countryName: 'Japan', languages: ['ja'], fetchedAt: 0 };
    await AsyncStorage.setItem('netflixpro.locale.country', JSON.stringify(stale));
    expect(await __testing.readCache()).toBeNull();
  });
});

describe('device locale fallback', () => {
  it('always resolves to something usable, never throwing', () => {
    const info = __testing.fromDeviceLocale();
    expect(info.countryCode).toMatch(/^[A-Z]{2}$/);
    expect(['device', 'fallback']).toContain(info.source);
  });
});
