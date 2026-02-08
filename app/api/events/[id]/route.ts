import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { calendarEvents, tasks } from "@/db/schema";
import {
  canActorAccessUser,
  isLockedForUser,
  jsonError,
  parseJsonBody,
  requireActor,
} from "@/lib/api-utils";

const eventIdSchema = z.string().uuid();

const updateEventSchema = z
  .object({
    taskId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).optional(),
    location: z.string().trim().max(255).nullable().optional(),
  })
  .refine(
    (input) => {
      if (input.startsAt && input.endsAt) {
        return new Date(input.endsAt) > new Date(input.startsAt);
      }
      return true;
    },
    {
      message: "Event end time must be after start time",
      path: ["endsAt"],
    },
  )
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
  const parsedId = eventIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid event id", 400, parsedId.error.flatten());
  }

  const existingEvent = await db.query.calendarEvents.findFirst({
    where: eq(calendarEvents.id, parsedId.data),
    columns: {
      id: true,
      userId: true,
      createdByUserId: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!existingEvent) {
    return jsonError("Event not found", 404);
  }

  const canAccess = await canActorAccessUser(actorGuard.actor, existingEvent.userId);
  if (!canAccess) {
    return jsonError("Forbidden", 403);
  }

  if (
    isLockedForUser(actorGuard.actor, existingEvent.userId, existingEvent.createdByUserId)
  ) {
    return jsonError("User cannot modify manager-created event", 403);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = updateEventSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;

  if (input.taskId) {
    const linkedTask = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, input.taskId), eq(tasks.userId, existingEvent.userId)),
      columns: { id: true },
    });
    if (!linkedTask) {
      return jsonError("Task does not exist for event owner", 400);
    }
  }

  const nextStartsAt = input.startsAt ? new Date(input.startsAt) : existingEvent.startsAt;
  const nextEndsAt = input.endsAt ? new Date(input.endsAt) : existingEvent.endsAt;
  if (nextEndsAt <= nextStartsAt) {
    return jsonError("Event end time must be after start time", 400);
  }

  const [updatedEvent] = await db
    .update(calendarEvents)
    .set({
      taskId: input.taskId,
      title: input.title,
      description: input.description,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      location: input.location,
    })
    .where(eq(calendarEvents.id, parsedId.data))
    .returning();

  if (!updatedEvent) {
    return jsonError("Event not found", 404);
  }

  return NextResponse.json({ data: updatedEvent }, { status: 200 });
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
  const parsedId = eventIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid event id", 400, parsedId.error.flatten());
  }

  const existingEvent = await db.query.calendarEvents.findFirst({
    where: eq(calendarEvents.id, parsedId.data),
    columns: {
      id: true,
      userId: true,
      createdByUserId: true,
    },
  });
  if (!existingEvent) {
    return jsonError("Event not found", 404);
  }

  const canAccess = await canActorAccessUser(actorGuard.actor, existingEvent.userId);
  if (!canAccess) {
    return jsonError("Forbidden", 403);
  }

  if (
    isLockedForUser(actorGuard.actor, existingEvent.userId, existingEvent.createdByUserId)
  ) {
    return jsonError("User cannot delete manager-created event", 403);
  }

  const [deletedEvent] = await db
    .delete(calendarEvents)
    .where(eq(calendarEvents.id, parsedId.data))
    .returning({ id: calendarEvents.id });

  if (!deletedEvent) {
    return jsonError("Event not found", 404);
  }

  return NextResponse.json({ data: deletedEvent }, { status: 200 });
}
