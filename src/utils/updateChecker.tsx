import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
// Single source of truth for the app version: read directly from package.json
// at build time (Metro supports JSON imports out of the box) instead of
// expo-constants or a duplicated process.env value.
import packageJson from '../../package.json';
import { isNewerVersion, resolveLatestRelease } from '../services/releases/releaseResolver';

const CURRENT_VERSION: string = packageJson.version;
const CHECK_FOR_UPDATES_KEY = '@check_for_updates_enabled';
const LAST_NATIVE_CHECK_KEY = '@last_native_check';

// ─── TIER 1: Check JS bundle update via expo-updates ───
const checkJsUpdate = async () => {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Optionally reload immediately or on next launch
      // await Updates.reloadAsync();
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('expo-updates check failed:', error);
    return false;
  }
};

// ─── TIER 2: Check for a new release ───
// The download target comes from releaseResolver, so the app and the release
// workflow agree on one tag and one asset naming scheme. The previous version
// of this function read a hardcoded `Zapier-codes/Netflix-Pro` tag that does
// not exist, so the check silently never fired.
//
// Only the version is reported upward. The release carries an `.aab`, which is
// a Play upload artifact — no device can install it, so the app has nothing to
// hand to a package installer and the release page is the only destination.
const checkNativeUpdate = async () => {
  try {
    const release = await resolveLatestRelease(CURRENT_VERSION);
    if (!release.version) return null;

    const currentNativeVersion = await AsyncStorage.getItem('@native_version') || CURRENT_VERSION;

    if (isNewerVersion(release.version, currentNativeVersion)) {
      return {
        version: release.version,
        releaseUrl: release.releaseUrl,
      };
    }
    return null;
  } catch (error: any) {
    console.error('Native update check failed:', error);
    return null;
  }
};

// ─── MAIN: Orchestrate both tiers ───
export const checkForUpdates = async (showAlert = true) => {
  // 1. Always check JS updates first (silent)
  const jsUpdated = await checkJsUpdate();

  // 2. Check native updates (only once per day to avoid spam)
  const lastCheck = await AsyncStorage.getItem(LAST_NATIVE_CHECK_KEY);
  const today = new Date().toDateString();

  if (lastCheck !== today) {
    await AsyncStorage.setItem(LAST_NATIVE_CHECK_KEY, today);

    const nativeUpdate = await checkNativeUpdate();
    if (nativeUpdate) {
      Alert.alert(
        'Major Update Available',
        `A new version (${nativeUpdate.version}) is ready on the release page.`,
        [
          {
            text: 'Open Release Page',
            onPress: () => {
              Linking.openURL(nativeUpdate.releaseUrl).catch((err) => {
                console.error('Could not open the release page:', err);
              });
            },
          },
          { text: 'Later', style: 'cancel' }
        ]
      );
      return; // Don't show "up to date" if native update is pending
    }
  }

  // 3. Show status if requested
  if (showAlert) {
    if (jsUpdated) {
      Alert.alert('Updated', 'New content has been downloaded. Restart to apply.', [{ text: 'OK' }]);
    } else {
      Alert.alert('Up to Date', `You are on the latest version (${CURRENT_VERSION}).`, [{ text: 'OK' }]);
    }
  }
};

// ─── Settings helpers ───
export const getCheckForUpdatesSetting = async () => {
  try {
    const value = await AsyncStorage.getItem(CHECK_FOR_UPDATES_KEY);
    return value !== null ? JSON.parse(value) : true;
  } catch {
    return true;
  }
};

export const setCheckForUpdatesSetting = async (isEnabled: boolean) => {
  try {
    await AsyncStorage.setItem(CHECK_FOR_UPDATES_KEY, JSON.stringify(isEnabled));
  } catch (error: any) {
    console.error('Error setting check for updates:', error);
  }
};
