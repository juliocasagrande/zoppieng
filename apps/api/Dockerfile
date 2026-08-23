# Build context is the monorepo root (Railway root directory = "."), so this
# can COPY the workspace packages it needs. Also used for the jobs-worker
# service — same image, different Railway "Start Command"
# (node dist/jobs/worker.js instead of the default CMD).
FROM node:20-slim AS base

# Puppeteer needs a real Chromium + its shared libs; we skip Puppeteer's own
# download and point it at the apt-installed binary instead (more reliable
# on Railway than Nixpacks' nix chromium package).
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run build --workspace packages/shared
RUN npm run build --workspace apps/api

WORKDIR /app/apps/api
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
