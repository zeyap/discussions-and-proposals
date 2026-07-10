// Expo config plugin: enable the React Native `viewTransitionEnabled` native
// feature flag at runtime.
//
// The default Android build pulls the prebuilt `com.facebook.react:react-android`
// AAR from Maven, so editing the native ReactNativeFeatureFlagsDefaults sources
// has no effect unless React Native is compiled from source. Overriding the flag
// at app startup is the supported way to flip a native feature flag without a
// source build.
//
// IMPORTANT ordering detail: `loadReactNative(this)` internally calls
// `ReactNativeFeatureFlags.override(...)` (via DefaultNewArchitectureEntryPoint).
// Calling our own `override()` before it throws "Feature flags cannot be
// overridden more than once". So we override AFTER `loadReactNative`, using
// `dangerouslyForceOverride` with a provider that extends
// `ReactNativeNewArchitectureFeatureFlagsDefaults` (the exact base RN uses for
// the stable release level) so every other flag keeps RN's value and only
// `viewTransitionEnabled` changes.
//
// This runs during `expo prebuild`, so it survives regenerating the gitignored
// android/ directory (unlike a manual edit to MainApplication.kt).

const { withMainApplication } = require('expo/config-plugins');

const IMPORTS = [
  'import android.util.Log',
  'import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags',
  'import com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults',
];

const OVERRIDE = `    // Force-enable the viewTransitionEnabled native feature flag after React Native
    // has applied its own defaults (loadReactNative overrides the flags itself).
    // useSharedAnimatedBackend + cxxNativeAnimatedEnabled turn on the shared/C++
    // animated backend, which animateShare needs for connectAnimatedNodeToShadowNodeFamily.
    ReactNativeFeatureFlags.dangerouslyForceOverride(
      object : ReactNativeNewArchitectureFeatureFlagsDefaults() {
        override fun viewTransitionEnabled(): Boolean = true
        override fun useSharedAnimatedBackend(): Boolean = true
        override fun cxxNativeAnimatedEnabled(): Boolean = true
      }
    )
    Log.i("ExpoFFFlag", "viewTransitionEnabled=" + ReactNativeFeatureFlags.viewTransitionEnabled())`;

module.exports = function withViewTransitionFeatureFlag(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (config.modResults.language !== 'kt') {
      throw new Error(
        'withViewTransitionFeatureFlag only supports a Kotlin MainApplication (MainApplication.kt).'
      );
    }

    // Add imports right after the package declaration (once).
    const missing = IMPORTS.filter((imp) => !contents.includes(imp));
    if (missing.length) {
      contents = contents.replace(
        /^(package .*\n)/m,
        `$1\n${missing.join('\n')}\n`
      );
    }

    // Insert the override right AFTER `loadReactNative(this)` in onCreate().
    if (!contents.includes('dangerouslyForceOverride(')) {
      const anchor = /(\n[ \t]*loadReactNative\(this\)\n)/;
      if (!anchor.test(contents)) {
        throw new Error(
          'withViewTransitionFeatureFlag: could not find `loadReactNative(this)` in MainApplication.'
        );
      }
      contents = contents.replace(anchor, `$1${OVERRIDE}\n`);
    }

    config.modResults.contents = contents;
    return config;
  });
};
