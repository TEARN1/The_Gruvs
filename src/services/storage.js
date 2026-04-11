import { supabase } from './supabase';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

/**
 * Uploads a file to Supabase Storage
 * @param {string} bucket - The name of the storage bucket
 * @param {string} path - The destination path in the bucket
 * @param {string} uri - The local URI of the file to upload
 * @returns {Promise<string|null>} - The public URL of the uploaded file
 */
export const uploadFile = async (bucket, path, uri) => {
  if (!supabase) {
    console.warn('[STORAGE] Supabase not initialized. Skipping upload.');
    return uri; // Return local URI for demo/offline mode
  }

  try {
    let fileBody;
    let contentType = 'image/jpeg';
    if (path.endsWith('.mp4')) contentType = 'video/mp4';

    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      fileBody = await response.blob();
    } else {
      // For mobile, we use base64 to avoid some blob issues with the supabase-js client
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      fileBody = decode(base64);
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, fileBody, {
        contentType,
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (err) {
    console.error('[STORAGE UPLOAD ERROR]', err);
    return null;
  }
};

/**
 * Uploads multiple media items and returns an array of media objects with public URLs
 * @param {Array} mediaItems - Array of { type: 'photo'|'video', uri: string }
 * @param {string} userId - The ID of the user uploading the media
 * @returns {Promise<Array>} - Array of { type: string, url: string }
 */
export const uploadMediaBatch = async (mediaItems, userId) => {
  if (!mediaItems || mediaItems.length === 0) return [];

  const uploadPromises = mediaItems.map(async (item, index) => {
    const extension = item.type === 'video' ? 'mp4' : 'jpg';
    const fileName = `${Date.now()}_${index}.${extension}`;
    const filePath = `${userId}/${fileName}`;

    const url = await uploadFile('event-media', filePath, item.uri);
    return url ? { type: item.type, url } : null;
  });

  const results = await Promise.all(uploadPromises);
  return results.filter(item => item !== null);
};
