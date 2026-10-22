/**
 * Shared Jest setup.
 *
 * These are native modules with no JS fallback, so anything importing them fails
 * at import time under Jest. Registering the mocks once here keeps every suite
 * that touches persistence or locale from repeating it.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Secure storage, backed by an in-memory map so a test can assert that an id
// written in one read is the id returned by the next. The map lives on
// globalThis rather than in the factory closure so it survives
// `jest.resetModules()` — otherwise a simulated relaunch would read an empty
// store and the persistence guarantee would go untested.
globalThis.__secureStoreData = globalThis.__secureStoreData || new Map();
jest.mock('expo-secure-store', () => {
  const store = globalThis.__secureStoreData;
  return {
    getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    setItemAsync: jest.fn(async (key, value) => { store.set(key, value); }),
    deleteItemAsync: jest.fn(async (key) => { store.delete(key); }),
  };
});

// Device locale. Fixed values, because detection's fallback path is the part
// under test and a host-dependent locale would make the result vary by machine.
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [
    { languageCode: 'en', regionCode: 'US', languageTag: 'en-US' },
  ]),
}));
