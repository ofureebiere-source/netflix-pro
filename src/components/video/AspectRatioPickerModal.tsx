// src/components/video/AspectRatioPickerModal.tsx
//
// Explicit picker for the aspect ratio presets. The controls bar keeps its
// one-tap cycle button for the three common cases; this exists so the fixed
// ratios (16:9, 4:3, 21:9) are reachable without cycling through everything.

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, getGlassTokens } from '../../theme/tokens';
import { GlassPanel, GlassButton } from '../glass';
import {
  ASPECT_RATIO_LABELS,
  ASPECT_RATIO_MODES,
  AspectRatioMode,
} from '../../hooks/useAspectRatio';

interface AspectRatioPickerModalProps {
  visible: boolean;
  onClose: () => void;
  current: AspectRatioMode;
  onSelect: (mode: AspectRatioMode) => void;
}

const DESCRIPTIONS: Partial<Record<AspectRatioMode, string>> = {
  contain: 'Show the whole frame with bars.',
  cover: 'Fill the screen, cropping the edges.',
  fill: 'Stretch to fill, distorting the image.',
  '16:9': 'Force a widescreen frame.',
  '4:3': 'Force a classic television frame.',
  '21:9': 'Force an ultrawide cinema frame.',
};

const AspectRatioPickerModal: React.FC<AspectRatioPickerModalProps> = ({
  visible,
  onClose,
  current,
  onSelect,
}) => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark, 'dark');

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
              <Text style={[TYPOGRAPHY.h3, { color: colors.text }]}>Aspect Ratio</Text>
              <GlassButton
                icon={<Ionicons name="close" size={18} color={colors.text} />}
                onPress={onClose}
                size={32}
                overrideTint="dark"
              />
            </View>

            <View style={styles.list}>
              {ASPECT_RATIO_MODES.map((mode) => {
                const selected = current === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={styles.option}
                    onPress={() => {
                      onSelect(mode);
                      onClose();
                    }}
                  >
                    <View style={styles.optionText}>
                      <Text style={[TYPOGRAPHY.body, { color: selected ? '#E50914' : colors.text }]}>
                        {ASPECT_RATIO_LABELS[mode]}
                      </Text>
                      {DESCRIPTIONS[mode] && (
                        <Text style={[TYPOGRAPHY.caption, { color: colors.textMuted }]}>
                          {DESCRIPTIONS[mode]}
                        </Text>
                      )}
                    </View>
                    {selected && <Ionicons name="checkmark" size={18} color="#E50914" />}
                  </TouchableOpacity>
                );
              })}
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
  panel: { width: 380, maxHeight: '80%' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  list: { paddingVertical: SPACING.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  optionText: { flex: 1 },
});

export default AspectRatioPickerModal;
