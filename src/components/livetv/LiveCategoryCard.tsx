/**
 * A category tile on the Live TV landing grid.
 *
 * Carries the channel count because the count is what tells a viewer whether a
 * category is worth opening — `Interactive (2)` and `News (1,019)` are very
 * different propositions, and a tile that hides the difference wastes a tap.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../contexts/ThemeContext';

interface LiveCategoryCardProps {
  label: string;
  icon: string;
  channelCount: number;
  countLabel: string;
  onPress: () => void;
  width: number;
  height: number;
}

const LiveCategoryCardComponent: React.FC<LiveCategoryCardProps> = ({
  label,
  icon,
  channelCount,
  countLabel,
  onPress,
  width,
  height,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { width, height, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${channelCount} ${countLabel}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.accentFill }]}>
        <Ionicons name={icon as any} size={22} color={colors.accent} />
      </View>
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.count, { color: colors.textMuted }]} numberOfLines={1}>
        {channelCount.toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 12,
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  count: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
});

export const LiveCategoryCard = memo(LiveCategoryCardComponent);

export default LiveCategoryCard;
