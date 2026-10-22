/**
 * A stable, anonymous device identity.
 *
 * There are no accounts by design (see TODO section 9), so the device is the
 * unit of identity: watch progress and preferences follow it rather than a
 * login. The id is generated once and kept in secure storage, which is the
 * portable choice — a hardware serial is restricted on both Android and iOS,
 * and a plain UUID in secure storage survives where the OS lets it.
 *
 * Secure storage is not guaranteed to survive an uninstall (Android
 * Keystore-backed storage generally does not; iOS Keychain generally does), so
 * a missing id is a normal first-run outcome, not an error.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'netflixpro.device.id';
const DEVICE_ID_PREFIX = 'device';

/** RFC 4122 v4 UUID from the platform CSPRNG, with a JS fallback. */
const generateUuid = (): string => {
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();

  const bytes = new Uint8Array(16);
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Version 4 and variant 1, per RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export interface DeviceIdentity {
  id: string;
  /** Where the id came from, for diagnostics and the debug screen. */
  origin: 'stored' | 'generated';
}

let cached: DeviceIdentity | null = null;

/**
 * Return this device's id, generating and persisting one on first run.
 *
 * Never throws: if secure storage is unavailable the app still gets a usable
 * id for this session, because a settings screen that cannot render is worse
 * than an id that does not persist.
 */
export const getDeviceIdentity = async (): Promise<DeviceIdentity> => {
  if (cached) return cached;

  try {
    const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (stored) {
      cached = { id: stored, origin: 'stored' };
      return cached;
    }
  } catch {
    // Fall through and mint a session-only id.
  }

  const generated = `${DEVICE_ID_PREFIX}_${Platform.OS}_${generateUuid()}`;
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  } catch {
    // Session-only is acceptable; origin already reports it.
  }
  cached = { id: generated, origin: 'generated' };
  return cached;
};

/**
 * Forget this device's id. Exposed for a "reset" affordance so a user can drop
 * the identity the way they would delete an account.
 */
export const resetDeviceIdentity = async (): Promise<void> => {
  cached = null;
  try {
    await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
  } catch {
    // Nothing stored; nothing to remove.
  }
};

/** The id as a header pair, for requests that should carry the identity. */
export const deviceHeaders = async (): Promise<Record<string, string>> => {
  const { id } = await getDeviceIdentity();
  return { 'X-Device-Id': id };
};
