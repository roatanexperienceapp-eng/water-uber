import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One codebase, two apps:
 *   APP_VARIANT=guest   (default) → the tourist app
 *   APP_VARIANT=captain           → the captain app (background GPS)
 * OPEN DECISIONS before the first store build (docs/DECISIONS.md): final brand name and bundle ids.
 * Bundle ids can never change after the first App Store / Play Store release.
 */
const VARIANT = (process.env.APP_VARIANT ?? 'guest') as 'guest' | 'captain';
const BRAND = process.env.BRAND_NAME ?? 'Water Uber';
const BUNDLE_BASE = process.env.BUNDLE_ID_BASE ?? 'com.roatanexperience.watertaxi';
const IS_CAPTAIN = VARIANT === 'captain';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_CAPTAIN ? `${BRAND} Captain` : BRAND,
  slug: IS_CAPTAIN ? 'islandride-captain' : 'islandride',
  scheme: IS_CAPTAIN ? 'islandride-captain' : 'islandride',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: IS_CAPTAIN ? `${BUNDLE_BASE}.captain` : BUNDLE_BASE,
    supportsTablet: false,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: IS_CAPTAIN ? `${BUNDLE_BASE}.captain` : BUNDLE_BASE,
    adaptiveIcon: {
      backgroundColor: '#FF4A1C',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro' },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-location',
      IS_CAPTAIN
        ? {
            locationAlwaysAndWhenInUsePermission: 'Your boat position is shared with guests only while you are online.',
            locationWhenInUsePermission: 'Your boat position is shared with guests only while you are online.',
            isIosBackgroundLocationEnabled: true,
            isAndroidBackgroundLocationEnabled: true,
            isAndroidForegroundServiceEnabled: true,
          }
        : {
            locationWhenInUsePermission: 'Shows boats, docks and pharmacies near you.',
          },
    ],
    [
      'react-native-maps',
      {
        // Android always uses Google Maps and needs this key for store builds. iOS uses Apple Maps (no key).
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY,
      },
    ],
  ],
  experiments: { typedRoutes: false },
  extra: {
    variant: VARIANT,
    brandName: BRAND,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
