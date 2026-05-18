import { Platform } from 'react-native';
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

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/x-m4v',
];

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

// Derive the file extension from the storage path, not the (potentially opaque) URI.
const extFromPath = (storagePath) => {
  const base = storagePath.split('?')[0];
  return (base.split('.').pop() || 'jpg').toLowerCase();
};

// Resolve MIME type: explicit arg wins, then storagePath extension, fallback jpeg.
const resolveMime = (mimeType, storagePath) => {
  if (mimeType) return mimeType;
  const ext = extFromPath(storagePath);
  return MIME_MAP[ext] || 'image/jpeg';
};

/**
 * Convert a URI (file://, blob:, data:, content://, http://) to a Blob.
 * On web, data: URIs are decoded manually to avoid a Fetch no-op on some browsers.
 */
const uriToBlob = async (uri) => {
  // data: URI — decode base64 directly (most reliable on web)
  if (uri.startsWith('data:')) {
    const [header, b64] = uri.split(',');
    const mime = header.split(':')[1].split(';')[0];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  // blob:, file://, content://, http:// — use fetch
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Could not read the selected file (HTTP ${response.status}). Make sure the file is accessible.`);
  }
  return response.blob();
};

/**
 * Upload a local file URI to Supabase Storage.
 * Works on iOS, Android, and web (Expo managed / Expo Go / bare).
 * @param {string} uri          - Local URI from expo-image-picker or expo-document-picker.
 * @param {string} bucket       - Supabase storage bucket name.
 * @param {string} storagePath  - Destination path inside the bucket.
 * @param {object} opts
 * @param {string} [opts.mimeType] - Explicit MIME type (use asset.mimeType from picker).
 * @returns {Promise<string>} Public URL of the uploaded file.
 */
export const uploadToStorage = async (uri, bucket, storagePath, { mimeType } = {}) => {
  if (!uri) throw new Error('No file selected.');

  const type = resolveMime(mimeType, storagePath);

  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error(`Unsupported file type "${type}". Please use JPG, PNG, WEBP, GIF, or MP4.`);
  }

  let blob;
  try {
    blob = await uriToBlob(uri);
  } catch (e) {
    throw new Error(`Failed to read file: ${e.message}`);
  }

  if (!blob || blob.size === 0) {
    throw new Error('The selected file appears to be empty. Please try a different one.');
  }

  if (blob.size > MAX_SIZE) {
    const mb = (blob.size / 1024 / 1024).toFixed(1);
    throw new Error(`File is ${mb} MB — maximum allowed is ${MAX_SIZE / 1024 / 1024} MB.`);
  }

  // Use the blob's actual type if we still have a fallback guess
  const finalType = (blob.type && blob.type !== 'application/octet-stream') ? blob.type : type;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, blob, { contentType: finalType, upsert: true });

  if (uploadError) {
    // Surface actionable Supabase errors
    const msg = uploadError.message || '';
    if (msg.includes('Bucket not found')) {
      throw new Error(`Storage bucket "${bucket}" does not exist. Ask the admin to create it in Supabase.`);
    }
    if (msg.includes('not authorized') || msg.includes('policy')) {
      throw new Error('Upload permission denied. Check storage bucket policies in Supabase.');
    }
    throw new Error(`Upload failed: ${msg}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  if (!data?.publicUrl) throw new Error('Upload succeeded but could not get public URL.');

  return data.publicUrl;
};
