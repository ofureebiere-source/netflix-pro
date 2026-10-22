/**
 * Catalogue loading, cache behaviour and the derivations the screen depends on.
 *
 * The file system and `fetch` are both stubbed: the real ones are native and
 * networked. Everything else — parsing, de-duplication, category and country
 * aggregation, TTL handling, concurrency — is the production code path.
 */

const mockFiles = new Map<string, string>();
const mockDirs = new Set<string>();

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(async (path: string) => ({ exists: mockDirs.has(path) || mockFiles.has(path) })),
  makeDirectoryAsync: jest.fn(async (path: string) => {
    mockDirs.add(path);
  }),
  readAsStringAsync: jest.fn(async (path: string) => {
    if (!mockFiles.has(path)) throw new Error(`ENOENT: ${path}`);
    return mockFiles.get(path) as string;
  }),
  writeAsStringAsync: jest.fn(async (path: string, value: string) => {
    mockFiles.set(path, value);
  }),
  deleteAsync: jest.fn(async (path: string) => {
    // Real deleteAsync removes a directory recursively, so drop its contents too.
    for (const key of [...mockFiles.keys()]) {
      if (key === path || key.startsWith(path)) mockFiles.delete(key);
    }
    for (const dir of [...mockDirs]) {
      if (dir === path || dir.startsWith(path)) mockDirs.delete(dir);
    }
  }),
}));

const PLAYLIST = [
  '#EXTM3U',
  '#EXTINF:-1 tvg-id="CNN.us@SD" tvg-logo="https://logo.test/cnn.png" group-title="News",CNN (720p)',
  'https://cdn.test/cnn.m3u8',
  '#EXTINF:-1 tvg-id="ESPN.us@HD" tvg-logo="https://logo.test/espn.png" group-title="Sports",ESPN [Geo-blocked]',
  'https://cdn.test/espn.m3u8',
  '#EXTINF:-1 tvg-id="BBC.uk@SD" tvg-logo="https://logo.test/bbc.png" group-title="News;United Kingdom",BBC News',
  'https://cdn.test/bbc.m3u8',
  '#EXTINF:-1 tvg-id="Cartoon.us@SD" group-title="United States",Cartoon Network',
  'https://cdn.test/cartoon.m3u8',
  '#EXTINF:-1 tvg-id="Agent.us@SD" http-user-agent="Agent/1" http-referrer="https://r/" group-title="Movies",Agent Movie (1080p)',
  'https://cdn.test/agent.m3u8',
  // Exact repeat of the CNN row, as the public index contains.
  '#EXTINF:-1 tvg-id="CNN.us@SD" tvg-logo="https://logo.test/cnn.png" group-title="News",CNN (720p)',
  'https://cdn.test/cnn.m3u8',
  '',
].join('\n');

const COUNTRIES = [
  { name: 'United States', code: 'US', flag: '🇺🇸' },
  { name: 'United Kingdom', code: 'UK', flag: '🇬🇧' },
];

const PLAYLIST_CACHE = 'file:///docs/livetv/index.m3u';
const META_CACHE = 'file:///docs/livetv/meta.json';

let fetchMock: jest.Mock;

const loadModule = () => {
  let mod: typeof import('../iptvCatalog');
  jest.isolateModules(() => {
    mod = require('../iptvCatalog');
  });
  return mod!;
};

beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
  fetchMock = jest.fn(async (url: string) => {
    if (url.includes('countries.json')) {
      return { ok: true, json: async () => COUNTRIES };
    }
    return { ok: true, text: async () => PLAYLIST };
  });
  global.fetch = fetchMock as any;
});

