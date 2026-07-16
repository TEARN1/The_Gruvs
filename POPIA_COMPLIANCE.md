# POPIA compliance — The Gruvs

South Africa's **Protection of Personal Information Act (POPIA)** applies to The
Gruvs: you're SA-based, you process personal data of SA residents, and you hold
**special-category-adjacent data** (precise location, and minors' data via the
birthday field). Going global adds GDPR-style obligations on top, but POPIA is
the floor you must meet from day one of real users.

This is the founder's checklist. Items marked **[LEGAL — YOU]** are things only
you can do (register, appoint, sign). Items marked **[CODE — done]** are already
handled in the app. Items marked **[CODE — TODO]** are gaps to build.

> Not legal advice — this is an engineer's map of your obligations. Confirm the
> specifics with a South African privacy lawyer before launch.

---

## 1. Register & appoint (the two that carry personal liability)

- [ ] **[LEGAL — YOU] Appoint an Information Officer.** By default this is you
      (the head of the business). POPIA makes the IO personally responsible for
      compliance. — POPIA s.55.
- [ ] **[LEGAL — YOU] Register the Information Officer with the Information
      Regulator** *before* you process. Free, online:
      https://inforegulator.org.za → Registration of Information Officers.
      **Operating without this registered is a breach on its own.**
- [ ] **[LEGAL — YOU] Deputy IO** if/when you have staff.

## 2. Records of processing (you must be able to show this)

- [ ] **[LEGAL — YOU] Maintain a Record of Processing Activities** — what
      personal data you collect, why, the lawful basis, who it's shared with,
      where it's stored, and how long you keep it. POPIA s.17 + the PAIA manual.
      A one-page table is enough to start. Draft below (§8).
- [ ] **[LEGAL — YOU] PAIA manual** — a public document describing what records
      you hold and how to request them. Template on the Regulator's site.

## 3. Lawful basis & consent

- [x] **[CODE — done] Consent captured at signup** (account creation is the
      consent event; email-marketing is a separate explicit opt-in in the signup
      flow — good, that's *unbundled* consent).
- [ ] **[CODE — TODO] Consent must be withdrawable** — a user must be able to
      turn off email marketing later (not only at signup). Add a toggle in
      Settings. POPIA s.11(2).
- [ ] **[LEGAL — YOU] Privacy Policy** that matches reality — what you collect,
      why, who you share with (the sub-processors in §7), retention, and the
      user's rights. Link it at signup and in Settings.

## 4. Special-category & high-risk data — **your real exposure**

- [ ] **[LEGAL — YOU] Data Protection Impact Assessment (DPIA)** for location
      processing. You track **precise GPS** (Touch Down, Crossed Paths, Path
      Map). Location is high-risk under POPIA — a DPIA is expected. Document what
      you collect, the anti-trafficking/safety rationale (a genuine legitimate
      interest), and the minimisation controls below.
- [x] **[CODE — done] Location minimisation** — `applyLocationPrivacy` fuzzes
      stored coordinates; Touch Down verifies presence without publishing exact
      coords; live footprints auto-expire. Keep this documented as your control.
- [x] **[CODE — done] EXIF/GPS stripped from uploaded photos** (web) — so a
      photo's embedded home coordinates don't leak. *(Native still carries EXIF —
      see the storageService note; needs expo-image-manipulator + a rebuild.)*
- [ ] **[CODE — TODO] Location retention limit** — set a schedule to purge
      `live_checkins` / `path_crossings` older than N days. Holding location
      history indefinitely is both a POPIA minimisation problem and a
      subpoena/breach liability.

## 5. Children's data — **the birthday field**

- [x] **[CODE — done] Age gate** (`ageGate.js` + DB trigger) blocks under-age
      users from age-restricted (18+/21+) events, client- **and** server-side.
- [ ] **[LEGAL — YOU] Decide your minimum age** and state it in the Terms.
      POPIA treats a child (under 18) as needing a competent person's (parent's)
      consent — most SA consumer apps set a **13+ or 18+ floor** to avoid the
      minors regime entirely. If you allow under-18s, you need verifiable
      parental consent, which is heavy. **Recommendation: 18+ to launch.**
