import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { calendarEvents, reminders, tasks } from "@/db/schema";
import {
  canActorAccessUser,
  isLockedForUser,
  jsonError,
  parseJsonBody,
  requireActor,
} from "@/lib/api-utils";

const reminderIdSchema = z.string().uuid();

const updateReminderSchema = z
  .object({
    taskId: z.string().uuid().nullable().optional(),
    eventId: z.string().uuid().nullable().optional(),
    message: z.string().trim().min(1).max(500).optional(),
    remindAt: z.string().datetime({ offset: true }).optional(),
    isSent: z.boolean().optional(),
    sentAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required for update",
  });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const params = await context.params;
  const parsedId = reminderIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid reminder id", 400, parsedId.error.flatten());
  }

  const existingReminder = await db.query.reminders.findFirst({
    where: eq(reminders.id, parsedId.data),
    columns: {
      id: true,
      userId: true,
      createdByUserId: true,
      taskId: true,
      eventId: true,
    },
  });
  if (!existingReminder) {
    return jsonError("Reminder not found", 404);
  }

  const canAccess = await canActorAccessUser(actorGuard.actor, existingReminder.userId);
  if (!canAccess) {
    return jsonError("Forbidden", 403);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = updateReminderSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;

  const lockedForUser = isLockedForUser(
    actorGuard.actor,
    existingReminder.userId,
    existingReminder.createdByUserId,
  );
  const statusOnlyKeys = new Set(["isSent", "sentAt"]);
  if (lockedForUser && !Object.keys(input).every((key) => statusOnlyKeys.has(key))) {
    return jsonError("User can only update status on manager-created reminder", 403);
  }

  const nextTaskId = input.taskId ?? existingReminder.taskId;
  const nextEventId = input.eventId ?? existingReminder.eventId;
  if (!nextTaskId && !nextEventId) {
    return jsonError("Reminder must target task or event", 400);
  }

  if (input.taskId) {
    const linkedTask = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, input.taskId), eq(tasks.userId, existingReminder.userId)),
      columns: { id: true },
    });
    if (!linkedTask) {
      return jsonError("Task does not exist for reminder owner", 400);
    }
  }

  if (input.eventId) {
    const linkedEvent = await db.query.calendarEvents.findFirst({
      where: and(
        eq(calendarEvents.id, input.eventId),
        eq(calendarEvents.userId, existingReminder.userId),
      ),
      columns: { id: true },
    });
    if (!linkedEvent) {
      return jsonError("Event does not exist for reminder owner", 400);
    }
  }

  const [updatedReminder] = await db
    .update(reminders)
    .set({
      taskId: input.taskId,
      eventId: input.eventId,
      message: input.message,
      remindAt: input.remindAt ? new Date(input.remindAt) : undefined,
      isSent: input.isSent,
      sentAt: input.sentAt === null ? null : input.sentAt ? new Date(input.sentAt) : undefined,
    })
    .where(eq(reminders.id, parsedId.data))
    .returning();

  if (!updatedReminder) {
    return jsonError("Reminder not found", 404);
  }

  return NextResponse.json({ data: updatedReminder }, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const params = await context.params;
  const parsedId = reminderIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid reminder id", 400, parsedId.error.flatten());
  }

  const existingReminder = await db.query.reminders.findFirst({
    where: eq(reminders.id, parsedId.data),
    columns: {
      id: true,
      userId: true,
      createdByUserId: true,
    },
  });
  if (!existingReminder) {
    return jsonError("Reminder not found", 404);
  }

  const canAccess = await canActorAccessUser(actorGuard.actor, existingReminder.userId);
  if (!canAccess) {
    return jsonError("Forbidden", 403);
  }

  if (
    isLockedForUser(
      actorGuard.actor,
      existingReminder.userId,
      existingReminder.createdByUserId,
    )
  ) {
    return jsonError("User cannot delete manager-created reminder", 403);
  }

  const [deletedReminder] = await db
    .delete(reminders)
    .where(eq(reminders.id, parsedId.data))
    .returning({ id: reminders.id });

  if (!deletedReminder) {
    return jsonError("Reminder not found", 404);
  }

  return NextResponse.json({ data: deletedReminder }, { status: 200 });
}
