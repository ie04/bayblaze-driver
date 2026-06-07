import { randomBytes, randomInt, timingSafeEqual, createHash } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { Resend } from "resend";

initializeApp();

const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();

const CODE_ATTEMPT_LIMIT = 5;
const DEFAULT_TTL_MINUTES = 15;
const FCM_MULTICAST_LIMIT = 500;

export const prepareDriverAccess = onCall<{ email?: unknown }>(async (request) => {
  const email = parseEmail(request.data.email);
  await assertAllowlisted(email);

  if (await authAccountExists(email)) {
    return { mode: "login" as const };
  }

  const code = randomInt(100_000, 1_000_000).toString();
  const salt = randomBytes(16).toString("hex");
  const emailKey = emailToFirestoreKey(email);
  const ttlMinutes = readTtlMinutes();
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + ttlMinutes * 60_000));

  await db.collection("driver_signup_codes").doc(emailKey).set(
    {
      email,
      salt,
      codeHash: hashCode(code, salt),
      attempts: 0,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      usedAt: FieldValue.delete(),
    },
    { merge: true },
  );

  await sendSignupCode(email, code, ttlMinutes);
  return { mode: "code_sent" as const };
});

export const createDriverAccount = onCall<{
  email?: unknown;
  code?: unknown;
  password?: unknown;
}>(async (request) => {
  const email = parseEmail(request.data.email);
  const code = parseCode(request.data.code);
  const password = parsePassword(request.data.password);
  const emailKey = emailToFirestoreKey(email);

  await assertAllowlisted(email);

  if (await authAccountExists(email)) {
    throw new HttpsError("already-exists", "A driver account already exists for this email.");
  }

  const verification = await db.runTransaction(async (transaction) => {
    const codeRef = db.collection("driver_signup_codes").doc(emailKey);
    const codeSnapshot = await transaction.get(codeRef);

    if (!codeSnapshot.exists) {
      return { ok: false as const, code: "missing" as const };
    }

    const record = codeSnapshot.data() as SignupCodeRecord;
    const expiresAtMillis = record.expiresAt?.toMillis?.() ?? 0;

    if (record.usedAt) {
      return { ok: false as const, code: "used" as const };
    }

    if (Date.now() > expiresAtMillis) {
      return { ok: false as const, code: "expired" as const };
    }

    if ((record.attempts ?? 0) >= CODE_ATTEMPT_LIMIT) {
      return { ok: false as const, code: "locked" as const };
    }

    const expectedHash = record.codeHash;
    const nextHash = hashCode(code, record.salt);

    if (!safeEquals(expectedHash, nextHash)) {
      transaction.update(codeRef, {
        attempts: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { ok: false as const, code: "invalid" as const };
    }

    return { ok: true as const };
  });

  if (!verification.ok) {
    throw verificationError(verification.code);
  }

  const user = await auth.createUser({
    email,
    password,
    emailVerified: true,
    disabled: false,
  });

  await Promise.all([
    db.collection("driver_signup_codes").doc(emailKey).set(
      {
        usedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    ),
    db.collection("driver_profiles").doc(user.uid).set(
      {
        uid: user.uid,
        email,
        firstName: "",
        lastName: "",
        phoneNumber: "",
        bio: "",
        onboardingComplete: false,
        clockedIn: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    ),
  ]);

  logger.info("Created BayBlaze driver account", { uid: user.uid, emailKey });
  return { uid: user.uid, email };
});

export const syncDriverDeliveryQueue = onCall(async (request) => {
  const uid = assertAuthenticated(request.auth?.uid);
  const includeUnassigned = await shouldIncludeUnassignedOrders(uid);
  const medusaQueue = await fetchMedusaDriverQueue(uid, { includeUnassigned });
  const scoredQueue = await scoreQueueWithIsoChronos(uid, medusaQueue);

  await writeDriverQueue(uid, scoredQueue);
  return { stopCount: scoredQueue.stops.length };
});

export const scoreDriverDeliveryQueue = onCall(async (request) => {
  const uid = assertAuthenticated(request.auth?.uid);
  const queueSnapshot = await db.collection("driver_delivery_queues").doc(uid).get();

  if (!queueSnapshot.exists) {
    throw new HttpsError("not-found", "No delivery queue is available for this driver.");
  }

  const queue = queueSnapshot.data() as DriverDeliveryQueue;
  const scoredQueue = await scoreQueueWithIsoChronos(uid, queue);

  await writeDriverQueue(uid, scoredQueue);
  return { stopCount: scoredQueue.stops.length };
});

export const handleDeliveryAttemptLog = onDocumentCreated(
  "delivery_attempt_logs/{logId}",
  async (event) => {
    const log = event.data?.data() as DeliveryAttemptLog | undefined;

    if (!log) {
      return;
    }

    if (
      log.type === "out_for_delivery" ||
      log.type === "completed" ||
      log.type === "cancelled"
    ) {
      await notifyMedusaDeliveryAttempt(log);
      if (log.type === "completed" || log.type === "cancelled") {
        await rescoreExistingDriverQueue(log.uid);
      }
    }
  },
);

export const handleDriverLocationSnapshot = onDocumentWritten(
  "driver_location_snapshots/{uid}",
  async (event) => {
    const snapshot = event.data?.after.data() as DriverLocationSnapshot | undefined;

    if (!snapshot) {
      return;
    }

    await notifyIsoChronosLocation(snapshot);
  },
);

export const handleDriverDeliveryQueuePush = onDocumentWritten(
  "driver_delivery_queues/{uid}",
  async (event) => {
    const uid = event.params.uid;
    const beforeQueue = event.data?.before.data() as DriverDeliveryQueue | undefined;
    const afterQueue = event.data?.after.data() as DriverDeliveryQueue | undefined;

    if (!afterQueue) {
      return;
    }

    const previousOrderIds = new Set((beforeQueue?.stops ?? []).map((stop) => stop.orderId));
    const newStops = afterQueue.stops.filter((stop) => !previousOrderIds.has(stop.orderId));

    if (newStops.length === 0) {
      return;
    }

    await sendDriverAssignmentPush(uid, newStops[0]);
  },
);

type DriverDeliveryItem = {
  id: string;
  productId?: string;
  variantId?: string;
  name: string;
  variant: string;
  quantity: number;
  imageUrl: string;
  inventoryLocation: "vehicle" | "warehouse";
};

type DriverDeliveryStop = {
  orderId: string;
  medusaOrderId?: string;
  orderReference?: string;
  customerPhone?: string;
  customerName: string;
  customerAddress: string;
  status: "current" | "locked" | "scored";
  locked: boolean;
  score?: number;
  eta?: string;
  items: DriverDeliveryItem[];
};

type DriverDeliveryQueue = {
  uid: string;
  activeOrderId?: string;
  stops: DriverDeliveryStop[];
};

type DeliveryAttemptLog = {
  uid: string;
  orderId: string;
  type: "warehouse_arrival" | "out_for_delivery" | "customer_arrival" | "id_photo" | "merchant_invoice_photo" | "cancelled" | "completed";
  note?: string | null;
  photoPath?: string | null;
  photoUrl?: string | null;
};

type DriverLocationSnapshot = {
  uid: string;
  vehicleId: string;
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  clockedIn: true;
  source: "driver-pwa";
  clientCapturedAt: number;
};

type DriverNotificationToken = {
  token?: string;
};

type SignupCodeRecord = {
  email: string;
  salt: string;
  codeHash: string;
  attempts?: number;
  expiresAt?: Timestamp;
  usedAt?: Timestamp;
};

function parseEmail(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Email is required.");
  }

  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }

  return email;
}

function verificationError(code: "missing" | "used" | "expired" | "locked" | "invalid") {
  switch (code) {
    case "missing":
      return new HttpsError("failed-precondition", "Request a new verification code.");
    case "used":
      return new HttpsError("failed-precondition", "This verification code has already been used.");
    case "expired":
      return new HttpsError("deadline-exceeded", "This verification code has expired.");
    case "locked":
      return new HttpsError("resource-exhausted", "Request a new verification code.");
    case "invalid":
      return new HttpsError("permission-denied", "Verification code is not valid.");
  }
}

function parseCode(value: unknown) {
  if (typeof value !== "string" || !/^\d{6}$/.test(value.trim())) {
    throw new HttpsError("invalid-argument", "Enter the 6-digit verification code.");
  }

  return value.trim();
}

function parsePassword(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Password is required.");
  }

  if (value.length < 12 || !/[a-z]/i.test(value) || !/\d/.test(value) || !/[^a-z0-9]/i.test(value)) {
    throw new HttpsError(
      "invalid-argument",
      "Password must be at least 12 characters and include letters, numbers, and a symbol.",
    );
  }

  return value;
}

async function assertAllowlisted(email: string) {
  const emailKey = emailToFirestoreKey(email);
  const snapshot = await db.collection("driver_allowlist").doc(emailKey).get();
  const record = snapshot.data();

  if (!snapshot.exists || record?.active !== true) {
    throw new HttpsError(
      "permission-denied",
      "This email has not been approved for BayBlaze driver access.",
    );
  }
}

async function authAccountExists(email: string) {
  try {
    await auth.getUserByEmail(email);
    return true;
  } catch (error) {
    if (isUserNotFound(error)) {
      return false;
    }

    throw error;
  }
}

function isUserNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "auth/user-not-found"
  );
}

