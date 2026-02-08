import { and, asc, eq, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { todoLists } from "@/db/schema";
import {
  jsonError,
  parseJsonBody,
  requireActor,
  resolveTargetUserId,
} from "@/lib/api-utils";

const createListSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
});

const listQuerySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(255).optional(),
});

export async function GET(request: NextRequest) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = listQuerySchema.safeParse(search);

  if (!parsedQuery.success) {
    return jsonError("Neispravni\ parametri\ upita", 400, parsedQuery.error.flatten());
  }

  const targetUserGuard = await resolveTargetUserId(
    actorGuard.actor,
    parsedQuery.data.userId,
  );
  if (!targetUserGuard.ok) {
    return targetUserGuard.response;
  }

  const whereCondition = parsedQuery.data.q
    ? and(
        eq(todoLists.userId, targetUserGuard.targetUserId),
        ilike(todoLists.title, `%${parsedQuery.data.q}%`),
      )
    : eq(todoLists.userId, targetUserGuard.targetUserId);

  const lists = await db
    .select({
      id: todoLists.id,
      title: todoLists.title,
      description: todoLists.description,
      createdAt: todoLists.createdAt,
      updatedAt: todoLists.updatedAt,
    })
    .from(todoLists)
    .where(whereCondition)
    .orderBy(asc(todoLists.createdAt));

  return NextResponse.json({ data: lists }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Neispravan\ JSON\ payload", 400);
  }

  const parsedBody = createListSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validacija nije prosla", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;
  const targetUserGuard = await resolveTargetUserId(actorGuard.actor, input.userId);
  if (!targetUserGuard.ok) {
    return targetUserGuard.response;
  }

  const [createdList] = await db
    .insert(todoLists)
    .values({
      userId: targetUserGuard.targetUserId,
      title: input.title,
      description: input.description ?? null,
    })
    .returning({
      id: todoLists.id,
      title: todoLists.title,
      description: todoLists.description,
      createdAt: todoLists.createdAt,
      updatedAt: todoLists.updatedAt,
    });

  return NextResponse.json({ data: createdList }, { status: 201 });
}


