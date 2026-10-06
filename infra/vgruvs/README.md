# V-Gruvs 2

V-Gruvs turns our DigitalOcean droplet (`144.126.236.75`) into a
Vercel-style platform for The Gruvs, Excellency Academy and The Resident Crew.

It uses nginx, systemd timers, a bash command and a few small Node modules.
The only processes that keep running are the apps themselves: there is no
platform daemon, no database and no Docker, so all the memory goes to the apps.

[VISION.md](VISION.md) holds the research and reasoning behind it: what Vercel
offers in 2026, what Coolify, Dokploy and Kamal do, and why V-Gruvs is built
this way.

| App | Type | What runs | Domains |
|---|---|---|---|
| `thegruvs` | static | nginx serves the Expo web export | thegruvs.com, www |
| `excellency` | functions | nginx serves `dist/`; the V-Gruvs runtime runs `api/*.js` and `vercel.json` | excellencyacs.com, www |
| `theresident` | node | Next.js standalone `server.js` behind nginx | theresidentcrew.com, www |

## What it does

**Deploys you can trust**

- **Instant rollback:**
  - Every deploy is a release folder, and going live is an atomic switch.
  - `vgruvs rollback <app>` (or the **Rollback** workflow in each repo) takes seconds.
- **Zero downtime:**
  - Server apps start the new release on a spare port.
  - nginx switches only after it answers, and requests already running on the old copy finish first.
- **Rolling releases (optional):**
  - With `ROLLOUT="20 50"`, a new release first serves 20% of visitors, then 50%, then everyone.
  - Each visitor stays on one version.
  - Before each step, the new release's error rate and speed are compared with the old one's on the same traffic. A worse release is withdrawn by itself.
- **Autopilot:**
  - For five minutes after every deploy, real traffic is compared with the hour before.
  - If errors jump, the deploy is rolled back by itself and an incident report is written.
  - You are notified, and Claude can optionally analyse the report.
- **Skew protection:**
  - Visitors who opened the site before a deploy keep getting their version's JavaScript and CSS for 7 days. No more white screens from missing chunks.
  - Next.js pages get their exact release's files (`?dpl=`).
- **Previews:** `pr-<n>.preview.thegruvs.com` for pull requests, optionally behind a password.

**Fast, and up when an app is not**

- **Compressed once, at deploy:** text files are gzipped (and brotli-compressed where nginx has the module). nginx sends them with no work per request.
- **Edge cache:**
  - Pages an app marks cacheable (`s-maxage`, `stale-while-revalidate`) are served by nginx.
  - Never for a visitor with a login cookie.
  - Each release starts fresh.
- **Always online:** if an app crashes, cached pages keep being served, and anything else gets a "we'll be right back" page that retries by itself.

**Seeing what happens** (no cookies, no query strings, no third parties)

- `vgruvs insights <app>`: requests, errors, p50/p95/p99 speed, edge-cache hits, and the busiest, slowest and failing routes.
- `vgruvs analytics <app>`: visitors (a hash that resets daily, as Vercel does), page views, referrers, devices and browsers; bots are left out.
- `vgruvs vitals <app>`: Core Web Vitals (LCP, INP, CLS, FCP, TTFB) from real visitors.
  - A 2 KB script is added to every page by nginx; the apps need no changes.
  - The result is p75 per metric and an experience score.
- **The console:** one page showing every app's health, releases, rollout progress, traffic, vitals, events, incidents and certificates.

**Protection**

- **Shield:**
  - Requests only scanners make (`/.env`, `/wp-login.php`, `.php`, ...) get the connection closed. Three of them earn a one-day ban (fail2ban).
  - `vgruvs shield block <ip>` blocks an address on every app.
  - `vgruvs shield attack on` puts a strict per-address limit on everything.
- **Built-in rate limits:** the APIs and the sign-in pages have rate limits that hold, because everything runs on one machine.
- **Unknown hostnames:** HTTPS for a hostname no site claims is refused.
- **Accounts:**
  - CI deploys as a `deploy` user that can only ship, roll back, run rollouts and read status.
  - Apps run unprivileged, cannot change their own code, and have memory caps.

**Running it**

- `vgruvs maintenance <app> on "message"`: a maintenance page with a bypass token, so you can still check the site.
- **Crons:** Vercel-style (`crons` in `vercel.json`, or `CRONS` in the conf), sent with `Authorization: Bearer $CRON_SECRET`.
- **Notifications:** Discord, Slack, ntfy (phone push) or any webhook.
- `vgruvs doctor`: checks nginx, every app, certificates, DNS, memory, disk, services, firewall, updates and the clock, and says how to fix each problem.
- `vgruvs apps add`: a new app from a template, ready for its first deploy.
- **Self-healing:** every two minutes, apps that stopped answering are restarted, certificates are renewed, and warnings go out for the disk and certificates.

