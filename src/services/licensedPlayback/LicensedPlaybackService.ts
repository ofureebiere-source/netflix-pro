// src/services/licensedPlayback/LicensedPlaybackService.ts
//
// Client for the Net-web backend (King-Fisher000/Net-web), the project's own
// HTTP service. It wraps the same `netweb.scraping` modules the terminal UI
// uses, so the app and the TUI resolve streams through one code path.
//
// ── CONFIGURATION ───────────────────────────────────────────────────────
// Set the base URL in a local .env (gitignored, never committed):
//   EXPO_PUBLIC_LICENSED_BACKEND_URL=https://netweb-apsv.onrender.com
//   EXPO_PUBLIC_LICENSED_BACKEND_API_KEY=          # optional; unused today
// The URL always overrides DEFAULT_BASE_URL below, so no code edit or
// rebuild is needed to repoint the app.
//
// ── REAL CONTRACT (verified against the running service) ────────────────
//   GET {base}/health
//     -> { status, provider_set, active_providers, skipped_providers,
//          providers: [{id, label, by_tmdb_id}] }
//   GET {base}/v1/sources?providers=
//     -> { status, provider_set, active: [...], skipped: [...] }
//   GET {base}/v1/stream?tmdbId=&mediaType=movie|tv&season=&episode=
//                       &title=&year=&providers=
//     -> { status, info: {tmdbId, mediaType, season, episode, title, year,
//                         provider_set},
//          sources: [{ name, data: { stream, type: 'hls'|'dash'|'mp4',
//                                    quality, headers, size, subtitles[] } }] }
//   GET {base}/v1/subtitles?tmdbId=&mediaType=&season=&episode=&languages=
//     -> { status, info, tracks: [{url, label, lang}], notes: [] }
//   GET {base}/proxy?url=&referer=&origin=
//     -> the stream, with the provider's own headers applied. Refuses
//        non-allowlisted hosts with 403.
//
// Two details differ from the old placeholder contract and matter:
//   1. There is no /v1/playback and no /v1/download. One endpoint,
//      /v1/stream, serves both; downloads use the same resolved URL.
//   2. `headers` is per-source and is REQUIRED for playback. Most providers
//      only serve their segments to a request carrying the right
//      User-Agent/Referer, so callers must pass these through to the player
//      rather than inventing their own.
//
// ── RENDER FREE-TIER COLD STARTS ────────────────────────────────────────
// The free tier spins down after ~15 minutes idle, and the next request
// waits 30-60s+ for a cold start. A short timeout would abort every
// "first request after idle", which for a video app is most requests:
//   1. First attempt uses FAST_TIMEOUT_MS.
//   2. If that attempt times out (a client-side abort, not a 4xx/5xx),
//      retry once with COLD_START_TIMEOUT_MS.
//   3. A real HTTP error is NOT retried — that is a real answer, and
//      retrying would only hide it.

export type LicensedMediaType = 'movie' | 'tv';

export type LicensedStreamType = 'hls' | 'dash' | 'mp4';

export interface LicensedSubtitleTrack {
  url: string;
  label: string;
  lang: string;
}

/** One resolved source, flattened from the backend's {name, data} envelope. */
export interface LicensedPlaybackSource {
  url: string;
  type: LicensedStreamType;
  headers?: Record<string, string>;
  expiresAt?: string;
  /** Human-readable provider label, e.g. "frameXTV · bowler · 720p". */
  name?: string;
  /** Provider id, e.g. "framextv". Stable, unlike `name`. */
  provider?: string;
  /** Raw quality string, e.g. "720p | English". */
  quality?: string;
  size?: number;
  subtitles?: LicensedSubtitleTrack[];
}

export interface LicensedDownloadSource {
  url: string;
  headers?: Record<string, string>;
}

export interface LicensedPlaybackRequest {
  tmdbId: string | number;
  mediaType: LicensedMediaType;
  season?: number;
  episode?: number;
  /** Optional hints: some providers are title-based rather than TMDB-id based. */
  title?: string;
  year?: number | string;
  /** Restrict to specific provider ids. Omit to use the server's own set. */
  providers?: string;
}

export interface LicensedHealth {
  status: string;
  provider_set: string;
  active_providers: number;
  skipped_providers: number;
  providers: { id: string; label: string; by_tmdb_id: boolean }[];
}

