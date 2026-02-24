import { NextRequest, NextResponse } from "next/server";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CORS_ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const CORS_ALLOWED_HEADERS =
  process.env.CORS_ALLOWED_HEADERS ?? "Content-Type, Authorization, X-Requested-With";

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getConfiguredOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => normalizeOrigin(entry.trim()))
    .filter((entry): entry is string => Boolean(entry));

  return fromEnv;
}

function getTrustedOrigins(request: NextRequest) {
  const trusted = new Set<string>([request.nextUrl.origin]);
  const betterAuthBase = normalizeOrigin(process.env.BETTER_AUTH_BASE_URL);

  if (betterAuthBase) {
    trusted.add(betterAuthBase);
  }

  for (const origin of getConfiguredOrigins()) {
    trusted.add(origin);
  }

  return trusted;
}

function getAllowedCorsOrigin(request: NextRequest) {
  const requestOrigin = normalizeOrigin(request.headers.get("origin"));
  if (!requestOrigin) {
    return null;
  }

  return getTrustedOrigins(request).has(requestOrigin) ? requestOrigin : null;
}

function setIfMissing(response: NextResponse, key: string, value: string) {
  if (!response.headers.has(key)) {
    response.headers.set(key, value);
  }
}

export function appendSecurityHeaders(response: NextResponse) {
  setIfMissing(response, "X-Frame-Options", "DENY");
  setIfMissing(response, "X-Content-Type-Options", "nosniff");
  setIfMissing(response, "Referrer-Policy", "strict-origin-when-cross-origin");
  setIfMissing(response, "Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  setIfMissing(response, "Cross-Origin-Opener-Policy", "same-origin");
  setIfMissing(response, "Cross-Origin-Resource-Policy", "same-origin");
}

export function appendApiCorsHeaders(response: NextResponse, request: NextRequest) {
  const allowedOrigin = getAllowedCorsOrigin(request);

  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", CORS_ALLOWED_METHODS);
  response.headers.set("Access-Control-Allow-Headers", CORS_ALLOWED_HEADERS);
  response.headers.set("Access-Control-Max-Age", "86400");

  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
}

function apiSecurityError(request: NextRequest, message: string, status = 403) {
  const response = NextResponse.json({ error: { message } }, { status });
  appendApiCorsHeaders(response, request);
  appendSecurityHeaders(response);
  return response;
}

export function handleApiPreflight(request: NextRequest) {
  if (request.method !== "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  if (origin && !getAllowedCorsOrigin(request)) {
    return apiSecurityError(request, "Nedozvoljen CORS origin");
  }

  const response = new NextResponse(null, { status: 204 });
  appendApiCorsHeaders(response, request);
  appendSecurityHeaders(response);
  return response;
}

export function validateCsrfForApi(request: NextRequest) {
  if (!UNSAFE_METHODS.has(request.method)) {
    return null;
  }

  const hasCookieSession = Boolean(request.headers.get("cookie"));
  if (!hasCookieSession) {
    return null;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return apiSecurityError(
      request,
      "CSRF zastita: nedostaje Origin zaglavlje za mutacioni zahtev",
    );
  }

  if (!getAllowedCorsOrigin(request)) {
    return apiSecurityError(request, "CSRF zastita: zahtev je odbijen zbog nevalidnog origin-a");
  }

  return null;
}
