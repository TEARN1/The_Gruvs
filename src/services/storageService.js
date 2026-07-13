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
  'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm',
];

// ── Per-bucket size limits — these MIRROR the real limits on storage.buckets ──
// The client used to validate every upload against ONE 150 MB cap while each
// bucket enforces its own, much smaller limit server-side. So a normal phone
// photo (6–12 MB) sailed past the client check and was then REJECTED by the
// bucket — surfacing to the user as the useless "Fix the storage issue".
// Avatar uploads over 5 MB failed outright and always had.
//
// Keep this in sync with:  select id, file_size_limit from storage.buckets;
const BUCKET_LIMITS = {
  avatars:        15 * 1024 * 1024,   // 15 MB
  covers:         20 * 1024 * 1024,   // 20 MB
  chat_media:     20 * 1024 * 1024,   // 20 MB
  moments:        50 * 1024 * 1024,   // 50 MB
  'event-media':  100 * 1024 * 1024,  // 100 MB
  reels:          100 * 1024 * 1024,  // 100 MB
};
const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // never exceed the smallest common ceiling

const limitFor = (bucket) => BUCKET_LIMITS[bucket] ?? DEFAULT_MAX_SIZE;
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '');

const extFromPath = (storagePath) => {
  const base = storagePath.split('?')[0];
  return (base.split('.').pop() || 'jpg').toLowerCase();
};

const resolveMime = (mimeType, storagePath) => {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
  const ext = extFromPath(storagePath);
  return MIME_MAP[ext] || 'image/jpeg';
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

// Downscale + re-encode big images before upload so we stop accumulating ~1MB
// source files (cheaper storage, faster weserv resize on display). Web-only
// (canvas); returns the ORIGINAL blob on anything unexpected so it can never
// break an upload. Videos, GIFs and small images pass through untouched.
const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp']);
const COMPRESS_MAX_DIM = 1600;
const COMPRESS_MIN_BYTES = 350 * 1024;
const compressImageBlob = async (blob, type) => {
  try {
    if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return blob;
    if (!COMPRESSIBLE.has(type) || blob.size < COMPRESS_MIN_BYTES) return blob;
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, COMPRESS_MAX_DIM / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const out = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.72));
    // Keep the compressed copy only if it actually helped.
    return (out && out.size > 0 && out.size < blob.size) ? out : blob;
  } catch { return blob; }
};

/**
 * Upload a local file URI to Supabase Storage.
 * @param {string} uri          - Local URI from expo-image-picker or expo-document-picker.
 * @param {string} bucket       - Supabase storage bucket name (e.g. 'avatars', 'covers').
 * @param {string} storagePath  - Path inside the bucket — first segment MUST be user ID.
 * @param {object} opts
 * @param {string} [opts.mimeType] - Explicit MIME type from asset.mimeType (picker).
 * @returns {Promise<string>} Public URL of the uploaded file.
 */
export const uploadToStorage = async (uri, bucket, storagePath, { mimeType } = {}) => {
  if (!uri) throw new Error('No file selected. Please pick an image first.');

  const type = resolveMime(mimeType, storagePath);

  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error(`File type "${type}" is not supported. Please use a JPG, PNG, WEBP, GIF or MP4.`);
  }

  let blob;
  try {
    blob = await uriToBlob(uri);
  } catch (e) {
    throw new Error(`Could not read the file: ${e.message}`);
  }

  if (!blob || blob.size === 0) {
    throw new Error('The selected file is empty or could not be read. Please try a different photo.');
  }

  // Compress FIRST, then judge the size — a 12 MB phone photo usually shrinks
  // under the limit, so we should never reject a user we could simply fit.
  blob = await compressImageBlob(blob, (blob.type && blob.type !== 'application/octet-stream') ? blob.type : type);

  const finalType = (blob.type && blob.type !== 'application/octet-stream') ? blob.type : type;

  // Enforce THIS bucket's real limit, not one global number. The bucket rejects
  // anything over its own ceiling server-side, so checking a 150 MB cap here just
  // pushed the failure downstream into an unhelpful error.
  const limit = limitFor(bucket);
  if (blob.size > limit) {
    const isImage = finalType.startsWith('image/');
    throw new Error(
      `This ${isImage ? 'photo' : 'file'} is ${mb(blob.size)} MB — the limit here is ${mb(limit)} MB. ` +
      (isImage ? 'Try a smaller photo.' : 'Try a shorter or lower-quality video.')
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
        `Run supabase/patch_storage_media.sql in the Supabase SQL Editor (Dashboard → SQL Editor) to create it.`
      );
    }
    if (msg.includes('not authorized') || msg.includes('policy') || msg.includes('violates')) {
      throw new Error(
        'Upload was blocked by storage policy. Make sure you are signed in and that ' +
        'supabase/patch_storage_media.sql has been run in your Supabase project.'
      );
    }
    if (msg.includes('exceeded') || msg.includes('too large')) {
      throw new Error('File exceeds the bucket size limit. Try a smaller image.');
    }
    throw new Error(`Upload failed: ${msg}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  if (!data?.publicUrl) throw new Error('Upload succeeded but public URL could not be retrieved.');

  return data.publicUrl;
};
