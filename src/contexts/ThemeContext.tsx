// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useAppStore } from '../store/zustand/store';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  backgroundGradient: string[];
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

// The reference ships a single fixed dark scheme — no light mode, no toggle.
// Rather than delete the light palette outright (it is still reachable through
// the Settings toggle), it is flattened onto the same neutral ramp so the app
// reads as one product in either mode: white surfaces, zinc borders, the same
// brand red. The previous blue glassmorphism is gone.
const LIGHT_THEME: ThemeColors = {
  background: '#FFFFFF',
  backgroundGradient: ['#FFFFFF', '#FAFAFA', '#FFFFFF'],
  surface: '#FAFAFA',
  surfaceRaised: '#F4F4F5',
  surfaceHigh: '#E4E4E7',
  surfaceGlass: 'rgba(0,0,0,0.03)',
  surfaceGlassBorder: 'rgba(0,0,0,0.08)',
  text: '#09090b',
  textSub: '#52525b',
  textMuted: '#a1a1aa',
  textInverse: '#FFFFFF',
  accent: '#E50914',
  accentDim: 'rgba(229, 9, 20, 0.4)',
  accentFill: 'rgba(229, 9, 20, 0.08)',
  accentFillStrong: 'rgba(229, 9, 20, 0.14)',
  border: '#E4E4E7',
  borderAccent: 'rgba(229, 9, 20, 0.25)',
  success: '#059669',
  error: '#DC2626',
  warning: '#D97706',
  info: '#3B82F6',
  playerBackground: '#000000',
  playerGradientStart: '#1A1A1A',
  playerGradientMiddle: '#0D0D0D',
  playerGradientEnd: '#000000',
  sliderTrack: 'rgba(0, 0, 0, 0.12)',
  sliderThumb: '#E50914',
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#E50914',
  tabBarInactive: '#71717a',
  watermarkOpacity: 0.04,
  shadowColor: 'rgba(0, 0, 0, 0.15)',
  glassBlur: 30,
};

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deviceTheme = useColorScheme();
  const { theme: mode, setTheme, toggleTheme } = useAppStore();

  const colors = useMemo(() => {
    if (mode === 'system') {
      return deviceTheme === 'dark' ? DARK_THEME : LIGHT_THEME;
    }
    return mode === 'dark' ? DARK_THEME : LIGHT_THEME;
  }, [mode, deviceTheme]);

  const isDark = useMemo(() => {
    if (mode === 'system') return deviceTheme === 'dark';
    return mode === 'dark';
  }, [mode, deviceTheme]);

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark, setMode: setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: 'dark',
      colors: DARK_THEME,
      isDark: true,
      setMode: () => {},
      toggleTheme: () => {},
    };
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