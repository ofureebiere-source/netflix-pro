# TypeScript

The migration to TypeScript is complete: every source file under `src/` and
`app/` is `.ts` or `.tsx`, and `tsc --noEmit` is part of the build.

## Toolchain

| Tool | Version |
|------|---------|
| React Native | 0.83.6 |
| Expo | 55 |
| TypeScript | 5.9 (`strict`) |
| Jest | `jest-expo` preset |

## Layout

```
app/                  expo-router routes ((tabs), player, downloads, notifications)
src/
  components/         presentational components, incl. Card.tsx
  contexts/           theme, alert, ...
  hooks/              usePlayerTracks, useSubtitles, useSkipMarkers, useTranslation, ...
  i18n/               UI translations + lookup runtime
  screens/            home, search, details, player, downloads, settings, library
  services/
    device/           device identity (secure storage)
    locale/           country detection + locale holder
    recognition/      intro/credits detection
    unified/          metadata adapters, stream resolution, subtitles
    downloadManager/  queue + HLS download + FFmpeg remux
  store/zustand/      persisted app state
  types/              shared domain types
  utils/              storage, formatting, download storage
.github/workflows/    android.yml (the only workflow)
```

## Commands

- `npm run type-check` — `tsc --noEmit`
- `npm test` — Jest
- `npm run lint` / `npm run format`
- `npm run build` — type-check then `expo export`

## Conventions

- `strict` is on; no implicit `any`, and `any` at a boundary is a last resort
  that should carry a comment saying why.
- Shared shapes live in `src/types/` or alongside their service. Two overlapping
  definitions of the same concept is the thing to avoid.
- A native module with no JS fallback needs a mock in `jest.setup.js` before any
  test can import the module that uses it.
