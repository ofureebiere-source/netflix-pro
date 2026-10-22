// src/components/video/GestureSettingsModal.tsx
//
// Lets the viewer choose which half of the screen drives volume and which
// drives brightness, and offers the night-mode levels.
//
// The mapping is stored rather than hardcoded because the useful convention
// depends on the person: most players put brightness on the left, but someone
// holding the phone in one hand may want volume on the side their thumb
// reaches. Both halves can be set to the same action, which is a legitimate
// choice — it makes the whole screen control one thing.

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, getGlassTokens } from '../../theme/tokens';
import { GlassPanel, GlassButton } from '../glass';
import {
  NightModeTemperature,
  VerticalGestureAction,
  usePlaybackSettings,
} from '../../store/playbackSettingsStore';

interface GestureSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const NIGHT_MODES: NightModeTemperature[] = ['off', 'warm', 'warmer', 'warmest'];

const NIGHT_MODE_LABELS: Record<NightModeTemperature, string> = {
  off: 'Off',
  warm: 'Warm',
  warmer: 'Warmer',
  warmest: 'Warmest',
};

const GestureSettingsModal: React.FC<GestureSettingsModalProps> = ({ visible, onClose }) => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark, 'dark');

  const leftVerticalGesture = usePlaybackSettings((state) => state.leftVerticalGesture);
  const rightVerticalGesture = usePlaybackSettings((state) => state.rightVerticalGesture);
  const nightMode = usePlaybackSettings((state) => state.nightMode);
  const setLeftVerticalGesture = usePlaybackSettings((state) => state.setLeftVerticalGesture);
  const setRightVerticalGesture = usePlaybackSettings((state) => state.setRightVerticalGesture);
  const setNightMode = usePlaybackSettings((state) => state.setNightMode);

  const renderSide = (
    title: string,
    value: VerticalGestureAction,
    onChange: (action: VerticalGestureAction) => void
  ) => (
    <>
      <Text style={[TYPOGRAPHY.overline, { color: colors.textMuted, marginTop: SPACING.lg }]}>
        {title}
      </Text>
      <View style={styles.rowWrap}>
        <GlassButton
          label="Brightness"
          onPress={() => onChange('brightness')}
          overrideTint="dark"
          style={value === 'brightness' ? styles.selectedButton : undefined}
        />
        <GlassButton
          label="Volume"
          onPress={() => onChange('volume')}
          overrideTint="dark"
          style={value === 'volume' ? styles.selectedButton : undefined}
        />
      </View>
    </>
  );

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <GlassPanel style={styles.panel} overrideTint="dark">
            <View style={[styles.header, { borderBottomColor: glass.surfaceBorder }]}>
              <Text style={[TYPOGRAPHY.h3, { color: colors.text }]}>Gestures and Display</Text>
              <GlassButton
                icon={<Ionicons name="close" size={18} color={colors.text} />}
                onPress={onClose}
                size={32}
                overrideTint="dark"
              />
            </View>

            <View style={styles.body}>
              <Text style={[TYPOGRAPHY.caption, { color: colors.textMuted, marginTop: SPACING.lg }]}>
                Drag vertically on either half of the video to change that side's setting.
              </Text>

              {renderSide('Swipe left side', leftVerticalGesture, setLeftVerticalGesture)}
              {renderSide('Swipe right side', rightVerticalGesture, setRightVerticalGesture)}

              <Text style={[TYPOGRAPHY.overline, { color: colors.textMuted, marginTop: SPACING.xl }]}>
                Night mode
              </Text>
              <Text style={[TYPOGRAPHY.caption, { color: colors.textMuted, marginTop: SPACING.xs }]}>
                Warms the picture to reduce blue light.
              </Text>
              <View style={styles.rowWrap}>
                {NIGHT_MODES.map((mode) => (
                  <GlassButton
                    key={mode}
                    label={NIGHT_MODE_LABELS[mode]}
                    onPress={() => setNightMode(mode)}
                    overrideTint="dark"
                    style={nightMode === mode ? styles.selectedButton : undefined}
                  />
                ))}
              </View>
            </View>
          </GlassPanel>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: { width: 420, maxHeight: '85%' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  body: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  selectedButton: { borderColor: '#E50914' },
});

export default GestureSettingsModal;
