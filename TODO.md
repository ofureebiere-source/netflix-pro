# TODO — wiring audit and open work

Audit of the merged `main` tree (termux work, licensed-backend playback).
Everything below was verified by reading the code and tracing imports, not
inferred from the handover docs. Those two docs disagree with each other and
are both stale in places; where that happens, this file records what the code
actually does.

Legend: `[ ]` open · `[x]` done · `[~]` partly wired

---

## 1. Player — wiring gaps

The player is in better shape than `HANDOVER.md` claims. It is 1064 lines and
all twelve of its hooks are wired: `useVideoControls`, `useBrightness`,
`useVolume`, `useBuffering`, `useSeekBar`, `useGestures`, `useWatchProgress`,
`useSubtitles`, `useAutoPlay`, `useEpisodeNavigation`, `usePlaybackSpeed`,
`useAspectRatio`, `useScreenLock`. Gestures, volume, brightness, seek preview,
lock, speed, aspect ratio and next-episode all work. What follows is what is
genuinely missing.

- [ ] **`isLiveStream` is hardcoded to `false`** (line 444; the same literal is
      passed at lines 293 and 428). The `isLive` nav param is read (line 174)
      and used for back-navigation (line 410), but never reaches the player UI.
      So `LiveIndicator` never shows and the live-only seek suppression at
      line 923 is dead. Either wire `isLive` through, or drop the live path.

- [ ] **No quality / resolution selection.** `expo-video` exposes
      `availableVideoTracks` / `availableAudioTracks`; nothing in `src/` reads
      them. No quality menu exists, and `defaultPlayerQuality` is never applied
      to playback. Biggest gap versus a Netflix/FramexTV-class player.

- [ ] **No audio-track selection.** The types exist (`ProviderTypes.ts` has
      `audioTracks` / `AudioTrack`) but no runtime code consumes them. Matters
      for multi-language titles.

- [ ] **No skip-intro / skip-credits.** `skipIntro` and `skipCredits` live in
      the settings store, are exposed as working-looking toggles in
      `SettingsScreen.tsx` (lines 278-290), and are persisted — but nothing
      reads them. The toggles currently do nothing. Implement them or remove
      them so the UI stops lying.

- [ ] **`defaultPlayerQuality` is displayed but never applied.** Read in
      `useApp.ts`, rendered at `SettingsScreen.tsx:242`, never passed to the
      player.

- [ ] **`subtitleSize` / `subtitleLanguage` are never applied.** `useSubtitles`
      has its own `stylePrefs` / `updateStylePrefs` / `loadSubtitlePreference`
      that do not read the settings store. Two subtitle-preference systems, only
      one reachable from Settings.

- [ ] **`dataSaver` does nothing.** Store plus settings toggle only.

- [ ] **`isTorrent` is passed by the caller but never read.** Leftover from the
      removed piracy layer; `DetailsScreenNew.tsx` still sends it at lines 462
      and 467. Dead on both sides.

- [ ] **`currentPlayingSourceName` is the literal `'licensed'`.** Fine while
      there is one source, but hardcoded rather than derived, so a source label
      would be wrong if the backend ever returns alternatives.

- [ ] **PiP is configured but never exercised.** `allowsPictureInPicture` and
      `startsPictureInPictureAutomatically` are set on the view (lines 818-819)
      and `staysActiveInBackground = true` is set, but there is no enter-PiP
      control and no `setPictureInPicture` call in the player. The store actions
      (`playerSlice.ts:77`, `zustand/store.ts:147`) are never dispatched.

- [ ] **No "Up next" countdown overlay.** The advance logic exists
      (`useAutoPlay`, `NextEpisodeButton`) but there is no pre-advance countdown
      UI.

## 2. Screens that exist but are unreachable

- [ ] **`src/screens/notifications/NotificationsScreen.tsx` has no route.**
      Nothing in `app/` imports it; it compiles but cannot be opened.

- [ ] **`src/screens/downloads/DownloadsScreen.tsx` has no route.**
      `DownloadManager` is initialised in `app/_layout.tsx` and downloads are a
      headline feature, but there is no way to view the download list. Real
      user-facing hole.

## 3. Voice search — stubbed

- [ ] `SearchScreen.tsx:1253` shows "Voice search needs a speech-to-text module
      wired in". The button looks functional. Wire an STT module or remove the
      affordance.

