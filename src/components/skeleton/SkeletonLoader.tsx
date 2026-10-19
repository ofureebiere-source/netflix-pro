// src/components/skeleton/SkeletonLoader.tsx
import React from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS } from '../../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonLoaderProps {
  type: 'trending' | 'album' | 'mix' | 'channel' | 'podcast' | 'radio' | 'grid' | 'card';
  count?: number;
  showIcon?: boolean;
  // Optional size override for the 'album'/'mix'/'grid' card shape, so a
  // caller can match a specific real-card size instead of the fixed
  // 130x170 default (e.g. to line up with MediaCard's own computed grid
  // dimensions). Ignored by other types.
  width?: number;
  height?: number;
}

// Shared shimmer sweep, used by every skeleton shape below. A base solid
// color block, with a soft light band drifting left-to-right on a loop —
// this is what makes it read as "loading shimmer" rather than a flat
// pulsing color swap. Each shape wraps its own base fill + this sweep in
// a `overflow: 'hidden'` container so the band clips to the shape.
const ShimmerSweep: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const translateX = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [translateX]);

  // Sweeps across roughly 2.5x the screen width so it comfortably
  // crosses shapes of any size used in this file, from small thumbnails
  // to full-width rows.
  const sweepWidth = SCREEN_WIDTH * 1.5;
  const translateXInterpolated = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [-sweepWidth, sweepWidth],
  });

  return (
    <Animated.View
      style={[
        styles.sweepBase,
        { width: sweepWidth, transform: [{ translateX: translateXInterpolated }] },
      ]}
    >
      <LinearGradient
        colors={
          isDark
            ? ['transparent', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.06)', 'transparent']
            : ['transparent', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.3)', 'transparent']
        }
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

// A single skeleton shape: solid base color + the shimmer sweep clipped
// to its bounds. `style` carries size/radius/margins for the specific
// shape being rendered (thumbnail, title bar, card image, etc).
const ShimmerBlock: React.FC<{ style: any; isDark: boolean }> = ({ style, isDark }) => (
  <View style={[style, styles.shimmerClip, { backgroundColor: isDark ? '#1E1E1E' : '#E4E4E4' }]}>
    <ShimmerSweep isDark={isDark} />
  </View>
);

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type, width, height }) => {
  const { isDark } = useTheme();

  if (type === 'trending') {
    return (
      <View style={styles.trendingRow}>
        <View style={styles.trendingLeft}>
          <ShimmerBlock style={styles.trendingThumbnail} isDark={isDark} />
          <View style={styles.trendingInfo}>
            <ShimmerBlock style={[styles.titleSkeleton, { width: 150 }]} isDark={isDark} />
            <ShimmerBlock style={[styles.artistSkeleton, { width: 100 }]} isDark={isDark} />
          </View>
        </View>
      </View>
    );
  }

  if (type === 'album' || type === 'mix' || type === 'grid') {
    return (
      <View style={[styles.albumCard, width != null && { width }, height != null && { height }]}>
        <ShimmerBlock style={styles.albumImage} isDark={isDark} />
        <View style={styles.albumOverlay}>
          <ShimmerBlock style={[styles.titleSkeleton, { width: 80 }]} isDark={isDark} />
          <ShimmerBlock style={[styles.artistSkeleton, { width: 60 }]} isDark={isDark} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <ShimmerBlock style={styles.cardImage} isDark={isDark} />
      <ShimmerBlock style={[styles.cardTitle, { width: '70%' }]} isDark={isDark} />
      <ShimmerBlock style={[styles.cardSubtitle, { width: '50%' }]} isDark={isDark} />
    </View>
  );
};

export const SkeletonList: React.FC<{ type: SkeletonLoaderProps['type']; count: number }> = ({ type, count }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonLoader key={index} type={type} />
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  sweepBase: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  shimmerClip: {
    overflow: 'hidden',
  },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.md,
    padding: 10,
  },
  trendingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trendingThumbnail: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.sm,
  },
  trendingInfo: {
    flex: 1,
    marginLeft: 10,
    gap: 4,
  },
  albumCard: {
    width: 130,
    height: 170,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginRight: 10,
  },
  albumImage: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  albumOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    gap: 4,
  },
  card: {
    width: 160,
    marginRight: 12,
  },
  cardImage: {
    width: '100%',
    height: 100,
    borderRadius: RADIUS.sm,
  },
  cardTitle: {
    height: 14,
    borderRadius: RADIUS.xs,
    marginTop: 8,
  },
  cardSubtitle: {
    height: 11,
    borderRadius: RADIUS.xs,
    marginTop: 4,
  },
  titleSkeleton: {
    height: 14,
    borderRadius: RADIUS.xs,
  },
  artistSkeleton: {
    height: 12,
    borderRadius: RADIUS.xs,
  },
});


export default SkeletonLoader;
