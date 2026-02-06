import { and, eq, inArray, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reminders } from "@/db/schema";
import { requireUserId } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const userGuard = await requireUserId(request);
  if (!userGuard.ok) {
    return userGuard.response;
  }

  const now = new Date();
  const dueReminders = await db
    .select({
      id: reminders.id,
      taskId: reminders.taskId,
      eventId: reminders.eventId,
      message: reminders.message,
      remindAt: reminders.remindAt,
    })
    .from(reminders)
    .where(
      and(
        eq(reminders.userId, userGuard.userId),
        eq(reminders.isSent, false),
        lte(reminders.remindAt, now),
      ),
    );

  if (dueReminders.length === 0) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const dueIds = dueReminders.map((entry) => entry.id);
  await db
    .update(reminders)
    .set({ isSent: true, sentAt: now })
    .where(and(eq(reminders.userId, userGuard.userId), inArray(reminders.id, dueIds)));

  return NextResponse.json({ data: dueReminders }, { status: 200 });
}
