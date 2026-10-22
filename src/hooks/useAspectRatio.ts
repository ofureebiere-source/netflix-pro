// src/hooks/useAspectRatio.ts
//
// MX-Player-style aspect ratio control: a set of named presets rather than the
// old three-way cycle. Fixed ratios (16:9, 4:3) exist because a source that was
// letterboxed for the wrong ratio cannot be fixed by fit/fill/stretch alone —
// the user needs to tell the player what shape the frame actually is.
//
// Independent of the pinch-to-zoom gesture in useGestures.ts, which toggles a
// simpler contain/cover boolean. Once a mode is picked explicitly here, that
// choice wins over the pinch gesture's boolean until the user pinches again.
// See VideoPlayerScreen's `contentFit` resolution for how the two combine.

import { useCallback, useRef, useState } from 'react';
import { Animated } from 'react-native';

export type AspectRatioMode =
  | 'auto'
  | 'contain'
  | 'cover'
  | 'fill'
  | '16:9'
  | '4:3'
  | '21:9';

/**
 * What the player should do with the surface.
 * - `contentFit` is passed straight to expo-video.
 * - `aspectRatio` is set only for the fixed-ratio presets, where the surface
 *   itself must take a particular shape for contentFit to mean anything.
 */
export interface AspectRatioResolution {
  contentFit: 'contain' | 'cover' | 'fill';
  aspectRatio?: number;
}

export const ASPECT_RATIO_LABELS: Record<AspectRatioMode, string> = {
  auto: 'Fit',
  contain: 'Fit',
  cover: 'Fill',
  fill: 'Stretch',
  '16:9': '16:9',
  '4:3': '4:3',
  '21:9': '21:9',
};

/** Ratios for the fixed presets, as width / height. */
const FIXED_RATIOS: Partial<Record<AspectRatioMode, number>> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '21:9': 21 / 9,
};

/**
 * Cycle order for the quick toggle in the controls bar. The fixed ratios are
 * reachable from the picker but are not in the cycle, because a user tapping
 * the cycle button is trying to fix letterboxing, and stepping through three
 * fixed ratios to get back to Fit would be tedious.
 */
const CYCLE_ORDER: AspectRatioMode[] = ['contain', 'cover', 'fill'];

/** Everything offered in the aspect ratio picker, in display order. */
export const ASPECT_RATIO_MODES: AspectRatioMode[] = [
  'contain',
  'cover',
  'fill',
  '16:9',
  '4:3',
  '21:9',
];

/**
 * Resolve a mode against the source dimensions and the surface size.
 *
 * For a fixed ratio the surface is pinned to that ratio and the video is
 * contained within it, so the bars land where the user expects instead of the
 * surface reshaping to the video.
 */
export const resolveAspectRatio = (mode: AspectRatioMode): AspectRatioResolution => {
  const fixed = FIXED_RATIOS[mode];
  if (fixed !== undefined) {
    return { contentFit: 'contain', aspectRatio: fixed };
  }
  if (mode === 'cover' || mode === 'fill') {
    return { contentFit: mode };
  }
  return { contentFit: 'contain' };
};

export const useAspectRatio = () => {
  const [mode, setMode] = useState<AspectRatioMode>('auto');
  const [labelVisible, setLabelVisible] = useState(false);
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashLabel = useCallback(() => {
    setLabelVisible(true);
    Animated.timing(labelOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    if (labelTimeoutRef.current) clearTimeout(labelTimeoutRef.current);
    labelTimeoutRef.current = setTimeout(() => {
      Animated.timing(labelOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setLabelVisible(false);
      });
    }, 1000);
  }, [labelOpacity]);

  const cycleAspectRatio = useCallback(() => {
    setMode((prev) => {
      const currentIndex = CYCLE_ORDER.indexOf(prev === 'auto' ? 'contain' : prev);
      // A fixed ratio is not in the cycle; treat it as the start so the next tap
      // lands on a sensible neighbour rather than jumping unpredictably.
      const next = CYCLE_ORDER[(currentIndex + 1) % CYCLE_ORDER.length];
      return next;
    });
    flashLabel();
  }, [flashLabel]);

  const selectAspectRatio = useCallback(
    (next: AspectRatioMode) => {
      setMode(next);
      flashLabel();
    },
    [flashLabel]
  );

  return {
    aspectRatioMode: mode,
    cycleAspectRatio,
    selectAspectRatio,
    aspectRatioLabel: ASPECT_RATIO_LABELS[mode],
    labelVisible,
    labelOpacity,
  };
};
