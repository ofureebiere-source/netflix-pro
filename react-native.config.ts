/**
 * Autolinking exclusions.
 *
 * `ffmpeg-kit-react-native` is the retired upstream package. The app uses
 * `palash-ffmpeg-kit-react-native-sf`, a maintained fork that must stay
 * autolinked — the downloader calls into it via `FFmpegConverter`. The
 * exclusion below names only the retired package, so it is a no-op today and
 * exists to stop the old one from being pulled in if a dependency ever
 * reintroduces it.
 *
 * The fork ships its own `android/` sources and podspec, so it needs no config
 * plugin; `ffmpeg-kit-plugin.js` predates it and is not referenced from
 * `app.config.ts`.
 */
module.exports = {
  dependencies: {
    'ffmpeg-kit-react-native': {
      platforms: {
        ios: null,
        android: null
      },
    },
  },
};
