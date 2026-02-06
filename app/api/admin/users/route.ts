import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin, userRoleValues } from "@/lib/roles";

const listUsersQuerySchema = z.object({
  role: z.enum(userRoleValues).optional(),
});

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { message, details } }, { status });
}

async function getSessionUserId(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
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

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const adminGuard = await assertAdmin(request);
  if (!adminGuard.ok) {
    return adminGuard.response;
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = listUsersQuerySchema.safeParse(search);

  if (!parsedQuery.success) {
    return jsonError("Invalid query parameters", 400, parsedQuery.error.flatten());
  }

  const selectedColumns = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  const users = parsedQuery.data.role
    ? await db
        .select(selectedColumns)
        .from(user)
        .where(eq(user.role, parsedQuery.data.role))
        .orderBy(desc(user.createdAt))
    : await db.select(selectedColumns).from(user).orderBy(desc(user.createdAt));

  return NextResponse.json({ data: users }, { status: 200 });
}
