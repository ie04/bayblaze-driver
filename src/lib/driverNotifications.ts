import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";

import { driverApiDelete, driverApiPost } from "./driverApi";
import { app } from "./firebase";

export type DriverPushRegistrationResult =
  | "registered"
  | "missing-vapid-key"
  | "permission-denied"
  | "unsupported";

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export async function registerDriverPushNotifications() {
  if (!vapidKey) {
    return "missing-vapid-key" satisfies DriverPushRegistrationResult;
  }

  if (!(await canUseMessaging())) {
    return "unsupported" satisfies DriverPushRegistrationResult;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return "permission-denied" satisfies DriverPushRegistrationResult;
  }

  const serviceWorkerRegistration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    serviceWorkerRegistration,
    vapidKey,
  });

  if (!token) {
    return "unsupported" satisfies DriverPushRegistrationResult;
  }

  await driverApiPost("/v1/driver/me/notification-tokens", {
    tokenId: tokenToDocId(token),
    token,
    platform: navigator.platform || "web",
    userAgent: navigator.userAgent,
  });

  return "registered" satisfies DriverPushRegistrationResult;
}

export async function unregisterDriverPushNotifications() {
  if (!(await canUseMessaging())) {
    return;
  }

  const messaging = getMessaging(app);
  const token = await getToken(messaging, vapidKey ? { vapidKey } : undefined).catch(() => "");

  if (!token) {
    return;
  }

  await Promise.allSettled([
    driverApiDelete(`/v1/driver/me/notification-tokens/${encodeURIComponent(tokenToDocId(token))}`),
    deleteToken(messaging),
  ]);
}

async function canUseMessaging() {
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    window.isSecureContext &&
    (await isSupported())
  );
}

function tokenToDocId(token: string) {
  return btoa(token).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
