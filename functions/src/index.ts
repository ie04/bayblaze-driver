import { randomBytes, randomInt, timingSafeEqual, createHash } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { Resend } from "resend";

initializeApp();

const db = getFirestore();
const auth = getAuth();

const CODE_ATTEMPT_LIMIT = 5;
const DEFAULT_TTL_MINUTES = 15;

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
