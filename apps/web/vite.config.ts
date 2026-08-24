import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Registration is handled by src/pwa/registerServiceWorker.ts so we can
      // actively check for deployments while an installed PWA remains open.
      injectRegister: false,
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Zoppi",
        short_name: "Zoppi",
        description: "Zoppi — Plataforma de Laudos Técnicos",
        theme_color: "#151F5C",
        background_color: "#F4F5F8",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // Do not leave a new deployment waiting for every old tab to close.
        // The client reloads as soon as this worker takes control.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // The field flow (/f/:token) is the surface that must work offline:
        // cache its shell + API GET responses, and queue writes via IndexedDB
        // (see src/field/offline) rather than relying on Workbox background sync
        // for POSTs, since submissions need app-level retry/merge logic.
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/f/"),
            handler: "NetworkFirst",
            options: { cacheName: "field-flow-pages" },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
