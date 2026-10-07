#!/usr/bin/env bash
# End-to-end test of V-Gruvs on one machine: real nginx (high ports,
# self-signed certificates), the real vgruvs command, functions runtime and
# Node modules, and a stand-in for systemctl that starts app slots as plain
# processes. Covers deploys, rollbacks, skew protection, precompression, the
# edge cache, rollouts, the autopilot, crons, the shield, maintenance mode,
# previews, insights, the console, the doctor and adding an app.
#
#   bash infra/vgruvs/test/e2e.sh [path/to/excellency/checkout] [path/to/resident/release]
#
# With an Excellency checkout that has been built (dist/ and api/ present),
# its real build is deployed as the functions app; otherwise a small fixture.
# With a Resident release folder (what its deploy workflow ships: the Next
# standalone output plus public/ and .next/static), it is deployed too.
set -euo pipefail
# With pipefail, `cmd | head -1` can die of SIGPIPE when head exits first:
# take the first item with -quit or `sed -n 1p` (which reads to the end).

HERE="$(cd "$(dirname "$0")/.." && pwd)"
EXCELLENCY="${1:-}"
RESIDENT="${2:-}"
T="$(mktemp -d /tmp/vgruvs-e2e.XXXXXX)"
chmod 755 "$T" # nginx's workers run as www-data
HTTP_PORT=18080
HTTPS_PORT=18443
CONSOLE_PORT=19900
HOOK_PORT=19999
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); printf '  ok   %s\n' "$*"; }
bad() { FAIL=$((FAIL + 1)); printf '  FAIL %s\n' "$*"; }
check() { local name="$1"; shift; if "$@"; then ok "$name"; else bad "$name"; fi; }
# Polls a condition for up to $1 seconds.
eventually() { local limit="$1" i; shift; for ((i = 0; i < limit * 2; i++)); do if "$@"; then return 0; fi; sleep 0.5; done; "$@"; }

