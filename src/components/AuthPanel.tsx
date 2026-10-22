import { type FormEvent, useEffect, useState } from "react";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";

import { Button, Card, ErrorState } from "./ui";
import {
  completeDriverGoogleLogin,
  loginDriver,
  startDriverGoogleLogin,
} from "../lib/driverAccess";
import type { DriverSession } from "../lib/driverApi";

type AuthPanelProps = {
  onAuthenticated: (session: DriverSession) => void;
};

export function AuthPanel({ onAuthenticated }: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(() => window.location.pathname === "/auth/google/callback");
  const [error, setError] = useState("");

  useEffect(() => {
    if (window.location.pathname !== "/auth/google/callback") {
      return;
    }

    completeDriverGoogleLogin(new URLSearchParams(window.location.search))
      .then((session) => {
        window.history.replaceState({}, "", "/");
        onAuthenticated(session);
      })
      .catch((caught) => {
        window.history.replaceState({}, "", "/");
        setError(getErrorMessage(caught));
      })
      .finally(() => setGoogleLoading(false));
  }, [onAuthenticated]);

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      onAuthenticated(await loginDriver(email, password));
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError("");

    try {
      await startDriverGoogleLogin();
    } catch (caught) {
      setError(getErrorMessage(caught));
      setGoogleLoading(false);
    }
  }

  return (
    <Card
      as="div"
      className="flex w-full flex-col justify-center border-white/70 bg-white/90 px-5 py-6 shadow-2xl shadow-black/20 backdrop-blur-sm"
    >
      <div className="mb-7">
        <div className="grid size-14 place-items-center rounded-2xl bg-[var(--bb-blaze)] text-white shadow-[var(--bb-shadow-action)]">
          <ShieldCheck size={28} aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-3xl font-black leading-tight text-[var(--bb-charcoal)]">
          Driver Sign In
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--bb-muted)]">
          Use a BayBlaze account with the driver role.
        </p>
      </div>

      <Button
        fullWidth
        loading={googleLoading}
        onClick={() => void handleGoogleLogin()}
        type="button"
        variant="secondary"
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <div className="my-5 flex items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--bb-muted)]">
        <span className="h-px flex-1 bg-[var(--bb-line)]" />
        <span>Email</span>
        <span className="h-px flex-1 bg-[var(--bb-line)]" />
      </div>

      <form className="space-y-4" onSubmit={handleLoginSubmit}>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase text-[var(--bb-muted)]">
            Email
          </span>
          <span className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--bb-line)] bg-white px-4 shadow-[var(--bb-shadow-soft)] focus-within:border-[var(--bb-blaze)]">
            <Mail size={18} aria-hidden="true" />
            <input
              autoComplete="email"
              className="min-w-0 flex-1 bg-transparent py-3 text-base font-semibold outline-none"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="driver@example.com"
              required
              type="email"
              value={email}
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase text-[var(--bb-muted)]">
            Password
          </span>
          <span className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--bb-line)] bg-white px-4 shadow-[var(--bb-shadow-soft)] focus-within:border-[var(--bb-blaze)]">
            <KeyRound size={18} aria-hidden="true" />
            <input
              autoComplete="current-password"
              className="min-w-0 flex-1 bg-transparent py-3 text-base font-semibold outline-none"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              required
              type="password"
              value={password}
            />
          </span>
        </label>
        <Button fullWidth loading={loading} type="submit">
          Sign in
        </Button>
      </form>

      {error ? (
        <ErrorState className="mt-4">{error}</ErrorState>
      ) : null}
    </Card>
  );
}

function GoogleIcon() {
  return (
    <span
      aria-hidden="true"
      className="grid size-5 place-items-center rounded-full border border-[var(--bb-line)] bg-white text-xs font-black text-[var(--bb-charcoal)]"
    >
      G
    </span>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace(/\s*\(.*\)\.?$/, ".");
  }

  return "Something went wrong. Try again.";
}
