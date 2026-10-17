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

## 9. Decisions locked (do not add these)

Confirmed by the owner. Drafted here so nobody re-adds them later.

| Excluded | Why | What replaces it |
|----------|-----|------------------|
| Sign-in / accounts (C1) | Anonymous by design. A device fingerprint registers the device instead, so the user never sees a login wall | Device fingerprint identity |
| Profile selection screen (C2) | Follows from no accounts | Single implicit profile per device |
| Following friends (G5) | Explicitly out of scope | — |
| Discussions / comments (G1) | Explicitly out of scope | — |
| Referral / invites (G6) | Explicitly out of scope | — |
| Sentry / crash reporting (I2) | Verification happens in this sandbox before pushing | Local compile + test gate |

### Device fingerprint identity (replaces sign-in)

- [ ] Generate a stable device id on first launch and persist it in
      `expo-secure-store` (already a dependency) so it survives app
      reinstalls on the same device. Do **not** use a hardware serial —
      iOS and Android both restrict that; a generated UUID in secure
      storage is the portable choice.
- [ ] Register the device against the backend on first run, and send the
      id on every state call so watch progress, continue-watching and
      preferences follow the device.
- [ ] Reinstall behaviour: if secure-store survives reinstall (Keychain on
      iOS generally does; Android Keystore-backed storage does not always),
      the user resumes where they left off. If it does not survive, fall
      back to a server-side match on a weaker signal rather than showing a
      login screen.
- [ ] Explicitly **no** login UI anywhere, including "restore account".

## 10. Backend: two systems, one superseded (verified in the source)

Corrected after reading the Net-web source at `King-Fisher000/Net-web`
(commit `9d70563`), not from docs.

**There are two backends, and I had them backwards.**

| | Old backend | Net-web (current) |
|---|---|---|
| Host | `netflix-tf79.onrender.com` | not deployed yet |
| Version | "Streaming API" v13.0.0 | merged TUI, 18 handlers |
| Providers | `vidapi, fzmovies, o2tv, kissasian, dramacool, shortdrama, torrents` | 18 handlers / 29 scraper modules |
| Shape | HTTP JSON API | terminal TUI, no HTTP API |
| Status | **superseded — do not wire to this** | baked GHCR image, **not yet pointed at a Render service** |

`netflix-tf79.onrender.com` is the pre-merge service. It still answers, which
is why I mistook it for current. It is not the target. Wiring the app to it
would build against the thing you replaced.

### Why Net-web cannot serve HTTP as it stands (from the code)

- `src/netweb/proxy.py:17` — the only HTTP listener is
  `ThreadingHTTPServer`, bound to `PROXY_HOST = "127.0.0.1"` (`proxy.py:26`).
  Loopback only, started lazily on first playback, random port.
- There is no web framework anywhere. Grepping all of `src/` for
  `FastAPI|Flask|uvicorn|aiohttp|bottle|tornado` returns only **comments**
  saying Flask was removed (`proxy.py:2`, `proxy.py:505`, `main.py:42`).
- `main.py` is `readchar`-driven; without a TTY `cli_utils` raises
  `RuntimeError("not a tty")`.

So a Render service has no port to bind and nothing to serve. This matches
what `AGENTS.md` says, but it is now confirmed in the code.

### The good news: the scraper layer is already a clean library

This is what makes the conversion straightforward. Every module under
`src/netweb/scraping/` is **pure** — zero TUI calls. Counting
`select_from_list|get_user_input|print_info|pause|spinner|skeleton` across all
29 modules returns **0 for every one**.

Their only internal imports are infrastructure: `net_config`, `httpcache`,
`cloudflare`, `i18n`, `config_loader`, `defaults`. None import `cli_utils`,
`player_manager`, `rich`, `readchar` or `mpv`. So the scraping layer can be
imported and called from a web server with no refactor. The TUI consumes the
scrapers; it is not a dependency of them.

`framextv.py` is the best fit for the app and is **TMDB-id based**, which is
exactly what the client already has:

```python
search(tmdb_id=550, media_type="movie")            # -> [{source, url, quality, type, headers}]
search(tmdb_id=1399, media_type="tv", season=1, episode=1)
providers(anime=False)                              # -> live provider registry
```

The return shape is already `{source, url, quality, type, headers}` — close to
what the player needs, and it is browser-free.

### Blocker: the baked image has no Chromium

9 providers drive headless Chromium through `browser_engine.py`:
`anime_sama, asianc, coflix, french_manga, french_stream, goldenanime,
goldenms, nyaa, papystreaming`.

