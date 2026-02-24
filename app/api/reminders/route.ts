import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { calendarEvents, reminders, tasks } from "@/db/schema";
import {
  jsonError,
  parseJsonBody,
  requireActor,
  resolveTargetUserId,
} from "@/lib/api-utils";
import { QUERY_LIMITS } from "@/lib/query-limits";

const remindersQueryDateTimeSchema = z.string().datetime({ offset: true, local: true });

const listRemindersSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  taskId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  isSent: z.enum(["true", "false"]).optional(),
  remindFrom: remindersQueryDateTimeSchema.optional(),
  remindTo: remindersQueryDateTimeSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(QUERY_LIMITS.reminders.max).optional(),
});

const createReminderSchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    taskId: z.string().uuid().nullable().optional(),
    eventId: z.string().uuid().nullable().optional(),
    message: z.string().trim().min(1).max(500),
    remindAt: z.string().datetime({ offset: true }),
  })
  .refine((input) => Boolean(input.taskId || input.eventId), {
    message: "Reminder must target task or event",
    path: ["taskId"],
  });

/**
 * Lista podsetnika
 * @description Vraca podsetnike sa filterima i paginacijom.
 * @tag Podsetnici
 * @auth apikey
 * @params listRemindersSchema
 * @response 200:OpenApiRemindersListResponseSchema
 * @openapi
 */
export async function GET(request: NextRequest) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = listRemindersSchema.safeParse(search);
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
  const limit = parsedQuery.data.limit ?? QUERY_LIMITS.reminders.default;
  const offset = (page - 1) * limit;

  const conditions = [eq(reminders.userId, targetUserGuard.targetUserId)];
  if (parsedQuery.data.taskId) conditions.push(eq(reminders.taskId, parsedQuery.data.taskId));
  if (parsedQuery.data.eventId) conditions.push(eq(reminders.eventId, parsedQuery.data.eventId));
  if (parsedQuery.data.isSent) {
    conditions.push(eq(reminders.isSent, parsedQuery.data.isSent === "true"));
  }
  if (parsedQuery.data.remindFrom) {
    conditions.push(gte(reminders.remindAt, new Date(parsedQuery.data.remindFrom)));
  }
  if (parsedQuery.data.remindTo) {
    conditions.push(lte(reminders.remindAt, new Date(parsedQuery.data.remindTo)));
  }

  const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [items, total] = await Promise.all([
    db
      .select({
        id: reminders.id,
        userId: reminders.userId,
        createdByUserId: reminders.createdByUserId,
        taskId: reminders.taskId,
        eventId: reminders.eventId,
        message: reminders.message,
        remindAt: reminders.remindAt,
        isSent: reminders.isSent,
        sentAt: reminders.sentAt,
        createdAt: reminders.createdAt,
        updatedAt: reminders.updatedAt,
      })
      .from(reminders)
      .where(whereCondition)
      .orderBy(asc(reminders.remindAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(reminders)
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

/**
 * Kreiranje podsetnika
 * @description Kreira podsetnik za task ili dogadjaj.
 * @tag Podsetnici
 * @auth apikey
 * @body createReminderSchema
 * @response 201:OpenApiReminderResponseSchema
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

  const parsedBody = createReminderSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validacija nije prosla", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;
  const remindAtDate = new Date(input.remindAt);
  if (remindAtDate.getTime() < Date.now()) {
    return jsonError("Vreme podsetnika ne moze biti u proslosti", 400);
  }
  const targetUserGuard = await resolveTargetUserId(actorGuard.actor, input.userId);
  if (!targetUserGuard.ok) {
    return targetUserGuard.response;
  }

  const targetUserId = targetUserGuard.targetUserId;

  if (input.taskId) {
    const linkedTask = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, input.taskId), eq(tasks.userId, targetUserId)),
      columns: { id: true },
    });
    if (!linkedTask) {
      return jsonError("Zadatak ne postoji za izabranog korisnika", 400);
    }
  }

  if (input.eventId) {
    const linkedEvent = await db.query.calendarEvents.findFirst({
      where: and(
        eq(calendarEvents.id, input.eventId),
        eq(calendarEvents.userId, targetUserId),
      ),
      columns: { id: true },
    });
    if (!linkedEvent) {
      return jsonError("Dogadjaj ne postoji za izabranog korisnika", 400);
    }
  }

  const [createdReminder] = await db
    .insert(reminders)
    .values({
      userId: targetUserId,
      createdByUserId: actorGuard.actor.id,
      taskId: input.taskId ?? null,
      eventId: input.eventId ?? null,
      message: input.message,
      remindAt: remindAtDate,
    })
    .returning();

  return NextResponse.json({ data: createdReminder }, { status: 201 });
}


