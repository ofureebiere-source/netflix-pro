# FEATURES — roadmap to compete with the industry leaders

Assessed against what the code does today. Status is verified, not assumed:
**Present** = wired and reachable · **Partial** = code exists but unwired,
unreachable, or the setting does nothing · **Missing** = not in the tree.

Priority: **P0** = table stakes, a rival cannot ship without it · **P1** =
strong differentiator · **P2** = polish / delight.

---

## A. Player and playback

This is where the app is furthest behind, and it is the feature users judge
first. The foundation is good — twelve hooks, gestures, volume, brightness,
seek preview, lock, speed, aspect ratio and subtitles all work.

| # | Feature | Why it matters | Status today | Pri |
|---|---------|----------------|--------------|-----|
| A1 | Adaptive quality selector (Auto/1080/720/480) | Every major player exposes this; also the fix for buffering on mobile data | **Missing** — `expo-video` exposes track APIs, nothing reads them | P0 |
| A2 | Audio-track selection (multi-language, 5.1/stereo) | Required for non-English titles and accessibility | **Missing** — types exist in `ProviderTypes.ts`, no runtime consumer | P0 |
| A3 | Skip intro / recap / credits | Netflix's signature convenience; `skipIntro` toggle already exists and does nothing | **Partial** — settings persisted, zero consumers | P0 |
| A4 | Subtitle offset / sync nudge ( +/- 0.5s) | Single most-requested player feature for downloaded subs | **Missing** | P0 |
| A5 | Subtitle styling wired to Settings | `subtitleSize`/`subtitleLanguage` in Settings are ignored; `useSubtitles` keeps a separate `stylePrefs` | **Partial** — two competing systems | P0 |
| A6 | Per-title memory (quality, audio, subtitle, speed) | Users hate re-picking settings every episode | **Missing** | P1 |
| A7 | Sleep timer | Standard on every TV/streaming app | **Missing** | P1 |
| A8 | "Up next" countdown overlay | Auto-advance exists with no visual pre-roll | **Partial** — `useAutoPlay` logic only | P1 |
| A9 | Chapter markers / scrub preview thumbnails | Big perceived-quality signal | **Missing** | P1 |
| A10 | Explicit PiP enter/exit control | Configured but never exercised; store action never dispatched | **Partial** | P1 |
| A11 | Live stream support (`isLiveStream`) | Param read then hardcoded `false`; `LiveIndicator` is dead code | **Partial** | P1 |
| A12 | Gesture customisation (which side does what) | Power-user differentiator | **Missing** | P2 |
| A13 | Haptic feedback on seek/skip | Cheap polish, feels premium | **Missing** | P2 |
| A14 | A-B repeat / loop | Niche but loved | **Missing** | P2 |
| A15 | Playback speed presets + pitch correction | Speed exists; verify pitch handling | **Partial** | P2 |
| A16 | Data-saver mode that actually caps quality | `dataSaver` toggle does nothing | **Partial** | P1 |
| A17 | Audio EQ (5-10 band) with presets | MX Player signature; see TODO section 11 | **Missing** | P1 |
| A18 | Volume amplifier past device maximum | MX Player signature; software gain with limiter | **Missing** | P1 |
| A19 | Video filters (contrast/saturation/sharpness/hue) | MX Player-class picture control | **Missing** | P2 |
| A20 | Night mode / blue-light filter | Eye comfort on long sessions | **Missing** | P2 |
| A21 | Aspect ratio / crop presets | `useAspectRatio` exists; extend to presets | **Partial** | P2 |

---

## B. Discovery and personalisation

The metadata layer is genuinely strong — TMDB plus Kuryana plus Trakt
adapters, unified behind one interface, with collections and filtering.

| # | Feature | Why it matters | Status today | Pri |
|---|---------|----------------|--------------|-----|
| B1 | Locale-aware recommendation engine | A French user must get French content by default; today every user gets the same US-flavoured English catalogue | **Missing** — see TODO section 8 | P0 |
| B2 | Personalised "For you" row from watch history | The single biggest driver of engagement | **Partial** — `fetchRecommended*` exists, no behavioural signal | P0 |
| B3 | Continue Watching surfaced and correct | Already stored; needs a guaranteed home row + resume accuracy | **Partial** | P0 |
| B4 | Watch history screen with edit/delete | Users expect control over their data | **Partial** — store exists, no screen | P1 |
| B5 | "Because you watched X" rows | Cheap to build on existing adapters, high perceived intelligence | **Missing** | P1 |
| B6 | Genre / mood / decade browse with infinite scroll | Standard browse surface | **Partial** — genre fetch exists, no dedicated browse UI | P1 |
| B7 | Collections and franchises (MCU, etc.) | Present in adapters and details screen; needs a browse entry point | **Partial** | P1 |
| B8 | Smart search (fuzzy, typo-tolerant, cross-language) | Search must cross the locale filter so a French user can still find an English title | **Partial** | P0 |
| B9 | Search filters UI (year, genre, rating, language) | Filter params exist, `AdvancedFilters.tsx` is unreachable | **Partial** | P1 |
| B10 | Trending by country / region | Adapters accept `region`, nothing drives it | **Partial** | P1 |
| B11 | Trailer autoplay on details | Preloader already fetches trailer keys | **Partial** | P2 |
| B12 | "Leaving soon" / new-episode alerts | Retention driver | **Missing** | P2 |
| B13 | Top 10 in your country | Netflix's most-copied row | **Missing** | P1 |

