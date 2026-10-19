// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  const getBottomPadding = () => {
    if (Platform.OS === 'ios') {
      return insets.bottom > 0 ? insets.bottom + 10 : 10;
    }
    return insets.bottom > 0 ? insets.bottom + 12 : 14;
  };

  // Light keeps the tab bar translucent so the page gradient shows through it
  // (dark stays near-opaque, matching the reference's solid black bar).
  const getTabBarBackground = () => {
    if (isDark) {
      return 'rgba(0, 0, 0, 0.95)';
    }
    return colors.tabBarBackground;
  };

  const getBorderColor = () => {
    if (isDark) {
      return '#27272a';
    }
    return colors.surfaceGlassBorder;
  };

  const getShadowColor = () => {
    if (isDark) {
      return '#000';
    }
    return 'rgba(0, 0, 0, 0.12)';
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: getTabBarBackground(),
          borderRadius: 0,
          height: Platform.OS === 'ios' ? 56 : 52,
          paddingBottom: getBottomPadding(),
          paddingTop: 8,
          paddingHorizontal: 14,
          borderTopWidth: 0.5,
          borderTopColor: getBorderColor(),
          ...(Platform.OS === 'ios' && {
            backdropFilter: 'blur(24px)',
          }),
          shadowColor: getShadowColor(),
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted || (isDark ? '#888888' : '#AAAAAA'),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: 2,
          letterSpacing: 0.3,
        },
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 4,
          paddingVertical: 4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = 'home';
          const iconSize = focused ? size + 2 : size;
          if (route.name === 'index') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'library') {
            iconName = focused ? 'library' : 'library-outline';
          } else if (route.name === 'settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName as any} size={iconSize} color={color} />;
        },
      })}
    >
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home',
        }} 
      />
      <Tabs.Screen 
        name="library" 
        options={{ 
          title: 'Library',
        }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{ 
          title: 'Settings',
        }} 
      />
    </Tabs>
  );
}