# layout-anim-vt-demo

An Expo (SDK 57) app that tweaks **React Native / React internals reproducibly** to
enable View Transitions, and shows four layout-animation examples side by side
(Reanimated vs React `ViewTransition`).

It includes `react-native-reanimated`, like the default Expo template.

## What this app demonstrates

1. **Flipping RN native feature flags** (`viewTransitionEnabled`, `useSharedAnimatedBackend`, `cxxNativeAnimatedEnabled`) at runtime via an
   Expo **config plugin** that calls `ReactNativeFeatureFlags.dangerouslyForceOverride(...)`
   in `MainApplication.onCreate()` (also enabling the shared/C++ animated backend).
2. **Patching react reconciler + RN renderer** (via `patch-package`) to a matched React
   `19.3.0-canary` so `React.ViewTransition` exists and the reconciler processes it.
3. **Patching npm packages reproducibly** — `patch-package` auto-applies on every
   `npm install` via the `postinstall` hook.
4. **Four layout-animation examples on the Home screen**: 1 · React ViewTransition; 2–4 · Reanimated

## Prerequisites

- Node 20+, npm
- Android SDK + an emulator or device (`adb devices` should list one)
- JDK 17

## Build & run (Android)

```bash
npm install                 # runs postinstall -> patch-package (applies patches/)
npx expo prebuild -p android # generate android/ folder which applies the featureflag overrides
npx expo run:android        # builds from the generated android/, installs
npx expo start --clear    # starts Metro
```

### Build the APK directly (without Metro attaching)

```bash
cd android
./gradlew :app:assembleDebug -x lint -x test --build-cache -PreactNativeArchitectures=arm64-v8a
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.anonymous.layoutanimvtdemo/.MainActivity
```