---

## C. Accounts, profiles and controls

**There are no user accounts and no profile system at all.** This is the
largest structural gap versus Netflix, Prime, Disney+ and FramexTV. Supabase
was deliberately removed, so this needs a decision on the auth backend.

| # | Feature | Why it matters | Status today | Pri |
|---|---------|----------------|--------------|-----|
| C1 | ~~Sign-in (email, Google, Apple)~~ | **Excluded** — replaced by anonymous device fingerprint (TODO section 9) | Dropped | — |
| C2 | ~~Multiple profiles per account~~ | **Excluded** — follows from no accounts; one implicit profile per device | Dropped | — |
| C3 | Per-profile watch history and recommendations | Follows from C2 | **Missing** | P0 |
| C4 | Kids profile with restricted catalogue | Table stakes for a household product | **Missing** | P0 |
| C5 | Parental controls: PIN, maturity ratings | 20 files mention maturity but no UI enforces it | **Partial** | P0 |
| C6 | Cross-device resume | Requires C1 | **Missing** | P1 |
| C7 | Trakt / Letterboxd scrobbling | Trakt service exists, needs a settings toggle | **Partial** | P1 |
| C8 | Account deletion / data export | Regulatory requirement (GDPR) | **Missing** | P1 |
| C9 | Avatar selection | Polish for C2 | **Missing** | P2 |

---

## D. Downloads and offline

The engine is the most complete part of the app — HLS and MP4 downloaders, a
queue, storage manager, cleanup service and FFmpeg conversion. Almost none of
it is reachable.

| # | Feature | Why it matters | Status today | Pri |
|---|---------|----------------|--------------|-----|
| D1 | Downloads screen routed and reachable | `DownloadManager` runs at startup; no way to see the list | **Partial** — no route | P0 |
| D2 | Download quality selector | Users pick 480p to save space | **Missing** | P0 |
| D3 | Smart storage management with quota | `StorageManager` exists, no user-facing control | **Partial** | P1 |
| D4 | Auto-delete watched downloads | `autoDeleteUnwatchedDays` setting exists | **Partial** — setting ignored | P1 |
| D5 | Background download queue | `expo-background-task` installed | **Partial** | P1 |
| D6 | Download whole season in one tap | Expected for series | **Missing** | P1 |
| D7 | SD-card / external storage target | Common Android request | **Missing** | P2 |
| D8 | Offline playback verified end to end | Offline mode is wired in the player; needs a real test | **Partial** | P0 |

---

## E. Localisation and geo

| # | Feature | Why it matters | Status today | Pri |
|---|---------|----------------|--------------|-----|
| E1 | `ipapi.co` country detection | Drives every locale decision below | **Missing** | P0 |
| E2 | Content language defaulted from country | A French user should see French titles by default | **Missing** | P0 |
| E3 | UI i18n (interface follows locale) | ~57 hardcoded English strings; no i18n framework installed | **Missing** | P0 |
| E4 | Metadata in the user's language | TMDB supports `language=`; no call passes it | **Missing** | P0 |
| E5 | Region-correct availability / providers | `US_REGION` and a US provider list are hardcoded | **Partial** | P1 |
| E6 | RTL layout support | Needed for Arabic/Hebrew | **Missing** | P1 |
| E7 | Manual country override in Settings | Travellers and VPN users | **Missing** | P1 |

---

## F. Accessibility

Currently nothing. Netflix and Disney+ treat this as a hard requirement.

| # | Feature | Why it matters | Status today | Pri |
|---|---------|----------------|--------------|-----|
| F1 | Screen-reader labels on every control | Legal requirement in many markets | **Missing** | P0 |
| F2 | Audio description tracks | Accessibility standard | **Missing** | P1 |
| F3 | High-contrast / colourblind-safe theme | Theme system exists, no a11y variant | **Partial** | P1 |
| F4 | Full keyboard / D-pad navigation | Prerequisite for TV support | **Missing** | P1 |
| F5 | Larger subtitle presets + dyslexia-friendly font | Cheap, high goodwill | **Missing** | P2 |
| F6 | Reduce-motion support | Reanimated is used heavily | **Missing** | P2 |

