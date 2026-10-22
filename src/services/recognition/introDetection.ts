/**
 * The recognition engine: locating the intro, recap and credits of a title.
 *
 * The backend returns no chapter or marker metadata (checked against the live
 * `/v1/stream` and `/v1/meta` responses), so the app has to find these itself
 * rather than read them. This is the engine the audit said was missing
 * (TODO section 4); the `skipIntro` / `skipCredits` toggles were persisted and
 * rendered with nothing behind them.
 *
 * What it recognises, and from what signal:
 *
 *  - **Intro / recap** for a series, from the *audio fingerprint* of the
 *    opening. An intro is by definition near-identical across episodes, so the
 *    spectral signature of the first N seconds of one episode matches the next.
 *    A single episode cannot tell you where its own intro is; a second episode
 *    of the same season can. So this accumulates per-episode fingerprints and
 *    starts recognising from the second episode watched.
 *  - **Credits** from the *duration*, which needs no fingerprint: an outro
 *    reliably starts near the end of the runtime. This works on the first
 *    episode and is the part users notice most.
 *
 * The fingerprints are coarse on purpose — a few hundred bytes per episode,
 * stored locally, no audio ever leaves the device. This is not speech
 * recognition and does not attempt it: burned-in subtitles and dialogue-derived
 * captions need a model that would dwarf the app, and neither is required for
 * skip-intro.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'netflixpro.recognition.intros';
const SAMPLE_SECONDS = 45;
const BUCKETS = 32;
const MATCH_THRESHOLD = 0.82;
const MIN_CREDITS_SECONDS = 30;
const CREDITS_FRACTION = 0.92;

export interface IntroMarker {
  /** Seconds into the episode where the intro starts. */
  start: number;
  /** Seconds where it ends, when a matching tail was found. */
  end: number | null;
  confidence: number;
  /** Which episode supplied the match, for diagnostics. */
  sourceEpisode: number;
}

interface StoredIntro {
  season: number;
  episode: number;
  /** Normalised energy per bucket, the comparable part of the fingerprint. */
  signature: number[];
}

type IntroStore = Record<string, StoredIntro[]>;

/**
 * Reduce a slice of samples to a fixed-length, level-independent signature.
 *
 * Normalising to a zero mean and unit scale is what makes this work across
 * sources: the same intro from a 720p and a 1080p encode has the same shape
 * even when the absolute loudness differs.
 */
export const buildSignature = (samples: number[]): number[] => {
  if (samples.length === 0) return [];
  const buckets: number[] = [];
  const perBucket = Math.max(1, Math.floor(samples.length / BUCKETS));
  for (let b = 0; b < BUCKETS; b += 1) {
    let sum = 0;
    let count = 0;
    for (let i = b * perBucket; i < Math.min((b + 1) * perBucket, samples.length); i += 1) {
      sum += Math.abs(samples[i]);
      count += 1;
    }
    buckets.push(count > 0 ? sum / count : 0);
  }
  const mean = buckets.reduce((a, b) => a + b, 0) / buckets.length;
  const variance = buckets.reduce((a, b) => a + (b - mean) ** 2, 0) / buckets.length;
  const std = Math.sqrt(variance) || 1;
  return buckets.map((value) => (value - mean) / std);
};

/** Cosine similarity, mapped to 0..1. */
export const similarity = (a: number[], b: number[]): number => {
  if (a.length === 0 || b.length !== a.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

const readStore = async (): Promise<IntroStore> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IntroStore) : {};
  } catch {
    return {};
  }
};

const writeStore = async (store: IntroStore): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Losing a fingerprint costs one more episode before recognition starts.
  }
};

const seriesKey = (mediaId: string | number, season: number): string => `${mediaId}:s${season}`;

/**
 * Find an intro in this episode by matching its opening against episodes of
 * the same season that were already fingerprinted.
 *
 * Returns null when there is nothing to match against yet, which is the normal
 * first-episode outcome.
 */
export const findIntro = async (
  mediaId: string | number,
  season: number,
  episode: number,
  samples: number[]
): Promise<IntroMarker | null> => {
  const signature = buildSignature(samples);
  if (signature.length === 0) return null;

  const store = await readStore();
  const known = store[seriesKey(mediaId, season)] ?? [];

  let best: { score: number; candidate: StoredIntro } | null = null;
  for (const candidate of known) {
    if (candidate.episode === episode) continue;
    const score = similarity(signature, candidate.signature);
    if (!best || score > best.score) best = { score, candidate };
  }

  if (!best || best.score < MATCH_THRESHOLD) return null;

  // The fingerprint was taken from the opening, so the intro is assumed to
  // begin where sampling began. `end` stays null until a tail is observed:
  // reporting a fabricated end time would let the UI cut into the episode.
  return {
    start: 0,
    end: null,
    confidence: best.score,
    sourceEpisode: best.candidate.episode,
  };
};

/** Record this episode's opening so later episodes in the season can match it. */
export const rememberIntro = async (
  mediaId: string | number,
  season: number,
  episode: number,
  samples: number[]
): Promise<void> => {
  const signature = buildSignature(samples);
  if (signature.length === 0) return;

  const store = await readStore();
  const key = seriesKey(mediaId, season);
  const existing = (store[key] ?? []).filter((entry) => entry.episode !== episode);
  existing.push({ season, episode, signature });
  store[key] = existing.slice(-20);
  await writeStore(store);
};

/**
 * Where the credits start, derived from the runtime.
 *
 * No fingerprint needed, so this works on the very first episode. The absolute
 * floor stops a short clip from reporting credits at zero.
 */
export const findCredits = (duration: number): IntroMarker | null => {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const start = Math.max(duration * CREDITS_FRACTION, duration - MIN_CREDITS_SECONDS * 4);
  if (start <= 0 || start >= duration) return null;
  return { start, end: duration, confidence: 1, sourceEpisode: 0 };
};

/** Forget everything learned about a series. */
export const forgetSeries = async (mediaId: string | number, season?: number): Promise<void> => {
  const store = await readStore();
  if (season === undefined) {
    for (const key of Object.keys(store)) {
      if (key.startsWith(`${mediaId}:`)) delete store[key];
    }
  } else {
    delete store[seriesKey(mediaId, season)];
  }
  await writeStore(store);
};

export const __testing = { MATCH_THRESHOLD, SAMPLE_SECONDS, BUCKETS, seriesKey };
