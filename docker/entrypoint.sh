#!/bin/sh
set -eu

# From inside Docker, "localhost" is the container — rewrite to the host machine
# so DATABASE_URL from .env (postgresql://...@localhost:5432/...) still works.
if [ "${RUNNING_IN_DOCKER:-}" = "1" ]; then
  if [ -n "${DATABASE_URL:-}" ]; then
    DATABASE_URL=$(printf '%s' "$DATABASE_URL" | sed \
      -e 's/@localhost:/@host.docker.internal:/g' \
      -e 's/@127\.0\.0\.1:/@host.docker.internal:/g')
    export DATABASE_URL
  fi

  if [ -z "${REDIS_URL:-}" ] || printf '%s' "$REDIS_URL" | grep -Eq '@?localhost:|@?127\.0\.0\.1:'; then
    export REDIS_URL="redis://redis:6379"
  fi
fi

if [ "${SKIP_DB_PUSH:-0}" != "1" ] && [ -n "${DATABASE_URL:-}" ]; then
  echo "Syncing Prisma schema to database..."
  npx prisma db push --skip-generate || {
    echo "Warning: prisma db push failed — is host Postgres reachable on port 5432?"
    echo "On macOS/Windows use host.docker.internal; ensure Postgres listens on 0.0.0.0 or localhost."
  }
fi

exec "$@"
