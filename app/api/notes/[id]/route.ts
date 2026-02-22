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
const notePathParamsSchema = z.object({
  id: noteIdSchema,
});

const updateNoteSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    content: z.string().trim().min(1).max(20000).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    pinned: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Potrebno je bar jedno polje za izmenu",
  });

/**
 * Izmena beleske
 * @description Menja postojecu belesku po identifikatoru.
 * @tag Beleske
 * @auth apikey
 * @pathParams notePathParamsSchema
 * @body updateNoteSchema
 * @response 200:OpenApiNoteResponseSchema
 * @add 404
 * @openapi
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const params = await context.params;
  const parsedParams = notePathParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return jsonError("Neispravan ID beleske", 400, parsedParams.error.flatten());
  }
  const noteId = parsedParams.data.id;

  const existingNote = await db.query.notes.findFirst({
    where: eq(notes.id, noteId),
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
    return jsonError("Nemate dozvolu za ovu akciju", 403);
  }

  if (
    isLockedForUser(actorGuard.actor, existingNote.userId, existingNote.createdByUserId)
  ) {
    return jsonError("Korisnik ne moze da menja belesku koju je kreirao menadzer", 403);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Neispravan JSON payload", 400);
  }

  const parsedBody = updateNoteSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validacija nije prosla", 400, parsedBody.error.flatten());
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
      return jsonError("Kategorija ne postoji za vlasnika beleske", 400);
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
    .where(eq(notes.id, noteId))
    .returning();

  if (!updatedNote) {
    return jsonError("Note not found", 404);
  }

  return NextResponse.json({ data: updatedNote }, { status: 200 });
}

/**
 * Brisanje beleske
 * @description Brise belesku po identifikatoru.
 * @tag Beleske
 * @auth apikey
 * @pathParams notePathParamsSchema
 * @response 200:OpenApiEntityIdResponseSchema
 * @add 404
 * @openapi
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const params = await context.params;
  const parsedParams = notePathParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return jsonError("Neispravan ID beleske", 400, parsedParams.error.flatten());
  }
  const noteId = parsedParams.data.id;

  const existingNote = await db.query.notes.findFirst({
    where: eq(notes.id, noteId),
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
    return jsonError("Nemate dozvolu za ovu akciju", 403);
  }

  if (
    isLockedForUser(actorGuard.actor, existingNote.userId, existingNote.createdByUserId)
  ) {
    return jsonError("Korisnik ne moze da obrise belesku koju je kreirao menadzer", 403);
  }

  const [deletedNote] = await db
    .delete(notes)
    .where(eq(notes.id, noteId))
    .returning({ id: notes.id });

  if (!deletedNote) {
    return jsonError("Note not found", 404);
  }

  return NextResponse.json({ data: deletedNote }, { status: 200 });
}


