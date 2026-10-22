/**
 * Durable playback settings that the player applies to the native audio chain
 * and to the video surface.
 *
 * Kept in a zustand store rather than the Redux `settings` slice because these
 * are written from the player on every adjustment and need to survive a
 * restart; `settingsSlice` is in-memory only.
 *
 * The equaliser lives here rather than in the player component so a profile set
 * while watching one title is still in force the next time the app opens.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Band gains in millibels, one entry per hardware band, in band order. Length
 * is whatever the device reports, so this is never a fixed-size tuple.
 */
export type EqPresetId = 'flat' | 'bass' | 'treble' | 'vocal' | 'loudness' | 'custom';

export interface EqPreset {
  id: EqPresetId;
  /** i18n key under `audio.preset.*`. */
  labelKey: string;
  /**
   * Per-band gain in millibels for a nominal 5-band device, or null for Flat.
   * Resampled onto the device's actual band count by `resolvePresetBands`,
   * because a 10-band device must not get a 5-band curve applied to its first
   * five bands.
   */
  bands: number[] | null;
}

export const EQ_PRESETS: EqPreset[] = [
  { id: 'flat', labelKey: 'audio.preset.flat', bands: null },
  { id: 'bass', labelKey: 'audio.preset.bass', bands: [600, 400, 100, -50, -100] },
  { id: 'treble', labelKey: 'audio.preset.treble', bands: [-100, -50, 100, 400, 600] },
  { id: 'vocal', labelKey: 'audio.preset.vocal', bands: [-200, 0, 400, 300, 0] },
  { id: 'loudness', labelKey: 'audio.preset.loudness', bands: [500, 200, 0, 200, 500] },
];

/**
 * Gain is stored as a percentage of unity so the UI can talk in "125%", while
 * the native layer takes millibels.
 */
export const MIN_GAIN_PERCENT = 100;
export const MAX_GAIN_PERCENT = 300;

/**
 * Above this the limiter starts working hard enough to pump on percussive
 * material. The UI warns rather than blocks, because whether it is audible
 * depends on the source.
 */
export const GAIN_WARNING_PERCENT = 150;

export type SubtitleWeight = 'normal' | 'bold';

/**
 * Colour temperature of the night-mode overlay. Warm reduces blue light; the
 * overlay is drawn in JS above the video surface, so this has no native cost.
 */
export type NightModeTemperature = 'off' | 'warm' | 'warmer' | 'warmest';

/** Which gesture runs on which half of the screen. */
export type VerticalGestureAction = 'brightness' | 'volume';

export interface PlaybackSettingsState {
  eqPresetId: EqPresetId;
  /** Only meaningful when eqPresetId is 'custom'. */
  customBands: number[];
  gainPercent: number;
  nightMode: NightModeTemperature;

  subtitleWeight: SubtitleWeight;
  subtitleColor: string;
  /** 0-100, opacity of the box behind subtitle text. */
  subtitleBackgroundOpacity: number;
  /** 0-4, in points. */
  subtitleOutlineWidth: number;
  /** 0-100, percentage from the top of the video. */
  subtitleVerticalPosition: number;
  /** null keeps the system font. */
  subtitleFontFamily: string | null;

  leftVerticalGesture: VerticalGestureAction;
  rightVerticalGesture: VerticalGestureAction;

  setEqPreset: (id: EqPresetId) => void;
  setCustomBands: (bands: number[]) => void;
  setGainPercent: (percent: number) => void;
  setNightMode: (mode: NightModeTemperature) => void;
  setSubtitleWeight: (weight: SubtitleWeight) => void;
  setSubtitleColor: (color: string) => void;
  setSubtitleBackgroundOpacity: (opacity: number) => void;
  setSubtitleOutlineWidth: (width: number) => void;
  setSubtitleVerticalPosition: (position: number) => void;
  setSubtitleFontFamily: (family: string | null) => void;
  setLeftVerticalGesture: (action: VerticalGestureAction) => void;
  setRightVerticalGesture: (action: VerticalGestureAction) => void;
  resetPlaybackSettings: () => void;
}

const DEFAULT_BANDS = [0, 0, 0, 0, 0];

