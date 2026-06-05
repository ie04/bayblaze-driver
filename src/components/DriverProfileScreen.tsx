import type { ReactNode } from "react";
import { useState } from "react";
import { LogOut, Mail, Phone, UserRound } from "lucide-react";

import { ActiveShiftWidget } from "./DriverDashboard";
import { clockOutDriver } from "../lib/driverData";
import type { DriverProfile } from "../lib/types";

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
      await clockOutDriver(profile);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Clock-out failed.");
      setClockingOut(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <ActiveShiftWidget
        profile={profile}
        action={
          profile.clockedIn
            ? {
                busy: clockingOut,
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

      <section className="rounded-[28px] border border-[var(--bayblaze-line)] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-[24px] bg-[var(--bayblaze-cream)] text-xl font-black text-[var(--bayblaze-green-dark)]">
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
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--bayblaze-green)]">
              Driver profile
            </p>
            <h2 className="mt-1 truncate text-2xl font-black text-[var(--bayblaze-ink)]">
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

        <p className="mt-5 rounded-2xl bg-[var(--bayblaze-cream)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--bayblaze-muted)]">
          {profile.bio}
        </p>
      </section>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="mt-auto flex h-14 items-center justify-center gap-2 rounded-full bg-red-600 px-6 text-sm font-black uppercase text-white shadow-lg shadow-red-900/20 transition hover:bg-red-700"
        onClick={onLogout}
      >
        <LogOut size={18} aria-hidden="true" />
        LOG OUT
      </button>
    </div>
  );
}

function ProfileRow({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--bayblaze-line)] px-4 py-3">
      <span className="shrink-0 text-[var(--bayblaze-green-dark)]">{icon}</span>
      <span className="min-w-0 truncate text-sm font-black text-[var(--bayblaze-ink)]">
        {value}
      </span>
    </div>
  );
}