async function sendSignupCode(email: string, code: string, ttlMinutes: number) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DRIVER_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new HttpsError("failed-precondition", "Driver email verification is not configured.");
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: email,
    replyTo: process.env.DRIVER_EMAIL_REPLY_TO || undefined,
    subject: "Your BayBlaze driver code",
    text: `Your BayBlaze driver verification code is ${code}. It expires in ${ttlMinutes} minutes.`,
    html: [
      "<div style=\"font-family:Arial,sans-serif;color:#11130f;line-height:1.5\">",
      "<h1 style=\"font-size:22px;margin:0 0 12px\">BayBlaze Driver</h1>",
      "<p>Your verification code is:</p>",
      `<p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:16px 0">${code}</p>`,
      `<p>This code expires in ${ttlMinutes} minutes.</p>`,
      "</div>",
    ].join(""),
  });
}

function hashCode(code: string, salt: string) {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function safeEquals(first: string, second: string) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

function readTtlMinutes() {
  const parsed = Number(process.env.DRIVER_SIGNUP_CODE_TTL_MINUTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MINUTES;
}

function emailToFirestoreKey(email: string) {
  return email.trim().toLowerCase().replace(/[/?#[\]]/g, "_");
}

function assertAuthenticated(uid?: string) {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in before syncing deliveries.");
  }

  return uid;
}

async function writeDriverQueue(uid: string, queue: DriverDeliveryQueue) {
  const data: Record<string, unknown> = {
    ...queue,
    uid,
    stops: removeUndefinedValues(lockQueueHead(queue.stops)),
    updatedAt: FieldValue.serverTimestamp(),
  };

  data.activeOrderId = queue.stops[0]?.orderId ?? FieldValue.delete();

  await db.collection("driver_delivery_queues").doc(uid).set(
    data,
    { merge: true },
  );
}

async function shouldIncludeUnassignedOrders(uid: string) {
  const snapshot = await db.collection("driver_profiles").where("clockedIn", "==", true).get();
  const activeDrivers = snapshot.docs
    .map((driverSnapshot) => {
      const profile = driverSnapshot.data() as Partial<{
        activeVehicleId: unknown;
        onboardingComplete: unknown;
      }>;

      return {
        uid: driverSnapshot.id,
        activeVehicleId: profile.activeVehicleId,
        onboardingComplete: profile.onboardingComplete,
      };
    })
    .filter((profile) =>
      profile.onboardingComplete === true &&
      typeof profile.activeVehicleId === "string" &&
      profile.activeVehicleId.trim(),
    );

  return activeDrivers.length === 1 && activeDrivers[0]?.uid === uid;
}

async function fetchMedusaDriverQueue(
  uid: string,
  { includeUnassigned = false }: { includeUnassigned?: boolean } = {},
): Promise<DriverDeliveryQueue> {
  const baseUrl = process.env.MEDUSA_BACKEND_URL;
  const token = process.env.MEDUSA_ADMIN_API_TOKEN;
  const pathTemplate =
    process.env.MEDUSA_DRIVER_QUEUE_PATH ?? "/admin/bayblaze/driver-queues/{uid}";

  if (!baseUrl || !token) {
    throw new HttpsError("failed-precondition", "Medusa driver queue sync is not configured.");
  }

  const url = new URL(pathTemplate.replace("{uid}", encodeURIComponent(uid)), baseUrl);
  if (includeUnassigned) {
    url.searchParams.set("include_unassigned", "true");
  }

  const response = await fetch(url, {
    headers: buildMedusaServiceHeaders(token, "GET"),
  });

  if (!response.ok) {
    throw medusaSyncError("queue sync", response.status);
  }

  const payload = (await response.json()) as unknown;
  return normalizeDriverQueuePayload(uid, payload);
}

async function scoreQueueWithIsoChronos(
  uid: string,
  queue: DriverDeliveryQueue,
): Promise<DriverDeliveryQueue> {
  const baseUrl = process.env.ISOCHRONOS_API_URL;
  const token = process.env.ISOCHRONOS_ADMIN_TOKEN;
  const path = process.env.ISOCHRONOS_QUEUE_SCORE_PATH ?? "/driver-queues/score";

  if (!baseUrl || !token || queue.stops.length <= 2) {
    return { ...queue, stops: lockQueueHead(queue.stops) };
  }

  const response = await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ uid, queue }),
  });

  if (!response.ok) {
    logger.warn("IsoChronos queue scoring failed", { uid, status: response.status });
    return { ...queue, stops: lockQueueHead(queue.stops) };
  }

  const payload = (await response.json()) as unknown;
  return normalizeDriverQueuePayload(uid, payload);
}

