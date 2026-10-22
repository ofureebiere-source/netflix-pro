/**
 * M3U playlist parser for the public iptv-org catalogue.
 *
 * Kept free of React Native and network imports so it can be unit-tested
 * directly. Everything the UI needs is derived here, once, rather than being
 * re-parsed per render — a country playlist is ~1,500 entries and the full
 * index is ~11,000, so parsing is the expensive part of loading Live TV.
 *
 * The format is deceptively simple. The parts that actually bite:
 *
 * - Attribute values are quoted and may contain commas, so the channel name
 *   cannot be found by splitting the line on `,`. It is whatever follows the
 *   final quote-delimited attribute.
 * - The stream URL is on the *next* line, but `#EXTVLCOPT` directives may sit
 *   between the two, and those carry the request headers some channels need.
 * - Quality is not a field. It is a `(1080p)`-style suffix on the name, and
 *   leaving it in the display name looks like a bug to the viewer.
 * - iptv-org marks geo-blocked and intermittent channels with `[...]` suffixes
 *   that must be stripped from the name but kept as flags, because a channel
 *   that will not play outside its country should say so before it is tapped.
 */

export interface IptvChannel {
  /**
   * Stable identity for favourites and recents. The playlist's `tvg-id` where
   * present, otherwise a hash of the URL — some entries have an empty `tvg-id`
   * and a favourites list keyed on an empty string would collapse them all
   * into one.
   */
  id: string;
  /** Display name with the quality and status markers removed. */
  name: string;
  url: string;
  logo?: string;
  /** The playlist's `group-title`, split on `;` — a channel can be in several. */
  groups: string[];
  /** Lowercase ISO code from `tvg-id` (`CNN.us@SD` -> `us`), when present. */
  countryCode?: string;
  /** `1080p`, `720p`, `4K`… when the name advertised one. */
  quality?: string;
  /** The broadcaster only serves its own region; the stream will 403 abroad. */
  isGeoBlocked: boolean;
  /** Intermittent — the channel is not a continuous 24/7 feed. */
  isPartTime: boolean;
  /**
   * Request headers the stream expects, from `http-user-agent` /
   * `http-referrer` attributes or the `#EXTVLCOPT` equivalents.
   *
   * Not optional decoration: hundreds of channels in the public catalogue serve
   * segments only to a matching User-Agent and drop the connection without one.
   * Passing these to the player is what makes those channels play instead of
   * resolving and then failing on the first segment.
   */
  headers?: Record<string, string>;
}

const ATTR_PATTERN = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

/** `(1080p)`, `(720p)`, `(4K)`, `(HD)`, `(SD)` — the advertised resolution. */
const QUALITY_SUFFIX = /\s*\((4K|8K|UHD|FHD|HD|SD|\d{3,4}[pi])\)\s*$/i;

/**
 * The status markers iptv-org appends to a name. These are flags, not part of
 * the title.
 *
 * Matched as a known set rather than as "any bracketed word", because real
 * channels carry brackets in their names — `Music [Hits] TV` — and a blanket
 * pattern silently mangles them. The whole catalogue uses only `[Not 24/7]` and
 * `[Geo-blocked]`, and the two combine inside one bracket as
 * `[Not 24/7;Geo-blocked]`, so the contents are split on `;` before matching.
 */
const STATUS_MARKERS = new Set([
  'not 24/7',
  'not 24-7',
  'offline',
  'timeout',
  'duplicate',
  'nsfw',
  'encrypted',
  'closed',
]);

/** `[Geo-blocked]`, and the `[Geo-blocked: US only]` form with a trailing note. */
const isGeoMarker = (part: string): boolean => /^geo-?blocked\b/i.test(part.trim());

const isKnownMarker = (part: string): boolean =>
  isGeoMarker(part) || STATUS_MARKERS.has(part.trim().toLowerCase());

/** A bracket of status markers, e.g. `[Not 24/7;Geo-blocked]`. */
const BRACKET = /\s*\[([^\]]+)\]\s*/g;

