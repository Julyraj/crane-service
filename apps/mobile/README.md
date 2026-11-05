# CraneGo Mobile (Android & iOS)

There are two ways to put CraneGo on a phone:

## 1. Install the PWA (no app store needed)

Open your CraneGo server URL in Chrome (Android) or Safari (iOS), then tap **Add to Home screen**.
The web app ships a manifest, icons and a service worker, so it opens full screen like a native
app. GPS sharing for operators works while the app is open.

## 2. Native app with Capacitor

The native app bundles the same React UI and talks to your server over HTTPS.

```bash
# 1. Build the UI with the absolute API origin baked in
cd ../..
VITE_API_BASE=https://book.yourcompany.in pnpm --filter @crane/ui build

# 2. Copy the web build into the native projects and open them
cd apps/mobile
npm install
npx cap sync android     # the Android project is already in apps/mobile/android
npx cap open android     # build / run / sign from Android Studio (JDK 21 + Android SDK)
npx cap add ios          # first time only, on macOS with Xcode
npx cap open ios
```

The server must allow the app's origin for CORS. The default `CORS_ORIGINS` already includes
`https://localhost` (Android, `androidScheme: https`) and `capacitor://localhost` (iOS):

```
CORS_ORIGINS=https://localhost,capacitor://localhost
```

Android location permissions for operators are already declared in
`android/app/src/main/AndroidManifest.xml`.

iOS: add `NSLocationWhenInUseUsageDescription` to `ios/App/App/Info.plist`.

Background location (tracking with the screen off) needs a foreground-service plugin and
Play Store / App Store review justification; it is on the roadmap, not in this MVP.
