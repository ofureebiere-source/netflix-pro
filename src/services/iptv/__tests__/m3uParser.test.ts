/**
 * Guards the M3U parsing.
 *
 * The public catalogue is community-contributed, so the cases that matter are
 * the awkward ones: quoted attributes containing commas, quality markers baked
 * into the name, geo-blocked suffixes, and the header directives that decide
 * whether a channel plays at all. Each is a real shape found in the iptv-org
 * playlists, not a hypothetical.
 */
import {
  cleanChannelName,
  matchesQuery,
  parseM3U,
  sortChannels,
  splitExtInf,
} from '../m3uParser';

describe('splitExtInf', () => {
  it('reads attributes and the name from a plain line', () => {
    const { attrs, name } = splitExtInf(
      '#EXTINF:-1 tvg-id="CNN.us@SD" tvg-logo="https://x/y.png" group-title="News",CNN'
    );
    expect(attrs['tvg-id']).toBe('CNN.us@SD');
    expect(attrs['tvg-logo']).toBe('https://x/y.png');
    expect(attrs['group-title']).toBe('News');
    expect(name).toBe('CNN');
  });

  it('keeps a comma inside a quoted attribute out of the name', () => {
    // Splitting on the first comma would yield a name of `International`.
    const { name, attrs } = splitExtInf(
      '#EXTINF:-1 tvg-id="A.us@SD" group-title="News,International",Channel Name'
    );
    expect(attrs['group-title']).toBe('News,International');
    expect(name).toBe('Channel Name');
  });

  it('keeps a comma that is part of the name', () => {
    const { name } = splitExtInf('#EXTINF:-1 tvg-id="A.us@SD",News, Weather and Sport');
    expect(name).toBe('News, Weather and Sport');
  });

  it('survives a line with no attributes', () => {
    expect(splitExtInf('#EXTINF:-1,Bare Channel').name).toBe('Bare Channel');
  });
});

describe('cleanChannelName', () => {
  it('lifts the resolution out of the name', () => {
    expect(cleanChannelName('ABN Afghanistan (540p)')).toEqual({
      name: 'ABN Afghanistan',
      quality: '540p',
      isGeoBlocked: false,
      isPartTime: false,
    });
  });

  it('normalises word-style quality markers', () => {
    expect(cleanChannelName('Big Screen (4k)').quality).toBe('4K');
    expect(cleanChannelName('Big Screen (hd)').quality).toBe('HD');
  });

  it('flags a geo-blocked channel and strips the marker', () => {
    const result = cleanChannelName('3Cat Exclusiu 1 (1080p) [Geo-blocked]');
    expect(result.name).toBe('3Cat Exclusiu 1');
    expect(result.quality).toBe('1080p');
    expect(result.isGeoBlocked).toBe(true);
  });

  it('flags a part-time channel', () => {
    const result = cleanChannelName('Some Feed [Not 24/7]');
    expect(result.name).toBe('Some Feed');
    expect(result.isPartTime).toBe(true);
  });

  it('leaves a name with no markers untouched', () => {
    const result = cleanChannelName('Plain Channel');
    expect(result.name).toBe('Plain Channel');
    expect(result.quality).toBeUndefined();
  });

  it('does not strip a bracketed word that is part of the title', () => {
    // Only the known status markers are removed; a bracket elsewhere stays.
    expect(cleanChannelName('Music [Hits] TV').name).toBe('Music [Hits] TV');
  });
});

