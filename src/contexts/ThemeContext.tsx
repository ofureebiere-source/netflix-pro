// src/contexts/ThemeContext.tsx
import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  backgroundGradient: readonly [string, string, ...string[]];
  surface: string;
  surfaceRaised: string;
  surfaceHigh: string;
  surfaceGlass: string;
  surfaceGlassBorder: string;
  text: string;
  textSub: string;
  textMuted: string;
  textInverse: string;
  accent: string;
  accentDim: string;
  accentFill: string;
  accentFillStrong: string;
  border: string;
  borderAccent: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  playerBackground: string;
  playerGradientStart: string;
  playerGradientMiddle: string;
  playerGradientEnd: string;
  sliderTrack: string;
  sliderThumb: string;
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
  watermarkOpacity: number;
  shadowColor: string;
  glassBlur: number;
}

// ── frameXTV palette ────────────────────────────────────────────────────────
// Sourced from framextv.xyz's compiled :root:
//   --bg-primary:#000 --bg-secondary:#09090b --bg-card:#121215
//   --border-color:#27272a --border-hover:#3f3f46
//   --text-main:#fff --text-muted:#a1a1aa --accent-white:#fff
// The accent is the brand red (#E50914) that the player surfaces already
// used, not gold — gold appears nowhere in the reference.
const DARK_THEME: ThemeColors = {
  background: '#000000',
  backgroundGradient: ['#000000', '#09090b', '#000000'],
  surface: '#09090b',
  surfaceRaised: '#121215',
  surfaceHigh: '#1c1c1f',
  surfaceGlass: 'rgba(255,255,255,0.05)',
  surfaceGlassBorder: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  textSub: '#a1a1aa',
  textMuted: '#71717a',
  textInverse: '#000000',
  accent: '#E50914',
  accentDim: 'rgba(229, 9, 20, 0.4)',
  accentFill: 'rgba(229, 9, 20, 0.1)',
  accentFillStrong: 'rgba(229, 9, 20, 0.15)',
  border: '#27272a',
  borderAccent: 'rgba(229, 9, 20, 0.22)',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  playerBackground: '#000000',
  playerGradientStart: '#1A1A1A',
  playerGradientMiddle: '#0D0D0D',
  playerGradientEnd: '#000000',
  sliderTrack: 'rgba(255, 255, 255, 0.25)',
  sliderThumb: '#E50914',
  tabBarBackground: '#09090b',
  tabBarActive: '#E50914',
  tabBarInactive: '#a1a1aa',
  watermarkOpacity: 0.08,
  shadowColor: 'rgba(0,0,0,0.5)',
  glassBlur: 20,
};

// Light follows the device. It is an accent-blue gradient over white with
// glassmorphism surfaces: translucent panels the gradient shows through, and
// blue as the one strong colour. The brand red stays on the wordmark only.
const LIGHT_THEME: ThemeColors = {
  background: '#FFFFFF',
  // Soft accent-blue wash, brightest at the top of the screen.
  backgroundGradient: ['#EEF4FF', '#FFFFFF', '#E8F0FF'],
  surface: 'rgba(255,255,255,0.62)',
  surfaceRaised: 'rgba(255,255,255,0.72)',
  surfaceHigh: 'rgba(255,255,255,0.86)',
  // Frosted panels: translucent white plus the blue-tinted hairline that
  // reads as glass over the gradient rather than a flat card.
  surfaceGlass: 'rgba(255,255,255,0.62)',
  surfaceGlassBorder: 'rgba(37,99,235,0.16)',
  text: '#0b1220',
  textSub: '#475569',
  textMuted: '#94a3b8',
  textInverse: '#FFFFFF',
  accent: '#2563EB',
  accentDim: 'rgba(37, 99, 235, 0.4)',
  accentFill: 'rgba(37, 99, 235, 0.10)',
  accentFillStrong: 'rgba(37, 99, 235, 0.16)',
  border: 'rgba(37,99,235,0.16)',
  borderAccent: 'rgba(37, 99, 235, 0.28)',
  success: '#059669',
  error: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
  playerBackground: '#000000',
  playerGradientStart: '#1A1A1A',
  playerGradientMiddle: '#0D0D0D',
  playerGradientEnd: '#000000',
  sliderTrack: 'rgba(0, 0, 0, 0.12)',
  sliderThumb: '#2563EB',
  tabBarBackground: 'rgba(255,255,255,0.72)',
  tabBarActive: '#2563EB',
  tabBarInactive: '#64748b',
  watermarkOpacity: 0.04,
  shadowColor: 'rgba(37, 99, 235, 0.15)',
  glassBlur: 30,
};

interface ThemeContextValue {
  /** Always `system` — the theme follows the device and has no override. */
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Map a `useColorScheme()` result to a theme.
 *
 * Kept as a pure function so the rule is testable without a renderer, and
 * centralised so the provider and the hook can never disagree. Anything other
 * than an explicit `'light'` is dark — an unknown/absent scheme on a device
 * that has not reported yet should keep the app in its default dark look
 * rather than flash a light UI.
 */
export function themeForScheme(deviceTheme: 'light' | 'dark' | null | undefined): {
  isDark: boolean;
  colors: ThemeColors;
} {
  const isDark = deviceTheme !== 'light';
  return { isDark, colors: isDark ? DARK_THEME : LIGHT_THEME };
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // The device is the only source of truth. Nothing is read from or written to
  // the persisted store, so a stale saved choice can never override the phone:
  // `useColorScheme` re-renders on an OS flip and the whole tree follows.
  const { isDark, colors } = themeForScheme(useColorScheme());

  return (
    <ThemeContext.Provider value={{ mode: 'system', colors, isDark }}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { mode: 'system', colors: DARK_THEME, isDark: true };
  }
  return ctx;
};

export const useThemeColors = (): ThemeColors => {
  const { colors } = useTheme();
  return colors;
};

export const useIsDark = (): boolean => {
  const { isDark } = useTheme();
  return isDark;
};