# V-Gruvs

V-Gruvs is the hosting layer for our DigitalOcean droplet (`144.126.236.75`).
It gives The Gruvs, Excellency Academy and The Resident Crew the parts of
Vercel we rely on, on a machine we already pay for:

- Every deploy is a new release.
- A deploy only goes live if it answers.
- A bad deploy rolls back by itself.
- Going back to any earlier release takes one command.

| App | Type | What runs | Domains |
|---|---|---|---|
| `thegruvs` | static | nginx serves the Expo web export | thegruvs.com, www |
| `excellency` | functions | nginx serves `dist/`; the V-Gruvs runtime runs `api/*.js` and `vercel.json` rewrites | excellencyacs.com, www |
| `theresident` | node | Next.js standalone `server.js` behind nginx | theresidentcrew.com, www |

## How it compares with Vercel

**What V-Gruvs does too**

- **Push-to-deploy:** a GitHub Actions workflow per repo, using `vgruvs-deploy.sh`.
- **Atomic deploys:** releases live in their own folders, and a symlink swap is instant.
- **Instant rollback:**
  - `vgruvs rollback <app>`, or the **Web Rollback** workflow.
  - The last 5 releases are kept (3 for The Resident).
- **Zero-downtime deploys for servers:**
  - Blue/green: the new release starts on the idle port.
  - It must pass its health check before nginx switches to it.
  - Requests still running on the old copy are allowed to finish.
- **A broken deploy never stays live:**
  - After the switch, the site is checked through nginx and TLS, as a visitor sees it.
  - It must give three good answers in a row, and the functions runtime must report the new release id.
  - Otherwise it rolls back to the previous release automatically.
- **Serverless-style functions:**
  - `api/<name>.js` exporting `GET`/`POST`/… or a default handler, using Web `Request`/`Response`.
  - `vercel.json` rewrites work as they do on Vercel, with no code changes.
- **Preview URLs:**
  - `--preview pr-12` puts a build at `https://pr-12.preview.thegruvs.com`.
  - Previews are kept out of search engines and removed after 14 days.
- **Environment variables:** `vgruvs env <app> set KEY value`. Values are never printed, and the app restarts with them.
- **HTTPS and certificate renewal:** Let's Encrypt; checked twice a day by `vgruvs heal` and certbot's own timer.
- **Logs:** `vgruvs logs <app> -f`.

**Where it is better**

- **Rate limits that hold:**
  - nginx limits `/api/` to 10 requests per second per address, and The Resident's `/auth/` and `/api/` to 30 per minute.
  - On Vercel, in-memory limits reset on every cold instance. Here there is one machine, so they hold.
  - nginx replaces `X-Forwarded-For` with the real address, so a client cannot fake its way past the limit.
- **Predictable cost:** a flat droplet price. No bandwidth or function-invocation overage, no per-seat plan, and nothing "full".
- **One place:** the same machine, same commands and same logs for all three apps.

**What it does not have (and what to do about it)**

- **A global edge network.**
  - Vercel serves from many cities; the droplet is in one.
  - Fix: put the domains behind Cloudflare's free plan:
    1. Point the DNS at Cloudflare and proxy the records.
    2. Set SSL to "Full (strict)".
  - When you do, tell nginx the real visitor address, or every visitor will look like Cloudflare to the rate limits. Add `real_ip_header CF-Connecting-IP;` and a `set_real_ip_from` line for each Cloudflare range to `/etc/nginx/conf.d/cloudflare.conf`.
- **Autoscaling.** One droplet has fixed capacity. For our traffic this is not the constraint; memory is (below).
- **Build servers.** Apps build in GitHub Actions (or on a laptop), never on the droplet. A 512 MB machine cannot run Metro or `next build`.
- **Image optimisation and analytics.** Next.js still optimises images itself, with its cache kept across deploys in `/srv/vgruvs/cache/<app>`. For analytics, use Plausible or Umami if needed.

## Memory and droplet size

The droplet has **512 MB of RAM**. That is enough for The Gruvs (static) plus Excellency, whose functions runtime uses about 60 MB.

**Before The Resident goes on, resize to 1 GB** in the DigitalOcean panel (Resize → CPU and RAM only, so it can be undone):

- The Resident's server used about 100 MB after serving its first pages in testing, and grows with traffic.
- A blue/green deploy briefly runs two copies.

