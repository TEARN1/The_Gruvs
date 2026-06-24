# 🚀 The Gruvs — Go-Live Checklist

Everything in the **code** is built, tested, and pushed. These are the **config
steps only you can do** (they need your live Supabase + GitHub/Vercel access).
Do them in order; each says exactly what it fixes. ~15 minutes total.

---

## 1. Database — run the schema  ⏱️ ~3 min
**Fixes:** DMs that vanish, follow that resets, reels playing black, events slow
to appear, content age-rating columns, the Tiered Gift System tables/RPC.

1. Supabase → **SQL Editor** → New query.
2. Paste the full contents of **`supabase/queries/run_all_now.sql`** → **Run**.
   - It's idempotent (safe to re-run) and skips storage policies with a NOTICE
     (those are done in step 2 — that's expected, not an error).
3. For a full sync (first time / fresh DB), also run in this order:
   `schema_part_2.sql` → `schema_part_3.sql` → `schema_part_4.sql` → `schema_part_1.sql`.

**Verify:** the run finishes with no red error (yellow NOTICEs about
`storage.objects` are fine). 

---

## 2. Storage — buckets + policies  ⏱️ ~3 min
**Fixes:** "image upload" empty-error toast, event cards showing the gradient but
no image, reels black on web. Storage policies **cannot** be created from the SQL
Editor (Supabase ownership) — they must be done here.

1. Supabase → **Storage** → confirm these buckets exist (create any missing):
   `event-media`, `reels`, `avatars`, `chat_media`, `covers`, `moments`.
2. For each bucket → toggle **Public**.
3. **Storage → Policies** → for each bucket add:
   - **SELECT**: `true` (public read)
   - **INSERT / UPDATE / DELETE**: role `authenticated`

**Verify:** each bucket shows a 🌐 *Public* badge. Upload a photo in-app — it
should appear, and event cards should show their image.

---

## 3. Auth — password-reset redirect  ⏱️ ~1 min
**Fixes:** reset links now return to a working "set new password" screen.

1. Supabase → **Authentication → URL Configuration → Redirect URLs**.
2. Add your web origin(s), e.g. `https://the-gruvs-pt23.vercel.app` (and
   `http://localhost:8081` for local testing).

**Verify:** tap "Forgot password", open the email link → the app shows the
**Set a new password** screen → it logs you in with the new password.

---

## 4. Deploy — fix the Vercel token  ⏱️ ~2 min
**Fixes:** the `web-deploy` CI failing with *"--token … Must not contain: '.'"*.

1. Vercel → **Account Settings → Tokens → Create Token** → copy it
   (a valid token is ~24 chars, letters/numbers, **no dots**).
2. GitHub → repo **Settings → Secrets and variables → Actions** →
   update **`VERCEL_TOKEN`** (paste raw, no quotes/spaces/newline).
3. Confirm `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are also set.
4. Actions tab → re-run the failed **web-deploy** job.

---

## 5. Final pass — verify it live  ⏱️ ~5 min
Unit tests + a clean build prove the code; this proves the **live wiring**.
After steps 1–4, in the running app:

- [ ] Post a reel → it plays (not black).
- [ ] Send a DM → it stays (doesn't turn red / disappear).
- [ ] Follow someone → still followed after leaving their profile.
- [ ] Post an event → appears on The Drop immediately.
- [ ] Open an event you host → **Continue the Night** suggests next stops.
- [ ] Business dashboard → **Boost reach with a gift** → redeem a gift → an
      active boost appears.
- [ ] Forgot password → reset end-to-end.

---

### What's already done (no action needed)
Age auto-rating · Continue-the-Night engine · Stage Playbook · Tiered Gift
System (engine + UI) · password-reset code · storage SQL wrapped so it can't
abort the run · build fixed (`@opentelemetry/api`) · 387 unit tests passing.
