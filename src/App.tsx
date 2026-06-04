import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  LogOut,
} from "lucide-react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

import { AuthPanel } from "./components/AuthPanel";
import { ClockInPanel } from "./components/ClockInPanel";
import { DriverDashboard } from "./components/DriverDashboard";
import { ProfileSetup } from "./components/ProfileSetup";
import { VehicleLink } from "./components/VehicleLink";
import { auth, firebaseReady } from "./lib/firebase";
import { subscribeDriverProfile } from "./lib/driverData";
import type { DriverProfile } from "./lib/types";

function App() {
  const [authUser, setAuthUser] = useState(auth.currentUser);
  const [profile, setProfile] = useState<DriverProfile | null | undefined>(undefined);
  const [authLoading, setAuthLoading] = useState(firebaseReady);

  useEffect(() => {
    if (!firebaseReady) {
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setProfile(null);
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
  const shellClassName = isLoginScreen
    ? "flex min-h-svh w-full flex-col bg-[length:auto_115%] bg-center bg-no-repeat md:bg-[length:auto_130%]"
    : "mx-auto flex min-h-svh w-full max-w-md flex-col bg-white shadow-[0_24px_80px_rgba(36,54,24,0.12)] md:my-6 md:min-h-[calc(100svh-3rem)] md:overflow-hidden md:rounded-[28px]";
  const shellStyle = isLoginScreen
    ? {
        backgroundImage:
          "linear-gradient(rgba(17, 19, 15, 0.18), rgba(17, 19, 15, 0.34)), url('/images/tampa-bay-area-1980-map.jpg')",
      }
    : undefined;

  return (
    <main className={shellClassName} style={shellStyle}>
      <header className="border-b border-[var(--bayblaze-line)] bg-white/95 px-5 pb-4 pt-5 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-black uppercase leading-tight tracking-normal text-[var(--bayblaze-ink)]">
              DRIVER DASHBOARD
            </h1>
          </div>

          {authUser ? (
            <div className="flex items-center gap-2">
              <div className="grid size-11 place-items-center overflow-hidden rounded-full border border-[var(--bayblaze-line)] bg-[var(--bayblaze-cream)] text-sm font-black text-[var(--bayblaze-green-dark)]">
                {profile?.profilePhotoUrl ? (
                  <img
                    src={profile.profilePhotoUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-full border border-[var(--bayblaze-line)] text-[var(--bayblaze-muted)] transition hover:border-[var(--bayblaze-green)] hover:text-[var(--bayblaze-green-dark)]"
                aria-label="Sign out"
                title="Sign out"
                onClick={() => void signOut(auth)}
              >
                <LogOut size={19} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <section
        className={`flex flex-1 flex-col px-5 py-5 ${
          isLoginScreen ? "mx-auto w-full max-w-md justify-center" : ""
        }`}
      >
        {authLoading || (authUser && profile === undefined) ? (
          <CenteredLoader label="Loading driver access" />
        ) : !authUser ? (
          <AuthPanel
            onLogin={(email, password) =>
              signInWithEmailAndPassword(auth, email, password).then(() => undefined)
            }
          />
        ) : !profile?.onboardingComplete ? (
          <ProfileSetup user={authUser} profile={profile ?? null} />
        ) : !profile.activeVehicleId ? (
          <VehicleLink profile={profile} />
        ) : !profile.clockedIn ? (
          <ClockInPanel profile={profile} />
        ) : (
          <DriverDashboard profile={profile} />
        )}
      </section>
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
