# The Gruvs — Security Plan (DigitalOcean + Supabase + Apps)

_Last reviewed: 2026-08-05. Stack: Expo/RN web on a DigitalOcean droplet behind nginx;
Supabase (Postgres + Auth + Realtime + Storage); GitHub Actions deploy; sister app The
Resident (Resident Crew) sharing the same Supabase project._

The bar: **defense in depth** — every request passes multiple independent guards, so no single
misconfig is a breach. Ranked by priority. ✅ = already in place, ⚠️ = do this, 🔴 = urgent.

---

## 0. Threat model (what we actually defend)
- **The droplet** (144.126.236.75) — a public Linux box. Biggest real-world risk: SSH brute
  force, an unpatched CVE, or a leaked deploy key → root. If root falls, everything falls.
- **Supabase** — the data. Risk: a broken RLS policy or an over-privileged key leaking PII
  (phone, DOB, precise location, DMs) or letting a user write another user's rows.
- **The client bundle** — public by definition. Risk: shipping a secret (service_role key).
- **The supply chain** — GitHub secrets, npm deps, the CI runner.
- **User-to-user harm** — harassment, impersonation, doxxing, a vulnerable person's location
  exposed. (This is both a safety and a compliance risk — see PLAY_STORE_READINESS.md.)

---

## 1. Droplet OS hardening (the biggest gap — repo can't see it) 🔴
The nginx/TLS layer is already strong (see §2). The OS underneath is the unknown. Run these on
the droplet (as root, once), then verify:

```bash
# --- a) A non-root deploy user + key-only SSH (stop using root over SSH) ---
adduser --disabled-password deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
# put the deploy public key in /home/deploy/.ssh/authorized_keys, chmod 600

# --- b) Lock down sshd ---
# /etc/ssh/sshd_config:
#   PermitRootLogin no
#   PasswordAuthentication no
#   PubkeyAuthentication yes
#   MaxAuthTries 3
#   AllowUsers deploy
sshd -t && systemctl restart ssh

# --- c) Firewall: only 22/80/443 ---
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# --- d) Brute-force jail ---
apt-get install -y fail2ban
systemctl enable --now fail2ban          # ships with an sshd jail on by default

# --- e) Automatic security updates ---
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# --- f) Verify ---
ufw status verbose
fail2ban-client status sshd
ss -tlnp                                   # nothing should listen publicly except 22/80/443
```

- ⚠️ **Move CI deploy off `root`.** Today the GitHub Action SSHes as `root@droplet`. Switch the
  workflow's `TARGET` to `deploy@` and give `deploy` a scoped sudoers entry limited to exactly
  the deploy commands (rsync/tar to `/var/www`, `nginx -t`, `systemctl reload/restart nginx`).
  A leaked deploy key should never equal instant root.
- ⚠️ **Rotate the `DROPLET_SSH_KEY`** used in Actions after any teammate change; it is the crown
  jewel. Consider a deploy-only key with a `command="..."` restriction in authorized_keys.
- ⚠️ **DO Cloud Firewall** (in the DO panel, in addition to ufw) — belt and braces at the network
  edge: inbound 22 (ideally your IP only), 80, 443; deny the rest.
- ⚠️ **Turn on DO weekly snapshots / backups** so the box is disposable and recoverable.