## 4. Recognition engine — not present

There is no recognition engine in the codebase. Searched `recognition`,
`recognize`, `ocr`, `tesseract`, `face detect`, `scene detect`, `intro detect`,
`credit detect`, `whisper`, `speech` across `src/`, `app/` and `modules/`. The
only hits are two comments in `TMDBMetadataAdapter.ts` about TMDB recognising
date formats, and the voice-search toast above.

`modules/` is gone entirely (pawns, mavin-engine, boxoffice, python-scraper all
removed). The deleted `mavin-engine` was a YouTube-extraction engine, not a
recognition engine. Two stale comments still reference it:
`useSearchPagination.ts:4` and `SearchSuggestions.tsx:4`.

- [ ] Decide what "recognition engine" means here, then add it. Candidates, in
      increasing effort: skip-intro detection (pairs with the dead `skipIntro`
      toggle); on-device OCR for burned-in subtitles; speech-to-text for voice
      search and audio-derived subtitles; content fingerprinting to map a file
      to a TMDB id. None is scaffolded — this is new work, not a wiring fix.

## 5. Dead / stale code still present

- [ ] `src/types/domain.ts:48` still declares
      `provider: 'consumet' | 'xyra' | 'vidsrc'` — leftover piracy-layer union.
- [ ] Stale `MavinEngine` comments (`useSearchPagination.ts:4`,
      `SearchSuggestions.tsx:4`).
- [ ] `docs/` is a GitHub Pages site for `flux.byteful.me`, the old product
      name. Rebrand or drop.
- [ ] `TYPESCRIPT-MIGRATION.md` describes a layout that no longer matches: it
      lists `ci.yml` / `expo-build.yml`, both gone, and points at
      `src/components/Card.tsx`, which is not wired in.
- [ ] `react-native.config.ts` disables `ffmpeg-kit-react-native` on both
      platforms, and `ffmpeg-kit-plugin.js` is not referenced from
      `app.config.ts`. If FFmpeg is not wanted for downloads, drop both plus the
      `palash-ffmpeg-kit-react-native-sf` dependency.
- [ ] 41 files have no importers. Most are legitimately reachable (route
      targets, type barrels, `*.d.ts`), but these look genuinely unused and need
      a wire-in-or-delete decision: components `Card.tsx`, `DownloadButton.tsx`,
      `OptimizedImage.tsx`, `RefreshableFlatList.tsx`, `TopNavigation.tsx`,
      `comments/CommentItem.tsx`, `player/CCControls.tsx`,
      `search/AdvancedFilters.tsx`, `search/SearchSuggestions.tsx`,
      `skeleton/SkeletonLoader.tsx`; hooks `content/useContent.ts`,
      `content/useContinueWatching.ts`, `content/useSearchPreloader.ts`,
      `device/useDevice.ts`, `search/useSearchHistory.ts`,
      `search/useSearchPagination.ts`, `search/useSearchSuggestions.ts`,
      `useApp.ts`, `useDebounce.ts`, `useMemoizedValue.ts`,
      `comments/useCommentRealtime.ts`.

## 6. Service-layer duplication (refactor, not deletion)

- [ ] `src/services/cacheService.ts` vs `src/services/cache/CacheManager.ts` —
      both are live. `cacheService` is used by `app/_layout.tsx` and
      `preloaderService.ts`; `cacheManager` by `HomeScreen.tsx`,
      `useSearchPreloader.ts` and `ThrillerPreloader.ts`. Two cache
      implementations in parallel.
- [ ] Two state systems: RTK (`src/store/store.ts` + `src/store/slices/*`) and
      Zustand (`src/store/zustand/*`). Settings values exist in both
      (`settingsSlice.ts` and `zustand/store.ts`), which is part of why several
      toggles above silently do nothing.

## 7. Not verifiable in this sandbox

- [ ] `npm install`, `tsc --noEmit` and a real Metro bundle have not been run
      here. The handover reports ~1041 pre-existing `tsc` errors, concentrated
      in `downloadManager` internals (`HLSDownloader.ts`, `DownloadQueue.ts`,
      `MP4Downloader.ts`, `NetworkMonitor.ts`, `StorageManager.ts`).
