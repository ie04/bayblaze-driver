import { type FormEvent, useMemo, useState } from "react";
import { Check, KeyRound, Mail, ShieldCheck } from "lucide-react";

import { Button, Card, ErrorState, Input, InlineNotice } from "./ui";
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
    <Card
      as="div"
      className="flex w-full flex-col justify-center border-white/70 bg-white/90 px-5 py-6 shadow-2xl shadow-black/20 backdrop-blur-sm"
    >
      <div className="mb-7">
        <div className="grid size-14 place-items-center rounded-2xl bg-[var(--bb-blaze)] text-white shadow-[var(--bb-shadow-action)]">
          <ShieldCheck size={28} aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-3xl font-black leading-tight text-[var(--bb-charcoal)]">
          Sign In
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--bb-muted)]">
          Use your approved BayBlaze driver email.
        </p>
      </div>

      {step === "email" ? (
        <form className="space-y-4" onSubmit={handleEmailSubmit}>
          <Input
            icon={<Mail size={18} aria-hidden="true" />}
            type="email"
            autoComplete="email"
            placeholder="driver@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Button fullWidth loading={loading} type="submit">
            Continue
          </Button>
        </form>
      ) : null}

      {step === "login" ? (
        <form className="space-y-4" onSubmit={handleLoginSubmit}>
          <ReadOnlyEmail email={email} onChange={() => setStep("email")} />
          <Input
            icon={<KeyRound size={18} aria-hidden="true" />}
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button fullWidth loading={loading} type="submit">
            Sign in
          </Button>
        </form>
      ) : null}

      {step === "signup" ? (
        <form className="space-y-4" onSubmit={handleSignupSubmit}>
          <ReadOnlyEmail email={email} onChange={() => setStep("email")} />
          <Input
            icon={<KeyRound size={18} aria-hidden="true" />}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Verification code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
          <Input
            icon={<KeyRound size={18} aria-hidden="true" />}
            type="password"
            autoComplete="new-password"
            placeholder="Create password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <Input
            icon={<KeyRound size={18} aria-hidden="true" />}
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <PasswordChecklist
            minLength={passwordState.minLength}
            lettersAndNumbers={passwordState.lettersAndNumbers}
            symbol={passwordState.symbol}
            matches={newPassword.length > 0 && newPassword === confirmPassword}
          />
          <Button fullWidth loading={loading} type="submit">
            Create account
          </Button>
        </form>
      ) : null}

      {message ? (
        <InlineNotice className="mt-4" tone="success">
          {message}
        </InlineNotice>
      ) : null}

      {error ? (
        <ErrorState className="mt-4">{error}</ErrorState>
      ) : null}
    </Card>
  );
}

function ReadOnlyEmail({ email, onChange }: { email: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--bb-line)] bg-[var(--bb-surface-warm)] px-4 py-3">
      <span className="min-w-0 truncate text-sm font-black text-[var(--bb-charcoal)]">
        {email}
      </span>
      <button
        type="button"
        className="shrink-0 text-sm font-black text-[var(--bb-charcoal)]"
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
              ? "border-[var(--bb-success-soft)] bg-[var(--bb-success-soft)] text-[var(--bb-success-strong)]"
              : "border-[var(--bb-line)] bg-[var(--bb-neutral-soft)] text-[var(--bb-muted)]"
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace("Firebase: ", "").replace(/\s*\(.*\)\.?$/, ".");
  }

  return "Something went wrong. Try again.";
}