---

## G. Social and engagement

| # | Feature | Why it matters | Status today | Pri |
|---|---------|----------------|--------------|-----|
| G1 | ~~Comments / episode discussions~~ | **Excluded** by owner decision | Dropped | — |
| G2 | Watch party with synced playback | Genuine differentiator; nothing comparable in the codebase | **Missing** | P1 |
| G3 | Share title / deep link to a title | `deepLinking.ts` exists, unwired | **Partial** | P1 |
| G4 | Ratings and reviews | Rating plumbing across 51 files, no user-facing submit | **Partial** | P1 |
| G5 | ~~Follow friends / activity feed~~ | **Excluded** by owner decision | Dropped | — |
| G6 | ~~Referral / invite flow~~ | **Excluded** by owner decision | Dropped | — |

---

## H. Platform and devices

| # | Feature | Why it matters | Status today | Pri |
|---|---------|----------------|--------------|-----|
| H1 | Cast (Chromecast) and AirPlay | Present in zero files; a real gap for a TV-adjacent app | **Missing** | P1 |
| H2 | Android TV / Fire TV build | Same codebase, large audience | **Missing** — no leanback config | P1 |
| H3 | Apple TV (tvOS) | `react-native-tvos` not installed | **Missing** | P2 |
| H4 | Home-screen widgets / Now Playing | Platform polish | **Missing** | P2 |
| H5 | Push notifications for new episodes | `NotificationService` exists, screen unrouted | **Partial** | P1 |
| H6 | Web build | Expo supports it; unclear if intended | **Missing** | P2 |

---

## I. Performance, reliability and trust

| # | Feature | Why it matters | Status today | Pri |
|---|---------|----------------|--------------|-----|
| I1 | **Remove `vidsrc.extractor.module` and `tmdb-embed-providers`** | These are still declared in `package.json` and pinned to a GitHub repo. They are the piracy layer the termux work set out to delete. This is a legal and store-review risk, not a feature | **Present — must go** | **P0** |
| I2 | ~~Sentry / crash reporting~~ | **Excluded** — verified in the sandbox before pushing | Dropped | — |
| I3 | Error boundaries per screen | `ErrorBoundary.tsx` exists, unwired | **Partial** | P1 |
| I4 | Offline-first caching strategy | Two competing cache implementations run in parallel today | **Partial** | P1 |
| I5 | Startup performance budget | Preloader exists; needs measurement | **Partial** | P1 |
| I6 | Test suite + CI | Zero tests, no working CI | **Missing** | P0 |
| I7 | Secrets management (no keys in the repo) | Keys were found hardcoded and sanitised; needs a guardrail so it cannot regress | **Partial** | P0 |
| I8 | Consolidate the two state systems | RTK and Zustand both hold settings, which is why toggles silently fail | **Partial** | P1 |
| I9 | Telemetry on playback failures | Needed to fix buffering complaints | **Missing** | P1 |
| I10 | Bandwidth / battery awareness | Auto-quality on cellular | **Missing** | P2 |

---

## Priority summary

| Tier | Count | Themes |
|------|-------|--------|
| **P0 — ship blockers** | 21 | Player quality/audio/skip-intro, parental controls, downloads routed, i18n and geo, accessibility labels, piracy deps removed, tests and CI |
| **P1 — differentiators** | 32 | Personalised recommendations, top 10 by country, watch party, cast and TV builds, subtitle offset, sleep timer, cross-device sync |
| **P2 — polish** | 19 | Haptics, avatars, widgets, RTL refinements, niche player modes |

## The honest read

The metadata and download engines are already better than a lot of shipping
apps. The gaps that matter are not exotic features — they are the boring
basics: **the player cannot pick a quality or an audio track, there are no
profiles, the downloads screen cannot be opened, and the app has no idea
where the user is.** Those four things are what a user notices in the first
ten minutes, and they are what separates this from Netflix.

Two items deserve flagging above all others. The piracy dependencies still
sitting in `package.json` (I1) are a legal and app-store risk that contradicts
the entire point of the termux cleanup. And the ~57 hardcoded English strings
plus the hardcoded `US_REGION` mean the app is currently a US product wearing
a global label.

## Excluded by owner decision

Not to be built: sign-in and accounts (replaced by an anonymous device
fingerprint), profile selection, following friends, discussions/comments,
referral flows, and Sentry. See TODO section 9 for the device-fingerprint
design that stands in for sign-in.