describe('parseM3U', () => {
  const playlist = [
    '#EXTM3U',
    '#EXTINF:-1 tvg-id="CNN.us@SD" tvg-logo="https://i.imgur.com/x.png" group-title="News",CNN (1080p)',
    'https://example.com/cnn.m3u8',
    '#EXTINF:-1 tvg-id="BBC.uk@SD" group-title="News;Public",BBC One [Geo-blocked]',
    'https://example.com/bbc.m3u8',
    '#EXTINF:-1 tvg-id="Jazz.us@SD" group-title="Music",Jazz FM',
    '#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Test)',
    '#EXTVLCOPT:http-referrer=https://jazz.example/',
    'https://example.com/jazz.m3u8',
  ].join('\n');

  it('parses one channel per entry', () => {
    expect(parseM3U(playlist)).toHaveLength(3);
  });

  it('reads the url from the line after the attributes', () => {
    expect(parseM3U(playlist)[0].url).toBe('https://example.com/cnn.m3u8');
  });

  it('derives the country from tvg-id', () => {
    expect(parseM3U(playlist)[0].countryCode).toBe('us');
    expect(parseM3U(playlist)[1].countryCode).toBe('uk');
  });

  it('splits a multi-value group-title', () => {
    expect(parseM3U(playlist)[1].groups).toEqual(['News', 'Public']);
  });

  it('collects the headers that decide whether the stream plays', () => {
    // Without these the channel resolves and then 403s on the first segment.
    expect(parseM3U(playlist)[2].headers).toEqual({
      'User-Agent': 'Mozilla/5.0 (Test)',
      'Referer': 'https://jazz.example/',
    });
  });

  it('attaches #EXTVLCOPT headers to the entry above them, not the next one', () => {
    const parsed = parseM3U(playlist);
    expect(parsed[0].headers).toBeUndefined();
    expect(parsed[1].headers).toBeUndefined();
    expect(parsed[2].headers).toBeDefined();
  });

  it('reads headers given as EXTINF attributes', () => {
    const parsed = parseM3U(
      '#EXTM3U\n#EXTINF:-1 tvg-id="A.us@SD" http-user-agent="Agent/1" http-referrer="https://r/",A\nhttps://a/b.m3u8'
    );
    expect(parsed[0].headers).toEqual({ 'User-Agent': 'Agent/1', 'Referer': 'https://r/' });
  });

  it('discards a logo that is not a URL', () => {
    // The catalogue contains placeholder text in this field.
    const parsed = parseM3U('#EXTM3U\n#EXTINF:-1 tvg-id="A.us@SD" tvg-logo="",A\nhttps://a/b.m3u8');
    expect(parsed[0].logo).toBeUndefined();
  });

  it('gives two entries with no tvg-id distinct ids', () => {
    // Keying favourites on an empty string would collapse them into one.
    const parsed = parseM3U(
      '#EXTM3U\n#EXTINF:-1,A\nhttps://a/1.m3u8\n#EXTINF:-1,B\nhttps://a/2.m3u8'
    );
    expect(parsed[0].id).not.toBe(parsed[1].id);
  });

  it('gives the same channel the same id across parses', () => {
    const first = parseM3U('#EXTM3U\n#EXTINF:-1,A\nhttps://a/1.m3u8')[0].id;
    const second = parseM3U('#EXTM3U\n#EXTINF:-1,A\nhttps://a/1.m3u8')[0].id;
    expect(first).toBe(second);
  });

  it('skips a url with no preceding EXTINF', () => {
    expect(parseM3U('#EXTM3U\nhttps://orphan.m3u8')).toHaveLength(0);
  });

  it('skips an EXTINF with no following url', () => {
    expect(parseM3U('#EXTM3U\n#EXTINF:-1 tvg-id="A.us@SD",Dangling')).toHaveLength(0);
  });

  it('handles CRLF line endings', () => {
    expect(
      parseM3U('#EXTM3U\r\n#EXTINF:-1 tvg-id="A.us@SD",A\r\nhttps://a/b.m3u8\r\n')
    ).toHaveLength(1);
  });

  it('returns nothing for empty input', () => {
    expect(parseM3U('')).toEqual([]);
  });
});

describe('matchesQuery', () => {
  const channel = parseM3U(
    '#EXTM3U\n#EXTINF:-1 tvg-id="SkySports.uk@SD" group-title="Sports",Sky Sports (1080p)\nhttps://a/b.m3u8'
  )[0];

  it('matches on the name', () => {
    expect(matchesQuery(channel, 'sky')).toBe(true);
  });

  it('matches on the group, so a category search works', () => {
    expect(matchesQuery(channel, 'sports')).toBe(true);
  });

  it('matches on the country code', () => {
    expect(matchesQuery(channel, 'uk')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesQuery(channel, 'SKY')).toBe(true);
  });

  it('rejects a non-match', () => {
    expect(matchesQuery(channel, 'cooking')).toBe(false);
  });

  it('matches everything for an empty query', () => {
    expect(matchesQuery(channel, '   ')).toBe(true);
  });
});

describe('sortChannels', () => {
  const build = (name: string, quality: string, blocked = false, partTime = false) => ({
    id: name,
    name,
    url: `https://a/${name}.m3u8`,
    groups: [] as string[],
    quality,
    isGeoBlocked: blocked,
    isPartTime: partTime,
  });

  it('puts playable channels above geo-blocked ones', () => {
    const sorted = sortChannels([build('Blocked', '1080p', true), build('Fine', '480p')]);
    expect(sorted.map((c) => c.name)).toEqual(['Fine', 'Blocked']);
  });

  it('puts continuous channels above part-time ones', () => {
    const sorted = sortChannels([build('Part', '1080p', false, true), build('Full', '480p')]);
    expect(sorted.map((c) => c.name)).toEqual(['Full', 'Part']);
  });

  it('orders by resolution, highest first', () => {
    const sorted = sortChannels([build('Low', '480p'), build('High', '1080p')]);
    expect(sorted.map((c) => c.name)).toEqual(['High', 'Low']);
  });

  it('treats 4K as the highest resolution', () => {
    const sorted = sortChannels([build('HD', '1080p'), build('Ultra', '4K')]);
    expect(sorted.map((c) => c.name)).toEqual(['Ultra', 'HD']);
  });

  it('falls back to the name when resolutions match', () => {
    const sorted = sortChannels([build('Zeta', '1080p'), build('Alpha', '1080p')]);
    expect(sorted.map((c) => c.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('does not mutate the input', () => {
    const input = [build('B', '480p'), build('A', '1080p')];
    sortChannels(input);
    expect(input.map((c) => c.name)).toEqual(['B', 'A']);
  });
});
