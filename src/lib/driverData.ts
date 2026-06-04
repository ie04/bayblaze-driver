import type { User } from "firebase/auth";
import {
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
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { db, storage } from "./firebase";
import type { DriverProfile, VehicleRecord } from "./types";

export function subscribeDriverProfile(
  uid: string,
  onChange: (profile: DriverProfile | null) => void,
) {
  return onSnapshot(doc(db, "driver_profiles", uid), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as DriverProfile) : null);
  });
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

  await setDoc(
    doc(db, "driver_location_snapshots", profile.uid),
    {
      uid: profile.uid,
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function formatVehicle(vehicle: VehicleRecord) {
  const parts = [vehicle.color, vehicle.make, vehicle.model].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Vehicle";
}
