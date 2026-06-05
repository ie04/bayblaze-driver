import { Lock, Route, Sparkles } from "lucide-react";

export function DeliveriesScreen() {
  const queuePreview = [
    {
      label: "Current delivery",
      detail: "Ready for driver action",
      locked: true,
    },
    {
      label: "Next delivery",
      detail: "Locked in after current stop",
      locked: true,
    },
    {
      label: "Queued delivery",
      detail: "Backend score can reorder this stop",
      locked: false,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-3xl font-black leading-tight text-[var(--bayblaze-ink)]">
          Delivery Route
        </h2>
        <span className="grid size-11 place-items-center rounded-2xl bg-[var(--bayblaze-cream)] text-[var(--bayblaze-green-dark)]">
          <Route size={22} aria-hidden="true" />
        </span>
      </div>

      <div className="grid gap-3">
        {queuePreview.map((delivery, index) => (
          <div
            className={`rounded-[24px] border bg-white p-4 shadow-sm ${
              index === 0
                ? "border-[var(--bayblaze-green)]"
                : "border-[var(--bayblaze-line)]"
            }`}
            key={`${delivery.label}-${index}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-2xl text-sm font-black ${
                    index === 0
                      ? "bg-[var(--bayblaze-green)] text-white"
                      : "bg-[var(--bayblaze-cream)] text-[var(--bayblaze-green-dark)]"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-[var(--bayblaze-ink)]">
                    {delivery.label}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-[var(--bayblaze-muted)]">
                    {delivery.detail}
                  </p>
                </div>
              </div>
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${
                  delivery.locked
                    ? "bg-[var(--bayblaze-cream)] text-[var(--bayblaze-green-dark)]"
                    : "bg-green-50 text-[var(--bayblaze-green-dark)]"
                }`}
                title={delivery.locked ? "Locked stop" : "Score-ranked stop"}
              >
                {delivery.locked ? (
                  <Lock size={17} aria-hidden="true" />
                ) : (
                  <Sparkles size={17} aria-hidden="true" />
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-[24px] bg-[var(--bayblaze-cream)] px-4 py-3">
        <p className="text-sm font-semibold leading-6 text-[var(--bayblaze-muted)]">
          The first two deliveries stay locked. Later queued deliveries can be
          reprioritized after the current order is completed.
        </p>
      </div>
    </div>
  );
}
