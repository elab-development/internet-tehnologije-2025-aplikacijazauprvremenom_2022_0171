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
const categoryPathParamsSchema = z.object({
  id: categoryIdSchema,
});

const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Potrebno je bar jedno polje za izmenu",
  });

/**
 * Izmena kategorije
 * @description Menja naziv i/ili boju postojece kategorije.
 * @tag Kategorije
 * @auth apikey
 * @pathParams categoryPathParamsSchema
 * @body updateCategorySchema
 * @response 200:OpenApiCategoryResponseSchema
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
  const parsedParams = categoryPathParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return jsonError("Neispravan ID kategorije", 400, parsedParams.error.flatten());
  }
  const categoryId = parsedParams.data.id;

  const existingCategory = await db.query.categories.findFirst({
    where: eq(categories.id, categoryId),
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
    .where(eq(categories.id, categoryId))
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

/**
 * Brisanje kategorije
 * @description Brise kategoriju po identifikatoru.
 * @tag Kategorije
 * @auth apikey
 * @pathParams categoryPathParamsSchema
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
  const parsedParams = categoryPathParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return jsonError("Neispravan ID kategorije", 400, parsedParams.error.flatten());
  }
  const categoryId = parsedParams.data.id;

  const existingCategory = await db.query.categories.findFirst({
    where: eq(categories.id, categoryId),
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
    .where(eq(categories.id, categoryId))
    .returning({ id: categories.id });

  if (!deletedCategory) {
    return jsonError("Category not found", 404);
  }

  return NextResponse.json({ data: deletedCategory }, { status: 200 });
}


