import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { adminAuditLogs, session, user } from "@/db/schema";
import { jsonError, parseJsonBody, requireAdmin } from "@/lib/api-utils";
import {
  assignUserToManager,
  removeManagerRole,
  ServiceError,
} from "@/lib/manager-service";
import { userRoleValues } from "@/lib/roles";

const userIdSchema = z.string().trim().min(1);

const updateUserSchema = z
  .object({
    role: z.enum(userRoleValues).optional(),
    isActive: z.boolean().optional(),
    managerId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Potrebno je bar jedno polje za izmenu",
  });

function toApiError(error: unknown) {
  if (error instanceof ServiceError) {
    return jsonError(error.message, error.status, error.details);
  }

  return jsonError("Interna greska servera", 500);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const adminGuard = await requireAdmin(request);
  if (!adminGuard.ok) {
    return adminGuard.response;
  }

  const params = await context.params;
  const parsedId = userIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Neispravan ID korisnika", 400, parsedId.error.flatten());
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Neispravan JSON payload", 400);
  }

  const parsedBody = updateUserSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validacija nije prosla", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;
  const targetUserId = parsedId.data;

  if (targetUserId === adminGuard.adminId && input.role && input.role !== "admin") {
    return jsonError("Administrator ne moze da ukloni sopstvenu admin ulogu", 400);
  }

  if (targetUserId === adminGuard.adminId && input.isActive === false) {
    return jsonError("Administrator ne moze da deaktivira sopstveni nalog", 400);
  }

  const targetUser = await db.query.user.findFirst({
    where: eq(user.id, targetUserId),
    columns: {
      id: true,
      role: true,
      isActive: true,
      managerId: true,
    },
  });

  if (!targetUser) {
    return jsonError("Korisnik nije pronadjen", 404);
  }

  let currentRole = targetUser.role;
  let currentIsActive = targetUser.isActive;
  let currentManagerId = targetUser.managerId;

  const shouldRemoveManagerRole =
    targetUser.role === "manager" &&
    input.role !== undefined &&
    input.role !== "manager";

  try {
    if (shouldRemoveManagerRole) {
      const nextRole = input.role;
      if (!nextRole || nextRole === "manager") {
        return jsonError("Neispravna promena uloge", 400);
      }

      const result = await removeManagerRole({
        adminId: adminGuard.adminId,
        managerUserId: targetUserId,
        nextRole,
      });

      if (!result.user) {
        return jsonError("Korisnik nije pronadjen", 404);
      }

      currentRole = result.user.role;
      currentIsActive = result.user.isActive;
      currentManagerId = result.user.managerId;
    }

    const updateValues: Partial<typeof user.$inferInsert> = {};

    if (input.role !== undefined && !shouldRemoveManagerRole) {
      updateValues.role = input.role;
      currentRole = input.role;
      if (input.role !== "user") {
        updateValues.managerId = null;
        currentManagerId = null;
      }
    }

    if (input.isActive !== undefined) {
      updateValues.isActive = input.isActive;
      currentIsActive = input.isActive;
    }

    const hasDirectUpdate = Object.keys(updateValues).length > 0;
    if (hasDirectUpdate) {
      await db.update(user).set(updateValues).where(eq(user.id, targetUserId));
    }

    if (input.managerId !== undefined) {
      if (currentRole !== "user") {
        return jsonError("Samo korisnik sa USER ulogom moze biti dodeljen menadzeru", 400);
      }

      const assignedUser = await assignUserToManager({
        adminId: adminGuard.adminId,
        userId: targetUserId,
        managerId: input.managerId,
      });

      currentManagerId = assignedUser.managerId;
    }

    if (hasDirectUpdate) {
      await db.delete(session).where(eq(session.userId, targetUserId));
    }

    const [updatedUser] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        managerId: user.managerId,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, targetUserId))
      .limit(1);

    if (!updatedUser) {
      return jsonError("Korisnik nije pronadjen", 404);
    }

    const [managerUser, teamSizeRow] = await Promise.all([
      updatedUser.managerId
        ? db.query.user.findFirst({
            where: eq(user.id, updatedUser.managerId),
            columns: { name: true },
          })
        : Promise.resolve(null),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(user)
        .where(and(eq(user.role, "user"), eq(user.managerId, updatedUser.id)))
        .then((rows) => rows[0]?.value ?? 0),
    ]);

    const normalizedUser = {
      ...updatedUser,
      managerName: managerUser?.name ?? null,
      teamSize: teamSizeRow,
    };

    await db.insert(adminAuditLogs).values({
      adminId: adminGuard.adminId,
      targetUserId,
      action: "update_user",
      details: JSON.stringify({
        previous: {
          role: targetUser.role,
          isActive: targetUser.isActive,
          managerId: targetUser.managerId,
        },
        next: {
          role: currentRole,
          isActive: currentIsActive,
          managerId: currentManagerId,
        },
      }),
    });

    return NextResponse.json({ data: normalizedUser }, { status: 200 });
  } catch (error) {
    return toApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const adminGuard = await requireAdmin(request);
  if (!adminGuard.ok) {
    return adminGuard.response;
  }

  const params = await context.params;
  const parsedId = userIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Neispravan ID korisnika", 400, parsedId.error.flatten());
  }

  const targetUserId = parsedId.data;
  if (targetUserId === adminGuard.adminId) {
    return jsonError("Administrator ne moze da obrise sopstveni nalog", 400);
  }

  const [deletedUser] = await db
    .delete(user)
    .where(eq(user.id, targetUserId))
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      managerId: user.managerId,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });

  if (!deletedUser) {
    return jsonError("Korisnik nije pronadjen", 404);
  }

  await db.insert(adminAuditLogs).values({
    adminId: adminGuard.adminId,
    targetUserId,
    action: "delete_user",
    details: JSON.stringify({
      deleted: {
        id: deletedUser.id,
        email: deletedUser.email,
        role: deletedUser.role,
      },
    }),
  });

  return NextResponse.json({ data: deletedUser }, { status: 200 });
}
