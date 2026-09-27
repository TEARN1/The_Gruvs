# The Gruvs — QA & Test Strategy

A layered test framework for maximum coverage across the Expo (React Native + Web)
app and its Supabase backend. Stack already in place: **Jest + jest-expo +
@testing-library/react-native** (unit/integration) and **Playwright** (E2E/web).

```
        ▲ fewer, slower, high-confidence
   E2E  │  Playwright — real browser, user journeys, responsive, swipe nav
  INTEG │  Jest — managers + mocked Supabase, data flow, resilience tiers
  UNIT  │  Jest — pure logic, scoring, transforms, utils (fast, many)
        ▼ many, fast, isolated
```

Run:
```bash
npm run test:unit              # all Jest unit/integration
npm run test:unit:coverage     # with coverage report
npm test                       # Playwright E2E (needs the web build/server)
npm run test:ui                # Playwright interactive
```

---

## 1. Unit tests — core logic

**Goal:** every pure/near-pure module behaves correctly in isolation. Fast, no
network, run on every commit.

**Pattern (mock Supabase so the real client never boots):**
```js
jest.mock('../src/services/supabase', () => ({ supabase: {}, isSupabaseEnabled: false }));
import { ScoreEngine } from '../src/services/dataFlow';
```

**Covered (examples in `__tests__/`):**
- Ranking: `scoreEngineDiversify.test.js` (diversity, explore/exploit, determinism), `reactions`, `matchVersus`.
- Domain engines: `talentEngine`, `tournamentEngine`, `clubEngine`, `sportsEngine`, `auraService`, `identityEngine`.
- Utils: `birthday`, `themes` (`findThemeById`), `writingStyles`, `currency`, `sanitize`, `resilience(.extended)`, `retry`, `offlineCache`, `storageThumb`, `log`, `backStack`, `biometric`.
- Components: `GlassView`, `MediaViewer`, `ReactPicker`, `Motion`.

**Priority gaps to add next** (high-value, pure, easy to test):
- `personalizationEngine` — `computeNextOccurrence`, `generateOccurrences`, `collaborativeScores` (mock the one Supabase call), dwell buffer flush batching.
- `dataFlow` — `normalizeEvent`/`normalizeEvents`, `ScoreEngine.eventScore` monotonicity (more engagement ⇒ higher), `heatScore`.
- `constants/AudienceTargeting` matching logic; `InviteManager.findKin` grouping (mock supabase query builder).

**Coverage target:** ≥ 80% statements on `src/utils/**` and `src/services/**`
(`collectCoverageFrom` is already scoped to utils/services/components).

---

## 2. Integration tests — managers, data flow, DB contract

**Goal:** verify the manager layer (FeedManager, MessageManager, RSVPManager,
UserManager, InviteManager, TrendingManager…) talks to Supabase correctly,
including the **resilient multi-tier fallback** behaviour.

**Strategy — mock the Supabase query builder, assert intent + fallback:**
```js
// A chainable stub: .from().select().eq()... resolves to { data, error }
const makeQB = (result) => {
  const qb = {};
  ['select','insert','update','upsert','delete','eq','neq','in','order','limit',
   'gte','lte','not','or','ilike','maybeSingle','single']
    .forEach(m => qb[m] = jest.fn(() => qb));
  qb.then = (res) => res(result);            // make it awaitable
  return qb;
};
jest.mock('../src/services/supabase', () => ({
  supabase: { from: jest.fn() }, isSupabaseEnabled: true,
}));
```

**What to assert:**
- **Happy path:** `FeedManager.fetchPage` returns normalized, ranked events; cache is populated.
- **Tier fallback:** force tier-1 to return `{ error }` → assert tier-2 (lighter select) runs and still returns data. This is the bug class that silently broke **follows** and **DMs** — every write manager (`UserManager.follow/unfollow`, `MessageManager.send`, `path_stars`) must **throw on `{ error }`**, not treat it as success. Add a regression test per manager:
  ```js
  it('follow surfaces an RLS error instead of faking success', async () => {
    supabase.from.mockReturnValue(makeQB({ error: { message: 'row-level security' }}));
    await expect(UserManager.follow('a','b')).rejects.toBeTruthy();
  });
  ```
- **Payload shape:** `MessageManager.send` core fallback sends only `{sender_id, recipient_id, body}` (the columns guaranteed pre-migration).
- **Notifications:** `_notify` puts `event_id` on the row (so invites deep-link).

