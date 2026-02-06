import { and, asc, eq, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { jsonError, parseJsonBody, requireUserId } from "@/lib/api-utils";

const listCategoriesSchema = z.object({
  q: z.string().trim().min(1).max(255).optional(),
});

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function GET(request: NextRequest) {
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = listCategoriesSchema.safeParse(search);
  if (!parsedQuery.success) {
    return jsonError("Invalid query parameters", 400, parsedQuery.error.flatten());
  }

  const whereCondition = parsedQuery.data.q
    ? and(
        eq(categories.userId, userGuard.userId),
        ilike(categories.name, `%${parsedQuery.data.q}%`),
      )
    : eq(categories.userId, userGuard.userId);

  const items = await db
    .select({
      id: categories.id,
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

export async function POST(request: NextRequest) {
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = createCategorySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;

  const [createdCategory] = await db
    .insert(categories)
    .values({
      userId: userGuard.userId,
      name: input.name,
      color: input.color ?? "#4f8cff",
    })
    .onConflictDoNothing({
      target: [categories.userId, categories.name],
    })
    .returning({
      id: categories.id,
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