The `Dockerfile` runtime stage installs only `aria2, ffmpeg, mpv,
ca-certificates` plus `yt-dlp`. **No Chromium.** Those 9 will fail on a Render
service built from the current image.

Browser-free and ready to serve today: `framextv, o2tv, shortdrama, moviebox,
dramachi, fourkhdhub, fzmovies, kissasian`.

- [ ] **Rewrite `LicensedPlaybackService.ts` against Net-web, not the old host.**
      Once the API exists, point it at
      `GET /v1/stream?tmdbId=&mediaType=&season=&episode=` and map
      `{source, url, quality, type, headers}` into the player's source shape.
      Drop the placeholder `netflix-pro-backend.onrender.com` and do **not**
      use `netflix-tf79.onrender.com` — that is the old service.
- [ ] Remove the stale `Referer: https://netflix-tf79.onrender.com/` at
      `VideoPlayerScreen.tsx:148`. It points at the superseded backend.
- [ ] Treat `EXPO_PUBLIC_LICENSED_BACKEND_API_KEY` as optional. The old service
      enforced no key (a bogus key still returned 200); the new one should, but
      do not block on it.
- [ ] `/health` capability probe on startup so the app degrades gracefully
      when a provider is down.

## 11. MX Player-class playback controls (requested)

The player already has brightness, volume, gesture seek and a subtitle
settings modal. These are the extras that make it match MX Player.

- [ ] **Audio EQ.** A multi-band equaliser (at minimum 5-band, ideally
      10-band) with presets — Flat, Bass Boost, Treble, Vocal, Loudness.
      `expo-audio`/`expo-video` do not expose EQ, so this needs a native
      audio effect module (Android `AudioEffect`/`Equalizer`, iOS
      `AVAudioUnitEQ`) behind an Expo config plugin. This is the largest
      piece of native work in the roadmap.
- [ ] **Volume amplifier beyond the device maximum.** MX Player's signature
      feature — software gain above 100% system volume. Implement as a
      pre-amp/gain stage in the same native audio chain as the EQ, with
      clipping protection and a visible warning above ~150%. Must not
      distort; a hard limiter is required, not just multiplication.
- [ ] **Per-title audio profile memory** — remember EQ and gain per title,
      same mechanism as A6.
- [ ] **Subtitle styling beyond size**: font family (including a
      dyslexia-friendly option), weight, colour, background box opacity,
      outline/shadow thickness, vertical position, and per-line vs whole
      caption. `SubtitleSettingsModal.tsx` and `useSubtitles.stylePrefs`
      already exist and need extending plus wiring to the Settings values.
- [ ] **Video filters**: brightness, contrast, saturation, sharpness,
      hue, and a night-mode/blue-light filter. Android `SurfaceView` +
      OpenGL shader or `MediaCodec` effects; iOS `AVPlayerItemVideoOutput`
      with a Core Image chain.
- [ ] **Aspect ratio / crop presets** — fit, fill, stretch, 16:9, 4:3,
      zoom. `useAspectRatio.ts` exists; extend it from a toggle into a
      preset list.
- [ ] **Night mode / eye protection** overlay with a colour-temperature
      slider.
- [ ] **Gesture customisation** (A12) — user picks which side does volume
      vs brightness vs seek.

Note on scope: EQ, volume amplification and video filters are **native
modules**, not JavaScript. They need config plugins and a custom dev client,
which means they cannot be tested in a plain Expo Go build. This is worth
confirming before starting, because it changes the build workflow.

---

## 12. Converting Net-web to a Render web service

Keep the TUI working for terminal users, and expose the same scrapers over
HTTP so the app can call them. Additive — it does not replace the TUI.

### Architecture

- [ ] Add an ASGI app (FastAPI or Starlette) that imports `netweb.scraping`
      directly. No scraping logic is duplicated; the server is a second
      consumer of the same modules the TUI uses.
- [ ] Bind `0.0.0.0:$PORT` (Render injects `PORT`). This is the missing piece —
      everything today binds `127.0.0.1`.
- [ ] Keep `proxy.py` as-is for local playback, but the server needs its own
      stream passthrough: many provider URLs carry per-host `Origin`/`Referer`
      requirements a native player cannot set. `_source_headers()` in
      `framextv.py` already computes them, so the server proxies segments with
      the right headers instead of handing a raw URL to the client.
- [ ] Endpoints, mirroring what the client needs:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | status + which providers are live |
| GET | `/v1/stream` | `tmdbId`, `mediaType`, `season`, `episode` -> playable sources |
| GET | `/v1/sources` | provider list, for a settings or debug screen |
| GET | `/v1/subtitles` | `tmdbId`, `mediaType`, `season`, `episode` |
| GET | `/proxy` | header-correct stream passthrough |

