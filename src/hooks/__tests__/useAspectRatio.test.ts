/**
 * Guards the aspect-ratio resolution and the preset list.
 *
 * The fixed ratios are the part worth testing. `contentFit` alone cannot
 * un-letterbox a source that was framed for a different shape, so those presets
 * have to hand the player a surface ratio as well — and a preset that quietly
 * resolved to `contain` with no `aspectRatio` would look like it did nothing.
 */
import {
  ASPECT_RATIO_LABELS,
  ASPECT_RATIO_MODES,
  resolveAspectRatio,
} from '../useAspectRatio';

describe('resolveAspectRatio', () => {
  it('pins the surface and contains the video for a fixed ratio', () => {
    expect(resolveAspectRatio('16:9')).toEqual({ contentFit: 'contain', aspectRatio: 16 / 9 });
    expect(resolveAspectRatio('4:3')).toEqual({ contentFit: 'contain', aspectRatio: 4 / 3 });
    expect(resolveAspectRatio('21:9')).toEqual({ contentFit: 'contain', aspectRatio: 21 / 9 });
  });

  it('passes fill and stretch straight through with no surface ratio', () => {
    // These stretch the video to the surface, so constraining the surface would
    // defeat the point.
    expect(resolveAspectRatio('cover')).toEqual({ contentFit: 'cover' });
    expect(resolveAspectRatio('fill')).toEqual({ contentFit: 'fill' });
  });

  it('defaults to contain', () => {
    expect(resolveAspectRatio('auto')).toEqual({ contentFit: 'contain' });
    expect(resolveAspectRatio('contain')).toEqual({ contentFit: 'contain' });
  });

  it('gives every fixed preset a usable surface ratio', () => {
    for (const mode of ASPECT_RATIO_MODES) {
      if (mode.includes(':')) {
        expect(resolveAspectRatio(mode).aspectRatio).toBeGreaterThan(0);
      }
    }
  });
});

describe('aspect ratio presets', () => {
  it('offers the fixed ratios in the picker', () => {
    expect(ASPECT_RATIO_MODES).toEqual(expect.arrayContaining(['16:9', '4:3', '21:9']));
  });

  it('labels every mode it offers', () => {
    // An unlabelled mode would render an empty pill in the picker.
    for (const mode of ASPECT_RATIO_MODES) {
      expect(ASPECT_RATIO_LABELS[mode]).toBeTruthy();
    }
  });
});
