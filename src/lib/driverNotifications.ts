import { driverApiDelete, driverApiPost } from "./driverApi";

export type DriverPushRegistrationResult =
  | "registered"
  | "missing-vapid-key"
  | "permission-default"
  | "permission-denied"
  | "unsupported";

const vapidPublicKey = import.meta.env.VITE_BAYBLAZE_WEB_PUSH_PUBLIC_KEY as string | undefined;
const storageKey = "bayblaze-driver-push-token-id";

export async function registerDriverPushNotifications({
  requestPermission = false,
}: {
  requestPermission?: boolean;
} = {}) {
  if (!supportsWebPush()) {
    return "unsupported" satisfies DriverPushRegistrationResult;
  }

  if (!vapidPublicKey) {
    return "missing-vapid-key" satisfies DriverPushRegistrationResult;
  }

  if (Notification.permission === "default") {
    if (!requestPermission) {
      return "permission-default" satisfies DriverPushRegistrationResult;
    }

    const permission = await Notification.requestPermission();
    if (permission === "default") {
      return "permission-default" satisfies DriverPushRegistrationResult;
    }
  }

  if (Notification.permission === "denied") {
    return "permission-denied" satisfies DriverPushRegistrationResult;
  }

  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  let subscription = await registration.pushManager.getSubscription();

  if (
    subscription &&
    !subscriptionUsesApplicationServerKey(subscription, applicationServerKey)
  ) {
    const staleTokenId = await getSubscriptionId(subscription);
    await driverApiDelete(
      `/v1/driver/me/notification-tokens/${encodeURIComponent(staleTokenId)}`,
    ).catch(() => undefined);
    await subscription.unsubscribe();
    subscription = null;
  }

  subscription ??= await registration.pushManager.subscribe({
    applicationServerKey,
    userVisibleOnly: true,
  });
  const tokenId = await getSubscriptionId(subscription);

  await driverApiPost("/v1/driver/me/notification-tokens", {
    platform: "web-push",
    token: JSON.stringify(subscription.toJSON()),
    tokenId,
    userAgent: navigator.userAgent,
  });
  window.localStorage.setItem(storageKey, tokenId);

  return "registered" satisfies DriverPushRegistrationResult;
}

export async function unregisterDriverPushNotifications() {
  if (!supportsWebPush()) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  const storedTokenId = window.localStorage.getItem(storageKey);
  const tokenId = subscription ? await getSubscriptionId(subscription) : storedTokenId;

  if (tokenId) {
    await driverApiDelete(`/v1/driver/me/notification-tokens/${encodeURIComponent(tokenId)}`);
  }

  if (subscription) {
    await subscription.unsubscribe();
  }

  window.localStorage.removeItem(storageKey);
}

function supportsWebPush() {
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function subscriptionUsesApplicationServerKey(
  subscription: PushSubscription,
  expectedKey: Uint8Array,
) {
  const currentKey = subscription.options.applicationServerKey;

  if (!currentKey) {
    return true;
  }

  return byteArraysMatch(new Uint8Array(currentKey), expectedKey);
}

function byteArraysMatch(first: Uint8Array, second: Uint8Array) {
  if (first.byteLength !== second.byteLength) {
    return false;
  }

  return first.every((value, index) => value === second[index]);
}

async function getSubscriptionId(subscription: PushSubscription) {
  if ("crypto" in window && window.crypto.subtle) {
    const digest = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(subscription.endpoint),
    );
    return base64UrlEncode(new Uint8Array(digest));
  }

  return base64UrlEncode(new TextEncoder().encode(subscription.endpoint));
}

function base64UrlEncode(value: Uint8Array) {
  let binary = "";
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