describe('loadLiveCatalog', () => {
  it('parses the playlist from the network on a cold start', async () => {
    const { loadLiveCatalog } = loadModule();
    const catalog = await loadLiveCatalog();

    expect(catalog.fromCache).toBe(false);
    expect(catalog.channels).toHaveLength(5);
    expect(catalog.channels.map((c) => c.name)).toContain('CNN');
  });

  it('de-duplicates repeated rows', async () => {
    const { loadLiveCatalog } = loadModule();
    const catalog = await loadLiveCatalog();
    // CNN appears twice in the fixture but must be listed once.
    expect(catalog.channels.filter((c) => c.name === 'CNN')).toHaveLength(1);
  });

  it('writes the playlist and a timestamp to disk', async () => {
    const { loadLiveCatalog } = loadModule();
    await loadLiveCatalog();

    expect(mockFiles.get(PLAYLIST_CACHE)).toBe(PLAYLIST);
    expect(JSON.parse(mockFiles.get(META_CACHE) as string).fetchedAt).toBeGreaterThan(0);
  });

  it('serves a fresh cache without touching the network for the playlist', async () => {
    mockFiles.set(PLAYLIST_CACHE, PLAYLIST);
    mockFiles.set(META_CACHE, JSON.stringify({ fetchedAt: Date.now() }));

    const { loadLiveCatalog } = loadModule();
    const catalog = await loadLiveCatalog();

    expect(catalog.fromCache).toBe(true);
    expect(catalog.channels).toHaveLength(5);
    const playlistCalls = fetchMock.mock.calls.filter(([url]) => url.includes('index.m3u'));
    expect(playlistCalls).toHaveLength(0);
  });

  it('re-fetches when the cache is older than the TTL', async () => {
    const { CATALOG_TTL_MS } = loadModule();
    mockFiles.set(PLAYLIST_CACHE, PLAYLIST);
    mockFiles.set(META_CACHE, JSON.stringify({ fetchedAt: Date.now() - CATALOG_TTL_MS - 1000 }));

    const { loadLiveCatalog } = loadModule();
    const catalog = await loadLiveCatalog();

    expect(catalog.fromCache).toBe(false);
  });

  it('ignores a cache whose metadata is unreadable', async () => {
    mockFiles.set(PLAYLIST_CACHE, PLAYLIST);
    mockFiles.set(META_CACHE, 'not json');

    const { loadLiveCatalog } = loadModule();
    const catalog = await loadLiveCatalog();

    expect(catalog.fromCache).toBe(false);
  });

  it('bypasses the cache when forced', async () => {
    mockFiles.set(PLAYLIST_CACHE, PLAYLIST);
    mockFiles.set(META_CACHE, JSON.stringify({ fetchedAt: Date.now() }));

    const { loadLiveCatalog } = loadModule();
    const catalog = await loadLiveCatalog({ force: true });

    expect(catalog.fromCache).toBe(false);
  });

  it('throws when the request fails', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 503 }));
    const { loadLiveCatalog } = loadModule();

    await expect(loadLiveCatalog()).rejects.toThrow('HTTP 503');
  });

  it('rejects a body that is not a playlist', async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      text: async () => '<html>maintenance</html>',
    }));
    const { loadLiveCatalog } = loadModule();

    await expect(loadLiveCatalog()).rejects.toThrow(/not a playlist/);
  });

  it('still loads when the country metadata is unavailable', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('countries.json')) throw new Error('offline');
      return { ok: true, text: async () => PLAYLIST };
    });

    const { loadLiveCatalog } = loadModule();
    const catalog = await loadLiveCatalog();

    // Falls back to the country code rather than dropping the channel.
    expect(catalog.countries.find((c) => c.code === 'US')?.name).toBe('US');
  });

  it('shares one load between concurrent callers', async () => {
    const { loadLiveCatalog } = loadModule();
    const [a, b, c] = await Promise.all([
      loadLiveCatalog(),
      loadLiveCatalog(),
      loadLiveCatalog(),
    ]);

    expect(a).toBe(b);
    expect(b).toBe(c);
    const playlistCalls = fetchMock.mock.calls.filter(([url]) => url.includes('index.m3u'));
    expect(playlistCalls).toHaveLength(1);
  });

  it('memoises after the first load', async () => {
    const { loadLiveCatalog } = loadModule();
    const first = await loadLiveCatalog();
    const second = await loadLiveCatalog();

    expect(second).toBe(first);
  });
});

