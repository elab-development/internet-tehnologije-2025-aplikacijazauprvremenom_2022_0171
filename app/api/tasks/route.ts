import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories, tasks, todoLists } from "@/db/schema";
import { auth } from "@/lib/auth";
import { QUERY_LIMITS } from "@/lib/query-limits";

const priorityValues = ["low", "medium", "high"] as const;
const statusValues = ["not_started", "in_progress", "done"] as const;
const queryDateTimeSchema = z.string().datetime({ offset: true, local: true });

const listQuerySchema = z.object({
  listId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(statusValues).optional(),
  priority: z.enum(priorityValues).optional(),
  q: z.string().trim().min(1).max(255).optional(),
  dueFrom: queryDateTimeSchema.optional(),
  dueTo: queryDateTimeSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(QUERY_LIMITS.tasks.max).optional(),
});

const createTaskSchema = z.object({
  listId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(5000).nullable().optional(),
  priority: z.enum(priorityValues).optional(),
  status: z.enum(statusValues).optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  completedAt: z.string().datetime({ offset: true }).nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(10080).optional(),
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

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = listQuerySchema.safeParse(search);

  if (!parsedQuery.success) {
    return jsonError("Invalid query parameters", 400, parsedQuery.error.flatten());
  }

  const page = parsedQuery.data.page ?? 1;
  const limit = parsedQuery.data.limit ?? QUERY_LIMITS.tasks.default;
  const offset = (page - 1) * limit;

  const conditions = [eq(tasks.userId, userId)];
  if (parsedQuery.data.listId) conditions.push(eq(tasks.listId, parsedQuery.data.listId));
  if (parsedQuery.data.categoryId) {
    conditions.push(eq(tasks.categoryId, parsedQuery.data.categoryId));
  }
  if (parsedQuery.data.status) conditions.push(eq(tasks.status, parsedQuery.data.status));
  if (parsedQuery.data.priority) {
    conditions.push(eq(tasks.priority, parsedQuery.data.priority));
  }
  if (parsedQuery.data.q) {
    conditions.push(or(ilike(tasks.title, `%${parsedQuery.data.q}%`), ilike(tasks.description, `%${parsedQuery.data.q}%`))!);
  }
  if (parsedQuery.data.dueFrom) {
    conditions.push(gte(tasks.dueDate, new Date(parsedQuery.data.dueFrom)));
  }
  if (parsedQuery.data.dueTo) {
    conditions.push(lte(tasks.dueDate, new Date(parsedQuery.data.dueTo)));
  }

  const whereCondition =
    conditions.length === 1 ? conditions[0] : and(...conditions);

  const [taskList, total] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(whereCondition)
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(tasks)
      .where(whereCondition)
      .then((rows) => rows[0]?.value ?? 0),
  ]);

  return NextResponse.json(
    {
      data: taskList,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = createTaskSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;

  const list = await db.query.todoLists.findFirst({
    where: and(eq(todoLists.id, input.listId), eq(todoLists.userId, userId)),
    columns: { id: true },
  });

  if (!list) {
    return jsonError("List does not exist for authenticated user", 400);
  }

  if (input.categoryId) {
    const category = await db.query.categories.findFirst({
      where: and(eq(categories.id, input.categoryId), eq(categories.userId, userId)),
      columns: { id: true },
    });

    if (!category) {
      return jsonError("Category does not exist for authenticated user", 400);
    }
  }

  const [createdTask] = await db
    .insert(tasks)
    .values({
      userId,
      listId: input.listId,
      categoryId: input.categoryId ?? null,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "medium",
      status: input.status ?? "not_started",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      estimatedMinutes: input.estimatedMinutes ?? 30,
    })
    .returning();

  return NextResponse.json({ data: createdTask }, { status: 201 });
}