- [ ] **[CODE — TODO] Enforce the minimum age at signup**, not just at event
      check-in — reject account creation below your floor based on the birthday.

## 6. Alcohol / restricted events — legal age verification

- [x] **[CODE — done] `age_restriction` gate** on RSVP and Touch Down, enforced
      by a DB trigger so it can't be bypassed via the API.
- [ ] **[LEGAL — YOU] Liquor-law note:** the app *surfaces* the host's age gate;
      the **host/venue remains legally responsible** for door-age verification
      under provincial liquor law. State this in the host Terms so the liability
      sits where it legally belongs.

## 7. Sub-processors & cross-border transfer — **SA → global**

You send personal data to these third parties. POPIA s.72 restricts cross-border
transfer unless the recipient is under comparable protection or the user
consented. List them in your Privacy Policy and confirm each is covered.

| Sub-processor | Data it sees | Region | Action |
|---|---|---|---|
| **Supabase** (DB, auth, storage) | all PII | check project region | [ ] confirm region + DPA |
| **DigitalOcean** (web host) | request data | droplet region | [ ] confirm region |
| **Expo / EAS** (build, push) | push tokens, device | US | [ ] DPA |
| **Nominatim** (geocode) | venue/city text, coords | EU | [ ] no PII sent beyond location strings — verify |
| **weserv.nl** (image resize) | image URLs | EU | [ ] public images only — verify |
| **jsDelivr** (Tesseract CDN) | none (static asset) | global | ✓ no PII |

- [ ] **[LEGAL — YOU] Sign/accept a Data Processing Agreement** with Supabase,
      DigitalOcean and Expo (they all offer one).

## 8. Data-subject rights

- [x] **[CODE — done] Right to erasure** — the `delete-account` edge function
      purges DB rows + storage + the login, JWT-verified. **⚠ Confirm it's
      actually deployed live** (pending) — an *undeployed* deletion function is a
      compliance gap **and** an Apple/Google store-rejection.
- [ ] **[CODE — TODO] Right to access / portability** — a "download my data"
      export (JSON of the user's own rows). POPIA s.23. Lower priority than
      deletion but expected.
- [ ] **[CODE — TODO] Right to rectification** — users can already edit their
      profile; confirm all their PII is editable.

## 9. Breach notification

- [ ] **[LEGAL — YOU] Breach runbook.** POPIA s.22 **requires** notifying the
      Information Regulator **and** affected users "as soon as reasonably
      possible" after a breach. Write the one-page plan now: who decides, what
      you tell the Regulator, how you reach users. You already have
      `client_errors` telemetry — extend the thinking to a security-incident
      path.

## 10. Retention

- [ ] **[LEGAL + CODE — TODO] Retention schedule.** POPIA s.14 — don't keep
      personal data longer than needed. Define: location history (short — days),
      inactive accounts (e.g. auto-delete after N years dormant), analytics
      (anonymise after N months). Then build the purge jobs.

---

## The honest priority order

1. **Register your Information Officer** (§1) — free, mandatory, and a breach the
   moment you have users without it.
2. **Confirm account-deletion is deployed live** (§8) — compliance + store gate.
3. **Set an 18+ floor and enforce it at signup** (§5) — sidesteps the entire
   minors regime.
4. **Privacy Policy + sub-processor list** (§3, §7) — needed before you market.
5. Everything else is real but can follow first users.

Most of this is **legal/operational, not code** — which is the honest point: at
this stage your compliance gap is paperwork and one registration, not
engineering. The engineering controls POPIA actually cares about (location
minimisation, age gate, deletion, EXIF-strip) are already built.
