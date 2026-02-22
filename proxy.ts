import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import {
  appendApiCorsHeaders,
  appendSecurityHeaders,
  handleApiPreflight,
  validateCsrfForApi,
} from "@/lib/security";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    const preflightResponse = handleApiPreflight(request);
    if (preflightResponse) {
      return preflightResponse;
    }

    // Better Auth has its own CSRF checks; custom API routes use this additional guard.
    if (!pathname.startsWith("/api/auth")) {
      const csrfError = validateCsrfForApi(request);
      if (csrfError) {
        return csrfError;
      }
    }

    const apiResponse = NextResponse.next();
    appendApiCorsHeaders(apiResponse, request);
    appendSecurityHeaders(apiResponse);
    return apiResponse;
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    appendSecurityHeaders(response);
    return response;
  }

  if (!session.user.isActive) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    appendSecurityHeaders(response);
    return response;
  }

  if (pathname.startsWith("/admin") && !isAdmin(session.user.role)) {
    const response = NextResponse.redirect(new URL("/", request.url));
    appendSecurityHeaders(response);
    return response;
  }

  const response = NextResponse.next();
  appendSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/((?!api|trpc|register|login|_next|_vercel|.*\\..*).*)"],
};
