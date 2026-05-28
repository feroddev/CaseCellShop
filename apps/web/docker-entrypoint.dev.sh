#!/bin/sh
set -e

cd /app

LOCK_HASH_FILE=/app/node_modules/.package-lock.hash
CURRENT_HASH=$(sha256sum package-lock.json | awk '{print $1}')

if [ ! -f "$LOCK_HASH_FILE" ] || [ "$(cat "$LOCK_HASH_FILE")" != "$CURRENT_HASH" ]; then
  echo "package-lock.json changed — running npm ci..."
  npm ci
  echo "$CURRENT_HASH" > "$LOCK_HASH_FILE"
fi

exec npm run dev:docker
