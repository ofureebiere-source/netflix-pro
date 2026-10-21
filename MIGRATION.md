# MIGRATION.md — wiring audit and the path to a working app

Analysis of the `King-Fisher000/netflix-pro` tree, verified by reading code and
running the toolchain, not inferred from `HANDOVER.md` / `TODO.md` / `FEATURES.md`.
Those three docs disagree with each other and are stale in places; where they do,
this file records what the code actually does.

## What was verified, and how

| Claim in the docs | Reality |
|---|---|
| ~1041 pre-existing `tsc` errors (TODO §7) | **False.** `npx tsc --noEmit` exits 0, clean. |
| `npm install` cannot run in the sandbox | It can, with `--legacy-peer-deps`. |
| Tests exist (`jest.config.ts`, 3 `*.test.ts`) | Config and specs exist, but **jest itself is not installed** — `jest`, `@testing-library/react-native` and `react-test-renderer` are all missing from `devDependencies`. `npm test` cannot run at all. |
| Branch is `termux` | **Only `main` exists** on the king-fisher remote. |

The toolchain is therefore usable: typecheck works, and the test suite is
one dependency fix away from running.

## Two different apps are in play

The request was to represent the website in the app "verbatim". Worth stating
plainly what each side is, because they are not the same product:

- **`movie-web`** — a React + Vite + Tailwind **web SPA** (SPA router, DOM,
  `hls.js`, Cache Storage, Service Worker). 22 pages, its own dark theme.
- **`netflix-pro`** — an **Expo / React Native** app (expo-router, native
  screens, `expo-video`, MMKV). No DOM, no Service Worker, no `hls.js`; the
  native video pipeline replaces all of it.

"Verbatim" can therefore only mean the *visual design and information
architecture* — the layout, the dark palette, the card/rail shapes, the
screen set. The runtime cannot be shared: `hls.js` and Cache Storage do not
exist in React Native, and `expo-video` already owns playback. A literal port
would mean discarding the entire native player.

Both already talk to the **same backend** (`Net-web`). `LicensedPlaybackService`
targets `/v1/stream`, `/v1/subtitles`, `/proxy` — the same endpoints
`movie-web` uses, and it already groups sources by the `qualityHeight` /
`qualityLabel` the server returns. So the data layer is already aligned; the
gap is presentation and the player's own wiring.

## The wiring gaps, in priority order

### P0 — the app's toggles currently lie

These are not missing features. They are controls the user can see and change
that are read by nothing, which is worse than not having them.

1. **`skipIntro` / `skipCredits`** — persisted, rendered as working switches in
   `SettingsScreen.tsx:252,262`, read by no code. Implement skip-intro
   detection (chapter markers from the stream, or a per-title offset) or remove
   the switches.
2. **`defaultPlayerQuality`** — displayed at `SettingsScreen.tsx:214`, read in
   `useApp.ts`, never passed to the player.
3. **`dataSaver`** — store plus toggle only; no quality cap applied.
4. **`subtitleSize` / `subtitleLanguage`** — in the settings store, ignored.
   `useSubtitles` keeps a second, separate `stylePrefs` system, so there are two
   competing subtitle preference stores and only one is reachable from Settings.
5. **`isLiveStream`** — hardcoded `false` at `VideoPlayerScreen.tsx:494` (and
   the same literal at 345, 478). The `isLive` nav param *is* read (line 192)
   and used for back-navigation (line 459), but never reaches the UI, so
   `LiveIndicator` never renders and the live-only seek suppression is dead.

### P0 — no quality or audio selection

`expo-video` exposes `availableVideoTracks` / `availableAudioTracks`; nothing in
`src/` reads either (verified: zero hits in `VideoPlayerScreen.tsx`). This is the
largest gap versus any streaming app, and the fix is well-defined — build a
track menu from those two lists, apply the user's pick, and feed
`defaultPlayerQuality` and `dataSaver` into it as the initial selection.

### P0 — screens that compile but cannot be opened

- `src/screens/downloads/DownloadsScreen.tsx` — `DownloadManager` is initialised
  in `app/_layout.tsx` and downloads are a headline feature, but there is no
  route to the list. 373 lines, unreachable.
- `src/screens/notifications/NotificationsScreen.tsx` — 635 lines, no route.

`app/_layout.tsx` registers only `(tabs)`, `movie/[id]` and `player/[id]`; the
actual player file is `app/player/index.tsx`, so the registered `player/[id]`
matches no file and the real route is unregistered.

### P0 — the piracy layer is still declared

`package.json` still lists `tmdb-embed-providers` and
`vidsrc.extractor.module` (pinned to a GitHub repo). Neither is imported
anywhere — verified by grepping for import/require. They are dead declarations
that contradict the entire licensed-backend direction and are a store-review
liability. Stale unions remain in `ProviderTypes.ts:1628`, `domain.ts:40,48`
and a comment in `MetadataService.ts:6`.

### P1 — duplication that causes silent failures

- **Two caches:** `services/cacheService.ts` (used by `app/_layout.tsx`,
  `preloaderService.ts`) and `services/cache/CacheManager.ts` (used by
  `HomeScreen.tsx`, `useSearchPreloader.ts`, `ThrillerPreloader.ts`). Both live.
- **Two state systems:** RTK (`store/store.ts` + `store/slices/*`) and Zustand
  (`store/zustand/*`). Settings values exist in both, which is part of why the
  toggles above silently do nothing — a write goes to one store and the read
  comes from the other.

### P1 — genuinely new work, not wiring

Recorded so it is not mistaken for a wiring fix: profiles/kids mode (C3, C4),
parental PIN (C5), geo/locale (E1–E7), accessibility labels (F1), watch party
(G2), cast (H1), Android TV (H2), i18n (E3, ~57 hardcoded strings). Each is a
feature build with its own design decisions. See `FEATURES.md`.

## Execution order

1. Route the unreachable screens; fix the `player/[id]` mismatch. *(done)*
2. Player track selection (quality + audio), seeded from
   `defaultPlayerQuality` / `dataSaver`. *(done)*
3. Make the lying toggles real: skip-intro/credits, subtitle prefs. *(done)*
4. Wire `isLive` through; add the PiP control; drop `isTorrent`.
5. Remove the piracy dependencies and stale unions.
6. Repair the test suite (add jest + RN testing library) so regressions are
   catchable at all.
7. Consolidate the two caches and the two state systems.
8. Hand the P1 feature list back for prioritisation.

Steps 1–6 are wiring and are done in this pass. Steps 7–8 are refactors and
feature builds with real design trade-offs, and are left with a plan rather
than a half-finished refactor.
