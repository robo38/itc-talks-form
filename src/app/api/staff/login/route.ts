import { NextResponse } from "next/server";
import { z } from "zod";

import { STAFF_SESSION_COOKIE } from "@/lib/auth-constants";
import { createStaffSessionToken, getDefaultStaffUsername, verifyStaffPassword } from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().trim().min(1).optional(),
  password: z.string().min(1),
});

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const json = await request.json();
    const parsed = loginSchema.parse(json);

    if (!verifyStaffPassword(parsed.password)) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const username = parsed.username?.trim() || getDefaultStaffUsername();
    const token = createStaffSessionToken(username);

    const response = NextResponse.json({ ok: true, username }, { status: 200 });
    response.cookies.set({
      name: STAFF_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Number(process.env.STAFF_SESSION_TTL_HOURS ?? "12") * 60 * 60,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid login payload", issues: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ ok: false, error: "Login failed" }, { status: 500 });
  }
}