/** The `-1` / `-1.5` duration that opens an `#EXTINF` line. */
const EXTINF_PREFIX = /^#EXTINF:\s*-?[\d.]+/;

/** `tvg-id` looks like `CNN.us@SD` — the country is the segment before `@`. */
const TVG_ID_PATTERN = /^[^.]*\.([a-z]{2})(?:@|$)/;

/** Markers that are words rather than numbers, normalised to upper case. */
const NAMED_QUALITIES = new Set(['4k', '8k', 'uhd', 'fhd', 'hd', 'sd']);

/**
 * A cheap stable hash, used only when `tvg-id` is missing.
 *
 * Not cryptographic and does not need to be — it keys a favourites list. It is
 * deterministic so a favourite survives a reload, which a random id would not.
 */
const hashUrl = (url: string): string => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  return `url-${(hash >>> 0).toString(36)}`;
};

/**
 * Split an `#EXTINF` line into its attributes and its channel name.
 *
 * The name is the text after the attribute list, so the split point is the
 * first comma that is *outside* quotes. Scanning is used rather than
 * `lastIndexOf(',')` because a quoted attribute may itself contain a comma, and
 * rather than a greedy regex because a name may contain commas too.
 */
export const splitExtInf = (line: string): { attrs: Record<string, string>; name: string } => {
  // Strip only the `#EXTINF:-1` duration prefix. A greedy `[^,]*` here would
  // swallow the attribute list, since the duration is not comma-delimited.
  const body = line.replace(EXTINF_PREFIX, '');
  const attrs: Record<string, string> = {};

  ATTR_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_PATTERN.exec(body)) !== null) {
    attrs[match[1].toLowerCase()] = match[2];
  }

  let inQuotes = false;
  let nameStart = -1;
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      nameStart = i + 1;
      break;
    }
  }

  return { attrs, name: nameStart >= 0 ? body.slice(nameStart).trim() : '' };
};

/**
 * Pull the resolution out of a channel name and strip the markers.
 *
 * Returns the cleaned name alongside the extracted flags so callers never have
 * to remember to do both — leaving `(1080p)` in the display name is the visible
 * half of this bug.
 */
export const cleanChannelName = (
  raw: string
): { name: string; quality?: string; isGeoBlocked: boolean; isPartTime: boolean } => {
  let name = raw;
  let isGeoBlocked = false;
  let isPartTime = false;

  BRACKET.lastIndex = 0;
  name = name.replace(BRACKET, (whole, contents: string) => {
    // Only remove a bracket whose every part is a known marker; a bracket like
    // `[Hits]` is part of the channel's name and must survive.
    const parts = contents.split(';').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0 || !parts.every(isKnownMarker)) return whole;

    for (const part of parts) {
      if (isGeoMarker(part)) isGeoBlocked = true;
      else if (part.toLowerCase().includes('24/7')) isPartTime = true;
    }
    return ' ';
  });

  let quality: string | undefined;
  const qualityMatch = name.match(QUALITY_SUFFIX);
  if (qualityMatch) {
    const found = qualityMatch[1];
    quality = NAMED_QUALITIES.has(found.toLowerCase()) ? found.toUpperCase() : found;
    name = name.slice(0, name.length - qualityMatch[0].length);
  }

  // Collapse the gaps left by stripped markers.
  name = name.replace(/\s{2,}/g, ' ').trim();

  return { name: name || raw.trim(), quality, isGeoBlocked, isPartTime };
};

/**
 * Parse an M3U playlist into channels.
 *
 * Tolerant by design: a malformed entry is skipped rather than throwing, since
 * the public catalogue is community-contributed and always contains a few
 * broken rows. One bad line must not cost the viewer the other 1,499 channels.
 *
 * Duplicate entries are collapsed. The combined index repeats some channels
 * up to sixteen times (`ic.m3u` carries 12,854 entries for 11,362 distinct
 * ones), and every repeat has an identical URL, so keeping them would show the
 * viewer the same channel over and over in the grid.
 */
