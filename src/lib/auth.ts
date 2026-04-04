import crypto from "node:crypto";

import { cookies } from "next/headers";

export const STAFF_SESSION_COOKIE = "staff_session";

interface StaffSessionPayload {
  username: string;
  exp: number;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getAuthSecret(): string {
  return requiredEnv("STAFF_AUTH_SECRET");
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function encodePayload(payload: StaffSessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(value: string): StaffSessionPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as StaffSessionPayload;
    if (typeof parsed.username !== "string" || typeof parsed.exp !== "number") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function createStaffSessionToken(username: string): string {
  const ttlHours = Number(process.env.STAFF_SESSION_TTL_HOURS ?? "12");
  const exp = Date.now() + ttlHours * 60 * 60 * 1000;

  const payload: StaffSessionPayload = {
    username,
    exp,
  };

  const encodedPayload = encodePayload(payload);
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyStaffSessionToken(token: string | undefined): StaffSessionPayload | null {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  const isValid =
    Buffer.byteLength(signature) === Buffer.byteLength(expected) &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!isValid) {
    return null;
  }

  const parsed = decodePayload(payload);
  if (!parsed) {
    return null;
  }

  if (Date.now() > parsed.exp) {
    return null;
  }

  return parsed;
}

export async function getCurrentStaffUser(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;

  const session = verifyStaffSessionToken(token);
  return session?.username ?? null;
}

export function verifyStaffPassword(password: string): boolean {
  const expectedPassword = requiredEnv("STAFF_LOGIN_PASSWORD");

  const providedBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expectedPassword);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export function getDefaultStaffUsername(): string {
  return process.env.STAFF_LOGIN_USERNAME?.trim() || "event-staff";
}
