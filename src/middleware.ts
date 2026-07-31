import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const publicPaths = ["/", "/j", "/track", "/api/auth/login", "/technician/select"];
const publicPrefixes = ["/j/", "/api/track"];

function isPublic(pathname: string): boolean {
  if (publicPaths.includes(pathname)) return true;
  return publicPrefixes.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const session = await getSession();

  if (!session.isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (session.role === "technician") {
    const blocked =
      pathname.startsWith("/jobs/new") ||
      pathname.startsWith("/jobs/delivery") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/dashboard");
    if (blocked) {
      return NextResponse.redirect(new URL("/jobs/pending", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
