import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { db, functions, storage } from "./firebase";
import type {
  DriverDeliveryQueue,
  DriverLocationSnapshot,
  DriverProfile,
  VehicleRecord,
} from "./types";

export type DeliveryAttemptLogType =
  | "warehouse_arrival"
  | "customer_arrival"
  | "id_photo"
  | "merchant_invoice_photo"
  | "cancelled"
  | "completed";

const syncDriverDeliveryQueueCallable = httpsCallable<void, { stopCount: number }>(
  functions,
  "syncDriverDeliveryQueue",
);

export function subscribeDriverProfile(
  uid: string,
  onChange: (profile: DriverProfile | null) => void,
) {
  return onSnapshot(doc(db, "driver_profiles", uid), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as DriverProfile) : null);
  });
}

export function subscribeDriverDeliveryQueue(
  uid: string,
  onChange: (queue: DriverDeliveryQueue | null) => void,
) {
  return onSnapshot(doc(db, "driver_delivery_queues", uid), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as DriverDeliveryQueue) : null);
  });
}

export async function syncDriverDeliveryQueue() {
  const result = await syncDriverDeliveryQueueCallable();
  return result.data;
}

export async function saveDriverProfile({
  user,
  firstName,
  lastName,
  phoneNumber,
  bio,
  photoFile,
}: {
  user: User;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  bio: string;
  photoFile: File | null;
}) {
  const profileRef = doc(db, "driver_profiles", user.uid);
  const existing = await getDoc(profileRef);
  const existingProfile = existing.exists() ? (existing.data() as DriverProfile) : null;

  let profilePhotoPath = existingProfile?.profilePhotoPath;
  let profilePhotoUrl = existingProfile?.profilePhotoUrl;

  if (photoFile) {
    const extension = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
    profilePhotoPath = `driver-profile-photos/${user.uid}/profile.${extension}`;
    const photoRef = ref(storage, profilePhotoPath);
    await uploadBytes(photoRef, photoFile, {
      contentType: photoFile.type || "image/jpeg",
      customMetadata: {
        driverUid: user.uid,
      },
    });

    profilePhotoUrl = await getDownloadURL(photoRef);
  }

  if (!profilePhotoPath || !profilePhotoUrl) {
    throw new Error("Profile photo is required.");
  }

  await setDoc(
    profileRef,
    {
      uid: user.uid,
      email: user.email ?? "",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phoneNumber.trim(),
      bio: bio.trim(),
      profilePhotoPath,
      profilePhotoUrl,
      onboardingComplete: true,
      clockedIn: false,
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function listAvailableVehicles() {
  const vehiclesQuery = query(collection(db, "vehicles"), where("active", "==", true));
  const snapshot = await getDocs(vehiclesQuery);

  return snapshot.docs
    .map((vehicleDoc) => vehicleDoc.data() as VehicleRecord)
    .filter((vehicle) => !vehicle.linkedDriverUid)
    .sort((first, second) => first.label.localeCompare(second.label));
}

export async function linkVehicleToDriver(profile: DriverProfile, vehicleId: string) {
  await runTransaction(db, async (transaction) => {
    const profileRef = doc(db, "driver_profiles", profile.uid);
    const vehicleRef = doc(db, "vehicles", vehicleId);
    const vehicleSnapshot = await transaction.get(vehicleRef);

    if (!vehicleSnapshot.exists()) {
      throw new Error("Vehicle is no longer available.");
    }

    const vehicle = vehicleSnapshot.data() as VehicleRecord;
    if (!vehicle.active || vehicle.linkedDriverUid) {
      throw new Error("Vehicle is already linked.");
    }

    transaction.update(vehicleRef, {
      linkedDriverUid: profile.uid,
      linkedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(profileRef, {
      activeVehicleId: vehicleId,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function clockInDriver(profile: DriverProfile) {
  if (!profile.activeVehicleId) {
    throw new Error("Select a vehicle before clocking in.");
  }

  await updateDoc(doc(db, "driver_profiles", profile.uid), {
    clockedIn: true,
    clockedInAt: serverTimestamp(),
    clockedOutAt: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export async function clockOutDriver(profile: DriverProfile) {
  await runTransaction(db, async (transaction) => {
    const profileRef = doc(db, "driver_profiles", profile.uid);
    const profileSnapshot = await transaction.get(profileRef);

    if (!profileSnapshot.exists()) {
      throw new Error("Driver profile was not found.");
    }

    const currentProfile = profileSnapshot.data() as DriverProfile;
    const vehicleId = currentProfile.activeVehicleId;

    if (vehicleId) {
      const vehicleRef = doc(db, "vehicles", vehicleId);
      const vehicleSnapshot = await transaction.get(vehicleRef);

      if (vehicleSnapshot.exists()) {
        const vehicle = vehicleSnapshot.data() as VehicleRecord;
        if (vehicle.linkedDriverUid === profile.uid) {
          transaction.update(vehicleRef, {
            linkedDriverUid: deleteField(),
            linkedAt: deleteField(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    transaction.update(profileRef, {
      activeVehicleId: deleteField(),
      clockedIn: false,
      clockedOutAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
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

  // Firestore is the browser-facing live location bus. Server-side consumers can
  // read these snapshots and call IsoChronos without exposing backend tokens.
  const snapshot: Omit<DriverLocationSnapshot, "updatedAt"> = {
    uid: profile.uid,
    vehicleId: profile.activeVehicleId,
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: position.coords.heading,
    speed: position.coords.speed,
    clockedIn: true,
    source: "driver-pwa",
    clientCapturedAt: position.timestamp,
  };

  await setDoc(
    doc(db, "driver_location_snapshots", profile.uid),
    {
      ...snapshot,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function logDeliveryAttempt({
  uid,
  orderId,
  type,
  note,
  photoPath,
  photoUrl,
}: {
  uid: string;
  orderId: string;
  type: DeliveryAttemptLogType;
  note?: string;
  photoPath?: string;
  photoUrl?: string;
}) {
  await addDoc(collection(db, "delivery_attempt_logs"), {
    uid,
    orderId,
    type,
    note: note?.trim() || null,
    photoPath: photoPath ?? null,
    photoUrl: photoUrl ?? null,
    createdAt: serverTimestamp(),
  });
}

export async function uploadDeliveryAttemptPhoto({
  uid,
  orderId,
  type,
  photoFile,
}: {
  uid: string;
  orderId: string;
  type: Extract<DeliveryAttemptLogType, "id_photo" | "merchant_invoice_photo">;
  photoFile: File;
}) {
  const extension = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
  const photoPath = `delivery-attempt-photos/${uid}/${orderId}/${type}-${Date.now()}.${extension}`;
  const photoRef = ref(storage, photoPath);

  await uploadBytes(photoRef, photoFile, {
    contentType: photoFile.type || "image/jpeg",
    customMetadata: {
      driverUid: uid,
      orderId,
      type,
    },
  });

  const photoUrl = await getDownloadURL(photoRef);
  await logDeliveryAttempt({
    uid,
    orderId,
    type,
    photoPath,
    photoUrl,
  });
}

export function formatVehicle(vehicle: VehicleRecord) {
  const parts = [vehicle.color, vehicle.make, vehicle.model].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Vehicle";
}
