import { useState, type ReactNode } from "react";
import {
  Loader2,
  Lock,
  MessageSquare,
  Navigation,
  Phone,
  Printer,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Warehouse,
} from "lucide-react";

import type { DriverDeliveryQueue, DriverDeliveryStop, DeliveryStopStatus } from "../lib/types";
import { reprintDeliveryLabels } from "../lib/driverData";
import {
  ActionBar,
  Button,
  Card,
  EmptyState,
  InlineNotice,
  LoadingState,
  OrderCard,
  PageHeader,
  SectionHeader,
} from "./ui";

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
  const warehouseItemCount = currentStop?.items.filter(
    (item) => item.inventoryLocation === "warehouse",
  ).length ?? 0;

  if (syncing && !queue) {
    return <LoadingState label="Syncing delivery route" />;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-x-hidden">
      <PageHeader
        title="Your Route"
        actions={
          <div className="flex shrink-0 items-center gap-2">
            <Button
              aria-label="Sync delivery route"
              disabled={syncing}
              onClick={onSync}
              size="icon"
              title="Sync delivery route"
              variant="secondary"
            >
              {syncing ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw size={19} aria-hidden="true" />
              )}
            </Button>
            <span className="grid size-12 place-items-center rounded-2xl bg-[var(--bb-surface-warm)] text-[var(--bb-charcoal)]">
              <Route size={22} aria-hidden="true" />
            </span>
          </div>
        }
      />

      {stops.length === 0 ? (
        <EmptyState
          action={
            <Button fullWidth loading={syncing} onClick={onSync} size="sm">
              Sync Deliveries
            </Button>
          }
          icon={<Route size={22} aria-hidden="true" />}
          title="No assigned deliveries"
        >
          Delivery assignments from Medusa and BayBlaze API scoring will appear here.
        </EmptyState>
      ) : (
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto pr-1">
          <div className="grid min-w-0 gap-4 pb-4">
            <RouteStatusCard
              stopCount={stops.length}
            />

            {currentStop ? (
              <PriorityDeliveryCard
                delivery={currentStop}
                onOpen={() => onOpenCurrentDelivery(currentStop)}
              />
            ) : null}

            {warehouseItemCount > 0 ? (
              <InlineNotice>
                {warehouseItemCount} item{warehouseItemCount === 1 ? "" : "s"} must be picked
                up at the warehouse before customer handoff.
              </InlineNotice>
            ) : null}

            <InlineNotice tone="info">
              <span className="font-black">ID check required.</span> Verify age, expiration,
              photo match, ID photo, and merchant invoice before handoff.
            </InlineNotice>

            <SectionHeader
              title="Active orders"
              subtitle="Current and next stops stay locked for driver safety."
            />
            {stops.map((delivery, index) => (
              <DeliveryRouteCard
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

function RouteStatusCard({
  stopCount,
}: {
  stopCount: number;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-xs font-black uppercase text-[var(--bb-blaze)]">
        <ShieldCheck size={15} aria-hidden="true" />
        Route status
      </div>
      <p className="mt-3 text-xl font-semibold text-[var(--bb-charcoal)]">
        You Have <span className="font-black">{stopCount}</span>{" "}
        {stopCount === 1 ? "Stop" : "Stops"}
      </p>
    </Card>
  );
}

function PriorityDeliveryCard({
  delivery,
  onOpen,
}: {
  delivery: DriverDeliveryStop;
  onOpen: () => void;
}) {
  const [reprintStatus, setReprintStatus] = useState<"idle" | "printing" | "sent">("idle");
  const [reprintError, setReprintError] = useState("");

  async function handleReprintLabels() {
    setReprintStatus("printing");
    setReprintError("");

    try {
      await reprintDeliveryLabels(delivery.orderId);
      setReprintStatus("sent");
    } catch (caught) {
      setReprintStatus("idle");
      setReprintError(
        caught instanceof Error ? caught.message : "Label reprint failed.",
      );
    }
  }

  return (
    <OrderCard
      current
      icon={<Navigation size={19} aria-hidden="true" />}
      title={delivery.customerName}
      subtitle={delivery.customerAddress}
      status="Priority"
      statusTone="brand"
      meta={
        <div className="grid gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--bb-muted)]">
            {delivery.items.some((item) => item.inventoryLocation === "warehouse") ? (
              <>
                <Warehouse size={16} aria-hidden="true" />
                Warehouse pickup required
              </>
            ) : (
              <>
                <ShieldCheck size={16} aria-hidden="true" />
                ID check before handoff
              </>
            )}
          </div>
          <ActionBar columns={3} className="max-w-full overflow-hidden">
            <Button fullWidth onClick={onOpen} size="sm">
              Start
            </Button>
            <Button
              fullWidth
              disabled={!delivery.customerPhone}
              onClick={() => openCustomerSms(delivery.customerPhone)}
              size="sm"
              variant="secondary"
            >
              <MessageSquare size={16} aria-hidden="true" />
              SMS
            </Button>
            <Button
              fullWidth
              disabled={!delivery.customerPhone}
              onClick={() => openCustomerCall(delivery.customerPhone)}
              size="sm"
              variant="secondary"
            >
              <Phone size={16} aria-hidden="true" />
              Call
            </Button>
          </ActionBar>
          <Button
            fullWidth
            loading={reprintStatus === "printing"}
            onClick={() => void handleReprintLabels()}
            size="sm"
            variant="quiet"
          >
            {reprintStatus !== "printing" ? <Printer size={16} aria-hidden="true" /> : null}
            {reprintStatus === "sent" ? "Labels Sent" : "Reprint Labels"}
          </Button>
          {reprintError ? (
            <InlineNotice tone="danger">{reprintError}</InlineNotice>
          ) : null}
        </div>
      }
    />
  );
}

function DeliveryRouteCard({
  delivery,
  muted,
  onClick,
}: {
  delivery: DriverDeliveryStop;
  muted: boolean;
  onClick?: () => void;
}) {
  const meta = statusMeta[delivery.status];
  const statusLabel =
    delivery.status === "current"
      ? "Current"
      : delivery.status === "locked"
        ? "Locked"
        : "Queued";
  const statusTone: "brand" | "warning" | "neutral" =
    delivery.status === "current"
      ? "brand"
      : delivery.status === "locked"
        ? "warning"
        : "neutral";

  return (
    <OrderCard
      current={delivery.status === "current"}
      icon={<span title={meta.title}>{meta.icon}</span>}
      muted={muted}
      onClick={onClick}
      status={statusLabel}
      statusTone={statusTone}
      title={delivery.customerName}
      subtitle={
        delivery.status === "current"
          ? "Current stop"
          : delivery.status === "locked"
            ? "Next stop locked"
            : delivery.eta ?? "Score-ranked queue"
      }
    />
  );
}

function openCustomerSms(phone?: string) {
  if (!phone) {
    return;
  }

  window.location.href = `sms:${phone}`;
}

function openCustomerCall(phone?: string) {
  if (!phone) {
    return;
  }

  window.location.href = `tel:${phone}`;
}
