import type { ReactNode } from "react";
import { Loader2, Lock, Navigation, RefreshCw, Route, Sparkles } from "lucide-react";

import type { DriverDeliveryQueue, DriverDeliveryStop, DeliveryStopStatus } from "../lib/types";

const statusMeta = {
  current: {
    icon: <Navigation size={18} aria-hidden="true" />,
    title: "Current delivery",
  },
  locked: {
    icon: <Lock size={18} aria-hidden="true" />,
    title: "Locked next delivery",
  },
  scored: {
    icon: <Sparkles size={18} aria-hidden="true" />,
    title: "Backend-scored queued delivery",
  },
} satisfies Record<DeliveryStopStatus, { icon: ReactNode; title: string }>;

export function DeliveriesScreen({
  queue,
  onOpenCurrentDelivery,
  onSync,
  syncing,
}: {
  queue: DriverDeliveryQueue | null;
  onOpenCurrentDelivery: (stop: DriverDeliveryStop) => void;
  onSync: () => void;
  syncing: boolean;
}) {
  const stops = queue?.stops ?? [];
  const currentStop = stops[0] ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-3xl font-black leading-tight text-[var(--bayblaze-ink)]">
          Delivery Route
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-2xl border border-[var(--bayblaze-line)] bg-white text-[var(--bayblaze-green-dark)]"
            aria-label="Sync delivery route"
            title="Sync delivery route"
            onClick={onSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={19} aria-hidden="true" />
            )}
          </button>
          <span className="grid size-11 place-items-center rounded-2xl bg-[var(--bayblaze-cream)] text-[var(--bayblaze-green-dark)]">
            <Route size={22} aria-hidden="true" />
          </span>
        </div>
      </div>

      {stops.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-[28px] border border-[var(--bayblaze-line)] bg-white p-5 text-center">
          <div>
            <p className="text-lg font-black text-[var(--bayblaze-ink)]">
              No assigned deliveries
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--bayblaze-muted)]">
              Delivery assignments from Medusa and IsoChronos scoring will appear here.
            </p>
            <button
              type="button"
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--bayblaze-green)] px-5 text-sm font-black text-white"
              onClick={onSync}
              disabled={syncing}
            >
              {syncing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Sync Deliveries
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-3 pb-4">
            {stops.map((delivery, index) => (
              <DeliveryPill
                delivery={delivery}
                key={delivery.orderId}
                muted={index > 1}
                onClick={
                  currentStop?.orderId === delivery.orderId
                    ? () => onOpenCurrentDelivery(delivery)
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveryPill({
  delivery,
  muted,
  onClick,
}: {
  delivery: DriverDeliveryStop;
  muted: boolean;
  onClick?: () => void;
}) {
  const meta = statusMeta[delivery.status];

  return (
    <button
      type="button"
      className={`rounded-[24px] border p-4 shadow-sm ${
        muted
          ? "border-slate-200 bg-slate-50 text-slate-400 opacity-70"
          : delivery.status === "current"
            ? "border-[var(--bayblaze-green)] bg-white text-[var(--bayblaze-ink)]"
            : "border-[var(--bayblaze-line)] bg-white text-[var(--bayblaze-ink)]"
      } ${onClick ? "text-left transition hover:border-[var(--bayblaze-green)]" : "text-left"}`}
      disabled={!onClick}
      onClick={onClick}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-2xl ${
            muted
              ? "bg-slate-200 text-slate-500"
              : delivery.status === "current"
                ? "bg-[var(--bayblaze-green)] text-white"
                : "bg-[var(--bayblaze-cream)] text-[var(--bayblaze-green-dark)]"
          }`}
          title={meta.title}
        >
          {meta.icon}
        </span>
        <div className="min-w-0">
          <p
            className={`truncate text-base font-black ${
              muted ? "text-slate-500" : "text-[var(--bayblaze-ink)]"
            }`}
          >
            {delivery.customerName}
          </p>
          <p
            className={`mt-1 truncate text-sm font-semibold ${
              muted ? "text-slate-400" : "text-[var(--bayblaze-muted)]"
            }`}
          >
            {delivery.status === "current"
              ? "Current stop"
              : delivery.status === "locked"
                ? "Next stop locked"
                : delivery.eta ?? "Score-ranked queue"}
          </p>
        </div>
      </div>
    </button>
  );
}
