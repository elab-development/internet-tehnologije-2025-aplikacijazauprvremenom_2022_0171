import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TasksPageClient } from "@/components/tasks-page-client";
import { db } from "@/db";
import { categories, todoLists, user, userPreferences } from "@/db/schema";
import { auth } from "@/lib/auth";
import { normalizeLanguage } from "@/lib/i18n";
import { isAdmin } from "@/lib/roles";

export default async function TasksPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: { role: true },
  });

  const [lists, userCategories, preferences] = await Promise.all([
    db
      .select({
        id: todoLists.id,
        title: todoLists.title,
        description: todoLists.description,
      })
      .from(todoLists)
      .where(eq(todoLists.userId, session.user.id))
      .orderBy(asc(todoLists.createdAt)),
    db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
      })
      .from(categories)
      .where(eq(categories.userId, session.user.id))
      .orderBy(asc(categories.name)),
    db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.user.id),
      columns: { language: true },
    }),
  ]);

  return (
    <TasksPageClient
      lists={lists}
      categories={userCategories}
      canAccessAdmin={isAdmin(currentUser?.role)}
      initialLanguage={normalizeLanguage(preferences?.language)}
      sessionUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      }}
    />
  );
}
