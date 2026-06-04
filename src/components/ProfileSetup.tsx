import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { Camera, Loader2, Phone, UserRound } from "lucide-react";

import { saveDriverProfile } from "../lib/driverData";
import type { DriverProfile } from "../lib/types";

export function ProfileSetup({
  user,
  profile,
}: {
  user: User;
  profile: DriverProfile | null;
}) {
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const photoPreview = useMemo(() => {
    if (!photoFile) {
      return profile?.profilePhotoUrl ?? "";
    }

    return URL.createObjectURL(photoFile);
  }, [photoFile, profile?.profilePhotoUrl]);

  useEffect(() => {
    if (!photoFile || !photoPreview.startsWith("blob:")) {
      return;
    }

    return () => URL.revokeObjectURL(photoPreview);
  }, [photoFile, photoPreview]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!photoFile && !profile?.profilePhotoUrl) {
      setError("Add a profile photo before continuing.");
      return;
    }

    setLoading(true);
    try {
      await saveDriverProfile({
        user,
        firstName,
        lastName,
        phoneNumber,
        bio,
        photoFile,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Profile setup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-1 flex-col gap-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-3xl font-black leading-tight text-[var(--bayblaze-ink)]">
          Driver profile
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--bayblaze-muted)]">
          This profile is visible to BayBlaze dispatch.
        </p>
      </div>

      <label className="relative flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[24px] border border-dashed border-[var(--bayblaze-green)] bg-[var(--bayblaze-cream)] text-center">
        {photoPreview ? (
          <img src={photoPreview} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null}
        <span className="relative z-10 grid size-14 place-items-center rounded-full bg-white text-[var(--bayblaze-green-dark)] shadow-lg">
          <Camera size={25} aria-hidden="true" />
        </span>
        <span className="relative z-10 mt-3 text-sm font-black text-[var(--bayblaze-green-dark)]">
          Profile photo
        </span>
        <input
          className="sr-only"
          type="file"
          accept="image/*"
          capture="user"
          onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
          required={!profile?.profilePhotoUrl}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <TextInput
          icon={<UserRound size={17} aria-hidden="true" />}
          placeholder="First name"
          value={firstName}
          onChange={setFirstName}
          autoComplete="given-name"
        />
        <TextInput
          icon={<UserRound size={17} aria-hidden="true" />}
          placeholder="Last name"
          value={lastName}
          onChange={setLastName}
          autoComplete="family-name"
        />
      </div>

      <TextInput
        icon={<Phone size={17} aria-hidden="true" />}
        placeholder="Phone number"
        value={phoneNumber}
        onChange={setPhoneNumber}
        autoComplete="tel"
        type="tel"
      />

      <textarea
        className="min-h-32 resize-none rounded-2xl border border-[var(--bayblaze-line)] bg-white px-4 py-3 text-base font-semibold text-[var(--bayblaze-ink)] outline-none placeholder:text-slate-400 focus:border-[var(--bayblaze-green)]"
        placeholder="Bio"
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        required
      />

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="mt-auto flex h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--bayblaze-green)] px-5 text-base font-black text-white shadow-lg shadow-green-900/15 transition hover:bg-[var(--bayblaze-green-dark)] disabled:opacity-60"
        disabled={loading}
      >
        {loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
        Save profile
      </button>
    </form>
  );
}

function TextInput({
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  icon: ReactNode;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-[var(--bayblaze-line)] bg-white px-3 focus-within:border-[var(--bayblaze-green)]">
      <span className="shrink-0 text-[var(--bayblaze-green-dark)]">{icon}</span>
      <input
        className="min-w-0 flex-1 bg-transparent py-3 text-base font-semibold text-[var(--bayblaze-ink)] outline-none placeholder:text-slate-400"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
      />
    </label>
  );
}
