# AGENTS.md — netflix-pro (King-Fisher000/netflix-pro)

Persistent notes for this repository. Keep entries short and factual.

## Repo identity

- React Native + Expo 55 (RN 0.83.6), TypeScript strict. Remote `King-Fisher000/netflix-pro`,
  default branch `main`.
- Ships as an **Android App Bundle only**. There is no APK anywhere: not built, not
  published, not downloaded, not installed. Do not reintroduce one.

## Commands

- `npx tsc --noEmit` — must stay exit 0.
- `npx jest` — 43 tests. Config is `jest.config.js` (plain JS, so it needs no `ts-node`).
- AAB build (local):
  ```bash
  source /workspace/android-env.sh          # JDK 17 + Android SDK
  cd android && ./gradlew bundleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
  # -> android/app/build/outputs/bundle/release/app-release.aab
  ```
  A clean build takes ~13 min; incremental ~1.5 min. Verify with
  `java -jar bundletool.jar validate --bundle=...` and `jarsigner -verify ...`.

## Toolchain — the JDK 17 requirement is not optional

- Gradle 9.0.0, AGP 8.7.2, Kotlin 2.1.20.
- **Build with JDK 17.** `expo-modules-core` calls `kotlin.jvmToolchain(17)`. If only a
  newer JDK (21/25) is present, Gradle tries to provision 17 and the foojay resolver
  bundled with the React Native Gradle plugin throws
  `NoSuchFieldError: JvmVendorSpec ... IBM_SEMERU` — that field was removed in Gradle 9.
  This fails at *configuration*, before compiling anything, so it looks like a config bug
  rather than a JDK mismatch. The workflow pins `java-version: '17'` for this reason.
- SDK components: `platforms;android-36`, `build-tools;36.0.0`, `ndk;27.1.12297006`.
- After changing dependencies, delete stale autolinking output before rebuilding:
  `rm -rf node_modules/expo/android/build android/app/build android/build`. A removed
  native module otherwise lingers in the generated `ExpoModulesPackageList.kt` and fails
  the build on a missing `.aar`.

## Release contract (shared with the movie-web repo)

- Workflow `.github/workflows/android.yml` publishes to the rolling `android-latest`
  release as `netflix-pro-<version>.aab` plus a stable `netflix-pro.aab` alias.
- `src/services/releases/releaseResolver.ts` is the single source of truth for the tag,
  the asset naming and the version comparison. movie-web mirrors it in
  `src/lib/appRelease.ts`; keep the two in step.
- A bundle cannot be sideloaded, so the in-app updater cannot self-install: it compares
  versions and sends the user to the release page. Do not add a download-and-install
  path back — there is no installable file to hand to a package installer.

## Conventions

- Comments explain *why*, not what. Match the surrounding prose style.
- Secrets (`android/app/release.keystore`, `android/keystore.properties`) are gitignored;
  never commit them.
- `gradlew` must stay executable (`100755`) in git.

## Feature wiring (post-audit)

The following were previously persisted-but-unread settings or missing pieces,
and are now wired. See `TODO.md` for the original audit.

| Area | Entry point |
|------|-------------|
| UI language + content locale | `src/i18n/`, `src/hooks/useTranslation.ts`, `src/hooks/useLocale.ts` |
| Country detection | `src/services/locale/countryService.ts` (ipapi.co, cached 7d, device fallback) |
| Locale for TMDB calls | `src/services/locale/localeState.ts` — module holder read by `TMDBMetadata` |
| Device identity (no accounts) | `src/services/device/deviceIdentity.ts` |
| Recognition engine | `src/services/recognition/introDetection.ts` (intro fingerprint + runtime credits) |
| Skip intro/credits | `src/hooks/useSkipMarkers.ts`, mounted in `VideoPlayerScreen` |

`jest.setup.js` registers the AsyncStorage/SecureStore/expo-localization mocks;
native modules with no JS fallback need an entry there before a suite can import them.

## Player features (MX-Player-style)

Android-only. The equaliser needs a native module, so it does nothing in Expo Go
and the audio panel hides itself there.

| Area | Entry point |
|------|-------------|
| Equaliser + volume amplifier (native) | `modules/netflix-pro-audio/` |
| JS bridge, degrades to a no-op | `src/services/audio/audioEffects.ts` |
| Applies and persists the EQ/gain | `src/hooks/useAudioEffects.ts` |
| EQ, gain, night mode, gesture sides | `src/store/playbackSettingsStore.ts` |
| Aspect ratio presets | `src/hooks/useAspectRatio.ts` |
| Night-mode tint | `src/components/video/NightModeOverlay.tsx` |
| Subtitle styling | `src/components/video/SubtitleOverlay.tsx`, `SubtitleSettingsModal.tsx` |

Two things that are easy to get wrong here:

- Preset curves are authored for a nominal 5-band device and resampled onto the
  real band count by `resolvePresetBands`. Do not index the curve directly — a
  10-band device would then apply it to its first five bands only.
- `expo-video` has no audio-session hook, so the equaliser attaches to the
  device's *global* output mix. It is therefore applied once near the root, not
  per player instance, or navigating between screens would rebuild it each time.

## Live TV (iptv-org)

Live channels come from the public iptv-org index. There is no backend for this:
the playlists are already-final stream URLs, not titles to resolve.

| Area | Entry point |
|------|-------------|
| M3U parsing, de-dup, quality/status markers | `src/services/iptv/m3uParser.ts` |
| Category taxonomy | `src/services/iptv/categories.ts` |
| Fetch, disk cache, country list, preload | `src/services/iptv/iptvCatalog.ts` |
| React Query loader + derived lists | `src/hooks/useLiveTv.ts` |
| Favourites/recents (persisted) | `src/store/liveTvStore.ts` |
| Screen + grid cards | `src/screens/livetv/LiveTvScreen.tsx`, `src/components/livetv/` |
| Route / tab | `app/(tabs)/live.tsx`, `app/(tabs)/_layout.tsx` |

Things that are easy to get wrong here:

- Only `index.m3u` is fetched. Its `group-title` is the genre list (exactly the
  30 names in the taxonomy) and its `tvg-id` gives the country, so one download
  serves both the category and country axes. `index.country.m3u` is grouped by
  country instead and is *not* a substitute — it was deliberately not fetched.
- `group-title` is free text mixing genres with country names, so categories are
  derived by intersecting groups with the taxonomy, never by trusting the field.
  A channel naming no genre lands in `general` rather than disappearing.
- The index repeats channels up to 16x with identical URLs; `parseM3U`
  de-duplicates on id. Removing that would show the same channel repeatedly.
- A live channel is a *direct* stream, so it never reaches the backend resolver
  that normally supplies per-source headers. `LiveTvScreen` therefore passes the
  playlist's headers through the `streamHeaders` nav param, and
  `useLicensedPlaybackSource` returns them for a direct stream. Dropping this is
  invisible in a build and 403s on the first segment for channels that need a
  matching User-Agent. `src/__wiring__/wiring.test.ts` guards it.
- `isLive: 'true'` must be passed, or the player records a live channel as a
  resumable VOD title and it appears in Continue Watching.
- Country codes in `tvg-id` are ISO 3166-1 alpha-2 as iptv-org spells them: it is
  `uk`, not `gb`, in both the playlist and `countries.json`.
- Live streams are warmed on view (`preloadChannels`), skipping geo-blocked
  channels. The preload set is capped; warming the whole grid would flood.
