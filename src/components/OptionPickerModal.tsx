// src/components/OptionPickerModal.tsx
//
// Single-choice picker used by the Settings rows. The rows previously rendered
// a TouchableOpacity with no onPress, so tapping "Default Quality" or "Subtitle
// Language" did nothing at all — the value was displayed but unreachable.
import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, getGlassTokens } from '../theme/tokens';
import { GlassPanel, GlassButton } from './glass';

export interface PickerOption {
  value: string;
  label: string;
}

interface OptionPickerModalProps {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

const OptionPickerModal: React.FC<OptionPickerModalProps> = ({
  visible, title, options, selected, onSelect, onClose,
}) => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark, 'dark');

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <GlassPanel style={styles.panel} overrideTint="dark">
            <View style={[styles.header, { borderBottomColor: glass.surfaceBorder }]}>
              <Text style={[TYPOGRAPHY.h3, { color: colors.text }]}>{title}</Text>
              <GlassButton
                icon={<Ionicons name="close" size={18} color={colors.text} />}
                onPress={onClose}
                size={32}
                overrideTint="dark"
              />
            </View>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {options.map((option) => {
                const isSelected = option.value === selected;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.option, isSelected && { backgroundColor: 'rgba(229, 9, 20, 0.12)' }]}
                    onPress={() => {
                      onSelect(option.value);
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[TYPOGRAPHY.body, { color: colors.text }]}>{option.label}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#E50914" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </GlassPanel>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: { width: 320, maxHeight: '80%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { maxHeight: 400 },
  bodyContent: { paddingVertical: SPACING.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
});

export default OptionPickerModal;
