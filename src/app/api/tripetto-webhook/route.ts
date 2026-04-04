import crypto from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { adminSubmissionTemplate } from "@/lib/emailTemplates/adminSubmission";
import { attendeeConfirmationTemplate } from "@/lib/emailTemplates/attendeeConfirmation";
import { extractTripettoFields } from "@/lib/extractTripettoFields";
import { generateRegistrationId } from "@/lib/generateRegistrationId";
import { generateTicketToken } from "@/lib/generateTicketToken";
import { verifyTripettoSignature } from "@/lib/tripettoSignature";

export const runtime = "nodejs";

function getSignatureHeader(request: Request): string | null {
  return request.headers.get("x-tripetto-signature") || request.headers.get("tripetto-signature") || request.headers.get("x-webhook-signature");
}

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length || leftBuffer.length === 0) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hasValidWebhookToken(request: Request, expectedToken: string): boolean {
  const actualToken = new URL(request.url).searchParams.get("token")?.trim();
  if (!actualToken) {
    return false;
  }

  return timingSafeEqualString(actualToken, expectedToken);
}

function logInfo(message: string, details: Record<string, unknown>): void {
  console.info(JSON.stringify({ level: "info", message, timestamp: new Date().toISOString(), ...details }));
}

function logError(message: string, details: Record<string, unknown>): void {
  console.error(JSON.stringify({ level: "error", message, timestamp: new Date().toISOString(), ...details }));
}

function resolveAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function buildTripettoMetadata(payload: unknown): Record<string, unknown> {
  const data = toRecord(payload);
  const nestedData = toRecord(data.data);
  const submission = toRecord(data.submission);

  return {
    event: data.event ?? data.type ?? nestedData.event ?? null,
    formId: data.formId ?? nestedData.formId ?? submission.formId ?? null,
    submissionId: data.submissionId ?? nestedData.submissionId ?? submission.id ?? null,
    receivedAt: new Date().toISOString(),
  };
}

