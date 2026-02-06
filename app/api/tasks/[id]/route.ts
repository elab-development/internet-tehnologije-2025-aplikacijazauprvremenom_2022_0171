import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories, tasks, todoLists } from "@/db/schema";
import { auth } from "@/lib/auth";

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const params = await context.params;
  const parsedId = taskIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid task id", 400, parsedId.error.flatten());
  }

  const existingTask = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, parsedId.data), eq(tasks.userId, userId)),
    columns: { id: true },
  });

  if (!existingTask) {
    return jsonError("Task not found", 404);
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

  if (input.listId) {
    const list = await db.query.todoLists.findFirst({
      where: and(eq(todoLists.id, input.listId), eq(todoLists.userId, userId)),
      columns: { id: true },
    });

    if (!list) {
      return jsonError("List does not exist for authenticated user", 400);
    }
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
    .where(and(eq(tasks.id, parsedId.data), eq(tasks.userId, userId)))
    .returning();

  if (!updatedTask) {
    return jsonError("Task not found", 404);
  }

  return NextResponse.json({ data: updatedTask }, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const params = await context.params;
  const parsedId = taskIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid task id", 400, parsedId.error.flatten());
  }

  const [deletedTask] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, parsedId.data), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });

  if (!deletedTask) {
    return jsonError("Task not found", 404);
  }

  return NextResponse.json({ data: deletedTask }, { status: 200 });
}