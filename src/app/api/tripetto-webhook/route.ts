import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendEmailWithFallback } from "@/lib/email";
import { attendeeConfirmationTemplate } from "@/lib/emailTemplates/attendeeConfirmation";
import { extractTripettoFields } from "@/lib/extractTripettoFields";
import { generateQrCodeDataUrl } from "@/lib/generateQrCode";
import { generateRegistrationId } from "@/lib/generateRegistrationId";
import { generateTicketToken } from "@/lib/generateTicketToken";
import { verifyTripettoSignature } from "@/lib/tripettoSignature";

export const runtime = "nodejs";

function getSignatureHeader(request: Request): string | null {
  return request.headers.get("x-tripetto-signature") || request.headers.get("tripetto-signature") || request.headers.get("x-webhook-signature");
}

function logInfo(message: string, details: Record<string, unknown>): void {
  console.info(JSON.stringify({ level: "info", message, timestamp: new Date().toISOString(), ...details }));
}

function logError(message: string, details: Record<string, unknown>): void {
  console.error(JSON.stringify({ level: "error", message, timestamp: new Date().toISOString(), ...details }));
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    const secret = process.env.TRIPETTO_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Missing TRIPETTO_WEBHOOK_SECRET", requestId }, { status: 500 });
    }

    const appBaseUrl = process.env.APP_BASE_URL?.trim();
    if (!appBaseUrl) {
      return NextResponse.json({ ok: false, error: "Missing APP_BASE_URL", requestId }, { status: 500 });
    }

    const rawBody = await request.text();
    if (!rawBody.trim()) {
      return NextResponse.json({ ok: false, error: "Empty request body", requestId }, { status: 400 });
    }

    const signatureHeader = getSignatureHeader(request);
    const validSignature = verifyTripettoSignature(rawBody, signatureHeader, secret);

    if (!validSignature) {
      logError("Tripetto signature verification failed", { requestId });
      return NextResponse.json({ ok: false, error: "Invalid signature", requestId }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: false, error: "Malformed JSON payload", requestId }, { status: 400 });
    }

    const extracted = extractTripettoFields(payload);

    const registrationId = generateRegistrationId();
    const ticketToken = generateTicketToken();
    const qrValue = `${appBaseUrl.replace(/\/$/, "")}/staff/check-in?token=${encodeURIComponent(ticketToken)}`;
    const qrCodeDataUrl = await generateQrCodeDataUrl(qrValue);

    const registration = await db.registration.create({
      data: {
        fullName: extracted.fullName,
        email: extracted.email,
        phone: extracted.phone,
        registrationId,
        ticketToken,
        qrValue,
        rawPayload: payload as object,
        customFields: extracted.customFields,
      },
    });

    const email = attendeeConfirmationTemplate({
      attendeeName: extracted.fullName,
      registrationId,
      qrCodeDataUrl,
      qrValue,
    });

    const sent = await sendEmailWithFallback({
      to: extracted.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    logInfo("Tripetto registration created", {
      requestId,
      registrationId,
      emailProvider: sent.provider,
      attendeeEmail: extracted.email,
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
      },
      { status: 201 },
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
