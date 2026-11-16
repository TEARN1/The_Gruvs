import { supabase } from './supabase';
// The native path below calls this to strip GPS out of photo bytes. It was
// never imported, so on native (no canvas) the call threw a ReferenceError,
// the enclosing `catch { return blob; }` swallowed it, and the ORIGINAL image
// uploaded with its EXIF GPS intact — the exact leak this code exists to stop.
import { stripExifFromBlob } from '../utils/stripExif';

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
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  '3gpp': 'video/3gpp',
  ogg:  'video/ogg',
  ogv:  'video/ogg',
  mkv:  'video/x-matroska',
  avi:  'video/avi',
  mpg:  'video/mpeg',
  mpeg: 'video/mpeg',
  pdf:  'application/pdf',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt:  'text/plain',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  bin:  'application/octet-stream',
};

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm',
  'video/3gp', 'video/3gpp', 'video/ogg', 'video/x-matroska',
  'video/avi', 'video/mpeg',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
];

// ── Per-bucket size limits — these MIRROR the real limits on storage.buckets ──
// Keep this in sync with:  select id, file_size_limit from storage.buckets;
const BUCKET_LIMITS = {
  avatars:        15 * 1024 * 1024,   // 15 MB
  covers:         20 * 1024 * 1024,   // 20 MB
  chat_media:     25 * 1024 * 1024,   // 25 MB
  moments:        50 * 1024 * 1024,   // 50 MB
  'event-media':  100 * 1024 * 1024,  // 100 MB
  reels:          100 * 1024 * 1024,  // 100 MB
};
const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // never exceed the smallest common ceiling

const limitFor = (bucket) => BUCKET_LIMITS[bucket] ?? DEFAULT_MAX_SIZE;
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '');

// Storage paths are `${userId}/...` and RLS keys ownership off the first
// segment. Refuse anything that could step outside that folder or be
// interpreted differently by the storage API: `..` segments, absolute paths,
// backslashes, control characters, or an absurd length.
const assertSafeStoragePath = (p) => {
  const s = String(p || '');
  // eslint-disable-next-line no-control-regex
  if (!s || s.length > 512 || s.startsWith('/') || s.includes('\\') || /[\u0000-\u001f\u007f]/.test(s)
      || s.split('/').some(seg => seg === '..' || seg === '.')) {
    throw new Error('Invalid upload path.');
  }
};

const extFromPath = (storagePath) => {
  const base = storagePath.split('?')[0];
  return (base.split('.').pop() || 'jpg').toLowerCase();
};

const resolveMime = (mimeType, storagePath) => {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
  const ext = extFromPath(storagePath);
  return MIME_MAP[ext] || 'application/octet-stream';
};

// On React Native, XMLHttpRequest handles file:// URIs more reliably than fetch()
const uriToBlob = (uri) => new Promise((resolve, reject) => {
  if (uri.startsWith('data:')) {
    try {
      const [header, b64] = uri.split(',');
      const mime = header.split(':')[1].split(';')[0];
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return resolve(new Blob([bytes], { type: mime }));
    } catch (e) {
      return reject(new Error('Could not decode base64 image.'));
    }
  }

  const xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      resolve(xhr.response);
    } else {
      reject(new Error(`Could not read file (status ${xhr.status}). Try picking the image again.`));
    }
  };
  xhr.onerror = () => reject(new Error('Network error reading file. Make sure you have camera/media permissions.'));
  xhr.open('GET', uri);
  xhr.send();
});

// Sanitise (strip metadata) + downscale images before upload.
const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp']);
const COMPRESS_MAX_DIM = 1600;
const COMPRESS_MIN_BYTES = 350 * 1024;
const compressImageBlob = async (blob, type) => {
  try {
    if (!COMPRESSIBLE.has(type)) return blob; // videos/documents/gifs — not a JPEG EXIF vector
    // NATIVE (no canvas): strip EXIF/GPS from the JPEG bytes and upload that.
    if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
      return await stripExifFromBlob(blob);
    }
    const bmp = await createImageBitmap(blob);
    // Downscale only big images; small ones re-encode at full size purely to drop metadata.
    const scale = blob.size >= COMPRESS_MIN_BYTES
      ? Math.min(1, COMPRESS_MAX_DIM / Math.max(bmp.width, bmp.height))
      : 1;
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const out = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.82));
    return (out && out.size > 0) ? out : blob;
  } catch { return blob; }
};

