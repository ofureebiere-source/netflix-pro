import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppState, PanResponder } from 'react-native';
import { VolumeManager } from 'react-native-volume-manager';

export const useVolume = (_showControls: any) => {
  const [volumeLevel, setVolumeLevel] = useState(1);
  const [hasVolumePermission, setHasVolumePermission] = useState(true);
  const volumeSliderRef = useRef<any>(null);

  useEffect(() => {
    let volumeListener: { remove: () => void } | null = null;

    (async () => {
      try {
        VolumeManager.showNativeVolumeUI({ enabled: false });
        const { volume } = await VolumeManager.getVolume();
        setVolumeLevel(volume);
        setHasVolumePermission(true);

        volumeListener = VolumeManager.addVolumeListener((result) => {
          setVolumeLevel(result.volume);
        });
      } catch (e: any) {
        // Some platforms/emulators don't expose a system volume API — degrade
        // gracefully rather than crash the player.
        console.error('Error initializing volume manager:', e);
        setHasVolumePermission(false);
      }
    })();

    const handleAppStateChange = async (nextAppState: any) => {
      if (nextAppState === 'active') {
        try {
          const { volume } = await VolumeManager.getVolume();
          setVolumeLevel(volume);
        } catch (e: any) {
          console.error('Error fetching volume on resume:', e);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (volumeListener) volumeListener.remove();
    };
  }, []);

  const handleVolumeChange = useCallback(async (value: any) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeLevel(clamped);
    try {
      await VolumeManager.setVolume(clamped, { showUI: false });
    } catch (e: any) {
      console.error('Error setting volume:', e);
    }
  }, []);

  const volumePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_evt, gestureState) => {
      return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
    },
    onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
      return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
    },
    onPanResponderGrant: (evt) => {
      if (!volumeSliderRef.current || !hasVolumePermission) return;
      volumeSliderRef.current.measure((_x: any, _y: any, _width: any, height: any, _pageX: any, pageY: any) => {
        const touchY = evt.nativeEvent.pageY - pageY;
        const newValue = 1 - Math.max(0, Math.min(1, touchY / height));
        handleVolumeChange(newValue);
      });
    },
    onPanResponderMove: (evt) => {
      if (!volumeSliderRef.current || !hasVolumePermission) return;
      volumeSliderRef.current.measure((_x: any, _y: any, _width: any, height: any, _pageX: any, pageY: any) => {
        const touchY = evt.nativeEvent.pageY - pageY;
        const newValue = 1 - Math.max(0, Math.min(1, touchY / height));
        handleVolumeChange(newValue);
      });
    },
    onPanResponderRelease: () => {},
  }), [hasVolumePermission, handleVolumeChange]);

  return {
    volumeLevel,
    hasVolumePermission,
    volumeSliderRef,
    volumePanResponder,
    handleVolumeChange,
  };
};
