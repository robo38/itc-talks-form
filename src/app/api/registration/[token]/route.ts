import { NextResponse } from "next/server";

import { getCurrentStaffUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(_: Request, context: Params): Promise<NextResponse> {
  const staffUser = await getCurrentStaffUser();
  if (!staffUser) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await context.params;

  const registration = await db.registration.findUnique({
    where: { ticketToken: token },
  });

  if (!registration) {
    return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    attendee: {
      fullName: registration.fullName,
      email: registration.email,
      phone: registration.phone,
      registrationId: registration.registrationId,
      checkInStatus: registration.checkInStatus,
      checkedInAt: registration.checkedInAt,
      checkedInBy: registration.checkedInBy,
      createdAt: registration.createdAt,
    },
  });
}
