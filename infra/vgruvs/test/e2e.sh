#!/usr/bin/env bash
# End-to-end test of V-Gruvs on one machine: real nginx (high ports,
# self-signed certificates), the real vgruvs script and functions runtime,
# and a stand-in for systemctl that starts app slots as plain processes.
#
#   bash infra/vgruvs/test/e2e.sh [path/to/excellency/checkout] [path/to/resident/release]
#
# With an Excellency checkout that has been built (dist/ and api/ present),
# its real build is deployed as the functions app; otherwise a small fixture.
# With a Resident release folder (what its deploy workflow ships: the Next
# standalone output plus public/ and .next/static), it is deployed too.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
EXCELLENCY="${1:-}"
RESIDENT="${2:-}"
T="$(mktemp -d /tmp/vgruvs-e2e.XXXXXX)"
chmod 755 "$T" # nginx's worker runs as an unprivileged user
HTTP_PORT=18080
HTTPS_PORT=18443
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); printf '  ok   %s\n' "$*"; }
bad() { FAIL=$((FAIL + 1)); printf '  FAIL %s\n' "$*"; }
check() { local name="$1"; shift; if "$@"; then ok "$name"; else bad "$name"; fi; }

cleanup() {
  [[ -f "$T/nginx/nginx.pid" ]] && kill "$(cat "$T/nginx/nginx.pid")" 2>/dev/null || true
  for p in "$T"/pids/*.pid; do [[ -f "$p" ]] && kill "$(cat "$p")" 2>/dev/null || true; done
  rm -rf "$T"
}
trap cleanup EXIT
[[ -n "${VGRUVS_KEEP:-}" ]] && trap - EXIT

mkdir -p "$T"/{srv,etc/apps,etc/env,lib,nginx/sites-enabled,nginx/sites-available,nginx/vgruvs/upstreams,letsencrypt/live,pids,logs,bin,lock}

# --- install the kit into the sandbox, with paths and ports rewritten -------
rewrite_paths() {
  sed -e "s#/srv/vgruvs#$T/srv#g" -e "s#/etc/letsencrypt#$T/letsencrypt#g" -e "s#/etc/nginx/vgruvs#$T/nginx/vgruvs#g" \
    -e "s#/etc/vgruvs/tls#$T/tls#g" -e "s#listen 443 ssl http2 default_server;#listen $HTTPS_PORT ssl http2 default_server;#" \
    -e "s#/var/www/letsencrypt#$T/acme#g" -e "s#/var/www/downloads#$T/downloads#g" \
    -e "s#listen 443 ssl http2;#listen $HTTPS_PORT ssl http2;#" -e "s#listen 80 default_server;#listen $HTTP_PORT default_server;#" \
    -e '/listen \[::\]/d'
}
cp "$HERE/runtime/functions-server.mjs" "$T/lib/"
cp "$HERE/lib/run-app" "$T/lib/"
mkdir -p "$T/nginx/snippets" "$T/lib/nginx/sites"
for f in "$HERE"/nginx/snippets/*.conf; do rewrite_paths <"$f" >"$T/nginx/snippets/$(basename "$f")"; done
for f in "$HERE"/nginx/sites/*; do rewrite_paths <"$f" >"$T/lib/nginx/sites/$(basename "$f")"; done
rewrite_paths <"$HERE/nginx/sites/00-vgruvs-http.conf" >"$T/nginx/sites-enabled/00-vgruvs-http.conf"
cp "$HERE"/apps/*.conf "$T/etc/apps/"

mkdir -p "$T/tls"
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=invalid" \
  -keyout "$T/tls/default.key" -out "$T/tls/default.crt" >/dev/null 2>&1
for d in thegruvs.com excellencyacs.com theresidentcrew.com; do
  mkdir -p "$T/letsencrypt/live/$d"
  openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=$d" \
    -keyout "$T/letsencrypt/live/$d/privkey.pem" -out "$T/letsencrypt/live/$d/fullchain.pem" >/dev/null 2>&1
done

cat >"$T/nginx/nginx.conf" <<EOF
worker_processes 1;
pid $T/nginx/nginx.pid;
error_log $T/logs/nginx-error.log;
events { worker_connections 256; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log $T/logs/nginx-access.log;
  client_body_temp_path $T/nginx/tmp-body;
  proxy_temp_path $T/nginx/tmp-proxy;
  fastcgi_temp_path $T/nginx/tmp-fastcgi;
  uwsgi_temp_path $T/nginx/tmp-uwsgi;
  scgi_temp_path $T/nginx/tmp-scgi;
  include $T/nginx/sites-enabled/*;
}
EOF

# nginx and systemctl stand-ins that vgruvs calls.
cat >"$T/bin/nginx" <<EOF
#!/usr/bin/env bash
exec nginx -p "$T/nginx" -c "$T/nginx/nginx.conf" "\$@"
EOF
cat >"$T/bin/systemctl" <<EOF
#!/usr/bin/env bash
# restart|stop vgruvs-app@<app>-<slot>; reload nginx
action="\$1"; unit="\${2:-}"
case "\$action:\$unit" in
  reload:nginx) exec "$T/bin/nginx" -s reload ;;
  *:vgruvs-app@*)
    inst="\${unit#vgruvs-app@}"
    pidf="$T/pids/\$inst.pid"
    if [[ -f "\$pidf" ]]; then kill "\$(cat "\$pidf")" 2>/dev/null || true; rm -f "\$pidf"; sleep 0.3; fi
    if [[ "\$action" == restart ]]; then
      VGRUVS_ETC="$T/etc" VGRUVS_ROOT="$T/srv" VGRUVS_LIB="$T/lib" nohup "$T/lib/run-app" "\$inst" >>"$T/logs/\$inst.log" 2>&1 &
      echo \$! >"\$pidf"
    fi
    ;;
  *) echo "fake systemctl: ignoring \$*" >&2 ;;
esac
EOF
chmod +x "$T/bin/nginx" "$T/bin/systemctl"

export VGRUVS_ROOT="$T/srv" VGRUVS_ETC="$T/etc" VGRUVS_NGINX_DIR="$T/nginx" VGRUVS_LIB="$T/lib" \
  VGRUVS_SYSTEMCTL="$T/bin/systemctl" VGRUVS_NGINX="$T/bin/nginx" VGRUVS_HTTPS_PORT="$HTTPS_PORT" \
  VGRUVS_HEALTH_WAIT=15 VGRUVS_DRAIN=1 VGRUVS_LOCK_DIR="$T/lock" VGRUVS_USER=nobody-vgruvs-test
VG="$HERE/bin/vgruvs"

get() { curl --noproxy '*' -sk --resolve "$1:$HTTPS_PORT:127.0.0.1" "https://$1:$HTTPS_PORT$2"; }
head_of() { curl --noproxy '*' -sk -o /dev/null -D - --resolve "$1:$HTTPS_PORT:127.0.0.1" "https://$1:$HTTPS_PORT$2"; }
code_of() { curl --noproxy '*' -sk -o /dev/null -w '%{http_code}' --resolve "$1:$HTTPS_PORT:127.0.0.1" "https://$1:$HTTPS_PORT$2"; }
contains() { grep -q -- "$2" <<<"$1"; }

"$T/bin/nginx" -t -q 2>/dev/null || { cat "$T/logs/nginx-error.log"; exit 1; }
"$T/bin/nginx"

enable_site() { # what `vgruvs site` does, against the sandbox certificate paths
  local app="$1"
  if [[ "$app" != thegruvs ]]; then
    local port
    # shellcheck source=/dev/null
    port="$(. "$T/etc/apps/$app.conf"; echo "$PORT_A")"
    printf 'upstream vgruvs_%s { server 127.0.0.1:%s; keepalive 8; }\n' "$app" "$port" >"$T/nginx/vgruvs/upstreams/$app.conf"
  fi
  cp "$T/lib/nginx/sites/$app.conf" "$T/nginx/sites-enabled/vgruvs-$app.conf"
}
for app in thegruvs excellency theresident; do enable_site "$app"; done
"$T/bin/nginx" -t -q && "$T/bin/nginx" -s reload
check "all three sites pass nginx -t together" "$T/bin/nginx" -t -q
sleep 0.5
check "an unknown hostname gets no site" test "$(code_of unknown.example /)" = 000

echo "static app (The Gruvs)"
mk_static() { local d; d="$(mktemp -d "$T/build.XXXX")"; mkdir -p "$d/_expo"; echo "<!doctype html><title>gruvs $1</title>" >"$d/index.html"; echo "x" >"$d/_expo/app.js"; tar -czf - -C "$d" .; }
mk_static v1 | "$VG" receive thegruvs r1 >/dev/null
check "first deploy is live" contains "$(get thegruvs.com /)" "gruvs v1"
check "app routes fall back to index.html" contains "$(get thegruvs.com /event/42)" "gruvs v1"
check "the Content-Security-Policy is kept" contains "$(head_of thegruvs.com /)" "content-security-policy"
check "hashed bundles cache for a year" contains "$(head_of thegruvs.com /_expo/app.js)" "max-age=31536000"
mk_static v2 | "$VG" receive thegruvs r2 >/dev/null
check "second deploy replaces it" contains "$(get thegruvs.com /)" "gruvs v2"
"$VG" rollback thegruvs >/dev/null
check "rollback brings the previous release back instantly" contains "$(get thegruvs.com /)" "gruvs v1"
check "releases marks the live one" contains "$("$VG" releases thegruvs)" "* r1"
if (d="$(mktemp -d)"; echo junk >"$d/readme.txt"; tar -czf - -C "$d" .) | "$VG" receive thegruvs broken >/dev/null 2>&1; then
  bad "a release without index.html is refused"
else
  ok "a release without index.html is refused"
fi
check "and the site is untouched" contains "$(get thegruvs.com /)" "gruvs v1"
for i in 3 4 5 6 7 8; do mk_static "v$i" | "$VG" receive thegruvs "r$i" >/dev/null; done
check "old releases are pruned to KEEP_RELEASES" test "$(ls "$T/srv/thegruvs/releases" | wc -l)" -le 5
mk_static p1 | "$VG" receive thegruvs pr7-abc --preview pr-7 >/dev/null
check "a preview lands beside the live site, not on it" test -s "$T/srv/thegruvs/previews/pr-7/index.html"
check "previews are listed with their address" contains "$("$VG" previews thegruvs list)" "pr-7 -> https://pr-7.preview.thegruvs.com"
check "the live site is not the preview" contains "$(get thegruvs.com /)" "gruvs v8"

echo "functions app (Excellency)"
if [[ -n "$EXCELLENCY" && -s "$EXCELLENCY/dist/index.html" && -d "$EXCELLENCY/api" ]]; then
  echo "  (deploying the real Excellency build from $EXCELLENCY)"
  mk_excellency() { tar -czf - -C "$EXCELLENCY" dist api vercel.json; }
else
  mk_excellency() {
    local d; d="$(mktemp -d "$T/build.XXXX")"; mkdir -p "$d/dist/assets" "$d/api"
    echo '<!doctype html><html><head><title>Excellency Academy</title></head><body></body></html>' >"$d/dist/index.html"
    echo 'x' >"$d/dist/assets/app-abc.js"
    echo 'export async function GET(r){const u=new URL(r.url);return Response.json({valid:false,id:u.searchParams.get("id")})}' >"$d/api/verify-dossier.js"
    echo '{"rewrites":[{"source":"/verify/:id","destination":"/api/verify-dossier?id=:id"}]}' >"$d/vercel.json"
    tar -czf - -C "$d" .
  }
fi
mk_excellency | "$VG" receive excellency e1 >/dev/null
check "the app shell is served" contains "$(get excellencyacs.com /)" "<title>"
check "a single-page route falls back to the app" contains "$(get excellencyacs.com /eval/inv_123)" "<title>"
check "a function answers through its vercel.json rewrite" test "$(code_of excellencyacs.com /verify/EA-2026-00001)" = 200
check "functions answer JSON" contains "$(get excellencyacs.com '/api/verify-dossier?id=EA-2026-00001&format=json')" '"valid":false'
check "an unknown function is a 404" test "$(code_of excellencyacs.com /api/nope)" = 404
asset="$(ls "$T/srv/excellency/current/dist/assets" | head -1)"
check "fingerprinted assets are immutable" contains "$(head_of excellencyacs.com "/assets/$asset")" "immutable"
check "the health endpoint names the release" contains "$(get excellencyacs.com /_vgruvs/health)" '"release":"e1"'
mk_excellency | "$VG" receive excellency e2 >/dev/null
check "a second deploy switches slots blue/green" test "$(cat "$T/srv/excellency/active-slot")" = a
check "and serves the new release" contains "$(get excellencyacs.com /_vgruvs/health)" '"release":"e2"'
sleep 1.5
check "the old slot is stopped after draining" test ! -f "$T/pids/excellency-b.pid"
codes="$(for i in $(seq 1 40); do code_of excellencyacs.com /api/nope; echo; done | sort | uniq -c)"
check "the API is rate limited per address (429s after the burst)" contains "$codes" "429"

echo "node app (The Resident stand-in)"
mk_node() { # $1 = behaviour: ok | crash | public-fail
  local d; d="$(mktemp -d "$T/build.XXXX")"; mkdir -p "$d/.next/static"
  cat >"$d/server.js" <<JS
const http = require('http');
if ('$1' === 'crash') process.exit(1);
http.createServer((req, res) => {
  // 'public-fail' answers the direct slot check but fails behind nginx.
  if ('$1' === 'public-fail' && req.headers['x-forwarded-proto']) { res.statusCode = 500; return res.end('broken'); }
  res.end('resident $1 ' + (req.headers['x-forwarded-for'] || 'direct'));
}).listen(Number(process.env.PORT), process.env.HOSTNAME);
JS
  tar -czf - -C "$d" .
}
mk_node ok | "$VG" receive theresident n1 >/dev/null
check "a node release goes live" contains "$(get theresidentcrew.com /)" "resident ok"
check "the app sees the real client address, not a forged one" contains "$(curl --noproxy '*' -sk -H 'X-Forwarded-For: 6.6.6.6' --resolve "theresidentcrew.com:$HTTPS_PORT:127.0.0.1" "https://theresidentcrew.com:$HTTPS_PORT/")" "127.0.0.1"
check "Next's cache is a writable link outside the release" test -L "$T/srv/theresident/releases/n1/.next/cache"
if mk_node crash | "$VG" receive theresident n2 >/dev/null 2>&1; then bad "a release that crashes on start is refused"; else ok "a release that crashes on start is refused"; fi
check "and the old one keeps serving" contains "$(get theresidentcrew.com /)" "resident ok"
if mk_node public-fail | "$VG" receive theresident n3 >/dev/null 2>&1; then bad "a release that fails behind nginx is rolled back"; else ok "a release that fails behind nginx is rolled back"; fi
check "automatically, to the last good release" contains "$(get theresidentcrew.com /)" "resident ok"

if [[ -n "$RESIDENT" && -s "$RESIDENT/server.js" ]]; then
  echo "  (deploying the real Resident build from $RESIDENT)"
  tar -czf - -C "$RESIDENT" . | VGRUVS_HEALTH_WAIT=60 "$VG" receive theresident real1 >/dev/null
  check "the real Resident build goes live" test "$(code_of theresidentcrew.com /)" = 200
  check "and is the release nginx serves" test "$(readlink "$T/srv/theresident/current")" = releases/real1
  chunk="$(cd "$RESIDENT" && find .next/static -name '*.js' | head -1)"
  check "Next's static files come from disk, cached for a year" contains "$(head_of theresidentcrew.com "/_${chunk#.}")" "immutable"
  check "a page that regenerates (ISR) renders" test "$(code_of theresidentcrew.com /services)" = 200
fi

echo "status"
check "status reports every app healthy" bash -c "! \"$VG\" status | grep -E '^(thegruvs|excellency|theresident) ' | grep -v 'health=ok'"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
