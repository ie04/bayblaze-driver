import { useEffect, useState } from "react";
import { RefreshCw, Truck } from "lucide-react";

import { formatVehicle, linkVehicleToDriver, listAvailableVehicles } from "../lib/driverData";
import type { DriverProfile, VehicleRecord } from "../lib/types";
import { Button, EmptyState, ErrorState, LoadingState, OrderCard, PageHeader } from "./ui";

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
      <PageHeader
        title="Select vehicle"
        subtitle={`Hi ${profile.firstName}, choose the vehicle for this shift.`}
        actions={
          <Button
            aria-label="Refresh vehicles"
            onClick={() => void loadVehicles()}
            size="icon"
            title="Refresh vehicles"
            variant="secondary"
          >
            <RefreshCw size={18} aria-hidden="true" />
          </Button>
        }
      />

      <div className="mt-5 flex flex-1 flex-col gap-3">
        {loading ? (
          <LoadingState label="Loading vehicles" />
        ) : vehicles.length === 0 ? (
          <EmptyState icon={<Truck size={22} aria-hidden="true" />} title="No available vehicles">
            Ask dispatch to activate or free a vehicle.
          </EmptyState>
        ) : (
          vehicles.map((vehicle) => {
            const selected = selectedVehicleId === vehicle.vehicleId;
            return (
              <OrderCard
                current={selected}
                icon={<Truck size={23} aria-hidden="true" />}
                key={vehicle.vehicleId}
                onClick={() => setSelectedVehicleId(vehicle.vehicleId)}
                status={selected ? "Selected" : "Available"}
                statusTone={selected ? "brand" : "success"}
                title={vehicle.label}
                subtitle={`${formatVehicle(vehicle)}${
                  vehicle.plateNumber ? ` / ${vehicle.plateNumber}` : ""
                }`}
              />
            );
          })
        )}
      </div>

      {error ? (
        <ErrorState className="mt-4">{error}</ErrorState>
      ) : null}

      <Button
        className="mt-5"
        disabled={!selectedVehicleId || saving || vehicles.length === 0}
        fullWidth
        loading={saving}
        onClick={() => void handleConfirm()}
      >
        Confirm vehicle
      </Button>
    </div>
  );
}
