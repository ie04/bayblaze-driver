/*
 * BayBlaze legacy service-worker retirement worker.
 *
 * VitePWA originally generated the driver worker at /sw.js before the app
 * moved to the named driver worker. Keep this file so those installations can
 * clear their old precache and migrate to driver-service-worker-v2.js.
 */

const RESET_QUERY_PARAMETER = "__bb_pwa_reset";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(retireLegacyServiceWorker());
});

async function retireLegacyServiceWorker() {
  await self.clients.claim();

  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames.map((cacheName) => caches.delete(cacheName)),
  );

  const clientList = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window",
  });

  await self.registration.unregister();

  await Promise.all(
    clientList.map((client) => {
      const url = new URL(client.url);

      url.searchParams.set(
        RESET_QUERY_PARAMETER,
        Date.now().toString(),
      );

      return client.navigate(url.href);
    }),
  );
}
