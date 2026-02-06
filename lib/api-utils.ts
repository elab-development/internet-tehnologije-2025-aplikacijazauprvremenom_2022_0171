import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";

export function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { message, details } }, { status });
}

export async function parseJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function getSessionUserId(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

export async function requireUserId(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return { ok: false as const, response: jsonError("Unauthorized", 401) };
  }

  return { ok: true as const, userId };
}

export async function requireAdmin(request: NextRequest) {
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard;
  }

  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, userGuard.userId),
    columns: { role: true },
  });

  if (!isAdmin(currentUser?.role)) {
    return { ok: false as const, response: jsonError("Forbidden", 403) };
  }

  return { ok: true as const, adminId: userGuard.userId };
}
