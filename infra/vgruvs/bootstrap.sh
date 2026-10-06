#!/usr/bin/env bash
# One-time setup of V-Gruvs on the droplet. Safe to run again (it only adds
# what is missing and never deletes a release).
#
#   scp -r infra/vgruvs root@144.126.236.75:/root/vgruvs
#   ssh root@144.126.236.75 'bash /root/vgruvs/bootstrap.sh'
#
# Options (environment variables):
#   DEPLOY_PUBKEY="ssh-ed25519 AAAA... ci"   key CI deploys with, as the `deploy` user
#   HARDEN_SSH=1                             turn off SSH passwords (only if root already has a key)
#
# What it does, in order: packages (nginx, certbot, Node 22, firewall,
# fail2ban, automatic security updates, brotli when available), a swap file,
# the `vgruvs` and `deploy` users, the vgruvs command and its modules,
# systemd units (heal, crons), log rotation, the scanner jail, the nginx
# snippets and console, and then moves The Gruvs from /var/www/thegruvs onto
# V-Gruvs.
# The move backs up the current nginx config first and restores it if
# nginx rejects the new one or the site stops answering.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/root/vgruvs-backup-$STAMP"

say() { printf '\n==> %s\n' "$*"; }
die() { printf 'bootstrap: %s\n' "$*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die "run as root"
[[ -x "$HERE/bin/vgruvs" ]] || die "run from the infra/vgruvs folder copied to the droplet"

say "Packages"
export DEBIAN_FRONTEND=noninteractive
# Ubuntu's own background updates hold the package lock now and then: wait
# for them (up to 5 minutes) rather than fail.
apt_get() { apt-get -o DPkg::Lock::Timeout=300 "$@"; }
apt_get update -q
apt_get install -y -q nginx certbot curl ufw fail2ban unattended-upgrades openssl bind9-dnsutils
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if ((node_major < 20)); then
  say "Installing Node 22 (found: ${node_major})"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt_get install -y -q nodejs
fi
# Security updates install themselves.
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now fail2ban >/dev/null 2>&1 || true

say "Swap"
if ! swapon --show | grep -q .; then
  mem_mb="$(free -m | awk '/Mem:/ {print $2}')"
  free_gb="$(df -BG --output=avail / | tail -1 | tr -dc '0-9')"
  if ((mem_mb < 2048 && ${free_gb:-0} < 4)); then
    echo "skipped: only ${free_gb:-?} GB of disk free for a 2 GB swap file"
  elif ((mem_mb < 2048)); then
    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
    echo 'vm.swappiness=10' >/etc/sysctl.d/90-vgruvs-swap.conf && sysctl -q -p /etc/sysctl.d/90-vgruvs-swap.conf
    echo "added a 2 GB swap file (RAM is ${mem_mb} MB)"
  fi
else
  echo "swap already present"
fi

say "Users"
id vgruvs >/dev/null 2>&1 || useradd --system --home-dir /srv/vgruvs --shell /usr/sbin/nologin vgruvs
if ! id deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "V-Gruvs deploys" deploy >/dev/null
fi
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
if [[ -n "${DEPLOY_PUBKEY:-}" ]] && ! grep -qF "$DEPLOY_PUBKEY" /home/deploy/.ssh/authorized_keys; then
  echo "$DEPLOY_PUBKEY" >>/home/deploy/.ssh/authorized_keys
fi
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
# The deploy key can ship and roll back releases, and set an app's secrets
# from stdin (CI copies them from GitHub on each deploy), and nothing else:
# a leaked CI key is no longer root on the box. It could already ship code
# that runs as the app, so setting the app's environment gives it no more.
cat >/etc/sudoers.d/vgruvs-deploy <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/local/bin/vgruvs receive *, /usr/local/bin/vgruvs rollback *, /usr/local/bin/vgruvs releases *, /usr/local/bin/vgruvs rollout *, /usr/local/bin/vgruvs status, /usr/local/bin/vgruvs status *, /usr/local/bin/vgruvs env * set * -
EOF
chmod 440 /etc/sudoers.d/vgruvs-deploy
visudo -cf /etc/sudoers.d/vgruvs-deploy >/dev/null || { rm -f /etc/sudoers.d/vgruvs-deploy; die "sudoers rule rejected"; }

say "V-Gruvs files"
install -d -m 755 /srv/vgruvs /srv/vgruvs/_console /usr/local/lib/vgruvs /usr/local/lib/vgruvs/runtime /usr/local/lib/vgruvs/pages \
  /usr/local/lib/vgruvs/nginx/sites /usr/local/lib/vgruvs/nginx/templates /etc/vgruvs /etc/vgruvs/apps /etc/vgruvs/sites \
  /etc/vgruvs/shield /var/www/letsencrypt /var/lib/vgruvs /var/log/nginx/vgruvs /var/cache/nginx/vgruvs
touch /var/log/nginx/vgruvs/vitals.log
install -d -m 750 -o root -g vgruvs /etc/vgruvs/env
install -d -m 700 /etc/vgruvs/tls
if [[ ! -s /etc/vgruvs/tls/default.key ]]; then
  # For the catch-all HTTPS server that refuses unknown hostnames.
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=invalid" \
    -keyout /etc/vgruvs/tls/default.key -out /etc/vgruvs/tls/default.crt >/dev/null 2>&1
  chmod 600 /etc/vgruvs/tls/default.key
fi
install -d -m 755 -o vgruvs -g vgruvs /srv/vgruvs/cache
install -m 755 "$HERE/bin/vgruvs" /usr/local/bin/vgruvs
install -m 755 "$HERE/lib/run-app" /usr/local/lib/vgruvs/run-app
install -m 644 "$HERE/runtime/functions-server.mjs" /usr/local/lib/vgruvs/functions-server.mjs
install -m 644 "$HERE/runtime/vitals.js" /usr/local/lib/vgruvs/runtime/vitals.js
for mod in insights cron notify console ai; do install -m 644 "$HERE/lib/$mod.mjs" "/usr/local/lib/vgruvs/$mod.mjs"; done
install -m 644 "$HERE"/pages/*.html /usr/local/lib/vgruvs/pages/
install -m 644 "$HERE"/nginx/sites/* /usr/local/lib/vgruvs/nginx/sites/
install -m 644 "$HERE"/nginx/templates/* /usr/local/lib/vgruvs/nginx/templates/
for conf in "$HERE"/apps/*.conf; do
  dest="/etc/vgruvs/apps/$(basename "$conf")"
  if [[ ! -f "$dest" ]]; then
    install -m 644 "$conf" "$dest"
  elif ! cmp -s "$conf" "$dest"; then
    install -m 644 "$conf" "$dest.new"
    echo "kept your $dest; the repo's version is beside it as $dest.new"
  fi
done
install -m 644 "$HERE"/nginx/snippets/*.conf /etc/nginx/snippets/
install -d -m 755 /etc/nginx/vgruvs /etc/nginx/vgruvs/upstreams /etc/nginx/vgruvs/apps /etc/nginx/vgruvs/auth
install -m 644 "$HERE"/systemd/vgruvs-app@.service "$HERE"/systemd/vgruvs-heal.service "$HERE"/systemd/vgruvs-heal.timer \
  "$HERE"/systemd/vgruvs-cron.service "$HERE"/systemd/vgruvs-cron.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now vgruvs-heal.timer vgruvs-cron.timer >/dev/null

# Request logs: two weeks, compressed after a day (insights reads both).
cat >/etc/logrotate.d/vgruvs <<'ROTATE'
/var/log/nginx/vgruvs/*.log {
    daily
    rotate 14
    missingok
    notifempty
    compress
    delaycompress
    sharedscripts
    postrotate
        invoke-rc.d nginx rotate >/dev/null 2>&1 || nginx -s reopen >/dev/null 2>&1 || true
    endscript
}
ROTATE

# Shield: an address that asks for /.env, /wp-login.php and the like three
# times in ten minutes is banned for a day.
if [[ -d /etc/fail2ban ]]; then
  mkdir -p /etc/fail2ban/filter.d /etc/fail2ban/jail.d
  cat >/etc/fail2ban/filter.d/vgruvs-probes.conf <<'FILTER'
# V-Gruvs: requests only vulnerability scanners make (nginx answers 444).
[Definition]
failregex = ^\{"t":"[^"]*","ip":"<HOST>",.*"s":444,
ignoreregex =
FILTER
  cat >/etc/fail2ban/jail.d/vgruvs.conf <<'JAIL'
[vgruvs-probes]
enabled  = true
port     = http,https
filter   = vgruvs-probes
logpath  = /var/log/nginx/vgruvs/*.log
maxretry = 3
findtime = 10m
bantime  = 1d
JAIL
  systemctl restart fail2ban >/dev/null 2>&1 || true
fi

# Brotli, when the distribution packages the nginx module: smaller than
# gzip for text. Kept off if nginx does not accept it.
if apt_get install -y -q libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static brotli >/dev/null 2>&1 &&
  compgen -G '/etc/nginx/modules-enabled/*brotli*' >/dev/null; then
  cat >/etc/nginx/snippets/vgruvs-brotli.conf <<'BROTLI'
brotli_static on;
brotli on;
brotli_comp_level 5;
brotli_types text/plain text/css application/javascript text/javascript application/json image/svg+xml application/manifest+json application/xml;
BROTLI
  if nginx -t -q 2>/dev/null; then
    echo "brotli is on"
  else
    install -m 644 "$HERE/nginx/snippets/vgruvs-brotli.conf" /etc/nginx/snippets/vgruvs-brotli.conf
    # A module nginx cannot load would break every later reload.
    nginx -t -q 2>/dev/null || apt_get remove -y -q libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static >/dev/null 2>&1 || true
    echo "nginx refused the brotli module; brotli stays off"
  fi
fi

# Every nginx include vgruvs generates (shield, logging, edge cache, Web
# Vitals, maintenance) is written from the app confs.
vgruvs sync --no-reload

say "Firewall"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ufw status | grep -v '(v6)'

say "Moving The Gruvs onto V-Gruvs"
mkdir -p "$BACKUP"
cp -a /etc/nginx/sites-available /etc/nginx/sites-enabled "$BACKUP"/
echo "nginx config backed up to $BACKUP"

restore() {
  echo "restoring the previous nginx config from $BACKUP" >&2
  rm -rf /etc/nginx/sites-available /etc/nginx/sites-enabled
  cp -a "$BACKUP/sites-available" "$BACKUP/sites-enabled" /etc/nginx/
  nginx -t && systemctl reload nginx
}

if [[ ! -e /srv/vgruvs/thegruvs/current && -s /var/www/thegruvs/index.html ]]; then
  release="migrated-$STAMP"
  mkdir -p /srv/vgruvs/thegruvs/releases
  cp -a /var/www/thegruvs "/srv/vgruvs/thegruvs/releases/$release"
  printf '%s\n%s\n' "$release" "$(date -u +%FT%TZ)" >"/srv/vgruvs/thegruvs/releases/$release/.vgruvs-release"
  ln -sfn "releases/$release" /srv/vgruvs/thegruvs/current
  echo "the live site is now release $release"
fi

if [[ -e /srv/vgruvs/thegruvs/current && -r /etc/letsencrypt/live/thegruvs.com/fullchain.pem ]]; then
  # The port-80 catch-all replaces Ubuntu's default site and certbot's
  # per-domain redirects; the old thegruvs site file is switched off.
  install -m 644 "$HERE/nginx/sites/00-vgruvs-http.conf" /etc/nginx/sites-available/00-vgruvs-http.conf
  ln -sfn /etc/nginx/sites-available/00-vgruvs-http.conf /etc/nginx/sites-enabled/00-vgruvs-http.conf
  # The console, on 127.0.0.1:9900 only (reach it through an SSH tunnel).
  install -m 644 "$HERE/nginx/sites/00-vgruvs-console.conf" /etc/nginx/sites-available/00-vgruvs-console.conf
  ln -sfn /etc/nginx/sites-available/00-vgruvs-console.conf /etc/nginx/sites-enabled/00-vgruvs-console.conf
  rm -f /etc/nginx/sites-enabled/default
  for f in /etc/nginx/sites-enabled/*; do
    [[ "$f" == */00-vgruvs-http.conf || "$f" == */vgruvs-* ]] && continue
    # Whatever order its names are in (certbot sometimes writes www first).
    if grep -Eq 'server_name[^;]*[[:space:]](www\.)?thegruvs\.com([[:space:];]|$)' "$f" 2>/dev/null; then
      rm -f "$f"
      echo "switched off the hand-made site $(basename "$f")"
    fi
  done
  install -m 644 "$HERE/nginx/sites/thegruvs.conf" /etc/nginx/sites-available/vgruvs-thegruvs.conf
  ln -sfn /etc/nginx/sites-available/vgruvs-thegruvs.conf /etc/nginx/sites-enabled/vgruvs-thegruvs.conf
  if ! nginx -t; then
    restore
    die "nginx rejected the V-Gruvs config; the previous config is back"
  fi
  systemctl reload nginx
  sleep 2
  code="$(curl --noproxy '*' -sk -o /dev/null -w '%{http_code}' --resolve thegruvs.com:443:127.0.0.1 https://thegruvs.com/ || true)"
  if [[ ! "$code" =~ ^[23] ]]; then
    restore
    die "thegruvs.com answered $code after the move; the previous config is back"
  fi
  # Only V-Gruvs serves this file: proof the new config is the one answering,
  # not a hand-made site that was not recognised and still wins.
  if ! curl --noproxy '*' -sk --resolve thegruvs.com:443:127.0.0.1 https://thegruvs.com/_vgruvs/v.js | grep -q largest-contentful-paint; then
    restore
    die "thegruvs.com is still answered by the old config; the previous config is back"
  fi
  echo "thegruvs.com answers $code from V-Gruvs"
