#!/bin/bash
# build-android.sh - Build a signed release APK locally, without EAS.
#
# The output name matches what CI publishes and what the in-app updater
# expects: dist/netflix-pro-<version>.apk
#
# Signing follows android/app/build.gradle: a keystore.properties file (or the
# KEYSTORE_PASSWORD / KEY_ALIAS / KEY_PASSWORD env vars) selects the release
# keystore; otherwise Gradle falls back to the debug key, which is fine for a
# local smoke test but not for distribution.
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")

echo "Building Netflix Pro ${VERSION} (release)..."
cd android
./gradlew clean
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
cd ..

SRC=$(find android/app/build/outputs/apk/release -name '*.apk' | head -n 1)
if [ -z "$SRC" ]; then
  echo "No release APK produced." >&2
  exit 1
fi

mkdir -p dist
OUT="dist/netflix-pro-${VERSION}.apk"
cp "$SRC" "$OUT"
echo "APK: $OUT"
