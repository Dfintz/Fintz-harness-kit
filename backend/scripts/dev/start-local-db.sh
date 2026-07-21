#!/usr/bin/env bash
set -euo pipefail

# Standalone local Postgres using official image (Option B)
# Defaults match backend/src/config/database.ts (postgres/postgres/sc_fleet_manager)
# Usage:
#   ./scripts/dev/start-local-db.sh
# Then start backend: (from backend directory) npm start
# Optionally seed ships: npm run populate:ships

CONTAINER_NAME="scfm-db"
DB_PASSWORD="postgres"
DB_NAME="sc_fleet_manager"
IMAGE="postgres:15-alpine"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Aborting." >&2
  exit 1
fi

RUNNING=$(docker ps --filter name=${CONTAINER_NAME} --format '{{.Names}}' || true)
EXISTS=$(docker ps -a --filter name=${CONTAINER_NAME} --format '{{.Names}}' || true)

if [ -n "$RUNNING" ]; then
  echo "Container ${CONTAINER_NAME} already running."\
       "Skipping start."
else
  if [ -z "$EXISTS" ]; then
    echo "Launching new Postgres container ${CONTAINER_NAME}..."
    docker run -d \
      --name ${CONTAINER_NAME} \
      -e POSTGRES_PASSWORD=${DB_PASSWORD} \
      -e POSTGRES_DB=${DB_NAME} \
      -p 5432:5432 \
      ${IMAGE}
  else
    echo "Container ${CONTAINER_NAME} exists but not running. Starting..."
    docker start ${CONTAINER_NAME}
  fi
fi

echo "Waiting for Postgres readiness..."
for i in $(seq 1 30); do
  if docker exec ${CONTAINER_NAME} pg_isready -U postgres -d ${DB_NAME} >/dev/null 2>&1; then
    echo "Postgres is ready."; break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "Postgres did not become ready in time" >&2
    exit 1
  fi
done

echo "Connection info:" 
cat <<EOF
Host: localhost
Port: 5432
User: postgres
DB:   ${DB_NAME}
URL:  postgresql://postgres:${DB_PASSWORD}@localhost:5432/${DB_NAME}
EOF

echo "Export environment variables for backend (optional):"
cat <<'EOF'
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=sc_fleet_manager
export NODE_ENV=development
export JWT_SECRET=change-this-in-development
EOF

echo "Next: cd backend && npm start"
