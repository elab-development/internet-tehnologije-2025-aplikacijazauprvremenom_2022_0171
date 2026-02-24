import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories, notes } from "@/db/schema";
import {
  jsonError,
  parseJsonBody,
  requireActor,
  resolveTargetUserId,
} from "@/lib/api-utils";
import { QUERY_LIMITS } from "@/lib/query-limits";

const listNotesSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(255).optional(),
  categoryId: z.string().uuid().optional(),
  pinned: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(QUERY_LIMITS.notes.max).optional(),
});

const createNoteSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1).max(20000),
  categoryId: z.string().uuid().nullable().optional(),
  pinned: z.boolean().optional(),
});

/**
 * Lista beleski
 * @description Vraca beleske sa filterima i paginacijom.
 * @tag Beleske
 * @auth apikey
 * @params listNotesSchema
 * @response 200:OpenApiNotesListResponseSchema
 * @openapi
 */
export async function GET(request: NextRequest) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = listNotesSchema.safeParse(search);
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

  const page = parsedQuery.data.page ?? 1;
  const limit = parsedQuery.data.limit ?? QUERY_LIMITS.notes.default;
  const offset = (page - 1) * limit;

  const conditions = [eq(notes.userId, targetUserGuard.targetUserId)];
  if (parsedQuery.data.q) {
    conditions.push(
      or(
        ilike(notes.title, `%${parsedQuery.data.q}%`),
        ilike(notes.content, `%${parsedQuery.data.q}%`),
      )!,
    );
  }
  if (parsedQuery.data.categoryId) {
    conditions.push(eq(notes.categoryId, parsedQuery.data.categoryId));
  }
  if (parsedQuery.data.pinned) {
    conditions.push(eq(notes.pinned, parsedQuery.data.pinned === "true"));
  }

  const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [items, totalRow] = await Promise.all([
    db
      .select({
        id: notes.id,
        userId: notes.userId,
        createdByUserId: notes.createdByUserId,
        categoryId: notes.categoryId,
        title: notes.title,
        content: notes.content,
        pinned: notes.pinned,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(whereCondition)
      .orderBy(desc(notes.pinned), desc(notes.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(notes)
      .where(whereCondition)
      .then((rows) => rows[0]?.value ?? 0),
  ]);

  return NextResponse.json(
    {
      data: items,
      meta: {
        page,
        limit,
        total: totalRow,
        totalPages: Math.max(1, Math.ceil(totalRow / limit)),
      },
    },
    { status: 200 },
  );
}

/**
 * Kreiranje beleske
 * @description Kreira novu belesku za izabranog korisnika.
 * @tag Beleske
 * @auth apikey
 * @body createNoteSchema
 * @response 201:OpenApiNoteResponseSchema
 * @openapi
 */
export async function POST(request: NextRequest) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Neispravan\ JSON\ payload", 400);
  }

  const parsedBody = createNoteSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validacija nije prosla", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;
  const targetUserGuard = await resolveTargetUserId(actorGuard.actor, input.userId);
  if (!targetUserGuard.ok) {
    return targetUserGuard.response;
  }

  const targetUserId = targetUserGuard.targetUserId;

  if (input.categoryId) {
    const category = await db.query.categories.findFirst({
      where: and(eq(categories.id, input.categoryId), eq(categories.userId, targetUserId)),
      columns: { id: true },
    });

    if (!category) {
      return jsonError("Kategorija ne postoji za izabranog korisnika", 400);
    }
  }

  const [createdNote] = await db
    .insert(notes)
    .values({
      userId: targetUserId,
      createdByUserId: actorGuard.actor.id,
      categoryId: input.categoryId ?? null,
      title: input.title,
      content: input.content,
      pinned: input.pinned ?? false,
    })
    .returning();

  return NextResponse.json({ data: createdNote }, { status: 201 });
}


