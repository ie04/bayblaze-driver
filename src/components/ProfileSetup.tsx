import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Camera, Phone, UserRound } from "lucide-react";

import { saveDriverProfile } from "../lib/driverData";
import type { DriverProfile } from "../lib/types";
import { Button, ErrorState, Input, PageHeader, Textarea } from "./ui";

export function ProfileSetup({
  profile,
}: {
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
        firstName,
        lastName,
        phoneNumber,
        bio,
        photoFile,
        existingProfile: profile,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Profile setup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-1 flex-col gap-4" onSubmit={handleSubmit}>
      <PageHeader
        title="Driver profile"
        subtitle="This profile is visible to BayBlaze dispatch."
      />

      <label className="relative flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[24px] border border-dashed border-[var(--bb-blaze)] bg-[var(--bb-surface-warm)] text-center">
        {photoPreview ? (
          <img src={photoPreview} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null}
        <span className="relative z-10 grid size-14 place-items-center rounded-full bg-white text-[var(--bb-charcoal)] shadow-lg">
          <Camera size={25} aria-hidden="true" />
        </span>
        <span className="relative z-10 mt-3 text-sm font-black text-[var(--bb-charcoal)]">
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
        <Input
          icon={<UserRound size={17} aria-hidden="true" />}
          placeholder="First name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          autoComplete="given-name"
          required
        />
        <Input
          icon={<UserRound size={17} aria-hidden="true" />}
          placeholder="Last name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          autoComplete="family-name"
          required
        />
      </div>

      <Input
        icon={<Phone size={17} aria-hidden="true" />}
        placeholder="Phone number"
        value={phoneNumber}
        onChange={(event) => setPhoneNumber(event.target.value)}
        autoComplete="tel"
        type="tel"
        required
      />

      <Textarea
        placeholder="Bio"
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        required
      />

      {error ? (
        <ErrorState>{error}</ErrorState>
      ) : null}

      <Button className="mt-auto" fullWidth loading={loading} type="submit">
        Save profile
      </Button>
    </form>
  );
}
