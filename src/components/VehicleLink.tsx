import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Truck } from "lucide-react";

import { formatVehicle, linkVehicleToDriver, listAvailableVehicles } from "../lib/driverData";
import type { DriverProfile, VehicleRecord } from "../lib/types";

export function VehicleLink({ profile }: { profile: DriverProfile }) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadVehicles() {
    setLoading(true);
    setError("");

    try {
      const nextVehicles = await listAvailableVehicles();
      setVehicles(nextVehicles);
      setSelectedVehicleId((current) =>
        nextVehicles.some((vehicle) => vehicle.vehicleId === current)
          ? current
          : nextVehicles[0]?.vehicleId ?? "",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Vehicles could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    listAvailableVehicles()
      .then((nextVehicles) => {
        if (!active) {
          return;
        }

        setVehicles(nextVehicles);
        setSelectedVehicleId(nextVehicles[0]?.vehicleId ?? "");
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }

        setError(caught instanceof Error ? caught.message : "Vehicles could not be loaded.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleConfirm() {
    if (!selectedVehicleId) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await linkVehicleToDriver(profile, selectedVehicleId);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Vehicle link failed.";
      await loadVehicles();
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black leading-tight text-[var(--bayblaze-ink)]">
            Select vehicle
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--bayblaze-muted)]">
            Hi {profile.firstName}, choose the vehicle for this shift.
          </p>
        </div>
        <button
          type="button"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--bayblaze-line)] text-[var(--bayblaze-green-dark)]"
          aria-label="Refresh vehicles"
          title="Refresh vehicles"
          onClick={() => void loadVehicles()}
        >
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-3">
        {loading ? (
          <div className="grid flex-1 place-items-center py-12">
            <Loader2 className="size-8 animate-spin text-[var(--bayblaze-green)]" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="rounded-[24px] border border-[var(--bayblaze-line)] bg-[var(--bayblaze-cream)] p-5">
            <Truck className="size-8 text-[var(--bayblaze-green-dark)]" />
            <p className="mt-3 text-base font-black text-[var(--bayblaze-ink)]">
              No available vehicles
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--bayblaze-muted)]">
              Ask dispatch to activate or free a vehicle.
            </p>
          </div>
        ) : (
          vehicles.map((vehicle) => {
            const selected = selectedVehicleId === vehicle.vehicleId;
            return (
              <button
                type="button"
                className={`w-full rounded-[22px] border p-4 text-left transition ${
                  selected
                    ? "border-[var(--bayblaze-green)] bg-green-50 shadow-lg shadow-green-900/10"
                    : "border-[var(--bayblaze-line)] bg-white"
                }`}
                key={vehicle.vehicleId}
                onClick={() => setSelectedVehicleId(vehicle.vehicleId)}
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--bayblaze-green)] text-white">
                    <Truck size={23} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-black text-[var(--bayblaze-ink)]">
                      {vehicle.label}
                    </span>
                    <span className="mt-1 block truncate text-sm font-semibold text-[var(--bayblaze-muted)]">
                      {formatVehicle(vehicle)}
                      {vehicle.plateNumber ? ` / ${vehicle.plateNumber}` : ""}
                    </span>
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="mt-5 flex h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--bayblaze-green)] px-5 text-base font-black text-white shadow-lg shadow-green-900/15 transition hover:bg-[var(--bayblaze-green-dark)] disabled:opacity-60"
        disabled={!selectedVehicleId || saving || vehicles.length === 0}
        onClick={() => void handleConfirm()}
      >
        {saving ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
        Confirm vehicle
      </button>
    </div>
  );
}
