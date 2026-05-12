import { supabase } from './supabase';

const MIME_MAP = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
  gif:  'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4:  'video/mp4',
  mov:  'video/quicktime',
  m4v:  'video/x-m4v',
};

/**
 * Upload a local file URI to Supabase Storage.
 * Works on iOS, Android, and web (Expo managed).
 * Returns the public URL of the uploaded file.
 */
export const uploadToStorage = async (uri, bucket, storagePath, { mimeType } = {}) => {
  const ext = (uri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
  const type = mimeType || MIME_MAP[ext] || 'image/jpeg';

  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not read file (status ${response.status})`);

  const blob = await response.blob();
  if (blob.size === 0) throw new Error('File is empty — please try a different photo.');

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, blob, { contentType: type, upsert: true });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
};
