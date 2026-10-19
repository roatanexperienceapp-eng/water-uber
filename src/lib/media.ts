import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LIMITS } from '../../supabase/functions/_shared/community.ts';

/**
 * Photo / video picking for posts and the fish scanner.
 * Photos are shrunk on the phone (1280 px, JPEG 70%) so they upload quickly on island data.
 */
export interface PickedMedia {
  uri: string;
  kind: 'image' | 'video';
  mime: string;
  base64?: string;
}

export type PickError = 'permission' | 'video_too_long' | 'video_too_big' | 'cancelled';

async function finish(res: ImagePicker.ImagePickerResult, wantBase64: boolean): Promise<PickedMedia | PickError> {
  if (res.canceled || !res.assets?.[0]) return 'cancelled';
  const a = res.assets[0];
  if (a.type === 'video') {
    if ((a.duration ?? 0) > LIMITS.videoSeconds * 1000 + 500) return 'video_too_long';
    if ((a.fileSize ?? 0) > LIMITS.videoBytes) return 'video_too_big';
    return { uri: a.uri, kind: 'video', mime: a.mimeType ?? 'video/mp4' };
  }
  const width = a.width && a.width < 1280 ? a.width : 1280;
  const out = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: wantBase64 });
  return { uri: out.uri, kind: 'image', mime: 'image/jpeg', base64: out.base64 };
}

export async function pickMedia(opts: { camera: boolean; allowVideo: boolean; base64?: boolean }): Promise<PickedMedia | PickError> {
  const perm = opts.camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return 'permission';
  const common: ImagePicker.ImagePickerOptions = {
    mediaTypes: opts.allowVideo ? ['images', 'videos'] : ['images'],
    quality: 0.8,
    videoMaxDuration: LIMITS.videoSeconds,
    exif: false,
  };
  const res = opts.camera ? await ImagePicker.launchCameraAsync(common) : await ImagePicker.launchImageLibraryAsync(common);
  return finish(res, !!opts.base64);
}