const defaultPlaybackSettings = {
  eqPresetId: 'flat' as EqPresetId,
  customBands: DEFAULT_BANDS,
  gainPercent: MIN_GAIN_PERCENT,
  nightMode: 'off' as NightModeTemperature,

  subtitleWeight: 'normal' as SubtitleWeight,
  subtitleColor: '#FFFFFF',
  subtitleBackgroundOpacity: 0,
  subtitleOutlineWidth: 0,
  subtitleVerticalPosition: 90,
  subtitleFontFamily: null,

  leftVerticalGesture: 'brightness' as VerticalGestureAction,
  rightVerticalGesture: 'volume' as VerticalGestureAction,
};

/**
 * Map a preset's nominal 5-band curve onto a device with `bandCount` bands.
 *
 * Linear interpolation across the curve's index range rather than index-by-index
 * copy: a 10-band device gets a smooth curve spanning all ten bands, and a
 * 3-band device gets the low, middle and high points rather than the first three
 * entries (which would make every device sound like it only had bass).
 */
export const resolvePresetBands = (
  presetBands: number[] | null,
  bandCount: number
): number[] => {
  if (bandCount <= 0) return [];
  if (!presetBands || presetBands.length === 0) {
    return new Array(bandCount).fill(0);
  }
  if (bandCount === 1) return [presetBands[0]];

  const lastIndex = presetBands.length - 1;
  return Array.from({ length: bandCount }, (_, band) => {
    const position = (band / (bandCount - 1)) * lastIndex;
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, lastIndex);
    const fraction = position - lower;
    return Math.round(
      presetBands[lower] + (presetBands[upper] - presetBands[lower]) * fraction
    );
  });
};

/** Percentage of unity to the millibels the native gain stage expects. */
export const gainPercentToMb = (percent: number): number => {
  const clamped = Math.max(MIN_GAIN_PERCENT, Math.min(MAX_GAIN_PERCENT, percent));
  if (clamped <= MIN_GAIN_PERCENT) return 0;
  // 100% -> 0 mB (unity). Each further 100% is +10 dB, which is the native
  // module's documented ceiling.
  return Math.round(((clamped - MIN_GAIN_PERCENT) / 100) * 1000);
};

export const usePlaybackSettings = create<PlaybackSettingsState>()(
  persist(
    (set) => ({
      ...defaultPlaybackSettings,

      setEqPreset: (id) => set({ eqPresetId: id }),
      // Editing a band implies a custom curve, so the preset selection follows
      // rather than leaving a named preset highlighted while it no longer applies.
      setCustomBands: (bands) => set({ customBands: bands, eqPresetId: 'custom' }),
      setGainPercent: (percent) =>
        set({
          gainPercent: Math.max(MIN_GAIN_PERCENT, Math.min(MAX_GAIN_PERCENT, percent)),
        }),
      setNightMode: (mode) => set({ nightMode: mode }),
      setSubtitleWeight: (weight) => set({ subtitleWeight: weight }),
      setSubtitleColor: (color) => set({ subtitleColor: color }),
      setSubtitleBackgroundOpacity: (opacity) =>
        set({ subtitleBackgroundOpacity: Math.max(0, Math.min(100, opacity)) }),
      setSubtitleOutlineWidth: (width) =>
        set({ subtitleOutlineWidth: Math.max(0, Math.min(4, width)) }),
      setSubtitleVerticalPosition: (position) =>
        set({ subtitleVerticalPosition: Math.max(0, Math.min(100, position)) }),
      setSubtitleFontFamily: (family) => set({ subtitleFontFamily: family }),
      setLeftVerticalGesture: (action) => set({ leftVerticalGesture: action }),
      setRightVerticalGesture: (action) => set({ rightVerticalGesture: action }),
      resetPlaybackSettings: () => set({ ...defaultPlaybackSettings }),
    }),
    {
      name: 'playback-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);

/** The band gains to send to the native layer for the current selection. */
export const resolveActiveBands = (
  state: Pick<PlaybackSettingsState, 'eqPresetId' | 'customBands'>,
  bandCount: number
): number[] => {
  if (state.eqPresetId === 'custom') {
    // A custom curve is already per-band, but may have been captured on a device
    // with a different band count, so it is resampled the same way.
    return resolvePresetBands(state.customBands, bandCount);
  }
  const preset = EQ_PRESETS.find((candidate) => candidate.id === state.eqPresetId);
  return resolvePresetBands(preset?.bands ?? null, bandCount);
};