async function rescoreExistingDriverQueue(uid: string) {
  const queueRef = db.collection("driver_delivery_queues").doc(uid);
  const queueSnapshot = await queueRef.get();

  if (!queueSnapshot.exists) {
    return;
  }

  const queue = queueSnapshot.data() as DriverDeliveryQueue;
  const [, nextStop, ...reorderableStops] = queue.stops;

  if (!nextStop) {
    await writeDriverQueue(uid, { uid, stops: [] });
    return;
  }

  const nextQueue: DriverDeliveryQueue = {
    uid,
    stops: [nextStop, ...reorderableStops],
  };
  const scoredQueue = await scoreQueueWithIsoChronos(uid, nextQueue);
  await writeDriverQueue(uid, scoredQueue);
}

async function notifyMedusaDeliveryAttempt(log: DeliveryAttemptLog) {
  const baseUrl = process.env.MEDUSA_BACKEND_URL;
  const token = process.env.MEDUSA_ADMIN_API_TOKEN;
  const path = process.env.MEDUSA_DELIVERY_ATTEMPT_PATH ?? "/admin/bayblaze/delivery-attempts";

  if (!baseUrl || !token) {
    logger.warn("Skipping Medusa delivery attempt update; Medusa env is not configured.", {
      uid: log.uid,
      orderId: log.orderId,
      type: log.type,
    });
    return;
  }

  const response = await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: buildMedusaServiceHeaders(token, "POST"),
    body: JSON.stringify(log),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    logger.error("Medusa delivery attempt update failed", {
      uid: log.uid,
      orderId: log.orderId,
      type: log.type,
      status: response.status,
      responseBody: responseBody.slice(0, 500),
    });
    throw medusaSyncError("delivery attempt update", response.status);
  }
}

