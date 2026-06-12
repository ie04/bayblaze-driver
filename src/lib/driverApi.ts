export type DriverSession = {
  email: string;
  token: string;
  uid: string;
};

const apiBaseUrl = (import.meta.env.VITE_BAYBLAZE_API_URL as string | undefined)?.replace(/\/$/, "");
const sessionStorageKey = "bayblaze-driver-session";

let currentSession = readStoredSession();

export function getDriverSession() {
  return currentSession;
}

export function setDriverSession(session: DriverSession) {
  currentSession = session;
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

export function clearDriverSession() {
  currentSession = null;
  window.localStorage.removeItem(sessionStorageKey);
}

export async function driverApiGet<T>(path: string) {
  return driverApiRequest<T>(path);
}

export async function driverApiPost<T>(path: string, body?: unknown) {
  return driverApiRequest<T>(path, {
    body,
    method: "POST",
  });
}

export async function driverApiPut<T>(path: string, body?: unknown) {
  return driverApiRequest<T>(path, {
    body,
    method: "PUT",
  });
}

export async function driverApiDelete<T>(path: string) {
  return driverApiRequest<T>(path, {
    method: "DELETE",
  });
}

export async function driverApiUpload<T>(path: string, formData: FormData) {
  return driverApiRequest<T>(path, {
    body: formData,
    method: "POST",
  });
}

export async function publicApiPost<T>(path: string, body?: unknown) {
  return apiRequest<T>(path, {
    body,
    method: "POST",
    sessionRequired: false,
  });
}

async function driverApiRequest<T>(
  path: string,
  options: {
    body?: FormData | unknown;
    method?: "GET" | "POST" | "PUT" | "DELETE";
  } = {},
) {
  return apiRequest<T>(path, {
    ...options,
    sessionRequired: true,
  });
}

async function apiRequest<T>(
  path: string,
  options: {
    body?: FormData | unknown;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    sessionRequired: boolean;
  },
) {
  if (!apiBaseUrl) {
    throw new Error("BayBlaze API URL is not configured.");
  }

  const headers: Record<string, string> = {};
  const body = options.body instanceof FormData
    ? options.body
    : options.body === undefined
      ? undefined
      : JSON.stringify(options.body);

  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  if (options.sessionRequired) {
    const token = currentSession?.token;
    if (!token) {
      throw new Error("Sign in before using the driver API.");
    }

    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(new URL(path, apiBaseUrl), {
    body,
    headers,
    method: options.method ?? "GET",
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(
      typeof payload.message === "string"
        ? payload.message
        : `BayBlaze API request failed with HTTP ${response.status}.`,
    );
  }

  return payload as T;
}

function readStoredSession() {
  try {
    const raw = window.localStorage.getItem(sessionStorageKey);
    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw) as Partial<DriverSession>;
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
