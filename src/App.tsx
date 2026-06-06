import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  Route,
  X,
} from "lucide-react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

import { AuthPanel } from "./components/AuthPanel";
import { ClockInPanel } from "./components/ClockInPanel";
import { DeliveriesScreen } from "./components/DeliveriesScreen";
import { DeliveryWorkflowScreen } from "./components/DeliveryWorkflowScreen";
import { DriverDashboard } from "./components/DriverDashboard";
import { DriverProfileScreen } from "./components/DriverProfileScreen";
import { ProfileSetup } from "./components/ProfileSetup";
import { VehicleLink } from "./components/VehicleLink";
import {
  AppShell,
  BottomNav,
  Card,
  ErrorState,
  LoadingState,
} from "./components/ui";
import { auth, firebaseReady } from "./lib/firebase";
import {
  subscribeDriverDeliveryQueue,
  subscribeDriverProfile,
  syncDriverDeliveryQueue,
} from "./lib/driverData";
import {
  getOrderAssignmentBody,
  getOrderAssignmentTitle,
  requestOrderNotificationPermission,
  showOrderAssignmentNotification,
} from "./lib/orderAlerts";
import type { DriverDeliveryQueue, DriverDeliveryStop, DriverProfile } from "./lib/types";

const ORDER_TOAST_DURATION_MS = 9_000;

