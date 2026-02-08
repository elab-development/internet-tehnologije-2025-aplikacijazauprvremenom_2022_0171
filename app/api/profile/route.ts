import { and, eq, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { jsonError, parseJsonBody, requireUserId } from "@/lib/api-utils";

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.email().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Potrebno je bar jedno polje za izmenu",
  });

export async function GET(request: NextRequest) {
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const profile = await db.query.user.findFirst({
    where: eq(user.id, userGuard.userId),
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!profile) {
    return jsonError("Korisnik\ nije\ pronadjen", 404);
  }

  return NextResponse.json({ data: profile }, { status: 200 });
}

export async function PATCH(request: NextRequest) {
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Neispravan\ JSON\ payload", 400);
  }

  const parsedBody = updateProfileSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validacija nije prosla", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;

  if (input.email) {
    const existingEmail = await db.query.user.findFirst({
      where: and(eq(user.email, input.email), ne(user.id, userGuard.userId)),
      columns: { id: true },
    });
    if (existingEmail) {
      return jsonError("Email is already in use", 409);
    }
  }

  const [updatedProfile] = await db
    .update(user)
    .set({
      name: input.name,
      email: input.email,
    })
    .where(eq(user.id, userGuard.userId))
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });

  if (!updatedProfile) {
    return jsonError("Korisnik\ nije\ pronadjen", 404);
  }

  return NextResponse.json({ data: updatedProfile }, { status: 200 });
}


