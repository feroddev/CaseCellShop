FROM node:20-bookworm-slim AS base

WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps

COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci

FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY apps/api/ ./
RUN npm run prisma:generate
RUN npm run build
RUN npx tsc prisma/seed.ts \
  --outDir prisma/seed-dist \
  --module commonjs \
  --target ES2022 \
  --esModuleInterop \
  --skipLibCheck

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=12 --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-lc", "npx prisma db push --skip-generate && node prisma/seed-dist/seed.js && node dist/src/main.js"]
