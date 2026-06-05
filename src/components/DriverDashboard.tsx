import { type ReactNode, useState } from "react";
import { Clock, Loader2, MapPin, Navigation, Truck } from "lucide-react";

import { updateDriverLocation } from "../lib/driverData";
import type { DriverProfile } from "../lib/types";

export function DriverDashboard({ profile }: { profile: DriverProfile }) {
  const [sharingLocation, setSharingLocation] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function handleLocation() {
    setSharingLocation(true);
    setNotice("");
    setError("");

    try {
      await updateDriverLocation(profile);
      setNotice("Location snapshot updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Location update failed.");
    } finally {
      setSharingLocation(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <ActiveShiftWidget profile={profile} />

      <div className="grid gap-3">
        <button
          type="button"
          className="flex min-h-28 flex-col justify-between rounded-[24px] border border-[var(--bayblaze-line)] bg-white p-4 text-left shadow-sm"
          onClick={() => void handleLocation()}
          disabled={sharingLocation}
        >
          <span className="grid size-10 place-items-center rounded-2xl bg-[var(--bayblaze-cream)] text-[var(--bayblaze-green-dark)]">
            {sharingLocation ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <MapPin size={20} aria-hidden="true" />
            )}
          </span>
          <span className="text-base font-black text-[var(--bayblaze-ink)]">
            Share location
          </span>
        </button>
      </div>

      {notice ? (
        <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-[var(--bayblaze-green-dark)]">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

    </div>
  );
}

export function ActiveShiftWidget({ profile }: { profile: DriverProfile }) {
  return (
    <section className="rounded-[28px] bg-[var(--bayblaze-green-dark)] p-5 text-white shadow-xl shadow-green-950/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-green-100">
            Active shift
          </p>
          <h2 className="mt-2 text-3xl font-black leading-tight">
            {profile.firstName} {profile.lastName}
          </h2>
        </div>
        <span className="grid size-12 place-items-center rounded-2xl bg-white/12">
          <Navigation size={24} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatusTile icon={<Truck size={18} />} label="Vehicle" value={profile.activeVehicleId ?? "-"} />
        <StatusTile
          icon={<Clock size={18} />}
          label="Status"
          value={profile.clockedIn ? "Clocked in" : "Off duty"}
        />
      </div>
    </section>
  );
}

function StatusTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white/12 p-3">
      <div className="flex items-center gap-2 text-green-100">
        {icon}
        <span className="text-xs font-black uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-2 truncate text-base font-black">{value}</p>
    </div>
  );
}
