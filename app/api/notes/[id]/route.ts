import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories, notes } from "@/db/schema";
import { jsonError, parseJsonBody, requireUserId } from "@/lib/api-utils";

const noteIdSchema = z.string().uuid();

const updateNoteSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    content: z.string().trim().min(1).max(20000).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    pinned: z.boolean().optional(),
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
  const parsedId = noteIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid note id", 400, parsedId.error.flatten());
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = updateNoteSchema.safeParse(body);
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

  const [updatedNote] = await db
    .update(notes)
    .set({
      title: input.title,
      content: input.content,
      categoryId: input.categoryId,
      pinned: input.pinned,
    })
    .where(and(eq(notes.id, parsedId.data), eq(notes.userId, userGuard.userId)))
    .returning();

  if (!updatedNote) {
    return jsonError("Note not found", 404);
  }

  return NextResponse.json({ data: updatedNote }, { status: 200 });
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
  const parsedId = noteIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid note id", 400, parsedId.error.flatten());
  }

  const [deletedNote] = await db
    .delete(notes)
    .where(and(eq(notes.id, parsedId.data), eq(notes.userId, userGuard.userId)))
    .returning({ id: notes.id });

  if (!deletedNote) {
    return jsonError("Note not found", 404);
  }

  return NextResponse.json({ data: deletedNote }, { status: 200 });
}