/** Thrown when the backend answers but has no playable source for the title. */
export class NoSourceAvailableError extends Error {
  readonly providerSet?: string;
  constructor(message: string, providerSet?: string) {
    super(message);
    this.name = 'NoSourceAvailableError';
    this.providerSet = providerSet;
  }
}

const DEFAULT_BASE_URL = 'https://netweb-apsv.onrender.com';

const BASE_URL = process.env.EXPO_PUBLIC_LICENSED_BACKEND_URL || DEFAULT_BASE_URL;
const API_KEY = process.env.EXPO_PUBLIC_LICENSED_BACKEND_API_KEY ?? '';
const USING_DEFAULT_URL = !process.env.EXPO_PUBLIC_LICENSED_BACKEND_URL;

const FAST_TIMEOUT_MS = 12000;
const COLD_START_TIMEOUT_MS = 65000;

/** The base URL in use, for diagnostics. */
export function getBackendBaseUrl(): string {
  return BASE_URL;
}

/**
 * True as long as a base URL is set — including the built-in default. This
 * only means "a request can be attempted", not "a reachable backend is
 * configured". Use isUsingDefaultBackend() to distinguish those.
 */
export function isLicensedBackendConfigured(): boolean {
  return BASE_URL.length > 0;
}

/**
 * True when EXPO_PUBLIC_LICENSED_BACKEND_URL is unset, so requests go to the
 * built-in default rather than an explicitly configured host.
 */
export function isUsingDefaultBackend(): boolean {
  return USING_DEFAULT_URL;
}

/** @deprecated Kept for callers written against the old placeholder naming. */
export const isUsingPlaceholderBackend = isUsingDefaultBackend;

