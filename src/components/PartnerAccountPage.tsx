import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  KeyRound,
  LogOut,
  Mail,
  User,
} from "lucide-react";

import {
  clearPartnerAccountSession,
  completePartnerGoogleLogin,
  createPartnerAccount,
  getPartnerAccountSession,
  loginPartnerAccount,
  startPartnerGoogleLogin,
  type PartnerAccountSession,
} from "../lib/accountAccess";
import { validatePassword } from "../lib/password";
import { Button, Card, ErrorState, Input } from "./ui";

type AuthMode = "create" | "signin";

export function PartnerAccountPage() {
  const [mode, setMode] = useState<AuthMode>("create");
  const [session, setSession] = useState<PartnerAccountSession | null>(() =>
    getPartnerAccountSession(),
  );
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(
    () => window.location.pathname === "/auth/google/callback",
  );
  const [error, setError] = useState("");

  const passwordValidation = useMemo(
    () => validatePassword(form.password),
    [form.password],
  );
  const passwordValid = Object.values(passwordValidation).every(Boolean);
  const createDisabled =
    loading ||
    !form.firstName.trim() ||
    !form.lastName.trim() ||
    !form.email.trim() ||
    !passwordValid;

  useEffect(() => {
    if (window.location.pathname !== "/auth/google/callback") {
      return;
    }

    completePartnerGoogleLogin(new URLSearchParams(window.location.search))
      .then((nextSession) => {
        window.history.replaceState({}, "", "/partners");
        setSession(nextSession);
      })
      .catch((caught) => {
        window.history.replaceState({}, "", "/partners");
        setError(getErrorMessage(caught));
      })
      .finally(() => setGoogleLoading(false));
  }, []);

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const nextSession = mode === "create"
        ? await createPartnerAccount(form)
        : await loginPartnerAccount(form.email, form.password);
      setSession(nextSession);
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
      await startPartnerGoogleLogin();
    } catch (caught) {
      setError(getErrorMessage(caught));
      setGoogleLoading(false);
    }
  }

  function handleLogout() {
    clearPartnerAccountSession();
    setSession(null);
  }

  return (
    <main className="h-svh overflow-y-auto bg-[var(--bb-surface-warm)]">
      <section className="mx-auto grid min-h-svh w-full max-w-5xl gap-6 px-5 py-6 md:grid-cols-[0.95fr_1.05fr] md:items-center md:px-8">
        <div className="min-w-0 py-4">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--bb-blaze)]">
            BAYBLAZE PARTNERS
          </p>
          <h1 className="mt-3 max-w-xl text-4xl font-black leading-tight text-[var(--bb-charcoal)] sm:text-5xl">
            Join with your BayBlaze account
          </h1>
          <p className="mt-4 max-w-lg text-base font-semibold leading-7 text-[var(--bb-muted)]">
            Create an account or sign in to connect with BayBlaze partner tools
            as they roll out.
          </p>
          <div className="mt-6 grid gap-3 text-sm font-bold text-[var(--bb-charcoal)]">
            <PartnerPoint>Open account creation</PartnerPoint>
            <PartnerPoint>Google or email sign-in</PartnerPoint>
            <PartnerPoint>No approval queue to get started</PartnerPoint>
          </div>
        </div>

        {session ? (
          <Card
            as="div"
            className="border-white/70 bg-white px-5 py-6 shadow-2xl shadow-black/10"
          >
            <div className="grid size-14 place-items-center rounded-2xl bg-[var(--bb-success)] text-white">
              <BadgeCheck size={28} aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-3xl font-black leading-tight text-[var(--bb-charcoal)]">
              You are signed in
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--bb-muted)]">
              {session.email} is ready for BayBlaze partner access.
            </p>
            <Button className="mt-6" fullWidth onClick={handleLogout} variant="secondary">
              <LogOut size={18} aria-hidden="true" />
              Sign out
            </Button>
          </Card>
        ) : (
          <Card
            as="div"
            className="border-white/70 bg-white px-5 py-6 shadow-2xl shadow-black/10"
          >
            <div className="mb-6 flex rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] p-1">
              <ModeButton active={mode === "create"} onClick={() => setMode("create")}>
                Create account
              </ModeButton>
              <ModeButton active={mode === "signin"} onClick={() => setMode("signin")}>
                Sign in
              </ModeButton>
            </div>

            <div className="mb-6">
              <div className="grid size-14 place-items-center rounded-2xl bg-[var(--bb-blaze)] text-white shadow-[var(--bb-shadow-action)]">
                <BriefcaseBusiness size={28} aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-3xl font-black leading-tight text-[var(--bb-charcoal)]">
                {mode === "create" ? "Create your account" : "Sign in to BayBlaze"}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--bb-muted)]">
                {mode === "create"
                  ? "Use your own name, email, and a secure password."
                  : "Use the BayBlaze account you already have."}
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

            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "create" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    autoComplete="given-name"
                    icon={<User size={18} aria-hidden="true" />}
                    label="First name"
                    onChange={(event) => updateForm("firstName", event.target.value)}
                    required
                    type="text"
                    value={form.firstName}
                  />
                  <Input
                    autoComplete="family-name"
                    icon={<User size={18} aria-hidden="true" />}
                    label="Last name"
                    onChange={(event) => updateForm("lastName", event.target.value)}
                    required
                    type="text"
                    value={form.lastName}
                  />
                </div>
              ) : null}

              <Input
                autoComplete="email"
                icon={<Mail size={18} aria-hidden="true" />}
                label="Email"
                onChange={(event) => updateForm("email", event.target.value)}
                placeholder="name@example.com"
                required
                type="email"
                value={form.email}
              />
              <Input
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                icon={<KeyRound size={18} aria-hidden="true" />}
                label="Password"
                onChange={(event) => updateForm("password", event.target.value)}
                required
                type="password"
                value={form.password}
              />

              {mode === "create" ? (
                <div className="grid gap-2 text-xs font-bold text-[var(--bb-muted)]">
                  <PasswordRule valid={passwordValidation.minLength}>
                    At least 12 characters
                  </PasswordRule>
                  <PasswordRule valid={passwordValidation.lettersAndNumbers}>
                    Letters and numbers
                  </PasswordRule>
                  <PasswordRule valid={passwordValidation.symbol}>
                    At least one symbol
                  </PasswordRule>
                </div>
              ) : null}

              <Button
                disabled={mode === "create" ? createDisabled : loading}
                fullWidth
                loading={loading}
                type="submit"
              >
                {mode === "create" ? "Create account" : "Sign in"}
              </Button>
            </form>

            {error ? <ErrorState className="mt-4">{error}</ErrorState> : null}
          </Card>
        )}
      </section>
    </main>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className={
        active
          ? "min-h-11 flex-1 rounded-xl bg-white px-3 text-sm font-black text-[var(--bb-charcoal)] shadow-[var(--bb-shadow-soft)]"
          : "min-h-11 flex-1 rounded-xl px-3 text-sm font-black text-[var(--bb-muted)]"
      }
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function PartnerPoint({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-[var(--bb-success)] shadow-[var(--bb-shadow-soft)]">
        <Check size={16} aria-hidden="true" />
      </span>
      <span>{children}</span>
    </div>
  );
}

function PasswordRule({ children, valid }: { children: string; valid: boolean }) {
  return (
    <span className={valid ? "text-[var(--bb-success-strong)]" : undefined}>
      {valid ? "✓ " : ""}
      {children}
    </span>
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
