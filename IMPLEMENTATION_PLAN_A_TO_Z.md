---
description: Comprehensive Full-Stack Alignment (A to Z)
---
# 🚀 Phase-by-Phase Roadmap (A to Z fix)

## 1. Ground Zero (Auth & Profiles)
- [x] **API & Schema Sync**: Aligned `events` table with `api/events.js`.
- [x] **Real Authentication**: Connected `useStore.js` to `supabase.auth`.
- [x] **Profile Types (Normal/Private/Business)**: Implemented persistence in `profiles` table.

## 2. Logic & Frequency
- [x] **Resilient Discovery**: Fallback to `MOCK_EVENTS` if the API is offline.
- [x] **Proximity Engine**: Actual `lat/lng` sorting in `fetchPosts` and API.
- [ ] **Search Refinements**: Multi-keyword search and fuzzy matching.

## 3. UI/UX "Vibe" Overhaul
- [x] **Premium Landing Page**: Overhauled `root.html` with SEO and high-end aesthetics.
- [ ] **Interactive Feed**: Add micro-animations (Pulse effects) when liking.
- [x] **Messaging Core**: Connected `MessagesScreen` to Supabase `messages` table.

## 4. Final Polish (Verify 3x)
- [ ] **Performance Audit**: Check image loading times and Core Web Vitals.
- [ ] **Edge Case Testing**: Test "Skip to main content" and PWA offline fallback.
- [ ] **Security Review**: Ensure `SECURITY DEFINER` is used appropriately on RPCs.

---
// turbo-all
