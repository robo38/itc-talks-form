import crypto from "node:crypto";

export function generateRegistrationId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const entropy = crypto.randomBytes(4).toString("hex").toUpperCase();

  return `REG-${stamp}-${entropy}`;
}
