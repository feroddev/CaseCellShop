#!/bin/sh
set -e

cd /app

npm run prisma:generate
npx prisma db push --skip-generate

if [ "${SKIP_SEED:-false}" != "true" ]; then
  npm run prisma:seed || true
fi

exec npm run start:dev
