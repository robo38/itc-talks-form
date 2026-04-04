import crypto from "node:crypto";

function parseSignature(signatureHeader: string): { timestamp?: string; signatures: string[] } {
  const signatures: string[] = [];
  let timestamp: string | undefined;

  for (const part of signatureHeader.split(",")) {
    const [k, v] = part.split("=").map((segment) => segment?.trim());
    if (!k || !v) {
      continue;
    }

    if (k === "t") {
      timestamp = v;
      continue;
    }

    if (k === "v1") {
      signatures.push(v);
      continue;
    }

    if (k === "sha256") {
      signatures.push(v);
      continue;
    }

    signatures.push(part.replace(/^sha256=/, "").trim());
  }

  return { timestamp, signatures: signatures.filter(Boolean) };
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");

  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function digest(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyTripettoSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const parsed = parseSignature(signatureHeader);
  const normalizedSignatures = parsed.signatures.length > 0 ? parsed.signatures : [signatureHeader.replace(/^sha256=/, "")];

  const expectedBodyOnly = digest(secret, rawBody);
  const expectedTimestamped = parsed.timestamp ? digest(secret, `${parsed.timestamp}.${rawBody}`) : null;

  return normalizedSignatures.some((candidate) => {
    const normalized = candidate.replace(/^sha256=/, "").trim();
    return safeEqualHex(normalized, expectedBodyOnly) || (expectedTimestamped ? safeEqualHex(normalized, expectedTimestamped) : false);
  });
}
