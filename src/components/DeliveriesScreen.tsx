import { Route } from "lucide-react";

export function DeliveriesScreen() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-1 flex-col rounded-[28px] border border-[var(--bayblaze-line)] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--bayblaze-green)]">
              Deliveries
            </p>
            <h2 className="mt-1 text-xl font-black text-[var(--bayblaze-ink)]">
              Current route
            </h2>
          </div>
          <span className="grid size-11 place-items-center rounded-2xl bg-[var(--bayblaze-cream)] text-[var(--bayblaze-green-dark)]">
            <Route size={22} aria-hidden="true" />
          </span>
        </div>

        <div className="grid flex-1 place-items-center py-10 text-center">
          <div>
            <p className="text-lg font-black text-[var(--bayblaze-ink)]">
              No assigned deliveries
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--bayblaze-muted)]">
              Route assignments will appear here.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
