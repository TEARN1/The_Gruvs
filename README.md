# The Gruvs

Simple Expo app. This repository contains the source for the mobile/web app.

Quick start

Install deps:

```bash
npm ci
```

Run in Expo (native):

```bash
npm start
```

Run in web mode:

```bash
npm run web
```

Build static web output (produces `web-build`):

```bash
npm run build:web
```

Docker build & run (serves static build with nginx):

```bash
# build image
docker build -t the-gruvs:latest .

# run container
docker run -p 8080:80 the-gruvs:latest

# open http://localhost:8080
```

Publish to GitHub

1. Create a GitHub repo named `The_Gruvs`.
2. Add remote and push:

```powershell
git remote add origin https://github.com/<your-username>/The_Gruvs.git
git branch -M main
git push -u origin main
```

Deploy to Vercel (static)

- Connect GitHub repo to Vercel.
- Build Command: `npm run build:web`
- Output Directory: `web-build`
- Add any environment variables in Vercel dashboard.

CI

This repo includes a GitHub Actions workflow that runs tests and builds the web output on push to `main`.# The Gruvs

A cross-platform React Native app (mobile + web) starter that manages simple To‑Do events called "The Gruvs".

What I scaffolded:

- Basic Expo-based React Native app (`App.js`) with a simple events To‑Do list UI.
- `package.json` with scripts for starting and building.
- `Dockerfile` for building & serving the web build.
- GitHub Actions CI workflow to build the web bundle.

Quick start (local):

1. Install Node.js (LTS) and npm.
2. Install the Expo CLI globally if you want: `npm install -g expo-cli` (optional).
3. Install dependencies:

```bash
npm install
```

4. Start the app (dev):

```bash
npm run start
# or web only
npm run web
```

Web build (static):

```bash
npm run build:web  # uses `expo export:web` under the hood
```

Docker (serves the web build on port 3000):

```bash
docker build -t the-gruvs:web .
docker run -p 3000:3000 the-gruvs:web
```

Next recommended steps:

- Commit this repo, push to GitHub, and enable GitHub Actions (CI will run the web build).
- Deploy the web build on Vercel (connect the repo) or any static host.
- For mobile releases, set up Expo/EAS builds and credentials (I can add EAS config and GitHub secrets).
- If you want Windows desktop support, I can add `react-native-windows` integration notes and scripts.

If you'd like, I can now initialize git, commit, and push to a new GitHub repo and configure automatic deploys to Vercel/EAS.
