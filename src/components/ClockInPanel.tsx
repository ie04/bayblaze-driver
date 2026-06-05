import { useState } from "react";
import { Clock, Power, Truck } from "lucide-react";

import { clockInDriver } from "../lib/driverData";
import type { DriverProfile } from "../lib/types";
import { Button, Card, ErrorState, PageHeader } from "./ui";

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
        <PageHeader
          icon={<Clock size={28} aria-hidden="true" />}
          title="Ready to clock in"
          subtitle="Vehicle link confirmed."
        />

        <Card className="mt-6" tone="warm">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-white text-[var(--bb-charcoal)]">
              <Truck size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-[var(--bb-muted)]">
                Active vehicle
              </p>
              <p className="truncate text-lg font-black text-[var(--bb-charcoal)]">
                {profile.activeVehicleId}
              </p>
            </div>
          </div>
        </Card>

        {error ? (
          <ErrorState className="mt-4">{error}</ErrorState>
        ) : null}
      </div>

      <Button
        className="mt-6"
        fullWidth
        loading={loading}
        onClick={() => void handleClockIn()}
        size="lg"
      >
        {!loading ? <Power size={23} aria-hidden="true" /> : null}
        Clock in
      </Button>
    </div>
  );
}