Bootstrap adds a 2 GB swap file on small droplets, so a peak slows down rather than crashes.

Each app slot is capped by systemd (`MemoryHigh=280M`, `MemoryMax=360M`), so one app cannot starve the others. To raise the cap for one app:

```bash
systemctl edit vgruvs-app@theresident-a   # and -b
```

## Setting it up (once)

Run these as root from a machine with the repo. Bootstrap backs up the nginx config first. If nginx rejects the new config, or thegruvs.com stops answering, it puts the old config back, so the live site keeps working.

```bash
# 1. A deploy key for CI (keep the private half for step 4)
ssh-keygen -t ed25519 -N '' -C vgruvs-ci -f vgruvs-ci

# 2. Copy the kit up and run it
scp -r infra/vgruvs root@144.126.236.75:/root/vgruvs
ssh root@144.126.236.75 "DEPLOY_PUBKEY='$(cat vgruvs-ci.pub)' bash /root/vgruvs/bootstrap.sh"
```

Bootstrap does the following:

1. Installs the packages: nginx, certbot, Node 22, the ufw firewall, fail2ban and automatic security updates.
2. Adds a swap file.
3. Creates two users:
   - `vgruvs` runs the apps.
   - `deploy` is for CI. Its sudo rule allows `vgruvs receive`, `rollback`, `releases` and `status`, and nothing else, so a leaked CI key is not root.
4. Installs the `vgruvs` command and the systemd units.
5. Moves the live The Gruvs files from `/var/www/thegruvs` into release `migrated-<date>`.

It is safe to run again. It never deletes a release, and it keeps any app config you changed on the droplet; the repo's version is put beside it as `.new`.

Add `HARDEN_SSH=1` to turn off password logins. It only does this if root already has a key.

```bash
# 3. Excellency and The Resident: point their DNS A records (@ and www) at
#    144.126.236.75, wait for DNS, then on the droplet:
vgruvs certs excellency   && vgruvs site excellency
vgruvs certs theresident  && vgruvs site theresident
vgruvs env excellency set VERIFIER_SECRET '...'     # the same value Vercel has
vgruvs env theresident set NEXT_PUBLIC_SUPABASE_URL '...'   # and the rest of its .env
```

**4. GitHub secrets.** In each repo, under Settings → Secrets and variables → Actions:

- `VGRUVS_SSH_KEY`: the contents of `vgruvs-ci`, the private key.
- `DROPLET_HOST`: optional; it defaults to `144.126.236.75`.

The Gruvs' old `DROPLET_SSH_KEY` (root) keeps working: it uses V-Gruvs once it is installed. Delete it once `VGRUVS_SSH_KEY` deploys succeed.

**Order matters for Excellency and The Resident:**

1. Do step 3 before the first deploy, or the site will not be served yet.
2. Deploy once, so the app has a release.
3. Only then switch DNS away from Vercel.

## Every day

| Want to | Run (on the droplet, as root) |
|---|---|
| See everything | `vgruvs status`: live release and health per app, memory, disk, certificate expiry |
| List releases | `vgruvs releases thegruvs`: `*` marks the live one |
| Undo the last deploy | `vgruvs rollback thegruvs`, or the **Web Rollback** workflow |
| Go to a specific release | `vgruvs rollback thegruvs 20261006-101500-ab12cd34ef` |
| Read app logs | `vgruvs logs excellency -f` |
| Set a secret | `vgruvs env excellency set KEY 'value'` (`list` shows names only) |
| Restart an app | `vgruvs restart theresident` |

**Deploys:**

- **From CI:** pushes to `main` deploy through the repo's workflow.
- **From a laptop:**

  ```bash
  VGRUVS_HOST=deploy@144.126.236.75 infra/vgruvs/client/vgruvs-deploy.sh thegruvs --from dist
  VGRUVS_HOST=deploy@144.126.236.75 infra/vgruvs/client/vgruvs-deploy.sh excellency dist api vercel.json
  ```

**Self-healing:** `vgruvs-heal.timer` runs every two minutes. It does three things:

- restarts an app that stopped answering;
- removes previews older than two weeks;
- renews certificates.

## PR previews (optional)

