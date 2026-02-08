import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories, tasks, todoLists } from "@/db/schema";
import {
  canActorAccessUser,
  isLockedForUser,
  jsonError,
  parseJsonBody,
  requireActor,
} from "@/lib/api-utils";
import {
  deleteTask,
  ServiceError,
  updateTaskStatus,
} from "@/lib/manager-service";

const priorityValues = ["low", "medium", "high"] as const;
const statusValues = ["not_started", "in_progress", "done"] as const;

const taskIdSchema = z.string().uuid();

const updateTaskSchema = z
  .object({
    listId: z.string().uuid().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().min(1).max(5000).nullable().optional(),
    priority: z.enum(priorityValues).optional(),
    status: z.enum(statusValues).optional(),
    dueDate: z.string().datetime({ offset: true }).nullable().optional(),
    completedAt: z.string().datetime({ offset: true }).nullable().optional(),
    estimatedMinutes: z.number().int().min(1).max(10080).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required for update",
  });

function toApiError(error: unknown) {
  if (error instanceof ServiceError) {
    return jsonError(error.message, error.status, error.details);
  }

  return jsonError("Internal server error", 500);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const params = await context.params;
  const parsedId = taskIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid task id", 400, parsedId.error.flatten());
  }

  const existingTask = await db.query.tasks.findFirst({
    where: eq(tasks.id, parsedId.data),
    columns: {
      id: true,
      userId: true,
      createdByUserId: true,
    },
  });

  if (!existingTask) {
    return jsonError("Task not found", 404);
  }

  const canAccess = await canActorAccessUser(actorGuard.actor, existingTask.userId);
  if (!canAccess) {
    return jsonError("Forbidden", 403);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = updateTaskSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;

  const statusOnlyKeys = new Set(["status", "completedAt"]);
  const hasOnlyStatusUpdate = Object.keys(input).every((key) => statusOnlyKeys.has(key));

  if (actorGuard.actor.role === "user" && actorGuard.actor.id !== existingTask.userId) {
    return jsonError("Forbidden", 403);
  }

  const lockedForUser = isLockedForUser(
    actorGuard.actor,
    existingTask.userId,
    existingTask.createdByUserId,
  );

  if (lockedForUser) {
    if (!hasOnlyStatusUpdate || input.status === undefined) {
      return jsonError(
        "User can only update status on manager-created task",
        403,
      );
    }
  }

  try {
    if (hasOnlyStatusUpdate && input.status) {
      const updatedTask = await updateTaskStatus({
        actor: actorGuard.actor,
        taskId: existingTask.id,
        status: input.status,
        completedAt:
          input.completedAt === undefined
            ? undefined
            : input.completedAt
              ? new Date(input.completedAt)
              : null,
      });

      return NextResponse.json({ data: updatedTask }, { status: 200 });
    }

    if (input.listId) {
      const list = await db.query.todoLists.findFirst({
        where: and(eq(todoLists.id, input.listId), eq(todoLists.userId, existingTask.userId)),
        columns: { id: true },
      });

      if (!list) {
        return jsonError("List does not exist for task owner", 400);
      }
    }

    if (input.categoryId) {
      const category = await db.query.categories.findFirst({
        where: and(
          eq(categories.id, input.categoryId),
          eq(categories.userId, existingTask.userId),
        ),
        columns: { id: true },
      });

      if (!category) {
        return jsonError("Category does not exist for task owner", 400);
      }
    }

    const updateValues: Partial<typeof tasks.$inferInsert> = {};

    if (input.listId !== undefined) updateValues.listId = input.listId;
    if (input.categoryId !== undefined) updateValues.categoryId = input.categoryId;
    if (input.title !== undefined) updateValues.title = input.title;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.priority !== undefined) updateValues.priority = input.priority;
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.dueDate !== undefined) {
      updateValues.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }
    if (input.completedAt !== undefined) {
      updateValues.completedAt = input.completedAt ? new Date(input.completedAt) : null;
    }
    if (input.estimatedMinutes !== undefined) {
      updateValues.estimatedMinutes = input.estimatedMinutes;
    }

    const [updatedTask] = await db
      .update(tasks)
      .set(updateValues)
      .where(eq(tasks.id, parsedId.data))
      .returning();

    if (!updatedTask) {
      return jsonError("Task not found", 404);
    }

    return NextResponse.json({ data: updatedTask }, { status: 200 });
  } catch (error) {
    return toApiError(error);
  }
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
  const parsedId = taskIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid task id", 400, parsedId.error.flatten());
  }

  try {
    const deleted = await deleteTask({
      actor: actorGuard.actor,
      taskId: parsedId.data,
    });

    return NextResponse.json({ data: deleted }, { status: 200 });
  } catch (error) {
    return toApiError(error);
  }
}