## 2. Web / nginx / TLS ✅ (already strong — keep it)
- ✅ TLS via Let's Encrypt (certbot), HTTP→HTTPS 301, HSTS `max-age=31536000`.
- ✅ Tight CSP with an explicit `connect-src` allowlist; `object-src 'none'`; `frame-ancestors 'self'`.
- ✅ `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `server_tokens off`.
- ⚠️ Add `includeSubDomains; preload` to HSTS **only once every subdomain is HTTPS** (a
  shared V-Gruvs domain would be — do it then, not before).
- ⚠️ Confirm certbot auto-renew is active: `systemctl list-timers | grep certbot`. An expired
  cert = full outage (we already saw a cert/clock outage this month).
- ⚠️ Keep the deploy's nginx auto-recovery (reload → restart → enable) that we just added — it
  turns "nginx stopped" from an outage into a self-heal.

## 3. Supabase (the data layer) — mostly hardened, verify the edges
- ✅ Default-deny RLS, RPC-only writes, `SECURITY DEFINER` with pinned `search_path`, guard
  triggers, one-action-per-user (applied live across the app + the cross-app bridge).
- ✅ Cross-app PII isolation: `public_identity` view exposes only safe columns; email/phone/
  coords/wallet never cross apps. Precise location is server-side RPC only.
- 🔴 **Enable leaked-password protection** (Supabase advisor flagged it OFF):
  Dashboard → Authentication → Policies → enable "Check against HaveIBeenPwned". Zero cost.
- ⚠️ **MFA / stronger auth**: enable TOTP MFA option for accounts; enforce for any admin/staff
  account. Set a sane password min-length + rate limits (Auth settings).
- ⚠️ **Key hygiene**: only the **anon** (publishable) key ships in the client — confirm the
  `service_role` key is **never** in the bundle, the repo, or `EXPO_PUBLIC_*`. Grep on every
  release: `grep -rn "service_role\|SUPABASE_SERVICE" src/ dist/`.
- ⚠️ **Storage buckets**: verify every bucket is private-by-default with RLS on `storage.objects`;
  public buckets should hold only truly public assets. No listing of other users' media.
- ⚠️ **Re-run advisors before each release**: `get_advisors(security)` and fix any new
  `security_definer_view` / `rls_disabled` / `function_search_path_mutable` findings.
- ⚠️ **Backups**: confirm Supabase daily backups (and PITR if on a paid tier) are on; the DB is
  the irreplaceable asset.

## 4. CI/CD & supply chain
- ⚠️ **GitHub**: enable branch protection on `main` (require the deploy build to pass), secret
  scanning + push protection, and Dependabot (already opening PRs — keep merging them).
- ⚠️ **Least-privilege secrets**: `DROPLET_SSH_KEY` → deploy user only; Supabase service key (if
  any CI uses it) scoped and rotated. Never echo secrets in workflow logs.
- ⚠️ **Pin actions** to a SHA or trusted major; review Dependabot action bumps.
- ✅ The pre-deploy Guardian audit (30 checks) already blocks broken imports / missing boundaries
  / hardcoded secrets before shipping — keep it as the gate.

## 5. Application layer
- ✅ Client input hardening exists (handle/impersonation guards, bot honeypot, escapeLike).
- ⚠️ **Account deletion** must be real and reachable (Play requires it — see readiness doc). The
  deletion pipeline is live; verify the in-app entry point works end to end.
- ⚠️ **Rate-limit sensitive RPCs** (reports, zone/alert creation, messaging) per user/hour —
  partially done; extend to any new write path so the shared map can't be flooded.
- ⚠️ **Secrets on device**: tokens live in `expo-secure-store` (good). Never log tokens; never
  put a refresh token in a URL (matters when SSO/handoff is built).

## 6. Monitoring & incident response
- ⚠️ **Uptime check** on `https://thegruvs.com` (DO Monitoring or a free external pinger) so an
  outage pages you, not a user. (We found nginx down manually — automate it.)
- ⚠️ **DO Monitoring alerts** on CPU/disk/bandwidth (disk-full silently breaks nginx + Postgres).
- ⚠️ **Log review**: `fail2ban` bans, nginx 4xx/5xx spikes, Supabase auth anomalies.
- ⚠️ **Runbook**: write the 3 commands to (a) restart nginx, (b) roll back a deploy, (c) rotate
  the SSH key — so recovery is 60 seconds, not an investigation.

---

## Priority order (do these first)
1. 🔴 Droplet: non-root deploy user + `PermitRootLogin no` + `PasswordAuthentication no`, ufw, fail2ban, unattended-upgrades (§1).
2. 🔴 Supabase: enable leaked-password protection; confirm no `service_role` in client (§3).
3. ⚠️ Move CI deploy off root + rotate the deploy key (§1, §4).
4. ⚠️ DO Cloud Firewall + snapshots + an uptime monitor (§1, §6).
5. ⚠️ Branch protection + keep merging Dependabot (§4).

Everything in §2 is already done. The single most valuable hour is §1 on the droplet.
