import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";

import { app, db } from "./firebase";

export type DriverPushRegistrationResult =
  | "registered"
  | "missing-vapid-key"
  | "permission-denied"
  | "unsupported";

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export async function registerDriverPushNotifications(uid: string) {
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

  await setDoc(
    doc(db, "driver_notification_tokens", uid, "tokens", tokenToDocId(token)),
    {
      uid,
      token,
      platform: navigator.platform || "web",
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return "registered" satisfies DriverPushRegistrationResult;
}

export async function unregisterDriverPushNotifications(uid: string) {
  if (!(await canUseMessaging())) {
    return;
  }

  const messaging = getMessaging(app);
  const token = await getToken(messaging, vapidKey ? { vapidKey } : undefined).catch(() => "");

  if (!token) {
    return;
  }

  await Promise.allSettled([
    deleteDoc(doc(db, "driver_notification_tokens", uid, "tokens", tokenToDocId(token))),
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
