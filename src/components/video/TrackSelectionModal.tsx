// src/components/video/TrackSelectionModal.tsx
//
// Quality (video) and audio-track picker. The options come from expo-video's
// own `availableVideoTracks` / `availableAudioTracks`, which the native player
// populates from the HLS master playlist — so the list is whatever the stream
// actually offers, never a hardcoded set. A title that resolves 4K lists 4K; a
// title that resolves only 480p lists 480p.
import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, getGlassTokens } from '../../theme/tokens';
import { GlassPanel, GlassButton } from '../glass';

export interface VideoTrackOption {
  id: string;
  height: number;
  label: string;
}

export interface AudioTrackOption {
  id: string;
  label: string;
}

interface TrackSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  videoTracks: VideoTrackOption[];
  audioTracks: AudioTrackOption[];
  /** Selected track id, or null for "Auto" (let the player adapt). */
  selectedVideoId: string | null;
  selectedAudioId: string | null;
  onSelectVideo: (id: string | null) => void;
  onSelectAudio: (id: string | null) => void;
}

const TrackSelectionModal: React.FC<TrackSelectionModalProps> = ({
  visible, onClose, videoTracks, audioTracks,
  selectedVideoId, selectedAudioId, onSelectVideo, onSelectAudio,
}) => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark, 'dark');

  const renderRow = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void
  ) => (
    <TouchableOpacity
      key={key}
      style={[styles.option, selected && { backgroundColor: 'rgba(229, 9, 20, 0.12)' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[TYPOGRAPHY.body, { color: colors.text }]}>{label}</Text>
      {selected && <Ionicons name="checkmark-circle" size={20} color="#E50914" />}
    </TouchableOpacity>
  );

  const hasVideo = videoTracks.length > 1;
  const hasAudio = audioTracks.length > 1;

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
              <Text style={[TYPOGRAPHY.h3, { color: colors.text }]}>Quality & Audio</Text>
              <GlassButton
                icon={<Ionicons name="close" size={18} color={colors.text} />}
                onPress={onClose}
                size={32}
                overrideTint="dark"
              />
            </View>

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {hasVideo && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textSub }]}>Quality</Text>
                  {renderRow('auto-v', 'Auto', selectedVideoId === null, () => {
                    onSelectVideo(null);
                    onClose();
                  })}
                  {videoTracks.map((track) =>
                    renderRow(
                      track.id,
                      track.label,
                      selectedVideoId === track.id,
                      () => {
                        onSelectVideo(track.id);
                        onClose();
                      }
                    )
                  )}
                </>
              )}

              {hasAudio && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textSub }]}>Audio</Text>
                  {audioTracks.map((track) =>
                    renderRow(
                      track.id,
                      track.label,
                      selectedAudioId === track.id,
                      () => {
                        onSelectAudio(track.id);
                        onClose();
                      }
                    )
                  )}
                </>
              )}

              {!hasVideo && !hasAudio && (
                <Text style={[TYPOGRAPHY.body, styles.empty, { color: colors.textSub }]}>
                  This stream offers a single quality and one audio track.
                </Text>
              )}
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
  panel: {
    width: 320,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { maxHeight: 360 },
  bodyContent: { paddingVertical: SPACING.xs },
  sectionLabel: {
    ...TYPOGRAPHY.caption,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  empty: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
});

export default TrackSelectionModal;