- [ ] Provider selection: accept a `providers=` filter defaulting to the
      browser-free set. Do not let a request hang on a provider that needs
      Chromium the image lacks — fail fast and report what was skipped.
- [ ] Response envelope should mirror the old service so the client change is
      small: `{status, info, sources:[{name, data:{stream, subtitle}}]}`.
      That keeps `LicensedPlaybackService.ts` to a URL change plus a parser
      rather than a rewrite.
- [ ] Per-provider timeouts and an overall deadline. Render free-tier cold
      starts take 30-60s; the client already retries with
      `COLD_START_TIMEOUT_MS = 65000`, so the server should not add its own
      long wait on top.
- [ ] Cache resolved streams in-process with a TTL. `httpcache.py` already
      exists and can back this.

### Chromium decision - RESOLVED: option (b), env-gated

Decision: serve the 8 browser-free providers now. Keep the full 18 behind an
environment switch so the paid Render service can turn it on without a code
change or a rebuild.

- [ ] `NETWEB_PROVIDER_SET=core` (default) - the 8 browser-free providers:
      `framextv, o2tv, shortdrama, moviebox, dramachi, fourkhdhub, fzmovies,
      kissasian`. No Chromium needed. Runs on Render's free tier.
- [ ] `NETWEB_PROVIDER_SET=full` - all 18, including the 9 that need headless
      Chromium. Requires the Chromium-enabled image and therefore a paid tier.
- [ ] The switch changes which providers the server offers, nothing else.
      Flipping the variable on a paid service is the entire migration.
- [ ] `GET /v1/sources` reports which set is active and which providers were
      skipped, so the client can show an accurate capability list rather than
      guessing.
- [ ] In `core` mode, a request for a Chromium-only provider fails fast with a
      clear reason instead of hanging on a browser that is not installed.

#### Why this is cheap to switch on later

The two sets differ only in the provider filter and the image. The endpoint
shapes, the response envelope, the passthrough and the client are identical
either way, so `full` is a config flip rather than a second implementation.

#### The TUI is untouched

The server is additive. `main.py`, `cli_utils`, `player_manager`, `proxy.py`
and every handler keep working exactly as they do now, so terminal users lose
nothing. The server is a second consumer of `netweb.scraping`.

### Verified in the sandbox

These were run, not assumed:

- `from netweb.scraping import framextv` imports with **zero** TUI modules
  pulled in - checked by diffing `sys.modules` for `cli_utils`, `readchar`,
  `rich`, `player_manager` and `mpv` after import. None appeared.
- `framextv.search(tmdb_id=550, media_type='movie')` returned **2 real
  playable M3U8 streams** (720p and 480p) with no browser and no API key.
- All 29 modules in `scraping/` contain zero TUI calls.
- `o2tv` degrades to a clean "OCR unavailable" result rather than raising,
  because `pytesseract` and `tesseract` are optional extras (`netweb[ocr]`).
  It can stay in `core`; it simply reports that OCR is unavailable.

### Deployment steps

- [ ] Add `render.yaml` (or configure in the Render dashboard) with `PORT`
      binding and the GHCR image as the source.
- [ ] The image is already baked and published, but it is **not yet pointed at
      a Render service** — that is the outstanding step.
- [ ] Confirm the GHCR package visibility. Anonymous pulls currently fail, so
      Render needs either a public package or registry credentials.
- [ ] Verify `--doctor` still passes in the image after any Dockerfile change.
- [ ] Smoke test from the sandbox: hit `/health`, then `/v1/stream` for a known
      TMDB id, and confirm a playable URL comes back before touching the app.

---

## Suggested order

1. Wire the settings that already have UI (skip-intro, quality, subtitle
   size/language, data-saver) or remove the toggles.
2. Add quality and audio-track selection from `expo-video`'s track APIs.
3. Route `DownloadsScreen` and `NotificationsScreen`.
4. Add the ASGI server to Net-web and deploy it to Render (section 12).
5. Delete the confirmed-dead components and stale comments.
6. Consolidate the two caches and the two state systems.
7. Add ipapi.co country detection, then wire language and region through the
   preloader, home screen and recommendation path (section 8).
8. Add the UI i18n layer so the interface follows the locale too.
9. Rewrite LicensedPlaybackService against the Net-web API (section 10)
   — playback cannot work until this lands, and the old host must not be used.
10. Add device-fingerprint identity in place of sign-in (section 9).
11. Build the MX Player-class audio chain: EQ then volume amplifier (section 11).
12. Decide and build the recognition engine.
