// src/hooks/useSkipMarkers.ts
import { useEffect, useRef, useState } from 'react';
import { findCredits, findIntro, rememberIntro, type IntroMarker } from '../services/recognition/introDetection';

interface UseSkipMarkersParams {
  mediaId: string | number | undefined;
  season?: string | number;
  episode?: string | number;
  position: number;
  duration: number;
  /** The saved `skipIntro` setting. */
  skipIntro: boolean;
  /** The saved `skipCredits` setting. */
  skipCredits: boolean;
  /** Whether the player is a series episode, as opposed to a film. */
  isSeries: boolean;
  onSeek: (seconds: number) => void;
}

/**
 * Turns the recognition engine's markers into the two skip affordances.
 *
 * The toggles in Settings previously persisted and rendered while nothing read
 * them, so they did nothing (TODO sections 1 and 4). This is what reads them.
 *
 * The two behave differently on purpose:
 *
 *  - **Credits** are a *prompt*. The marker is known on the first episode from
 *    the runtime, and auto-skipping the credits would cut off a viewer who wants
 *    to watch them, so this only offers the jump.
 *  - **Intro** is *automatic*, because that is the point of the toggle — but
 *    only once the engine has actually recognised one. On the first episode of
 *    a season it has nothing to match against and stays silent rather than
 *    guessing.
 */
export const useSkipMarkers = ({
  mediaId,
  season,
  episode,
  position,
  duration,
  skipIntro,
  skipCredits,
  isSeries,
  onSeek,
}: UseSkipMarkersParams) => {
  const [intro, setIntro] = useState<IntroMarker | null>(null);
  const [credits, setCredits] = useState<IntroMarker | null>(null);
  const [showSkipCredits, setShowSkipCredits] = useState(false);
  const introSkippedRef = useRef(false);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);

  // Credits come straight from the runtime, so this resolves as soon as the
  // player reports a duration.
  useEffect(() => {
    if (!skipCredits || !isSeries) {
      setCredits(null);
      return;
    }
    setCredits(findCredits(duration));
  }, [duration, skipCredits, isSeries]);

  // A recognised intro is recorded so the next episode of the season can match
  // it. Nothing is sampled here yet: the engine accepts a signature and this
  // passes what the player can give it without an audio pipeline.
  useEffect(() => {
    introSkippedRef.current = false;
    setIntro(null);
  }, [mediaId, seasonNumber, episodeNumber]);

  useEffect(() => {
    if (!isSeries || !mediaId || !Number.isFinite(seasonNumber) || !Number.isFinite(episodeNumber)) return;
    let cancelled = false;
    void (async () => {
      const marker = await findIntro(mediaId, seasonNumber, episodeNumber, []);
      if (cancelled) return;
      setIntro(marker);
    })();
    return () => { cancelled = true; };
  }, [isSeries, mediaId, seasonNumber, episodeNumber]);

  // Auto-skip the intro, once per episode.
  useEffect(() => {
    if (!skipIntro || !intro || introSkippedRef.current) return;
    if (position < intro.start || (intro.end !== null && position >= intro.end)) return;
    introSkippedRef.current = true;
    onSeek(intro.end ?? intro.start);
  }, [skipIntro, intro, position, onSeek]);

  // Offer the credits jump within the last stretch, and only once.
  useEffect(() => {
    if (!skipCredits || !credits) {
      setShowSkipCredits(false);
      return;
    }
    const withinWindow = position >= credits.start && position < duration - 1;
    setShowSkipCredits(withinWindow);
  }, [skipCredits, credits, position, duration]);

  /** Called by the credits prompt. */
  const skipToCreditsEnd = () => {
    if (!credits) return;
    setShowSkipCredits(false);
    onSeek(Math.max(credits.start, duration - 1));
  };

  /** Record this episode's opening so a later episode can recognise its intro. */
  const rememberCurrentIntro = async (samples: number[]) => {
    if (!isSeries || !mediaId) return;
    if (!Number.isFinite(seasonNumber) || !Number.isFinite(episodeNumber)) return;
    await rememberIntro(mediaId, seasonNumber, episodeNumber, samples);
  };

  return {
    intro,
    credits,
    showSkipCredits,
    skipToCreditsEnd,
    rememberCurrentIntro,
    /** True while the intro has been recognised but not yet acted on. */
    hasRecognisedIntro: Boolean(intro),
  };
};

export default useSkipMarkers;
