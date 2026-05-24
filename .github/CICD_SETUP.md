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
| Secret | Value |
|--------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `EXPO_PUBLIC_YOUTUBE_API_KEY` | YouTube Data API v3 key |

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
