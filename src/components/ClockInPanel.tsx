import { useState } from "react";
import { Clock, Loader2, Power, Truck } from "lucide-react";

import { clockInDriver } from "../lib/driverData";
import type { DriverProfile } from "../lib/types";

export function ClockInPanel({ profile }: { profile: DriverProfile }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClockIn() {
    setLoading(true);
    setError("");

    try {
      await clockInDriver(profile);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Clock-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-between">
      <div>
        <div className="grid size-14 place-items-center rounded-2xl bg-[var(--bayblaze-green)] text-white shadow-lg shadow-green-900/15">
          <Clock size={28} aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-3xl font-black leading-tight text-[var(--bayblaze-ink)]">
          Ready to clock in
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--bayblaze-muted)]">
          Vehicle link confirmed.
        </p>

        <div className="mt-6 rounded-[24px] border border-[var(--bayblaze-line)] bg-[var(--bayblaze-cream)] p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-white text-[var(--bayblaze-green-dark)]">
              <Truck size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--bayblaze-muted)]">
                Active vehicle
              </p>
              <p className="truncate text-lg font-black text-[var(--bayblaze-ink)]">
                {profile.activeVehicleId}
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        className="mt-6 flex h-16 items-center justify-center gap-3 rounded-[24px] bg-[var(--bayblaze-green)] px-5 text-lg font-black text-white shadow-xl shadow-green-900/20 transition hover:bg-[var(--bayblaze-green-dark)] disabled:opacity-60"
        disabled={loading}
        onClick={() => void handleClockIn()}
      >
        {loading ? (
          <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        ) : (
          <Power size={23} aria-hidden="true" />
        )}
        Clock in
      </button>
    </div>
  );
}
