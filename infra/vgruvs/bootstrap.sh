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
# fail2ban, automatic security updates), a swap file, the `vgruvs` and
# `deploy` users, the vgruvs command and runtime, systemd units, the nginx
# snippets, and then moves The Gruvs from /var/www/thegruvs onto V-Gruvs.
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
apt-get update -q
apt-get install -y -q nginx certbot curl ufw fail2ban unattended-upgrades openssl
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if ((node_major < 20)); then
  say "Installing Node 22 (found: ${node_major})"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
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
  if ((mem_mb < 2048)); then
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
# The deploy key can ship and roll back releases, and nothing else: a leaked
# CI key is no longer root on the box.
cat >/etc/sudoers.d/vgruvs-deploy <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/local/bin/vgruvs receive *, /usr/local/bin/vgruvs rollback *, /usr/local/bin/vgruvs releases *, /usr/local/bin/vgruvs status, /usr/local/bin/vgruvs status *
EOF
chmod 440 /etc/sudoers.d/vgruvs-deploy
visudo -cf /etc/sudoers.d/vgruvs-deploy >/dev/null || { rm -f /etc/sudoers.d/vgruvs-deploy; die "sudoers rule rejected"; }

say "V-Gruvs files"
install -d -m 755 /srv/vgruvs /usr/local/lib/vgruvs /usr/local/lib/vgruvs/nginx/sites /etc/vgruvs /etc/vgruvs/apps /var/www/letsencrypt
install -d -m 750 -o root -g vgruvs /etc/vgruvs/env
install -d -m 755 -o vgruvs -g vgruvs /srv/vgruvs/cache
install -m 755 "$HERE/bin/vgruvs" /usr/local/bin/vgruvs
install -m 755 "$HERE/lib/run-app" /usr/local/lib/vgruvs/run-app
install -m 644 "$HERE/runtime/functions-server.mjs" /usr/local/lib/vgruvs/functions-server.mjs
install -m 644 "$HERE"/nginx/sites/* /usr/local/lib/vgruvs/nginx/sites/
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
install -d -m 755 /etc/nginx/vgruvs/upstreams
install -m 644 "$HERE"/systemd/vgruvs-app@.service "$HERE"/systemd/vgruvs-heal.service "$HERE"/systemd/vgruvs-heal.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now vgruvs-heal.timer >/dev/null

say "Firewall"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ufw status | sed -n '1,6p'

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
  rm -f /etc/nginx/sites-enabled/default
  for f in /etc/nginx/sites-enabled/*; do
    [[ "$f" == */00-vgruvs-http.conf || "$f" == */vgruvs-* ]] && continue
    if grep -q 'server_name thegruvs.com' "$f" 2>/dev/null; then
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
  echo "thegruvs.com answers $code from V-Gruvs"
else
  echo "skipped: no /var/www/thegruvs or no certificate for thegruvs.com yet"
fi

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
  2. For Excellency and The Resident, point their DNS A records at this
     droplet, then:  vgruvs certs excellency && vgruvs site excellency
                     vgruvs certs theresident && vgruvs site theresident
  3. Secrets:  vgruvs env excellency set VERIFIER_SECRET '...'
EOF
