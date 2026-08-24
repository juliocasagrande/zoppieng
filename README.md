# Zoppi

Monorepo: `apps/api` (Express + Puppeteer), `apps/web` (React/Vite PWA), `packages/shared`.
Deployed on Railway (Dockerfile builds — see `apps/api/Dockerfile` and `apps/web/Dockerfile`).

The web PWA checks for a new service worker every five minutes and whenever it
returns online or becomes visible. New workers activate immediately, but open
clients only reload while hidden so updates do not visibly flash on screen.
`serve.json` prevents `sw.js` and the app shell from being served stale. Railway
replaces the API and jobs-worker containers on deploy; clients always reach
those services through their stable service URLs.