cleanup() {
  if [[ -f "$T/nginx/nginx.pid" ]]; then kill "$(cat "$T/nginx/nginx.pid")" 2>/dev/null || true; fi
  for p in "$T"/pids/*.pid; do if [[ -f "$p" ]]; then kill "$(cat "$p")" 2>/dev/null || true; fi; done
  pkill -f "vgruvs autopilot-watch|vgruvs rollout-drive|$T/bin/vgruvs" 2>/dev/null || true
  rm -rf "$T"
}
trap cleanup EXIT
if [[ -n "${VGRUVS_KEEP:-}" ]]; then trap - EXIT; echo "keeping $T"; fi

mkdir -p "$T"/{srv,etc/apps,etc/env,lib/runtime,lib/pages,lib/nginx/sites,lib/nginx/templates,nginx/sites-enabled,nginx/sites-available,nginx/snippets} \
  "$T"/{nginx/vgruvs/upstreams,letsencrypt/live,tls,logs/vgruvs,cache,state,pids,bin,lock}

# --- install the kit into the sandbox, with paths and ports rewritten -------
rewrite_paths() {
  sed -e "s#/srv/vgruvs#$T/srv#g" -e "s#/etc/letsencrypt#$T/letsencrypt#g" -e "s#/etc/nginx/vgruvs#$T/nginx/vgruvs#g" \
    -e "s#/etc/vgruvs/tls#$T/tls#g" -e "s#/usr/local/lib/vgruvs#$T/lib#g" -e "s#/var/log/nginx/vgruvs#$T/logs/vgruvs#g" \
    -e "s#/var/cache/nginx/vgruvs#$T/cache#g" -e "s#/var/www/letsencrypt#$T/acme#g" -e "s#/var/www/downloads#$T/downloads#g" \
    -e "s#listen 443 ssl http2;#listen $HTTPS_PORT ssl http2;#" -e "s#listen 443 ssl http2 default_server;#listen $HTTPS_PORT ssl http2 default_server;#" \
    -e "s#listen 80 default_server;#listen $HTTP_PORT default_server;#" -e "s#listen 127.0.0.1:9900;#listen 127.0.0.1:$CONSOLE_PORT;#" \
    -e '/listen \[::\]/d'
}
cp "$HERE/runtime/functions-server.mjs" "$HERE/lib/run-app" "$T/lib/"
cp "$HERE/runtime/vitals.js" "$T/lib/runtime/"
for mod in insights cron notify console ai; do cp "$HERE/lib/$mod.mjs" "$T/lib/"; done
cp "$HERE"/pages/*.html "$T/lib/pages/"
for f in "$HERE"/nginx/snippets/*.conf; do rewrite_paths <"$f" >"$T/nginx/snippets/$(basename "$f")"; done
for f in "$HERE"/nginx/sites/*; do rewrite_paths <"$f" >"$T/lib/nginx/sites/$(basename "$f")"; done
for f in "$HERE"/nginx/templates/*; do rewrite_paths <"$f" >"$T/lib/nginx/templates/$(basename "$f")"; done
cp "$HERE"/apps/*.conf "$T/etc/apps/"
# The autopilot is switched on per test below; elsewhere it would keep
# watching (and judging) traffic the tests create on purpose.
for f in "$T"/etc/apps/*.conf; do echo 'AUTOPILOT=off' >>"$f"; done

cert() { # <name> <CN/SAN>
  mkdir -p "$T/letsencrypt/live/$1"
  openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=$2" -addext "subjectAltName=DNS:$2" \
    -keyout "$T/letsencrypt/live/$1/privkey.pem" -out "$T/letsencrypt/live/$1/fullchain.pem" >/dev/null 2>&1
}
for d in thegruvs.com excellencyacs.com theresidentcrew.com demo.test; do cert "$d" "$d"; done
cert preview.thegruvs.com '*.preview.thegruvs.com'
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=invalid" -keyout "$T/tls/default.key" -out "$T/tls/default.crt" >/dev/null 2>&1

# Brotli, when this machine's nginx has the module (as bootstrap installs it).
MODULES=''
if compgen -G '/etc/nginx/modules-enabled/*brotli*' >/dev/null && command -v brotli >/dev/null; then
  MODULES="$(cat /etc/nginx/modules-enabled/*brotli*.conf | sed 's#load_module modules/#load_module /usr/lib/nginx/modules/#')"
  printf 'brotli_static on;\nbrotli on;\nbrotli_types text/plain text/css application/javascript text/javascript application/json image/svg+xml;\n' >"$T/nginx/snippets/vgruvs-brotli.conf"
fi

cat >"$T/nginx/nginx.conf" <<EOF
$MODULES
user www-data;
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
# start|restart|stop vgruvs-app@<app>-<slot>; reload nginx; is-active says "no".
action="\$1"; unit="\${2:-}"
case "\$action:\$unit" in
  reload:nginx)
    # Wait for the old workers to finish, so the next request sees the new config.
    master="\$(cat "$T/nginx/nginx.pid")"
    old="\$(pgrep -P "\$master" | tr '\n' ' ')"
    "$T/bin/nginx" -s reload
    for _ in \$(seq 1 50); do
      alive=''
      for p in \$old; do kill -0 "\$p" 2>/dev/null && alive=1; done
      [[ -z "\$alive" ]] && break
      sleep 0.1
    done
    ;;
  is-active:*) exit 3 ;;
  *:vgruvs-app@*)
    inst="\${unit#vgruvs-app@}"
    pidf="$T/pids/\$inst.pid"
    if [[ -f "\$pidf" ]]; then kill "\$(cat "\$pidf")" 2>/dev/null || true; rm -f "\$pidf"; sleep 0.3; fi
    if [[ "\$action" == restart || "\$action" == start ]]; then
      VGRUVS_ETC="$T/etc" VGRUVS_ROOT="$T/srv" VGRUVS_LIB="$T/lib" nohup "$T/lib/run-app" "\$inst" >>"$T/logs/\$inst.log" 2>&1 &
      echo \$! >"\$pidf"
    fi
    ;;
  reboot:) touch "$T/rebooted" ;;
  *) echo "fake systemctl: ignoring \$*" >&2 ;;
esac
EOF
chmod +x "$T/bin/nginx" "$T/bin/systemctl"
cp "$HERE/bin/vgruvs" "$T/bin/vgruvs"

export VGRUVS_ROOT="$T/srv" VGRUVS_ETC="$T/etc" VGRUVS_NGINX_DIR="$T/nginx" VGRUVS_LIB="$T/lib" VGRUVS_STATE="$T/state" \
  VGRUVS_LOG_DIR="$T/logs/vgruvs" VGRUVS_CACHE_DIR="$T/cache" VGRUVS_CERT_DIR="$T/letsencrypt/live" \
  VGRUVS_SYSTEMCTL="$T/bin/systemctl" VGRUVS_NGINX="$T/bin/nginx" VGRUVS_HTTPS_PORT="$HTTPS_PORT" \
  VGRUVS_HEALTH_WAIT=15 VGRUVS_DRAIN=1 VGRUVS_LOCK_DIR="$T/lock" VGRUVS_USER=nobody-vgruvs-test \
  VGRUVS_NO_SYSTEMD_RUN=1 VGRUVS_NO_CONSOLE=1 VGRUVS_AUTOPILOT_INTERVAL=1
VG="$T/bin/vgruvs"

UA_BROWSER='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
req() { curl --noproxy '*' -sk --resolve "$1:$HTTPS_PORT:127.0.0.1" "${@:3}" "https://$1:$HTTPS_PORT$2"; }
get() { req "$@"; }
head_of() { req "$1" "$2" -o /dev/null -D - "${@:3}"; }
code_of() { req "$1" "$2" -o /dev/null -w '%{http_code}' "${@:3}"; }
contains() { grep -q -- "$2" <<<"$1"; }
last_log() { grep -F "\"u\":\"$2\"" "$T/logs/vgruvs/$1.log" | tail -1; }
conf_set() { echo "$2" >>"$T/etc/apps/$1.conf"; }

# --- the platform -------------------------------------------------------------
echo "platform"
"$VG" sync --no-reload >/dev/null
for s in 00-vgruvs-http.conf 00-vgruvs-console.conf; do cp "$T/lib/nginx/sites/$s" "$T/nginx/sites-enabled/$s"; done
"$T/bin/nginx" -t -q 2>/dev/null || { cat "$T/logs/nginx-error.log"; exit 1; }
"$T/bin/nginx"
for app in thegruvs excellency theresident; do "$VG" site "$app" >/dev/null; done
check "all three sites pass nginx -t together" "$T/bin/nginx" -t -q
sleep 0.5
check "an unknown hostname gets no site" test "$(code_of unknown.example /)" = 000
check "vgruvs knows its version" contains "$("$VG" version)" "V-Gruvs 2"

# A listener standing in for Discord/Slack/ntfy.
node -e 'require("http").createServer((q,s)=>{let b="";q.on("data",c=>b+=c);q.on("end",()=>{require("fs").appendFileSync(process.argv[1],b+"\n");s.end("ok")})}).listen(Number(process.argv[2]),"127.0.0.1")' \
  "$T/notified.log" "$HOOK_PORT" &
echo $! >"$T/pids/hook.pid"
printf 'NOTIFY_URL=http://127.0.0.1:%s/hook\n' "$HOOK_PORT" >"$T/etc/notify.conf"

# --- static app ---------------------------------------------------------------
echo "static app (The Gruvs)"
mk_static() { # <name>: an Expo-like export with a fingerprinted bundle
  local d
  d="$(mktemp -d "$T/build.XXXX")"
  mkdir -p "$d/_expo/static/js/web" "$d/assets"
  echo "<!doctype html><html><head><title>gruvs $1</title></head><body></body></html>" >"$d/index.html"
  for _ in $(seq 1 80); do echo "console.log('gruvs bundle $1');"; done >"$d/_expo/static/js/web/entry-$1.js"
  echo "font $1" >"$d/assets/font-$1.ttf"
  tar -czf - -C "$d" .
}
mk_static v1 | "$VG" receive thegruvs r1 >/dev/null
check "first deploy is live" contains "$(get thegruvs.com /)" "gruvs v1"
check "app routes fall back to index.html" contains "$(get thegruvs.com /event/42)" "gruvs v1"
check "the Content-Security-Policy is kept" contains "$(head_of thegruvs.com /)" "content-security-policy"
check "hashed bundles cache for a year" contains "$(head_of thegruvs.com /_expo/static/js/web/entry-v1.js)" "max-age=31536000"
check "bundles are compressed once, at deploy time" test -s "$T/srv/thegruvs/releases/r1/_expo/static/js/web/entry-v1.js.gz"
check "and sent precompressed" contains "$(head_of thegruvs.com /_expo/static/js/web/entry-v1.js -H 'Accept-Encoding: gzip')" "content-encoding: gzip"
if [[ -n "$MODULES" ]]; then
  check "brotli too, where nginx has it" contains "$(head_of thegruvs.com /_expo/static/js/web/entry-v1.js -H 'Accept-Encoding: br')" "content-encoding: br"
fi
check "every page gets the Web Vitals script" contains "$(get thegruvs.com /)" '<script defer src="/_vgruvs/v.js"></script></head>'
check "the Web Vitals script is served" contains "$(get thegruvs.com /_vgruvs/v.js)" "largest-contentful-paint"
check "requests are logged as JSON, per app" contains "$(last_log thegruvs /)" '"s":200'
mk_static v2 | "$VG" receive thegruvs r2 >/dev/null
check "second deploy replaces it" contains "$(get thegruvs.com /)" "gruvs v2"
check "skew protection: the last release's bundle still loads" contains "$(get thegruvs.com /_expo/static/js/web/entry-v1.js)" "gruvs bundle v1"
check "and so do its assets" contains "$(get thegruvs.com /assets/font-v1.ttf)" "font v1"
check "a file no release had is still a 404" test "$(code_of thegruvs.com /_expo/static/js/web/entry-nope.js)" = 404
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
check "old releases are pruned to KEEP_RELEASES" test "$(find "$T/srv/thegruvs/releases" -mindepth 1 -maxdepth 1 | wc -l)" -le 5
check "release r2 is gone, its bundle is kept for SKEW_MAX_AGE_DAYS" test ! -d "$T/srv/thegruvs/releases/r2" -a "$(code_of thegruvs.com /_expo/static/js/web/entry-v2.js)" = 200
touch -d '10 days ago' "$T/srv/thegruvs/vault-index/r2.list"
mk_static v9 | "$VG" receive thegruvs r9 >/dev/null
check "and dropped once older than that" test "$(code_of thegruvs.com /_expo/static/js/web/entry-v2.js)" = 404

echo "  previews"
mk_static p1 | "$VG" receive thegruvs pr7-abc --preview pr-7 >/dev/null
check "a preview lands beside the live site, not on it" test -s "$T/srv/thegruvs/previews/pr-7/index.html"
check "previews are listed with their address" contains "$("$VG" previews thegruvs list)" "pr-7 -> https://pr-7.preview.thegruvs.com"
check "the live site is not the preview" contains "$(get thegruvs.com /)" "gruvs v9"
"$VG" previews thegruvs enable >/dev/null
check "the preview has its own address" contains "$(get pr-7.preview.thegruvs.com /)" "gruvs p1"
echo 'preview-pass-123' | "$VG" previews thegruvs protect reviewer >/dev/null
check "a protected preview asks for a password" test "$(code_of pr-7.preview.thegruvs.com /)" = 401
check "and opens with it" contains "$(get pr-7.preview.thegruvs.com / -u reviewer:preview-pass-123)" "gruvs p1"
"$VG" previews thegruvs unprotect >/dev/null
check "unprotecting opens it again" test "$(code_of pr-7.preview.thegruvs.com /)" = 200

echo "  shield"
check "scanner paths get the connection closed" test "$(code_of thegruvs.com /wp-login.php)" = 000 -a "$(code_of thegruvs.com /.env)" = 000
check "and are logged as 444 for fail2ban" grep -Eq '^\{"t":"[^"]*","ip":"127\.0\.0\.1",.*"s":444,' "$T/logs/vgruvs/thegruvs.log"
"$VG" shield block 127.0.0.1 tests >/dev/null
check "a blocked address is refused on every app" test "$(code_of thegruvs.com /)" = 403 -a "$(code_of theresidentcrew.com /)" = 403
"$VG" shield unblock 127.0.0.1 >/dev/null
check "and welcome again once unblocked" test "$(code_of thegruvs.com /)" = 200
"$VG" shield attack on >/dev/null
codes="$(for _ in $(seq 1 90); do code_of thegruvs.com /; echo; done | sort | uniq -c)"
check "attack mode limits every address" contains "$codes" "429"
"$VG" shield attack off >/dev/null
codes="$(for _ in $(seq 1 60); do code_of thegruvs.com /; echo; done | sort | uniq -c)"
check "and lets go when switched off" bash -c "! grep -q 429 <<<'$codes'"

echo "  maintenance"
"$VG" maintenance thegruvs on "Back at 10:00 <with care>" >/dev/null
check "maintenance mode shows its page with a 503" test "$(code_of thegruvs.com /)" = 503
check "with the message, escaped" contains "$(get thegruvs.com /)" "Back at 10:00 &lt;with care&gt;"
check "the bypass token shows the real site" contains "$(get thegruvs.com / -H "X-VGruvs-Bypass: $(cat "$T/etc/maintenance.token")")" "gruvs v9"
mk_static v10 | "$VG" receive thegruvs r10 >/dev/null
check "deploys still work during maintenance" contains "$(get thegruvs.com / -b "vgruvs_bypass=$(cat "$T/etc/maintenance.token")")" "gruvs v10"
"$VG" maintenance thegruvs off >/dev/null
check "and the site opens again" contains "$(get thegruvs.com /)" "gruvs v10"

echo "  insights"
for _ in 1 2 3; do req thegruvs.com / -A "$UA_BROWSER" -e 'https://news.example/' >/dev/null; done
req thegruvs.com '/_vgruvs/vitals?p=%2F&d=m&LCP=1800&CLS=0.0200&INP=120&FCP=900&TTFB=150' -X POST -o /dev/null
check "a Web Vitals beacon is accepted" test "$(code_of thegruvs.com '/_vgruvs/vitals?p=%2F&d=d&LCP=2100&CLS=0.0100&INP=90' -X POST)" = 204
check "vgruvs vitals reports p75 per metric" contains "$("$VG" vitals thegruvs)" "LCP   p75"
check "vgruvs insights counts traffic and refused scans" node -e '
  const s = JSON.parse(require("child_process").execFileSync(process.argv[1], ["insights", "thegruvs", "--json"], { encoding: "utf8" }));
  process.exit(s.requests > 50 && s.shield.refused >= 2 && s.statuses["2xx"] > 0 ? 0 : 1)' "$VG"
check "vgruvs analytics counts visitors without cookies" bash -c "'$VG' analytics thegruvs | grep -q '1 visitors' && '$VG' analytics thegruvs | grep -q 'news.example'"

# --- functions app ------------------------------------------------------------
echo "functions app (Excellency)"
if [[ -n "$EXCELLENCY" && -s "$EXCELLENCY/dist/index.html" && -d "$EXCELLENCY/api" ]]; then
  echo "  (deploying the real Excellency build from $EXCELLENCY)"
  mk_excellency() { tar -czf - -C "$EXCELLENCY" dist api vercel.json; }
else
  mk_excellency() {
    local d
    d="$(mktemp -d "$T/build.XXXX")"
    mkdir -p "$d/dist/assets" "$d/api"
    echo '<!doctype html><html><head><title>Excellency Academy</title></head><body></body></html>' >"$d/dist/index.html"
    echo 'x' >"$d/dist/assets/app-abc.js"
    echo 'export async function GET(r){const u=new URL(r.url);return Response.json({valid:false,id:u.searchParams.get("id")},{headers:{"cache-control":"public, max-age=300"}})}' >"$d/api/verify-dossier.js"
    echo '{"rewrites":[{"source":"/verify/:id","destination":"/api/verify-dossier?id=:id"}]}' >"$d/vercel.json"
    tar -czf - -C "$d" .
  }
fi
mk_excellency | "$VG" receive excellency e1 >/dev/null
check "the app shell is served (by the app, for rollouts)" contains "$(get excellencyacs.com /)" "<title>"
check "with the Web Vitals script added to it" contains "$(get excellencyacs.com /)" "/_vgruvs/v.js"
check "a single-page route falls back to the app" contains "$(get excellencyacs.com /eval/inv_123)" "<title>"
check "a function answers through its vercel.json rewrite" test "$(code_of excellencyacs.com /verify/EA-2026-00001)" = 200
code_of excellencyacs.com /verify/EA-2026-00001 >/dev/null
check "a public function response is served from the edge cache" contains "$(last_log excellency /verify/EA-2026-00001)" '"c":"HIT"'
check "functions answer JSON" contains "$(get excellencyacs.com '/api/verify-dossier?id=EA-2026-00001&format=json')" '"valid":false'
check "an unknown function is a 404" test "$(code_of excellencyacs.com /api/nope)" = 404
asset="$(find "$T/srv/excellency/current/dist/assets" -maxdepth 1 -type f ! -name '*.gz' ! -name '*.br' -printf '%f\n' -quit)"
check "fingerprinted assets are immutable" contains "$(head_of excellencyacs.com "/assets/$asset")" "immutable"
check "the health endpoint names the release" contains "$(get excellencyacs.com /_vgruvs/health)" '"release":"e1"'
mk_excellency | "$VG" receive excellency e2 >/dev/null
check "a second deploy switches slots blue/green" test "$(cat "$T/srv/excellency/active-slot")" = a
check "and serves the new release" contains "$(get excellencyacs.com /_vgruvs/health)" '"release":"e2"'
code_of excellencyacs.com /verify/EA-2026-00001 >/dev/null
check "a new release starts a new edge-cache generation" contains "$(last_log excellency /verify/EA-2026-00001)" '"c":"MISS"'
sleep 1.5
check "the old slot is stopped after draining" test ! -f "$T/pids/excellency-b.pid"
codes="$(for _ in $(seq 1 40); do code_of excellencyacs.com /api/nope; echo; done | sort | uniq -c)"
check "the API is rate limited per address (429s after the burst)" contains "$codes" "429"

# --- node app -----------------------------------------------------------------
echo "node app (The Resident stand-in)"
mk_node() { # <mode: ok|crash|public-fail|late-fail|canary-fail> [<name>]
  local d mode="$1" name="${2:-$1}"
  d="$(mktemp -d "$T/build.XXXX")"
  mkdir -p "$d/.next/static/chunks" "$d/.next/static/build"
  for _ in $(seq 1 60); do echo "console.log('chunk $name');"; done >"$d/.next/static/chunks/app-$name.js"
  echo "manifest $name" >"$d/.next/static/build/_buildManifest.js"
  cat >"$d/server.js" <<JS
const http = require('http');
const fs = require('fs');
const MODE = '$mode', NAME = '$name';
if (MODE === 'crash') process.exit(1);
let hits = 0;
http.createServer((req, res) => {
  const path = req.url.split('?')[0];
  const viaNginx = Boolean(req.headers['x-forwarded-proto']);
  // 'public-fail' answers the direct slot check but fails behind nginx.
  if (MODE === 'public-fail' && viaNginx) { res.statusCode = 500; return res.end('broken'); }
  // 'late-fail' and 'canary-fail' pass every check, then fail real work.
  if ((MODE === 'late-fail' || MODE === 'canary-fail') && path === '/work') { res.statusCode = 500; return res.end('work failed'); }
  if (path === '/cached') { hits++; res.setHeader('Cache-Control', 'public, s-maxage=2'); return res.end(NAME + ' cached ' + hits); }
  if (path === '/page') { res.setHeader('Content-Type', 'text/html'); return res.end('<html><head><title>' + NAME + '</title></head><body>page</body></html>'); }
  if (path === '/api/tick') {
    if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET || req.headers['user-agent'] !== 'vercel-cron/1.0') { res.statusCode = 401; return res.end('no'); }
    fs.appendFileSync(process.env.MARK, 'tick ' + NAME + '\n');
    return res.end('ok');
  }
  res.end('resident ' + NAME + ' ' + (req.headers['x-forwarded-for'] || 'direct'));
}).listen(Number(process.env.PORT), process.env.HOSTNAME);
JS
  tar -czf - -C "$d" .
}
mk_node ok | "$VG" receive theresident n1 >/dev/null
check "a node release goes live" contains "$(get theresidentcrew.com /)" "resident ok"
check "the app sees the real client address, not a forged one" contains "$(get theresidentcrew.com / -H 'X-Forwarded-For: 6.6.6.6')" "127.0.0.1"
check "Next's cache is a writable link outside the release" test -L "$T/srv/theresident/releases/n1/.next/cache"
check "proxied HTML gets the Web Vitals script" contains "$(get theresidentcrew.com /page)" '<script defer src="/_vgruvs/v.js"></script></head>'
check "edge cache: a page the app marks public is kept" test "$(get theresidentcrew.com /cached)" = "$(get theresidentcrew.com /cached)"
check "but never for a visitor with a login cookie" test "$(get theresidentcrew.com /cached -b 'sb-access-token=x')" != "$(get theresidentcrew.com /cached -b 'sb-access-token=x')"
mk_node ok two | "$VG" receive theresident n2 >/dev/null
check "a new release is live" contains "$(get theresidentcrew.com /)" "resident two"
check "and not served stale from the cache" contains "$(get theresidentcrew.com /cached)" "two cached"
check "skew protection: the last release's chunk still loads" contains "$(get theresidentcrew.com /_next/static/chunks/app-ok.js)" "chunk ok"
check "a page naming its release (?dpl=) gets that release's files" contains "$(get theresidentcrew.com '/_next/static/build/_buildManifest.js?dpl=n1')" "manifest ok"
check "and the live release's without it" contains "$(get theresidentcrew.com /_next/static/build/_buildManifest.js)" "manifest two"
check "a ?dpl= that is not a release name is ignored" contains "$(get theresidentcrew.com '/_next/static/build/_buildManifest.js?dpl=../../etc')" "manifest two"
if mk_node crash | "$VG" receive theresident n3 >/dev/null 2>&1; then bad "a release that crashes on start is refused"; else ok "a release that crashes on start is refused"; fi
check "and the old one keeps serving" contains "$(get theresidentcrew.com /)" "resident two"
if mk_node public-fail | "$VG" receive theresident n4 >/dev/null 2>&1; then bad "a release that fails behind nginx is rolled back"; else ok "a release that fails behind nginx is rolled back"; fi
check "automatically, to the last good release" contains "$(get theresidentcrew.com /)" "resident two"

echo "  always online"
get theresidentcrew.com /cached >/dev/null
sleep 2.5 # past s-maxage
kill "$(cat "$T/pids/theresident-$(cat "$T/srv/theresident/active-slot").pid")"
sleep 0.5
check "with the app down, a cached page is still served" contains "$(get theresidentcrew.com /cached)" "two cached"
check "and anything else gets the friendly offline page" contains "$(get theresidentcrew.com /not-cached)" "be right back"
"$VG" heal >/dev/null 2>&1 || true
check "the heal timer brings the app back" eventually 10 bash -c "curl --noproxy '*' -sk --resolve theresidentcrew.com:$HTTPS_PORT:127.0.0.1 https://theresidentcrew.com:$HTTPS_PORT/ | grep -q 'resident two'"

echo "  crons"
printf 'CRON_SECRET=s3cret-%s\nMARK=%s\n' "$RANDOM" "$T/cron.mark" >"$T/etc/env/theresident.env"
conf_set theresident 'CRONS="* * * * * /api/tick"'
"$VG" restart theresident >/dev/null
check "crons are listed with their next run" contains "$("$VG" cron theresident list)" "/api/tick"
"$VG" cron-tick
check "a due cron runs with CRON_SECRET, as on Vercel" eventually 10 grep -qs "tick two" "$T/cron.mark"

echo "  rollouts"
conf_set theresident 'ROLLOUT="50"'
conf_set theresident 'ROLLOUT_STEP_SECONDS=6'
conf_set theresident 'AUTOPILOT_MIN_REQUESTS=10'
mk_node ok three | "$VG" receive theresident n5 >/dev/null
check "a rolling release starts with a share of visitors" grep -q 'weight=50' "$T/nginx/vgruvs/upstreams/theresident.conf"
check "vgruvs rollout shows it" contains "$("$VG" rollout theresident)" "serves 50% of visitors"
seen="$(for i in $(seq 1 40); do get theresidentcrew.com / -A "visitor-$i"; echo; done | sort | uniq -c)"
check "visitors are split between the two releases" bash -c "grep -q 'resident two' <<<'$seen' && grep -q 'resident three' <<<'$seen'"
check "each visitor stays on one release" test "$(for _ in 1 2 3 4 5; do get theresidentcrew.com / -A visitor-7; echo; done | sort -u | wc -l)" = 1
check "a healthy rollout reaches everyone by itself" eventually 25 bash -c "[[ ! -f '$T/srv/theresident/rollout' && \$(readlink '$T/srv/theresident/current') == releases/n5 ]]"
everyone="$(for i in $(seq 1 10); do get theresidentcrew.com / -A "visitor-$i"; echo; done)"
check "and everyone is on it" bash -c "grep -q 'resident three' <<<'$everyone' && ! grep -q 'resident two' <<<'$everyone'"
mk_node canary-fail four | "$VG" receive theresident n6 >/dev/null
for i in $(seq 1 60); do code_of theresidentcrew.com /work -A "visitor-$i" >/dev/null; done
check "a failing canary is withdrawn automatically" eventually 30 grep -q '"type":"rollout_abort"' "$T/state/events.jsonl"
check "back to the good release for everyone" bash -c "[[ ! -f '$T/srv/theresident/rollout' && \$(readlink '$T/srv/theresident/current') == releases/n5 ]]"
check "everyone stays on the good release" contains "$(get theresidentcrew.com / -A visitor-1)" "resident three"
check "the failed release is removed" test ! -d "$T/srv/theresident/releases/n6"
check "and an incident report says where it failed" bash -c "grep -l '/work' '$T'/state/incidents/*-theresident.md >/dev/null"

echo "  autopilot"
conf_set theresident 'ROLLOUT=""'
conf_set theresident 'AUTOPILOT=on'
conf_set theresident 'AUTOPILOT_WINDOW_SECONDS=40'
mk_node late-fail five | "$VG" receive theresident n7 >/dev/null
check "a release that passes its checks goes live" contains "$(get theresidentcrew.com /)" "resident five"
for i in $(seq 1 30); do code_of theresidentcrew.com /work -A "visitor-$i" >/dev/null; done
check "the autopilot rolls it back when real traffic fails" eventually 40 grep -q '"type":"auto_rollback"' "$T/state/events.jsonl"
check "to the last good release" bash -c "[[ \$(readlink '$T/srv/theresident/current') == releases/n5 ]]"
check "the site is back on it" contains "$(get theresidentcrew.com /)" "resident three"
check "vgruvs events shows what happened" bash -c "'$VG' events theresident | grep -q 'autopilot rolled n7 back'"
check "and the owner is notified" eventually 10 grep -q '"type":"auto_rollback"' "$T/notified.log"
conf_set theresident 'AUTOPILOT=off'

if [[ -n "$RESIDENT" && -s "$RESIDENT/server.js" ]]; then
  echo "  (deploying the real Resident build from $RESIDENT)"
  conf_set theresident 'CRONS=""'
  # Deployed under its NEXT_DEPLOYMENT_ID when it was built with one, as CI does.
  real="${RESIDENT_RELEASE:-real1}"
  tar -czf - -C "$RESIDENT" . | VGRUVS_HEALTH_WAIT=60 "$VG" receive theresident "$real" >/dev/null
  check "the real Resident build goes live" test "$(code_of theresidentcrew.com /)" = 200
  check "and is the release nginx serves" test "$(readlink "$T/srv/theresident/current")" = "releases/$real"
  asset="$(get theresidentcrew.com /faq | grep -o '/_next/static/[^"]*' | sed -n 1p)"
  check "the assets a real page asks for load (with ?dpl= when it has one)" test -n "$asset" -a "$(code_of theresidentcrew.com "$asset")" = 200
  chunk="$(cd "$RESIDENT" && find .next/static -name '*.js' -print -quit)"
  check "Next's static files come from disk, cached for a year" contains "$(head_of theresidentcrew.com "/_${chunk#.}")" "immutable"
  check "a page that regenerates (ISR) renders" test "$(code_of theresidentcrew.com /services)" = 200
  check "with the Web Vitals script" contains "$(get theresidentcrew.com /services)" "/_vgruvs/v.js"
fi

# --- the rest of the platform --------------------------------------------------
echo "platform commands"
check "events record deploys, rollbacks and rollouts" bash -c "'$VG' events -n 200 | grep -q rollout_done && '$VG' events -n 200 | grep -q 'rolled back'"
check "notifications reach the webhook" grep -q '"type":"deploy"' "$T/notified.log"
"$VG" console build >/dev/null
check "the console is built" grep -q "V-Gruvs Console" "$T/srv/_console/index.html"
check "with every app on it" bash -c "grep -q theresident '$T/srv/_console/index.html' && grep -q excellency '$T/srv/_console/index.html' && grep -q thegruvs '$T/srv/_console/index.html'"
check "and served on localhost only" contains "$(curl --noproxy '*' -s "http://127.0.0.1:$CONSOLE_PORT/")" "V-Gruvs Console"
doctor="$("$VG" doctor 2>&1)"
check "the doctor checks nginx and every app" bash -c "grep -q '✓ nginx' <<<'$doctor' && grep -q '✓ excellency ' <<<'$doctor'"
"$VG" apps add demo --type static --domain demo.test >/dev/null
check "a new app can be added from a template" test -s "$T/etc/apps/demo.conf" -a -s "$T/etc/sites/demo.conf"
"$VG" site demo >/dev/null
mk_static demo | "$VG" receive demo d1 >/dev/null
check "and is served once deployed" contains "$(get demo.test /)" "gruvs demo"
check "status reports every app healthy" bash -c "! '$VG' status | grep -E '^(thegruvs|excellency|theresident|demo) ' | grep -v 'health=ok'"

# --- connecting an app to its domains -----------------------------------------
echo "connect"
"$VG" apps add later --type static --domain later.test >/dev/null
out="$(printf 'not-on-argv' | "$VG" env later set TOKEN - 2>&1)"
check "a secret can be set from stdin before the first deploy" \
  bash -c "grep -q 'first deploy will use it' <<<'$out' && grep -qx 'TOKEN=not-on-argv' '$T/etc/env/later.env'"
check "setting the same value again changes nothing" contains "$(printf 'not-on-argv' | "$VG" env later set TOKEN - 2>&1)" "unchanged"
out="$("$VG" connect later 2>&1 || true)"
check "connect refuses an app with nothing deployed" contains "$out" "nothing deployed yet"
out="$(mk_static later | "$VG" receive later l1 2>&1 || echo "EXIT $?")"
check "an app deploys before its domains point here" bash -c "grep -q 'vgruvs connect later' <<<'$out' && ! grep -q EXIT <<<'$out'"
check "and nginx does not serve it yet" test "$(code_of later.test /)" = 000
out="$(VGRUVS_RESOLVE="later.test=203.0.113.9" "$VG" connect later 2>&1 || true)"
check "connect refuses while DNS points elsewhere" contains "$out" "later.test: points to 203.0.113.9"
check "and changes nothing" test ! -e "$T/nginx/sites-enabled/vgruvs-later.conf"
out="$(VGRUVS_RESOLVE="other.test=192.0.2.2" "$VG" connect later 2>&1 || true)"
check "connect refuses a domain with no A record" contains "$out" "later.test: no A record"
# Let's Encrypt stands in: the fake certbot records its arguments.
mkdir -p "$T/fakebin"
printf '#!/bin/sh\necho "$*" >>"%s/certbot.log"\n' "$T" >"$T/fakebin/certbot"
chmod +x "$T/fakebin/certbot"
cert later.test later.test
here="$(hostname -I | awk '{print $1}')"
# Without the test switch, curl checks the (self-signed) certificate for real
# and refuses it: connect must switch the site off again.
out="$(PATH="$T/fakebin:$PATH" VGRUVS_RESOLVE="later.test=$here" "$VG" connect later 2>&1 || true)"
check "connect switches the site off again if it does not answer with a valid certificate" \
  bash -c "grep -q 'The site is off again' <<<'$out' && test ! -e '$T/nginx/sites-enabled/vgruvs-later.conf'"
out="$(PATH="$T/fakebin:$PATH" VGRUVS_RESOLVE="later.test=$here" VGRUVS_TLS_INSECURE_FOR_TESTS=1 "$VG" connect later 2>&1)"
check "connect gets the certificate for every domain" grep -q -- '--cert-name later.test -d later.test' "$T/certbot.log"
check "and puts the app on its domain" bash -c "grep -q 'later is live: https://later.test' <<<'$out'"
check "which answers through nginx" contains "$(get later.test /)" "gruvs later"
out="$(mk_static later | "$VG" receive later l2 2>&1)"
check "later deploys get the full check through nginx" contains "$out" "later l2 is live on https://later.test"
check "connecting is in the events" bash -c "'$VG' events later | grep -q 'later is live on later.test'"

# --- the console on the web, notifications, start-up ---------------------------
echo "console on the web"
cert ops.test ops.test
out="$(printf 'correct horse battery\n' | VGRUVS_RESOLVE="ops.test=203.0.113.9" "$VG" console publish ops.test 2>&1 || true)"
check "the console is not published while its DNS points elsewhere" \
  bash -c "grep -q 'ops.test: points to 203.0.113.9' <<<'$out' && test ! -e '$T/nginx/sites-enabled/vgruvs-console-public.conf'"
out="$(printf 'short\n' | VGRUVS_RESOLVE="ops.test=$here" "$VG" console publish ops.test 2>&1 || true)"
check "nor with a short password" contains "$out" "at least 12 characters"
out="$(printf 'correct horse battery\n' | VGRUVS_RESOLVE="ops.test=$here" VGRUVS_TLS_INSECURE_FOR_TESTS=1 "$VG" console publish ops.test 2>&1)"
check "the console goes online behind a password" contains "$out" "console: https://ops.test"
check "which is never printed" bash -c "! grep -q 'correct horse' <<<'$out'"
check "without the password it is locked" test "$(code_of ops.test /)" = 401
check "with it, the console opens" contains "$(get ops.test / -u 'admin:correct horse battery')" "V-Gruvs Console"
"$VG" console unpublish >/dev/null
check "unpublish takes it off the web" test "$(code_of ops.test /)" = 000

echo "notifications"
echo '# a line of my own' >>"$T/etc/notify.conf"
out="$(printf 'http://127.0.0.1:%s/hook\n' "$HOOK_PORT" | "$VG" notify set - 2>&1)"
check "the notification URL is set from stdin, and only its host is shown" \
  bash -c "grep -q 'notifications go to 127.0.0.1:$HOOK_PORT' <<<'$out' && ! grep -q '/hook' <<<'$out'"
check "the rest of notify.conf is kept" \
  bash -c "grep -q 'a line of my own' '$T/etc/notify.conf' && test \"\$(grep -c '^NOTIFY_URL=' '$T/etc/notify.conf')\" = 1"
check "a plain-http URL is refused" bash -c "! printf 'http://example.com/x\n' | '$VG' notify set - 2>/dev/null"

echo "start-up"
slot="$(cat "$T/srv/excellency/active-slot")"
"$T/bin/systemctl" stop "vgruvs-app@excellency-$slot"
check "an app that is down, as after a restart" bash -c "'$VG' status excellency | grep -qv 'health=ok'"
"$VG" boot >/dev/null
check "is started by vgruvs boot" eventually 20 bash -c "'$VG' status excellency | grep -q 'health=ok'"
check "and the start-up is in the events" bash -c "'$VG' events -n 5 | grep -q 'droplet started up'"
check "and in the notifications" eventually 10 grep -q 'droplet started up' "$T/notified.log"

echo "restarts for updates"
printf 'Unattended-Upgrade::Automatic-Reboot "true";\nUnattended-Upgrade::Automatic-Reboot-Time "01:30";\n' >"$T/52vgruvs-reboot"
echo '*** System restart required ***' >"$T/reboot-required"
echo 'linux-image-6.8.0-130-generic' >"$T/reboot-required.pkgs"
heal_at() { VGRUVS_REBOOT_CONF="$T/52vgruvs-reboot" VGRUVS_REBOOT_FLAG="$T/reboot-required" VGRUVS_REBOOT_WAIT=0 VGRUVS_NOW_HHMM="$1" "$VG" heal >/dev/null 2>&1; }
heal_at 1200
check "a waiting restart does not happen outside the quiet hour" test ! -e "$T/rebooted"
heal_at 0135
check "it happens at the quiet hour, by the heal timer" test -e "$T/rebooted"
check "and says why in the events" bash -c "'$VG' events -n 5 | grep -q 'restarting for security updates (linux-image-6.8.0-130-generic)'"
rm -f "$T/rebooted"
heal_at 0137
check "but never twice in a row" test ! -e "$T/rebooted"
check "doctor says when it will happen" bash -c "VGRUVS_REBOOT_CONF='$T/52vgruvs-reboot' VGRUVS_REBOOT_FLAG='$T/reboot-required' '$VG' doctor 2>&1 | grep -q 'the heal timer restarts the droplet at 01:30 UTC'"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
