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
STAGE="/var/www/thegruvs_stage"   # extract here, then atomically swap

echo "==> Building web export locally (npm run build -> dist/)..."
npm run build

# ATOMIC deploy: extract into a staging dir, then swap with two instant renames.
# The old approach (rm -rf DEST then tar into it) left DEST empty for the few
# seconds of extraction → nginx served 403 to anyone loading the site then.
# Renames are near-instant, so the swap window is milliseconds = ~zero downtime.
echo "==> Shipping dist/ to ${HOST} (staged + atomic swap) ..."
( cd dist && tar czf - . ) | ssh "$HOST" "
  set -e
  rm -rf ${STAGE} && mkdir -p ${STAGE} &&
  tar xzf - -C ${STAGE} &&
  chown -R www-data:www-data ${STAGE} &&
  rm -rf ${DEST}_old &&
  if [ -d ${DEST} ]; then mv ${DEST} ${DEST}_old; fi &&
  mv ${STAGE} ${DEST} &&
  nginx -t && systemctl reload nginx
"

echo "==> Done. Live at https://thegruvs.com"
