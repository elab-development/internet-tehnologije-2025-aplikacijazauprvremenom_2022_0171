import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories } from "@/db/schema";
import {
  canActorAccessUser,
  isLockedForUser,
  jsonError,
  parseJsonBody,
  requireActor,
} from "@/lib/api-utils";

const categoryIdSchema = z.string().uuid();

const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Potrebno je bar jedno polje za izmenu",
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
  const parsedId = categoryIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Neispravan ID kategorije", 400, parsedId.error.flatten());
  }

  const existingCategory = await db.query.categories.findFirst({
    where: eq(categories.id, parsedId.data),
    columns: {
      id: true,
      userId: true,
      createdByUserId: true,
    },
  });

  if (!existingCategory) {
    return jsonError("Category not found", 404);
  }

  const canAccess = await canActorAccessUser(actorGuard.actor, existingCategory.userId);
  if (!canAccess) {
    return jsonError("Nemate dozvolu za ovu akciju", 403);
  }

  if (
    isLockedForUser(
      actorGuard.actor,
      existingCategory.userId,
      existingCategory.createdByUserId,
    )
  ) {
    return jsonError("Korisnik ne moze da menja kategoriju koju je kreirao menadzer", 403);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Neispravan JSON payload", 400);
  }

  const parsedBody = updateCategorySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validacija nije prosla", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;

  const [updatedCategory] = await db
    .update(categories)
    .set({
      name: input.name,
      color: input.color,
    })
    .where(eq(categories.id, parsedId.data))
    .returning({
      id: categories.id,
      userId: categories.userId,
      createdByUserId: categories.createdByUserId,
      name: categories.name,
      color: categories.color,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
    });

  if (!updatedCategory) {
    return jsonError("Category not found", 404);
  }

  return NextResponse.json({ data: updatedCategory }, { status: 200 });
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
  const parsedId = categoryIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Neispravan ID kategorije", 400, parsedId.error.flatten());
  }

  const existingCategory = await db.query.categories.findFirst({
    where: eq(categories.id, parsedId.data),
    columns: {
      id: true,
      userId: true,
      createdByUserId: true,
    },
  });

  if (!existingCategory) {
    return jsonError("Category not found", 404);
  }

  const canAccess = await canActorAccessUser(actorGuard.actor, existingCategory.userId);
  if (!canAccess) {
    return jsonError("Nemate dozvolu za ovu akciju", 403);
  }

  if (
    isLockedForUser(
      actorGuard.actor,
      existingCategory.userId,
      existingCategory.createdByUserId,
    )
  ) {
    return jsonError("Korisnik ne moze da obrise kategoriju koju je kreirao menadzer", 403);
  }

  const [deletedCategory] = await db
    .delete(categories)
    .where(eq(categories.id, parsedId.data))
    .returning({ id: categories.id });

  if (!deletedCategory) {
    return jsonError("Category not found", 404);
  }

  return NextResponse.json({ data: deletedCategory }, { status: 200 });
}


