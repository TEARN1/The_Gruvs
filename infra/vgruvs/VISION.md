# What V-Gruvs should be

V-Gruvs is the hosting platform for The Gruvs, Excellency Academy and The
Resident Crew, on one DigitalOcean droplet. This note records the research
behind version 2:

- what a modern Vercel offers;
- what the self-hosted alternatives do;
- what fits a small droplet;
- what V-Gruvs therefore became, and what it deliberately is not.

## 1. What "Vercel in 2026" means

These are the parts of Vercel that matter to our three apps.

| Vercel feature | What it does |
|---|---|
| **Instant rollback, previews** | Every deploy is immutable. Rolling back is a pointer move. Each branch gets a URL. |
| **Fluid compute** | One function instance serves many requests at once; billing counts only active CPU. |
| **Rolling Releases** | A new deploy first gets a share of visitors (for example 5%). It moves to everyone in stages, judged on metrics. |
| **Skew Protection** | A visitor who loaded the site before a deploy keeps getting files from their own deploy, so lazy-loaded chunks don't 404. It is on by default for new projects, kept from 4 hours to 30 days. Next.js does its half with `deploymentId` (`?dpl=`). |
| **Firewall** | Custom rules (block, challenge, rate-limit), an "Attack Challenge Mode" lever for emergencies, BotID. |
| **Observability** | Requests, errors and p75 latency per route. Anomaly alerts, and **Vercel Agent investigations**: AI root-cause analysis when an alert fires. |
| **Speed Insights** | Core Web Vitals (LCP, INP, CLS) from real visitors, at p75. |
| **Web Analytics** | Visitors without cookies, through a request hash that resets every day. |
| **Cron jobs** | `crons` in `vercel.json`, called with `Authorization: Bearer $CRON_SECRET`. |
| **CDN caching** | Responses marked `s-maxage` / `stale-while-revalidate` are cached at the edge. |
| **Deployment Protection** | Previews behind a password or a login. |

## 2. What the self-hosted platforms do

- **Coolify:**
  - Runs anything in Docker, with 280+ one-click services, and notifications by email, Discord, Telegram, Slack, Pushover or webhook.
  - Rolls back only to images still on the server.
- **Dokploy:** a cleaner UI over Docker Compose, which idles at around **600 MB of RAM**.
- **Kamal 2:**
  - Not a platform: it deploys containers over SSH.
  - Its `kamal-proxy` swaps traffic once a health check passes, and has maintenance pages, request pausing and rollouts.
- **Dokku and CapRover:** Heroku-style buildpacks on one machine.

**The decisive fact for us:** our droplet has **512 MB**. A platform whose control plane idles at 600 MB cannot run on it, let alone beside three apps. The same is true of anything that builds on the server: a Next.js or Metro build alone exceeds 512 MB.

## 3. Principles

1. **Nothing runs except the apps.**
   - No platform daemon, no database, no Docker.
   - V-Gruvs is a command, nginx configuration, systemd timers, and Node modules that run for a moment and exit.
   - The console is static files.
2. **Every change is a release, and every release is reversible:** code, the nginx site, and maintenance mode.
3. **Judge with real traffic.**
   - Health checks prove a release starts. Only real requests prove it works.
   - So every deploy is watched (the autopilot), and server apps can roll out in stages against the old release (canary).
4. **Stay up when an app is down.** The edge cache serves the last good copy, and a friendly page covers the rest.
5. **Private by default.**
   - No cookies, no query strings in logs, no addresses in Web Vitals.
   - The AI analysis is opt-in and sees only a redacted report.
6. **Plain files.** Configs in `/etc/vgruvs`, state in `/var/lib/vgruvs`, logs in `/var/log/nginx/vgruvs`. Everything can be read with `cat`.

## 4. The feature map

