import crypto from "node:crypto";

export function generateTicketToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}
