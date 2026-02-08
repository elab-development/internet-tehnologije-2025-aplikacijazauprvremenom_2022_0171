import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { todoLists } from "@/db/schema";
import {
  canActorAccessUser,
  jsonError,
  parseJsonBody,
  requireActor,
} from "@/lib/api-utils";

const listIdSchema = z.string().uuid();

const updateListSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
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
  const parsedId = listIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid list id", 400, parsedId.error.flatten());
  }

  const existingList = await db.query.todoLists.findFirst({
    where: eq(todoLists.id, parsedId.data),
    columns: {
      id: true,
      userId: true,
    },
  });
  if (!existingList) {
    return jsonError("List not found", 404);
  }

  const canAccess = await canActorAccessUser(actorGuard.actor, existingList.userId);
  if (!canAccess) {
    return jsonError("Forbidden", 403);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = updateListSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;

  const [updatedList] = await db
    .update(todoLists)
    .set({
      title: input.title,
      description: input.description,
    })
    .where(eq(todoLists.id, parsedId.data))
    .returning({
      id: todoLists.id,
      title: todoLists.title,
      description: todoLists.description,
      createdAt: todoLists.createdAt,
      updatedAt: todoLists.updatedAt,
    });

  if (!updatedList) {
    return jsonError("List not found", 404);
  }

  return NextResponse.json({ data: updatedList }, { status: 200 });
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
  const parsedId = listIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid list id", 400, parsedId.error.flatten());
  }

  const existingList = await db.query.todoLists.findFirst({
    where: eq(todoLists.id, parsedId.data),
    columns: {
      id: true,
      userId: true,
    },
  });
  if (!existingList) {
    return jsonError("List not found", 404);
  }

  const canAccess = await canActorAccessUser(actorGuard.actor, existingList.userId);
  if (!canAccess) {
    return jsonError("Forbidden", 403);
  }

  const [deletedList] = await db
    .delete(todoLists)
    .where(eq(todoLists.id, parsedId.data))
    .returning({ id: todoLists.id });

  if (!deletedList) {
    return jsonError("List not found", 404);
  }

  return NextResponse.json({ data: deletedList }, { status: 200 });
}
