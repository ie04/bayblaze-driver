import { publicApiPost, type DriverSession } from "./driverApi";
import { normalizeEmail } from "./email";

type AccountRole = "admin" | "driver" | "inventory";

type AccountAuthResponse = {
  account: {
    roles: AccountRole[];
  };
  commerce?: unknown;
  redirectTo?: string;
  session: DriverSession;
};

type GoogleOAuthStartResponse = {
  authorizationUrl: string;
};

const partnerSessionStorageKey = "bayblaze-partner-account-session";
const googleIntentStorageKey = "bayblaze-google-auth-intent";

export type PartnerAccountSession = DriverSession;

export function isPartnerGoogleCallback() {
  return (
    window.location.pathname === "/auth/google/callback" &&
    window.sessionStorage.getItem(googleIntentStorageKey) === "partners"
  );
}

export function getPartnerAccountSession() {
  return readStoredSession();
}

export function clearPartnerAccountSession() {
  window.localStorage.removeItem(partnerSessionStorageKey);
}

export async function loginPartnerAccount(email: string, password: string) {
  const result = await publicApiPost<AccountAuthResponse>("/v1/customer/auth/login", {
    email: normalizeEmail(email),
    password,
  });

  return storePartnerSession(result.session);
}

export async function createPartnerAccount(input: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}) {
  const result = await publicApiPost<AccountAuthResponse>("/v1/customer/auth/accounts", {
    email: normalizeEmail(input.email),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    metadata: {
      source: "driver-partners-page",
    },
    password: input.password,
  });

  return storePartnerSession(result.session);
}

export async function startPartnerGoogleLogin() {
  window.sessionStorage.setItem(googleIntentStorageKey, "partners");
  const result = await publicApiPost<GoogleOAuthStartResponse>("/v1/auth/google/start", {
    callbackUrl: getGoogleCallbackUrl(),
    commerce: "storefront",
    redirectTo: "/partners",
  });

  window.location.assign(result.authorizationUrl);
}

export async function completePartnerGoogleLogin(searchParams: URLSearchParams) {
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

  window.sessionStorage.removeItem(googleIntentStorageKey);
  return storePartnerSession(result.session);
}

function storePartnerSession(session: DriverSession) {
  window.localStorage.setItem(partnerSessionStorageKey, JSON.stringify(session));
  return session;
}

function readStoredSession() {
  try {
    const raw = window.localStorage.getItem(partnerSessionStorageKey);
    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw) as Partial<PartnerAccountSession>;
    return session.email && session.token && session.uid
      ? {
          email: session.email,
          token: session.token,
          uid: session.uid,
        }
      : null;
  } catch {
    return null;
  }
}

function getGoogleCallbackUrl() {
  return `${window.location.origin}/auth/google/callback`;
}
