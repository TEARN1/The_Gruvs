#!/usr/bin/env bash
# Deploy the Gruvs web build to the DigitalOcean droplet (replaces Vercel hosting).
#
#   bash scripts/deploy-web-droplet.sh
#
# Builds the Expo web export LOCALLY (the 512MB droplet would OOM running Metro),
# then ships dist/ up via a streamed tarball and reloads nginx. Requires the SSH
# key (~/.ssh/id_ed25519) that is already authorized as root on the droplet.
set -euo pipefail

HOST="${GRUVS_DROPLET:-root@144.126.236.75}"
DEST="/var/www/thegruvs"

echo "==> Building web export locally (npm run build -> dist/)..."
npm run build

echo "==> Shipping dist/ to ${HOST}:${DEST} ..."
( cd dist && tar czf - . ) | ssh "$HOST" \
  "rm -rf ${DEST} && mkdir -p ${DEST} && tar xzf - -C ${DEST} && chown -R www-data:www-data ${DEST}"

echo "==> Reloading nginx..."
ssh "$HOST" "nginx -t && systemctl reload nginx"

echo "==> Done. Live at http://144.126.236.75"
