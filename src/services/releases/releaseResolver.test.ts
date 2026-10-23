/**
 * Guards the release resolver now that the published artifact is a bundle.
 *
 * The app previously downloaded and installed an `.apk` from the release. The
 * build is now an `.aab`, which no device can install, so the resolver must not
 * hand back an APK URL even when a release still contains one — that would put
 * the updater back in the business of installing a file it cannot install.
 */
import {
  aabAssetName,
  directAabUrl,
  fallbackRelease,
  findAabAsset,
  isNewerVersion,
  resolveFromRelease,
  resolveLatestRelease,
  type GitHubRelease,
} from './releaseResolver';

const release = (assets: GitHubRelease['assets']): GitHubRelease => ({
  tag_name: 'android-latest',
  assets,
});

describe('bundle asset naming', () => {
  it('names the bundle after the version, not the APK it used to be', () => {
    expect(aabAssetName('1.2.3')).toBe('netflix-pro-1.2.3.aab');
    expect(aabAssetName('1.2.3')).not.toContain('.apk');
  });

  it('points the direct URL at the bundle', () => {
    expect(directAabUrl('1.2.3')).toBe(
      'https://github.com/ofureebiere-source/netflix-pro/releases/download/android-latest/netflix-pro-1.2.3.aab'
    );
  });
});

describe('findAabAsset', () => {
  it('prefers the versioned bundle over the stable alias', () => {
    // Asset order in the API response is not guaranteed, so the choice cannot
    // rely on position: the versioned name is what carries the version.
    const found = findAabAsset(
      release([
        { name: 'netflix-pro.aab', browser_download_url: 'https://example.test/alias.aab' },
        { name: 'netflix-pro-1.2.3.aab', browser_download_url: 'https://example.test/versioned.aab' },
      ])
    );
    expect(found?.name).toBe('netflix-pro-1.2.3.aab');
  });

  it('ignores APKs, even when the release still carries one', () => {
    expect(findAabAsset(release([{ name: 'netflix-pro-1.2.3.apk' }]))).toBeUndefined();
  });
});

describe('resolveFromRelease', () => {
  it('resolves the version and the bundle URL', () => {
    const resolved = resolveFromRelease(
      release([{ name: 'netflix-pro-1.2.3.aab', browser_download_url: 'https://example.test/app.aab' }])
    );
    expect(resolved).toEqual({
      version: '1.2.3',
      aabUrl: 'https://example.test/app.aab',
      releaseUrl: expect.stringContaining('/releases/tag/android-latest'),
      source: 'api',
    });
  });

  it('returns null rather than an APK URL when the release has no bundle', () => {
    // The whole point of the change: an APK-only release must not resolve, or
    // the updater would offer to install a file the build no longer produces.
    expect(resolveFromRelease(release([{ name: 'netflix-pro-1.2.3.apk' }]))).toBeNull();
    expect(resolveFromRelease(release([]))).toBeNull();
  });
});

describe('fallbackRelease', () => {
  it('builds the bundle URL for a known version', () => {
    const fallback = fallbackRelease('1.2.3');
    expect(fallback.source).toBe('fallback');
    expect(fallback.aabUrl).toContain('netflix-pro-1.2.3.aab');
  });

  it('falls back to the release page when the version is unknown', () => {
    const fallback = fallbackRelease();
    expect(fallback.version).toBe('');
    expect(fallback.aabUrl).toBe(fallback.releaseUrl);
  });
});

describe('resolveLatestRelease', () => {
  const fetchReturning = (payload: unknown, ok = true) =>
    (async () => ({ ok, json: async () => payload })) as unknown as typeof fetch;

  it('uses the API payload when it is readable', async () => {
    const resolved = await resolveLatestRelease(
      '1.0.0',
      fetchReturning(
        release([{ name: 'netflix-pro-1.2.3.aab', browser_download_url: 'https://example.test/app.aab' }])
      )
    );
    expect(resolved.source).toBe('api');
    expect(resolved.version).toBe('1.2.3');
  });

  it('falls back when the request fails, instead of throwing', async () => {
    const failing = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const resolved = await resolveLatestRelease('1.0.0', failing);
    expect(resolved.source).toBe('fallback');
    expect(resolved.version).toBe('1.0.0');
  });
});

describe('isNewerVersion', () => {
  it('compares numerically, not as strings', () => {
    expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true);
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false);
    expect(isNewerVersion('1.2.2', '1.2.3')).toBe(false);
    expect(isNewerVersion('', '1.2.3')).toBe(false);
  });
});
