import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';

export interface SubtitleAppearance {
  fontScale?: number;
  backgroundOpacity?: number;
  weight?: 'normal' | 'bold';
  color?: string;
  outlineWidth?: number;
  /** Percentage from the top of the video; higher moves the text down. */
  verticalPosition?: number;
  fontFamily?: string | null;
}

interface SubtitleOverlayProps extends SubtitleAppearance {
  subtitlesEnabled: boolean;
  currentSubtitleText: string;
}

const BASE_FONT_SIZE = Platform.OS === 'android' ? 16 : 18;

const SubtitleOverlay = memo(({
  subtitlesEnabled,
  currentSubtitleText,
  fontScale = 1.0,
  backgroundOpacity = 0.65,
  weight = 'normal',
  color = '#FFFFFF',
  outlineWidth = 0,
  verticalPosition = 90,
  fontFamily = null,
}: SubtitleOverlayProps) => {
  if (!subtitlesEnabled || !currentSubtitleText) return null;

  // The outline is a hard dark shadow offset in two directions, which reads as
  // an outline rather than a drop shadow and is what keeps light text legible
  // over a bright frame. Radius is deliberately 0 so the offset does the work;
  // a blurred shadow at these sizes just smears the glyph edges.
  const outline = outlineWidth > 0
    ? {
        textShadowColor: 'rgba(0, 0, 0, 1)',
        textShadowOffset: { width: outlineWidth, height: outlineWidth },
        textShadowRadius: 0,
      }
    : {
        textShadowColor: 'rgba(0, 0, 0, 0.9)',
        textShadowOffset: { width: 1, height: 1.5 },
        textShadowRadius: 2,
      };

  const textStyle = {
    fontSize: BASE_FONT_SIZE * fontScale,
    fontWeight: weight,
    color,
    fontFamily: fontFamily ?? undefined,
    ...outline,
  } as const;

  // Anchored to the top and offset down by the requested percentage, so the
  // text's own height does not shift where it lands — a bottom-anchored
  // equivalent would move as the number of lines changed.
  const containerStyle: StyleProp<ViewStyle> = {
    ...styles.subtitleTextContainer,
    top: `${verticalPosition}%` as `${number}%`,
  };

  // backgroundOpacity === 0 means "no background" — skip the blur
  // entirely and just render text with a shadow for legibility, since a
  // 0-intensity BlurView would still draw a faint tinted pill.
  if (backgroundOpacity <= 0.02) {
    return (
      <View style={containerStyle} pointerEvents="none">
        <Text style={[styles.subtitleText, textStyle, { backgroundColor: 'transparent' }]}>
          {currentSubtitleText}
        </Text>
      </View>
    );
  }

  return (
    <View style={containerStyle} pointerEvents="none">
      <BlurView
        intensity={30 * backgroundOpacity}
        tint="dark"
        style={styles.subtitleBlurPill}
      >
        <Text style={[styles.subtitleText, textStyle]}>
          {currentSubtitleText}
        </Text>
      </BlurView>
    </View>
  );
});

const styles = StyleSheet.create({
  subtitleTextContainer: {
    position: 'absolute',
    left: '5%',
    right: '5%',
    alignItems: 'center',
    zIndex: 7,
    pointerEvents: 'none',
  },
  subtitleBlurPill: {
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  subtitleText: {
    textAlign: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    elevation: 1,
    overflow: 'hidden',
  },
});

export default SubtitleOverlay;
