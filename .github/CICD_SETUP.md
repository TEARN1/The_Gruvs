# CI/CD Setup — The Gruvs

Four GitHub Actions workflows. Set these up once and everything runs automatically.

---

## Workflows

| File | Trigger | What it does |
|------|---------|-------------|
| `ci.yml` | Every push / PR | TypeScript check + Expo Doctor |
| `web-deploy.yml` | Push to `main` / PR | Builds Expo web → deploys to Vercel |
| `eas-preview.yml` | Push to `main`, `feature/*`, `fix/*` | EAS preview build (Android APK) |
| `eas-production.yml` | Push a `v*.*.*` tag | EAS production build (AAB + iOS) + GitHub Release |
| `eas-update.yml` | Push to `main` | OTA JS bundle push via EAS Update |

---

## Required GitHub Secrets

Go to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

### Expo / EAS
| Secret | How to get it |
|--------|--------------|
| `EXPO_TOKEN` | `npx expo login` then `npx expo whoami --json` — or generate at https://expo.dev/settings/access-tokens |

### Vercel
| Secret | How to get it |
|--------|--------------|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Run `npx vercel link` in the project → check `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | Same file → `projectId` |

### App env vars (used during build)

> **Every `EXPO_PUBLIC_*` value is inlined into the public web/app bundle at build
> time.** Anyone can read them with view-source or by unzipping the APK. Only put
> values here that are public by design. A real secret belongs in the Supabase
> Edge Function environment (`supabase secrets set ...`), never in this table.

| Secret | Value | Why it's safe to bundle |
|--------|-------|-------------------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Public endpoint; RLS is the boundary |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Public by design; RLS is the boundary |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | Spotify app client ID | Client IDs are not secret |
| `EXPO_PUBLIC_YOUTUBE_API_KEY` | YouTube Data API v3 key | Bundled — restrict by HTTP referrer / package name and set a tight quota |

**Not a repo secret:** the Spotify **client secret**. It is set only on the
`spotify-token` Edge Function (`supabase secrets set SPOTIFY_CLIENT_SECRET=...`),
which mints app tokens for signed-in callers. It was previously passed to builds
as `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET` — that name puts a real credential one
source-reference away from shipping in the public bundle, so it has been removed
from every workflow. Delete it from the repo's Actions secrets and **rotate it in
the Spotify dashboard** if it was ever set.

---

## Release flow

```
# Regular work — OTA update goes out automatically on every main push
git push origin main

# Full production build (App Store + Play Store)
git tag v1.0.1
git push origin v1.0.1
```

The tag push triggers `eas-production.yml` which queues both Android and iOS builds on EAS, then creates a GitHub Release with notes.

---

## First-time EAS setup (run locally once)

```bash
npm install -g eas-cli
eas login
eas build:configure   # links project to EAS
```

Make sure `eas.json` has the `production` profile (it does — already configured).
