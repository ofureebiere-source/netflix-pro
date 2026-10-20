// src/components/video/ServerSheet.tsx
//
// Server (provider) switcher for the player — the app's counterpart to the
// website's ProviderBar.
//
// The backend resolves every provider concurrently and returns all of them, but
// the player previously auto-picked `sources[0]` with no way to change it, so a
// provider that resolved but then failed to play left the viewer stuck. This
// sheet lists every resolved source and switches between them.
//
// Rows are grouped the way the reference's server menu reads: the provider
// label, the quality badge the server normalised, and the audio language the
// extractor reported. The active row is ticked.

import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, getGlassTokens } from '../../theme/tokens';
import { GlassPanel, GlassButton } from '../glass';
import type { LicensedPlaybackSource } from '../../services/licensedPlayback/LicensedPlaybackService';

interface ServerSheetProps {
  visible: boolean;
  onClose: () => void;
  sources: LicensedPlaybackSource[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** True while a freshly chosen provider is resolving. */
  loading?: boolean;
}

/** The label to show for a source: its provider, falling back to its name. */
const providerLabel = (source: LicensedPlaybackSource): string =>
  source.providerLabel || source.provider || source.name || 'Server';

const qualityBadge = (source: LicensedPlaybackSource): string | null =>
  source.qualityLabel || source.quality || null;

const ServerSheet: React.FC<ServerSheetProps> = ({
  visible, onClose, sources, activeIndex, onSelect, loading = false,
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
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.panelWrap}>
          <GlassPanel style={styles.panel} overrideTint="dark">
            <View style={[styles.header, { borderBottomColor: glass.surfaceBorder }]}>
              <View style={styles.headerText}>
                <Text style={[TYPOGRAPHY.h3, { color: colors.text }]}>Servers</Text>
                <Text style={[TYPOGRAPHY.caption, { color: colors.textSub }]}>
                  {sources.length > 0
                    ? `${sources.length} available — switch if playback stalls`
                    : 'No servers resolved for this title'}
                </Text>
              </View>
              <GlassButton
                icon={<Ionicons name="close" size={18} color={colors.text} />}
                onPress={onClose}
                size={32}
                overrideTint="dark"
              />
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {sources.map((source, index) => {
                const isActive = index === activeIndex;
                const quality = qualityBadge(source);
                return (
                  <TouchableOpacity
                    key={`${source.provider || source.name || 'source'}-${index}`}
                    style={[
                      styles.row,
                      { borderBottomColor: glass.surfaceBorder },
                      isActive && { backgroundColor: 'rgba(229, 9, 20, 0.12)' },
                    ]}
                    onPress={() => { onSelect(index); onClose(); }}
                    activeOpacity={0.7}
                    disabled={loading}
                  >
                    <View style={styles.rowText}>
                      <Text style={[TYPOGRAPHY.body, { color: colors.text }]} numberOfLines={1}>
                        {providerLabel(source)}
                      </Text>
                      <View style={styles.badges}>
                        {quality && (
                          <View style={[styles.badge, styles.qualityBadge]}>
                            <Text style={styles.qualityBadgeText}>{quality}</Text>
                          </View>
                        )}
                        {!!source.language && (
                          <View style={[styles.badge, styles.langBadge]}>
                            <Text style={styles.langBadgeText}>{source.language}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={20} color="#E50914" />}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelWrap: {
    width: '70%',
    maxWidth: 480,
    maxHeight: '80%',
  },
  panel: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    paddingVertical: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  qualityBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  qualityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FCD34D',
  },
  langBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.35)',
  },
  langBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D8B4FE',
  },
});

export default ServerSheet;
