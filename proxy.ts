import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEMO_COOKIE, SESSION_COOKIE } from "@/lib/constants";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/api/health", "/api/ready"];

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true;
  }
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/calendar/feed/")) return true;
  return false;
}

function usesDatabase() {
  return (
    Boolean(process.env.DATABASE_URL) &&
    process.env.DEMO_MODE !== "true" &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== "true"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const authenticated = usesDatabase()
    ? Boolean(request.cookies.get(SESSION_COOKIE)?.value)
    : Boolean(request.cookies.get(DEMO_COOKIE)?.value);

  if (!authenticated && !isPublic(pathname)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (authenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (authenticated && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
