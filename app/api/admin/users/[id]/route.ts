import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { adminAuditLogs, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin, userRoleValues } from "@/lib/roles";

const userIdSchema = z.string().trim().min(1);

const updateUserSchema = z
  .object({
    role: z.enum(userRoleValues).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required for update",
  });

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { message, details } }, { status });
}

async function getSessionUserId(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

async function parseJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function assertAdmin(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return { ok: false as const, response: jsonError("Unauthorized", 401) };
  }

  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { role: true },
  });

  if (!isAdmin(currentUser?.role)) {
    return { ok: false as const, response: jsonError("Forbidden", 403) };
  }

  return { ok: true as const, adminId: userId };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const adminGuard = await assertAdmin(request);
  if (!adminGuard.ok) {
    return adminGuard.response;
  }

  const params = await context.params;
  const parsedId = userIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid user id", 400, parsedId.error.flatten());
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = updateUserSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }

  const targetUserId = parsedId.data;
  const input = parsedBody.data;

  if (targetUserId === adminGuard.adminId && input.role && input.role !== "admin") {
    return jsonError("Admin cannot remove own admin role", 400);
  }

  if (targetUserId === adminGuard.adminId && input.isActive === false) {
    return jsonError("Admin cannot deactivate own account", 400);
  }

  const targetUser = await db.query.user.findFirst({
    where: eq(user.id, targetUserId),
    columns: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  if (!targetUser) {
    return jsonError("User not found", 404);
  }

  const updateValues: Partial<typeof user.$inferInsert> = {};
  if (input.role !== undefined) updateValues.role = input.role;
  if (input.isActive !== undefined) updateValues.isActive = input.isActive;

  const [updatedUser] = await db
    .update(user)
    .set(updateValues)
    .where(eq(user.id, targetUserId))
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });

  if (!updatedUser) {
    return jsonError("User not found", 404);
  }

  await db.insert(adminAuditLogs).values({
    adminId: adminGuard.adminId,
    targetUserId,
    action: "update_user",
    details: JSON.stringify({
      previous: {
        role: targetUser.role,
        isActive: targetUser.isActive,
      },
      next: {
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      },
    }),
  });

  return NextResponse.json({ data: updatedUser }, { status: 200 });
}
