# The Gruvs: High-Frequency Event Discovery

A performance-optimized Expo & Next.js hybrid application for real-time event discovery and community interaction.

## 🚀 Development Architecture

This project runs a dual-engine architecture:
- **Frontend (UI)**: Expo (React Native for Web) running on port `8081`.
- **Backend (API)**: Next.js Serverless Functions running on port `3000`.

## 🛠️ Local Setup

### 1. Environment Configuration
Copy `.env.example` to `.env` and fill in your Supabase credentials.
**Important**: Ensure `EXPO_PUBLIC_API_URL` is set to `http://localhost:3000` for local development to avoid CORS issues and enable advanced API features.

### 2. Database Setup
Run the contents of `supabase_schema.sql` in your Supabase SQL Editor to initialize all tables, RLS policies, and triggers.

### 3. Running the App
You must run **both** the API server and the Expo dev server:

#### Terminal 1: Backend API (Next.js)
```bash
npx next dev -p 3000
```

#### Terminal 2: Frontend UI (Expo)
```bash
npx expo start --web
```

## 🔌 API Documentation

### Events Engine (`/api/events`)
- `GET`: Fetch events with Full Text Search (`q`), category filtering, and proximity-based sorting.
- `POST`: Create new high-frequency events.
- `PATCH`: Handle interactions (Views, RSVPs, Likes).

### User Engine (`/api/user`)
- `GET`: Fetch user activity levels and permissions.
- `POST`: Heartbeat for gamification and activity tracking.

## 🛡️ Reliability Features
- **Intelligent Fallback Engine**: If the API is unreachable, the app automatically falls back to direct Supabase queries, then to optimized mock data.
- **Pulse Real-time**: Uses Supabase Postgres Changes for zero-latency UI updates.
- **Haptic Feedback**: Integrated for mobile-native interactions.

## 📦 Deployment
The project is configured for seamless deployment on Vercel. Ensure all `EXPO_PUBLIC_*` variables are set in your Vercel project settings.
