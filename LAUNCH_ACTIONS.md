# Founder actions — the things only YOU can do

Everything in code is done. These need your accounts / real-world hustle.

## #4 — Native build (biggest lever: unlocks reliable GPS + push for Touch Down)
Fully configured (`eas.json`, bundle id `com.thegruvs.app`, projectId set, env
vars wired for preview + production). To get an installable APK on your phone:
```bash
npm i -g eas-cli          # once
eas login                 # your Expo account  (or set EXPO_TOKEN in the shell)
eas build -p android --profile preview
```
→ EAS prints a URL; open it on your Android phone, install the APK, and you have
the real app with native GPS + push. (iOS needs an Apple Developer account, $99/yr
— do Android first.) Give me an `EXPO_TOKEN` and I can wire this into CI too.

## #1 — Password reset (verify a dashboard setting)
The APP side is correct (it passes `redirectTo` = the live origin, handles the
`PASSWORD_RECOVERY` event, shows ResetPasswordModal). Supabase just needs the
origin on its allow-list, or reset links get rejected:
Supabase → **Authentication → URL Configuration** →
  • **Site URL** = `https://thegruvs.com`
  • **Redirect URLs** — add `https://thegruvs.com/**`

## #5 — Google Search Console (brand search)
SEO is live (real robots.txt, sitemap.xml, Open Graph cards). To get indexed:
1. Go to https://search.google.com/search-console → **Add property** → URL prefix
   → `https://thegruvs.com`.
2. Verify — easiest is the **HTML tag** method: it gives you a
   `<meta name="google-site-verification" content="XXfar…">` tag. **Send me that
   tag** and I'll inject it into the site in one deploy (or use the DNS TXT method
   at GoDaddy).
3. After verifying → **Sitemaps** → submit `sitemap.xml`.
→ Brand search ("The Gruvs") starts working within days.

## #6 — Host #1 (the real bottleneck — not code)
See `BD_PLAYBOOK.md`. Pick ONE scene, name ONE host, get their next event on the
app, be at the door, drive 10 real Touch Downs. Nothing else moves the needle
like this. I can't do it — but I'll set up their event *for* them and write the
pitch in your voice whenever you're ready.

## #8 — Monetization (deliberately last)
Plan is in `MONETIZATION.md` (Premium consumer IAP + B2B tier via RevenueCat,
store = merchant of record). Needs a RevenueCat account + store listings +
products. Build only once there are real users to convert — premature now.

---
### Already done in code this pass
✅ Funnel analytics (`analytics_events` + `track()` — signup/view/RSVP/TouchDown/
share) · ✅ reels tests fixed · ✅ chat_media URLs made unguessable · ✅ SEO/OG ·
✅ error telemetry · ✅ Focus Cut · ✅ perf (images 12MB→1.3MB) · ✅ poster autofill.
Read the funnel any session via Supabase MCP:
`SELECT event, count(*) FROM analytics_events GROUP BY 1 ORDER BY 2 DESC;`
