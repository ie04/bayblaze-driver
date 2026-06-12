import type { ReactNode } from "react";
import { useState } from "react";
import { LogOut, Mail, Phone, Power, UserRound } from "lucide-react";

import { ActiveShiftWidget } from "./DriverDashboard";
import { clockOutDriver } from "../lib/driverData";
import type { DriverProfile } from "../lib/types";
import { Button, Card, ErrorState } from "./ui";

export function DriverProfileScreen({
  profile,
  onClockIn,
  onLogout,
}: {
  profile: DriverProfile;
  onClockIn: () => void;
  onLogout: () => void;
}) {
  const [clockingOut, setClockingOut] = useState(false);
  const [error, setError] = useState("");

  async function handleClockOut() {
    setClockingOut(true);
    setError("");

    try {
      await clockOutDriver();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Clock-out failed.");
      setClockingOut(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <Card>
        <div className="flex items-center gap-4">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-[24px] bg-[var(--bb-surface-warm)] text-xl font-black text-[var(--bb-charcoal)]">
            {profile.profilePhotoUrl ? (
              <img
                src={profile.profilePhotoUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <UserRound size={30} aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">
              Driver profile
            </p>
            <h2 className="mt-1 truncate text-2xl font-black text-[var(--bb-charcoal)]">
              {profile.firstName} {profile.lastName}
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <ProfileRow icon={<Mail size={18} aria-hidden="true" />} value={profile.email} />
          <ProfileRow
            icon={<Phone size={18} aria-hidden="true" />}
            value={profile.phoneNumber}
          />
        </div>

        <p className="mt-5 rounded-2xl bg-[var(--bb-surface-warm)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--bb-muted)]">
          {profile.bio}
        </p>
      </Card>

      <ActiveShiftWidget
        profile={profile}
        action={
          profile.clockedIn
            ? {
                busy: clockingOut,
                icon: <Power size={18} aria-hidden="true" />,
                label: "Clock Out",
                onClick: () => void handleClockOut(),
                tone: "red",
              }
            : {
                label: "Clock In",
                onClick: () => {
                  setError("");
                  onClockIn();
                },
                tone: "green",
              }
        }
      />

      {error ? (
        <ErrorState>{error}</ErrorState>
      ) : null}

      <Button className="mt-auto" fullWidth onClick={onLogout} variant="danger">
        <LogOut size={18} aria-hidden="true" />
        LOG OUT
      </Button>
    </div>
  );
}

function ProfileRow({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--bb-line)] px-4 py-3">
      <span className="shrink-0 text-[var(--bb-charcoal)]">{icon}</span>
      <span className="min-w-0 truncate text-sm font-black text-[var(--bb-charcoal)]">
        {value}
      </span>
    </div>
  );
}
