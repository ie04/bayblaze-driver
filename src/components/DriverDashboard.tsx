import { type ReactNode } from "react";
import { Clock, Loader2, MapPin, Navigation, RefreshCw, Truck } from "lucide-react";

import { useLiveDriverLocation } from "../hooks/useLiveDriverLocation";
import type { DriverProfile } from "../lib/types";

export function DriverDashboard({ profile }: { profile: DriverProfile }) {
  const liveLocation = useLiveDriverLocation(profile);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <ActiveShiftWidget profile={profile} />

      <LiveLocationCard location={liveLocation} />
    </div>
  );
}

function LiveLocationCard({
  location,
}: {
  location: ReturnType<typeof useLiveDriverLocation>;
}) {
  const tracking = location.status === "tracking";
  const requesting = location.status === "requesting";
  const statusCopy = getLocationStatusCopy(location.status);
  const accuracy = location.lastPosition?.coords.accuracy;

  return (
    <section className="rounded-[24px] border border-[var(--bayblaze-line)] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
            tracking
              ? "bg-green-50 text-[var(--bayblaze-green-dark)]"
              : "bg-[var(--bayblaze-cream)] text-[var(--bayblaze-green-dark)]"
          }`}
        >
          {requesting ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <MapPin size={21} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--bayblaze-green)]">
                Live location
              </p>
              <h3 className="mt-1 text-lg font-black text-[var(--bayblaze-ink)]">
                {statusCopy}
              </h3>
            </div>
            {!tracking ? (
              <button
                type="button"
                className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--bayblaze-line)] text-[var(--bayblaze-green-dark)]"
                aria-label="Retry location tracking"
                title="Retry location tracking"
                onClick={location.retry}
              >
                <RefreshCw size={17} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <LocationMetric
              label="Last sync"
              value={formatLastSyncedAt(location.lastSyncedAt)}
            />
            <LocationMetric label="Accuracy" value={formatAccuracy(accuracy)} />
          </div>
          {location.error ? (
            <p
              className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
                location.permissionDenied
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-yellow-200 bg-yellow-50 text-yellow-800"
              }`}
            >
              {location.error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LocationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--bayblaze-cream)] px-3 py-2">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--bayblaze-muted)]">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-[var(--bayblaze-ink)]">
        {value}
      </p>
    </div>
  );
}

function getLocationStatusCopy(status: ReturnType<typeof useLiveDriverLocation>["status"]) {
  if (status === "requesting") {
    return "Requesting permission";
  }

  if (status === "tracking") {
    return "Tracking active";
  }

  if (status === "unsupported") {
    return "Unsupported";
  }

  if (status === "error") {
    return "Tracking paused";
  }

  return "Waiting to track";
}

function formatLastSyncedAt(lastSyncedAt: number | null) {
  if (!lastSyncedAt) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(lastSyncedAt);
}

function formatAccuracy(accuracy?: number) {
  if (accuracy === undefined) {
    return "-";
  }

  if (accuracy < 30) {
    return `${Math.round(accuracy)} m`;
  }

  return `${Math.round(accuracy * 3.28084)} ft`;
}

export function ActiveShiftWidget({
  profile,
  action,
}: {
  profile: DriverProfile;
  action?: {
    busy?: boolean;
    icon?: ReactNode;
    label: string;
    onClick: () => void;
    tone: "green" | "red";
  };
}) {
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
          value={profile.clockedIn ? "Clocked in" : "Clocked out"}
        />
      </div>
      {action ? (
        <button
          type="button"
          className={`mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border px-5 text-sm font-black uppercase shadow-sm transition disabled:opacity-70 ${
            action.tone === "red"
              ? "border-red-100 bg-red-50 text-red-800 hover:bg-red-100"
              : "border-transparent bg-[var(--bayblaze-green)] text-white shadow-green-950/20 hover:bg-[#5f9138]"
          }`}
          onClick={action.onClick}
          disabled={action.busy}
        >
          {action.busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : action.icon ? (
            action.icon
          ) : null}
          {action.label}
        </button>
      ) : null}
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
