import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Routes that don't require authentication
const publicRoutes = ["/", "/auth"];

// Routes that start with these prefixes are also public
const publicPrefixes = ["/api/auth"];

// Routes that require specific roles (instructor or admin)
const instructorOnlyRoutes = ["/problems/create"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is public
  const isPublicRoute = publicRoutes.includes(pathname);
  const isPublicPrefix = publicPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  // Skip static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Allow public routes
  if (isPublicRoute || isPublicPrefix) {
    return NextResponse.next();
  }

  // Check for session cookie (better-auth uses a session cookie)
  const sessionCookie = request.cookies.get("better-auth.session_token");

  // If no session, redirect to auth with the original path
  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Check if route requires instructor/admin role
  const isInstructorRoute = instructorOnlyRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isInstructorRoute) {
    // Get session to check role
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(url);
    }

    const userRole = session.user.role;
    if (userRole !== "instructor" && userRole !== "admin") {
      // Redirect unauthorized users to problems page
      const url = request.nextUrl.clone();
      url.pathname = "/problems";
      url.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(url);
    }
  }

  // User is authenticated, allow access
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