else
  echo "skipped: no /var/www/thegruvs or no certificate for thegruvs.com yet"
fi

say "Certificate renewal"
# A certificate first made by certbot's nginx plugin renews through it, and
# the plugin has to parse every nginx file. The webroot needs nothing but the
# challenge folder V-Gruvs serves on port 80. `certbot reconfigure` proves
# the switch with a dry run against Let's Encrypt's staging server, and keeps
# the old way if that fails.
for conf in /etc/letsencrypt/renewal/*.conf; do
  [[ -e "$conf" ]] || continue
  name="$(basename "$conf" .conf)"
  if ! grep -Eq '^authenticator *= *nginx' "$conf"; then
    echo "$name: renews through the $(sed -n 's/^authenticator *= *//p' "$conf" | head -1)"
  elif certbot reconfigure --cert-name "$name" --webroot -w /var/www/letsencrypt --non-interactive >/dev/null 2>&1; then
    echo "$name: renews through the webroot now (dry run passed)"
  else
    echo "$name: the webroot dry run failed; it still renews through the nginx plugin"
  fi
done

if [[ -n "${HARDEN_SSH:-}" ]]; then
  say "SSH"
  if [[ -s /root/.ssh/authorized_keys ]]; then
    printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' >/etc/ssh/sshd_config.d/90-vgruvs.conf
    if sshd -t; then
      systemctl reload ssh 2>/dev/null || systemctl reload sshd
      echo "SSH now accepts keys only"
    else
      rm -f /etc/ssh/sshd_config.d/90-vgruvs.conf
      echo "sshd rejected the change; SSH settings left as they were"
    fi
  else
    echo "skipped: root has no authorized key, so passwords stay on"
  fi
fi

say "Done"
vgruvs status || true
cat <<EOF

Next steps
  1. Add the CI deploy key:  DEPLOY_PUBKEY="ssh-ed25519 ..." bash $HERE/bootstrap.sh
     and put the private half in each repo's VGRUVS_SSH_KEY secret.
  2. For Excellency and The Resident: deploy them, point their DNS A records
     (@ and www) at this droplet, then:  vgruvs connect excellency
                                         vgruvs connect theresident
     (or the "connect a site" action of the V-Gruvs Droplet workflow)
  3. Secrets: each app's deploy workflow copies them from its repo's GitHub
     secrets, or by hand:  vgruvs env excellency set VERIFIER_SECRET -  (stdin)
  4. The console:  ssh -L 9900:127.0.0.1:9900 root@<this droplet>  then open
     http://localhost:9900   (or: vgruvs console publish ops.<your domain>)
  5. Optional: notifications in /etc/vgruvs/notify.conf, AI incident analysis
     in /etc/vgruvs/ai.env (see the README), then:  vgruvs doctor
EOF
