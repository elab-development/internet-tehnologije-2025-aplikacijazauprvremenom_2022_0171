import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { jsonError, parseJsonBody, requireUserId } from "@/lib/api-utils";

const themeValues = ["system", "light", "dark"] as const;
const densityValues = ["compact", "comfortable"] as const;

const updatePreferencesSchema = z
  .object({
    theme: z.enum(themeValues).optional(),
    layoutDensity: z.enum(densityValues).optional(),
    timezone: z.string().trim().min(1).max(120).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Potrebno je bar jedno polje za izmenu",
  });

async function getOrCreatePreferences(userId: string) {
  const existing = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });

  if (existing) {
    if (existing.language === "sr") {
      return existing;
    }

    const [normalized] = await db
      .update(userPreferences)
      .set({ language: "sr" })
      .where(eq(userPreferences.userId, userId))
      .returning();

    return normalized ?? existing;
  }

  const [created] = await db
    .insert(userPreferences)
    .values({ userId })
    .returning();

  return created;
}

/**
 * Podesavanja korisnika
 * @description Vraca podesavanja trenutno ulogovanog korisnika.
 * @tag Podesavanja
 * @auth apikey
 * @response 200:OpenApiPreferencesResponseSchema
 * @openapi
 */
export async function GET(request: NextRequest) {
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const preferences = await getOrCreatePreferences(userGuard.userId);
  const response = NextResponse.json({ data: preferences }, { status: 200 });
  response.cookies.set("tm-language", "sr", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  response.cookies.set("tm-density", preferences.layoutDensity, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  response.cookies.set("tm-theme", preferences.theme, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

/**
 * Izmena podesavanja korisnika
 * @description Menja temu, gustinu prikaza i vremensku zonu trenutno ulogovanog korisnika.
 * @tag Podesavanja
 * @auth apikey
 * @body updatePreferencesSchema
 * @response 200:OpenApiPreferencesResponseSchema
 * @add 404
 * @openapi
 */
export async function PATCH(request: NextRequest) {
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Neispravan\ JSON\ payload", 400);
  }

  const parsedBody = updatePreferencesSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validacija nije prosla", 400, parsedBody.error.flatten());
  }

  await getOrCreatePreferences(userGuard.userId);

  const input = parsedBody.data;

  const [updatedPreferences] = await db
    .update(userPreferences)
    .set({
      theme: input.theme,
      language: "sr",
      layoutDensity: input.layoutDensity,
      timezone: input.timezone,
    })
    .where(eq(userPreferences.userId, userGuard.userId))
    .returning();

  if (!updatedPreferences) {
    return jsonError("Preferences not found", 404);
  }

  const response = NextResponse.json({ data: updatedPreferences }, { status: 200 });
  response.cookies.set("tm-language", "sr", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  response.cookies.set("tm-density", updatedPreferences.layoutDensity, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  response.cookies.set("tm-theme", updatedPreferences.theme, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}


