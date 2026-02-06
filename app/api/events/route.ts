import { and, asc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { calendarEvents, tasks } from "@/db/schema";
import { jsonError, parseJsonBody, requireUserId } from "@/lib/api-utils";
import { QUERY_LIMITS } from "@/lib/query-limits";

const queryDateTimeSchema = z.string().datetime({ offset: true, local: true });

const listEventsSchema = z.object({
  q: z.string().trim().min(1).max(255).optional(),
  taskId: z.string().uuid().optional(),
  startsFrom: queryDateTimeSchema.optional(),
  startsTo: queryDateTimeSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(QUERY_LIMITS.events.max).optional(),
});

const createEventSchema = z
  .object({
    taskId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(5000).nullable().optional(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    location: z.string().trim().max(255).nullable().optional(),
  })
  .refine((input) => new Date(input.endsAt) > new Date(input.startsAt), {
    message: "Event end time must be after start time",
    path: ["endsAt"],
  });

export async function GET(request: NextRequest) {
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = listEventsSchema.safeParse(search);
  if (!parsedQuery.success) {
    return jsonError("Invalid query parameters", 400, parsedQuery.error.flatten());
  }

  const page = parsedQuery.data.page ?? 1;
  const limit = parsedQuery.data.limit ?? QUERY_LIMITS.events.default;
  const offset = (page - 1) * limit;

  const conditions = [eq(calendarEvents.userId, userGuard.userId)];
  if (parsedQuery.data.taskId) {
    conditions.push(eq(calendarEvents.taskId, parsedQuery.data.taskId));
  }
  if (parsedQuery.data.startsFrom) {
    conditions.push(gte(calendarEvents.startsAt, new Date(parsedQuery.data.startsFrom)));
  }
  if (parsedQuery.data.startsTo) {
    conditions.push(lte(calendarEvents.startsAt, new Date(parsedQuery.data.startsTo)));
  }
  if (parsedQuery.data.q) {
    conditions.push(
      or(
        ilike(calendarEvents.title, `%${parsedQuery.data.q}%`),
        ilike(calendarEvents.description, `%${parsedQuery.data.q}%`),
        ilike(calendarEvents.location, `%${parsedQuery.data.q}%`),
      )!,
    );
  }

  const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [items, total] = await Promise.all([
    db
      .select({
        id: calendarEvents.id,
        userId: calendarEvents.userId,
        taskId: calendarEvents.taskId,
        title: calendarEvents.title,
        description: calendarEvents.description,
        startsAt: calendarEvents.startsAt,
        endsAt: calendarEvents.endsAt,
        location: calendarEvents.location,
        createdAt: calendarEvents.createdAt,
        updatedAt: calendarEvents.updatedAt,
      })
      .from(calendarEvents)
      .where(whereCondition)
      .orderBy(asc(calendarEvents.startsAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(calendarEvents)
      .where(whereCondition)
      .then((rows) => rows[0]?.value ?? 0),
  ]);

  return NextResponse.json(
    {
      data: items,
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
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = createEventSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;

  if (input.taskId) {
    const linkedTask = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, input.taskId), eq(tasks.userId, userGuard.userId)),
      columns: { id: true },
    });
    if (!linkedTask) {
      return jsonError("Task does not exist for authenticated user", 400);
    }
  }

  const [createdEvent] = await db
    .insert(calendarEvents)
    .values({
      userId: userGuard.userId,
      taskId: input.taskId ?? null,
      title: input.title,
      description: input.description ?? null,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      location: input.location ?? null,
    })
    .returning();

  return NextResponse.json({ data: createdEvent }, { status: 201 });
}