function isLikelyTripettoTemplatePayload(payload: unknown): boolean {
  const root = toRecord(payload);
  const placeholderValues = new Set(["string", "text", "numeric", "number", "boolean", "date", "datetime", "email"]);

  const candidateEntries = Object.entries(root).filter(([key, value]) => {
    if (key.toLowerCase().startsWith("tripetto")) {
      return false;
    }

    return typeof value === "string";
  });

  if (candidateEntries.length === 0) {
    return false;
  }

  const normalizedValues = candidateEntries
    .map(([, value]) => (value as string).trim().toLowerCase())
    .filter((value) => value.length > 0);

  if (normalizedValues.length === 0) {
    return false;
  }

  const placeholderCount = normalizedValues.filter((value) => placeholderValues.has(value)).length;

  const emailEntry = candidateEntries.find(([key]) => key.toLowerCase().includes("email"));
  const emailLooksLikePlaceholder =
    typeof emailEntry?.[1] === "string" && placeholderValues.has(emailEntry[1].trim().toLowerCase());

  return emailLooksLikePlaceholder && placeholderCount >= Math.ceil(normalizedValues.length * 0.5);
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    const webhookToken = process.env.WEBHOOK_TOKEN?.trim();
    if (!webhookToken) {
      return NextResponse.json({ ok: false, error: "Missing WEBHOOK_TOKEN", requestId }, { status: 500 });
    }

    if (!hasValidWebhookToken(request, webhookToken)) {
      logError("Webhook token verification failed", { requestId });
      return NextResponse.json({ ok: false, error: "Invalid webhook token", requestId }, { status: 401 });
    }

    const appBaseUrl = resolveAppBaseUrl();

    const rawBody = await request.text();
    if (!rawBody.trim()) {
      return NextResponse.json({ ok: false, error: "Empty request body", requestId }, { status: 400 });
    }

    const headers = Object.fromEntries(request.headers.entries());
    logInfo("Tripetto webhook payload received", {
      requestId,
      headers,
      rawBody,
    });

    const signatureHeader = getSignatureHeader(request);
    const secret = process.env.TRIPETTO_WEBHOOK_SECRET?.trim();
    if (signatureHeader && secret) {
      const validSignature = verifyTripettoSignature(rawBody, signatureHeader, secret);
      if (!validSignature) {
        logError("Tripetto signature verification failed", { requestId });
        return NextResponse.json({ ok: false, error: "Invalid signature", requestId }, { status: 401 });
      }
    } else {
      logInfo("Tripetto signature verification skipped", {
        requestId,
        reason: signatureHeader ? "missing TRIPETTO_WEBHOOK_SECRET" : "missing signature header",
      });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: false, error: "Malformed JSON payload", requestId }, { status: 400 });
    }

    if (isLikelyTripettoTemplatePayload(payload)) {
      logInfo("Tripetto template payload ignored", {
        requestId,
        reason: "Payload contains placeholder values instead of attendee data",
      });

      return NextResponse.json(
        {
          ok: true,
          requestId,
          ignored: true,
          reason: "Tripetto template/test payload ignored",
        },
        { status: 200 },
      );
    }

    let extracted;
    try {
      extracted = extractTripettoFields(payload);
    } catch (error) {
      if (error instanceof z.ZodError && isLikelyTripettoTemplatePayload(payload)) {
        logInfo("Tripetto template payload ignored after extraction validation", {
          requestId,
          reason: "Validation failed for placeholder payload",
        });

        return NextResponse.json(
          {
            ok: true,
            requestId,
            ignored: true,
            reason: "Tripetto template/test payload ignored",
          },
          { status: 200 },
        );
      }

      throw error;
    }

    const registrationId = generateRegistrationId();
    const ticketToken = generateTicketToken();
    const qrValue = `${appBaseUrl.replace(/\/$/, "")}/staff/check-in?token=${encodeURIComponent(ticketToken)}`;
    const qrCodeImageUrl = `${appBaseUrl.replace(/\/$/, "")}/api/qr/${encodeURIComponent(ticketToken)}`;

    const registration = await db.registration.create({
      data: {
        fullName: extracted.fullName,
        email: extracted.email,
        phone: extracted.phone,
        registrationId,
        ticketToken,
        qrValue,
        tripettoMetadata: buildTripettoMetadata(payload),
        rawPayload: toRecord(payload),
        customFields: extracted.customFields,
      },
    });

    const email = attendeeConfirmationTemplate({
      attendeeName: extracted.fullName,
      registrationId,
      qrCodeImageUrl,
      qrValue,
    });

    let attendeeEmail: { status: "sent" | "failed"; provider: string | null; error: string | null } = {
      status: "sent",
      provider: null,
      error: null,
    };

    try {
      const sent = await sendEmail({
        to: extracted.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      attendeeEmail = {
        status: "sent",
        provider: sent.provider,
        error: null,
      };
    } catch (error) {
      attendeeEmail = {
        status: "failed",
        provider: null,
        error: error instanceof Error ? error.message : "Unknown email error",
      };

      logError("Attendee email send failed", {
        requestId,
        registrationId,
        attendeeEmail: extracted.email,
        error: attendeeEmail.error,
      });
    }

    let adminEmail: { status: "disabled" | "sent" | "failed"; provider: string | null; error: string | null } = {
      status: "disabled",
      provider: null,
      error: null,
    };

    const adminRecipient = process.env.ADMIN_EMAIL?.trim();
    if (adminRecipient) {
      const adminTemplate = adminSubmissionTemplate({
        attendeeName: extracted.fullName,
        attendeeEmail: extracted.email,
        registrationId,
        ticketToken,
        customFields: extracted.customFields,
      });

      try {
        const sent = await sendEmail({
          to: adminRecipient,
          subject: adminTemplate.subject,
          html: adminTemplate.html,
          text: adminTemplate.text,
        });

        adminEmail = {
          status: "sent",
          provider: sent.provider,
          error: null,
        };
      } catch (error) {
        adminEmail = {
          status: "failed",
          provider: null,
          error: error instanceof Error ? error.message : "Unknown email error",
        };

        logError("Admin email send failed", {
          requestId,
          registrationId,
          adminEmail: adminRecipient,
          error: adminEmail.error,
        });
      }
    }

    logInfo("Tripetto registration created", {
      requestId,
      registrationId,
      attendeeEmail: extracted.email,
      attendeeEmailDelivery: attendeeEmail,
      adminEmailDelivery: adminEmail,
    });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        registration: {
          id: registration.id,
          registrationId: registration.registrationId,
          checkInStatus: registration.checkInStatus,
          createdAt: registration.createdAt,
        },
        emails: {
          attendee: attendeeEmail,
          admin: adminEmail,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      logError("Tripetto payload validation failed", { requestId, issues: error.flatten() });
      return NextResponse.json({ ok: false, error: "Payload validation failed", requestId, issues: error.flatten() }, { status: 422 });
    }

    const message = error instanceof Error ? error.message : "Unhandled webhook error";
    logError("Tripetto webhook failed", { requestId, message });
    return NextResponse.json({ ok: false, error: "Internal server error", requestId }, { status: 500 });
  }
}
