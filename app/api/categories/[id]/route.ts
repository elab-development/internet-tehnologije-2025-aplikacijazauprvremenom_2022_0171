import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { jsonError, parseJsonBody, requireUserId } from "@/lib/api-utils";

const categoryIdSchema = z.string().uuid();

const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
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
  const parsedId = categoryIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid category id", 400, parsedId.error.flatten());
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = updateCategorySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;

  const [updatedCategory] = await db
    .update(categories)
    .set({
      name: input.name,
      color: input.color,
    })
    .where(and(eq(categories.id, parsedId.data), eq(categories.userId, userGuard.userId)))
    .returning({
      id: categories.id,
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
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const params = await context.params;
  const parsedId = categoryIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return jsonError("Invalid category id", 400, parsedId.error.flatten());
  }

  const [deletedCategory] = await db
    .delete(categories)
    .where(and(eq(categories.id, parsedId.data), eq(categories.userId, userGuard.userId)))
    .returning({ id: categories.id });

  if (!deletedCategory) {
    return jsonError("Category not found", 404);
  }

  return NextResponse.json({ data: deletedCategory }, { status: 200 });
}