function App() {
  const [authUser, setAuthUser] = useState(auth.currentUser);
  const [profile, setProfile] = useState<DriverProfile | null | undefined>(undefined);
  const [deliveryQueue, setDeliveryQueue] = useState<DriverDeliveryQueue | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<DriverDeliveryStop | null>(null);
  const [orderToast, setOrderToast] = useState<{
    id: string;
    stop: DriverDeliveryStop;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(firebaseReady);
  const [syncingDeliveries, setSyncingDeliveries] = useState(false);
  const [deliverySyncError, setDeliverySyncError] = useState("");
  const [activeView, setActiveView] = useState<
    "dashboard" | "deliveries" | "delivery-workflow" | "profile"
  >("dashboard");
  const queueBaselineReady = useRef(false);
  const previousAssignedOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!firebaseReady) {
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setProfile(null);
        setDeliveryQueue(null);
        setSelectedDelivery(null);
        setOrderToast(null);
        setActiveView("dashboard");
      } else {
        setProfile(undefined);
      }
      queueBaselineReady.current = false;
      previousAssignedOrderIds.current = new Set();
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    return subscribeDriverProfile(authUser.uid, (nextProfile) => {
      setProfile(nextProfile);
    });
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    queueBaselineReady.current = false;
    previousAssignedOrderIds.current = new Set();

    return subscribeDriverDeliveryQueue(authUser.uid, (nextQueue) => {
      const nextStops = nextQueue?.stops ?? [];
      const nextOrderIds = new Set(nextStops.map((stop) => stop.orderId));

      if (queueBaselineReady.current) {
        const newAssignedStop = nextStops.find(
          (stop) => !previousAssignedOrderIds.current.has(stop.orderId),
        );

        if (newAssignedStop) {
          setOrderToast({
            id: `${newAssignedStop.orderId}-${Date.now()}`,
            stop: newAssignedStop,
          });
          void showOrderAssignmentNotification(newAssignedStop);
        }
      } else {
        queueBaselineReady.current = true;
      }

      previousAssignedOrderIds.current = nextOrderIds;
      setDeliveryQueue(nextQueue);
    });
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !profile?.onboardingComplete || !profile.clockedIn) {
      return;
    }

    const storageKey = `bayblaze-order-notification-permission:${authUser.uid}`;
    if (window.localStorage.getItem(storageKey) || !("Notification" in window)) {
      return;
    }

    window.localStorage.setItem(storageKey, "requested");
    void requestOrderNotificationPermission();
  }, [authUser, profile?.clockedIn, profile?.onboardingComplete]);

  useEffect(() => {
    if (!orderToast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setOrderToast((current) => (current?.id === orderToast.id ? null : current));
    }, ORDER_TOAST_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [orderToast]);

  const initials = useMemo(() => {
    const first = profile?.firstName?.[0] ?? authUser?.email?.[0] ?? "D";
    const last = profile?.lastName?.[0] ?? "";
    return `${first}${last}`.toUpperCase();
  }, [authUser?.email, profile?.firstName, profile?.lastName]);

  async function handleDeliverySync() {
    setSyncingDeliveries(true);
    setDeliverySyncError("");

    try {
      await syncDriverDeliveryQueue();
    } catch (caught) {
      setDeliverySyncError(
        caught instanceof Error ? caught.message : "Delivery sync failed.",
      );
    } finally {
      setSyncingDeliveries(false);
    }
  }

  function openDeliveryAlert(stop: DriverDeliveryStop) {
    setSelectedDelivery(stop);
    setActiveView("delivery-workflow");
    setOrderToast(null);
  }

  if (!firebaseReady) {
    return <EnvironmentNotice />;
  }

  const isLoginScreen = !authLoading && !authUser;
  const showProfileChrome = Boolean(authUser && profile?.onboardingComplete);
  const shellStyle = isLoginScreen
    ? {
        backgroundImage:
          "linear-gradient(rgba(17, 19, 15, 0.18), rgba(17, 19, 15, 0.34)), url('/images/tampa-bay-area-1980-map.jpg')",
      }
    : undefined;
  let screenKey = "loading";
  let screen = <LoadingState label="Loading driver access" />;

  if (!authLoading && !authUser) {
    screenKey = "login";
    screen = (
      <AuthPanel
        onLogin={(email, password) =>
          signInWithEmailAndPassword(auth, email, password).then(() => undefined)
        }
      />
    );
  } else if (authUser && profile === undefined) {
    screenKey = "loading-profile";
  } else if (authUser && !profile?.onboardingComplete) {
    screenKey = "profile-setup";
    screen = <ProfileSetup user={authUser} profile={profile ?? null} />;
  } else if (profile && activeView === "profile") {
    screenKey = "profile";
    screen = (
      <DriverProfileScreen
        profile={profile}
        onClockIn={() => setActiveView("dashboard")}
        onLogout={() => void signOut(auth)}
      />
    );
  } else if (profile && activeView === "deliveries") {
    screenKey = "deliveries";
    screen = (
      <DeliveryRouteView
        error={deliverySyncError}
        queue={deliveryQueue}
        syncing={syncingDeliveries}
        onOpenCurrentDelivery={(stop) => {
          setSelectedDelivery(stop);
          setActiveView("delivery-workflow");
        }}
        onSync={() => void handleDeliverySync()}
      />
    );
  } else if (profile && activeView === "delivery-workflow" && selectedDelivery) {
    screenKey = "delivery-workflow";
    screen = (
      <DeliveryWorkflowScreen
        order={selectedDelivery}
        profile={profile}
        onReturnToRoute={() => setActiveView("deliveries")}
      />
    );
  } else if (profile && activeView === "delivery-workflow") {
    screenKey = "deliveries";
    screen = (
      <DeliveryRouteView
        error={deliverySyncError}
        queue={deliveryQueue}
        syncing={syncingDeliveries}
        onOpenCurrentDelivery={(stop) => {
          setSelectedDelivery(stop);
          setActiveView("delivery-workflow");
        }}
        onSync={() => void handleDeliverySync()}
      />
    );
  } else if (profile && !profile.activeVehicleId) {
    screenKey = "vehicle-link";
    screen = <VehicleLink profile={profile} />;
  } else if (profile && !profile.clockedIn) {
    screenKey = "clock-in";
    screen = <ClockInPanel profile={profile} />;
  } else if (profile) {
    screenKey = "dashboard";
    screen = <DriverDashboard profile={profile} />;
  }

  return (
    <AppShell
      className={
        isLoginScreen
          ? undefined
          : "h-svh overflow-hidden md:h-[calc(100svh-3rem)]"
      }
      login={isLoginScreen}
      style={shellStyle}
      header={
        <header className="sticky top-0 z-40 shrink-0 border-b border-[var(--bb-line)] bg-white/95 px-5 pb-4 pt-[calc(1.25rem+env(safe-area-inset-top))] backdrop-blur">
          <p className="text-center text-xs font-black uppercase tracking-[0.28em] text-[var(--bb-blaze)]">
            BAYBLAZE
          </p>
          <h1 className="mt-1 text-center text-lg font-black uppercase leading-tight text-[var(--bb-charcoal)]">
            DELIVERY DASHBOARD
          </h1>
        </header>
      }
      footer={
        showProfileChrome ? (
          <footer className="sticky bottom-0 z-40 shrink-0 border-t border-[var(--bb-line)] bg-white/95 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <BottomNav
              items={[
                {
                  active: activeView === "deliveries" || activeView === "delivery-workflow",
                  icon: <Route size={22} aria-hidden="true" />,
                  label:
                    activeView === "deliveries" || activeView === "delivery-workflow"
                      ? "Return to dashboard"
                      : "Open deliveries",
                  onClick: () =>
                    setActiveView((current) =>
                      current === "deliveries" || current === "delivery-workflow"
                        ? "dashboard"
                        : "deliveries",
                    ),
                },
                {
                  active: activeView === "profile",
                  avatarFallback: initials,
                  avatarSrc: profile?.profilePhotoUrl,
                  label: activeView === "profile" ? "Return to dashboard" : "Open driver profile",
                  onClick: () =>
                    setActiveView((current) =>
                      current === "profile" ? "dashboard" : "profile",
                    ),
                },
              ]}
            />
          </footer>
        ) : undefined
      }
    >
      <section
        className={`w-full min-w-0 max-w-full touch-pan-y flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-5 ${
          isLoginScreen ? "mx-auto w-full max-w-md justify-center" : ""
        }`}
      >
        <div className="page-transition flex min-h-0 flex-1 flex-col" key={screenKey}>
          {screen}
        </div>
      </section>
      {orderToast ? (
        <OrderAssignmentToast
          onClose={() => setOrderToast(null)}
          onOpen={() => openDeliveryAlert(orderToast.stop)}
          stop={orderToast.stop}
        />
      ) : null}
    </AppShell>
  );
}

