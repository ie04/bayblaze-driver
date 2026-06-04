import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { Check, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";

import { createAllowedDriverAccount, getAllowlistStatus, requestDriverAccess } from "../lib/driverAccess";
import { normalizeEmail } from "../lib/email";
import { isValidPassword, validatePassword } from "../lib/password";

type AuthPanelProps = {
  onLogin: (email: string, password: string) => Promise<void>;
};

type Step = "email" | "login" | "signup";

export function AuthPanel({ onLogin }: AuthPanelProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const passwordState = useMemo(() => validatePassword(newPassword), [newPassword]);
  const passwordReady = isValidPassword(newPassword) && newPassword === confirmPassword;

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const nextEmail = normalizeEmail(email);
      const allowlist = await getAllowlistStatus(nextEmail);

      if (!allowlist.allowed) {
        setError("This email has not been approved for BayBlaze driver access.");
        return;
      }

      const mode = await requestDriverAccess(nextEmail);
      setEmail(nextEmail);

      if (mode === "login") {
        setStep("login");
        setMessage("Driver access confirmed.");
      } else {
        setStep("signup");
        setMessage("Verification code sent.");
      }
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await onLogin(email, password);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!passwordReady) {
      setError("Finish the password requirements before creating your account.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createAllowedDriverAccount(email, code, newPassword);
      await onLogin(email, newPassword);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center py-4">
      <div className="mb-7">
        <div className="grid size-14 place-items-center rounded-2xl bg-[var(--bayblaze-green)] text-white shadow-lg shadow-green-900/15">
          <ShieldCheck size={28} aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-3xl font-black leading-tight text-[var(--bayblaze-ink)]">
          Driver access
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--bayblaze-muted)]">
          Use your approved BayBlaze driver email.
        </p>
      </div>

      {step === "email" ? (
        <form className="space-y-4" onSubmit={handleEmailSubmit}>
          <FieldShell icon={<Mail size={18} aria-hidden="true" />}>
            <input
              className="w-full bg-transparent py-3 text-base font-semibold text-[var(--bayblaze-ink)] outline-none placeholder:text-slate-400"
              type="email"
              autoComplete="email"
              placeholder="driver@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </FieldShell>
          <PrimaryButton loading={loading}>Continue</PrimaryButton>
        </form>
      ) : null}

      {step === "login" ? (
        <form className="space-y-4" onSubmit={handleLoginSubmit}>
          <ReadOnlyEmail email={email} onChange={() => setStep("email")} />
          <FieldShell icon={<KeyRound size={18} aria-hidden="true" />}>
            <input
              className="w-full bg-transparent py-3 text-base font-semibold text-[var(--bayblaze-ink)] outline-none placeholder:text-slate-400"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </FieldShell>
          <PrimaryButton loading={loading}>Sign in</PrimaryButton>
        </form>
      ) : null}

      {step === "signup" ? (
        <form className="space-y-4" onSubmit={handleSignupSubmit}>
          <ReadOnlyEmail email={email} onChange={() => setStep("email")} />
          <FieldShell icon={<KeyRound size={18} aria-hidden="true" />}>
            <input
              className="w-full bg-transparent py-3 text-base font-semibold text-[var(--bayblaze-ink)] outline-none placeholder:text-slate-400"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Verification code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </FieldShell>
          <FieldShell icon={<KeyRound size={18} aria-hidden="true" />}>
            <input
              className="w-full bg-transparent py-3 text-base font-semibold text-[var(--bayblaze-ink)] outline-none placeholder:text-slate-400"
              type="password"
              autoComplete="new-password"
              placeholder="Create password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </FieldShell>
          <FieldShell icon={<KeyRound size={18} aria-hidden="true" />}>
            <input
              className="w-full bg-transparent py-3 text-base font-semibold text-[var(--bayblaze-ink)] outline-none placeholder:text-slate-400"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </FieldShell>
          <PasswordChecklist
            minLength={passwordState.minLength}
            lettersAndNumbers={passwordState.lettersAndNumbers}
            symbol={passwordState.symbol}
            matches={newPassword.length > 0 && newPassword === confirmPassword}
          />
          <PrimaryButton loading={loading}>Create account</PrimaryButton>
        </form>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-[var(--bayblaze-green-dark)]">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FieldShell({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-[var(--bayblaze-line)] bg-white px-4 shadow-sm focus-within:border-[var(--bayblaze-green)]">
      <span className="text-[var(--bayblaze-green-dark)]">{icon}</span>
      {children}
    </label>
  );
}

function ReadOnlyEmail({ email, onChange }: { email: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--bayblaze-line)] bg-[var(--bayblaze-cream)] px-4 py-3">
      <span className="min-w-0 truncate text-sm font-black text-[var(--bayblaze-ink)]">
        {email}
      </span>
      <button
        type="button"
        className="shrink-0 text-sm font-black text-[var(--bayblaze-green-dark)]"
        onClick={onChange}
      >
        Change
      </button>
    </div>
  );
}

function PasswordChecklist({
  minLength,
  lettersAndNumbers,
  symbol,
  matches,
}: {
  minLength: boolean;
  lettersAndNumbers: boolean;
  symbol: boolean;
  matches: boolean;
}) {
  const items = [
    ["12 characters", minLength],
    ["Letters and numbers", lettersAndNumbers],
    ["1 symbol", symbol],
    ["Passwords match", matches],
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([label, checked]) => (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${
            checked
              ? "border-green-200 bg-green-50 text-[var(--bayblaze-green-dark)]"
              : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
          key={label}
        >
          <Check size={14} aria-hidden="true" />
          {label}
        </div>
      ))}
    </div>
  );
}

function PrimaryButton({
  children,
  loading,
}: {
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      type="submit"
      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bayblaze-green)] px-5 text-base font-black text-white shadow-lg shadow-green-900/15 transition hover:bg-[var(--bayblaze-green-dark)] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={loading}
    >
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace("Firebase: ", "").replace(/\s*\(.*\)\.?$/, ".");
  }

  return "Something went wrong. Try again.";
}