export const parseM3U = (text: string): IptvChannel[] => {
  const channels: IptvChannel[] = [];
  const seen = new Set<string>();
  if (!text) return channels;

  let pending: {
    attrs: Record<string, string>;
    name: string;
    headers: Record<string, string>;
  } | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      const { attrs, name } = splitExtInf(line);
      const headers: Record<string, string> = {};
      // Some playlists carry the headers as attributes rather than as
      // #EXTVLCOPT directives.
      const agent = attrs['http-user-agent'] || attrs['user-agent'];
      const referrer = attrs['http-referrer'] || attrs['http-referer'] || attrs['referrer'];
      if (agent) headers['User-Agent'] = agent;
      if (referrer) headers['Referer'] = referrer;
      pending = { attrs, name, headers };
      continue;
    }

    // Options sit between the #EXTINF and the URL and belong to that entry.
    if (line.startsWith('#EXTVLCOPT') || line.startsWith('#KODIPROP')) {
      if (!pending) continue;
      const value = line.slice(line.indexOf(':') + 1).trim();
      const eq = value.indexOf('=');
      if (eq < 0) continue;
      const key = value.slice(0, eq).trim().toLowerCase();
      const val = value.slice(eq + 1).trim();
      if (!val) continue;
      // `http-user-agent=`, `http-referrer=`, and the `inputstream.adaptive.`
      // spellings all appear in the wild.
      if (key.endsWith('user-agent') || key.endsWith('useragent')) pending.headers['User-Agent'] = val;
      else if (key.endsWith('referrer') || key.endsWith('referer')) pending.headers['Referer'] = val;
      continue;
    }

    if (line.startsWith('#')) continue;

    // Anything that is neither a directive nor a comment is the stream URL, and
    // closes the entry opened by the last #EXTINF.
    if (!pending) continue;

    const { attrs, name, headers } = pending;
    const cleaned = cleanChannelName(name);
    const tvgId = (attrs['tvg-id'] || '').trim();
    const countryMatch = TVG_ID_PATTERN.exec(tvgId.toLowerCase());
    const logo = (attrs['tvg-logo'] || '').trim();
    const id = tvgId || hashUrl(line);

    // Dedupe on the id, not the id+url: the repeats are identical rows, and a
    // re-published stream for the same channel is a replacement, not a second
    // channel the viewer would want listed twice.
    if (seen.has(id)) {
      pending = null;
      continue;
    }
    seen.add(id);

    channels.push({
      id,
      name: cleaned.name,
      url: line,
      logo: /^https?:\/\//i.test(logo) ? logo : undefined,
      groups: (attrs['group-title'] || '')
        .split(';')
        .map((group) => group.trim())
        .filter(Boolean),
      countryCode: countryMatch ? countryMatch[1] : undefined,
      quality: cleaned.quality,
      isGeoBlocked: cleaned.isGeoBlocked,
      isPartTime: cleaned.isPartTime,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    pending = null;
  }

  return channels;
};

/**
 * Case-insensitive match for the search box.
 *
 * Channels are matched on name, group, country and quality, because a viewer
 * searching "sports" is as likely to mean the category as a channel called
 * Sports.
 */
export const matchesQuery = (channel: IptvChannel, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    channel.name,
    channel.groups.join(' '),
    channel.countryCode || '',
    channel.quality || '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
};

/** A sort that puts the channels most likely to play first. */
export const sortChannels = (channels: IptvChannel[]): IptvChannel[] =>
  [...channels].sort((a, b) => {
    // A channel that will not play here should not lead the list.
    if (a.isGeoBlocked !== b.isGeoBlocked) return a.isGeoBlocked ? 1 : -1;
    if (a.isPartTime !== b.isPartTime) return a.isPartTime ? 1 : -1;
    // Then by advertised resolution, highest first.
    const height = (channel: IptvChannel) => {
      const match = channel.quality?.match(/(\d{3,4})/);
      if (match) return Number(match[1]);
      if (channel.quality?.toUpperCase() === '4K') return 2160;
      if (channel.quality?.toUpperCase() === '8K') return 4320;
      return 0;
    };
    const diff = height(b) - height(a);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
