# Netflix Pro

React Native / Expo streaming app. Browse movies and series, resolve playable
streams from multiple providers, and play them with subtitles.

## Stack

- React Native 0.83 / Expo 55, TypeScript, expo-router
- Redux Toolkit + Zustand for state, TanStack Query for data fetching
- expo-video for playback, MMKV + AsyncStorage for persistence
- Native modules under `modules/` (see below)

## Layout

```
app/                  expo-router routes (tabs, movie, player, search)
src/
  api/                content API clients
  components/         shared UI
  contexts/           React contexts
  hooks/              data + playback hooks
  navigation/         navigation helpers
  screens/            screen implementations
  services/           metadata, providers, subtitles, downloads, storage
  store/              Redux slices and API layer
  types/              shared TypeScript types
  utils/              helpers
modules/              local Expo native modules
android/ ios/         native project shells
docs/                 GitHub Pages site
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file from the template and fill in your own keys:

   ```bash
   cp .env.example .env
   ```

   `EXPO_PUBLIC_*` values are inlined into the client bundle, so treat them as
   public. Never put a secret you need to keep private in one.

3. Run:

   ```bash
   npm start          # Expo dev server
   npm run android    # build and run on Android
   npm run type-check # tsc --noEmit
   npm test           # jest
   ```

## Secrets

No API keys, keystores, or signing passwords are committed. `.env.example`
lists every variable the app reads with placeholder values. Android release
signing reads `android/keystore.properties`, which ships with placeholders -
generate your own keystore and fill it in locally.

If you previously used a build from an older archive, rotate the credentials
that archive contained: the TMDB, OpenSubtitles, Supabase, Xyra and SubDL keys,
and the Android signing key. They were committed in plaintext and must be
considered public.

## Local native modules

| Module | Purpose |
|---|---|
| `modules/boxoffice` | Nitro module, box-office data |
| `modules/mavin-engine` | Player engine bridge |
| `modules/pawns` | Bandwidth-sharing SDK integration |
| `modules/python-scraper` | Python scraper bridge |

## License

See `LICENSE`.