1. DNS: add an `A` record for `*.preview.thegruvs.com` pointing to `144.126.236.75`.
2. Get a wildcard certificate. Wildcards need a DNS challenge:

   ```bash
   # DNS hosted at DigitalOcean (API token with write access to the domain):
   apt-get install -y python3-certbot-dns-digitalocean
   printf 'dns_digitalocean_token = %s\n' 'dop_v1_...' > /root/.do.ini && chmod 600 /root/.do.ini
   certbot certonly --dns-digitalocean --dns-digitalocean-credentials /root/.do.ini \
     -d '*.preview.thegruvs.com' --cert-name preview.thegruvs.com

   # DNS elsewhere: certbot certonly --manual --preferred-challenges dns \
   #   -d '*.preview.thegruvs.com' --cert-name preview.thegruvs.com
   #   (it asks you to add a TXT record; manual certificates do not renew by themselves)
   ```

3. Turn the previews on:
   - On the droplet, run `vgruvs previews thegruvs enable`.
   - In GitHub, set the repo variable `VGRUVS_PREVIEWS` to `true`.

   Each PR then deploys to `https://pr-<number>.preview.thegruvs.com`.

## Security

- **Users:**
  - CI deploys as `deploy`, not root.
  - Apps run as `vgruvs`, with systemd hardening: read-only system, no home directories, no privilege escalation, and write access to their own cache only.
- **Unpacking:** uploads are unpacked as `vgruvs`. A crafted archive can write nowhere but its own release folder.
- **Release check:** a release must have the right shape before it can go live (`index.html`, `api/`, or `server.js`).
- **Names:** app, release and preview names are checked against a strict pattern before any path is built from them. The deploy client quotes them before they reach the remote shell.
- **Network:**
  - HTTPS for a hostname no site claims gets its connection closed, so no app ever sees a forged `Host`.
  - ufw allows only SSH, 80 and 443.
  - fail2ban watches SSH.
  - Security updates install themselves.
- **Function runtime:**
  - Errors become a plain 500, so stack traces never reach visitors.
  - Request bodies are capped at 1 MB and requests time out after 10 seconds.
  - `X-Forwarded-*` is trusted only from nginx on the same machine.

## Files

| Path | Installed to | Purpose |
|---|---|---|
| `bin/vgruvs` | `/usr/local/bin/vgruvs` | the command |
| `runtime/functions-server.mjs` | `/usr/local/lib/vgruvs/` | runs `api/*.js` + `vercel.json` (no dependencies) |
| `lib/run-app` | `/usr/local/lib/vgruvs/` | starts one slot of one app |
| `apps/*.conf` | `/etc/vgruvs/apps/` | app type, domains, ports, health path, releases kept |
| `nginx/sites/*.conf` | enabled by `vgruvs site <app>` | one site per app, plus port 80 and previews |
| `nginx/snippets/*.conf` | `/etc/nginx/snippets/` | TLS, gzip, headers, proxy, ACME |
| `systemd/*` | `/etc/systemd/system/` | app slots and the heal timer |
| `client/vgruvs-deploy.sh` | (copied into each repo) | ships a build from CI or a laptop |

On the droplet, each app has:

- `/srv/vgruvs/<app>/releases/<id>`
- `current` (a symlink)
- `slots/a|b` (for functions and node apps)
- `previews/<name>`

Secrets are in `/etc/vgruvs/env/<app>.env`, readable by root and the app user only.

## Tests

```bash
node --test infra/vgruvs/runtime/functions-server.test.mjs   # the functions runtime (12 tests)
bash infra/vgruvs/test/e2e.sh [excellency checkout] [resident release]   # everything, on one machine
```

The end-to-end test runs:

- real nginx with TLS on high ports;
- the real `vgruvs` command;
- the functions runtime, with Excellency's real build if you give it a path;
- The Resident's real standalone build, if you give it the folder its
  `scripts/vgruvs-release.sh` writes.

It covers 38 checks with both real builds, including:

- static and blue/green deploys;
- a broken release refused;
- a release that dies after going live rolled back automatically;
- manual rollback, pruning, previews, rewrites, rate limits, the `X-Forwarded-For` override and unknown hostnames refused.

`bootstrap.sh` was rehearsed against a copy of today's droplet setup (the live nginx config, `/var/www/thegruvs` and Let's Encrypt files). It covered:

- a broken kit, which was refused with the old site still serving;
- the migration;
- a deploy and rollback with the installed command;
- a second run that changed nothing.