## Memory and droplet size

The droplet has **512 MB of RAM**:

- The Gruvs (static) and Excellency (about 60 MB) fit.
- The Resident's Next.js server used about 100 MB after its first pages in testing, and grows with traffic.
- Rolling releases briefly run two copies of an app.

**Resize to 1 GB before The Resident goes on.** In the DigitalOcean panel, use Resize → CPU and RAM only, so it can be undone.

Bootstrap adds a 2 GB swap file, so a peak slows the droplet down rather than crashing it. Each app slot is capped by systemd (`MemoryHigh=280M`, `MemoryMax=360M`); to raise one, run `systemctl edit vgruvs-app@theresident-a` (and `-b`).

## Setting it up (once)

Run these as root from a machine with the repo. Bootstrap backs up the nginx
config first. If nginx rejects the new one, or thegruvs.com stops answering,
it puts the old one back, so the live site keeps working.

```bash
# 1. A deploy key for CI (keep the private half for step 4)
ssh-keygen -t ed25519 -N '' -C vgruvs-ci -f vgruvs-ci

# 2. Copy the kit up and run it
scp -r infra/vgruvs root@144.126.236.75:/root/vgruvs
ssh root@144.126.236.75 "DEPLOY_PUBKEY='$(cat vgruvs-ci.pub)' bash /root/vgruvs/bootstrap.sh"
```

Bootstrap does the following, in order:

1. **Packages:** nginx, certbot, Node 22, the ufw firewall, fail2ban, automatic security updates, and brotli when Ubuntu has it.
2. **Swap file.**
3. **Users:**
   - `vgruvs` runs the apps.
   - `deploy` is for CI; its sudo rule allows `vgruvs receive`, `rollback`, `releases`, `rollout` and `status`.
4. **The vgruvs command and its pieces:** the command, the Node modules, the timers (heal every 2 minutes, crons every minute), log rotation (14 days) and the scanner jail.
5. **The move:** The Gruvs' live files move from `/var/www/thegruvs` into release `migrated-<date>`.

