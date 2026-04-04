import { CheckInStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { getCurrentStaffUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const staffUser = await getCurrentStaffUser();
  if (!staffUser) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [totalRegistrations, checkedInCount, recent] = await Promise.all([
    db.registration.count(),
    db.registration.count({ where: { checkInStatus: CheckInStatus.checked_in } }),
    db.registration.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        fullName: true,
        registrationId: true,
        checkInStatus: true,
        checkedInAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    totalRegistrations,
    checkedInCount,
    recent,
  });
}
