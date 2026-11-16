#!/usr/bin/env bash
# Deploy the Gruvs web build to the DigitalOcean droplet (replaces Vercel hosting).
#
#   bash scripts/deploy-web-droplet.sh
#
# Builds the Expo web export LOCALLY (the 512MB droplet would OOM running Metro),
# then ships dist/ up via a streamed tarball.
#
# With V-Gruvs on the droplet (infra/vgruvs) the build becomes a new release:
# checked through nginx, rolled back by itself if the site stops answering,
# and undone with `ssh root@144.126.236.75 vgruvs rollback thegruvs`.
# Without it, the old staged swap into /var/www/thegruvs is used.
#
# Requires the SSH key (~/.ssh/id_ed25519) that is already authorized as root on
# the droplet, or GRUVS_DROPLET=deploy@144.126.236.75 for the deploy user.
set -euo pipefail

HOST="${GRUVS_DROPLET:-root@144.126.236.75}"
DEST="/var/www/thegruvs"
STAGE="/var/www/thegruvs_stage"   # extract here, then atomically swap
RELEASE="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short=10 HEAD 2>/dev/null || echo local)"

echo "==> Building web export locally (npm run build -> dist/)..."
npm run build

if [[ "$HOST" == deploy@* ]]; then
  VGRUVS_HOST="$HOST" bash infra/vgruvs/client/vgruvs-deploy.sh thegruvs --from dist --release "$RELEASE"
  exit 0
fi

# ATOMIC deploy: extract into a staging dir, then swap with two instant renames.
# The old approach (rm -rf DEST then tar into it) left DEST empty for the few
# seconds of extraction → nginx served 403 to anyone loading the site then.
# Renames are near-instant, so the swap window is milliseconds = ~zero downtime.
echo "==> Shipping dist/ to ${HOST} ..."
( cd dist && tar czf - . ) | ssh "$HOST" "
  if [ -x /usr/local/bin/vgruvs ]; then exec /usr/local/bin/vgruvs receive thegruvs ${RELEASE}; fi
  echo '(no V-Gruvs on the droplet: staged swap into ${DEST})'
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
