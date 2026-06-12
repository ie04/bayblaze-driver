export type DriverPushRegistrationResult =
  | "registered"
  | "missing-vapid-key"
  | "permission-denied"
  | "unsupported";

export async function registerDriverPushNotifications() {
  return "unsupported" satisfies DriverPushRegistrationResult;
}

export async function unregisterDriverPushNotifications() {
  return;
}