function EnvironmentNotice() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md items-center px-5">
      <Card elevated>
        <AlertTriangle className="size-8 text-[var(--bb-danger)]" />
        <h1 className="mt-4 text-2xl font-black text-[var(--bb-charcoal)]">
          Firebase config needed
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--bb-muted)]">
          Add the required `VITE_FIREBASE_*` environment variables before running the
          driver dashboard.
        </p>
      </Card>
    </main>
  );
}

function OrderAssignmentToast({
  onClose,
  onOpen,
  stop,
}: {
  onClose: () => void;
  onOpen: () => void;
  stop: DriverDeliveryStop;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[80] mx-auto w-full max-w-md px-5 md:bottom-[calc(6rem+env(safe-area-inset-bottom))]">
      <div
        className="page-transition overflow-hidden rounded-[var(--bb-radius-card)] border border-[var(--bb-blaze-soft)] bg-white shadow-[var(--bb-shadow-card)]"
        role="status"
      >
        <div className="flex items-start gap-3 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--bb-blaze-soft)] text-[var(--bb-blaze)]">
            <BellRing size={21} aria-hidden="true" />
          </span>
          <button
            className="min-w-0 flex-1 text-left"
            onClick={onOpen}
            type="button"
          >
            <p className="text-xs font-black uppercase text-[var(--bb-blaze)]">
              New assignment
            </p>
            <h2 className="mt-1 truncate text-base font-black leading-tight text-[var(--bb-charcoal)]">
              {getOrderAssignmentTitle(stop)}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[var(--bb-muted)]">
              {getOrderAssignmentBody(stop)}
            </p>
          </button>
          <button
            aria-label="Dismiss delivery assignment alert"
            className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--bb-muted)] transition hover:bg-[var(--bb-surface-warm)] hover:text-[var(--bb-charcoal)]"
            onClick={onClose}
            type="button"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;

function DeliveryRouteView({
  error,
  queue,
  syncing,
  onOpenCurrentDelivery,
  onSync,
}: {
  error: string;
  queue: DriverDeliveryQueue | null;
  syncing: boolean;
  onOpenCurrentDelivery: (stop: DriverDeliveryStop) => void;
  onSync: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <DeliveriesScreen
        queue={queue}
        syncing={syncing}
        onOpenCurrentDelivery={onOpenCurrentDelivery}
        onSync={onSync}
      />
      {error ? (
        <ErrorState>{error}</ErrorState>
      ) : null}
    </div>
  );
}
