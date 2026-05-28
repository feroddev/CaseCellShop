FROM node:20-bookworm-slim AS base

WORKDIR /app

FROM base AS deps

COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci

FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY apps/api/ ./
RUN npm run prisma:generate
RUN npm run build

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

# For this challenge we keep schema in sync without managing migrations yet.
CMD ["sh", "-lc", "npx prisma db push && node dist/src/main.js"]

