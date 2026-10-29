import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '@/lib/supabase';
import { readJSON, writeJSON } from '@/lib/localStore';

/**
 * Captain app only. Streams the boat's position to `boat_positions` while the captain is online,
 * including with the screen off. Imported once at startup (see app/_layout.tsx) because the task must be
 * defined at the top level before React renders.
 * Needs a development or store build: background location does not run in Expo Go.
 */
export const CAPTAIN_TASK = 'captain-location';
const BOAT_KEY = 'captain.boatId';
/** 'boat' streams to boat_positions (captains); 'vehicle' to vehicle_positions (land taxi drivers). */
const KIND_KEY = 'captain.shareKind';
export type ShareKind = 'boat' | 'vehicle';

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(CAPTAIN_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length || !supabase) return;
  const boatId = readJSON<string | null>(BOAT_KEY, null);
  if (!boatId) return;
  const fix = data.locations[data.locations.length - 1];
  const vehicle = readJSON<ShareKind>(KIND_KEY, 'boat') === 'vehicle';
  await supabase.from(vehicle ? 'vehicle_positions' : 'boat_positions').upsert({
    [vehicle ? 'vehicle_id' : 'boat_id']: boatId,
    lon: fix.coords.longitude,
    lat: fix.coords.latitude,
    heading: fix.coords.heading ?? null,
    speed_kmh: fix.coords.speed != null && fix.coords.speed >= 0 ? fix.coords.speed * 3.6 : null,
    online: true,
    updated_at: new Date(fix.timestamp).toISOString(),
  });
});

export type StartResult = 'started' | 'denied' | 'background_denied';

export async function startSharing(boatId: string, notification: { title: string; body: string }, kind: ShareKind = 'boat'): Promise<StartResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return 'background_denied';
  writeJSON(BOAT_KEY, boatId);
  writeJSON(KIND_KEY, kind);
  await Location.startLocationUpdatesAsync(CAPTAIN_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 15,
    activityType: Location.ActivityType.OtherNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: { notificationTitle: notification.title, notificationBody: notification.body, notificationColor: '#FF4A1C' },
  });
  return 'started';
}

export async function stopSharing(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(CAPTAIN_TASK)) {
    await Location.stopLocationUpdatesAsync(CAPTAIN_TASK);
  }
  writeJSON(BOAT_KEY, null);
}

export async function isSharing(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(CAPTAIN_TASK);
}