function buildMedusaServiceHeaders(token: string, method: "GET" | "POST") {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "x-bayblaze-service-token": token,
  };

  if (method === "GET") {
    headers.accept = "application/json";
  } else {
    headers["content-type"] = "application/json";
  }

  return headers;
}

function medusaSyncError(action: string, status: number) {
  if (status === 401) {
    return new HttpsError(
      "permission-denied",
      "Medusa rejected the driver service token. Confirm the BayBlaze Medusa driver route opts out of default /admin authentication and validates x-bayblaze-service-token.",
    );
  }

  return new HttpsError(
    "unavailable",
    `Medusa ${action} failed with HTTP ${status}.`,
  );
}

async function notifyIsoChronosLocation(snapshot: DriverLocationSnapshot) {
  const baseUrl = process.env.ISOCHRONOS_API_URL;
  const token = process.env.ISOCHRONOS_ADMIN_TOKEN;
  const path = process.env.ISOCHRONOS_DRIVER_LOCATION_PATH ?? "/driver-locations";

  if (!baseUrl || !token) {
    return;
  }

  const response = await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    logger.warn("IsoChronos driver location update failed", {
      uid: snapshot.uid,
      status: response.status,
    });
  }
}

async function sendDriverAssignmentPush(uid: string, stop: DriverDeliveryStop) {
  const tokenSnapshot = await db
    .collection("driver_notification_tokens")
    .doc(uid)
    .collection("tokens")
    .get();
  const tokenDocs = tokenSnapshot.docs
    .map((tokenDoc) => {
      const record = tokenDoc.data() as DriverNotificationToken;
      return {
        id: tokenDoc.id,
        token: record.token,
      };
    })
    .filter((record): record is { id: string; token: string } =>
      typeof record.token === "string" && record.token.trim().length > 0,
    );

  if (tokenDocs.length === 0) {
    logger.info("Skipping driver assignment push; no registered notification tokens.", {
      uid,
      orderId: stop.orderId,
    });
    return;
  }

  const title = `New delivery: ${stop.customerName}`;
  const body = `${stop.eta ? `ETA ${stop.eta}. ` : ""}${stop.customerAddress}`;
  const invalidTokenDocIds: string[] = [];

  for (let index = 0; index < tokenDocs.length; index += FCM_MULTICAST_LIMIT) {
    const batch = tokenDocs.slice(index, index + FCM_MULTICAST_LIMIT);
    const response = await messaging.sendEachForMulticast({
      tokens: batch.map((record) => record.token),
      data: {
        orderId: stop.orderId,
        type: "driver_assignment",
      },
      webpush: {
        headers: {
          TTL: "1800",
          Urgency: "high",
        },
        notification: {
          badge: "/icons/bayblaze-driver-icon-192.png",
          body,
          icon: "/icons/bayblaze-driver-icon-192.png",
          renotify: true,
          requireInteraction: true,
          tag: `bayblaze-delivery-${stop.orderId}`,
          title,
        },
      },
    });

    response.responses.forEach((sendResponse, responseIndex) => {
      if (sendResponse.success) {
        return;
      }

      const code = sendResponse.error?.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        invalidTokenDocIds.push(batch[responseIndex].id);
        return;
      }

      logger.warn("Driver assignment push failed for one token", {
        uid,
        orderId: stop.orderId,
        code,
      });
    });

    logger.info("Sent driver assignment push batch", {
      uid,
      orderId: stop.orderId,
      failureCount: response.failureCount,
      successCount: response.successCount,
    });
  }

  await Promise.all(
    invalidTokenDocIds.map((tokenDocId) =>
      db
        .collection("driver_notification_tokens")
        .doc(uid)
        .collection("tokens")
        .doc(tokenDocId)
        .delete(),
    ),
  );
}

