// src/components/video/AudioEffectsModal.tsx
//
// Equaliser and volume amplifier, in the spirit of MX Player's audio panel.
//
// Every control here writes through `useAudioEffects`, which pushes the change
// to the native audio chain and persists it. When the device has no usable
// audio effects the whole panel is replaced by a short explanation rather than
// showing sliders that do nothing.

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, getGlassTokens } from '../../theme/tokens';
import { GlassPanel, GlassButton } from '../glass';
import {
  AudioEffectsController,
  audioPresets,
} from '../../hooks/useAudioEffects';
import {
  GAIN_WARNING_PERCENT,
  MAX_GAIN_PERCENT,
  MIN_GAIN_PERCENT,
} from '../../store/playbackSettingsStore';

interface AudioEffectsModalProps {
  visible: boolean;
  onClose: () => void;
  controller: AudioEffectsController;
}

/** 1000 Hz reads better than 1000; band labels are centre frequencies. */
const formatFrequency = (hz: number): string =>
  hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}k` : `${hz}`;

const AudioEffectsModal: React.FC<AudioEffectsModalProps> = ({
  visible,
  onClose,
  controller,
}) => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark, 'dark');

  const {
    supported,
    info,
    bands,
    activePresetId,
    gainPercent,
    centerFrequencies,
    applyPreset,
    setBand,
    setGainPercent,
    reset,
  } = controller;

  const gainIsLoud = gainPercent >= GAIN_WARNING_PERCENT;

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
              <Text style={[TYPOGRAPHY.h3, { color: colors.text }]}>Audio</Text>
              <GlassButton
                icon={<Ionicons name="close" size={18} color={colors.text} />}
                onPress={onClose}
                size={32}
                overrideTint="dark"
              />
            </View>

            {!supported ? (
              <View style={styles.unsupported}>
                <Ionicons name="volume-mute-outline" size={32} color={colors.textMuted} />
                <Text style={[TYPOGRAPHY.body, styles.unsupportedText, { color: colors.textMuted }]}>
                  This device does not support audio effects, so the equaliser and
                  volume amplifier are unavailable.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.body}
                contentContainerStyle={{ paddingBottom: SPACING.lg }}
              >
                <Text style={[TYPOGRAPHY.overline, { color: colors.textMuted, marginTop: SPACING.lg }]}>
                  Equaliser
                </Text>
                <View style={styles.rowWrap}>
                  {audioPresets.map((preset) => {
                    const selected = activePresetId === preset.id;
                    return (
                      <GlassButton
                        key={preset.id}
                        label={preset.id.charAt(0).toUpperCase() + preset.id.slice(1)}
                        onPress={() => applyPreset(preset.id)}
                        overrideTint="dark"
                        style={selected ? styles.selectedButton : undefined}
                      />
                    );
                  })}
                  {activePresetId === 'custom' && (
                    <GlassButton label="Custom" onPress={() => {}} overrideTint="dark" style={styles.selectedButton} />
                  )}
                </View>

                <View style={styles.bandList}>
                  {bands.map((level, index) => {
                    const frequency = centerFrequencies[index];
                    return (
                      <View key={index} style={styles.bandRow}>
                        <Text style={[TYPOGRAPHY.caption, styles.bandLabel, { color: colors.textMuted }]}>
                          {frequency !== undefined ? `${formatFrequency(frequency)} Hz` : `Band ${index + 1}`}
                        </Text>
                        <Slider
                          style={styles.slider}
                          minimumValue={info.minLevelMb}
                          maximumValue={info.maxLevelMb}
                          step={100}
                          value={level}
                          onValueChange={(value) => setBand(index, Math.round(value))}
                          minimumTrackTintColor="#E50914"
                          maximumTrackTintColor={glass.surfaceBorder}
                          thumbTintColor="#E50914"
                        />
                        <Text style={[TYPOGRAPHY.caption, styles.bandValue, { color: colors.text }]}>
                          {level > 0 ? '+' : ''}{(level / 100).toFixed(1)} dB
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <Text style={[TYPOGRAPHY.overline, { color: colors.textMuted, marginTop: SPACING.xl }]}>
                  Volume Amplifier
                </Text>
                <View style={styles.bandRow}>
                  <Text style={[TYPOGRAPHY.caption, styles.bandLabel, { color: colors.textMuted }]}>
                    {gainPercent}%
                  </Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={MIN_GAIN_PERCENT}
                    maximumValue={MAX_GAIN_PERCENT}
                    step={5}
                    value={gainPercent}
                    onValueChange={(value) => setGainPercent(Math.round(value))}
                    minimumTrackTintColor={gainIsLoud ? '#e8a838' : '#E50914'}
                    maximumTrackTintColor={glass.surfaceBorder}
                    thumbTintColor={gainIsLoud ? '#e8a838' : '#E50914'}
                  />
                  <Text style={[TYPOGRAPHY.caption, styles.bandValue, { color: colors.text }]}>
                    {gainPercent > MIN_GAIN_PERCENT ? `+${((gainPercent - 100) / 10).toFixed(0)} dB` : 'Off'}
                  </Text>
                </View>

                {gainIsLoud && (
                  <View style={styles.warning}>
                    <Ionicons name="warning-outline" size={16} color="#e8a838" />
                    <Text style={[TYPOGRAPHY.caption, styles.warningText]}>
                      Loud amplification can distort. Lower it if you hear crackling.
                    </Text>
                  </View>
                )}

                <TouchableOpacity style={styles.resetButton} onPress={reset}>
                  <Ionicons name="refresh" size={16} color="#E50914" />
                  <Text style={[TYPOGRAPHY.body, { color: '#E50914', marginLeft: SPACING.sm }]}>
                    Reset to defaults
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
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
  panel: { width: 460, maxHeight: '85%' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  body: { paddingHorizontal: SPACING.lg },
  unsupported: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  unsupportedText: { textAlign: 'center' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  selectedButton: { borderColor: '#E50914' },
  bandList: { marginTop: SPACING.lg },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  bandLabel: { width: 60 },
  bandValue: { width: 62, textAlign: 'right' },
  slider: { flex: 1, height: 36 },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  warningText: { color: '#e8a838', flex: 1 },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
    padding: SPACING.sm,
  },
});

export default AudioEffectsModal;
