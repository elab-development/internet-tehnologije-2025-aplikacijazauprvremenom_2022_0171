import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { todoLists } from "@/db/schema";
import { jsonError, parseJsonBody, requireUserId } from "@/lib/api-utils";

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
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const params = await context.params;
  const parsedId = listIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid list id", 400, parsedId.error.flatten());
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
    .where(and(eq(todoLists.id, parsedId.data), eq(todoLists.userId, userGuard.userId)))
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
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const params = await context.params;
  const parsedId = listIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid list id", 400, parsedId.error.flatten());
  }

  const [deletedList] = await db
    .delete(todoLists)
    .where(and(eq(todoLists.id, parsedId.data), eq(todoLists.userId, userGuard.userId)))
    .returning({ id: todoLists.id });

  if (!deletedList) {
    return jsonError("List not found", 404);
  }

  return NextResponse.json({ data: deletedList }, { status: 200 });
}
