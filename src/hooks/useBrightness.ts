import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppState, PanResponder } from 'react-native';
import * as Brightness from 'expo-brightness';

export const useBrightness = (_showControls: any) => {
  const [brightnessLevel, setBrightnessLevel] = useState(1);
  const [hasBrightnessPermission, setHasBrightnessPermission] = useState(false);
  const brightnessSliderRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Brightness.requestPermissionsAsync();
      if (status === 'granted') {
        setHasBrightnessPermission(true);
        const initialBrightness = await Brightness.getSystemBrightnessAsync();
        setBrightnessLevel(initialBrightness);
      }
    })();

    const handleAppStateChange = async (nextAppState: any) => {
      if (nextAppState === 'active') {
        if (hasBrightnessPermission) {
          try {
            const currentBrightness = await Brightness.getSystemBrightnessAsync();
            setBrightnessLevel(currentBrightness);
          } catch (e: any) {
            console.error('Error fetching brightness on resume:', e);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [hasBrightnessPermission]);

  const handleBrightnessChange = useCallback(async (value: any) => {
    setBrightnessLevel(value);
    await Brightness.setSystemBrightnessAsync(value);
  }, []);

  const brightnessPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_evt, gestureState) => {
      return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
    },
    onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
      return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
    },
    onPanResponderGrant: (evt) => {
      if (!brightnessSliderRef.current || !hasBrightnessPermission) return;
      brightnessSliderRef.current.measure((_x: any, _y: any, _width: any, height: any, _pageX: any, pageY: any) => {
        const touchY = evt.nativeEvent.pageY - pageY;
        const newValue = 1 - Math.max(0, Math.min(1, touchY / height));
        handleBrightnessChange(newValue);
      });
    },
    onPanResponderMove: (evt) => {
      if (!brightnessSliderRef.current || !hasBrightnessPermission) return;
      brightnessSliderRef.current.measure((_x: any, _y: any, _width: any, height: any, _pageX: any, pageY: any) => {
        const touchY = evt.nativeEvent.pageY - pageY;
        const newValue = 1 - Math.max(0, Math.min(1, touchY / height));
        handleBrightnessChange(newValue);
      });
    },
    onPanResponderRelease: () => {},
  }), [hasBrightnessPermission, handleBrightnessChange]);

  return {
    brightnessLevel,
    hasBrightnessPermission,
    brightnessSliderRef,
    brightnessPanResponder,
    handleBrightnessChange,
  };
};
