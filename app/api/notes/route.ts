import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories, notes } from "@/db/schema";
import { jsonError, parseJsonBody, requireUserId } from "@/lib/api-utils";
import { QUERY_LIMITS } from "@/lib/query-limits";

const listNotesSchema = z.object({
  q: z.string().trim().min(1).max(255).optional(),
  categoryId: z.string().uuid().optional(),
  pinned: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(QUERY_LIMITS.notes.max).optional(),
});

const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1).max(20000),
  categoryId: z.string().uuid().nullable().optional(),
  pinned: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = listNotesSchema.safeParse(search);
  if (!parsedQuery.success) {
    return jsonError("Invalid query parameters", 400, parsedQuery.error.flatten());
  }

  const page = parsedQuery.data.page ?? 1;
  const limit = parsedQuery.data.limit ?? QUERY_LIMITS.notes.default;
  const offset = (page - 1) * limit;

  const conditions = [eq(notes.userId, userGuard.userId)];
  if (parsedQuery.data.q) {
    conditions.push(or(ilike(notes.title, `%${parsedQuery.data.q}%`), ilike(notes.content, `%${parsedQuery.data.q}%`))!);
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

export async function POST(request: NextRequest) {
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = createNoteSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;

  if (input.categoryId) {
    const category = await db.query.categories.findFirst({
      where: and(eq(categories.id, input.categoryId), eq(categories.userId, userGuard.userId)),
      columns: { id: true },
    });

    if (!category) {
      return jsonError("Category does not exist for authenticated user", 400);
    }
  }

  const [createdNote] = await db
    .insert(notes)
    .values({
      userId: userGuard.userId,
      categoryId: input.categoryId ?? null,
      title: input.title,
      content: input.content,
      pinned: input.pinned ?? false,
    })
    .returning();

  return NextResponse.json({ data: createdNote }, { status: 201 });
}