**DB contract / migration tests (run against a scratch Supabase project):**
- Spin up a disposable project (or local `supabase start`), run `schema_part_1→4`
  **in order**, then assert key objects exist:
  ```sql
  select to_regclass('public.event_views');                 -- not null
  select 1 from pg_proc where proname = 'get_hot_event_ids'; -- exists
  select column_name from information_schema.columns
   where table_name='messages' and column_name in
   ('message_type','parent_id','event_id','latitude','longitude'); -- 5 rows
  ```
- **RLS smoke:** as an anon key, a write to `messages`/`follows`/`event_views`
  must be denied unless `auth.uid()` matches; a read of `public_profiles` must
  succeed. Automate with two Supabase clients (anon + service) in a Jest suite
  gated behind an env flag (`RUN_DB_TESTS=1`) so it's skipped in normal CI.

---

## 3. End-to-end UI/UX — Playwright (`tests/e2e/`)

**Goal:** real user journeys in a real browser, across device resolutions.

Existing specs: landing, explore, calendar, notifications, profile, responsive,
now-playing. **Added:** `08-swipe-navigation.spec.ts` — swipe pager + tab nav +
overflow checks at phone/tablet/desktop.

**Responsive matrix** (`VIEWPORTS` in the specs): 390×844 (phone), 768×1024
(tablet), 1280×800 (desktop). Add 360×640 (small Android) and 1440×900 if needed.

**Key journeys to cover (extend over time):**
- Guest landing → sees upcoming/hot events → "Join to RSVP" CTA.
- Sign-up flow (all fields), validation messages in plain English.
- Create event (incl. poster-mode: only poster+title+date required).
- Feed: vibe, long-press reaction ring, open detail, RSVP.
- DM send/receive (needs seeded auth) — guard behind a test account.
- Theme switch persists (reload → same aura).
- Swipe left/right changes tab (best-effort on web; strict via tab clicks).

**Notes:** use the tolerant helpers (`waitForApp`, `trackErrors`, `mockFonts`).
Network errors from placeholder Supabase keys are intentionally ignored. Keep
screenshot baselines per viewport (`--update-snapshots` to regenerate).

---

## 4. Performance testing

### 4a. Memory leaks
- **Listener/subscription audit (static):** every `RealtimeManager.subscribe*`,
  `supabase.channel`, `setInterval`, `setTimeout`, `BackHandler`, and
  `addEventListener` must be torn down in a `useEffect` cleanup. Grep gate:
  ```bash
  rg "subscribe|setInterval|addEventListener|channel\(" src | wc -l   # review each
  ```
- **Heap-growth loop (web):** Playwright + CDP, repeat a navigate/scroll cycle
  ~20× and assert heap doesn't grow unbounded:
  ```js
  const client = await page.context().newCDPSession(page);
  await client.send('HeapProfiler.enable');
  // baseline → 20× (goToTab + scroll + back) → collectGarbage → compare JSHeapUsedSize
  ```
  Flag > ~20% sustained growth after GC.
- **Long-list stability:** scroll the feed 100+ items; FlatList must keep memory
  flat (windowing already tuned: `removeClippedSubviews`, `windowSize`,
  `maxToRenderPerBatch`). Watch for retained off-screen images.
- **Re-render hygiene:** scroll handlers must not `setState` per frame (fixed in
  `LandingPage`/`ExplorePage` — guard threshold crossings). Use React DevTools
  Profiler / "Highlight updates" to confirm cards don't re-render on scroll.

### 4b. Load / high-traffic (backend)
- **Read path:** k6/Artillery against the hottest queries — feed page, trending,
  `get_hot_event_ids()`, nearby. Ramp 1→200 VUs; track p95 latency & error rate.
  ```js
  // k6 example
  import http from 'k6/http'; import { check } from 'k6';
  export const options = { stages: [{duration:'30s',target:50},{duration:'1m',target:200},{duration:'30s',target:0}] };
  export default () => { const r = http.post(`${__ENV.URL}/rest/v1/rpc/get_hot_event_ids`, '{}',
    { headers: { apikey: __ENV.ANON, 'Content-Type':'application/json' }});
    check(r, { '200': x => x.status === 200, 'p95<800ms': () => r.timings.duration < 800 }); };
  ```
