// src/hooks/usePlayerTracks.ts
//
// Reads the video and audio tracks the native player exposes and applies the
// viewer's pick.
//
// expo-video populates `availableVideoTracks` / `availableAudioTracks` from the
// HLS master playlist once the source loads, so the list is exactly what the
// stream offers — nothing here holds a fixed quality ladder. That matters
// because the backend's sources are resolved per title: one title may expose
// 4K/1080p/720p and the next only 480p.
//
// Selection is by track id rather than by object, because the native arrays are
// rebuilt on every `sourceLoad` and holding a stale object would silently stop
// applying. `null` means "Auto" — the player keeps its adaptive behaviour, which
// is the right default on a metered connection.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEventListener } from 'expo';

export interface VideoTrackOption {
  id: string;
  height: number;
  label: string;
}

export interface AudioTrackOption {
  id: string;
  label: string;
}

/** Height from a track, tolerating a missing or zero size. */
const trackHeight = (track: any): number => {
  const height = track?.size?.height;
  return typeof height === 'number' && height > 0 ? height : 0;
};

/** "1080p" / "4K" / "Auto" — the labels the rest of the app already uses. */
export const heightLabel = (height: number): string => {
  if (height >= 2160) return '4K';
  if (height > 0) return `${height}p`;
  return 'Auto';
};

/**
 * Map a `defaultPlayerQuality` setting onto a track height. The setting stores
 * either a number-like string ("720") or a label ("720p", "4K", "auto").
 */
export const qualitySettingToHeight = (setting?: string | number | null): number | null => {
  if (setting === null || setting === undefined) return null;
  const raw = String(setting).trim().toLowerCase();
  if (!raw || raw === 'auto') return null;
  if (raw === '4k' || raw === '2160p') return 2160;
  const match = /(\d{3,4})/.exec(raw);
  return match ? Number(match[1]) : null;
};

interface UsePlayerTracksOptions {
  player: any;
  /** Persisted `defaultPlayerQuality`; seeds the initial pick. */
  defaultQuality?: string | number | null;
  /** Persisted `dataSaver`; caps the seeded pick so it cannot be a high ladder rung. */
  dataSaver?: boolean;
  /** Live streams have no selectable ladder. */
  disabled?: boolean;
}

const DATA_SAVER_MAX_HEIGHT = 480;

export function usePlayerTracks({
  player,
  defaultQuality,
  dataSaver,
  disabled,
}: UsePlayerTracksOptions) {
  const [videoTracks, setVideoTracks] = useState<VideoTrackOption[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrackOption[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);

  // The user's own pick always wins over the setting, so a later `sourceLoad`
  // (a server failover, an episode change) must not stomp on it.
  const userChoseVideo = useRef(false);
  const userChoseAudio = useRef(false);

  const readTracks = useCallback(
    (source: { availableVideoTracks?: any[]; availableAudioTracks?: any[] } | null | undefined) => {
      if (!source) return;

      const videos: VideoTrackOption[] = (source.availableVideoTracks || [])
        .filter((track: any) => track?.isSupported !== false)
        .map((track: any) => {
          const height = trackHeight(track);
          return { id: String(track.id), height, label: heightLabel(height) };
        })
        // Tallest first: a quality menu reads top-down from best.
        .sort((a, b) => b.height - a.height);

      const audios: AudioTrackOption[] = (source.availableAudioTracks || []).map(
        (track: any, index: number) => ({
          id: String(track.id ?? track.language ?? index),
          label: track.label || track.name || track.language || `Track ${index + 1}`,
        })
      );

      setVideoTracks(videos);
      setAudioTracks(audios);

      if (!userChoseVideo.current) {
        const wantHeight = qualitySettingToHeight(defaultQuality);
        const cap = dataSaver ? DATA_SAVER_MAX_HEIGHT : null;
        const eligible = cap ? videos.filter((track) => track.height <= cap) : videos;
        // The highest rung at or below the cap, so data saver lands on 480p
        // when it exists and the next rung down when it does not.
        const target =
          (wantHeight !== null
            ? eligible.find((track) => track.height === wantHeight) || eligible[0]
            : null) || (cap ? eligible[0] : null);
        if (target) {
          setSelectedVideoId(target.id);
          try {
            player.videoTrack = (source.availableVideoTracks || []).find(
              (track: any) => String(track.id) === target.id
            ) ?? null;
          } catch {
            // A track the platform refuses is not fatal; Auto still plays.
            setSelectedVideoId(null);
          }
        } else {
          setSelectedVideoId(null);
        }
      }

      if (!userChoseAudio.current) {
        const preferred = (source.availableAudioTracks || []).find((track: any) => track?.isDefault);
        setSelectedAudioId(preferred ? String(preferred.id ?? preferred.language) : null);
      }
    },
    [player, defaultQuality, dataSaver]
  );

  // `sourceLoad` fires whenever the player takes a new source, which is also
  // when the native track arrays are first populated.
  useEventListener(player, 'sourceLoad', (payload: any) => readTracks(payload));

  // A source that was already loaded before this hook mounted (a re-mount, or a
  // fast cache hit) never emits `sourceLoad`, so seed from the live player too.
  useEffect(() => {
    if (disabled || !player) return;
    try {
      readTracks({
        availableVideoTracks: player.availableVideoTracks,
        availableAudioTracks: player.availableAudioTracks,
      });
    } catch {
      // Reading tracks before load throws on some platforms; sourceLoad covers it.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, disabled]);

  const selectVideoTrack = useCallback(
    (id: string | null) => {
      userChoseVideo.current = true;
      setSelectedVideoId(id);
      if (!player) return;
      try {
        player.videoTrack =
          id === null
            ? null
            : player.availableVideoTracks?.find((track: any) => String(track.id) === id) ?? null;
      } catch {
        // Ignore: the UI still reflects the pick and Auto remains playable.
      }
    },
    [player]
  );

  const selectAudioTrack = useCallback(
    (id: string | null) => {
      userChoseAudio.current = true;
      setSelectedAudioId(id);
      if (!player) return;
      try {
        player.audioTrack =
          id === null
            ? null
            : player.availableAudioTracks?.find(
                (track: any, index: number) => String(track.id ?? track.language ?? index) === id
              ) ?? null;
      } catch {
        // As above.
      }
    },
    [player]
  );

  const qualityLabel = useMemo(() => {
    const selected = videoTracks.find((track) => track.id === selectedVideoId);
    return selected ? selected.label : 'Auto';
  }, [videoTracks, selectedVideoId]);

  return {
    videoTracks,
    audioTracks,
    selectedVideoId,
    selectedAudioId,
    selectVideoTrack,
    selectAudioTrack,
    qualityLabel,
    trackCount: videoTracks.length + audioTracks.length,
  };
}
