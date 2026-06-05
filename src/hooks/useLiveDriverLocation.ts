import { useEffect, useRef, useState } from "react";

import { writeDriverLocationSnapshot } from "../lib/driverData";
import type { DriverProfile } from "../lib/types";

type LiveLocationStatus = "idle" | "requesting" | "tracking" | "error" | "unsupported";

type SyncedPoint = {
  lat: number;
  lng: number;
  syncedAt: number;
};

const minimumSyncIntervalMs = 10_000;
const staleSyncIntervalMs = 60_000;
const minimumMoveMeters = 25;

export function useLiveDriverLocation(profile: DriverProfile) {
  const [status, setStatus] = useState<LiveLocationStatus>("idle");
  const [error, setError] = useState("");
  const [lastPosition, setLastPosition] = useState<GeolocationPosition | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const lastSyncedPointRef = useRef<SyncedPoint | null>(null);

  const shouldTrack = Boolean(profile.clockedIn && profile.activeVehicleId);
  const geolocationSupported =
    typeof navigator !== "undefined" && "geolocation" in navigator;
  const visibleStatus: LiveLocationStatus = !shouldTrack
    ? "idle"
    : !geolocationSupported
      ? "unsupported"
      : status === "idle"
        ? "requesting"
        : status;
  const visibleError =
    shouldTrack && !geolocationSupported
      ? "Location tracking is not supported on this device."
      : error;

  useEffect(() => {
    if (!shouldTrack || !geolocationSupported) {
      return;
    }

    let cancelled = false;
    let watchId: number | null = null;

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (cancelled) {
          return;
        }

        setLastPosition(position);
        setStatus("tracking");
        setError("");
        setPermissionDenied(false);

        const previous = lastSyncedPointRef.current;
        const now = Date.now();
        const enoughTimePassed =
          !previous || now - previous.syncedAt >= minimumSyncIntervalMs;
        const stale = !previous || now - previous.syncedAt >= staleSyncIntervalMs;
        const movedFarEnough =
          !previous ||
          distanceMeters(previous.lat, previous.lng, position.coords.latitude, position.coords.longitude) >=
            minimumMoveMeters;

        if (!enoughTimePassed || (!movedFarEnough && !stale)) {
          return;
        }

        lastSyncedPointRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          syncedAt: now,
        };
        setLastSyncedAt(now);

        void writeDriverLocationSnapshot(profile, position).catch((caught: unknown) => {
          if (cancelled) {
            return;
          }

          setStatus("error");
          setError(
            caught instanceof Error
              ? caught.message
              : "Live location could not be synced.",
          );
        });
      },
      (geoError) => {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setPermissionDenied(geoError.code === geoError.PERMISSION_DENIED);
        setError(getGeolocationErrorMessage(geoError));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    );

    return () => {
      cancelled = true;

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [geolocationSupported, profile, retryToken, shouldTrack]);

  return {
    status: visibleStatus,
    error: visibleError,
    lastPosition,
    lastSyncedAt,
    permissionDenied,
    retry: () => {
      lastSyncedPointRef.current = null;
      setLastSyncedAt(null);
      setLastPosition(null);
      setPermissionDenied(false);
      setError("");
      setStatus("requesting");
      setRetryToken((current) => current + 1);
    },
  };
}

function getGeolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission is blocked. Enable location access for this app to stream your live driver location.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Location is currently unavailable. Check signal and try again.";
  }

  if (error.code === error.TIMEOUT) {
    return "Location request timed out. Try again when GPS signal improves.";
  }

  return error.message || "Live location tracking failed.";
}

function distanceMeters(
  firstLat: number,
  firstLng: number,
  secondLat: number,
  secondLng: number,
) {
  const earthRadiusMeters = 6_371_000;
  const deltaLat = toRadians(secondLat - firstLat);
  const deltaLng = toRadians(secondLng - firstLng);
  const firstLatRad = toRadians(firstLat);
  const secondLatRad = toRadians(secondLat);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(firstLatRad) * Math.cos(secondLatRad) * Math.sin(deltaLng / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
