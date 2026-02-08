import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin, isManager, isUserRole, type UserRole } from "@/lib/roles";

export type SessionActor = {
  id: string;
  role: UserRole;
  isActive: boolean;
  managerId: string | null;
};

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

export async function getSessionActor(
  request: NextRequest,
): Promise<SessionActor | null> {
  const sessionUserId = await getSessionUserId(request);
  if (!sessionUserId) {
    return null;
  }

  const existingUser = await db.query.user.findFirst({
    where: eq(user.id, sessionUserId),
    columns: {
      id: true,
      role: true,
      isActive: true,
      managerId: true,
    },
  });

  if (!existingUser || !isUserRole(existingUser.role)) {
    return null;
  }

  return {
    id: existingUser.id,
    role: existingUser.role,
    isActive: existingUser.isActive,
    managerId: existingUser.managerId,
  };
}

export async function requireUserId(request: NextRequest) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard;
  }

  return { ok: true as const, userId: actorGuard.actor.id };
}

export async function requireActor(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return { ok: false as const, response: jsonError("Neautorizovan pristup", 401) };
  }

  if (!actor.isActive) {
    return { ok: false as const, response: jsonError("Nalog je deaktiviran", 403) };
  }

  return { ok: true as const, actor };
}

export async function isManagerOfUser(managerId: string, targetUserId: string) {
  const managedUser = await db.query.user.findFirst({
    where: and(
      eq(user.id, targetUserId),
      eq(user.managerId, managerId),
      eq(user.role, "user"),
    ),
    columns: { id: true },
  });

  return Boolean(managedUser);
}

export async function canActorAccessUser(
  actor: SessionActor,
  targetUserId: string,
) {
  if (actor.id === targetUserId) {
    return true;
  }

  if (isAdmin(actor.role)) {
    return true;
  }

  if (!isManager(actor.role)) {
    return false;
  }

  return isManagerOfUser(actor.id, targetUserId);
}

export async function resolveTargetUserId(
  actor: SessionActor,
  requestedTargetUserId: string | null | undefined,
) {
  const targetUserId = requestedTargetUserId?.trim() || actor.id;
  const canAccess = await canActorAccessUser(actor, targetUserId);

  if (!canAccess) {
    return { ok: false as const, response: jsonError("Nemate dozvolu za ovu akciju", 403) };
  }

  return { ok: true as const, targetUserId };
}

export function isLockedForUser(
  actor: SessionActor,
  ownerUserId: string,
  createdByUserId: string,
) {
  if (actor.role !== "user" || actor.id !== ownerUserId) {
    return false;
  }

  return createdByUserId !== actor.id;
}

export async function requireAdmin(request: NextRequest) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard;
  }

  if (!isAdmin(actorGuard.actor.role)) {
    return { ok: false as const, response: jsonError("Nemate dozvolu za ovu akciju", 403) };
  }

  return { ok: true as const, adminId: actorGuard.actor.id };
}
