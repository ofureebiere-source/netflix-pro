/**
 * The colour scheme follows the device and nothing else.
 *
 * These exercise `themeForScheme`, the single rule the provider and the hook
 * both go through, so the behaviour is pinned without needing a renderer.
 */

import { themeForScheme } from '../ThemeContext';

describe('themeForScheme', () => {
  it('is dark on a dark device', () => {
    const { isDark, colors } = themeForScheme('dark');
    expect(isDark).toBe(true);
    expect(colors.background).toBe('#000000');
  });

  it('is light on a light device, with the accent-blue glass palette', () => {
    const { isDark, colors } = themeForScheme('light');
    expect(isDark).toBe(false);
    expect(colors.background).toBe('#FFFFFF');
    expect(colors.accent).toBe('#2563EB');
    // Glassmorphism: translucent white surfaces with a blue-tinted hairline.
    expect(colors.surfaceGlass).toMatch(/^rgba\(255,255,255/);
    expect(colors.surfaceGlassBorder).toMatch(/^rgba\(37,99,235/);
    expect(colors.tabBarBackground).toMatch(/^rgba\(255,255,255/);
  });

  it('falls back to dark when the device has not reported a scheme', () => {
    expect(themeForScheme(null).isDark).toBe(true);
    expect(themeForScheme(undefined).isDark).toBe(true);
  });

  it('keeps the player black in both themes', () => {
    expect(themeForScheme('light').colors.playerBackground).toBe('#000000');
    expect(themeForScheme('dark').colors.playerBackground).toBe('#000000');
  });
});
