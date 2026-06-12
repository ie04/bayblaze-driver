import { httpsCallable } from "firebase/functions";

import { functions } from "./firebase";
import { normalizeEmail } from "./email";
import type { DriverSignupMode } from "./types";

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
