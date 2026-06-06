# 🛡️ Supabase & React Native Security Audit Checklist

This checklist provides a systematic approach to audit Row-Level Security (RLS), verify data exposure limits, protect client credentials, and prevent common security vulnerabilities in **The Gruvs** React Native and Supabase stack.

---

## 🚨 Threat Model Overview

Because React Native apps compile down to JavaScript bundles (which can be easily decompiled and reverse-engineered), **any API key or URL stored in the application (like `EXPO_PUBLIC_SUPABASE_ANON_KEY`) must be treated as public**.
An attacker can extract this key and hit your Supabase API directly from a CLI or Postman, bypassing all front-end route checks, inputs, and UI limitations.

---

## 🛠️ Automated Security Scanning

We have implemented an automated, non-destructive security scanner: `scripts/sec-probe.js`.

### How to Run
```bash
node scripts/sec-probe.js
```

### What it checks:
1. **Anonymous Read Access**: Attempts to query private tables (e.g., `messages`, `wallet_transactions`, `disputes`) using only the public anon key.
2. **PII Column Leakage**: Checks if public tables expose sensitive columns (like `profiles.email`, `profiles.push_token`, or precise `live_checkins.lat`/`lon` coordinates) to unauthenticated users.
3. **Anonymous Write Access**: Attempts a simulated write (update) on core tables with a non-matching ID. If the database returns success or a non-RLS schema error, the write policy is exposed.

---

## 📋 The 5-Point Security Checklist

### 1. Row-Level Security (RLS) Policies
* [ ] **RLS Enabled on All Tables**: Confirm that every database table has RLS explicitly enabled.
  ```sql
  ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
  ```
* [ ] **No Default Permissive Policies**: Avoid policies that allow read/write to all authenticated users without matching their specific user ID.
  * *Bad:* `CREATE POLICY "Allow all authenticated" ON public.messages FOR SELECT TO authenticated USING (true);`
  * *Good:* `CREATE POLICY "Allow users to read their own messages" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);`
* [ ] **Strict Write Restrictions**: Check that tables like `wallet_transactions`, `event_rsvps`, and `service_bookings` are only writeable by their respective owners or verified service accounts.

### 2. PII Exposure Control
* [ ] **Email and Phone Masking**: The `profiles` table must never expose `email` or `phone` to third parties. These should be isolated inside the private database schema or protected via a secure view or specific RLS policies.
* [ ] **Location Fuzzing**: Real-time coordinates in `live_checkins` should be fuzzed or rounded to a safe distance (e.g., rounded to 3 decimal places for ~110m accuracy) before being stored or retrieved by other clients.
* [ ] **Metadata Stripping**: Ensure image metadata (such as EXIF GPS locations) is stripped before uploading media to Supabase storage.

### 3. Client Secrets Protection (Spotify, APIs)
* [ ] **No Hardcoded Keys**: Ensure client IDs, client secrets (e.g. Spotify Client Secret), and webhook signatures are never declared as static constants in the frontend source code.
* [ ] **Supabase Vault / Server Environments**: Store all private integrations in Supabase Vault or as environment variables in Supabase Edge Functions.
* [ ] **Edge Function Proxies**: Instead of the app calling external APIs directly with a secret key, route the request through a Supabase Edge Function that attaches the secret server-side.

### 4. Administrative Gates & Role Verification
* [ ] **No Client-Side Admin trust**: Never trust an `isAdmin` flag sent from the mobile client.
* [ ] **Role Verification in RLS**: Validate user roles directly against a secure table or custom claim:
  ```sql
  CREATE POLICY "Admin only delete" ON public.events
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
  ```

### 5. Input Sanitization & Anti-Injection
* [ ] **Validate Input Lengths**: Prevent payload-overflow or memory exhaust attacks by strictly validating input text sizes in fields like biography, comments, and messages using `SecurityService.validateTextInput()`.
* [ ] **Sanitize Against XSS**: Clean HTML, javascript protocols, and iframe tags from user input before rendering in the application using `SecurityService.sanitizeContent()`.
* [ ] **Prevent Prototype Pollution**: Strip keys like `__proto__` and `constructor` from JSON payloads before processing using `SecurityService.sanitizePayload()`.
