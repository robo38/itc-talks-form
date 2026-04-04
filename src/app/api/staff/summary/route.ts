import { NextResponse } from "next/server";

import { getCurrentStaffUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const staffUser = await getCurrentStaffUser();
  if (!staffUser) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [totalRegistrations, checkedInCount, recentRows] = await Promise.all([
    db.registration.count(),
    db.registration.count({ where: { checkInStatus: "checked_in" } }),
    db.registration.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const recent = recentRows.map((entry) => ({
    id: entry.id,
    fullName: entry.fullName,
    registrationId: entry.registrationId,
    checkInStatus: entry.checkInStatus,
    checkedInAt: entry.checkedInAt,
  }));

  return NextResponse.json({
    ok: true,
    totalRegistrations,
    checkedInCount,
    recent,
  });
}
