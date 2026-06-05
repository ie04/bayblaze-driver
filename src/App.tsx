import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Route,
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
import type { DriverDeliveryQueue, DriverDeliveryStop, DriverProfile } from "./lib/types";

function App() {
  const [authUser, setAuthUser] = useState(auth.currentUser);
  const [profile, setProfile] = useState<DriverProfile | null | undefined>(undefined);
  const [deliveryQueue, setDeliveryQueue] = useState<DriverDeliveryQueue | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<DriverDeliveryStop | null>(null);
  const [authLoading, setAuthLoading] = useState(firebaseReady);
  const [syncingDeliveries, setSyncingDeliveries] = useState(false);
  const [deliverySyncError, setDeliverySyncError] = useState("");
  const [activeView, setActiveView] = useState<
    "dashboard" | "deliveries" | "delivery-workflow" | "profile"
  >("dashboard");

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
        setActiveView("dashboard");
      } else {
        setProfile(undefined);
      }
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

    return subscribeDriverDeliveryQueue(authUser.uid, (nextQueue) => {
      setDeliveryQueue(nextQueue);
    });
  }, [authUser]);

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
        <header className="border-b border-[var(--bb-line)] bg-white/95 px-5 pb-4 pt-5 backdrop-blur">
          <h1 className="text-center text-xl font-black uppercase leading-tight text-[var(--bb-charcoal)]">
            DRIVER DASHBOARD
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
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-5 ${
          isLoginScreen ? "mx-auto w-full max-w-md justify-center" : ""
        }`}
      >
        <div className="page-transition flex min-h-0 flex-1 flex-col" key={screenKey}>
          {screen}
        </div>
      </section>
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
