# The Gruvs — Monetization Plan (Premium IAP + B2B tier)

> Constraint-safe: Apple/Google are merchant of record (IAP). You never custody or
> process funds — only receive payouts. No PSP, no escrow, no wallet top-ups.
> Pricing numbers below are PLACEHOLDERS — you set them.

## The rail: RevenueCat (recommended) vs raw IAP
- **RevenueCat** (`react-native-purchases`) — wraps Apple + Google IAP, validates
  receipts, manages entitlements, no backend needed. **Free** under ~$2.5k/mo revenue.
  Best for a solo dev. Needs an EAS dev build (you already build via EAS ✅).
- **Raw `react-native-iap`** — free, no third party, but YOU validate receipts + manage
  entitlements (needs a Supabase Edge Function). More work, more failure modes.
- **Recommendation: RevenueCat** — it's "free until you're earning," removes the
  riskiest part (receipt validation), and Apple requires IAP for digital goods anyway.

## A) Consumer Premium — "Gruvs Pro"
Tie it to your existing **Sovereign/VIP** identity so it feels native, not bolted on.

> ⚠️ **Free-tier philosophy (growth-first):** to pull users off TikTok/IG we do NOT
> cap content creation. **Posting videos is UNLIMITED and free, forever.** We monetize
> *power, depth, discovery, vanity, and business* — never the core create/browse loop.
> Capping content would kill the very growth that makes ads/subscriptions pay off.

| Free | Pro (paywall) |
|------|---------------|
| Events, RSVP, **unlimited video posting**, DMs, follow, basic discovery | **Scout Pro** (advanced player search/filters — `ScoutScreen`) |
| Standard video quality | HD + longer clips + priority processing (post count NEVER capped) |
| Basic profile | **Sovereign/Verified badge** (sell the status via IAP) |
| Standard feed | Advanced personalization + full "Rising" insights |
| | Extended **beacon** presence ("Put Me Out There" longer) |
| | Premium **aura** packs (themes/writing-styles) |
| | Ad-free (if/when AdMob is added) |
| | Fantasy XI / predictor pro (once built — ROADMAP #103/#105) |

Suggested: monthly + annual (annual discounted). One entitlement: `pro`.

## B) B2B — "Gruvs for Business"
Monetizes the business system you've ALREADY built (`BusinessDashboard`,
`BusinessStoreBuilder`, `ad_campaigns`, `surveys`, `audience_segments`).

| Free business | Starter | Pro |
|---------------|---------|-----|
| Basic business profile | Store builder (multi-block) | Everything in Starter + |
| 1 active event | Boosted/promoted events (`ad_campaigns`) | Audience analytics + targeting |
| | Verified business badge | Drip surveys (`surveys` — needs UI) |
| | | Priority placement, multiple events, partnerships |

Billing options: **IAP** (self-serve, simplest) or **off-platform invoice/EFT** for
higher-touch enterprise (you invoice directly — still no in-app money handling).
Entitlements: `biz_starter`, `biz_pro`.

## Data model (entitlements)
RevenueCat is the **source of truth**; mirror to DB for server-side gating (RLS):
```
profiles.subscription_tier        TEXT DEFAULT 'free'   -- free | pro
profiles.subscription_expires_at  TIMESTAMPTZ
business_profiles.plan            TEXT DEFAULT 'free'   -- free | starter | pro
business_profiles.plan_expires_at TIMESTAMPTZ
```
Kept in sync by a **RevenueCat webhook → Supabase Edge Function** that updates these on
purchase/renew/expire. Client reads the live entitlement from RevenueCat; DB mirror lets
RLS gate premium *data* server-side (so a hacked client can't unlock Pro data).

## Build sequence
1. **You decide packaging + prices** (business call).
2. **You** create the products in App Store Connect + Play Console, and a RevenueCat project.
3. Add `react-native-purchases`; configure entitlements (`pro`, `biz_starter`, `biz_pro`).
4. **App-layer scaffold (I can build now, no DB/accounts needed):**
   `EntitlementProvider` + `useEntitlement()` hook + `<ProGate feature="…">` wrapper + a `<Paywall>` component.
5. Gate features by wrapping them in `<ProGate>` (Scout Pro, store builder, etc.).
6. **DB (via migration, after the foundation gate):** add the entitlement columns + RLS,
   and the RevenueCat→Edge-Function webhook for server-side truth.

## Honest caveats
- Store fees: 15–30% cut; Apple $99/yr + Google $25 once (small recurring cost — the
  price of monetizing; you still never *handle* money).
- iOS: digital features **must** use IAP (no external payment links for in-app unlocks).
- Server-side gating (step 6) needs the DB foundation reconciled first, or a hacked
  client could read Pro-only data. Client-side gating (steps 4–5) is fine to build now.