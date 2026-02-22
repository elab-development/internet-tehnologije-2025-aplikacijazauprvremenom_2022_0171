import { and, asc, eq, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories } from "@/db/schema";
import {
  jsonError,
  parseJsonBody,
  requireActor,
  resolveTargetUserId,
} from "@/lib/api-utils";

const listCategoriesSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(255).optional(),
});

const createCategorySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

/**
 * Lista kategorija
 * @description Vraca sve kategorije za ulogovanog korisnika ili korisnika iz query parametra ako je pristup dozvoljen.
 * @tag Kategorije
 * @auth apikey
 * @params listCategoriesSchema
 * @response 200:OpenApiCategoriesListResponseSchema
 * @openapi
 */
export async function GET(request: NextRequest) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = listCategoriesSchema.safeParse(search);
  if (!parsedQuery.success) {
    return jsonError("Neispravni\ parametri\ upita", 400, parsedQuery.error.flatten());
  }

  const targetUserGuard = await resolveTargetUserId(
    actorGuard.actor,
    parsedQuery.data.userId,
  );
  if (!targetUserGuard.ok) {
    return targetUserGuard.response;
  }

  const whereCondition = parsedQuery.data.q
    ? and(
        eq(categories.userId, targetUserGuard.targetUserId),
        ilike(categories.name, `%${parsedQuery.data.q}%`),
      )
    : eq(categories.userId, targetUserGuard.targetUserId);

  const items = await db
    .select({
      id: categories.id,
      userId: categories.userId,
      createdByUserId: categories.createdByUserId,
      name: categories.name,
      color: categories.color,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
    })
    .from(categories)
    .where(whereCondition)
    .orderBy(asc(categories.name));

  return NextResponse.json({ data: items }, { status: 200 });
}

/**
 * Kreiranje kategorije
 * @description Kreira novu kategoriju za izabranog korisnika.
 * @tag Kategorije
 * @auth apikey
 * @body createCategorySchema
 * @response 201:OpenApiCategoryResponseSchema
 * @add 409
 * @openapi
 */
export async function POST(request: NextRequest) {
  const actorGuard = await requireActor(request);
  if (!actorGuard.ok) {
    return actorGuard.response;
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Neispravan\ JSON\ payload", 400);
  }

  const parsedBody = createCategorySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validacija nije prosla", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;
  const targetUserGuard = await resolveTargetUserId(actorGuard.actor, input.userId);
  if (!targetUserGuard.ok) {
    return targetUserGuard.response;
  }

  const [createdCategory] = await db
    .insert(categories)
    .values({
      userId: targetUserGuard.targetUserId,
      createdByUserId: actorGuard.actor.id,
      name: input.name,
      color: input.color ?? "#4f8cff",
    })
    .onConflictDoNothing({
      target: [categories.userId, categories.name],
    })
    .returning({
      id: categories.id,
      userId: categories.userId,
      createdByUserId: categories.createdByUserId,
      name: categories.name,
      color: categories.color,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
    });

  if (!createdCategory) {
    return jsonError("Category with same name already exists", 409);
  }

  return NextResponse.json({ data: createdCategory }, { status: 201 });
}


