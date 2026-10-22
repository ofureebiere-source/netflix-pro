/**
 * Guards the device identity that replaces sign-in.
 *
 * The id is what watch progress and preferences hang off, so it has to be
 * stable across reads and to survive a storage failure without taking the app
 * down — a settings screen that cannot render is worse than a non-persistent id.
 */
import * as SecureStore from 'expo-secure-store';
import { getDeviceIdentity, resetDeviceIdentity, deviceHeaders } from './deviceIdentity';

beforeEach(async () => {
  await resetDeviceIdentity();
  jest.restoreAllMocks();
});

describe('getDeviceIdentity', () => {
  it('mints an id on first run and reports it as generated', async () => {
    const identity = await getDeviceIdentity();
    expect(identity.origin).toBe('generated');
    expect(identity.id).toMatch(/^device_/);
  });

  it('returns the same id on later reads in the same session', async () => {
    const first = await getDeviceIdentity();
    const second = await getDeviceIdentity();
    expect(second.id).toBe(first.id);
  });

  it('reads back the stored id on a fresh process, and calls it stored', async () => {
    // Simulate a relaunch: the value is in secure storage but the in-memory
    // cache is gone. This is what makes watch progress follow the device.
    const first = await getDeviceIdentity();
    await SecureStore.setItemAsync('netflixpro.device.id', first.id);
    jest.resetModules();

    const { getDeviceIdentity: freshRead } = require('./deviceIdentity');
    const relaunched = await freshRead();
    expect(relaunched.id).toBe(first.id);
    expect(relaunched.origin).toBe('stored');
  });

  it('mints a different id after a reset, rather than resurrecting the old one', async () => {
    const first = await getDeviceIdentity();
    await resetDeviceIdentity();
    const afterReset = await getDeviceIdentity();
    expect(afterReset.id).not.toBe(first.id);
  });

  it('still yields a usable id when secure storage throws', async () => {
    jest.spyOn(SecureStore, 'getItemAsync').mockRejectedValue(new Error('keystore unavailable'));
    jest.spyOn(SecureStore, 'setItemAsync').mockRejectedValue(new Error('keystore unavailable'));
    const identity = await getDeviceIdentity();
    expect(identity.id).toMatch(/^device_/);
  });
});

describe('deviceHeaders', () => {
  it('exposes the id as a request header', async () => {
    const headers = await deviceHeaders();
    expect(headers['X-Device-Id']).toMatch(/^device_/);
  });
});
