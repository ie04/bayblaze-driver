import type { DriverDeliveryStop } from "./types";

const NOTIFICATION_ICON = "/icons/bayblaze-driver-icon-192.png";
const NOTIFICATION_BADGE = "/icons/bayblaze-driver-icon-192.png";

export function getOrderAssignmentTitle(stop: DriverDeliveryStop) {
  return `New delivery: ${stop.customerName}`;
}

export function getOrderAssignmentBody(stop: DriverDeliveryStop) {
  const eta = stop.eta ? `ETA ${stop.eta}. ` : "";
  return `${eta}${stop.customerAddress}`;
}

export async function requestOrderNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  if (Notification.permission !== "default") {
    return Notification.permission;
  }

  return Notification.requestPermission();
}

export async function showOrderAssignmentNotification(stop: DriverDeliveryStop) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }

  const title = getOrderAssignmentTitle(stop);
  const options: NotificationOptions & { renotify: boolean } = {
    badge: NOTIFICATION_BADGE,
    body: getOrderAssignmentBody(stop),
    data: {
      orderId: stop.orderId,
    },
    icon: NOTIFICATION_ICON,
    renotify: true,
    tag: `bayblaze-delivery-${stop.orderId}`,
  };

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
    return true;
  }

  new Notification(title, options);
  return true;
}
