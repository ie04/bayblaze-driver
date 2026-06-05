import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Route,
} from "lucide-react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

import { AuthPanel } from "./components/AuthPanel";
import { ClockInPanel } from "./components/ClockInPanel";
import { DeliveriesScreen } from "./components/DeliveriesScreen";
import { DriverDashboard } from "./components/DriverDashboard";
import { DriverProfileScreen } from "./components/DriverProfileScreen";
import { ProfileSetup } from "./components/ProfileSetup";
import { VehicleLink } from "./components/VehicleLink";
import { auth, firebaseReady } from "./lib/firebase";
import { subscribeDriverProfile } from "./lib/driverData";
import type { DriverProfile } from "./lib/types";

function App() {
  const [authUser, setAuthUser] = useState(auth.currentUser);
  const [profile, setProfile] = useState<DriverProfile | null | undefined>(undefined);
  const [authLoading, setAuthLoading] = useState(firebaseReady);
  const [activeView, setActiveView] = useState<"dashboard" | "deliveries" | "profile">(
    "dashboard",
  );

  useEffect(() => {
    if (!firebaseReady) {
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setProfile(null);
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

  const initials = useMemo(() => {
    const first = profile?.firstName?.[0] ?? authUser?.email?.[0] ?? "D";
    const last = profile?.lastName?.[0] ?? "";
    return `${first}${last}`.toUpperCase();
  }, [authUser?.email, profile?.firstName, profile?.lastName]);

  if (!firebaseReady) {
    return <EnvironmentNotice />;
  }

  const isLoginScreen = !authLoading && !authUser;
  const showProfileChrome = Boolean(authUser && profile?.onboardingComplete);
  const shellClassName = isLoginScreen
    ? "flex min-h-svh w-full flex-col bg-[length:auto_80%] bg-center bg-no-repeat md:bg-[length:auto_130%]"
    : "mx-auto flex min-h-svh w-full max-w-md flex-col bg-white shadow-[0_24px_80px_rgba(36,54,24,0.12)] md:my-6 md:min-h-[calc(100svh-3rem)] md:overflow-hidden md:rounded-[28px]";
  const shellStyle = isLoginScreen
    ? {
        backgroundImage:
          "linear-gradient(rgba(17, 19, 15, 0.18), rgba(17, 19, 15, 0.34)), url('/images/tampa-bay-area-1980-map.jpg')",
      }
    : undefined;
  let screenKey = "loading";
  let screen = <CenteredLoader label="Loading driver access" />;

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
    screen = <DriverProfileScreen profile={profile} onLogout={() => void signOut(auth)} />;
  } else if (profile && activeView === "deliveries") {
    screenKey = "deliveries";
    screen = <DeliveriesScreen />;
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
    <main className={shellClassName} style={shellStyle}>
      <header className="border-b border-[var(--bayblaze-line)] bg-white/95 px-5 pb-4 pt-5 backdrop-blur">
        <h1 className="text-center text-xl font-black uppercase leading-tight tracking-normal text-[var(--bayblaze-ink)]">
          DRIVER DASHBOARD
        </h1>
      </header>

      <section
        className={`flex flex-1 flex-col px-5 py-5 ${
          isLoginScreen ? "mx-auto w-full max-w-md justify-center" : ""
        }`}
      >
        <div className="page-transition flex flex-1 flex-col" key={screenKey}>
          {screen}
        </div>
      </section>

      {showProfileChrome ? (
        <footer className="border-t border-[var(--bayblaze-line)] bg-white/95 px-5 py-3 backdrop-blur">
          <div className="grid grid-cols-3 items-center">
            <div aria-hidden="true" />
            <div className="flex justify-center">
              <button
                type="button"
                className={`grid size-12 place-items-center rounded-full border transition ${
                  activeView === "deliveries"
                    ? "border-[var(--bayblaze-green)] bg-green-50 text-[var(--bayblaze-green-dark)] shadow-lg shadow-green-900/10"
                    : "border-[var(--bayblaze-line)] bg-[var(--bayblaze-cream)] text-[var(--bayblaze-green-dark)]"
                }`}
                aria-label={
                  activeView === "deliveries" ? "Return to dashboard" : "Open deliveries"
                }
                title={activeView === "deliveries" ? "Dashboard" : "Deliveries"}
                onClick={() =>
                  setActiveView((current) =>
                    current === "deliveries" ? "dashboard" : "deliveries",
                  )
                }
              >
                <Route size={22} aria-hidden="true" />
              </button>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                className={`grid size-12 place-items-center overflow-hidden rounded-full border text-sm font-black transition ${
                  activeView === "profile"
                    ? "border-[var(--bayblaze-green)] bg-green-50 text-[var(--bayblaze-green-dark)] shadow-lg shadow-green-900/10"
                    : "border-[var(--bayblaze-line)] bg-[var(--bayblaze-cream)] text-[var(--bayblaze-green-dark)]"
                }`}
                aria-label={
                  activeView === "profile" ? "Return to dashboard" : "Open driver profile"
                }
                title={activeView === "profile" ? "Dashboard" : "Driver profile"}
                onClick={() =>
                  setActiveView((current) =>
                    current === "profile" ? "dashboard" : "profile",
                  )
                }
              >
                {profile?.profilePhotoUrl ? (
                  <img
                    src={profile.profilePhotoUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  initials
                )}
              </button>
            </div>
          </div>
        </footer>
      ) : null}
    </main>
  );
}

function CenteredLoader({ label }: { label: string }) {
  return (
    <div className="grid flex-1 place-items-center py-14 text-center">
      <div>
        <Loader2 className="mx-auto size-8 animate-spin text-[var(--bayblaze-green)]" />
        <p className="mt-3 text-sm font-bold text-[var(--bayblaze-muted)]">{label}</p>
      </div>
    </div>
  );
}

function EnvironmentNotice() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md items-center px-5">
      <section className="rounded-[24px] border border-red-200 bg-white p-5 shadow-xl shadow-red-950/5">
        <AlertTriangle className="size-8 text-red-600" />
        <h1 className="mt-4 text-2xl font-black text-[var(--bayblaze-ink)]">
          Firebase config needed
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--bayblaze-muted)]">
          Add the required `VITE_FIREBASE_*` environment variables before running the
          driver dashboard.
        </p>
      </section>
    </main>
  );
}

export default App;