- **Index sanity:** confirm the hot filters are indexed — `events(event_date)`,
  `event_rsvps(created_at)`, `event_vibes(created_at)`, `messages(recipient_id…)`,
  `event_views(user_id…)`. Run `EXPLAIN ANALYZE` on feed/trending queries; no
  seq-scans on large tables.
- **Realtime fan-out:** simulate N concurrent chat subscribers; ensure broadcast
  path (used for instant DM delivery) stays under Supabase connection limits.
- **Free-tier guardrails:** watch row counts and egress (solo-dev constraint —
  no paid scaling). Alert before hitting free limits.

**Budgets:** cold web load < 4s on 3G-fast; feed scroll 60fps on mid Android;
API p95 < 800ms; zero unbounded heap growth.

---

## 5. Security checklist

Scan before each release. Many items map to the **launch security** SQL (folded
into `schema_part_4` patch 01) and RLS policies.

**Auth & access control**
- [ ] RLS enabled on **every** table with user data (profiles, events, messages,
      follows, event_views, surveys, path_stars…). Default-deny.
- [ ] Write policies check `auth.uid()` ownership (`sender_id`/`user_id`/`author_id = auth.uid()`).
- [ ] Anon role can read only what `public_profiles` exposes — **no PII** (email,
      phone, exact GPS) readable unauthenticated.
- [ ] `REVOKE CREATE ON SCHEMA public` from anon/authenticated (in patch 01).
- [ ] SECURITY DEFINER functions set `search_path = public` and validate caller
      (e.g. `assert_admin()` before privileged ops).
- [ ] No service-role key in the client bundle — only the anon/publishable key.

**Input / data**
- [ ] All user text passes `SecurityService.sanitizeContent` before persist/display.
- [ ] No raw string interpolation into `.or()/.filter()` from user input
      (PostgREST injection) — validate/whitelist.
- [ ] File uploads: type/size validated; storage bucket policies owner-scoped.
- [ ] Rate limiting on write-heavy RPCs (`check_rate_limit`, message throttle).

**Client / transport**
- [ ] Secrets only in env (`app.config`/EAS secrets), never committed. Grep:
      `rg -i "service_role|secret|BEGIN PRIVATE KEY|sk_live" --glob '!**/node_modules/**'`.
- [ ] External links go through `SecurityService.safeOpenURL` (no `javascript:`).
- [ ] Deep links / QR (`thegruvs.com/join?ref=`) validate the ref param.
- [ ] HTTPS everywhere; no mixed content on web.

**Privacy (this app specifically)**
- [ ] Location respects `applyLocationPrivacy` (fuzzing) before save.
- [ ] Birthday spotlight uses month+day only — never exposes birth year.
- [ ] Audience targeting matches only **opt-in** self-tags (community_tags), never
      inferred sensitive attributes.
- [ ] `show_online` / discoverability toggles actually gate what others see.

**Dependency / supply chain**
- [ ] `npm audit` clean of high/critical; Dependabot or periodic review.
- [ ] Lockfile committed; no unpinned `latest` deps.

**Automated hooks**
```bash
npm run test:unit && npm audit --audit-level=high     # pre-push gate
rg -i "service_role|sk_live|BEGIN (RSA )?PRIVATE KEY" src public   # secret scan
```

---

## 6. CI suggestion

```yaml
# pseudo-CI
unit:    npm ci && npm run test:unit:coverage      # every PR; fail < 80% utils/services
secrets: secret-scan grep                          # every PR
e2e:     npm run build && npm test                 # main + nightly (Playwright)
db:      supabase start && run schema_part_1..4 && RUN_DB_TESTS=1 npm run test:unit   # nightly
load:    k6 run load/feed.js                        # weekly / pre-release
audit:   npm audit --audit-level=high               # weekly
```

---

### Status (this iteration)
- ✅ Unit: added `birthday`, `themes`, `writingStyles`, `scoreEngineDiversify` (28 tests, all green).
- ✅ E2E: added `08-swipe-navigation` (swipe + tab nav + overflow × 3 viewports).
- ✅ Strategy: integration/DB-contract plan, performance (memory + load) plan, security checklist above.
- ⏳ Next: manager-level integration tests (fallback/throw regressions), DB-contract suite behind `RUN_DB_TESTS`, k6 load script, CDP heap-growth spec.