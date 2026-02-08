import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireAdmin } from "@/lib/api-utils";
import { userRoleValues } from "@/lib/roles";

const listUsersQuerySchema = z.object({
  role: z.enum(userRoleValues).optional(),
});

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { message, details } }, { status });
}

export async function GET(request: NextRequest) {
  const adminGuard = await requireAdmin(request);
  if (!adminGuard.ok) {
    return adminGuard.response;
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = listUsersQuerySchema.safeParse(search);

  if (!parsedQuery.success) {
    return jsonError("Neispravni parametri upita", 400, parsedQuery.error.flatten());
  }

  const selectedColumns = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    managerId: user.managerId,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  const usersPromise = parsedQuery.data.role
    ? db
        .select(selectedColumns)
        .from(user)
        .where(eq(user.role, parsedQuery.data.role))
        .orderBy(desc(user.createdAt))
    : db.select(selectedColumns).from(user).orderBy(desc(user.createdAt));

  const [users, managers, teamCounts] = await Promise.all([
    usersPromise,
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
      })
      .from(user)
      .where(eq(user.role, "manager")),
    db
      .select({
        managerId: user.managerId,
        teamSize: sql<number>`count(*)::int`,
      })
      .from(user)
      .where(and(eq(user.role, "user"), isNotNull(user.managerId)))
      .groupBy(user.managerId),
  ]);

  const managerMap = new Map(managers.map((entry) => [entry.id, entry]));
  const teamSizeMap = new Map(
    teamCounts
      .filter((entry): entry is { managerId: string; teamSize: number } =>
        Boolean(entry.managerId),
      )
      .map((entry) => [entry.managerId, entry.teamSize]),
  );

  const normalizedUsers = users.map((entry) => ({
    ...entry,
    managerName: entry.managerId ? managerMap.get(entry.managerId)?.name ?? null : null,
    teamSize: teamSizeMap.get(entry.id) ?? 0,
  }));

  return NextResponse.json({ data: normalizedUsers }, { status: 200 });
}
