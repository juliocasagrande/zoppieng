const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Registers the PWA worker and keeps long-running tabs/installations on the
 * latest deployment. Vite's generated worker precaches hashed assets, so a
 * controller change is a reliable signal that a complete new build is ready.
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

  // A first installation must not reload the page. Once a controller already
  // exists, however, a controller change means a new deployment took over.
  let hasController = navigator.serviceWorker.controller !== null;
  let isReloading = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasController && !isReloading) {
      isReloading = true;
      window.location.reload();
      return;
    }

    hasController = true;
  });

  window.addEventListener(
    "load",
    () => {
      void navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          // Bypass HTTP caches for the worker and its imported Workbox script.
          // This prevents an intermediary cache from hiding a fresh deploy.
          updateViaCache: "none",
        })
        .then((registration) => {
          let updateInProgress = false;

          const checkForUpdate = () => {
            if (!navigator.onLine || updateInProgress) return;

            updateInProgress = true;
            void registration
              .update()
              .catch((error: unknown) => {
                console.warn("[pwa] Could not check for an update", error);
              })
              .finally(() => {
                updateInProgress = false;
              });
          };

          // Do not depend only on browser navigation checks: installed PWAs
          // and dashboard tabs can remain open for days.
          checkForUpdate();
          window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS);
          window.addEventListener("online", checkForUpdate);
          window.addEventListener("focus", checkForUpdate);
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") checkForUpdate();
          });
        })
        .catch((error: unknown) => {
          // Registration failures should not prevent the online app from
          // loading; a later navigation will try to register again.
          console.warn("[pwa] Could not register the service worker", error);
        });
    },
    { once: true },
  );
}
