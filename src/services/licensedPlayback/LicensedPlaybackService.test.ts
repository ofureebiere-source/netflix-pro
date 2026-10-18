// Verifies the Net-web client's parsing against the shape the live service
// actually returns. Uses the real response body captured from
// /v1/stream?tmdbId=550&mediaType=movie, so a drift in the backend envelope
// fails here rather than silently producing an unplayable source in the app.

import {
  getPlaybackSource,
  getPlaybackSources,
  getDownloadSource,
  getSubtitles,
  checkBackendHealth,
  NoSourceAvailableError,
} from './LicensedPlaybackService';

// Captured verbatim from the deployed service (trimmed to 2 sources).
const REAL_STREAM_BODY = {
  status: 'ok',
  info: {
    tmdbId: '550',
    mediaType: 'movie',
    season: null,
    episode: null,
    title: null,
    year: null,
    provider_set: 'core',
  },
  sources: [
    {
      name: 'frameXTV · bowler · Bowler XVIII (Citadel)',
      data: {
        stream: 'https://img1.hscow.com/hls/78164859/720/index_287.m3u8?sig=x',
        type: 'hls',
        quality: '720p | English',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0',
        },
        size: 0,
        subtitles: [
          {
            url: 'https://img1.fhxod.com/subtitle/78164859/English.vtt',
            label: 'English - Citadel',
            lang: 'English',
          },
        ],
      },
    },
    {
      name: 'frameXTV · titan · Titan VII - Direct MP4',
      data: {
        stream: 'https://xstreamx.films365.org/movie/286f819d.mp4',
        type: 'MP4',
        quality: '480p',
        headers: {},
        size: 0,
        subtitles: [],
      },
    },
  ],
};

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const calls: string[] = [];
  (global as any).fetch = async (url: string) => {
    calls.push(url);
    return {
      ok,
      status,
      json: async () => body,
    } as unknown as Response;
  };
  return calls;
}

