import { NextRequest, NextResponse } from "next/server";

import { STAFF_SESSION_COOKIE } from "@/lib/auth";

function isProtectedRoute(pathname: string): boolean {
  return pathname.startsWith("/staff/check-in") || pathname.startsWith("/api/staff") || pathname.startsWith("/api/registration");
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(STAFF_SESSION_COOKIE)?.value;

  if (sessionCookie) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/staff/login", request.url);
  loginUrl.searchParams.set("next", pathname + request.nextUrl.search);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/staff/:path*", "/api/staff/:path*", "/api/registration/:path*"],
};
