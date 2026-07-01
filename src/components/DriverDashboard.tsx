import { type ReactNode } from "react";
import { Bell, BellRing, Clock, Loader2, MailCheck, MapPin, Navigation, RefreshCw, Truck } from "lucide-react";

import { useLiveDriverLocation } from "../hooks/useLiveDriverLocation";
import type { DriverPushRegistrationResult } from "../lib/driverNotifications";
import type { DriverProfile } from "../lib/types";
import { Button, Card, InlineNotice, MetricCard } from "./ui";

export function DriverDashboard({
  notificationStatus,
  notificationsBusy,
  onEnableNotifications,
  profile,
}: {
  notificationStatus: DriverPushRegistrationResult;
  notificationsBusy: boolean;
  onEnableNotifications: () => void;
  profile: DriverProfile;
}) {
  const liveLocation = useLiveDriverLocation(profile);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <ActiveShiftWidget profile={profile} />

      <AssignmentAlertsCard
        busy={notificationsBusy}
        status={notificationStatus}
        onEnable={onEnableNotifications}
      />

      <LiveLocationCard location={liveLocation} />
    </div>
  );
}

function AssignmentAlertsCard({
  busy,
  onEnable,
  status,
}: {
  busy: boolean;
  onEnable: () => void;
  status: DriverPushRegistrationResult;
}) {
  const registered = status === "registered";
  const blocked = status === "permission-denied";
  const unavailable = status === "unsupported" || status === "missing-vapid-key";
  const title = registered
    ? "Push alerts active"
    : blocked
      ? "Push alerts blocked"
      : unavailable
        ? "Push alerts unavailable"
        : "Turn on push alerts";
  const detail = registered
    ? "New order assignments can reach this device, and BayBlaze API handles email alerts server-side."
    : blocked
      ? "Browser notifications are blocked for this site. Enable them in browser settings to receive push alerts."
      : status === "missing-vapid-key"
        ? "A public Web Push key is missing from the driver app environment."
        : status === "unsupported"
          ? "This browser does not support driver push alerts."
          : "Get a device notification when a new delivery hits your route.";

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
            registered
              ? "bg-[var(--bb-success-soft)] text-[var(--bb-success-strong)]"
              : "bg-[var(--bb-blaze-soft)] text-[var(--bb-blaze)]"
          }`}
        >
          {registered ? (
            <BellRing size={21} aria-hidden="true" />
          ) : (
            <Bell size={21} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">
            Assignment alerts
          </p>
          <h3 className="mt-1 text-lg font-black text-[var(--bb-charcoal)]">
            {title}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-5 text-[var(--bb-muted)]">
            {detail}
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[var(--bb-surface-warm)] px-3 py-2 text-sm font-black text-[var(--bb-charcoal)]">
            <MailCheck size={17} aria-hidden="true" />
            <span className="min-w-0 truncate">Email alerts sent by BayBlaze API</span>
          </div>
          {!registered && !blocked && status !== "unsupported" ? (
            <Button
              className="mt-3"
              fullWidth
              loading={busy}
              onClick={onEnable}
              size="sm"
              variant="secondary"
            >
              <Bell size={17} aria-hidden="true" />
              ENABLE PUSH ALERTS
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
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
    <Card>
      <div className="flex items-start gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
            tracking
              ? "bg-[var(--bb-success-soft)] text-[var(--bb-success-strong)]"
              : "bg-[var(--bb-surface-warm)] text-[var(--bb-charcoal)]"
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
              <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">
                Live location
              </p>
              <h3 className="mt-1 text-lg font-black text-[var(--bb-charcoal)]">
                {statusCopy}
              </h3>
            </div>
            {!tracking ? (
              <Button
                aria-label="Retry location tracking"
                onClick={location.retry}
                size="icon"
                title="Retry location tracking"
                variant="secondary"
              >
                <RefreshCw size={17} aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MetricCard
              label="Last sync"
              value={formatLastSyncedAt(location.lastSyncedAt)}
            />
            <MetricCard label="Accuracy" value={formatAccuracy(accuracy)} />
          </div>
          {location.error ? (
            <InlineNotice
              className="mt-3"
              tone={location.permissionDenied ? "danger" : "warning"}
            >
              {location.error}
            </InlineNotice>
          ) : null}
        </div>
      </div>
    </Card>
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
    <Card className="border-transparent" tone="dark" elevated>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">
            Active shift
          </p>
          <h2 className="mt-2 text-3xl font-black leading-tight">
            {profile.firstName} {profile.lastName}
          </h2>
        </div>
        <span className="grid size-12 place-items-center rounded-2xl bg-white/12 text-[var(--bb-blaze-soft)]">
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
        <Button
          className="mt-3"
          fullWidth
          loading={action.busy}
          onClick={action.onClick}
          size="sm"
          variant={action.tone === "red" ? "danger" : "primary"}
        >
          {!action.busy && action.icon ? action.icon : null}
          {action.label}
        </Button>
      ) : null}
    </Card>
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
      <div className="flex items-center gap-2 text-[var(--bb-blaze-soft)]">
        {icon}
        <span className="text-xs font-black uppercase">{label}</span>
      </div>
      <p className="mt-2 truncate text-base font-black">{value}</p>
    </div>
  );
}