describe('catalog derivations', () => {
  it('counts channels per category and drops the empty ones', async () => {
    const { loadLiveCatalog } = loadModule();
    const catalog = await loadLiveCatalog();

    const news = catalog.categories.find((c) => c.id === 'news');
    expect(news?.channelCount).toBe(2);

    // Nothing in the fixture is a weather channel, so it must not be offered.
    expect(catalog.categories.some((c) => c.id === 'weather')).toBe(false);
    expect(catalog.categories.every((c) => c.channelCount > 0)).toBe(true);
  });

  it('puts a channel with no genre into the catch-all', async () => {
    const { loadLiveCatalog } = loadModule();
    const catalog = await loadLiveCatalog();

    const cartoon = catalog.channels.find((c) => c.name === 'Cartoon Network');
    expect(cartoon?.categories).toEqual(['general']);
  });

  it('orders categories by population, most first', async () => {
    const { loadLiveCatalog } = loadModule();
    const catalog = await loadLiveCatalog();

    const counts = catalog.categories.map((c) => c.channelCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('attaches country names and flags', async () => {
    const { loadLiveCatalog } = loadModule();
    const catalog = await loadLiveCatalog();

    const us = catalog.countries.find((c) => c.code === 'US');
    expect(us).toMatchObject({ name: 'United States', flag: '🇺🇸' });
  });

  it('orders countries by population, most first', async () => {
    const { loadLiveCatalog } = loadModule();
    const catalog = await loadLiveCatalog();

    const counts = catalog.countries.map((c) => c.channelCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('filters channels by category', async () => {
    const { loadLiveCatalog, channelsInCategory } = loadModule();
    const catalog = await loadLiveCatalog();

    const names = channelsInCategory(catalog, 'news').map((c) => c.name).sort();
    expect(names).toEqual(['BBC News', 'CNN']);
  });

  it('filters channels by country', async () => {
    const { loadLiveCatalog, channelsInCountry } = loadModule();
    const catalog = await loadLiveCatalog();

    // GB is the country of the BBC row only.
    expect(channelsInCountry(catalog, 'UK').map((c) => c.name)).toEqual(['BBC News']);
  });

  it('matches a country code regardless of case', async () => {
    const { loadLiveCatalog, channelsInCountry } = loadModule();
    const catalog = await loadLiveCatalog();

    expect(channelsInCountry(catalog, 'uk')).toHaveLength(1);
  });

  it('finds a channel by id', async () => {
    const { loadLiveCatalog, findChannel } = loadModule();
    const catalog = await loadLiveCatalog();

    expect(findChannel(catalog, 'CNN.us@SD')?.name).toBe('CNN');
    expect(findChannel(catalog, 'missing')).toBeUndefined();
  });

  it('keeps the playlist headers on the channel', async () => {
    const { loadLiveCatalog, findChannel } = loadModule();
    const catalog = await loadLiveCatalog();

    expect(findChannel(catalog, 'Agent.us@SD')?.headers).toEqual({
      'User-Agent': 'Agent/1',
      'Referer': 'https://r/',
    });
  });

  it('flags a geo-blocked channel', async () => {
    const { loadLiveCatalog, findChannel } = loadModule();
    const catalog = await loadLiveCatalog();

    expect(findChannel(catalog, 'ESPN.us@HD')?.isGeoBlocked).toBe(true);
    expect(findChannel(catalog, 'CNN.us@SD')?.isGeoBlocked).toBe(false);
  });
});

describe('clearLiveCatalogCache', () => {
  it('removes the cached playlist so the next load re-fetches', async () => {
    const { loadLiveCatalog, clearLiveCatalogCache } = loadModule();
    await loadLiveCatalog();
    expect(mockFiles.has(PLAYLIST_CACHE)).toBe(true);

    await clearLiveCatalogCache();

    expect(mockFiles.has(PLAYLIST_CACHE)).toBe(false);
    expect(mockFiles.has(META_CACHE)).toBe(false);
  });
});
