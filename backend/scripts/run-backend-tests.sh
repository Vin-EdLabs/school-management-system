#!/usr/bin/env bash
set -euo pipefail

# run-backend-tests.sh
# Cross-platform bash smoke test using curl (and jq if available).
# Place in backend/scripts and run from repository root:
# cd backend && ./scripts/run-backend-tests.sh

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

echo "Loading .env if present..."
if [ -f .env ]; then
  # shellcheck disable=SC1091
  while IFS='=' read -r key val; do
    # skip comments and empty lines
    [[ "${key#\#}" = "$key" ]] || continue
    key=$(echo "$key" | tr -d ' \t\r\n')
    val=$(echo "${val:-}" | sed -e 's/^\s*"//' -e 's/"\s*$//' -e "s/^\s*'//" -e "s/'\s*$//")
    if [ -n "$key" ]; then
      export "$key"="$val"
    fi
  done < <(grep -v '^\s*#' .env | grep -v '^\s*$' || true)
fi

PORT=${PORT:-9999}

echo "Running DB connectivity check..."
if ! npm run check-db --silent; then
  echo "check-db failed. Aborting." >&2
  exit 2
fi

echo "Running migrations..."
if ! npm run migrate:up --silent; then
  echo "migrations failed. Aborting." >&2
  exit 3
fi

echo "Seeding admin (force reset) using .env values..."
# Try running the CLI seeder first (non-fatal). If it doesn't run, the server startup seed will run next.
if ! npm run seed-admin -- --reset; then
  echo "seed-admin CLI run failed or skipped (continuing to start server)" >&2
fi

echo "Starting server in background (logs -> server.log, server.err)"
# Ensure server-run seed will force-update existing user on startup
export SEED_ADMIN_FORCE=true
npx tsx src/index.ts > server.log 2> server.err &
PID=$!
echo "Server PID: $PID"

wait_for() {
  local url=$1
  local max=$2
  local i=0
  while [ $i -lt $max ]; do
    if curl -sSf "$url" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i+1))
    sleep 1
  done
  return 1
}

echo "Waiting up to 30s for http://localhost:$PORT/ to respond..."
if ! wait_for "http://localhost:$PORT/" 30; then
  echo "Server did not start within 30s. See server.log and server.err" >&2
  kill "$PID" 2>/dev/null || true
  exit 4
fi

echo "Server is up — performing HTTP smoke tests."

# detect curl binary (prefer curl.exe on Windows/PowerShell environments)
if command -v curl.exe >/dev/null 2>&1; then
  CURL_BIN=curl.exe
elif command -v curl >/dev/null 2>&1; then
  CURL_BIN=curl
else
  echo "curl is required but not found in PATH" >&2
  kill "$PID" 2>/dev/null || true
  exit 5
fi

# detect jq (optional) and node as fallback for JSON parsing
if command -v jq >/dev/null 2>&1; then
  HAVE_JQ=1
else
  HAVE_JQ=0
fi
if command -v node >/dev/null 2>&1; then
  HAVE_NODE=1
else
  HAVE_NODE=0
fi

echo "GET / =>"
$CURL_BIN -sS "http://localhost:$PORT/" || true
echo

BASE="http://localhost:$PORT/api"

