// src/services/releases/releaseResolver.ts
//
// Single source of truth for where this app's Android build is published.
//
// Downloads are served straight from GitHub Releases — no third-party host,
// no mirror, no redirector. The release workflow (.github/workflows/android.yml)
// builds a signed *release* APK and uploads it to the rolling `android-latest`
// tag as `netflix-pro-<version>.apk`, so the asset name always carries the real
// version rather than `app-debug.apk`.
//
// The resolver reads the release through the GitHub API and falls back to the
// predictable direct asset URL when the API is unavailable. The API path is
// preferred because the asset name embeds the version, which is what lets the
// updater compare "installed" against "published" without parsing a tag.

export const RELEASE_OWNER = 'King-Fisher000';
export const RELEASE_REPO = 'netflix-pro';

/** Rolling tag the release workflow publishes to. Always the newest build. */
export const RELEASE_TAG = 'android-latest';

export const RELEASE_API_URL = `https://api.github.com/repos/${RELEASE_OWNER}/${RELEASE_REPO}/releases/tags/${RELEASE_TAG}`;
export const RELEASE_PAGE_URL = `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/tag/${RELEASE_TAG}`;

/** `netflix-pro-1.2.3.apk` — the asset name the workflow uploads. */
export function apkAssetName(version: string): string {
  return `netflix-pro-${version}.apk`;
}

/** The direct asset URL for a known version, used when the API is unreachable. */
export function directApkUrl(version: string): string {
  return `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/download/${RELEASE_TAG}/${apkAssetName(version)}`;
}

export interface ResolvedRelease {
  /** Version parsed from the asset name, the tag, or the release body. */
  version: string;
  /** Direct download URL of the `.apk` asset. */
  apkUrl: string;
  /** Human-facing release page, used when a direct install is not possible. */
  releaseUrl: string;
  /** Whether `apkUrl` came from the API or the deterministic fallback. */
  source: 'api' | 'fallback';
}

/** The subset of the GitHub release payload this module reads. */
export interface GitHubRelease {
  tag_name?: string;
  name?: string;
  body?: string;
  assets?: { name?: string; browser_download_url?: string }[];
}

/**
 * Pick the version out of an asset name, a tag, or a release body.
 *
 * Preference order matters: the asset name is what the workflow controls, so it
 * is trusted over the tag (which is a fixed string here) and over the body
 * (which is prose and may mention several numbers).
 */
export function parseVersion(release: GitHubRelease, assetName?: string): string {
  const fromAsset = assetName?.match(/(\d+\.\d+\.\d+)/);
  if (fromAsset) return fromAsset[1];

  const fromTag = release.tag_name?.match(/(\d+\.\d+\.\d+)/);
  if (fromTag) return fromTag[1];

  const fromBody = release.body?.match(/version[:\s]*v?(\d+\.\d+\.\d+)/i);
  if (fromBody) return fromBody[1];

  return '';
}

/** The APK asset in a release, preferring the versioned name. */
export function findApkAsset(release: GitHubRelease) {
  const apks = (release.assets || []).filter((asset) =>
    asset?.name?.toLowerCase().endsWith('.apk')
  );
  // The workflow publishes two names for the same bytes: `netflix-pro-1.2.3.apk`
  // and the stable `netflix-pro.apk` alias. Prefer the versioned one, since the
  // version it carries is what the updater compares against the installed app;
  // asset order in the API response is not guaranteed.
  return apks.find((asset) => /\d+\.\d+\.\d+/.test(asset.name || '')) || apks[0];
}

/**
 * Turn a release payload into a download target.
 *
 * Returns null when the release carries no APK at all — an empty answer, not an
 * error, so callers can fall back rather than surface a failure to the user.
 */
export function resolveFromRelease(release: GitHubRelease): ResolvedRelease | null {
  const asset = findApkAsset(release);
  if (!asset?.browser_download_url) return null;

  return {
    version: parseVersion(release, asset.name),
    apkUrl: asset.browser_download_url,
    releaseUrl: RELEASE_PAGE_URL,
    source: 'api',
  };
}

/**
 * The URL to use when the API could not be read.
 *
 * The asset name embeds the version, so the fallback needs one. `knownVersion`
 * is the caller's best guess (typically the installed version); when it is
 * absent the release page is the only honest answer, and `apkUrl` points there
 * so the user still lands somewhere they can download from.
 */
export function fallbackRelease(knownVersion?: string): ResolvedRelease {
  if (knownVersion) {
    return {
      version: knownVersion,
      apkUrl: directApkUrl(knownVersion),
      releaseUrl: RELEASE_PAGE_URL,
      source: 'fallback',
    };
  }
  return {
    version: '',
    apkUrl: RELEASE_PAGE_URL,
    releaseUrl: RELEASE_PAGE_URL,
    source: 'fallback',
  };
}

/**
 * Fetch the published release.
 *
 * Any failure — offline, rate-limited, a 404 while a build is in flight — is
 * reported as null rather than thrown, so the caller decides between the
 * fallback URL and a "could not check" message.
 */
export async function fetchLatestRelease(
  fetchImpl: typeof fetch = fetch
): Promise<GitHubRelease | null> {
  try {
    const response = await fetchImpl(RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as GitHubRelease;
  } catch {
    return null;
  }
}

/** Fetch and resolve in one call, falling back when the API is unreadable. */
export async function resolveLatestApk(
  knownVersion?: string,
  fetchImpl: typeof fetch = fetch
): Promise<ResolvedRelease> {
  const release = await fetchLatestRelease(fetchImpl);
  if (!release) return fallbackRelease(knownVersion);
  return resolveFromRelease(release) ?? fallbackRelease(knownVersion);
}

/** Whether `candidate` is a different version from `installed`. */
export function isNewerVersion(candidate: string, installed: string): boolean {
  if (!candidate) return false;
  if (!installed) return true;
  if (candidate === installed) return false;

  const a = candidate.split('.').map(Number);
  const b = installed.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] || 0;
    const right = b[i] || 0;
    if (left !== right) return left > right;
  }
  return false;
}
