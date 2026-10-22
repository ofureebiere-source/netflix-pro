/**
 * Applies the persisted equaliser and gain settings to the native audio chain.
 *
 * Mount this once, near the root, rather than inside the player: the effects sit
 * on the device's global output mix, so they are not tied to one player
 * instance, and re-mounting per screen would tear them down and rebuild them on
 * every navigation.
 *
 * On a device without the native module — Expo Go, Jest, or hardware that
 * reports no EQ implementation — `supported` is false and the UI hides itself.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EqualizerInfo,
  getBandLevels,
  getEqualizerInfo,
  isAudioEffectsSupported,
  resetAudioEffects,
  setBandLevels,
  setGainMb,
} from '../services/audio/audioEffects';
import {
  EQ_PRESETS,
  EqPresetId,
  gainPercentToMb,
  resolveActiveBands,
  usePlaybackSettings,
} from '../store/playbackSettingsStore';

export interface AudioEffectsController {
  /** False when the device cannot run audio effects at all. */
  supported: boolean;
  info: EqualizerInfo;
  /** Band gains currently applied, in millibels. */
  bands: number[];
  activePresetId: EqPresetId;
  /** Gain above unity, as a percentage where 100 is unchanged. */
  gainPercent: number;
  /** Band centre frequencies in Hz, for labelling the sliders. */
  centerFrequencies: number[];
  applyPreset: (id: EqPresetId) => void;
  /** Set one band by index; switches the selection to 'custom'. */
  setBand: (index: number, levelMb: number) => void;
  setGainPercent: (percent: number) => void;
  reset: () => void;
}

export const useAudioEffects = (): AudioEffectsController => {
  const eqPresetId = usePlaybackSettings((state) => state.eqPresetId);
  const customBands = usePlaybackSettings((state) => state.customBands);
  const gainPercent = usePlaybackSettings((state) => state.gainPercent);
  const setEqPreset = usePlaybackSettings((state) => state.setEqPreset);
  const setCustomBands = usePlaybackSettings((state) => state.setCustomBands);
  const setStoreGainPercent = usePlaybackSettings((state) => state.setGainPercent);
  const resetPlaybackSettings = usePlaybackSettings(
    (state) => state.resetPlaybackSettings
  );

  // Probed once. The answer cannot change while the process lives, and calling
  // into the native module on every render would be wasteful.
  const [info, setInfo] = useState<EqualizerInfo>(() => getEqualizerInfo());
  const supported = useMemo(() => isAudioEffectsSupported(), []);

  useEffect(() => {
    if (!supported) return;
    setInfo(getEqualizerInfo());
  }, [supported]);

  // Bands shown in the UI. Seeded from the store so the sliders are correct on
  // first paint, then kept in step with what the hardware actually accepted.
  const [bands, setBands] = useState<number[]>([]);

  const targetBands = useMemo(
    () => resolveActiveBands({ eqPresetId, customBands }, info.numberOfBands),
    [eqPresetId, customBands, info.numberOfBands]
  );

  useEffect(() => {
    if (!supported || info.numberOfBands === 0) return;
    let cancelled = false;
    void (async () => {
      await setBandLevels(targetBands);
      if (cancelled) return;
      // Read back rather than trusting the request: a device clamps to its own
      // range, and the UI should show what is actually in effect.
      const applied = getBandLevels();
      setBands(applied.length > 0 ? applied : targetBands);
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, info.numberOfBands, targetBands]);

  useEffect(() => {
    if (!supported) return;
    void setGainMb(gainPercentToMb(gainPercent));
  }, [supported, gainPercent]);

  const applyPreset = useCallback(
    (id: EqPresetId) => {
      // Selecting Flat must also clear a custom curve, otherwise the sliders
      // would spring back to the old values the next time one is touched.
      if (id === 'flat') setCustomBands([0, 0, 0, 0, 0]);
      setEqPreset(id);
    },
    [setEqPreset, setCustomBands]
  );

  const setBand = useCallback(
    (index: number, levelMb: number) => {
      const next = [...(bands.length > 0 ? bands : targetBands)];
      next[index] = levelMb;
      setBands(next);
      // Persist at the device's band count so the curve survives a restart.
      setCustomBands(next);
    },
    [bands, targetBands, setCustomBands]
  );

  const setGainPercent = useCallback(
    (percent: number) => {
      setStoreGainPercent(percent);
    },
    [setStoreGainPercent]
  );

  const reset = useCallback(() => {
    resetPlaybackSettings();
    setBands([]);
    void resetAudioEffects();
  }, [resetPlaybackSettings]);

  return {
    supported,
    info,
    bands: bands.length > 0 ? bands : targetBands,
    activePresetId: eqPresetId,
    gainPercent,
    centerFrequencies: info.centerFrequencies,
    applyPreset,
    setBand,
    setGainPercent,
    reset,
  };
};

/** Presets for the picker, in display order. */
export const audioPresets = EQ_PRESETS;
