import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories, notes } from "@/db/schema";
import {
  canActorAccessUser,
  isLockedForUser,
  jsonError,
  parseJsonBody,
  requireActor,
} from "@/lib/api-utils";

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
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const params = await context.params;
  const parsedId = noteIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid note id", 400, parsedId.error.flatten());
  }

  const existingNote = await db.query.notes.findFirst({
    where: eq(notes.id, parsedId.data),
    columns: {
      id: true,
      userId: true,
      createdByUserId: true,
    },
  });

  if (!existingNote) {
    return jsonError("Note not found", 404);
  }

  const canAccess = await canActorAccessUser(actorGuard.actor, existingNote.userId);
  if (!canAccess) {
    return jsonError("Forbidden", 403);
  }

  if (
    isLockedForUser(actorGuard.actor, existingNote.userId, existingNote.createdByUserId)
  ) {
    return jsonError("User cannot modify manager-created note", 403);
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
      where: and(
        eq(categories.id, input.categoryId),
        eq(categories.userId, existingNote.userId),
      ),
      columns: { id: true },
    });
    if (!category) {
      return jsonError("Category does not exist for note owner", 400);
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
    .where(eq(notes.id, parsedId.data))
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
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const params = await context.params;
  const parsedId = noteIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid note id", 400, parsedId.error.flatten());
  }

  const existingNote = await db.query.notes.findFirst({
    where: eq(notes.id, parsedId.data),
    columns: {
      id: true,
      userId: true,
      createdByUserId: true,
    },
  });

  if (!existingNote) {
    return jsonError("Note not found", 404);
  }

  const canAccess = await canActorAccessUser(actorGuard.actor, existingNote.userId);
  if (!canAccess) {
    return jsonError("Forbidden", 403);
  }

  if (
    isLockedForUser(actorGuard.actor, existingNote.userId, existingNote.createdByUserId)
  ) {
    return jsonError("User cannot delete manager-created note", 403);
  }

  const [deletedNote] = await db
    .delete(notes)
    .where(eq(notes.id, parsedId.data))
    .returning({ id: notes.id });

  if (!deletedNote) {
    return jsonError("Note not found", 404);
  }

  return NextResponse.json({ data: deletedNote }, { status: 200 });
}