function normalizeDriverQueuePayload(uid: string, payload: unknown): DriverDeliveryQueue {
  const record = asRecord(payload) ?? {};
  const queueRecord = asRecord(record.queue) ?? record;

  const rawStops =
    readArray(queueRecord.stops) ??
    readArray(queueRecord.orders) ??
    readArray(queueRecord.deliveries) ??
    [];

  const stops = rawStops.map((stop, index) => normalizeDeliveryStop(stop, index));

  return {
    uid,
    activeOrderId:
      readOptionalString(queueRecord.activeOrderId, queueRecord.active_order_id) ??
      stops[0]?.orderId,
    stops: lockQueueHead(stops),
  };
}

function normalizeDeliveryStop(value: unknown, index: number): DriverDeliveryStop {
  const record = asRecord(value) ?? {};
  const customer = asRecord(record.customer) ?? {};
  const metadata = asRecord(record.metadata) ?? {};
  const shippingAddress =
    asRecord(record.shipping_address) ??
    asRecord(record.shippingAddress) ??
    asRecord(record.address) ??
    {};

  const rawItems =
    readArray(record.items) ??
    readArray(record.line_items) ??
    readArray(record.lineItems) ??
    readArray(record.order_items) ??
    readArray(metadata.requested_items) ??
    [];

  const orderId = readString(
    record.orderId,
    record.order_id,
    record.custom_display_id,
    record.display_id,
    record.id,
    `order-${index}`,
  );
  const medusaOrderId = readOptionalString(
    record.medusaOrderId,
    record.medusa_order_id,
    record.id,
  );
  const orderReference = readOptionalString(
    record.orderReference,
    record.order_reference,
    record.custom_display_id,
    record.display_id,
    orderId,
  );

  return {
    orderId,
    medusaOrderId,
    orderReference,
    customerPhone: readOptionalString(
      record.customerPhone,
      record.customer_phone,
      record.phone,
      customer.phone,
      shippingAddress.phone,
      metadata.customer_phone,
      metadata.phone,
    ),
    customerName: readString(
      record.customerName,
      record.customer_name,
      customer.name,
      formatCustomerNameFromAddress(shippingAddress),
      record.email,
      customer.email,
      "Customer",
    ),
    customerAddress: readString(
      record.customerAddress,
      record.customer_address,
      record.shippingAddress,
      record.shipping_address,
      formatAddress(shippingAddress),
      metadata.customer_address,
      "",
    ),
    status: index === 0 ? "current" : index === 1 ? "locked" : "scored",
    locked: index < 2,
    score: readNumber(record.score),
    eta: readOptionalString(record.eta, record.delivery_eta, metadata.eta, metadata.delivery_eta),
    items: rawItems.map(normalizeDeliveryItem),
  };
}

