// src/screens/settings/SettingsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';

// Zustand Stores
import { useAppStore } from '../../store/zustand';
import { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';

// Services
import { getDownloadStorageUsage, formatFileSize, getAllDownloads, clearAllDownloads } from '../../utils/downloadStorage';
import downloadManager from '../../services/downloadManager';
import OptionPickerModal, { PickerOption } from '../../components/OptionPickerModal';
import { getSubtitleStylePrefs, saveSubtitleStylePrefs, saveSubtitleLanguagePreference } from '../../utils/storage';
import { useTranslation } from '../../hooks/useTranslation';
import { LOCALES, LOCALE_NAMES, type Locale } from '../../i18n';
import { setLocaleSnapshot } from '../../services/locale/localeState';

// The languages the interface can be shown in. `follow` is the default: the
// detected locale wins until the user says otherwise.
const APP_LANGUAGE_OPTIONS: PickerOption[] = [
  { value: '', label: 'Automatic' },
  ...LOCALES.map((code: Locale) => ({ value: code, label: LOCALE_NAMES[code] })),
];

// The ladder the player can actually offer. `auto` is the default because the
// native player adapts to bandwidth, which is what a viewer wants unless they
// say otherwise. Kept in sync with the heights usePlayerTracks matches on.
const QUALITY_OPTIONS: PickerOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: '2160', label: '4K' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
];

const SUBTITLE_LANGUAGE_OPTIONS: PickerOption[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
];

type PickerKind = 'quality' | 'language' | 'appLanguage' | null;

