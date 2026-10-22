/**
 * Guards the recognition engine.
 *
 * The intro matcher is a similarity threshold over a coarse fingerprint, so
 * the failure that matters is a *false positive* — skipping into the middle of
 * an episode because two unrelated openings scored too close. These tests pin
 * both directions: a repeated intro must be found, unrelated audio must not.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildSignature,
  similarity,
  findIntro,
  rememberIntro,
  findCredits,
  forgetSeries,
  __testing,
} from './introDetection';

const loudOpening = (seed: number, length = 320): number[] =>
  Array.from({ length }, (_, i) => Math.sin((i + seed) / 4) * (i % 7 === 0 ? 0.9 : 0.5));

const differentAudio = (length = 320): number[] =>
  Array.from({ length }, (_, i) => (i % 3 === 0 ? 0.02 : 0.8) * (i % 2 ? -1 : 1));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('buildSignature', () => {
  it('is level-independent, so a quiet and a loud copy of one intro match', () => {
    const base = loudOpening(0);
    const quiet = base.map((v) => v * 0.1);
    expect(similarity(buildSignature(base), buildSignature(quiet))).toBeGreaterThan(0.99);
  });

  it('returns an empty signature for no samples rather than throwing', () => {
    expect(buildSignature([])).toEqual([]);
  });
});

describe('similarity', () => {
  it('scores unrelated audio well below the match threshold', () => {
    const score = similarity(buildSignature(loudOpening(0)), buildSignature(differentAudio()));
    expect(score).toBeLessThan(__testing.MATCH_THRESHOLD);
  });
});

describe('findIntro', () => {
  it('does not claim an intro for the first episode of a season', async () => {
    // Nothing to compare against yet — inventing a marker here would skip the
    // viewer into the episode for no reason.
    const marker = await findIntro(100, 1, 1, loudOpening(0));
    expect(marker).toBeNull();
  });

  it('finds the intro on a later episode that repeats the same opening', async () => {
    await rememberIntro(100, 1, 1, loudOpening(0));
    const marker = await findIntro(100, 1, 2, loudOpening(0));
    expect(marker).not.toBeNull();
    expect(marker?.confidence).toBeGreaterThanOrEqual(__testing.MATCH_THRESHOLD);
    expect(marker?.sourceEpisode).toBe(1);
  });

  it('does not find an intro when the opening differs', async () => {
    await rememberIntro(100, 1, 1, loudOpening(0));
    const marker = await findIntro(100, 1, 2, differentAudio());
    expect(marker).toBeNull();
  });

  it('keeps seasons apart, so season 2 is not matched against season 1', async () => {
    await rememberIntro(100, 1, 1, loudOpening(0));
    expect(await findIntro(100, 2, 1, loudOpening(0))).toBeNull();
  });
});

describe('findCredits', () => {
  it('places the credits near the end of a real runtime', () => {
    const marker = findCredits(2700);
    expect(marker).not.toBeNull();
    expect(marker!.start).toBeGreaterThan(2400);
    expect(marker!.end).toBe(2700);
  });

  it('returns nothing for an unknown or zero duration', () => {
    expect(findCredits(0)).toBeNull();
    expect(findCredits(Number.NaN)).toBeNull();
    expect(findCredits(-10)).toBeNull();
  });
});

describe('forgetSeries', () => {
  it('drops what was learned so recognition restarts', async () => {
    await rememberIntro(100, 1, 1, loudOpening(0));
    await forgetSeries(100, 1);
    expect(await findIntro(100, 1, 2, loudOpening(0))).toBeNull();
  });
});