It is safe to run again. It never deletes a release, and it keeps app configs you changed (the repo's version goes beside them as `.new`). `HARDEN_SSH=1` turns off password logins, but only if root already has a key.

```bash
# 3. Excellency and The Resident: point their DNS A records (@ and www) at
#    144.126.236.75, wait for DNS, then on the droplet:
vgruvs certs excellency   && vgruvs site excellency
vgruvs certs theresident  && vgruvs site theresident
vgruvs env excellency set VERIFIER_SECRET '...'               # the same value Vercel has
vgruvs env theresident set SUPABASE_SERVICE_ROLE_KEY '...'    # and its other server secrets
```

**4. GitHub, in each repo** (Settings → Secrets and variables → Actions):

- **Secrets:**
  - `VGRUVS_SSH_KEY`: the contents of `vgruvs-ci`, the private key.
  - `DROPLET_HOST` (optional): it defaults to `144.126.236.75`.
- **The Resident only:** its `NEXT_PUBLIC_*` values as repository variables. Its deploy workflow lists them.
- **The old root key:** The Gruvs' `DROPLET_SSH_KEY` (root) still works and uses V-Gruvs. Delete it once deploys with the new key succeed.

**Order matters for Excellency and The Resident:**

1. Do step 3.
2. Deploy once.
3. Only then switch DNS away from Vercel.

**5. Check:** run `vgruvs doctor` on the droplet.

## Every day

| Want to | Run (on the droplet, as root) |
|---|---|
| See everything | `vgruvs status` · the console (below) |
| Undo the last deploy | `vgruvs rollback <app>` · or **Rollback** in the repo's Actions tab |
| Go to a specific release | `vgruvs releases <app>`, then `vgruvs rollback <app> <release>` |
| Follow a staged rollout | `vgruvs rollout <app>` · `promote` · `abort` |
| Traffic, errors and speed | `vgruvs insights <app> --since 24h` |
| Visitors | `vgruvs analytics <app> --since 7d` |
| Real-user speed | `vgruvs vitals <app>` |
| What happened, and when | `vgruvs events [<app>]` · reports in `/var/lib/vgruvs/incidents` |
| App output | `vgruvs logs <app> -f` |
| Set a secret | `vgruvs env <app> set KEY 'value'` (`list` shows names only) |
| Take a site down nicely | `vgruvs maintenance <app> on "Back at 10:00"` · `off` |
| Run or list crons | `vgruvs cron <app>` · `vgruvs cron <app> run /api/job` |
| Block an address | `vgruvs shield block 1.2.3.4` · `unblock` · `vgruvs shield` |
| Under attack | `vgruvs shield attack on` · `off` |
| Something feels wrong | `vgruvs doctor` |
| Apply edited app settings | `vgruvs sync` |

**Deploys:**

- **From CI:** pushes to the main branch deploy through each repo's workflow, which shows up under the repo's Environments.
- **From a laptop:**

  ```bash
  VGRUVS_HOST=deploy@144.126.236.75 infra/vgruvs/client/vgruvs-deploy.sh thegruvs --from dist
  ```

## The console

```bash
ssh -L 9900:127.0.0.1:9900 root@144.126.236.75     # then open http://localhost:9900
```

It refreshes every few minutes and after every deploy.

To open it on the web behind a password:

1. Point a domain at the droplet.
2. Run `vgruvs console publish ops.thegruvs.com`. It gets the certificate and prints a password.

`vgruvs console unpublish` takes it off the web again. The console is read-only by design: actions stay with `vgruvs` and the GitHub workflows, behind SSH keys.

## Settings per app

Each app's settings are in `/etc/vgruvs/apps/<app>.conf`. Edit the file, then run `vgruvs sync`.

| Setting | Default | Meaning |
|---|---|---|
| `APP_TYPE` | | `static`, `functions` or `node` |
| `DOMAINS` | | Space-separated; the first is the primary |
| `PORT_A`, `PORT_B` | | The two blue/green ports (functions and node) |
| `HEALTH_PATH` | `/` | Checked on the new copy, then through nginx |
| `KEEP_RELEASES` | 5 | Releases kept for rollback |
| `SKEW_DIRS` | per type | Fingerprinted folders kept after deploys (`url[=path in release]`) |
| `SKEW_MAX_AGE_DAYS` | 7 | How long an old release's files stay loadable |
| `PRECOMPRESS` | on | gzip/brotli at deploy time |
| `EDGE_CACHE` | on | Cache what the app marks cacheable |
| `VITALS` | on | Add the Web Vitals script to pages |
| `ROLLOUT` | empty | Percent steps, e.g. `"20 50"`; empty means switch everyone at once |
| `ROLLOUT_STEP_SECONDS` | 120 | Time per step |
| `AUTOPILOT` | on | Watch each deploy and roll back on an error jump |
| `AUTOPILOT_WINDOW_SECONDS` | 300 | How long it watches |
| `AUTOPILOT_MAX_ERROR_RATE` | 5 | Percent of server errors that counts as a jump (and more than twice the hour before) |
| `AUTOPILOT_MIN_REQUESTS` | 20 | Fewer requests than this are not judged |
| `CRONS` | empty | `"0 3 * * * /api/cleanup; */10 * * * * /api/sync"` (UTC) |
| `PREVIEW_DOMAIN` | empty | Turns on previews at `<name>.<PREVIEW_DOMAIN>` |

## Notifications

Create `/etc/vgruvs/notify.conf` (mode 600) with one line, then run `vgruvs notify test`:

```bash
NOTIFY_URL=https://discord.com/api/webhooks/...      # or a Slack webhook,
                                                     # or https://ntfy.sh/<a-long-random-topic> for phone push
```

You hear about:

- deploys and failed deploys;
- rollbacks, including autopilot ones;
- rollout steps;
- apps restarted by the heal timer;
- certificates close to expiry, and a full disk;
- attack mode;
- failed crons;
- maintenance mode.

`NOTIFY_EVENTS="deploy_failed auto_rollback"` narrows that list.

## AI incident analysis (optional)

When the autopilot rolls a deploy back, it writes an incident report. Claude can add a plain-language root-cause analysis to it.

To turn it on, create `/etc/vgruvs/ai.env` (mode 600):

```bash
ANTHROPIC_API_KEY=sk-ant-...
# AI_MODEL=claude-opus-5-5     the default
# AI_EFFORT=high
```

**What is sent:** only the report. It has counts per route and the app's output, with query strings and IP addresses removed. It never contains visitors' addresses, cookies or request bodies.

Without the file, nothing is sent anywhere.

## PR previews (optional)

1. DNS: add an `A` record for `*.preview.thegruvs.com` pointing to `144.126.236.75`.
2. Get a wildcard certificate. Wildcards need a DNS challenge:

   ```bash
   # DNS hosted at DigitalOcean (API token with write access to the domain):
   apt-get install -y python3-certbot-dns-digitalocean
   printf 'dns_digitalocean_token = %s\n' 'dop_v1_...' > /root/.do.ini && chmod 600 /root/.do.ini
   certbot certonly --dns-digitalocean --dns-digitalocean-credentials /root/.do.ini \
     -d '*.preview.thegruvs.com' --cert-name preview.thegruvs.com
   ```

3. On the droplet, run `vgruvs previews thegruvs enable`. In GitHub, set the repo variable `VGRUVS_PREVIEWS=true`.
4. Optional: `vgruvs previews thegruvs protect reviewer` puts the previews behind a password. It prints one, or reads it from standard input.

## Cloudflare in front (optional)

Vercel serves from many cities; the droplet is in one. Cloudflare's free plan adds a global cache and DDoS protection:

1. Move the DNS to Cloudflare, with the records proxied.
2. Set SSL to "Full (strict)".
3. Tell nginx the real visitor address, or every visitor looks like Cloudflare to the rate limits, the shield and the analytics. Create `/etc/nginx/conf.d/cloudflare.conf` with `real_ip_header CF-Connecting-IP;` and one `set_real_ip_from <range>;` line for each range at cloudflare.com/ips.

## Files

| Path | Installed to | Purpose |
|---|---|---|
| `bin/vgruvs` | `/usr/local/bin/vgruvs` | the command |
| `runtime/functions-server.mjs` | `/usr/local/lib/vgruvs/` | runs `api/*.js` and `vercel.json` (rewrites, redirects, headers; streaming) |
| `runtime/vitals.js` | `/usr/local/lib/vgruvs/runtime/` | the Web Vitals beacon |
| `lib/insights.mjs` | `/usr/local/lib/vgruvs/` | logs: insights, analytics, vitals, canary and autopilot verdicts, incident reports |
| `lib/console.mjs` | `/usr/local/lib/vgruvs/` | writes the console |
| `lib/cron.mjs`, `lib/notify.mjs`, `lib/ai.mjs` | `/usr/local/lib/vgruvs/` | crons, notifications, AI analysis |
| `lib/run-app` | `/usr/local/lib/vgruvs/` | starts one slot of one app |
| `pages/*.html` | `/usr/local/lib/vgruvs/pages/` | the offline and maintenance pages |
| `apps/*.conf` | `/etc/vgruvs/apps/` | each app's settings |
| `nginx/sites/*`, `nginx/templates/*` | nginx | one site per app, port 80, the console, previews, new-app templates |
| `nginx/snippets/*.conf` | `/etc/nginx/snippets/` | TLS, compression, headers, proxy, edge cache, platform features |
| `systemd/*` | `/etc/systemd/system/` | app slots, heal and cron timers |
| `client/vgruvs-deploy.sh` | (copied into each repo) | ships a build from CI or a laptop |

**Generated on the droplet:**

- **nginx includes:** written by `vgruvs sync` into `/etc/nginx/vgruvs/`.
- **Releases:** `/srv/vgruvs/<app>/releases/<id>`, `current`, `slots/a|b`, `vault/` (skew protection) and `previews/`.
- **Events and incidents:** in `/var/lib/vgruvs/`.
- **Request logs:** in `/var/log/nginx/vgruvs/`.
- **The edge cache:** in `/var/cache/nginx/vgruvs/`.

## Tests

```bash
node --test infra/vgruvs/runtime/functions-server.test.mjs    # the functions runtime
node --test infra/vgruvs/lib/lib.test.mjs                     # insights, crons, notifications, AI request
bash infra/vgruvs/test/e2e.sh [excellency checkout] [resident release]
```

The end-to-end test runs real nginx with TLS on high ports, the real `vgruvs` command, and real app processes (with the real Excellency and Resident builds when given). It covers:

- every deploy path, rollbacks, skew protection and `?dpl=` routing;
- gzip and brotli, the edge cache, "always online" and the offline page, and the heal timer;
- crons, staged rollouts (promoted and withdrawn), and the autopilot rolling back a bad deploy, with its notification and incident report;
- the shield, maintenance mode, and previews with a password;
- insights, analytics and vitals, the console, the doctor, and adding an app.

`bootstrap.sh` was also rehearsed against a copy of the droplet as it is today.