echo "GET /api/students (expected 401 if no auth) =>"
status=$($CURL_BIN -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/students" || echo "000")
if [ "$status" != "200" ]; then
  echo "Expected or got error: HTTP $status"
fi

LOGIN_USER=${SEED_ADMIN_USER:-${SEED_ADMIN_USER:-littleWolf}}
LOGIN_PASS=${SEED_ADMIN_PASSWORD:-${SEED_ADMIN_PASS:-Admin123!}}

echo "Attempting POST /api/auth/login with sample credentials (may fail if user not seeded) =>"
login_resp=$($CURL_BIN -sS -X POST "http://localhost:$PORT/api/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"$LOGIN_USER\",\"password\":\"$LOGIN_PASS\"}" ) || true
if [ -z "$login_resp" ]; then
  echo "Login failed (likely no seeded user or 401)."
else
  echo "Login response:"
  if [ "$HAVE_JQ" -eq 1 ]; then
    echo "$login_resp" | jq . || echo "$login_resp"
  elif [ "$HAVE_NODE" -eq 1 ]; then
    node -e "try{console.log(JSON.stringify(JSON.parse(process.argv[1]),null,2))}catch(e){console.log(process.argv[1])}" "$login_resp"
  else
    echo "$login_resp"
  fi
fi

# extract token (jq preferred, node fallback, naive grep fallback)
TOKEN=""
if [ -n "$login_resp" ]; then
  if [ "$HAVE_JQ" -eq 1 ]; then
    # support both { "token": ... } and { "data": { "token": ... } }
    TOKEN=$(echo "$login_resp" | jq -r '.token // .data.token // empty' 2>/dev/null || true)
  elif [ "$HAVE_NODE" -eq 1 ]; then
    TOKEN=$(node -e "try{const j=JSON.parse(process.argv[1]); console.log((j.token || (j.data && j.data.token))||'')}catch(e){console.log('')}" "$login_resp") || true
  else
    # fallback: extract "token":"..." (handles nested data as well)
    TOKEN=$(echo "$login_resp" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^\"]*\)".*/\1/p' || true)
  fi
fi

if [ -n "$TOKEN" ]; then
  echo "Authenticated; token received. Running protected endpoint set..."
  AUTH_HEADER=( -H "Authorization: Bearer $TOKEN" )
else
  echo "Could not authenticate; skipping protected endpoint sweep."
  AUTH_HEADER=()
fi

unauth=("/" "/permissions" "/notifications/check" "/auth/roles" "/auth/session")
for p in "${unauth[@]}"; do
  echo "[Unauth] GET $BASE$p =>"
  if [ "$HAVE_JQ" -eq 1 ]; then
    $CURL_BIN -sS "$BASE$p" | jq . 2>/dev/null || $CURL_BIN -sS "$BASE$p" || true
  else
    $CURL_BIN -sS "$BASE$p" || true
  fi
  echo
done

# protected endpoints (only run if TOKEN present)
if [ -n "$TOKEN" ]; then
  protected=(
    "GET|/students|"
    "POST|/students|{\"first_name\":\"Test\",\"last_name\":\"Student\",\"admission_no\":\"TST-001\"}"
    "GET|/students/1|"
    "PUT|/students/1|{\"last_name\":\"Updated\"}"
    "DELETE|/students/1|"
    "GET|/classes|"
    "POST|/classes|{\"name\":\"Test Class\",\"level\":\"1\"}"
    "GET|/classes/1|"
    "GET|/classes/1/students|"
  )

  for e in "${protected[@]}"; do
    IFS='|' read -r method path body <<< "$e"
    uri="$BASE$path"
    echo "[Auth] $method $uri"
    case "$method" in
      GET)
        $CURL_BIN -sS -H "Authorization: Bearer $TOKEN" "$uri" | jq . 2>/dev/null || $CURL_BIN -sS -H "Authorization: Bearer $TOKEN" "$uri" || true
        ;;
      POST)
        $CURL_BIN -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X POST -d "$body" "$uri" | jq . 2>/dev/null || $CURL_BIN -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X POST -d "$body" "$uri" || true
        ;;
      PUT)
        $CURL_BIN -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X PUT -d "$body" "$uri" | jq . 2>/dev/null || $CURL_BIN -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X PUT -d "$body" "$uri" || true
        ;;
      DELETE)
        $CURL_BIN -sS -H "Authorization: Bearer $TOKEN" -X DELETE "$uri" | jq . 2>/dev/null || $CURL_BIN -sS -H "Authorization: Bearer $TOKEN" -X DELETE "$uri" || true
        ;;
    esac
    echo
  done
fi

echo "Stopping server (pid: $PID)"
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true

echo "Logs: server.log, server.err"
echo "Backend smoke tests complete."

exit 0
