import { publicApiPost, setDriverSession, type DriverSession } from "./driverApi";
import { normalizeEmail } from "./email";

type AccountRole = "admin" | "driver" | "inventory";
type AccountBadge = "customer" | "employee";

type AccountAuthResponse = {
  account: {
    badges: AccountBadge[];
    roles: AccountRole[];
  };
  session: DriverSession;
};

type GoogleOAuthStartResponse = {
  authorizationUrl: string;
};

export async function loginDriver(email: string, password: string) {
  const result = await publicApiPost<AccountAuthResponse>("/v1/auth/login", {
    email: normalizeEmail(email),
    password,
  });
  assertDriverAccount(result.account);
  setDriverSession(result.session);
  return result.session;
}

export async function startDriverGoogleLogin() {
  const result = await publicApiPost<GoogleOAuthStartResponse>("/v1/auth/google/start", {
    callbackUrl: getGoogleCallbackUrl(),
    redirectTo: "/",
  });

  window.location.assign(result.authorizationUrl);
}

export async function completeDriverGoogleLogin(searchParams: URLSearchParams) {
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    throw new Error("Google did not return a complete sign-in response.");
  }

  const result = await publicApiPost<AccountAuthResponse>("/v1/auth/google/callback", {
    callbackUrl: getGoogleCallbackUrl(),
    code,
    state,
  });
  assertDriverAccount(result.account);
  setDriverSession(result.session);
  return result.session;
}

function assertDriverAccount(account: AccountAuthResponse["account"]) {
  if (!account.badges.includes("employee") || !account.roles.includes("driver")) {
    throw new Error("This BayBlaze account does not have driver access.");
  }
}

function getGoogleCallbackUrl() {
  return `${window.location.origin}/auth/google/callback`;
}