describe('LicensedPlaybackService — Net-web contract', () => {
  const originalFetch = (global as any).fetch;
  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  it('requests /v1/stream with tmdbId and mediaType', async () => {
    const calls = mockFetchOnce(REAL_STREAM_BODY);
    await getPlaybackSource({ tmdbId: 550, mediaType: 'movie' });
    expect(calls[0]).toContain('/v1/stream?');
    expect(calls[0]).toContain('tmdbId=550');
    expect(calls[0]).toContain('mediaType=movie');
  });

  it('flattens the {name,data} envelope into a playable source', async () => {
    mockFetchOnce(REAL_STREAM_BODY);
    const source = await getPlaybackSource({ tmdbId: 550, mediaType: 'movie' });
    expect(source.url).toContain('index_287.m3u8');
    expect(source.type).toBe('hls');
    expect(source.quality).toBe('720p | English');
    expect(source.name).toContain('frameXTV');
  });

  it('carries the provider headers through — playback depends on them', async () => {
    mockFetchOnce(REAL_STREAM_BODY);
    const source = await getPlaybackSource({ tmdbId: 550, mediaType: 'movie' });
    expect(source.headers).toBeDefined();
    expect(source.headers!['User-Agent']).toContain('Mozilla/5.0');
  });

  it('maps the backend subtitle tracks', async () => {
    mockFetchOnce(REAL_STREAM_BODY);
    const source = await getPlaybackSource({ tmdbId: 550, mediaType: 'movie' });
    expect(source.subtitles).toHaveLength(1);
    expect(source.subtitles![0].lang).toBe('English');
  });

  it('normalises uppercase and extension-style stream types', async () => {
    mockFetchOnce(REAL_STREAM_BODY);
    const all = await getPlaybackSources({ tmdbId: 550, mediaType: 'movie' });
    expect(all[0].type).toBe('hls');   // from "hls"
    expect(all[1].type).toBe('mp4');   // from "MP4"
  });

  it('treats empty headers as undefined rather than an empty object', async () => {
    mockFetchOnce(REAL_STREAM_BODY);
    const all = await getPlaybackSources({ tmdbId: 550, mediaType: 'movie' });
    expect(all[1].headers).toBeUndefined();
  });

  it('returns every source so a quality picker can offer them', async () => {
    mockFetchOnce(REAL_STREAM_BODY);
    const all = await getPlaybackSources({ tmdbId: 550, mediaType: 'movie' });
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.quality)).toEqual(['720p | English', '480p']);
  });

  it('sends season and episode for tv only', async () => {
    const calls = mockFetchOnce(REAL_STREAM_BODY);
    await getPlaybackSource({ tmdbId: 1399, mediaType: 'tv', season: 1, episode: 2 });
    expect(calls[0]).toContain('season=1');
    expect(calls[0]).toContain('episode=2');

    const calls2 = mockFetchOnce(REAL_STREAM_BODY);
    await getPlaybackSource({ tmdbId: 550, mediaType: 'movie', season: 1 });
    expect(calls2[0]).not.toContain('season');
  });

  it('raises NoSourceAvailableError when no provider answered', async () => {
    mockFetchOnce({ status: 'ok', info: { provider_set: 'core' }, sources: [] });
    await expect(
      getPlaybackSource({ tmdbId: 550, mediaType: 'movie' })
    ).rejects.toBeInstanceOf(NoSourceAvailableError);
  });

  it('names the active provider set when nothing is available', async () => {
    mockFetchOnce({ status: 'ok', info: { provider_set: 'core' }, sources: [] });
    await expect(
      getPlaybackSource({ tmdbId: 550, mediaType: 'movie' })
    ).rejects.toThrow(/core/);
  });

  it('skips unusable entries instead of returning a url-less source', async () => {
    mockFetchOnce({
      status: 'ok',
      info: {},
      sources: [
        { name: 'broken', data: { type: 'hls' } },
        { name: 'good', data: { stream: 'https://ok/x.m3u8', type: 'hls' } },
      ],
    });
    const source = await getPlaybackSource({ tmdbId: 550, mediaType: 'movie' });
    expect(source.url).toBe('https://ok/x.m3u8');
  });

  it('reuses the resolved source for downloads, headers included', async () => {
    mockFetchOnce(REAL_STREAM_BODY);
    const dl = await getDownloadSource({ tmdbId: 550, mediaType: 'movie' });
    expect(dl.url).toContain('index_287.m3u8');
    expect(dl.headers!['User-Agent']).toContain('Mozilla/5.0');
  });

  it('does not retry a real HTTP error (only cold-start aborts)', async () => {
    const calls = mockFetchOnce({ detail: 'nope' }, false, 503);
    await expect(
      getPlaybackSource({ tmdbId: 550, mediaType: 'movie' })
    ).rejects.toThrow(/503/);
    expect(calls).toHaveLength(1);
  });

  it('parses subtitle tracks and passes the languages filter', async () => {
    const calls = mockFetchOnce({
      status: 'ok',
      tracks: [{ url: 'https://s/en.vtt', label: 'English', lang: 'en' }],
      notes: [],
    });
    const res = await getSubtitles({ tmdbId: 550, mediaType: 'movie', languages: 'en' });
    expect(res.tracks).toHaveLength(1);
    expect(calls[0]).toContain('languages=en');
  });

  it('reports an empty subtitle list as a normal answer', async () => {
    mockFetchOnce({
      status: 'no_subtitles',
      tracks: [],
      notes: ['NETWEB_OPENSUBTITLES_KEY not set'],
    });
    const res = await getSubtitles({ tmdbId: 550, mediaType: 'movie' });
    expect(res.status).toBe('no_subtitles');
    expect(res.tracks).toEqual([]);
  });

  it('returns null from the health probe instead of throwing when down', async () => {
    (global as any).fetch = async () => { throw new Error('network down'); };
    await expect(checkBackendHealth()).resolves.toBeNull();
  });

  it('surfaces the provider set and active providers from /health', async () => {
    mockFetchOnce({
      status: 'ok',
      provider_set: 'core',
      active_providers: 8,
      skipped_providers: 0,
      providers: [{ id: 'framextv', label: 'frameXTV', by_tmdb_id: true }],
    });
    const health = await checkBackendHealth();
    expect(health!.provider_set).toBe('core');
    expect(health!.active_providers).toBe(8);
  });
});