function buildQuery(req: LicensedPlaybackRequest, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    tmdbId: String(req.tmdbId),
    mediaType: req.mediaType,
  });
  if (req.mediaType === 'tv') {
    if (req.season != null) params.set('season', String(req.season));
    if (req.episode != null) params.set('episode', String(req.episode));
  }
  if (req.title) params.set('title', req.title);
  if (req.year != null) params.set('year', String(req.year));
  if (req.providers) params.set('providers', req.providers);
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return params.toString();
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : undefined,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function getJson<T>(path: string, query: string): Promise<T> {
  const url = `${BASE_URL.replace(/\/$/, '')}${path}${query ? `?${query}` : ''}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, FAST_TIMEOUT_MS);
  } catch (error) {
    if (!isAbortError(error)) throw error;
    // Likely a Render cold start — retry once with a much longer timeout.
    console.warn(
      `[LicensedPlayback] First attempt timed out after ${FAST_TIMEOUT_MS}ms — ` +
      `retrying with a longer timeout in case the backend is waking from a cold start...`
    );
    response = await fetchWithTimeout(url, COLD_START_TIMEOUT_MS);
  }

  if (!response.ok) {
    const where = USING_DEFAULT_URL ? ' (built-in default URL)' : '';
    throw new Error(
      `Net-web backend returned ${response.status} for ${path}${where}`
    );
  }

  return (await response.json()) as T;
}

interface RawStreamResponse {
  status?: string;
  info?: { provider_set?: string };
  sources?: {
    name?: string;
    data?: {
      stream?: string;
      type?: string;
      quality?: string;
      headers?: Record<string, string>;
      size?: number;
      subtitles?: { url?: string; label?: string; lang?: string }[];
    };
  }[];
}

const VALID_TYPES: LicensedStreamType[] = ['hls', 'dash', 'mp4'];

function normaliseType(raw: string | undefined): LicensedStreamType {
  const value = (raw || '').toLowerCase();
  return (VALID_TYPES as string[]).includes(value)
    ? (value as LicensedStreamType)
    : 'mp4';
}

/** Flatten the backend's {name, data} envelope into the shape the app uses. */
function flattenSource(
  entry: NonNullable<RawStreamResponse['sources']>[number]
): LicensedPlaybackSource | null {
  const data = entry?.data;
  const stream = data?.stream;
  if (!stream) return null;

  const subtitles = (data?.subtitles || [])
    .filter((s): s is { url: string; label?: string; lang?: string } => !!s?.url)
    .map((s) => ({
      url: s.url,
      label: s.label || s.lang || 'Subtitle',
      lang: s.lang || '',
    }));

  return {
    url: stream,
    type: normaliseType(data?.type),
    headers: data?.headers && Object.keys(data.headers).length > 0
      ? data.headers
      : undefined,
    name: entry.name,
    quality: data?.quality,
    size: data?.size,
    subtitles: subtitles.length > 0 ? subtitles : undefined,
  };
}

/**
 * Resolve playable sources for a title.
 *
 * Returns the list in the backend's order, which is the server's own
 * preference (it resolves every provider concurrently and reports what
 * answered). An empty list is not an error — it means no provider had the
 * title — but it is reported as NoSourceAvailableError by
 * getPlaybackSource() so callers get a clear "not available" state.
 */
export async function getPlaybackSources(
  req: LicensedPlaybackRequest
): Promise<LicensedPlaybackSource[]> {
  const data = await getJson<RawStreamResponse>('/v1/stream', buildQuery(req));
  const out: LicensedPlaybackSource[] = [];
  for (const entry of data?.sources || []) {
    const flat = flattenSource(entry);
    if (flat) out.push(flat);
  }
  return out;
}

/**
 * Resolve the single best playable source for a title.
 *
 * The backend resolves providers concurrently and does not rank them, so
 * the first usable entry is taken as-is. Callers that want a quality or
 * audio-track choice should use getPlaybackSources() and pick.
 *
 * Throws NoSourceAvailableError when the backend answers with no sources —
 * callers should show a clear "not available" state rather than falling
 * back to any other source.
 */
export async function getPlaybackSource(
  req: LicensedPlaybackRequest
): Promise<LicensedPlaybackSource> {
  const data = await getJson<RawStreamResponse>('/v1/stream', buildQuery(req));

  for (const entry of data?.sources || []) {
    const flat = flattenSource(entry);
    if (flat) return flat;
  }

  const set = data?.info?.provider_set;
  throw new NoSourceAvailableError(
    `No provider returned a playable source for TMDB ${req.tmdbId}.` +
    (set ? ` Active provider set: ${set}.` : ''),
    set
  );
}

/**
 * Resolve a downloadable source for a title.
 *
 * Net-web has no separate download endpoint: the same resolved URL is
 * downloaded, with the same headers the player would use. Kept as its own
 * function so download callers keep a stable entry point.
 */
export async function getDownloadSource(
  req: LicensedPlaybackRequest
): Promise<LicensedDownloadSource> {
  const source = await getPlaybackSource(req);
  return { url: source.url, headers: source.headers };
}

export interface LicensedSubtitleResult {
  status: string;
  tracks: LicensedSubtitleTrack[];
  notes: string[];
}

/**
 * Fetch subtitle tracks for a title.
 *
 * Works keylessly through the Stremio bridges; the OpenSubtitles path needs
 * NETWEB_OPENSUBTITLES_KEY set on the server. An empty `tracks` list with a
 * `no_subtitles` status is a normal answer, not an error.
 */
export async function getSubtitles(
  req: LicensedPlaybackRequest & { languages?: string }
): Promise<LicensedSubtitleResult> {
  const extra: Record<string, string> = {};
  if (req.languages) extra.languages = req.languages;
  const data = await getJson<{
    status?: string;
    tracks?: { url?: string; label?: string; lang?: string }[];
    notes?: string[];
  }>('/v1/subtitles', buildQuery(req, extra));

  const tracks = (data?.tracks || [])
    .filter((t): t is { url: string; label?: string; lang?: string } => !!t?.url)
    .map((t) => ({
      url: t.url,
      label: t.label || t.lang || 'Subtitle',
      lang: t.lang || '',
    }));

  return {
    status: data?.status || 'unknown',
    tracks,
    notes: data?.notes || [],
  };
}

/**
 * Probe the backend for liveness and which providers are active.
 *
 * Use this on startup so the app can degrade gracefully — a provider that
 * is skipped server-side should not be offered in the UI.
 */
export async function checkBackendHealth(): Promise<LicensedHealth | null> {
  try {
    return await getJson<LicensedHealth>('/health', '');
  } catch (error) {
    console.warn('[LicensedPlayback] Backend health check failed:', error);
    return null;
  }
}

export default {
  getBackendBaseUrl,
  isLicensedBackendConfigured,
  isUsingDefaultBackend,
  isUsingPlaceholderBackend,
  getPlaybackSource,
  getPlaybackSources,
  getDownloadSource,
  getSubtitles,
  checkBackendHealth,
};
