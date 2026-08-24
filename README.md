# Zoppi

Monorepo: `apps/api` (Express + Puppeteer), `apps/web` (React/Vite PWA), `packages/shared`.
Deployed on Railway (Dockerfile builds — see `apps/api/Dockerfile` and `apps/web/Dockerfile`).

The web PWA checks for a new service worker every five minutes and whenever it
returns online, becomes visible, or receives focus. New workers activate
immediately and reload open clients, while `serve.json` prevents `sw.js` and
the app shell from being served stale. Railway replaces the API and jobs-worker
containers on deploy; clients always reach those services through their stable
service URLs.
