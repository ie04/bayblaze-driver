import { auth } from "./firebase";

const apiBaseUrl = (import.meta.env.VITE_BAYBLAZE_API_URL as string | undefined)?.replace(/\/$/, "");

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

async function driverApiRequest<T>(
  path: string,
  options: {
    body?: unknown;
    method?: "GET" | "POST" | "PUT" | "DELETE";
  } = {},
) {
  if (!apiBaseUrl) {
    throw new Error("BayBlaze API URL is not configured.");
  }

  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Sign in before using the driver API.");
  }

  const response = await fetch(new URL(path, apiBaseUrl), {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
    },
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
