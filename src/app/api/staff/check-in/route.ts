import { CheckInStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentStaffUser } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({
  token: z.string().trim().min(8),
  confirm: z.boolean().optional().default(true),
});

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const staffUser = await getCurrentStaffUser();
  if (!staffUser) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = bodySchema.parse(await request.json());

    const registration = await db.registration.findUnique({
      where: { ticketToken: payload.token },
    });

    if (!registration) {
      return NextResponse.json({ ok: false, error: "Invalid ticket token", status: "invalid" }, { status: 404 });
    }

    if (registration.checkInStatus === CheckInStatus.checked_in) {
      return NextResponse.json({
        ok: true,
        status: "already_checked_in",
        attendee: {
          fullName: registration.fullName,
          email: registration.email,
          registrationId: registration.registrationId,
          checkedInAt: registration.checkedInAt,
          checkedInBy: registration.checkedInBy,
        },
      });
    }

    if (!payload.confirm) {
      return NextResponse.json({
        ok: true,
        status: "registered",
        attendee: {
          fullName: registration.fullName,
          email: registration.email,
          registrationId: registration.registrationId,
          checkInStatus: registration.checkInStatus,
        },
      });
    }

    const updated = await db.registration.update({
      where: { id: registration.id },
      data: {
        checkInStatus: CheckInStatus.checked_in,
        checkedInAt: new Date(),
        checkedInBy: staffUser,
      },
    });

    return NextResponse.json({
      ok: true,
      status: "checked_in",
      attendee: {
        fullName: updated.fullName,
        email: updated.email,
        registrationId: updated.registrationId,
        checkedInAt: updated.checkedInAt,
        checkedInBy: updated.checkedInBy,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid payload", issues: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ ok: false, error: "Check-in failed" }, { status: 500 });
  }
}
