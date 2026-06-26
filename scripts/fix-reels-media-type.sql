-- SQL Patch: Fix mislabeled video reels
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor) to correct the media_type of existing videos.

UPDATE public.reels
SET media_type = 'video'
WHERE id IN (
  'e5245a84-1291-4f4e-b0fa-5754c8c62a5b',
  'd2909991-dd83-4058-ab56-f50c4a79e871',
  '12780b46-eae0-4d3d-9031-b3153876358b',
  'bcc01894-0acf-44f0-8fe7-5a10bc7f2d6b',
  '98527ff5-297b-435e-a776-f119ce5a0ba4',
  'df273ecc-d7f7-4c04-a335-f4ccd53293ea',
  '16222c83-34de-4fe0-bb70-8548d8cc7110',
  '22e9fed7-03d2-4015-85c5-25f8e605e547'
);

-- Verify the update
SELECT id, caption, media_type, media_url, is_deleted
FROM public.reels
WHERE id IN (
  'e5245a84-1291-4f4e-b0fa-5754c8c62a5b',
  'd2909991-dd83-4058-ab56-f50c4a79e871',
  '12780b46-eae0-4d3d-9031-b3153876358b',
  'bcc01894-0acf-44f0-8fe7-5a10bc7f2d6b',
  '98527ff5-297b-435e-a776-f119ce5a0ba4',
  'df273ecc-d7f7-4c04-a335-f4ccd53293ea',
  '16222c83-34de-4fe0-bb70-8548d8cc7110',
  '22e9fed7-03d2-4015-85c5-25f8e605e547'
);