function normalizeDeliveryItem(value: unknown, index: number): DriverDeliveryItem {
  const record = asRecord(value) ?? {};
  const metadata = asRecord(record.metadata) ?? {};
  const variant = asRecord(record.variant) ?? {};
  const product = asRecord(record.product) ?? {};
  const thumbnail =
    readString(
      record.imageUrl,
      record.image_url,
      record.thumbnail,
      product.thumbnail,
      variant.thumbnail,
      "",
    );

  return {
    id: readString(record.id, record.lineItemId, record.line_item_id, `item-${index}`),
    productId: readOptionalString(record.productId, record.product_id, product.id),
    variantId: readOptionalString(record.variantId, record.variant_id, variant.id),
    name: readString(
      record.name,
      record.title,
      record.product_title,
      product.title,
      metadata.name,
      "Product",
    ),
    variant: readString(
      record.variant,
      record.variantTitle,
      record.variant_title,
      variant.title,
      metadata.flavor,
      metadata.variant,
      "Default",
    ),
    quantity: readPositiveInteger(record.quantity, metadata.quantity, 1),
    imageUrl: thumbnail,
    inventoryLocation: readInventoryLocation(
      record.inventoryLocation,
      record.inventory_location,
      record.inventoryState,
      record.inventory_state,
      metadata.inventoryLocation,
      metadata.inventory_location,
      metadata.inventoryState,
      metadata.inventory_state,
    ),
  };
}

function formatCustomerNameFromAddress(address: Record<string, unknown>) {
  return [address.first_name, address.last_name]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function formatAddress(address: Record<string, unknown>) {
  const locality = [address.city, address.province, address.state]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");

  const cityLine = [locality, readString(address.postal_code, address.zip)]
    .filter(Boolean)
    .join(" ");

  return [
    address.address_1,
    address.address1,
    address.address_2,
    address.address2,
    cityLine,
    readString(address.country_code, address.country).toUpperCase(),
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

function readInventoryLocation(...values: unknown[]): "vehicle" | "warehouse" {
  const value = readString(...values).toUpperCase();

  if (
    value === "WAREHOUSE" ||
    value === "IN_WAREHOUSE" ||
    value === "WAREHOUSE_PICKUP_REQUIRED"
  ) {
    return "warehouse";
  }

  return "vehicle";
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readPositiveInteger(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return 1;
}

function readString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function readOptionalString(...values: unknown[]) {
  const value = readString(...values);
  return value || undefined;
}

function lockQueueHead(stops: DriverDeliveryStop[]): DriverDeliveryStop[] {
  return stops.map((stop, index) => ({
    ...stop,
    locked: index < 2,
    status: readQueueStatus(index),
  }));
}

function readQueueStatus(index: number): DriverDeliveryStop["status"] {
  if (index === 0) {
    return "current";
  }

  if (index === 1) {
    return "locked";
  }

  return "scored";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function removeUndefinedValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedValues);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, removeUndefinedValues(entryValue)]),
  );
}
