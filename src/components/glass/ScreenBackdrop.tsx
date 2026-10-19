// src/components/glass/ScreenBackdrop.tsx
//
// The app-wide page backdrop: the accent-blue gradient in light mode, a flat
// black in dark. Rendered once behind the router's Stack in app/_layout.tsx,
// so every screen can leave its own root transparent and let this show
// through — screens that painted `colors.background` opaquely used to hide the
// gradient and each needed their own copy of it.
//
// Pointer-events are off: this is purely decorative and must never swallow a
// touch aimed at the screen in front of it.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

const ScreenBackdrop: React.FC = () => {
  const { colors, isDark } = useTheme();

  if (isDark) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />;
  }

  return (
    <LinearGradient
      pointerEvents="none"
      colors={colors.backgroundGradient}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
};

export default ScreenBackdrop;
