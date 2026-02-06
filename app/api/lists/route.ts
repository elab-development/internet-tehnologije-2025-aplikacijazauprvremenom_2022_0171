import { and, asc, eq, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { todoLists } from "@/db/schema";
import { auth } from "@/lib/auth";

const createListSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
});

const listQuerySchema = z.object({
  q: z.string().trim().min(1).max(255).optional(),
});

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { message, details } }, { status });
}

async function getSessionUserId(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

async function parseJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = listQuerySchema.safeParse(search);

  if (!parsedQuery.success) {
    return jsonError("Invalid query parameters", 400, parsedQuery.error.flatten());
  }

  const whereCondition = parsedQuery.data.q
    ? and(eq(todoLists.userId, userId), ilike(todoLists.title, `%${parsedQuery.data.q}%`))
    : eq(todoLists.userId, userId);

  const lists = await db
    .select({
      id: todoLists.id,
      title: todoLists.title,
      description: todoLists.description,
      createdAt: todoLists.createdAt,
      updatedAt: todoLists.updatedAt,
    })
    .from(todoLists)
    .where(whereCondition)
    .orderBy(asc(todoLists.createdAt));

  return NextResponse.json({ data: lists }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = createListSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Validation failed", 400, parsedBody.error.flatten());
  }

  const input = parsedBody.data;

  const [createdList] = await db
    .insert(todoLists)
    .values({
      userId,
      title: input.title,
      description: input.description ?? null,
    })
    .returning({
      id: todoLists.id,
      title: todoLists.title,
      description: todoLists.description,
      createdAt: todoLists.createdAt,
      updatedAt: todoLists.updatedAt,
    });

  return NextResponse.json({ data: createdList }, { status: 201 });
}
