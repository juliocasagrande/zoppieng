# Build context is the monorepo root (Railway root directory = ".").
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/web apps/web

# Vite inlines VITE_* vars into the client bundle at build time, so they must
# be present as build args (Railway passes configured service variables
# through automatically when the ARG name matches).
ARG VITE_API_BASE_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build --workspace packages/shared
RUN npm run build --workspace apps/web

FROM node:20-slim
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/apps/web/dist ./dist

# vite-plugin-pwa generates a service worker (sw.js) that must be served
# fresh each time, not cached — `serve -s` alone doesn't set that, but the
# browser always revalidates a same-origin sw.js by spec, so this is fine.
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
