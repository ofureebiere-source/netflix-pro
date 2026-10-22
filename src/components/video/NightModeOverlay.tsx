import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * A translucent warm tint drawn over the video to cut blue light.
 *
 * Implemented in JS rather than as a colour-matrix filter on the player for two
 * reasons: `expo-video` exposes no filter hook, and a view-level overlay costs
 * nothing on the GPU while still removing the short-wavelength light that makes
 * a bright frame uncomfortable at night.
 *
 * `pointerEvents="none"` keeps every gesture — seek, volume, brightness, lock —
 * working through it.
 */

export type NightModeLevel = 'off' | 'warm' | 'warmer' | 'warmest';

/**
 * Tint and strength per level. The colour stays in the amber range as intensity
 * rises rather than darkening, because dimming the picture is a different
 * control and doing both at once would make the levels hard to tell apart.
 */
const LEVELS: Record<Exclude<NightModeLevel, 'off'>, { color: string; opacity: number }> = {
  warm: { color: '#FFB347', opacity: 0.08 },
  warmer: { color: '#FF9A2E', opacity: 0.16 },
  warmest: { color: '#FF8412', opacity: 0.26 },
};

interface NightModeOverlayProps {
  level: NightModeLevel;
}

const NightModeOverlay = memo(({ level }: NightModeOverlayProps) => {
  if (level === 'off') return null;
  const config = LEVELS[level];
  if (!config) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: config.color, opacity: config.opacity },
      ]}
    />
  );
});

export default NightModeOverlay;
