import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One codebase, two apps:
 *   APP_VARIANT=guest   (default) → the tourist app
 *   APP_VARIANT=captain           → the captain app (background GPS)
 * OPEN DECISIONS before the first store build (README.md "Open decisions"): final brand name and bundle ids.
 * Bundle ids can never change after the first App Store / Play Store release.
 */
const VARIANT = (process.env.APP_VARIANT ?? 'guest') as 'guest' | 'captain';
const BRAND = process.env.BRAND_NAME ?? 'Roatán Water Taxi';
const BUNDLE_BASE = process.env.BUNDLE_ID_BASE ?? 'com.roatanexperience.watertaxi';
const IS_CAPTAIN = VARIANT === 'captain';
// No-download website. Booking links (/l/…, /split/…, /ship/…) open the app when it's installed.
// Requires the two verification files on that site — see docs/CRUISE.md "Universal links".
const WEB_HOST = new URL(process.env.EXPO_PUBLIC_WEB_URL ?? 'https://roatanwatertaxi.com').host;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_CAPTAIN ? `${BRAND} Captain` : BRAND,
  owner: 'deanbodden',
  slug: IS_CAPTAIN ? 'water-uber-captain' : 'water-uber',
  scheme: IS_CAPTAIN ? 'islandride-captain' : 'islandride',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: IS_CAPTAIN ? `${BUNDLE_BASE}.captain` : BUNDLE_BASE,
    supportsTablet: false,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
    ...(IS_CAPTAIN ? {} : { associatedDomains: [`applinks:${WEB_HOST}`] }),
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
    ...(IS_CAPTAIN
      ? {}
      : {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              data: ['/l/', '/split/', '/ship/'].map((pathPrefix) => ({ scheme: 'https', host: WEB_HOST, pathPrefix })),
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ],
        }),
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro' },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    'expo-sqlite',
    'expo-video',
    [
      'expo-image-picker',
      {
        photosPermission: 'Lets you add a photo to a post, or identify a fish from a photo you took.',
        cameraPermission: 'Lets you take a photo of a fish to identify it, or to share a sighting.',
        microphonePermission: false,
      },
    ],
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
    eas: { projectId: process.env.EAS_PROJECT_ID ?? (IS_CAPTAIN ? undefined : 'e04fa82d-56e2-4fa2-a255-286935a7b916') },
  },
});