| Vercel | V-Gruvs 2 | How |
|---|---|---|
| Instant rollback | ✅ | Releases plus an atomic symlink; `vgruvs rollback`, or the **Rollback** workflow in each repo |
| Zero-downtime deploys | ✅ | Blue/green slots; nginx switches after a health check; old requests drain |
| Rolling Releases | ✅ | `ROLLOUT="20 50"`: sticky per visitor (address + browser), canary against stable on the same traffic, automatic promote or abort |
| Skew Protection | ✅ | A hard-linked vault of every release's fingerprinted files, kept `SKEW_MAX_AGE_DAYS`; Next.js `?dpl=` routed to the exact release |
| Fluid compute | ✅ (by design) | One long-lived Node process per app serves requests concurrently; no cold starts |
| Functions + `vercel.json` | ✅ | `api/*.js` with Web Request/Response, rewrites, redirects, headers, streaming responses |
| Cron jobs | ✅ | `crons` in `vercel.json` or `CRONS` in the conf; `Bearer $CRON_SECRET`, `vercel-cron/1.0` user agent |
| CDN caching, stale-while-revalidate | ✅ (one location) | nginx edge cache honouring `s-maxage` and `stale-while-revalidate`; never for cookies or logins; a new generation per release |
| Always online | ✅ | Stale copies while the app is down or failing; an offline page otherwise |
| Observability | ✅ | `vgruvs insights`: requests, errors, p50/p95/p99, cache hits, busiest, slowest and failing routes |
| Anomaly alerts + Agent investigation | ✅ | Autopilot rollback, incident report, notification; optional Claude analysis of the report |
| Speed Insights | ✅ | A 2 KB beacon added to every page by nginx; `vgruvs vitals` reports p75 and an experience score |
| Web Analytics | ✅ | `vgruvs analytics`: visitors by a daily hash, pages, referrers, devices; bots left out |
| Firewall | ✅ (partial) | Scanner paths closed plus a fail2ban ban, per-address blocks, attack mode (strict limits everywhere), API and login rate limits. No JavaScript challenge or BotID |
| Deployment Protection | ✅ | `vgruvs previews <app> protect`: a password on previews |
| Preview URLs | ✅ (static) | `pr-<n>.preview.<domain>` from CI |
| Dashboard | ✅ | The console: every app's health, releases, rollout, traffic, vitals, events and certificates |
| Notifications | ✅ | Discord, Slack, ntfy (phone) or any webhook |
| Maintenance mode | ✅ (from kamal-proxy) | `vgruvs maintenance <app> on "message"`, with a bypass token |
| Self-diagnosis | ✅ | `vgruvs doctor`: nginx, apps, certificates, DNS, memory, disk, services, firewall, updates |
| New project in one step | ✅ | `vgruvs apps add` from templates |
| Global edge network | ❌ | One machine. Put Cloudflare's free plan in front (README) |
| Autoscaling, multi-region | ❌ | One droplet; resize it in the DigitalOcean panel |
| Image optimisation service | ➖ | Next.js does its own, cached across deploys |
| Build servers | ➖ | GitHub Actions builds; the droplet only receives |

## 5. Deliberately not built

- **A web control panel with buttons.** Its server would be the most valuable target on the machine. The console is read-only static files. Actions stay in the `vgruvs` command and in GitHub Actions workflows, behind SSH keys.
- **Docker.** It would add hundreds of MB and a daemon, for apps that run fine as one Node process each.
- **A JavaScript challenge or bot fingerprinting.** These need an edge network to be worth anything. Attack mode and the scanner bans cover the attacks a small site sees; Cloudflare covers the rest.

## Sources

- Vercel:
  - [Rolling Releases](https://vercel.com/docs/rolling-releases)
  - [Skew Protection](https://vercel.com/docs/skew-protection), [Skew Protection on by default](https://vercel.com/changelog/skew-protection-is-now-enabled-by-default-for-new-projects)
  - [Firewall concepts](https://vercel.com/docs/vercel-firewall/firewall-concepts), [Bot protection](https://vercel.com/docs/security/bot-protection)
  - [Observability](https://vercel.com/docs/observability), [Vercel Agent investigations](https://vercel.com/docs/agent/investigation)
  - [Web Analytics](https://vercel.com/docs/analytics), [Speed Insights CLI](https://vercel.com/docs/speed-insights/accessing-metrics-with-vercel-cli)
  - [Cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
  - [Deployment Protection](https://vercel.com/docs/deployment-protection)
- Next.js: `deploymentId` (in `node_modules/next/dist/docs` of The Resident: 01-app/03-api-reference/05-config/01-next-config-js/deploymentId.md)
- Self-hosted platforms:
  - [Self-hosted PaaS compared 2026](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/)
  - [Coolify notifications](https://coolify.io/docs/core/notifications/events)
  - [Kamal 2 proxy](https://kamal-deploy.org/docs/upgrading/proxy-changes/)
  - [Coolify alternatives (Dokploy RAM)](https://temps.sh/blog/5-best-coolify-alternatives-self-hosted-paas-2026)
- Techniques:
  - Canary analysis: [automated rollback on error rate](https://oneuptime.com/blog/post/2026-03-13-how-to-implement-automated-rollback-based-on-error-rate-with-flagger/markdown)
  - Vite's guidance to keep old chunks: [Vite troubleshooting](https://v7.vite.dev/guide/troubleshooting)
  - nginx `s-maxage` support: [changeset 88d55e5934f7](https://freenginx.org/hg/nginx/rev/88d55e5934f7)
