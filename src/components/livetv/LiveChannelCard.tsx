/**
 * A single live channel in the grid: cover art, name, and the state badges a
 * viewer needs before tapping.
 *
 * The badges are not decoration. A large share of the public catalogue is
 * geo-blocked or only part-time, and a channel that fails silently on tap reads
 * as a broken app — so the tile says so up front.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../contexts/ThemeContext';
import { OptimizedImage } from '../OptimizedImage';
import type { LiveChannel } from '../../services/iptv/iptvCatalog';

interface LiveChannelCardProps {
  channel: LiveChannel;
  onPress: (channel: LiveChannel) => void;
  onLongPress?: (channel: LiveChannel) => void;
  isFavourite?: boolean;
  /** The channel currently open in the player. */
  isPlaying?: boolean;
  width: number;
  height: number;
  labels: {
    geoBlocked: string;
    partTime: string;
  };
}

const LiveChannelCardComponent: React.FC<LiveChannelCardProps> = ({
  channel,
  onPress,
  onLongPress,
  isFavourite = false,
  isPlaying = false,
  width,
  height,
  labels,
}) => {
  const { colors } = useTheme();
  const [imageFailed, setImageFailed] = React.useState(false);
  const hasLogo = Boolean(channel.logo) && !imageFailed;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { width, height, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={() => onPress(channel)}
      onLongPress={onLongPress ? () => onLongPress(channel) : undefined}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={channel.name}
    >
      <View style={[styles.logoArea, { backgroundColor: colors.surfaceRaised }]}>
        {hasLogo ? (
          <OptimizedImage
            source={{ uri: channel.logo }}
            style={styles.logo}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          // No logo in the catalogue for this channel; show its initials rather
          // than an empty grey box.
          <Text style={[styles.initials, { color: colors.textMuted }]}>
            {channel.name.slice(0, 2).toUpperCase()}
          </Text>
        )}

        {isPlaying && (
          <View style={[styles.playingBadge, { backgroundColor: colors.accent }]}>
            <Ionicons name="play" size={10} color="#fff" />
          </View>
        )}

        {isFavourite && (
          <View style={styles.favouriteBadge}>
            <Ionicons name="star" size={12} color="#FACC15" />
          </View>
        )}

        {channel.quality && (
          <View style={styles.qualityBadge}>
            <Text style={styles.qualityText}>{channel.quality}</Text>
          </View>
        )}

        {(channel.isGeoBlocked || channel.isPartTime) && (
          <View style={styles.warnBadges}>
            {channel.isGeoBlocked && (
              <View style={styles.warnBadge}>
                <Ionicons name="lock-closed" size={9} color="#fff" />
                <Text style={styles.warnText} numberOfLines={1}>
                  {labels.geoBlocked}
                </Text>
              </View>
            )}
            {channel.isPartTime && (
              <View style={styles.warnBadge}>
                <Ionicons name="time-outline" size={9} color="#fff" />
                <Text style={styles.warnText} numberOfLines={1}>
                  {labels.partTime}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {channel.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  logoArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontSize: 26,
    fontWeight: '700',
  },
  playingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favouriteBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  qualityBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  qualityText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  warnBadges: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    gap: 2,
  },
  warnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 110,
  },
  warnText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  name: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
});

/** Memoised: the grid re-renders on scroll and most tiles are unchanged. */
export const LiveChannelCard = memo(LiveChannelCardComponent);

export default LiveChannelCard;
