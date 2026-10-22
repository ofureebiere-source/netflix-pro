/**
 * Guards the equaliser maths and the bridge's behaviour without a native module.
 *
 * The resampling is the part worth testing: a preset curve is authored for a
 * nominal five-band device, but hardware reports anywhere from three to ten
 * bands. Getting this wrong does not crash — it quietly applies the wrong curve,
 * which is the kind of bug that ships.
 */
import {
  EQ_PRESETS,
  MAX_GAIN_PERCENT,
  MIN_GAIN_PERCENT,
  gainPercentToMb,
  resolveActiveBands,
  resolvePresetBands,
} from '../../store/playbackSettingsStore';
import {
  getEqualizerInfo,
  isAudioEffectsSupported,
  resetAudioEffects,
  setBandLevels,
  setGainMb,
} from './audioEffects';

describe('resolvePresetBands', () => {
  const bass = EQ_PRESETS.find((preset) => preset.id === 'bass')!.bands!;

  it('returns one zero per band for a flat preset', () => {
    expect(resolvePresetBands(null, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(resolvePresetBands(null, 3)).toEqual([0, 0, 0]);
  });

  it('passes the curve through unchanged when the band counts match', () => {
    expect(resolvePresetBands(bass, bass.length)).toEqual(bass);
  });

  it('spans the whole curve across a device with more bands', () => {
    const tenBands = resolvePresetBands(bass, 10);
    expect(tenBands).toHaveLength(10);
    // The endpoints must still be the curve's endpoints. A naive index-by-index
    // copy would put the bass peak at band 2 and leave the top half silent,
    // which is what this asserts against.
    expect(tenBands[0]).toBe(bass[0]);
    expect(tenBands[9]).toBe(bass[bass.length - 1]);
    // The peak must not be diluted by interpolation.
    expect(Math.max(...tenBands)).toBe(Math.max(...bass));
  });

  it('keeps the low, middle and high points on a three-band device', () => {
    const threeBands = resolvePresetBands(bass, 3);
    expect(threeBands).toEqual([bass[0], bass[2], bass[4]]);
  });

  it('handles a single-band device without dividing by zero', () => {
    expect(resolvePresetBands(bass, 1)).toEqual([bass[0]]);
  });

  it('returns nothing for a device that reports no bands', () => {
    expect(resolvePresetBands(bass, 0)).toEqual([]);
  });
});

describe('resolveActiveBands', () => {
  it('uses the named preset when one is selected', () => {
    const loudness = EQ_PRESETS.find((preset) => preset.id === 'loudness')!.bands!;
    expect(resolveActiveBands({ eqPresetId: 'loudness', customBands: [9, 9, 9, 9, 9] }, 5))
      .toEqual(loudness);
  });

  it('uses the custom curve when the preset is custom', () => {
    const custom = [300, 0, 0, 0, -300];
    expect(resolveActiveBands({ eqPresetId: 'custom', customBands: custom }, 5))
      .toEqual(custom);
  });

  it('flattens when flat is selected even with a custom curve stored', () => {
    expect(resolveActiveBands({ eqPresetId: 'flat', customBands: [500, 500, 500, 500, 500] }, 5))
      .toEqual([0, 0, 0, 0, 0]);
  });
});

describe('gainPercentToMb', () => {
  it('maps unity to no gain', () => {
    expect(gainPercentToMb(MIN_GAIN_PERCENT)).toBe(0);
  });

  it('maps each further 100 percent to ten decibels', () => {
    expect(gainPercentToMb(200)).toBe(1000);
    expect(gainPercentToMb(300)).toBe(2000);
  });

  it('clamps below unity to zero rather than attenuating', () => {
    // The amplifier only boosts; attenuation is the device volume's job.
    expect(gainPercentToMb(50)).toBe(0);
  });

  it('clamps above the ceiling', () => {
    expect(gainPercentToMb(9999)).toBe(gainPercentToMb(MAX_GAIN_PERCENT));
  });
});

describe('audioEffects bridge without the native module', () => {
  it('reports unsupported instead of throwing', () => {
    expect(isAudioEffectsSupported()).toBe(false);
  });

  it('returns an unavailable descriptor the UI can branch on', () => {
    expect(getEqualizerInfo().available).toBe(false);
    expect(getEqualizerInfo().numberOfBands).toBe(0);
  });

  it('swallows writes rather than rejecting', async () => {
    await expect(setBandLevels([100, 200])).resolves.toBeUndefined();
    await expect(setGainMb(1000)).resolves.toBeUndefined();
    await expect(resetAudioEffects()).resolves.toBeUndefined();
  });
});
