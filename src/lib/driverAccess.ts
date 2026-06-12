import { publicApiPost, setDriverSession, type DriverSession } from "./driverApi";
import { normalizeEmail } from "./email";
import type { DriverSignupMode } from "./types";

type PrepareDriverAccessResponse = {
  mode: DriverSignupMode;
};

type DriverAuthResponse = {
  session: DriverSession;
};

export async function requestDriverAccess(email: string) {
  const result = await publicApiPost<PrepareDriverAccessResponse>("/v1/driver/auth/access", {
    email: normalizeEmail(email),
  });
  return result.mode;
}

export async function createAllowedDriverAccount(
  email: string,
  code: string,
  password: string,
) {
  const result = await publicApiPost<DriverAuthResponse>("/v1/driver/auth/accounts", {
    email: normalizeEmail(email),
    code: code.trim(),
    password,
  });
  setDriverSession(result.session);
  return result.session;
}

export async function loginDriver(email: string, password: string) {
  const result = await publicApiPost<DriverAuthResponse>("/v1/driver/auth/login", {
    email: normalizeEmail(email),
    password,
  });
  setDriverSession(result.session);
  return result.session;
}
