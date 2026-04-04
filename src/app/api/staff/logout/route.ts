import { NextResponse } from "next/server";

import { STAFF_SESSION_COOKIE } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: STAFF_SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
