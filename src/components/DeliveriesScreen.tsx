import type { ReactNode } from "react";
import { Lock, Navigation, Route, Sparkles } from "lucide-react";

type QueueStatus = "current" | "locked" | "scored";

type QueueDelivery = {
  customerName: string;
  detail: string;
  status: QueueStatus;
};

const queuePreview: QueueDelivery[] = [
  {
    customerName: "Maya Thompson",
    detail: "Current stop",
    status: "current",
  },
  {
    customerName: "Andre Lewis",
    detail: "Next stop locked",
    status: "locked",
  },
  {
    customerName: "Sofia Ramirez",
    detail: "Score-ranked queue",
    status: "scored",
  },
  {
    customerName: "Noah Patel",
    detail: "Score-ranked queue",
    status: "scored",
  },
  {
    customerName: "Iris Coleman",
    detail: "Score-ranked queue",
    status: "scored",
  },
  {
    customerName: "Eli Morgan",
    detail: "Score-ranked queue",
    status: "scored",
  },
];

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
} satisfies Record<QueueStatus, { icon: ReactNode; title: string }>;

export function DeliveriesScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-3xl font-black leading-tight text-[var(--bayblaze-ink)]">
          Delivery Route
        </h2>
        <span className="grid size-11 place-items-center rounded-2xl bg-[var(--bayblaze-cream)] text-[var(--bayblaze-green-dark)]">
          <Route size={22} aria-hidden="true" />
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid gap-3 pb-4">
          {queuePreview.map((delivery, index) => (
            <DeliveryPill
              delivery={delivery}
              key={`${delivery.customerName}-${index}`}
              muted={index > 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DeliveryPill({
  delivery,
  muted,
}: {
  delivery: QueueDelivery;
  muted: boolean;
}) {
  const meta = statusMeta[delivery.status];

  return (
    <div
      className={`rounded-[24px] border p-4 shadow-sm ${
        muted
          ? "border-slate-200 bg-slate-50 text-slate-400 opacity-70"
          : delivery.status === "current"
            ? "border-[var(--bayblaze-green)] bg-white text-[var(--bayblaze-ink)]"
            : "border-[var(--bayblaze-line)] bg-white text-[var(--bayblaze-ink)]"
      }`}
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
            {delivery.detail}
          </p>
        </div>
      </div>
    </div>
  );
}
