/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ revision: string | null; url: string }>;
};

type BayBlazePushPayload = {
  data?: Record<string, string>;
  notification?: {
    badge?: string;
    body?: string;
    icon?: string;
    tag?: string;
    title?: string;
  };
  webpush?: {
    fcm_options?: {
      link?: string;
    };
    notification?: {
      badge?: string;
      body?: string;
      icon?: string;
      tag?: string;
      title?: string;
    };
  };
};

const DEFAULT_ICON = "/icons/bayblaze-driver-icon-192.png";
const DEFAULT_BADGE = "/icons/bayblaze-driver-icon-192.png";
const NAVIGATION_CACHE = "bayblaze-driver-navigation-v1";
const NAVIGATION_CACHE_PREFIX = "bayblaze-driver-navigation-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      removeOutdatedNavigationCaches(),
    ]),
  );
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") {
    return;
  }

  event.respondWith(loadLatestNavigation(event.request));
});

async function loadLatestNavigation(request: Request) {
  const cache = await caches.open(NAVIGATION_CACHE);

  try {
    const response = await fetch(request, {
      cache: "no-store",
    });

    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const exactMatch = await cache.match(request);

    if (exactMatch) {
      return exactMatch;
    }

    const rootMatch = await cache.match("/");

    if (rootMatch) {
      return rootMatch;
    }

    return new Response(
      "BayBlaze Driver is offline and no cached app shell is available.",
      {
        headers: {
          "content-type": "text/plain; charset=utf-8",
        },
        status: 503,
      },
    );
  }
}

async function removeOutdatedNavigationCaches() {
  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          cacheName.startsWith(NAVIGATION_CACHE_PREFIX) &&
          cacheName !== NAVIGATION_CACHE,
      )
      .map((cacheName) => caches.delete(cacheName)),
  );
}

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  const notification = payload?.webpush?.notification ?? payload?.notification;

  if (!notification) {
    return;
  }

  const orderId = payload?.data?.orderId ?? "";
  const link = payload?.webpush?.fcm_options?.link ?? `/deliveries?orderId=${orderId}`;

  event.waitUntil(
    self.registration.showNotification(notification.title ?? "New BayBlaze delivery", {
      badge: notification.badge ?? DEFAULT_BADGE,
      body: notification.body,
      data: {
        link,
        orderId,
      },
      icon: notification.icon ?? DEFAULT_ICON,
      renotify: true,
      tag: notification.tag ?? (orderId ? `bayblaze-delivery-${orderId}` : "bayblaze-delivery"),
    } as NotificationOptions & { renotify: boolean }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const link = readNotificationLink(event.notification.data);
  event.waitUntil(openOrFocusClient(link));
});

function readPushPayload(event: PushEvent): BayBlazePushPayload | null {
  if (!event.data) {
    return null;
  }

  try {
    return event.data.json() as BayBlazePushPayload;
  } catch {
    return null;
  }
}

function readNotificationLink(data: unknown) {
  if (
    typeof data === "object" &&
    data !== null &&
    "link" in data &&
    typeof data.link === "string" &&
    data.link
  ) {
    return data.link;
  }

  return "/deliveries";
}

async function openOrFocusClient(link: string) {
  const targetUrl = new URL(link, self.location.origin);
  const clientList = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window",
  });

  for (const client of clientList) {
    const clientUrl = new URL(client.url);
    if (clientUrl.origin === targetUrl.origin && "focus" in client) {
      await client.focus();
      client.postMessage({
        type: "bayblaze-open-delivery",
        orderId: targetUrl.searchParams.get("orderId") ?? "",
      });
      return;
    }
  }

  await self.clients.openWindow(targetUrl.href);
}
