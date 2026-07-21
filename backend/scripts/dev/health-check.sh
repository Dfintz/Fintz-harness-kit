#!/usr/bin/env bash
set -euo pipefail

# Minimal health test once backend is running.
# Requires: backend listening on $API_URL (default http://localhost:3000)
# Optionally generate token if TOKEN not set.

API_URL=${API_URL:-http://localhost:3000}

if [ -z "${TOKEN:-}" ]; then
  echo "TOKEN not set; generating one..." >&2
  TOKEN=$(node scripts/generate_test_token.js | awk '/^eyJ/{print; exit}')
fi

echo "Using token: ${TOKEN:0:32}... (truncated)"

printf "\n[1] System health summary]\n"
curl -s ${API_URL}/health/system | sed 's/{/\n{/'

printf "\n[2] DB component check]\n"
curl -s ${API_URL}/health/component/database || true

printf "\n[3] User ships endpoint]\n"
USER_ID=test-user
curl -i -H "Authorization: Bearer $TOKEN" ${API_URL}/api/users/${USER_ID}/ships || true

printf "\nDone.\n"
