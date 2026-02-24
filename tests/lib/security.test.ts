import { NextRequest, NextResponse } from "next/server";
import {
  appendApiCorsHeaders,
  appendSecurityHeaders,
  handleApiPreflight,
  validateCsrfForApi,
} from "@/lib/security";

const ORIGINAL_ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS;
const ORIGINAL_BETTER_AUTH_BASE_URL = process.env.BETTER_AUTH_BASE_URL;

function createRequest(
  method: string,
  options?: { origin?: string; cookie?: string; url?: string },
) {
  const headers = new Headers();

  if (options?.origin) {
    headers.set("origin", options.origin);
  }

  if (options?.cookie) {
    headers.set("cookie", options.cookie);
  }

  return new NextRequest(options?.url ?? "http://localhost:3000/api/tasks", {
    method,
    headers,
  });
}

afterEach(() => {
  if (ORIGINAL_ALLOWED_ORIGINS === undefined) {
    delete process.env.ALLOWED_ORIGINS;
  } else {
    process.env.ALLOWED_ORIGINS = ORIGINAL_ALLOWED_ORIGINS;
  }

  if (ORIGINAL_BETTER_AUTH_BASE_URL === undefined) {
    delete process.env.BETTER_AUTH_BASE_URL;
  } else {
    process.env.BETTER_AUTH_BASE_URL = ORIGINAL_BETTER_AUTH_BASE_URL;
  }
});

describe("lib/security.validateCsrfForApi", () => {
  it("dozvoljava safe metode bez CSRF provere", () => {
    const request = createRequest("GET", {
      cookie: "better-auth.session_token=test",
    });

    expect(validateCsrfForApi(request)).toBeNull();
  });

  it("odbija mutacioni cookie zahtev bez Origin zaglavlja", async () => {
    const request = createRequest("POST", {
      cookie: "better-auth.session_token=test",
    });

    const response = validateCsrfForApi(request);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);

    const payload = await response!.json();
    expect(payload.error.message).toContain("Origin");
  });

  it("dozvoljava origin sa allowlist-e", () => {
    process.env.ALLOWED_ORIGINS = "https://frontend.example.com";

    const request = createRequest("PATCH", {
      cookie: "better-auth.session_token=test",
      origin: "https://frontend.example.com",
    });

    expect(validateCsrfForApi(request)).toBeNull();
  });

  it("odbija neodobren origin za mutacioni zahtev", async () => {
    const request = createRequest("DELETE", {
      cookie: "better-auth.session_token=test",
      origin: "https://evil.example.com",
    });

    const response = validateCsrfForApi(request);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);

    const payload = await response!.json();
    expect(payload.error.message).toContain("nevalidnog origin-a");
  });
});

describe("lib/security.handleApiPreflight", () => {
  it("vraca null za non-OPTIONS zahtev", () => {
    const request = createRequest("GET", { origin: "http://localhost:3000" });

    expect(handleApiPreflight(request)).toBeNull();
  });

  it("vraca 204 i CORS headere za validan preflight", () => {
    const request = createRequest("OPTIONS", { origin: "http://localhost:3000" });

    const response = handleApiPreflight(request);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(204);
    expect(response?.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
    expect(response?.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("odbija preflight za nevalidan origin", async () => {
    const request = createRequest("OPTIONS", { origin: "https://evil.example.com" });

    const response = handleApiPreflight(request);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);

    const payload = await response!.json();
    expect(payload.error.message).toContain("CORS origin");
  });
});

describe("lib/security header helpers", () => {
  it("appendSecurityHeaders postavlja hardening headere", () => {
    const response = new NextResponse();

    appendSecurityHeaders(response);

    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("appendApiCorsHeaders dodaje CORS headere i preskace origin bez dozvole", () => {
    const response = new NextResponse();
    const request = createRequest("GET", { origin: "https://evil.example.com" });

    appendApiCorsHeaders(response, request);

    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