const SettingsScreen = () => {
  const { colors, isDark } = useTheme();
  const { showToast, showDestructiveAlert } = useAlert();
  const { t } = useTranslation();

  // Zustand state
  const {
    wifiOnlyDownload,
    maxConcurrentDownloads,
    autoDeleteWatchedDays,
    autoDeleteUnwatchedDays,
    defaultPlayerQuality,
    subtitleLanguage,
    subtitleSize,
    skipIntro,
    skipCredits,
    autoPlayNext,
    dataSaver,
    setWifiOnlyDownload,
    setMaxConcurrentDownloads,
    setAutoDeleteWatchedDays,
    setAutoDeleteUnwatchedDays,
    setDefaultPlayerQuality,
    setSubtitleLanguage,
    setSubtitleSize,
    appLanguage,
    setAppLanguage,
    setSkipIntro,
    setSkipCredits,
    setAutoPlayNext,
    setDataSaver,
    resetSettings,
  } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [downloadStorageUsed, setDownloadStorageUsed] = useState(0);
  const [totalDownloadsCount, setTotalDownloadsCount] = useState(0);
  const [storageUsageValue, setStorageUsageValue] = useState('0');
  const [storageUsageUnit, setStorageUsageUnit] = useState('KB');

  // Load data
  const loadData = useCallback(async () => {
    try {
      const usage = await getDownloadStorageUsage();
      setDownloadStorageUsed(usage);

      const allDownloads = await getAllDownloads();
      setTotalDownloadsCount(allDownloads.length);

      // Calculate total storage
      const { getAllKeys, multiGet } = require('@react-native-async-storage/async-storage');
      const keys = await getAllKeys();
      let totalSize = 0;
      if (keys.length > 0) {
        const data = await multiGet(keys);
        data.forEach(([key, value]: any) => {
          if (value) {
            totalSize += key.length * 2 + value.length * 2;
          }
        });
      }

      if (totalSize < 1024 * 1024) {
        setStorageUsageValue((totalSize / 1024).toFixed(2));
        setStorageUsageUnit('KB');
      } else {
        setStorageUsageValue((totalSize / (1024 * 1024)).toFixed(2));
        setStorageUsageUnit('MB');
      }
    } catch (error: any) {
      console.error('[Settings] Load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {};
    }, [loadData])
  );

  // Handlers
  const handleClearAllDownloads = useCallback(() => {
    if (totalDownloadsCount === 0 && downloadStorageUsed === 0) {
      showToast('No downloads to clear');
      return;
    }

    showDestructiveAlert(
      'Clear All Downloads',
      `Delete all ${totalDownloadsCount} downloads? This will free up ${formatFileSize(downloadStorageUsed)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await downloadManager.cancelAllDownloads();
            await clearAllDownloads();
            loadData();
            showToast('All downloads cleared');
          },
        },
      ]
    );
  }, [totalDownloadsCount, downloadStorageUsed, loadData, showToast, showDestructiveAlert]);

  const handleResetSettings = useCallback(() => {
    showDestructiveAlert(
      'Reset Settings',
      'Reset all settings to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetSettings();
            showToast('Settings reset to default');
          },
        },
      ]
    );
  }, [resetSettings, showToast, showDestructiveAlert]);

  // Subtitle Size drives the subtitle style prefs the overlay actually renders
  // (fontScale). Before this, the control wrote a store field that nothing read,
  // so changing the size had no visible effect.
  const handleSubtitleSizeChange = useCallback((size: number) => {
    setSubtitleSize(size);
    getSubtitleStylePrefs()
      .then((prefs) => saveSubtitleStylePrefs({ ...prefs, fontScale: size / 100 }))
      .catch(() => { /* Non-fatal: the store still records the choice. */ });
  }, [setSubtitleSize]);

  // Same idea for language: the store field was written but `useSubtitles`
  // reads its own persisted preference, so the pick never reached playback.
  const handleAppLanguageChange = useCallback((code: string) => {
    setAppLanguage(code);
    // Empty means "follow detection", so only override when one was chosen.
    if (code) setLocaleSnapshot({ language: code });
  }, [setAppLanguage]);

  const handleSubtitleLanguageChange = useCallback((code: string) => {
    setSubtitleLanguage(code);
    saveSubtitleLanguagePreference(code).catch(() => { /* Non-fatal. */ });
  }, [setSubtitleLanguage]);

  const renderSetting = (icon: string, title: string, rightElement: React.ReactNode, description?: string) => (
    <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.surfaceRaised }]}>
          <Ionicons name={icon as any} size={20} color={colors.accent} />
        </View>
        <View style={styles.settingContent}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
          {description && <Text style={[styles.settingDescription, { color: colors.textSub }]}>{description}</Text>}
        </View>
      </View>
      {rightElement}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>⚙️ Settings</Text>
        </View>

        {/* Theme Section — device-driven, no control. The theme follows the
            phone's light/dark setting, so there is nothing to pick here. */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>{t('settings.appearance')}</Text>
          <View style={[styles.appearanceItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: colors.surfaceRaised }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.accent} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Theme</Text>
                <Text style={[styles.settingDescription, { color: colors.textSub }]}>
                  Following your device — currently {isDark ? 'dark' : 'light'}. Change it in your phone's display
                  settings.
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setPicker('appLanguage')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.language')}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: colors.surfaceRaised }]}>
                <Ionicons name="language" size={20} color={colors.accent} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>{t('settings.language')}</Text>
                <Text style={[styles.settingDescription, { color: colors.textSub }]}>
                  {t('settings.languageDescription')}
                </Text>
              </View>
            </View>
            <Text style={[styles.settingValue, { color: colors.textSub }]}>
              {APP_LANGUAGE_OPTIONS.find((o) => o.value === appLanguage)?.label || 'Automatic'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Playback Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>{t('settings.playback')}</Text>
          {renderSetting(
            'play-skip-forward',
            'Auto-play Next Episode',
            <Switch
              value={autoPlayNext}
              onValueChange={setAutoPlayNext}
              trackColor={{ false: '#444', true: colors.accent }}
              thumbColor="#fff"
            />
          )}
          {renderSetting(
            'videocam',
            'Default Quality',
            <TouchableOpacity onPress={() => setPicker('quality')} activeOpacity={0.7}>
              <Text style={[styles.qualityText, { color: colors.text }]}>
                {QUALITY_OPTIONS.find(o => o.value === defaultPlayerQuality)?.label
                  || defaultPlayerQuality || 'Auto'}
              </Text>
            </TouchableOpacity>
          )}
          {renderSetting(
            'text',
            'Subtitle Language',
            <TouchableOpacity onPress={() => setPicker('language')} activeOpacity={0.7}>
              <Text style={[styles.qualityText, { color: colors.text }]}>
                {SUBTITLE_LANGUAGE_OPTIONS.find(o => o.value === subtitleLanguage)?.label
                  || subtitleLanguage || 'English'}
              </Text>
            </TouchableOpacity>
          )}
          {renderSetting(
            'text-outline',
            'Subtitle Size',
            <View style={styles.qualityButtons}>
              {[75, 100, 125].map(size => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.qualityButton,
                    subtitleSize === size && { backgroundColor: colors.accent },
                    { borderColor: colors.border }
                  ]}
                  onPress={() => handleSubtitleSizeChange(size)}
                >
                  <Text style={[styles.qualityButtonText, subtitleSize === size && { color: '#000' }, { color: colors.text }]}>
                    {size}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {renderSetting(
            'fast-forward',
            'Skip Intro',
            <Switch
              value={skipIntro}
              onValueChange={setSkipIntro}
              trackColor={{ false: '#444', true: colors.accent }}
              thumbColor="#fff"
            />,
            'Not active yet — needs intro markers, which the backend does not supply.'
          )}
          {renderSetting(
            'flag',
            'Skip Credits',
            <Switch
              value={skipCredits}
              onValueChange={setSkipCredits}
              trackColor={{ false: '#444', true: colors.accent }}
              thumbColor="#fff"
            />,
            'Not active yet — needs credit markers, which the backend does not supply.'
          )}
          {renderSetting(
            'cellular',
            'Data Saver',
            <Switch
              value={dataSaver}
              onValueChange={setDataSaver}
              trackColor={{ false: '#444', true: colors.accent }}
              thumbColor="#fff"
            />,
            'Caps playback at 480p unless you pick a quality yourself.'
          )}
        </View>

        {/* Downloads Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>{t('settings.downloads')}</Text>
          {renderSetting(
            'wifi',
            'WiFi-Only Downloads',
            <Switch
              value={wifiOnlyDownload}
              onValueChange={setWifiOnlyDownload}
              trackColor={{ false: '#444', true: colors.accent }}
              thumbColor="#fff"
            />
          )}
          {renderSetting(
            'layers',
            'Concurrent Downloads',
            <View style={styles.qualityButtons}>
              {[1, 2, 3, 5].map(count => (
                <TouchableOpacity
                  key={count}
                  style={[
                    styles.qualityButton,
                    maxConcurrentDownloads === count && { backgroundColor: colors.accent },
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setMaxConcurrentDownloads(count)}
                >
                  <Text style={[styles.qualityButtonText, maxConcurrentDownloads === count && { color: '#000' }, { color: colors.text }]}>
                    {count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {renderSetting(
            'trash',
            'Delete After Watching',
            <Switch
              value={autoDeleteWatchedDays > 0}
              onValueChange={(val) => setAutoDeleteWatchedDays(val ? 1 : 0)}
              trackColor={{ false: '#444', true: colors.accent }}
              thumbColor="#fff"
            />
          )}
          {renderSetting(
            'timer',
            'Auto-Delete Unwatched',
            <View style={styles.qualityButtons}>
              {[0, 7, 14, 30].map(days => (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.qualityButton,
                    autoDeleteUnwatchedDays === days && { backgroundColor: colors.accent },
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setAutoDeleteUnwatchedDays(days)}
                >
                  <Text style={[styles.qualityButtonText, autoDeleteUnwatchedDays === days && { color: '#000' }, { color: colors.text }]}>
                    {days === 0 ? 'Never' : `${days}d`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[styles.storageInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.storageLabel, { color: colors.textSub }]}>Downloaded Content</Text>
            <Text style={[styles.storageValue, { color: colors.text }]}>
              {totalDownloadsCount} items • {formatFileSize(downloadStorageUsed)}
            </Text>
          </View>

          <TouchableOpacity style={[styles.clearButton, { backgroundColor: colors.surfaceRaised }]} onPress={handleClearAllDownloads}>
            <Text style={[styles.clearButtonText, { color: colors.error }]}>{t('downloads.clearAll')}</Text>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>{t('settings.about')}</Text>
          <View style={[styles.aboutItem, { borderBottomColor: colors.border }]}>
            <Text style={[styles.aboutLabel, { color: colors.textSub }]}>Version</Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
          </View>
          <View style={[styles.aboutItem, { borderBottomColor: colors.border }]}>
            <Text style={[styles.aboutLabel, { color: colors.textSub }]}>{t('downloads.storageUsed')}</Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>{storageUsageValue} {storageUsageUnit}</Text>
          </View>
          <TouchableOpacity style={[styles.resetButton, { backgroundColor: colors.surfaceRaised }]} onPress={handleResetSettings}>
            <Text style={[styles.resetButtonText, { color: colors.error }]}>{t('settings.resetAll')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <OptionPickerModal
        visible={picker === 'quality'}
        title={t('settings.defaultQuality')}
        options={QUALITY_OPTIONS}
        selected={defaultPlayerQuality}
        onSelect={setDefaultPlayerQuality}
        onClose={() => setPicker(null)}
      />
      <OptionPickerModal
        visible={picker === 'appLanguage'}
        title={t('settings.language')}
        options={APP_LANGUAGE_OPTIONS}
        selected={appLanguage}
        onSelect={handleAppLanguageChange}
        onClose={() => setPicker(null)}
      />
      <OptionPickerModal
        visible={picker === 'language'}
        title={t('settings.subtitleLanguage')}
        options={SUBTITLE_LANGUAGE_OPTIONS}
        selected={subtitleLanguage}
        onSelect={handleSubtitleLanguageChange}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16 },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  settingValue: { fontSize: 14 },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 0.5,
  },
  appearanceItem: {
    flexDirection: 'column',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 0.5,
    gap: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '500' },
  settingDescription: { fontSize: 12, marginTop: 2 },
  qualityButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  qualityButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginHorizontal: 2,
  },
  qualityButtonText: { fontSize: 12, fontWeight: '500' },
  qualityText: { fontSize: 14, fontWeight: '500' },
  storageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 0.5,
  },
  storageLabel: { fontSize: 14 },
  storageValue: { fontSize: 14, fontWeight: '600' },
  clearButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  clearButtonText: { fontSize: 15, fontWeight: '600' },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  aboutLabel: { fontSize: 14 },
  aboutValue: { fontSize: 14, fontWeight: '500' },
  resetButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  resetButtonText: { fontSize: 15, fontWeight: '600' },
});

export default SettingsScreen;