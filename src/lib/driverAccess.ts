import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";

import { db, functions } from "./firebase";
import { emailToFirestoreKey, normalizeEmail } from "./email";
import type { DriverAllowlistRecord, DriverSignupMode } from "./types";

type PrepareDriverAccessResponse = {
  mode: DriverSignupMode;
};

type CreateDriverAccountResponse = {
  uid: string;
  email: string;
};

const prepareDriverAccess = httpsCallable<
  { email: string },
  PrepareDriverAccessResponse
>(functions, "prepareDriverAccess");

const createDriverAccount = httpsCallable<
  { email: string; code: string; password: string },
  CreateDriverAccountResponse
>(functions, "createDriverAccount");

export async function getAllowlistStatus(email: string) {
  const emailKey = emailToFirestoreKey(email);
  const snapshot = await getDoc(doc(db, "driver_allowlist", emailKey));

  if (!snapshot.exists()) {
    return { allowed: false, record: null as DriverAllowlistRecord | null };
  }

  const record = snapshot.data() as DriverAllowlistRecord;
  return {
    allowed: record.active === true,
    record,
  };
}

export async function requestDriverAccess(email: string) {
  const result = await prepareDriverAccess({ email: normalizeEmail(email) });
  return result.data.mode;
}

export async function createAllowedDriverAccount(
  email: string,
  code: string,
  password: string,
) {
  const result = await createDriverAccount({
    email: normalizeEmail(email),
    code: code.trim(),
    password,
  });
  return result.data;
}