- [ ] The backend contract in `LicensedPlaybackService.ts`
      (`GET /v1/playback`, `GET /v1/download` returning
      `{url, type, headers?, expiresAt?}`) is an assumption, never confirmed
      against a running server. Confirm the real URL, key and response shape.
- [ ] `EXPO_PUBLIC_LICENSED_BACKEND_URL` is unset, so the app is still pointed
      at the placeholder `netflix-pro-backend.onrender.com`.

---

## 8. Geolocation + locale-aware content (requested)

**The app has no geolocation of any kind.** Nothing calls `ipapi.co`, nothing
uses `expo-location`, and nothing reads `navigator.geolocation`. Every home
row, the preloader, and the recommendation path fetch language-agnostic TMDB
data with no country or language parameter, so a user in France gets the same
English-language catalogue as a user in the US.

What was found:

- `src/services/unified/metadata/TMDBMetadata.ts` hardcodes
  `US_REGION = 'US'` and `US_PROVIDERS_STRING = '8|9|15|337|1899'` (lines
  10-11) and passes them as `watch_region` / `with_watch_providers` in at
  least four places (lines 63-64, 82-83, 139-140, 166-167).
- `src/services/preloaderService.ts` fetches trending, popular, top-rated and
  upcoming with **no** `language`, `region`, or `with_original_language`
  argument (lines 61-66).
- `src/screens/home/HomeScreen.tsx` does the same in
  `fetchAllContentFromAPI` (lines 407+).
- No i18n framework is installed — no `i18next`, `react-intl`, or
  `expo-localization`. There are ~57 hardcoded English UI strings.
- `src/utils/languageUtils.ts` has a static code-to-name map and a short
  `commonLanguages` list; it is display-only.
- The plumbing partly exists but is never driven by locale:
  `TMDBMetadataAdapter.ts:636` supports `with_original_language`, and the
  Kuryana and Trakt adapters both accept `region` / `watchRegion` /
  `countries` filters. None of it is wired to a detected country.

- [ ] **Add country detection via `ipapi.co`.** Fetch once at startup,
      cache the result (country code, country name, and `languages`), and
      expose it through the settings/store layer alongside the existing
      `subtitleLanguage`. Handle the failure path — offline, rate-limited,
      blocked — by falling back to a sensible default rather than hanging
      the home screen.
- [ ] **Derive a default language from the detected country** and use it as
      the app-wide default, with an explicit user override in Settings that
      always wins.
- [ ] **Pass language + region into every content fetch**: the preloader,
      `HomeScreen`, trending, popular, top-rated, upcoming, discover and
      search. Replace the hardcoded `US_REGION` / `US_PROVIDERS_STRING`.
- [ ] **Default-filter the catalogue by the user's language.** A French user
      should see French content by default via `with_original_language=fr`,
      with other-language titles reachable through search rather than shown
      on the home page. Same behaviour for every other country.
- [ ] **Localize the preloader and the recommendation path**, not just the
      visible rows — the recommendation engine must rank French content for
      a French user by default.
- [ ] **Add an i18n layer for the UI strings** (the ~57 hardcoded English
      strings), so the interface itself follows the detected locale, not only
      the content.
- [ ] **Let search cross the language boundary.** The default catalogue is
      locale-filtered, so a user must still be able to find an English title
      by typing it — verify search does not inherit the default filter.

Open questions to confirm before implementing:
- Does `ipapi.co` get called from the client on every cold start, or once
  and cached? Its free tier is rate-limited per IP, so caching matters.
- Should the country be user-overridable in Settings, and should an override
  also change the UI language or only the content language?
- Should the fallback when detection fails be the device locale
  (`expo-localization`) rather than a hardcoded default?

---

## Suggested order

1. Wire the settings that already have UI (skip-intro, quality, subtitle
   size/language, data-saver) or remove the toggles.
2. Add quality and audio-track selection from `expo-video`'s track APIs.
3. Route `DownloadsScreen` and `NotificationsScreen`.
4. Confirm the licensed backend URL, key and response shape, then test playback.
5. Delete the confirmed-dead components and stale comments.
6. Consolidate the two caches and the two state systems.
7. Add ipapi.co country detection, then wire language and region through the
   preloader, home screen and recommendation path (section 8).
8. Add the UI i18n layer so the interface follows the locale too.
9. Decide and build the recognition engine.
