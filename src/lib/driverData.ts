import { driverApiGet, driverApiPost, driverApiPut, driverApiUpload } from "./driverApi";
import type {
  DriverDeliveryQueue,
  DriverLocationSnapshot,
  DriverProfile,
  VehicleRecord,
} from "./types";

export type DeliveryAttemptLogType =
  | "warehouse_arrival"
  | "out_for_delivery"
  | "customer_arrival"
  | "id_photo"
  | "merchant_invoice_photo"
  | "cancelled"
  | "completed";

const subscriptionPollMs = 5_000;

export function subscribeDriverProfile(
  _uid: string,
  onChange: (profile: DriverProfile | null) => void,
) {
  return pollDriverResource(async () => {
    const payload = await driverApiGet<{ profile: DriverProfile | null }>("/v1/driver/me/profile");
    onChange(payload.profile);
  });
}

export function subscribeDriverDeliveryQueue(
  _uid: string,
  onChange: (queue: DriverDeliveryQueue | null) => void,
) {
  return pollDriverResource(async () => {
    const payload = await driverApiGet<{ queue: DriverDeliveryQueue | null }>("/v1/driver/me/queue");
    onChange(payload.queue);
  });
}

export async function syncDriverDeliveryQueue() {
  const payload = await driverApiPost<{ stopCount: number }>("/v1/driver/me/queue/sync");
  return { stopCount: payload.stopCount };
}

export async function saveDriverProfile({
  firstName,
  lastName,
  phoneNumber,
  bio,
  photoFile,
  existingProfile,
}: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  bio: string;
  photoFile: File | null;
  existingProfile?: DriverProfile | null;
}) {
  let profilePhotoPath = existingProfile?.profilePhotoPath;
  let profilePhotoUrl = existingProfile?.profilePhotoUrl;

  if (photoFile) {
    const formData = new FormData();
    formData.append("photo", photoFile);
    const upload = await driverApiUpload<{
      profilePhotoPath: string;
      profilePhotoUrl: string;
    }>("/v1/driver/me/profile-photo", formData);
    profilePhotoPath = upload.profilePhotoPath;
    profilePhotoUrl = upload.profilePhotoUrl;
  }

  if (!profilePhotoPath || !profilePhotoUrl) {
    throw new Error("Profile photo is required.");
  }

  await driverApiPut("/v1/driver/me/profile", {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phoneNumber: phoneNumber.trim(),
    bio: bio.trim(),
    profilePhotoPath,
    profilePhotoUrl,
  });
}

export async function listAvailableVehicles() {
  const payload = await driverApiGet<{ vehicles: VehicleRecord[] }>(
    "/v1/driver/me/vehicles/available",
  );
  return payload.vehicles;
}

export async function linkVehicleToDriver(_profile: DriverProfile, vehicleId: string) {
  await driverApiPost("/v1/driver/me/vehicles/link", { vehicleId });
}

export async function clockInDriver(profile: DriverProfile) {
  if (!profile.activeVehicleId) {
    throw new Error("Select a vehicle before clocking in.");
  }

  await driverApiPost("/v1/driver/me/clock-in");
}

export async function clockOutDriver() {
  await driverApiPost("/v1/driver/me/clock-out");
}

export async function updateDriverLocation(profile: DriverProfile) {
  if (!navigator.geolocation) {
    throw new Error("Location is not available on this device.");
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 15_000,
      timeout: 12_000,
    });
  });

  await writeDriverLocationSnapshot(profile, position);
}

export async function writeDriverLocationSnapshot(
  profile: DriverProfile,
  position: GeolocationPosition,
) {
  if (!profile.activeVehicleId) {
    throw new Error("A linked vehicle is required before sharing live location.");
  }

  const snapshot: Omit<DriverLocationSnapshot, "uid" | "vehicleId" | "updatedAt"> = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: position.coords.heading,
    speed: position.coords.speed,
    clockedIn: true,
    source: "driver-pwa",
    clientCapturedAt: position.timestamp,
  };

  await driverApiPost("/v1/driver/me/location", snapshot);
}

export async function logDeliveryAttempt({
  orderId,
  type,
  note,
  photoPath,
  photoUrl,
}: {
  orderId: string;
  type: DeliveryAttemptLogType;
  note?: string;
  photoPath?: string;
  photoUrl?: string;
}) {
  await driverApiPost("/v1/driver/me/delivery-attempts", {
    orderId,
    type,
    note,
    photoPath,
    photoUrl,
  });
}

export async function reprintDeliveryLabels(orderId: string) {
  await driverApiPost(
    `/v1/driver/me/deliveries/${encodeURIComponent(orderId)}/reprint-labels`,
  );
}

export async function uploadDeliveryAttemptPhoto({
  orderId,
  type,
  photoFile,
}: {
  orderId: string;
  type: Extract<DeliveryAttemptLogType, "id_photo" | "merchant_invoice_photo">;
  photoFile: File;
}) {
  const formData = new FormData();
  formData.append("photo", photoFile);
  formData.append("orderId", orderId);
  formData.append("type", type);
  const upload = await driverApiUpload<{
    photoPath: string;
    photoUrl: string;
  }>("/v1/driver/me/delivery-attempt-photos", formData);

  await logDeliveryAttempt({
    orderId,
    type,
    photoPath: upload.photoPath,
    photoUrl: upload.photoUrl,
  });
}

export function formatVehicle(vehicle: VehicleRecord) {
  const parts = [vehicle.color, vehicle.make, vehicle.model].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Vehicle";
}

function pollDriverResource(load: () => Promise<void>) {
  let cancelled = false;

  async function tick() {
    try {
      await load();
    } catch (caught) {
      console.warn("Driver API polling failed.", caught);
    }
  }

  void tick();
  const interval = window.setInterval(() => {
    if (!cancelled) {
      void tick();
    }
  }, subscriptionPollMs);

  return () => {
    cancelled = true;
    window.clearInterval(interval);
  };
}
