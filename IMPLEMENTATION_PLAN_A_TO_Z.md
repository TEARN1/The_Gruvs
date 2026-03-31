---
description: Comprehensive Full-Stack Alignment (A to Z)
---
# 🚀 Phase-by-Phase Roadmap (A to Z fix)

## 1. Ground Zero (Auth & Profiles)
- [x] **API & Schema Sync**: Aligned `events` table with `api/events.js`.
- [ ] **Real Authentication**: Update `useStore.js` to use `supabase.auth` instead of mocks.
- [ ] **Profile Types (Normal/Private/Business)**: Implement real persistence in the `profiles` table.

## 2. Logic & Frequency
- [x] **Resilient Discovery**: Fallback to `MOCK_EVENTS` if the API is offline (Zero-failure UI).
- [ ] **Proximity Engine**: Actual `lat/lng` sorting in `fetchPosts`.
- [ ] **Search Refinements**: Multi-keyword search and fuzzy matching.

## 3. UI/UX "Vibe" Overhaul
- [x] **Premium Landing Page**: Overhauled `root.html` with SEO and high-end aesthetics.
- [ ] **Interactive Feed**: Add micro-animations (Pulse effects) when liking.
- [ ] **Messaging Core**: Connect `MessagesScreen` to Supabase `messages` table.

## 4. Final Polish (Verify 3x)
- [ ] **Performance Audit**: Check image loading times and Core Web Vitals.
- [ ] **Edge Case Testing**: Test "Skip to main content" and PWA offline fallback.
- [ ] **Security Review**: Ensure `SECURITY DEFINER` is used appropriately on RPCs.

---
// turbo-all
