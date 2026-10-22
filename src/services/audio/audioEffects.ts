/**
 * Typed access to the `NetflixProAudio` native module.
 *
 * The module only exists in a dev-client or release build. Under Jest and in
 * Expo Go it is absent, so every function here degrades to a no-op that reports
 * "unavailable" rather than throwing — the equaliser UI hides itself instead of
 * taking down the player.
 *
 * See `modules/netflix-pro-audio` for the Android implementation.
 */

import { NativeModules } from 'react-native';

export type EqualizerInfo = {
  available: boolean;
  numberOfBands: number;
  /** Gain limits the hardware accepts, in millibels. */
  minLevelMb: number;
  maxLevelMb: number;
  /** Centre frequency of each band in Hz. */
  centerFrequencies: number[];
};

type NetflixProAudioNativeModule = {
  isSupported(): boolean;
  getEqualizerInfo(): EqualizerInfo;
  setBandLevels(levelsMb: number[]): Promise<void>;
  getBandLevels(): number[];
  setGainMb(gainMb: number): Promise<void>;
  getGainMb(): number;
  reset(): Promise<void>;
};

const UNSUPPORTED: EqualizerInfo = {
  available: false,
  numberOfBands: 0,
  minLevelMb: 0,
  maxLevelMb: 0,
  centerFrequencies: [],
};

const native: NetflixProAudioNativeModule | undefined = (
  NativeModules as Record<string, NetflixProAudioNativeModule | undefined>
).NetflixProAudio;

/**
 * True only when the native module is present *and* the device reports usable
 * audio effects. A device can have the module and still lack an EQ
 * implementation, so the module's own answer is what counts.
 */
export const isAudioEffectsSupported = (): boolean => {
  try {
    return native?.isSupported() ?? false;
  } catch {
    return false;
  }
};

export const getEqualizerInfo = (): EqualizerInfo => {
  try {
    return native?.getEqualizerInfo() ?? UNSUPPORTED;
  } catch {
    return UNSUPPORTED;
  }
};

/** Band gains in millibels. Silently ignored when unsupported. */
export const setBandLevels = async (levelsMb: number[]): Promise<void> => {
  try {
    await native?.setBandLevels(levelsMb);
  } catch {
    // A device that advertised support can still fail on a specific write.
    // Losing an EQ tweak is not worth interrupting playback over.
  }
};

export const getBandLevels = (): number[] => {
  try {
    return native?.getBandLevels() ?? [];
  } catch {
    return [];
  }
};

/** Gain above unity in millibels; 0 means no boost. */
export const setGainMb = async (gainMb: number): Promise<void> => {
  try {
    await native?.setGainMb(gainMb);
  } catch {
    // See setBandLevels.
  }
};

export const getGainMb = (): number => {
  try {
    return native?.getGainMb() ?? 0;
  } catch {
    return 0;
  }
};

/** Return both effects to neutral. Called on reset and on player unmount. */
export const resetAudioEffects = async (): Promise<void> => {
  try {
    await native?.reset();
  } catch {
    // See setBandLevels.
  }
};