/**
 * Upload a local file URI to Supabase Storage.
 * @param {string} uri          - Local URI from expo-image-picker or expo-document-picker.
 * @param {string} bucket       - Supabase storage bucket name (e.g. 'avatars', 'covers', 'chat_media').
 * @param {string} storagePath  - Path inside the bucket — first segment MUST be user ID.
 * @param {object} opts
 * @param {string} [opts.mimeType] - Explicit MIME type from asset.mimeType (picker).
 * @returns {Promise<string>} Public URL of the uploaded file.
 */
export const uploadToStorage = async (uri, bucket, storagePath, { mimeType } = {}) => {
  if (!uri) throw new Error('No file selected. Please pick a file first.');
  assertSafeStoragePath(storagePath);

  const type = resolveMime(mimeType, storagePath);

  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error(`File type "${type}" is not supported. Please use an image, video, PDF or document.`);
  }

  let blob;
  try {
    blob = await uriToBlob(uri);
  } catch (e) {
    throw new Error(`Could not read the file: ${e.message}`);
  }

  if (!blob || blob.size === 0) {
    throw new Error('The selected file is empty or could not be read. Please try a different file.');
  }

  // Compress only if compressible image
  blob = await compressImageBlob(blob, (blob.type && blob.type !== 'application/octet-stream') ? blob.type : type);

  const finalType = (blob.type && blob.type !== 'application/octet-stream') ? blob.type : type;

  if (!ALLOWED_TYPES.includes(String(finalType).toLowerCase().split(';')[0].trim())) {
    throw new Error('This file type is not allowed. Please use an image, video, PDF or document.');
  }

  const limit = limitFor(bucket);
  if (blob.size > limit) {
    const isImage = finalType.startsWith('image/');
    throw new Error(
      `This ${isImage ? 'photo' : 'file'} is ${mb(blob.size)} MB — the limit here is ${mb(limit)} MB. ` +
      (isImage ? 'Try a smaller photo.' : 'Try a smaller file.')
    );
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, blob, { contentType: finalType, upsert: true });

  if (uploadError) {
    const msg = uploadError.message || '';
    if (msg.includes('Bucket not found') || msg.includes('bucket')) {
      throw new Error(
        `Storage bucket "${bucket}" does not exist. ` +
        `Run supabase/patch_storage_media.sql in the Supabase SQL Editor to create it.`
      );
    }
    if (msg.includes('not authorized') || msg.includes('policy') || msg.includes('violates')) {
      throw new Error(
        'Upload was blocked by storage policy. Make sure you are signed in and have media permissions.'
      );
    }
    if (msg.includes('exceeded') || msg.includes('too large')) {
      throw new Error('File exceeds the bucket size limit. Try a smaller file.');
    }
    throw new Error(`Upload failed: ${msg}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  if (!data?.publicUrl) throw new Error('Upload succeeded but public URL could not be retrieved.');

  return data.publicUrl;
};

/**
 * Delete a file from Supabase storage by bucket and path/URL
 */
export const deleteFromStorage = async (bucket, pathOrUrl) => {
  if (!pathOrUrl) return false;
  try {
    let storagePath = pathOrUrl;
    if (pathOrUrl.startsWith('http')) {
      const parts = pathOrUrl.split(`/${bucket}/`);
      if (parts.length > 1) storagePath = parts[1].split('?')[0];
    }
    const { error } = await supabase.storage.from(bucket).remove([storagePath]);
    return !error;
  } catch (_) {
    return false;
  }
};
